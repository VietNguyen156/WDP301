import { KeyRound } from "lucide-react";
import { Button, Field } from "../ui";

export function ProfileSecurityTab({
  currentPassword,
  setCurrentPassword,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  savingPassword,
  onSubmit,
}) {
  return (
    <div className="profile-card">
      <h3 className="profile-section-title">
        <KeyRound size={18} color="var(--prof-primary-container)" />
        Đổi mật khẩu tài khoản
      </h3>
      <p className="profile-section-sub">
        Để bảo vệ an toàn cho dữ liệu quản trị cơ sở, hãy sử dụng mật khẩu mạnh
        kết hợp chữ hoa, chữ thường và số.
      </p>

      <form onSubmit={onSubmit}>
        <div className="form-section form-grid" style={{ maxWidth: "600px" }}>
          <div className="span-2">
            <Field
              label="Mật khẩu hiện tại *"
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Nhập mật khẩu hiện tại..."
            />
          </div>

          <div className="span-2">
            <Field
              label="Mật khẩu mới *"
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Ít nhất 6 ký tự..."
            />
          </div>

          <div className="span-2">
            <Field
              label="Xác nhận mật khẩu mới *"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Nhập lại mật khẩu mới..."
            />
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-start",
            marginTop: "24px",
            paddingTop: "16px",
            borderTop: "1px solid var(--prof-border)",
          }}
        >
          <Button busy={savingPassword}>
            <KeyRound size={16} /> Cập nhật mật khẩu mới
          </Button>
        </div>
      </form>
    </div>
  );
}

