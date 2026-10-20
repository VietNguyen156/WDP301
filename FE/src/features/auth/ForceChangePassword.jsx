import { useState } from "react";
import { KeyRound, ShieldAlert, Eye, EyeOff, LogOut, ArrowRight } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { errorMessage } from "../../services/api";
import { Button, Field, FormError } from "../../components/ui";

export default function ForceChangePassword() {
  const { user, changePassword, logout } = useAuth();
  const toast = useToast();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (newPassword.length < 8) {
      setError("Mật khẩu mới phải có tối thiểu 8 ký tự.");
      return;
    }

    if (newPassword === currentPassword) {
      setError("Mật khẩu mới phải khác với mật khẩu tạm hiện tại.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Xác nhận mật khẩu mới không khớp.");
      return;
    }

    setBusy(true);
    try {
      await changePassword({ currentPassword, newPassword });
      toast.success(
        "Đổi mật khẩu thành công! Vui lòng đăng nhập lại với mật khẩu mới của bạn.",
        6000,
      );
    } catch (err) {
      const msg = errorMessage(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="force-change-pwd-overlay">
      <div className="force-change-pwd-card">
        <header className="force-change-pwd-header">
          <div className="force-change-pwd-icon">
            <KeyRound size={28} />
          </div>
          <h2>Bắt buộc đổi mật khẩu</h2>
          <p>
            Tài khoản của bạn đang sử dụng mật khẩu tạm thời. Vui lòng thiết lập
            mật khẩu cá nhân mới trước khi tiếp tục.
          </p>
        </header>

        <div className="force-change-user-badge">
          <ShieldAlert size={16} />
          <div>
            <strong>{user?.name || "Người dùng"}</strong>
            <span>Tài khoản: {user?.username || user?.email}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="force-change-form">
          <label className="field">
            <span>
              Mật khẩu tạm hiện tại <b>*</b>
            </span>
            <div className="password-input">
              <input
                type={showCurrent ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Nhập mật khẩu tạm được cấp"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                disabled={busy}
              />
              <button
                type="button"
                aria-label={showCurrent ? "Ẩn" : "Hiện"}
                onClick={() => setShowCurrent(!showCurrent)}
              >
                {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          <label className="field">
            <div className="field-label-row">
              <span>
                Mật khẩu mới <b>*</b>
              </span>
              <small className="field-hint">Tối thiểu 8 ký tự</small>
            </div>
            <div className="password-input">
              <input
                type={showNew ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Nhập mật khẩu riêng mới"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                disabled={busy}
              />
              <button
                type="button"
                aria-label={showNew ? "Ẩn" : "Hiện"}
                onClick={() => setShowNew(!showNew)}
              >
                {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          <label className="field">
            <span>
              Xác nhận mật khẩu mới <b>*</b>
            </span>
            <input
              type={showNew ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Nhập lại mật khẩu mới"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              disabled={busy}
            />
          </label>

          <FormError error={error} />

          <div className="force-change-actions">
            <Button busy={busy} className="login-submit" style={{ flex: 1 }}>
              Đổi mật khẩu & Đăng nhập <ArrowRight size={16} />
            </Button>
          </div>
        </form>

        <footer className="force-change-footer">
          <button
            type="button"
            className="force-change-logout-btn"
            onClick={logout}
            disabled={busy}
          >
            <LogOut size={15} />
            <span>Đăng xuất tài khoản này</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
