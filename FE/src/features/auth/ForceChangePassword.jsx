import {
  KeyRound,
  ShieldAlert,
  LogOut,
  ArrowRight,
  CheckCircle2,
  Circle,
  Building2,
} from "lucide-react";
import { Button, FormError, PasswordField } from "../../components/ui";
import { useForceChangePasswordForm } from "../../hooks/useAuthForms";
import "./Auth.css";

export default function ForceChangePassword() {
  const {
    user,
    logout,
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    passwordStrength,
    passwordsMatch,
    isDifferentFromTemp,
    busy,
    error,
    handleSubmit,
  } = useForceChangePasswordForm();

  const minLengthMet = newPassword.length >= 8;

  return (
    <div className="force-change-pwd-overlay domus-force-pwd-screen">
      <div className="force-change-pwd-card domus-force-pwd-card">
        <div className="domus-force-pwd-top-bar">
          <div className="domus-force-brand">
            <Building2 size={16} />
            <span>DOMUS ERP · Security Gate</span>
          </div>
          <span className="domus-security-tag">Bắt buộc lần đầu</span>
        </div>

        <header className="force-change-pwd-header">
          <div className="force-change-pwd-icon">
            <KeyRound size={26} />
          </div>
          <h2>Thiết lập mật khẩu cá nhân</h2>
          <p>
            Tài khoản của bạn đang sử dụng mật khẩu tạm thời do hệ thống cấp. Vui
            lòng tạo mật khẩu mới để kích hoạt toàn quyền truy cập.
          </p>
        </header>

        <div className="force-change-user-badge">
          <div className="domus-user-badge-icon">
            <ShieldAlert size={18} />
          </div>
          <div className="domus-user-badge-info">
            <strong>{user?.name || "Tài khoản thành viên"}</strong>
            <span>
              Định danh: {user?.username || user?.email || user?.phoneNumber}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="force-change-form">
          <PasswordField
            label="Mật khẩu tạm hiện tại"
            autoComplete="current-password"
            placeholder="Nhập mật khẩu tạm đã được cấp"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            disabled={busy}
          />

          <PasswordField
            label="Mật khẩu cá nhân mới"
            hint="Tối thiểu 8 ký tự"
            autoComplete="new-password"
            placeholder="Tạo mật khẩu riêng của bạn"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            maxLength={72}
            disabled={busy}
            strength={passwordStrength}
          />

          <PasswordField
            label="Xác nhận mật khẩu mới"
            autoComplete="new-password"
            placeholder="Nhập lại mật khẩu mới để xác nhận"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            maxLength={72}
            disabled={busy}
          />

          {/* Live Security Checklist */}
          <div className="domus-pwd-checklist" aria-label="Tiêu chí mật khẩu an toàn">
            <div className={`domus-pwd-check-item ${minLengthMet ? "is-met" : ""}`}>
              {minLengthMet ? <CheckCircle2 size={14} /> : <Circle size={14} />}
              <span>Tối thiểu 8 ký tự trở lên</span>
            </div>
            <div
              className={`domus-pwd-check-item ${
                isDifferentFromTemp ? "is-met" : ""
              }`}
            >
              {isDifferentFromTemp ? (
                <CheckCircle2 size={14} />
              ) : (
                <Circle size={14} />
              )}
              <span>Khác với mật khẩu tạm ban đầu</span>
            </div>
            <div
              className={`domus-pwd-check-item ${passwordsMatch ? "is-met" : ""}`}
            >
              {passwordsMatch ? <CheckCircle2 size={14} /> : <Circle size={14} />}
              <span>Xác nhận mật khẩu trùng khớp</span>
            </div>
          </div>

          <FormError error={error} />

          <div className="force-change-actions">
            <Button busy={busy} className="login-submit domus-primary-cta">
              <span>Xác nhận mật khẩu &amp; Truy cập hệ thống</span>
              <ArrowRight size={16} />
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
            <span>Đăng xuất khỏi tài khoản này</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
