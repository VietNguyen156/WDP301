import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { authApi } from "../api/authApi";
import {
  Building2,
  Mail,
  Lock,
  User,
  Phone,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Zap,
  Headphones,
} from "lucide-react";

const perks = [
  { icon: ShieldCheck, text: "Bảo mật dữ liệu chuẩn ngành" },
  { icon: Zap, text: "Thiết lập nhanh, dùng ngay trong 5 phút" },
  { icon: Headphones, text: "Hỗ trợ 24/7 qua chat & hotline" },
];

export default function Register() {
  const { register } = useAuth();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phoneNumber: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [resendStatus, setResendStatus] = useState("");

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.name || !formData.email || !formData.password) {
      return setError("Vui lòng điền đầy đủ các thông tin bắt buộc (*)");
    }
    if (formData.password.length < 6) {
      return setError("Mật khẩu phải có tối thiểu 6 ký tự");
    }
    if (formData.password !== formData.confirmPassword) {
      return setError("Mật khẩu xác nhận không trùng khớp");
    }

    setIsSubmitting(true);
    try {
      await register({
        name: formData.name,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        password: formData.password,
      });
      setSuccessData({ email: formData.email, name: formData.name });
    } catch (err) {
      setError(err.message || "Đăng ký không thành công. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!successData?.email) return;
    setResendStatus("Đang gửi lại email...");
    try {
      await authApi.resendVerification(successData.email);
      setResendStatus("Đã gửi lại! Vui lòng kiểm tra hộp thư.");
    } catch (err) {
      setResendStatus(err.message || "Không thể gửi lại email. Thử lại sau.");
    }
  };

  // Success screen
  if (successData) {
    return (
      <div className="auth-split-layout">
        <div className="auth-brand-panel">
          <div className="auth-brand-inner">
            <div className="auth-logo">
              <Building2 size={28} />
              <span>TrọSmart</span>
            </div>
            <div className="auth-brand-content">
              <h2 className="auth-brand-headline">
                Chào mừng bạn gia nhập cộng đồng chủ trọ thông minh!
              </h2>
              <p className="auth-brand-desc">
                Tài khoản của bạn đã được tạo thành công. Chỉ còn một bước nữa để bắt đầu.
              </p>
              <ul className="auth-feature-list">
                {perks.map(({ icon: Icon, text }) => (
                  <li key={text} className="auth-feature-item">
                    <span className="auth-feature-icon">
                      <Icon size={16} />
                    </span>
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="auth-form-panel">
          <div className="auth-form-inner auth-success-inner">
            <div className="success-icon-wrap">
              <Mail size={36} />
            </div>
            <h2 className="auth-form-title">Kiểm tra hộp thư!</h2>
            <p className="auth-form-subtitle">
              Chúng tôi đã gửi link kích hoạt đến
            </p>
            <p className="success-email">{successData.email}</p>

            <div className="alert-box alert-success success-steps">
              <CheckCircle2 size={17} className="alert-icon" />
              <div>
                Bấm vào <strong>"Kích Hoạt Tài Khoản"</strong> trong email để hoàn tất đăng ký.
              </div>
            </div>

            {resendStatus && (
              <p className="resend-status-text">{resendStatus}</p>
            )}

            <div className="success-actions">
              <Link to="/login" className="btn-submit" style={{ textDecoration: "none", justifyContent: "center" }}>
                Đến trang Đăng nhập
                <ArrowRight size={17} />
              </Link>
              <button
                type="button"
                onClick={handleResend}
                className="btn-outline"
              >
                Chưa nhận được? Gửi lại email
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-split-layout">
      {/* Left panel - branding */}
      <div className="auth-brand-panel">
        <div className="auth-brand-inner">
          <div className="auth-logo">
            <Building2 size={28} />
            <span>TrọSmart</span>
          </div>

          <div className="auth-brand-content">
            <h2 className="auth-brand-headline">
              Bắt đầu quản lý chuỗi trọ của bạn ngay hôm nay
            </h2>
            <p className="auth-brand-desc">
              Đăng ký miễn phí và trải nghiệm nền tảng quản lý trọ thông minh nhất Việt Nam.
            </p>

            <ul className="auth-feature-list">
              {perks.map(({ icon: Icon, text }) => (
                <li key={text} className="auth-feature-item">
                  <span className="auth-feature-icon">
                    <Icon size={16} />
                  </span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="auth-brand-footer">
            <div className="auth-trust-badge">
              <CheckCircle2 size={15} />
              Miễn phí 30 ngày, không cần thẻ tín dụng
            </div>
          </div>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="auth-form-panel">
        <div className="auth-form-inner">
          <div className="auth-form-header">
            <h1 className="auth-form-title">Tạo tài khoản mới</h1>
            <p className="auth-form-subtitle">
              Điền thông tin để bắt đầu dùng TrọSmart
            </p>
          </div>

          {error && (
            <div className="alert-box alert-danger">
              <AlertCircle size={17} className="alert-icon" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form-fields">
            <div className="form-group">
              <label className="form-label">Họ và tên *</label>
              <div className="input-wrapper">
                <User size={17} className="input-icon-left" />
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Nguyễn Văn An"
                  className="form-input"
                  autoComplete="name"
                  required
                />
              </div>
            </div>

            <div className="form-row-2col">
              <div className="form-group">
                <label className="form-label">Email *</label>
                <div className="input-wrapper">
                  <Mail size={17} className="input-icon-left" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="chutro@example.com"
                    className="form-input"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Số điện thoại</label>
                <div className="input-wrapper">
                  <Phone size={17} className="input-icon-left" />
                  <input
                    type="tel"
                    name="phoneNumber"
                    value={formData.phoneNumber}
                    onChange={handleChange}
                    placeholder="0987 654 321"
                    className="form-input"
                    autoComplete="tel"
                  />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Mật khẩu *</label>
              <div className="input-wrapper">
                <Lock size={17} className="input-icon-left" />
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Tối thiểu 6 ký tự"
                  className="form-input has-right-icon"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="input-icon-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Xác nhận mật khẩu *</label>
              <div className="input-wrapper">
                <Lock size={17} className="input-icon-left" />
                <input
                  type={showPassword ? "text" : "password"}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Nhập lại mật khẩu"
                  className="form-input"
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-submit"
            >
              {isSubmitting ? (
                <>
                  <span className="spinner" />
                  Đang tạo tài khoản...
                </>
              ) : (
                <>
                  Đăng Ký & Nhận Email Kích Hoạt
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>

          <p className="auth-switch-text">
            Đã có tài khoản?{" "}
            <Link to="/login" className="auth-link">
              Đăng nhập ngay
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
