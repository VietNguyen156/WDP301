const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Vui lòng nhập họ và tên"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Vui lòng nhập email"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Email không hợp lệ"],
    },
    password: {
      type: String,
      required: [true, "Vui lòng nhập mật khẩu"],
      minlength: [6, "Mật khẩu tối thiểu 6 ký tự"],
      select: false, // Mặc định không trả về password khi query
    },
    phoneNumber: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      enum: ["ADMIN", "LANDLORD", "PROPERTY_MANAGER", "TENANT"],
      default: "TENANT",
      index: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "PENDING_APPROVAL", "REJECTED", "SUSPENDED"],
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
  },
  {
    timestamps: true,
  }
);

// Hash password trước khi lưu vào DB (Mongoose 8/9 async hook)
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// So khớp mật khẩu đăng nhập
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
