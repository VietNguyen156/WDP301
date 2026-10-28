import { useState } from "react";
import {
  User,
  Mail,
  Phone,
  KeyRound,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  Sparkles,
} from "lucide-react";
import { FormError } from "../ui";

export default function RegisterForm({ form, onSwitchToLogin }) {
  const {
    name,
    setName,
    email,
    setEmail,
    phoneNumber,
    setPhoneNumber,
    password,
    setPassword,
    passwordStrength,
    busy,
    error,
    handleSubmit,
  } = form;

  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="domus-form-box">
      <div className="domus-form-header">
        <h2>Đăng ký Chủ chuỗi (Landlord)</h2>
        <p>
          Khởi tạo hệ sinh thái quản lý căn hộ &amp; nhà trọ cao cấp kèm 30 ngày
          dùng thử miễn phí.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="domus-auth-form">
        {/* Full Name */}
        <div className="domus-input-group">
          <div className="domus-label-row">
            <label htmlFor="reg-name" className="domus-field-label">
              <span>Họ và tên Chủ chuỗi</span>
              <span className="domus-required">*</span>
            </label>
          </div>
          <div className="domus-input-wrap">
            <div className="domus-input-icon-left">
              <User size={19} />
            </div>
            <input
              id="reg-name"
              type="text"
              autoComplete="name"
              placeholder="Ví dụ: Nguyễn Minh Quân"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={busy}
              className="domus-text-input"
            />
          </div>
        </div>

        {/* Email & Phone Row */}
        <div className="domus-auth-row-2">
          <div className="domus-input-group">
            <div className="domus-label-row">
              <label htmlFor="reg-email" className="domus-field-label">
                <span>Email định danh</span>
                <span className="domus-required">*</span>
              </label>
            </div>
            <div className="domus-input-wrap">
              <div className="domus-input-icon-left">
                <Mail size={18} />
              </div>
              <input
                id="reg-email"
                type="email"
                autoComplete="email"
                placeholder="owner@domus.vn"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={busy}
                className="domus-text-input"
              />
            </div>
          </div>

          <div className="domus-input-group">
            <div className="domus-label-row">
              <label htmlFor="reg-phone" className="domus-field-label">
                <span>Số điện thoại</span>
              </label>
            </div>
            <div className="domus-input-wrap">
              <div className="domus-input-icon-left">
                <Phone size={18} />
              </div>
              <input
                id="reg-phone"
                type="tel"
                autoComplete="tel"
                placeholder="0988 888 888"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled={busy}
                className="domus-text-input"
              />
            </div>
          </div>
        </div>

        {/* Password */}
        <div className="domus-input-group">
          <div className="domus-label-row">
            <label htmlFor="reg-password" className="domus-field-label">
              <span>Mật khẩu khởi tạo</span>
              <span className="domus-required">*</span>
            </label>
            <span className="domus-hint-inline">Tối thiểu 8 ký tự</span>
          </div>
          <div className="domus-input-wrap">
            <div className="domus-input-icon-left">
              <KeyRound size={19} />
            </div>
            <input
              id="reg-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Tạo mật khẩu bảo mật (tối thiểu 8 ký tự)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              maxLength={72}
              disabled={busy}
              className="domus-text-input"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="domus-pwd-toggle"
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          </div>

          {password && passwordStrength && (
            <div className="domus-pwd-strength">
              <div className="domus-pwd-bars">
                {[1, 2, 3, 4].map((level) => (
                  <span
                    key={level}
                    className={`domus-pwd-bar ${
                      passwordStrength.score >= level
                        ? `is-filled tone-${passwordStrength.tone}`
                        : ""
                    }`}
                  />
                ))}
              </div>
              <span
                className={`domus-pwd-strength-label tone-${passwordStrength.tone}`}
              >
                {passwordStrength.label}
              </span>
            </div>
          )}
        </div>

        <FormError error={error} />

        <div className="domus-submit-wrap">
          <button type="submit" disabled={busy} className="domus-submit-btn">
            {busy ? (
              <>
                <Loader2 size={19} className="domus-spin" />
                <span>Đang khởi tạo không gian làm việc...</span>
              </>
            ) : (
              <>
                <span>Kích hoạt tài khoản Chủ chuỗi (30 ngày Free)</span>
                <ArrowRight size={19} />
              </>
            )}
          </button>
        </div>
      </form>

      <div className="domus-policy-notice">
        <Sparkles size={19} className="domus-policy-icon" />
        <div className="domus-policy-text">
          <strong>Gói Dùng thử 30 ngày bao gồm:</strong> Khởi tạo ngay 1 cơ sở
          lưu trú, quản lý tối đa 5 phòng, phân quyền 1 Quản lý cơ sở và tích
          hợp đối soát mã VietQR tự động.
        </div>
      </div>

      <div className="domus-cta-divider">
        <div className="domus-cta-card">
          <div className="domus-cta-copy">
            <p className="domus-cta-title">Bạn đã có tài khoản trên hệ thống?</p>
            <p className="domus-cta-sub">
              Quay lại cổng đăng nhập hợp nhất cho Chủ chuỗi, Quản lý &amp; Cư
              dân.
            </p>
          </div>
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="domus-cta-btn"
          >
            Đăng nhập ngay
          </button>
        </div>
      </div>
    </div>
  );
}
