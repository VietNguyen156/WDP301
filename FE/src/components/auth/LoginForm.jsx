import { useState } from "react";
import {
  Building2,
  User,
  UserCog,
  ShieldCheck,
  IdCard,
  CheckCircle2,
  Info,
  KeyRound,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { FormError } from "../ui";

function RolePrefixIcon({ iconType }) {
  if (iconType === "landlord") return <Building2 size={19} />;
  if (iconType === "manager") return <UserCog size={19} />;
  if (iconType === "tenant") return <User size={19} />;
  if (iconType === "admin") return <ShieldCheck size={19} />;
  return <IdCard size={19} />;
}

export default function LoginForm({ form, onSwitchToRegister }) {
  const {
    username,
    setUsername,
    password,
    setPassword,
    rememberMe,
    setRememberMe,
    roleDetection,
    busy,
    error,
    handleSubmit,
    handleForgotPassword,
  } = form;

  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="domus-form-box">
      {/* Header */}
      <div className="domus-form-header">
        <h2>Đăng nhập Hệ thống DOMUS ERP</h2>
        <p>
          Nhập tài khoản định danh tương ứng với vai trò của bạn trên nền tảng.
        </p>
      </div>

      {/* Login Form POST /api/v1/auth/login */}
      <form onSubmit={handleSubmit} className="domus-auth-form">
        {/* Username Input with Dynamic Role Badge */}
        <div className="domus-input-group">
          <div className="domus-label-row">
            <label htmlFor="username" className="domus-field-label">
              <span>Tài khoản định danh</span>
              <span className="domus-required">*</span>
            </label>
            <span
              id="role-badge"
              className={`domus-role-badge tone-${roleDetection.tone}`}
            >
              {roleDetection.badgeText}
            </span>
          </div>

          <div className="domus-input-wrap">
            <div
              className={`domus-input-icon-left ${roleDetection.isValid ? `tone-${roleDetection.tone}` : ""}`}
            >
              <RolePrefixIcon iconType={roleDetection.iconType} />
            </div>
            <input
              id="username"
              name="username"
              type="text"
              aria-label="Địa chỉ email"
              autoComplete="username"
              placeholder="Email chủ chuỗi / SĐT quản lý / CCCD cư dân / admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={busy}
              className="domus-text-input"
            />
            {roleDetection.isValid && (
              <div
                className={`domus-input-icon-right tone-${roleDetection.tone}`}
                aria-hidden="true"
              >
                <CheckCircle2 size={18} />
              </div>
            )}
          </div>

          <p className={`domus-format-hint tone-${roleDetection.tone}`}>
            <Info size={13} className="shrink-0" />
            <span>{roleDetection.hintText}</span>
          </p>
        </div>

        {/* Password Input */}
        <div className="domus-input-group">
          <div className="domus-label-row">
            <label htmlFor="password" className="domus-field-label">
              <span>Mật khẩu bảo vệ</span>
              <span className="domus-required">*</span>
            </label>
            <a
              href="#forgot-password"
              onClick={handleForgotPassword}
              className="domus-forgot-link"
            >
              Quên mật khẩu?
            </a>
          </div>

          <div className="domus-input-wrap">
            <div className="domus-input-icon-left">
              <KeyRound size={19} />
            </div>
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              aria-label="Mật khẩu"
              autoComplete="current-password"
              placeholder="Nhập mật khẩu tài khoản"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
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
        </div>

        {/* Remember Session */}
        <div className="domus-remember-row">
          <label className="domus-checkbox-label">
            <input
              type="checkbox"
              name="remember_me"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="domus-checkbox"
            />
            <span>Ghi nhớ phiên đăng nhập an toàn (30 ngày)</span>
          </label>
        </div>

        <FormError error={error} />

        {/* Primary Submit Button */}
        <div className="domus-submit-wrap">
          <button
            id="btn-submit"
            type="submit"
            disabled={busy}
            aria-label="Đăng nhập"
            className="domus-submit-btn"
          >
            {busy ? (
              <>
                <Loader2 size={19} className="domus-spin" />
                <span>Đang xác thực thông tin tài khoản...</span>
              </>
            ) : (
              <>
                <span>Đăng nhập vào hệ sinh thái DOMUS ERP</span>
                <ArrowRight size={19} />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Business Security Policy Warning Box */}
      <div className="domus-policy-notice">
        <Info size={19} className="domus-policy-icon" />
        <div className="domus-policy-text">
          <strong>Lưu ý bắt buộc đối với Mật khẩu tạm:</strong> Nếu bạn đăng
          nhập lần đầu bằng mật khẩu tạm ngẫu nhiên do Chủ chuỗi cấp (Quản lý CS
          hoặc Khách thuê), hệ thống sẽ yêu cầu cập nhật mật khẩu mới (tối thiểu
          8 ký tự) để kích hoạt toàn quyền.
        </div>
      </div>

      {/* Register Landlord CTA */}
      <div className="domus-cta-divider">
        <div className="domus-cta-card">
          <div className="domus-cta-copy">
            <p className="domus-cta-title">
              Bạn là Chủ chuỗi căn hộ / Nhà trọ mới?
            </p>
            <p className="domus-cta-sub">
              Đăng ký Landlord ngay - Kích hoạt tự động, trải nghiệm 30 ngày
              dùng thử miễn phí.
            </p>
          </div>
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="domus-cta-btn"
          >
            Đăng ký ngay
          </button>
        </div>
      </div>
    </div>
  );
}
