const mongoose = require("mongoose");
const User = require("../models/User");
const Invoice = require("../models/Invoice");
const audit = require("./auditService");
const account = require("./accountValidation");
const { publicUser } = require("./authService");
const { makeVietQr } = require("./financeCalculation");
const { AppError, BusinessRuleError, NotFoundError, ValidationError } = require("../utils/errors");
const v = require("../utils/validation");

// Only fields that are not the account's login name; email/phone/CCCD logins stay fixed.
const EDITABLE = {
  LANDLORD: ["name", "phoneNumber"],
  PROPERTY_MANAGER: ["name", "email"],
  TENANT: ["name", "phoneNumber", "email", "hometown"],
  SUPER_ADMIN: ["name"],
};
const OPEN_INVOICE = ["ISSUED", "PARTIALLY_PAID", "UNPAID"];
const BANK_FIELDS = ["bankCode", "bankName", "accountNumber", "accountName"];

const mask = (number) => number && `****${number.slice(-4)}`;
const bankView = (bank) =>
  bank?.accountNumber
    ? { bankCode: bank.bankCode, bankName: bank.bankName, accountNumber: bank.accountNumber, accountName: bank.accountName }
    : null;

function view(user) {
  const data = { ...publicUser(user), phoneNumber: user.phoneNumber, hometown: user.hometown };
  if (user.role === "LANDLORD") {
    data.bankAccount = bankView(user.bankConfig);
    data.hasBankAccount = !!data.bankAccount;
    data.bankHubLinked = !!user.bankHub?.bankAccountXid;
  }
  return data;
}

async function load(req, session = null) {
  const user = await User.findOne({ _id: req.user._id, isDeleted: false, status: "ACTIVE" })
    .select("+password").session(session);
  if (!user) throw new NotFoundError("Không tìm thấy tài khoản");
  return user;
}

async function get(req) {
  return view(await load(req));
}

async function update(req) {
  const allowed = EDITABLE[req.user.role] || [];
  v.fields(req.body, allowed);
  if (!Object.keys(req.body).length) throw new ValidationError("Không có thông tin cần cập nhật");
  const changes = {};
  if (req.body.name !== undefined) {
    v.text(req.body.name, "Họ và tên");
    if (req.body.name.trim().length > 100) throw new ValidationError("Họ và tên tối đa 100 ký tự");
    changes.name = req.body.name.trim();
  }
  if (req.body.phoneNumber !== undefined) changes.phoneNumber = account.phone(req.body.phoneNumber) ?? null;
  if (req.body.email !== undefined) changes.email = account.email(req.body.email) ?? null;
  if (req.body.hometown !== undefined) {
    v.text(req.body.hometown, "Quê quán", false);
    changes.hometown = req.body.hometown.trim();
  }
  return mongoose.connection.transaction(async (session) => {
    const user = await load(req, session);
    if (changes.email && await User.exists({ _id: { $ne: user._id }, email: changes.email }).session(session))
      throw new AppError("Email đã được sử dụng", 409, "EMAIL_IN_USE");
    const before = { name: user.name, phoneNumber: user.phoneNumber, email: user.email, hometown: user.hometown };
    for (const [key, value] of Object.entries(changes)) user[key] = value ?? undefined;
    await user.save({ session });
    await audit.log({
      req, action: "UPDATE_PROFILE", entityType: "USER", entityId: user._id,
      before, after: changes, session,
    });
    return view(user);
  });
}

// Banks print account holders without diacritics, e.g. "NGUYỄN Văn Đức" -> "NGUYEN VAN DUC".
const holderName = (value) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "D").toUpperCase().replace(/\s+/g, " ").trim();

function bankInput(body) {
  v.fields(body, [...BANK_FIELDS, "currentPassword"]);
  v.text(body.currentPassword, "Mật khẩu hiện tại");
  v.text(body.bankCode, "Mã ngân hàng");
  const bankCode = body.bankCode.trim().toUpperCase();
  // VietQR accepts the bank short name (MB, VCB, ICB...) or its 6-digit BIN.
  if (!/^[A-Z0-9]{2,20}$/.test(bankCode)) throw new ValidationError("Mã ngân hàng không hợp lệ (vd: MB, VCB, 970422)");
  v.text(body.accountNumber, "Số tài khoản");
  const accountNumber = body.accountNumber.replace(/[\s.-]/g, "");
  if (!/^\d{6,19}$/.test(accountNumber)) throw new ValidationError("Số tài khoản phải gồm 6 đến 19 chữ số");
  v.text(body.accountName, "Tên chủ tài khoản");
  const accountName = holderName(body.accountName);
  if (!/^[A-Z0-9 ]{2,50}$/.test(accountName))
    throw new ValidationError("Tên chủ tài khoản chỉ gồm chữ cái, số, khoảng trắng và tối đa 50 ký tự");
  let bankName;
  if (body.bankName !== undefined) {
    v.text(body.bankName, "Tên ngân hàng");
    bankName = body.bankName.trim();
    if (bankName.length > 100) throw new ValidationError("Tên ngân hàng tối đa 100 ký tự");
  }
  return { bankCode, bankName, accountNumber, accountName };
}

// Point unpaid invoices at the new account: the SePay webhook only recognises the current one.
async function refreshOpenInvoices(landlord, bankSnapshot, session) {
  const invoices = await Invoice.find({
    landlordId: landlord._id, isDeleted: false, status: { $in: OPEN_INVOICE }, remainingAmount: { $gt: 0 },
  }).select("remainingAmount paymentSyntax").session(session).lean();
  if (!invoices.length) return 0;
  await Invoice.bulkWrite(invoices.map((invoice) => ({
    updateOne: {
      filter: { _id: invoice._id, landlordId: landlord._id },
      update: { $set: { bankSnapshot, vietQrUrl: makeVietQr(bankSnapshot, invoice.remainingAmount, invoice.paymentSyntax) } },
    },
  })), { session });
  return invoices.length;
}

async function updateBankAccount(req) {
  const bank = bankInput(req.body);
  return mongoose.connection.transaction(async (session) => {
    const user = await load(req, session);
    if (!(await user.comparePassword(req.body.currentPassword)))
      throw new AppError("Mật khẩu hiện tại không đúng", 400, "CURRENT_PASSWORD_INVALID");
    // A Bank Hub account is the one SePay reports on; editing it by hand would desync the two.
    if (user.bankHub?.bankAccountXid)
      throw new BusinessRuleError("Tài khoản đang liên kết SePay Bank Hub; hủy liên kết trước khi đổi tài khoản", "BANK_HUB_LINKED");
    if (await User.exists({
      _id: { $ne: user._id }, role: "LANDLORD", isDeleted: false, "bankConfig.accountNumber": bank.accountNumber,
    }).session(session))
      throw new BusinessRuleError("Số tài khoản đã được chủ trọ khác đăng ký", "BANK_ACCOUNT_IN_USE");
    const before = user.bankConfig?.accountNumber
      ? { bankCode: user.bankConfig.bankCode, accountNumber: mask(user.bankConfig.accountNumber) }
      : null;
    user.bankConfig = bank;
    await user.save({ session });
    const refreshedInvoices = await refreshOpenInvoices(user, bank, session);
    // Audit logs are visible to platform admins, so the account number is masked.
    await audit.log({
      req, action: "CHANGE_BANK_ACCOUNT", entityType: "USER", entityId: user._id, before,
      after: { bankCode: bank.bankCode, accountNumber: mask(bank.accountNumber), refreshedInvoices }, session,
    });
    return { ...view(user), refreshedInvoices };
  });
}

module.exports = { get, update, updateBankAccount, refreshOpenInvoices, holderName, mask };
