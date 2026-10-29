import { useState } from "react";
import { Copy, Check, AlertTriangle, ShieldCheck } from "lucide-react";
import { Modal, Button } from "../ui";
import { useToast } from "../../context/ToastContext";

export function CredentialsModal({ credentials, recipientName, tenantName, roleLabel, onClose }) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  if (!credentials) return null;

  const { username, temporaryPassword } = credentials;
  const name = recipientName || tenantName || "Người dùng";
  const role = roleLabel || (tenantName ? "Khách thuê" : "Thành viên");
  const portalUrl = typeof window !== "undefined" ? window.location.origin : "";

  function handleCopy() {
    const textToCopy = `[DOMUS ERP] Thông tin tài khoản được cấp:
- Họ và tên: ${name}
- Vai trò: ${role}
- Tên đăng nhập: ${username}
- Mật khẩu tạm: ${temporaryPassword}
(Lưu ý: Bạn bắt buộc phải đổi mật khẩu riêng ở lần đăng nhập đầu tiên tại: ${portalUrl})`;

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    toast.success("Đã sao chép thông tin tài khoản và mật khẩu tạm vào clipboard!");
    setTimeout(() => setCopied(false), 3000);
  }

  return (
    <Modal
      title="Cấp tài khoản & Mật khẩu tạm thời"
      subtitle="Bàn giao thông tin đăng nhập cho nhân sự / khách thuê"
      onClose={onClose}
    >
      <div className="credentials-modal-content">
        <div className="credentials-warning-banner">
          <AlertTriangle size={20} className="warning-icon" />
          <div className="warning-text">
            <strong>Mật khẩu tạm chỉ hiển thị một lần duy nhất!</strong>
            <span>
              Hệ thống không lưu trữ mật khẩu dưới dạng văn bản rõ. Hãy sao chép
              và bàn giao ngay cho người được cấp.
            </span>
          </div>
        </div>

        <div className="credentials-display-card">
          <div className="cred-field-group">
            <span className="cred-label">Người nhận:</span>
            <strong className="cred-value">{name}</strong>
          </div>

          <div className="cred-field-group">
            <span className="cred-label">Vai trò:</span>
            <span className="cred-badge">{role}</span>
          </div>

          <div className="cred-field-group highlight">
            <span className="cred-label">Tài khoản đăng nhập (Username):</span>
            <div className="cred-code-box">
              <code>{username}</code>
            </div>
          </div>

          <div className="cred-field-group highlight">
            <span className="cred-label">Mật khẩu tạm thời (Temporary Password):</span>
            <div className="cred-code-box secret">
              <code>{temporaryPassword}</code>
            </div>
          </div>

          <div className="cred-policy-note">
            <ShieldCheck size={16} />
            <span>Người dùng bắt buộc phải đổi mật khẩu riêng ở lần đăng nhập đầu tiên.</span>
          </div>
        </div>

        <footer className="credentials-modal-footer">
          <Button
            type="button"
            variant="secondary"
            onClick={handleCopy}
            className="copy-btn"
          >
            {copied ? <Check size={16} color="#16a34a" /> : <Copy size={16} />}
            <span>{copied ? "Đã sao chép!" : "Sao chép thông tin bàn giao"}</span>
          </Button>

          <Button type="button" onClick={onClose}>
            Tôi đã lưu thông tin
          </Button>
        </footer>
      </div>
    </Modal>
  );
}
