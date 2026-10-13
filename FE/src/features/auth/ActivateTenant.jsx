import { useState } from "react";
import { authApi, errorMessage } from "../../services/api";
import { Button, Field, FormError, Modal } from "../../components/ui";
import { useToast } from "../../context/ToastContext";
export default function ActivateTenant({ onClose }) {
  const [email, setEmail] = useState(""),
    [phoneNumber, setPhone] = useState("");
  const [challengeId, setChallenge] = useState(""),
    [code, setCode] = useState(""),
    [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const toast = useToast();
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!challengeId) {
        const data = await authApi.requestOtp({ email, phoneNumber });
        setChallenge(data.challengeId);
      } else {
        await authApi.verifyOtp({ challengeId, code, password });
        toast("Tài khoản đã được kích hoạt. Hãy đăng nhập bằng mật khẩu mới.");
        onClose();
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Kích hoạt tài khoản khách thuê"
      subtitle="Dùng thông tin đã đăng ký trong hợp đồng thuê phòng."
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          <div className="form-section form-grid">
            {!challengeId ? (
              <>
                <div className="span-2">
                  <Field
                    label="Email trong hợp đồng"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="span-2">
                  <Field
                    label="Số điện thoại đã đăng ký"
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </>
            ) : (
              <>
                <p className="hint span-2">
                  Nếu thông tin khớp tài khoản chờ kích hoạt, mã OTP đã được gửi
                  đến số điện thoại đã đăng ký. Mã có hiệu lực 5 phút.
                </p>
                <div className="span-2">
                  <Field
                    label="Mã OTP (6 chữ số)"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </div>
                <div className="span-2">
                  <Field
                    label="Tạo mật khẩu"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={72}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    hint="Từ 8 đến 72 ký tự"
                  />
                </div>
              </>
            )}
          </div>
        </fieldset>
        <FormError error={error} />
        <footer className="modal-footer">
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
            {challengeId ? "Gửi lại / đổi thông tin" : "Hủy"}
          </Button>
          <Button busy={busy}>
            {challengeId ? "Kích hoạt tài khoản" : "Nhận mã OTP"}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}
