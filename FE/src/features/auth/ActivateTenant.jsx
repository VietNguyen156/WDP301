import { useState } from "react";
import { ShieldCheck, KeyRound, Smartphone, ArrowRight } from "lucide-react";
import { authApi, errorMessage } from "../../services/api";
import { Button, Field, FormError, Modal } from "../../components/ui";
import { useToast } from "../../context/ToastContext";

export default function ActivateTenant({ onClose }) {
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhone] = useState("");
  const [challengeId, setChallenge] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const toast = useToast();

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      if (!challengeId) {
        const data = await authApi.requestOtp({ email: email.trim(), phoneNumber: phoneNumber.trim() });
        setChallenge(data.challengeId);
        toast.info("Đã gửi mã xác thực OTP đến số điện thoại của bạn.");
      } else {
        await authApi.verifyOtp({ challengeId, code: code.trim(), password });
        toast.success("Tài khoản đã được kích hoạt thành công! Vui lòng đăng nhập với mật khẩu mới.");
        onClose();
      }
    } catch (err) {
      const msg = errorMessage(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Kích hoạt tài khoản khách thuê"
      subtitle="Xác thực thông tin hợp đồng thuê phòng để tạo mật khẩu đăng nhập cá nhân."
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={submit} className="activate-tenant-form">
        <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
          {/* Step indicator */}
          <div className="otp-step-indicator">
            <div className={`otp-step-badge ${!challengeId ? "active" : "completed"}`}>
              <Smartphone size={15} />
              <span>1. Xác thực hợp đồng</span>
            </div>
            <div className="otp-step-arrow">→</div>
            <div className={`otp-step-badge ${challengeId ? "active" : ""}`}>
              <KeyRound size={15} />
              <span>2. Nhập OTP & Tạo mật khẩu</span>
            </div>
          </div>

          <div className="form-section form-grid" style={{ gap: "16px", marginTop: "16px" }}>
            {!challengeId ? (
              <>
                <div className="span-2">
                  <Field
                    label="Email ghi trong hợp đồng thuê"
                    type="email"
                    required
                    placeholder="ví dụ: tenant@wdp301.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="span-2">
                  <Field
                    label="Số điện thoại đã đăng ký"
                    type="tel"
                    required
                    placeholder="ví dụ: 0912 345 678"
                    value={phoneNumber}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="span-2 otp-alert-box">
                  <ShieldCheck size={18} color="#0f766e" />
                  <span>
                    Mã OTP (6 chữ số) đã được gửi đến số điện thoại <strong>{phoneNumber}</strong>. Mã có hiệu lực trong 5 phút.
                  </span>
                </div>
                <div className="span-2">
                  <Field
                    label="Mã xác thực OTP (6 chữ số)"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    placeholder="000000"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </div>
                <div className="span-2">
                  <Field
                    label="Tạo mật khẩu đăng nhập mới"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={72}
                    placeholder="Tối thiểu 8 ký tự"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    hint="Mật khẩu an toàn từ 8 đến 72 ký tự"
                  />
                </div>
              </>
            )}
          </div>
        </fieldset>

        <FormError error={error} />

        <footer className="modal-footer" style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={
              challengeId
                ? () => {
                    setChallenge("");
                    setError("");
                  }
                : onClose
            }
          >
            {challengeId ? "Đổi thông tin" : "Hủy"}
          </Button>
          <Button busy={busy}>
            {challengeId ? "Xác nhận & Kích hoạt" : "Gửi mã OTP qua SMS"}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}
