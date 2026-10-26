const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    quotaVersion: { type: Number, default: 0, select: false },
    name: {
      type: String,
      required: [true, "Vui lòng nhập họ và tên"],
      trim: true,
    },
    email: {
      type: String,
      required: function () { return this.role === "LANDLORD"; },
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Email không hợp lệ"],
    },
    password: {
      type: String,
      required: true,
      minlength: [4, "Mật khẩu tối thiểu 4 ký tự"],
      select: false, // Mặc định không trả về password khi query
    },
    username: { type: String, trim: true, lowercase: true },
    mustChangePassword: { type: Boolean, default: false },
    authVersion: { type: Number, default: 0, select: false },
    phoneNumber: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      enum: ["SUPER_ADMIN", "LANDLORD", "PROPERTY_MANAGER", "TENANT"],
      default: "TENANT",
      index: true,
    },
    status: {
      type: String,
      enum: [
        "ACTIVE",
        "PENDING_APPROVAL",
        "PENDING_ACTIVATION",
        "REJECTED",
        "SUSPENDED",
      ],
      default: "ACTIVE",
    },

    // Dành cho LANDLORD (Chủ chuỗi trọ)
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
    },
    // Cấu hình ngân hàng nhận tiền VietQR tự động
    bankConfig: {
      bankCode: { type: String, trim: true }, // Mã ngân hàng theo VietQR (vd: VCB, MB, ACB, ICB...)
      bankName: { type: String, trim: true }, // Tên ngân hàng (vd: MBBank, Vietcombank)
      accountNumber: { type: String, trim: true }, // Số tài khoản thụ hưởng
      accountName: { type: String, trim: true }, // Tên chủ tài khoản thụ hưởng
    },
    // Liên kết SePay Bank Hub: mỗi chủ trọ là một "công ty" trong Bank Hub
    bankHub: {
      companyXid: { type: String },
      bankAccountXid: { type: String, index: true, sparse: true },
      linkedAt: { type: Date },
    },

    // Dành cho PROPERTY_MANAGER (Quản lý cơ sở) hoặc TENANT (Người thuê)
    landlordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    // Danh sách cơ sở mà Quản lý được phân công phụ trách
    assignedBranches: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Branch",
      },
    ],

    // Thông tin bổ sung cho TENANT
    citizenId: {
      type: String, // Số CCCD / CMND
      trim: true,
    },
    hometown: {
      type: String, // Quê quán
      trim: true,
    },
    temporaryResidenceRegistered: {
      type: Boolean, // Đã đăng ký tạm trú chưa
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { transform: (_doc, value) => {
      delete value.password;
      delete value.authVersion;
      delete value.quotaVersion;
      return value;
    } },
  },
);

userSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: "string" } } });
userSchema.index({ username: 1 }, { unique: true, partialFilterExpression: { username: { $type: "string" } } });
userSchema.pre("validate", function () {
  if (this.role === "LANDLORD" && this.email) this.username = this.email;
  if (this.role === "PROPERTY_MANAGER" && this.phoneNumber) this.username = this.phoneNumber;
  if (this.role === "TENANT" && this.citizenId) this.username = this.citizenId;
});

// Hash password trước khi lưu vào DB (Mongoose 8/9 async hook)
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  if (this.role !== "SUPER_ADMIN") require("../services/accountValidation").password(this.password);
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// So khớp mật khẩu đăng nhập
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
