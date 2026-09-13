import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { authApi } from "../api/authApi";
import {
  Building2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Send,
  ArrowRight,
  Home,
  BarChart3,
  FileText,
} from "lucide-react";

const features = [
  { icon: Home, text: "Quản lý phòng & chuỗi trọ tập trung" },
  { icon: BarChart3, text: "Theo dõi doanh thu & hóa đơn tự động" },
  { icon: FileText, text: "Báo cáo chi tiết theo thời gian thực" },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [unverifiedEmail, setUnverifiedEmail] = useState("");
  const [resendStatus, setResendStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fromPath = location.state?.from?.pathname || "/dashboard";

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError("");
    setUnverifiedEmail("");
    setResendStatus("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setUnverifiedEmail("");
    setResendStatus("");

    if (!formData.email || !formData.password) {
      return setError("Vui lòng nhập đầy đủ email và mật khẩu");
    }

    setIsSubmitting(true);
    try {
      await login(formData);
      navigate(fromPath, { replace: true });
    } catch (err) {
      if (
        err.code === "EMAIL_NOT_VERIFIED" ||
        err.data?.code === "EMAIL_NOT_VERIFIED"
      ) {
        setUnverifiedEmail(formData.email);
        setError(
          "Tài khoản chưa được kích hoạt. Vui lòng bấm vào liên kết trong email trước khi đăng nhập."
        );
      } else {
        setError(
          err.message ||
            "Đăng nhập không thành công. Vui lòng kiểm tra lại thông tin."
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!unverifiedEmail) return;
    setResendStatus("Đang gửi...");
    try {
      await authApi.resendVerification(unverifiedEmail);
      setResendStatus("Đã gửi lại email kích hoạt! Hãy kiểm tra hòm thư.");
    } catch (err) {
      setResendStatus(err.message || "Không thể gửi lại email vào lúc này.");
    }
  };

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
              Quản lý chuỗi trọ thông minh, hiệu quả hơn mỗi ngày
            </h2>
            <p className="auth-brand-desc">
              Nền tảng số hóa toàn diện giúp chủ trọ kiểm soát phòng, hóa đơn và thu chi tự động.
            </p>

            <ul className="auth-feature-list">
              {features.map(({ icon: Icon, text }) => (
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
            <div className="auth-stat-row">
              <div className="auth-stat">
                <span className="auth-stat-num">2,400+</span>
                <span className="auth-stat-label">Chủ trọ tin dùng</span>
              </div>
              <div className="auth-stat-divider" />
              <div className="auth-stat">
                <span className="auth-stat-num">38,000+</span>
                <span className="auth-stat-label">Phòng đang quản lý</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="auth-form-panel">
        <div className="auth-form-inner">
          <div className="auth-form-header">
            <h1 className="auth-form-title">Chào mừng trở lại</h1>
            <p className="auth-form-subtitle">
              Đăng nhập vào tài khoản TrọSmart của bạn
            </p>
          </div>

          {error && (
            <div
              className={`alert-box ${unverifiedEmail ? "alert-warning" : "alert-danger"}`}
            >
              <AlertCircle size={17} className="alert-icon" />
              <div className="alert-body">
                <span>{error}</span>
                {unverifiedEmail && (
                  <button
                    type="button"
                    onClick={handleResend}
                    className="resend-btn"
                  >
                    <Send size={13} />
                    Gửi lại link kích hoạt
                  </button>
                )}
              </div>
            </div>
          )}

          {resendStatus && (
            <div className="alert-box alert-success">
              <CheckCircle2 size={17} className="alert-icon" />
              <span>{resendStatus}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form-fields">
            <div className="form-group">
              <label className="form-label">Email tài khoản</label>
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
              <label className="form-label">Mật khẩu</label>
              <div className="input-wrapper">
                <Lock size={17} className="input-icon-left" />
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Nhập mật khẩu"
                  className="form-input has-right-icon"
                  autoComplete="current-password"
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

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-submit"
            >
              {isSubmitting ? (
                <>
                  <span className="spinner" />
                  Đang xác thực...
                </>
              ) : (
                <>
                  Đăng Nhập
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>

          <p className="auth-switch-text">
            Chưa có tài khoản?{" "}
            <Link to="/register" className="auth-link">
              Đăng ký Chủ trọ mới
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
