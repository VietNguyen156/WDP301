import { useState } from "react";
import {
  Building2,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Zap,
  QrCode,
  Smartphone,
  Lock,
  UserCheck,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { authApi, errorMessage } from "../../services/api";
import { Button, Field, FormError } from "../../components/ui";

export default function LoginPage() {
  const { login } = useAuth();
  const toast = useToast();

  const [mode, setMode] = useState("login"); // "login" | "register"

  // Login states
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Register states (Landlord registration)
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regVisible, setRegVisible] = useState(false);
  const [regBusy, setRegBusy] = useState(false);
  const [regError, setRegError] = useState("");


  async function handleLogin(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login({ username: username.trim(), password });
      toast.success("Đăng nhập thành công!");
    } catch (err) {
      const msg = errorMessage(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setRegBusy(true);
    setRegError("");

    if (regPassword.length < 8) {
      setRegError("Mật khẩu phải chứa tối thiểu 8 ký tự");
      setRegBusy(false);
      return;
    }

    try {
      await authApi.register({
        name: regName.trim(),
        email: regEmail.trim(),
        phoneNumber: regPhone.trim() || undefined,
        password: regPassword,
        role: "LANDLORD",
      });

      toast.success(
        "Đăng ký Chủ trọ thành công! Đang tự động đăng nhập...",
      );
      // Auto-login upon registration as per specification
      await login({ username: regEmail.trim(), password: regPassword });
    } catch (err) {
      const msg = errorMessage(err);
      setRegError(msg);
      toast.error(msg);
    } finally {
      setRegBusy(false);
    }
  }

  return (
    <main className="login-page">
      <header className="login-heading">
        <div className="login-brand-header">
          <div className="login-brand-badge">
            <Building2 size={28} strokeWidth={2.2} />
          </div>
          <div className="login-brand-title">
            <h1>
              DOMUS <span className="brand-highlight">ERP</span>
            </h1>
            <p className="login-brand-tagline">
              Modern PropTech Management & Billing Automation
            </p>
          </div>
        </div>
      </header>

      <section className="login-box">
        {/* Left Form Panel */}
        <div className="login-form-panel">
          {/* Mode Switcher Tabs */}
          <div className="auth-tab-switch">
            <button
              type="button"
              className={`auth-tab-btn ${mode === "login" ? "active" : ""}`}
              onClick={() => {
                setMode("login");
                setError("");
              }}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              className={`auth-tab-btn ${mode === "register" ? "active" : ""}`}
              onClick={() => {
                setMode("register");
                setRegError("");
              }}
            >
              Đăng ký Chủ trọ <span className="tab-pill">Miễn phí</span>
            </button>
          </div>

          {mode === "login" ? (
            <div className="auth-form-container">
              <div className="auth-form-title">
                <h2>Chào mừng trở lại</h2>
                <p>Đăng nhập bằng Email, Số điện thoại, CCCD hoặc admin</p>
              </div>

              <form onSubmit={handleLogin} className="auth-main-form">
                <Field
                  label="Tài khoản đăng nhập"
                  type="text"
                  autoComplete="username"
                  placeholder="Email Landlord, SĐT Manager, CCCD Tenant hoặc admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={busy}
                />

                <label className="field">
                  <div className="field-label-row">
                    <span>
                      Mật khẩu <b>*</b>
                    </span>
                  </div>
                  <div className="password-input">
                    <input
                      type={visible ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Nhập mật khẩu của bạn"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={busy}
                    />
                    <button
                      type="button"
                      aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                      onClick={() => setVisible(!visible)}
                    >
                      {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>

                <FormError error={error} />

                <Button busy={busy} className="login-submit">
                  Đăng nhập hệ thống <ArrowRight size={16} />
                </Button>
              </form>

              <div className="auth-account-guidance">
                <UserCheck size={15} color="#0f766e" />
                <span>
                  Quản lý cơ sở và Khách thuê được cấp mật khẩu tạm bởi Chủ trọ và đổi mật khẩu ở lần đăng nhập đầu tiên.
                </span>
              </div>

            </div>
          ) : (
            <div className="auth-form-container">
              <div className="auth-form-title">
                <h2>Đăng ký Chủ cơ sở (Landlord)</h2>
                <p>Kích hoạt chuỗi nhà trọ ngay · Miễn phí dùng thử 30 ngày</p>
              </div>

              <form onSubmit={handleRegister} className="auth-main-form">
                <Field
                  label="Họ và tên Chủ trọ"
                  type="text"
                  placeholder="Ví dụ: Trần Văn Chủ Trọ"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  required
                  disabled={regBusy}
                />

                <Field
                  label="Địa chỉ Email"
                  type="email"
                  placeholder="landlord@example.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  required
                  disabled={regBusy}
                />

                <Field
                  label="Số điện thoại liên hệ (tùy chọn)"
                  type="tel"
                  placeholder="Ví dụ: 0988 888 888"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  disabled={regBusy}
                />

                <label className="field">
                  <div className="field-label-row">
                    <span>
                      Mật khẩu khởi tạo <b>*</b>
                    </span>
                    <small className="field-hint">Tối thiểu 8 ký tự</small>
                  </div>
                  <div className="password-input">
                    <input
                      type={regVisible ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Tạo mật khẩu an toàn"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      required
                      minLength={8}
                      disabled={regBusy}
                    />
                    <button
                      type="button"
                      aria-label={regVisible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                      onClick={() => setRegVisible(!regVisible)}
                    >
                      {regVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>

                <FormError error={regError} />

                <Button busy={regBusy} className="login-submit">
                  Đăng ký dùng thử ngay <ArrowRight size={16} />
                </Button>
              </form>

              <div className="auth-switch-footer">
                <span>Đã có tài khoản? </span>
                <button
                  type="button"
                  className="auth-inline-link"
                  onClick={() => setMode("login")}
                >
                  Quay lại đăng nhập
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Feature Showcase Hero Panel */}
        <aside className="login-info-panel">
          <div className="hero-badge">
            <ShieldCheck size={16} />
            <span>Nền tảng B2B SaaS Chuẩn Doanh Nghiệp</span>
          </div>

          <h2>
            Vận hành thông minh
            <br />
            Tối ưu hóa 100% dòng tiền
          </h2>
          <p className="hero-subtext">
            Tự động hóa toàn diện từ ghi nhận chỉ số điện nước, sinh hóa đơn tức
            thì đến đối soát chuyển khoản ngân hàng 24/7.
          </p>

          <ul className="hero-features-list">
            <li>
              <div className="hero-feature-icon">
                <QrCode size={20} />
              </div>
              <div className="hero-feature-text">
                <strong>Hóa đơn VietQR động chuẩn Napas247</strong>
                <span>
                  Khách thuê xem hóa đơn minh bạch và thanh toán trong 5 giây,
                  không yêu cầu tải ứng dụng.
                </span>
              </div>
            </li>

            <li>
              <div className="hero-feature-icon">
                <Smartphone size={20} />
              </div>
              <div className="hero-feature-text">
                <strong>Chốt số Điện/Nước Mobile-First</strong>
                <span>
                  Thao tác 1 tay trên điện thoại: tự động mở bàn phím số, tự nhảy
                  phòng kế tiếp và cảnh báo đột biến &gt;2.5x.
                </span>
              </div>
            </li>

            <li>
              <div className="hero-feature-icon">
                <Zap size={20} />
              </div>
              <div className="hero-feature-text">
                <strong>Đối soát Webhook Ngân hàng SePay 24/7</strong>
                <span>
                  Gạch nợ hóa đơn tức thì khi nhận tiền chuyển khoản, kiểm soát
                  chống trùng lặp và lưu trữ đối soát chưa khớp.
                </span>
              </div>
            </li>
          </ul>

        </aside>
      </section>

      <p className="login-help">
        <Lock size={14} />
        <span>
          Cần hỗ trợ kỹ thuật hoặc cấp quyền cơ sở? Vui lòng liên hệ bộ phận hỗ
          trợ <strong>DOMUS ERP</strong> qua hotline hoặc quản trị viên hệ thống.
        </span>
      </p>

      <footer className="login-footer">
        © 2026 DOMUS ERP · Nền tảng Quản lý & Tự động hóa Hóa đơn Chuỗi Nhà trọ
        / Căn hộ Dịch vụ
      </footer>
    </main>
  );
}
