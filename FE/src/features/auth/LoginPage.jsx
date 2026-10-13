import { useState } from "react";
import {
  House,
  Eye,
  EyeOff,
  Building2,
  DoorOpen,
  FileText,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { errorMessage } from "../../services/api";
import { Button, Field, FormError } from "../../components/ui";
import ActivateTenant from "./ActivateTenant";
export default function LoginPage() {
  const { login } = useAuth();
  const [activating, setActivating] = useState(false);
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [visible, setVisible] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login({ email, password });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <header className="login-heading">
        <div className="login-logo">
          <House size={42} strokeWidth={2} />
        </div>
        <h1>PHẦN MỀM QUẢN LÝ NHÀ TRỌ</h1>
        <p>Quản lý cơ sở, phòng cho thuê và hợp đồng</p>
      </header>
      <section className="login-box">
        <div className="login-form-panel">
          <h2>Đăng nhập tài khoản</h2>
          <form onSubmit={submit}>
            <Field
              label="Địa chỉ email"
              type="email"
              autoComplete="username"
              placeholder="Nhập email của bạn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={busy}
            />
            <label className="field">
              <span>
                Mật khẩu <b>*</b>
              </span>
              <div className="password-input">
                <input
                  type={visible ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Nhập mật khẩu"
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
                  {visible ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
            </label>
            <FormError error={error} />
            <Button busy={busy} className="login-submit">
              Đăng nhập
            </Button>
          </form>
          <button
            className="activation-link"
            onClick={() => setActivating(true)}
          >
            Kích hoạt tài khoản khách thuê <ArrowRight size={16} />
          </button>
        </div>
        <aside className="login-info-panel">
          <h2>
            Quản lý nhà trọ
            <br />
            ngay trên trình duyệt
          </h2>
          <ul>
            <li>
              <Building2 size={25} />
              <div>
                <strong>Quản lý nhiều cơ sở</strong>
                <span>Thông tin tòa nhà và giá dịch vụ.</span>
              </div>
            </li>
            <li>
              <DoorOpen size={25} />
              <div>
                <strong>Theo dõi từng phòng</strong>
                <span>Phòng trống, đang thuê, cần sửa chữa.</span>
              </div>
            </li>
            <li>
              <FileText size={25} />
              <div>
                <strong>Lưu trữ hợp đồng</strong>
                <span>Khách thuê, thời hạn và tiền cọc.</span>
              </div>
            </li>
          </ul>
          <p>
            Đăng nhập bằng tài khoản đã được cấp.
            <br />
            Khách thuê mới có thể kích hoạt bằng OTP.
          </p>
        </aside>
      </section>
      <p className="login-help">
        Cần hỗ trợ đăng nhập? Liên hệ chủ nhà hoặc quản lý cơ sở.
      </p>
      <footer className="login-footer">
        Quản lý trọ · Dành cho chủ nhà và người thuê
      </footer>
      {activating && <ActivateTenant onClose={() => setActivating(false)} />}
    </main>
  );
}
