// Bank transfers reported by SePay (classic webhook) or Bank Hub IPN: dedupe, match the invoice
// from the transfer content and book it, or keep the money as an unmatched payment.
const mongoose = require("mongoose");
const { LIVE_CONTRACT_STATUSES, OWING_INVOICE_STATUSES } = require("../../utils/statuses");
const crypto = require("node:crypto");
const { Invoice, Payment, UnmatchedPayment, User, Contract } = require("../../models");
const PaymentReceipt = require("../../models/PaymentReceipt");
const { AppError } = require("../../utils/errors");
const validate = require("../../utils/financeValidation");
const { hasFeature } = require("../planFeatures");
const { simulatorEnabled } = require("../../utils/paymentSimulator");
const { systemActor } = require("../../utils/systemActor");
const { parseVnDateTime } = require("../../utils/vnTime");
const { applyPayment } = require("./applyPayment");
const audit = require("../auditService");

const DEPOSIT_PENDING_STATUSES = LIVE_CONTRACT_STATUSES;
// Deposit transfer content: "COC HDT<year><12 hex>" (contract code HDT-<year>-<hex> without dashes).
const DEPOSIT_TOKEN = /COC\s*HDT(\d{4})([A-F0-9]{12})/g;
const depositSyntax = (contractCode) => `COC ${contractCode.replace(/[^a-zA-Z0-9]/g, "")}`;

function normalizeWebhook(body) {
  if (!body || !["in", "out"].includes(body.transferType))
    throw new AppError("transferType không hợp lệ", 400, "VALIDATION_ERROR");
  const accountNumber = validate.text(body.accountNumber, "accountNumber", 50);
  const referenceCode = validate.text(body.referenceCode, "referenceCode", 100);
  const amount = validate.money(body.transferAmount, "transferAmount", true);
  if (
    !(Number.isSafeInteger(body.id) && body.id > 0) &&
    !(typeof body.id === "string" && /^\d{1,30}$/.test(body.id))
  ) {
    throw new AppError(
      "id giao dịch SePay không hợp lệ",
      400,
      "VALIDATION_ERROR",
    );
  }
  // SePay sends Vietnam local time without a zone; ISO timestamps are accepted as-is.
  const transactionDate =
    parseVnDateTime(body.transactionDate) || validate.date(body.transactionDate, "transactionDate");
  if (typeof body.content !== "string" || body.content.length > 2000)
    throw new AppError("content không hợp lệ", 400, "VALIDATION_ERROR");
  const gateway = validate.text(body.gateway, "gateway", 100);
  return {
    accountNumber,
    referenceCode,
    amount,
    transactionDate,
    gateway,
    content: body.content,
    gatewayTransactionId: `SEPAY:${body.id}`,
  };
}

function duplicateReceipt(receipt, landlord, incoming) {
  if (
    receipt.source !== "SEPAY" ||
    String(receipt.landlordId) !== String(landlord._id) ||
    // Receipts created before references were scoped stored the reference as _id.
    (receipt.referenceCode ?? receipt._id) !== incoming.referenceCode ||
    receipt.amount !== incoming.amount
  ) {
    throw new AppError(
      "Mã giao dịch đã được dùng cho một khoản thu khác",
      409,
      "PAYMENT_REFERENCE_CONFLICT",
    );
  }
  return {
    duplicate: true,
    paymentId: receipt.paymentId,
    unmatchedPaymentId: receipt.unmatchedPaymentId,
    contractId: receipt.contractId,
  };
}

// Bank references are only unique per landlord; cash receipt numbers never collide with them.
async function findDuplicate(incoming, landlord, session) {
  const receipt = await PaymentReceipt.findOne({
    $or: [
      { _id: PaymentReceipt.receiptId(landlord._id, "SEPAY", incoming.referenceCode) },
      { _id: incoming.referenceCode, landlordId: landlord._id, source: "SEPAY" },
      { gatewayTransactionId: incoming.gatewayTransactionId },
    ],
  }).session(session || null);
  if (receipt) return duplicateReceipt(receipt, landlord, incoming);
  const legacy = await Payment.findOne({
    landlordId: landlord._id,
    referenceCode: incoming.referenceCode,
    paymentMethod: { $in: ["BANK_TRANSFER", "VIETQR"] },
  }).session(session || null);
  if (legacy) {
    if (legacy.amount !== incoming.amount) {
      throw new AppError(
        "Mã giao dịch đã tồn tại",
        409,
        "PAYMENT_REFERENCE_CONFLICT",
      );
    }
    return { duplicate: true, paymentId: legacy._id };
  }
  const unmatched = await UnmatchedPayment.findOne({
    landlordId: landlord._id,
    referenceCode: incoming.referenceCode,
  }).session(session || null);
  if (unmatched) {
    if (unmatched.amount !== incoming.amount)
      throw new AppError(
        "Mã giao dịch đã tồn tại",
        409,
        "PAYMENT_REFERENCE_CONFLICT",
      );
    return { duplicate: true, unmatchedPaymentId: unmatched._id };
  }
  return null;
}

// Banks may drop the space before the room code ("HD...P101"), so a token can carry a
// suffix: try its prefixes and keep the longest invoice code. Several invoices -> no match.
async function invoiceFromContent(landlordId, content, session) {
  const tokens = [...new Set(content.toUpperCase().match(/HD[A-Z0-9]{4,}/g) || [])].slice(0, 20);
  const prefixes = new Set();
  for (const token of tokens)
    for (let length = 6; length <= Math.min(token.length, 34); length++)
      prefixes.add(token.slice(0, length));
  if (!prefixes.size) return null;
  const candidates = await Invoice.find({
    landlordId,
    invoiceCode: { $in: [...prefixes] },
    isDeleted: false,
  }).session(session);
  const picked = new Map();
  for (const token of tokens) {
    const best = candidates
      .filter((invoice) => token.startsWith(invoice.invoiceCode))
      .sort((a, b) => b.invoiceCode.length - a.invoiceCode.length)[0];
    if (best) picked.set(String(best._id), best);
  }
  return picked.size === 1 ? [...picked.values()][0] : null;
}

// The one contract named by a "COC ..." token in the content; several different codes -> none.
async function depositContractFromContent(landlordId, content, session) {
  const codes = new Set(
    [...content.toUpperCase().matchAll(DEPOSIT_TOKEN)].map(([, year, hex]) => `HDT-${year}-${hex}`),
  );
  if (codes.size !== 1) return null;
  return Contract.findOne({ landlordId, contractCode: [...codes][0], isDeleted: false }).session(session);
}

// Why a matched deposit transfer cannot be booked; null when it can.
function depositProblem(contract, amount) {
  if (contract.depositStatus !== "UNPAID") return "Hợp đồng đã ghi nhận tiền cọc trước đó";
  if (!DEPOSIT_PENDING_STATUSES.includes(contract.status)) return `Hợp đồng không còn hiệu lực: ${contract.status}`;
  if (amount !== contract.depositAmount)
    return `Số tiền ${amount.toLocaleString("vi-VN")}đ khác tiền cọc ${contract.depositAmount.toLocaleString("vi-VN")}đ`;
  return null;
}

async function bookDeposit(contract, incoming, landlord, session) {
  contract.depositStatus = "PAID";
  contract.depositReceivedAt = incoming.transactionDate;
  contract.depositReferenceCode = incoming.referenceCode;
  await contract.save({ session });
  await audit.record(
    {
      actor: systemActor(landlord._id),
      landlordId: landlord._id,
      action: "RECEIVE_CONTRACT_DEPOSIT",
      entityType: "CONTRACT",
      entityId: contract._id,
      before: { depositStatus: "UNPAID" },
      after: {
        depositStatus: "PAID",
        depositAmount: contract.depositAmount,
        depositReceivedAt: incoming.transactionDate,
        referenceCode: incoming.referenceCode,
        gateway: incoming.gateway,
      },
    },
    session,
  );
}

async function processWebhook(body) {
  const incoming = normalizeWebhook(body);
  if (body.transferType === "out") return { ignored: true };
  return receiveTransfer(incoming, body, {
    "bankConfig.accountNumber": incoming.accountNumber,
  });
}

// Records one incoming transfer for the single landlord matching landlordFilter: dedupe,
// auto-match the invoice when the plan allows, otherwise keep it as unmatched.
// Shared by the SePay webhook and the Bank Hub IPN once their payloads are normalized.
async function receiveTransfer(incoming, body, landlordFilter) {
  const landlords = await User.find({
    role: "LANDLORD",
    isDeleted: false,
    ...landlordFilter,
  }).limit(2);
  if (landlords.length !== 1)
    throw new AppError(
      "Không xác định được chủ trọ từ tài khoản nhận tiền",
      400,
      "BANK_ACCOUNT_MISMATCH",
    );
  const landlord = landlords[0];
  // Money already reached a suspended landlord's account: keep it for review, never drop it.
  const suspended = landlord.status !== "ACTIVE";
  try {
    return await mongoose.connection.transaction(async (session) => {
      const duplicate = await findDuplicate(incoming, landlord, session);
      if (duplicate) return duplicate;
      const [receipt] = await PaymentReceipt.create(
        [
          {
            _id: PaymentReceipt.receiptId(landlord._id, "SEPAY", incoming.referenceCode),
            referenceCode: incoming.referenceCode,
            landlordId: landlord._id,
            source: "SEPAY",
            gatewayTransactionId: incoming.gatewayTransactionId,
            amount: incoming.amount,
          },
        ],
        { session },
      );
      // Plans without automatic reconciliation still keep the money for manual matching.
      const autoMatch = !suspended && await hasFeature(landlord._id, "SEPAY_WEBHOOK", session);
      // A deposit transfer ("COC <contract code>") is checked before invoice codes.
      const contract = autoMatch
        ? await depositContractFromContent(landlord._id, incoming.content, session)
        : null;
      const depositIssue = contract && depositProblem(contract, incoming.amount);
      if (contract && !depositIssue) {
        await bookDeposit(contract, incoming, landlord, session);
        receipt.contractId = contract._id;
        await receipt.save({ session });
        return { depositReceived: true, contract };
      }
      const invoice = autoMatch && !contract
        ? await invoiceFromContent(landlord._id, incoming.content, session)
        : null;
      if (
        !invoice ||
        !OWING_INVOICE_STATUSES.includes(invoice.status) ||
        (invoice.bankSnapshot?.accountNumber &&
          invoice.bankSnapshot.accountNumber !== incoming.accountNumber)
      ) {
        const [unmatched] = await UnmatchedPayment.create(
          [
            {
              landlordId: landlord._id,
              referenceCode: incoming.referenceCode,
              amount: incoming.amount,
              content: incoming.content,
              gateway: incoming.gateway,
              transactionDate: incoming.transactionDate,
              rawWebhookData: body,
              notes: suspended
                ? `Tài khoản chủ trọ đang bị khóa (${landlord.status}); đối soát sau khi mở khóa`
                : !autoMatch
                  ? "Gói hiện tại chưa bao gồm đối soát SePay tự động; vui lòng gán hóa đơn thủ công"
                  : contract
                    ? `Tiền cọc hợp đồng ${contract.contractCode} chưa được ghi nhận: ${depositIssue}`
                    : invoice
                      ? `Hóa đơn không thể nhận tiền: ${invoice.status}`
                      : "Không xác định được hóa đơn",
            },
          ],
          { session },
        );
        receipt.unmatchedPaymentId = unmatched._id;
        await receipt.save({ session });
        return { unmatched: true, unmatchedPaymentId: unmatched._id, landlordId: landlord._id, amount: incoming.amount };
      }
      const result = await applyPayment(
        {
          invoice,
          details: {
            referenceCode: incoming.referenceCode,
            amount: incoming.amount,
            gateway: incoming.gateway,
            transactionDate: incoming.transactionDate,
            content: incoming.content,
            paymentMethod: "BANK_TRANSFER",
            rawWebhookData: body,
          },
          actor: systemActor(landlord._id),
          action: "RECEIVE_BANK_PAYMENT",
        },
        session,
      );
      receipt.paymentId = result.payment._id;
      await receipt.save({ session });
      return result;
    });
  } catch (error) {
    if (error.code === 11000) {
      const duplicate = await findDuplicate(incoming, landlord);
      if (duplicate) return duplicate;
    }
    throw error;
  }
}

// Sandbox helper for the public invoice page: fakes the tenant's bank transfer (remaining
// amount, standard payment syntax) and runs it through the same path as a real SePay
// notification, so matching, plan features, audit and realtime behave exactly as in reality.
async function simulatePublicPayment(token) {
  if (!simulatorEnabled())
    throw new AppError("Giả lập thanh toán chỉ dùng trong môi trường thử nghiệm", 403, "SIMULATOR_DISABLED");
  if (typeof token !== "string" || !/^[a-f\d]{32}$/i.test(token))
    throw new AppError("Không tìm thấy hóa đơn", 404, "RESOURCE_NOT_FOUND");
  const invoice = await Invoice.findOne({
    publicAccessToken: token,
    isDeleted: false,
    status: { $in: OWING_INVOICE_STATUSES },
  }).lean();
  if (!invoice || invoice.remainingAmount <= 0)
    throw new AppError("Hóa đơn không còn khoản cần thanh toán", 409, "INVOICE_ALREADY_PAID");
  const landlord = await User.findById(invoice.landlordId).select("bankConfig").lean();
  const suffix = crypto.randomBytes(6).toString("hex").toUpperCase();
  const incoming = {
    accountNumber: invoice.bankSnapshot?.accountNumber || landlord?.bankConfig?.accountNumber || "SANDBOX",
    referenceCode: `SIM-${suffix}`,
    amount: invoice.remainingAmount,
    transactionDate: new Date(),
    gateway: "SANDBOX_SIMULATOR",
    content: invoice.paymentSyntax || invoice.invoiceCode,
    gatewayTransactionId: `SIM:${suffix}`,
  };
  const result = await receiveTransfer(incoming, { simulator: true, invoiceCode: invoice.invoiceCode }, { _id: invoice.landlordId });
  if (result.unmatched) {
    const unmatched = await UnmatchedPayment.findById(result.unmatchedPaymentId).select("notes").lean();
    return { ...result, reason: unmatched?.notes };
  }
  return result;
}

// Sandbox helper on the contract page: fakes the tenant's deposit transfer (deposit amount,
// standard "COC ..." content) through the same path as a real bank notification.
async function simulateDepositTransfer(contract) {
  if (!simulatorEnabled())
    throw new AppError("Giả lập thanh toán chỉ dùng trong môi trường thử nghiệm", 403, "SIMULATOR_DISABLED");
  const landlord = await User.findById(contract.landlordId).select("bankConfig").lean();
  const suffix = crypto.randomBytes(6).toString("hex").toUpperCase();
  const incoming = {
    accountNumber: landlord?.bankConfig?.accountNumber || "SANDBOX",
    referenceCode: `SIM-${suffix}`,
    amount: contract.depositAmount,
    transactionDate: new Date(),
    gateway: "SANDBOX_SIMULATOR",
    content: depositSyntax(contract.contractCode),
    gatewayTransactionId: `SIM:${suffix}`,
  };
  const result = await receiveTransfer(
    incoming,
    { simulator: true, contractCode: contract.contractCode },
    { _id: contract.landlordId },
  );
  if (result.unmatched) {
    const unmatched = await UnmatchedPayment.findById(result.unmatchedPaymentId).select("notes").lean();
    return { ...result, reason: unmatched?.notes };
  }
  return result;
}

module.exports = {
  processWebhook,
  receiveTransfer,
  simulatePublicPayment,
  simulateDepositTransfer,
  depositSyntax,
};
