const mongoose = require("mongoose");
const User = require("../models/User");
const client = require("./bankHubClient");
const audit = require("./auditService");
const { receiveTransfer } = require("./paymentService");
const { refreshOpenInvoices, holderName, mask } = require("./profileService");
const { requireFeature } = require("./planFeatures");
const {
  AppError,
  BusinessRuleError,
  NotFoundError,
  ValidationError,
} = require("../utils/errors");
const v = require("../utils/validation");
const { systemReq } = require("../utils/systemActor");
const validate = require("../utils/financeValidation");
const { parseVnDateTime } = require("../utils/vnTime");

const PURPOSES = { LINK: "LINK_BANK_ACCOUNT", UNLINK: "UNLINK_BANK_ACCOUNT" };
const isActive = (account) =>
  ["1", "true", "active"].includes(String(account.active).toLowerCase());

async function landlord(req, session = null) {
  const user = await User.findOne({
    _id: req.user._id,
    role: "LANDLORD",
    isDeleted: false,
  }).session(session);
  if (!user) throw new NotFoundError("Không tìm thấy chủ trọ");
  return user;
}

function statusView(user) {
  const { env } = client.config();
  return {
    configured: client.isConfigured(),
    environment: env,
    companyXid: user.bankHub?.companyXid || null,
    linked: !!user.bankHub?.bankAccountXid,
    bankAccountXid: user.bankHub?.bankAccountXid || null,
    linkedAt: user.bankHub?.linkedAt || null,
    bankAccount: user.bankConfig?.accountNumber
      ? {
          bankCode: user.bankConfig.bankCode,
          bankName: user.bankConfig.bankName,
          accountNumber: user.bankConfig.accountNumber,
          accountName: user.bankConfig.accountName,
        }
      : null,
  };
}

async function status(req) {
  return statusView(await landlord(req));
}

// One Bank Hub company per landlord, created on first use. full_name must be unique per merchant.
async function ensureCompany(user) {
  if (user.bankHub?.companyXid) return user.bankHub.companyXid;
  const company = await client.createCompany(`${user.name} - ${user._id}`);
  if (!company?.xid)
    throw new AppError(
      "SePay Bank Hub không trả mã công ty",
      502,
      "BANKHUB_REQUEST_FAILED",
    );
  // Keep the first stored company if two requests raced.
  const saved = await User.findOneAndUpdate(
    { _id: user._id, "bankHub.companyXid": { $exists: false } },
    { $set: { "bankHub.companyXid": company.xid } },
    { returnDocument: "after" },
  );
  return (
    saved?.bankHub.companyXid ||
    (await User.findById(user._id).lean()).bankHub.companyXid
  );
}

async function createLinkToken(req) {
  v.fields(req.body || {}, ["purpose"]);
  const purpose = req.body?.purpose || "LINK";
  v.choice(purpose, Object.keys(PURPOSES), "Mục đích");
  const user = await landlord(req);
  if (purpose === "LINK") {
    await requireFeature(user._id, "SEPAY_WEBHOOK");
    if (user.bankHub?.bankAccountXid)
      throw new BusinessRuleError(
        "Đã liên kết một tài khoản; hủy liên kết trước khi liên kết tài khoản khác",
        "BANK_HUB_LINKED",
      );
  } else if (!user.bankHub?.bankAccountXid) {
    throw new BusinessRuleError(
      "Chưa có tài khoản liên kết để hủy",
      "BANK_HUB_NOT_LINKED",
    );
  }
  const companyXid = await ensureCompany(user);
  const token = await client.createLinkToken({
    company_xid: companyXid,
    purpose: PURPOSES[purpose],
    language: "vi",
    ...(purpose === "UNLINK" && {
      bank_account_xid: user.bankHub.bankAccountXid,
    }),
    ...(process.env.SEPAY_BANKHUB_REDIRECT_URI && {
      completion_redirect_uri: process.env.SEPAY_BANKHUB_REDIRECT_URI,
    }),
  });
  if (!token?.hosted_link_url)
    throw new AppError(
      "SePay Bank Hub không trả link liên kết",
      502,
      "BANKHUB_REQUEST_FAILED",
    );
  return {
    purpose,
    hostedLinkUrl: token.hosted_link_url,
    linkTokenXid: token.xid,
    expiresAt: token.expires_at,
  };
}

// Pull the company's active account from Bank Hub and make it the landlord's receiving account.
async function syncLandlord(user, req) {
  if (!user.bankHub?.companyXid) return statusView(user);
  const accounts = (
    await client.listBankAccounts(user.bankHub.companyXid)
  ).filter(isActive);
  const account = accounts[0]; // newest first
  return mongoose.connection.transaction(async (session) => {
    const fresh = await User.findById(user._id).session(session);
    if (!account) {
      if (fresh.bankHub?.bankAccountXid) {
        fresh.bankHub.bankAccountXid = undefined;
        fresh.bankHub.linkedAt = undefined;
        await fresh.save({ session });
        await audit.log({
          req,
          action: "BANK_HUB_UNLINKED",
          entityType: "USER",
          entityId: fresh._id,
          session,
        });
      }
      return statusView(fresh);
    }
    if (
      await User.exists({
        _id: { $ne: fresh._id },
        role: "LANDLORD",
        isDeleted: false,
        "bankConfig.accountNumber": account.account_number,
      }).session(session)
    )
      throw new BusinessRuleError(
        "Số tài khoản đã được chủ trọ khác đăng ký",
        "BANK_ACCOUNT_IN_USE",
      );
    const bank = {
      // VietQR accepts the 6-digit BIN, which Bank Hub always provides.
      bankCode: String(
        account.bank_bin || account.bank_code || "",
      ).toUpperCase(),
      bankName: account.brand_name || account.bank_code,
      accountNumber: String(account.account_number),
      accountName: holderName(String(account.account_holder_name || "")),
    };
    const changed =
      fresh.bankHub?.bankAccountXid !== account.xid ||
      fresh.bankConfig?.accountNumber !== bank.accountNumber;
    if (!changed) return statusView(fresh);
    fresh.bankConfig = bank;
    fresh.bankHub.bankAccountXid = account.xid;
    fresh.bankHub.linkedAt = new Date();
    await fresh.save({ session });
    const refreshedInvoices = await refreshOpenInvoices(fresh, bank, session);
    await audit.log({
      req,
      action: "BANK_HUB_LINKED",
      entityType: "USER",
      entityId: fresh._id,
      after: {
        bankCode: bank.bankCode,
        accountNumber: mask(bank.accountNumber),
        refreshedInvoices,
      },
      session,
    });
    return { ...statusView(fresh), refreshedInvoices };
  });
}

async function sync(req) {
  return syncLandlord(await landlord(req), req);
}

// Link/unlink events (X-Secret-Key). Re-reads the account from Bank Hub instead of trusting the payload.
async function handleEvent(body) {
  const event = body?.event;
  const accountXid = body?.metadata?.bank_account_xid;
  if (
    ![
      "BANK_ACCOUNT_LINKED",
      "BANK_ACCOUNT_UNLINKED",
      "BANK_ACCOUNT_INACTIVATED",
      "BANK_ACCOUNT_INACTIVED",
    ].includes(event) ||
    !accountXid
  )
    return { ignored: true };
  let user;
  if (event === "BANK_ACCOUNT_LINKED") {
    const account = await client.getBankAccount(accountXid);
    if (!account?.company_xid) return { ignored: true };
    user = await User.findOne({
      role: "LANDLORD",
      isDeleted: false,
      "bankHub.companyXid": account.company_xid,
    });
  } else {
    user = await User.findOne({
      role: "LANDLORD",
      isDeleted: false,
      "bankHub.bankAccountXid": accountXid,
    });
  }
  if (!user) return { ignored: true };
  await syncLandlord(user, systemReq(user._id));
  return { synced: true };
}

// Balance-change IPN (Authorization: Apikey). Only credits create payments.
function normalizeIpn(body) {
  if (!body || typeof body !== "object")
    throw new ValidationError("Payload không hợp lệ");
  if (!["credit", "debit"].includes(body.transfer_type))
    throw new ValidationError("transfer_type không hợp lệ");
  const transactionId = String(body.transaction_id ?? "");
  if (!/^[\w.:-]{1,100}$/.test(transactionId))
    throw new ValidationError("transaction_id không hợp lệ");
  const amount = validate.money(Number(body.amount), "amount", true);
  const accountNumber = validate.text(
    String(body.account_number ?? ""),
    "account_number",
    50,
  );
  let transactionDate;
  if (typeof body.transaction_date === "number")
    transactionDate = new Date(body.transaction_date * 1000);
  else
    transactionDate =
      parseVnDateTime(body.transaction_date) ||
      validate.date(body.transaction_date, "transaction_date");
  if (!Number.isFinite(transactionDate.getTime()))
    throw new ValidationError("transaction_date không hợp lệ");
  const content = body.content == null ? "" : String(body.content);
  if (content.length > 2000) throw new ValidationError("content không hợp lệ");
  return {
    accountNumber,
    // reference_code is nullable in Bank Hub; transaction_id is the documented dedupe key.
    referenceCode: body.reference_code
      ? String(body.reference_code).slice(0, 100)
      : `BH-${transactionId}`,
    amount,
    transactionDate,
    gateway: body.gateway ? String(body.gateway).slice(0, 100) : "BANKHUB",
    content,
    gatewayTransactionId: `BANKHUB:${transactionId}`,
  };
}

async function receiveIpn(body) {
  if (body?.transfer_type === "debit") return { ignored: true };
  const incoming = normalizeIpn(body);
  const filter = body.bank_account_xid
    ? { "bankHub.bankAccountXid": String(body.bank_account_xid) }
    : { "bankConfig.accountNumber": incoming.accountNumber };
  return receiveTransfer(incoming, body, filter);
}

module.exports = { status, createLinkToken, sync, handleEvent, receiveIpn };
