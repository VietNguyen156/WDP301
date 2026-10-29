import { Button, Field, Modal, FormError } from "../ui";

export function TenantCreateModal({
  isOpen,
  onClose,
  busy,
  name,
  setName,
  citizenId,
  setCitizenId,
  phoneNumber,
  setPhoneNumber,
  email,
  setEmail,
  hometown,
  setHometown,
  formError,
  onSubmit,
}) {
  if (!isOpen) return null;

  return (
    <Modal
      title="Cấp tài khoản Khách thuê mới"
      subtitle="Tên đăng nhập là số CCCD (12 chữ số). Hệ thống tự sinh mật khẩu tạm thời để bàn giao."
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={onSubmit}>
        <div className="form-section form-grid" style={{ gap: "16px" }}>
          <div className="span-2">
            <Field
              label="Họ và tên khách thuê"
              required
              placeholder="Ví dụ: Hoàng Thị Mai"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
            />
          </div>

          <div className="span-2">
            <Field
              label="Số CCCD / Định danh cá nhân (Tên đăng nhập)"
              required
              pattern="[0-9]{12}"
              maxLength={12}
              placeholder="001202002345 (12 chữ số)"
              value={citizenId}
              onChange={(e) => setCitizenId(e.target.value)}
              disabled={busy}
              hint="Đúng 12 chữ số theo CCCD gắn chip. Dùng làm tài khoản đăng nhập."
            />
          </div>

          <Field
            label="Số điện thoại (tùy chọn)"
            type="tel"
            placeholder="0912 222 222"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            disabled={busy}
            hint="Không bắt buộc"
          />

          <Field
            label="Địa chỉ Email (tùy chọn)"
            type="email"
            placeholder="tenant@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
            hint="Không bắt buộc"
          />

          <div className="span-2">
            <Field
              label="Quê quán / Địa chỉ thường trú (tùy chọn)"
              placeholder="Ví dụ: Thanh Hóa"
              value={hometown}
              onChange={(e) => setHometown(e.target.value)}
              disabled={busy}
            />
          </div>
        </div>

        <FormError error={formError} />

        <footer className="modal-footer" style={{ marginTop: "24px" }}>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={onClose}
          >
            Hủy
          </Button>
          <Button busy={busy}>Cấp tài khoản &amp; Nhận mật khẩu tạm</Button>
        </footer>
      </form>
    </Modal>
  );
}

