// Shared by every money-in flow: guard the invoice state, then book a SUCCESS payment and audit it.
const { Payment, User } = require("../../models");
const { OWING_INVOICE_STATUSES } = require("../../utils/statuses");
const { AppError } = require("../../utils/errors");
const { paymentBalance, makeVietQr } = require("../financeCalculation");
const { recordAudit } = require("../auditService");

function assertPayable(invoice) {
  if (invoice.status === "CANCELLED")
    throw new AppError("Hóa đơn đã hủy", 409, "INVOICE_CANCELLED");
  if (["PAID", "OVERPAID"].includes(invoice.status))
    throw new AppError(
      "Hóa đơn đã được thanh toán đầy đủ",
      409,
      "INVOICE_ALREADY_PAID",
    );
  if (!OWING_INVOICE_STATUSES.includes(invoice.status)) {
    throw new AppError("Hóa đơn chưa phát hành", 409, "INVOICE_NOT_ISSUED");
  }
}

async function applyPayment(
  { invoice, details, actor, action, metadata },
  session,
) {
  assertPayable(invoice);
  const before = {
    paidAmount: invoice.paidAmount,
    remainingAmount: invoice.remainingAmount,
    overpaidAmount: invoice.overpaidAmount,
    status: invoice.status,
  };
  Object.assign(invoice, paymentBalance(invoice, details.amount));
  if (!invoice.bankSnapshot?.bankCode) {
    const landlord = await User.findOne({
      _id: invoice.landlordId,
      role: "LANDLORD",
      isDeleted: false,
    }).session(session);
    if (
      landlord?.bankConfig.bankCode &&
      landlord.bankConfig.accountNumber &&
      landlord.bankConfig.accountName
    ) {
      invoice.bankSnapshot = landlord.bankConfig;
    }
  }
  if (invoice.bankSnapshot?.bankCode) {
    invoice.vietQrUrl =
      invoice.remainingAmount > 0
        ? makeVietQr(
            invoice.bankSnapshot,
            invoice.remainingAmount,
            invoice.paymentSyntax,
          )
        : undefined;
  } else {
    invoice.vietQrUrl = undefined;
  }
  const [payment] = await Payment.create(
    [
      {
        ...details,
        landlordId: invoice.landlordId,
        branchId: invoice.branchId,
        invoiceId: invoice._id,
        invoiceCode: invoice.invoiceCode,
        status: "SUCCESS",
      },
    ],
    { session },
  );
  await invoice.save({ session });
  await recordAudit(
    {
      actor,
      invoice,
      action,
      before,
      after: {
        paymentId: payment._id,
        amount: payment.amount,
        paidAmount: invoice.paidAmount,
        remainingAmount: invoice.remainingAmount,
        overpaidAmount: invoice.overpaidAmount,
        status: invoice.status,
      },
      metadata,
    },
    session,
  );
  return { payment, invoice };
}

module.exports = { assertPayable, applyPayment };
