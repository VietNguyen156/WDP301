import {
  CreditCard,
  ShieldCheck,
  Unlink,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { Button, Field, SelectField } from "../ui";
import { VIETQR_BANKS, removeVietnameseTones } from "../../hooks/useProfilePage";

export function ProfileBankTab({
  user,
  profile,
  bankCode,
  setBankCode,
  accountNumber,
  setAccountNumber,
  accountName,
  setAccountName,
  bankPassword,
  setBankPassword,
  savingBank,
  selectedBankDisplay,
  onOpenBankHub,
  onSubmit,
}) {
  return (
    <div className="profile-card">
      <h3 className="profile-section-title">
        <CreditCard size={18} color="var(--prof-primary-container)" />
        Tài khoản nhận tiền thanh toán (SePay &amp; VietQR)
      </h3>
      <p className="profile-section-sub">
        Tài khoản này được dùng để sinh mã VietQR tự động trên tất cả hóa đơn
        gửi cho khách thuê.
      </p>

      {/* Bank Hub Integration Status Banner */}
      {profile.bankHubLinked ? (
        <div
          style={{
            padding: "16px 20px",
            borderRadius: "12px",
            backgroundColor: "#f0fdf4",
            border: "1.5px solid #86efac",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                backgroundColor: "#dcfce7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#16a34a",
                flexShrink: 0,
              }}
            >
              <ShieldCheck size={22} />
            </div>
            <div>
              <strong
                style={{ fontSize: "14px", color: "#15803d", display: "block" }}
              >
                Đang liên kết tự động qua SePay Bank Hub
              </strong>
              <span style={{ fontSize: "12px", color: "#166534" }}>
                Tài khoản ngân hàng được đồng bộ và gạch nợ tự động trực tiếp từ
                SePay.
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="secondary"
            style={{
              borderColor: "#fca5a5",
              color: "#b91c1c",
              backgroundColor: "#ffffff",
              fontSize: "12px",
              padding: "6px 14px",
            }}
            onClick={() => onOpenBankHub("UNLINK")}
          >
            <Unlink size={14} />
            <span>Hủy liên kết Bank Hub</span>
          </Button>
        </div>
      ) : (
        <div
          style={{
            padding: "18px 20px",
            borderRadius: "12px",
            background: "linear-gradient(135deg, #f0fdfa 0%, #e6fffa 100%)",
            border: "1.5px solid #99f6e4",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "10px",
                backgroundColor: "#ccfbf1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#0f766e",
                flexShrink: 0,
              }}
            >
              <Zap size={24} />
            </div>
            <div>
              <strong
                style={{ fontSize: "14px", color: "#0f766e", display: "block" }}
              >
                Liên kết tài khoản tự động qua SePay Bank Hub (Khuyên dùng)
              </strong>
              <p
                style={{
                  margin: "2px 0 0 0",
                  fontSize: "12.5px",
                  color: "#334155",
                }}
              >
                Kết nối trực tiếp tài khoản ngân hàng của bạn bằng iframe an
                toàn SePay. Tự động đối soát và gạch nợ tức thì 24/7.
              </p>
            </div>
          </div>

          <Button
            type="button"
            style={{
              backgroundColor: "#0f766e",
              color: "#ffffff",
              fontSize: "13px",
              padding: "8px 16px",
              boxShadow: "0 2px 8px rgba(15, 118, 110, 0.25)",
            }}
            onClick={() => onOpenBankHub("LINK")}
          >
            <Zap size={15} />
            <span>Bắt đầu liên kết Bank Hub</span>
          </Button>
        </div>
      )}

      {/* Warning if not configured */}
      {!profile.hasBankAccount ? (
        <div className="profile-bank-alert">
          <AlertTriangle size={20} className="profile-bank-alert-icon" />
          <div>
            <strong style={{ fontSize: "14px", color: "#92400e" }}>
              Chưa thiết lập tài khoản ngân hàng nhận tiền
            </strong>
            <p
              style={{
                margin: "4px 0 0 0",
                fontSize: "13px",
                color: "#78350f",
                lineHeight: 1.5,
              }}
            >
              Vui lòng hoàn tất thông tin tài khoản ngân hàng thụ hưởng bên dưới
              để kích hoạt tính năng thanh toán tự động qua VietQR và đối soát
              SePay. Hóa đơn tiền phòng chỉ có thể phát hành khi đã có tài khoản
              nhận tiền hợp lệ.
            </p>
          </div>
        </div>
      ) : (
        <div className="profile-bank-alert success">
          <CheckCircle2 size={20} className="profile-bank-alert-icon" />
          <div>
            <strong style={{ fontSize: "14px", color: "#166534" }}>
              Tài khoản nhận tiền đang hoạt động
            </strong>
            <p
              style={{
                margin: "4px 0 0 0",
                fontSize: "13px",
                color: "#14532d",
                lineHeight: 1.5,
              }}
            >
              Khi bạn cập nhật tài khoản mới, hệ thống sẽ tự động cập nhật lại
              mã VietQR của tất cả các hóa đơn đang phát hành còn nợ.
            </p>
          </div>
        </div>
      )}

      {/* Virtual Bank Card Preview */}
      <div className="profile-bank-card-preview">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div className="profile-bank-chip" />
          <span className="profile-bank-name-badge">
            {profile.bankAccount?.bankName ||
              selectedBankDisplay.split(" (")[0]}
          </span>
        </div>

        <div className="profile-bank-acc-num">
          {accountNumber
            ? accountNumber.replace(/(\d{4})/g, "$1 ").trim()
            : "•••• •••• •••• ••••"}
        </div>

        <div className="profile-bank-footer">
          <div>
            <div className="profile-bank-holder-label">CHỦ TÀI KHOẢN</div>
            <div className="profile-bank-holder-name">
              {accountName ||
                (user?.name
                  ? removeVietnameseTones(user.name).toUpperCase()
                  : "CHỦ TÀI KHOẢN")}
            </div>
          </div>

          <span
            style={{
              fontSize: "11px",
              padding: "2px 8px",
              borderRadius: "4px",
              background: "rgba(255,255,255,0.2)",
              fontWeight: 600,
            }}
          >
            VIETQR
          </span>
        </div>
      </div>

      {/* Bank Update Form */}
      <form onSubmit={onSubmit}>
        <div className="form-section form-grid">
          <SelectField
            label="Ngân hàng thụ hưởng (VietQR) *"
            required
            value={bankCode}
            onChange={(e) => setBankCode(e.target.value)}
          >
            {VIETQR_BANKS.map((b) => (
              <option key={b.code} value={b.code}>
                {b.name}
              </option>
            ))}
          </SelectField>

          <Field
            label="Số tài khoản ngân hàng *"
            required
            value={accountNumber}
            onChange={(e) =>
              setAccountNumber(e.target.value.replace(/[\s.-]/g, ""))
            }
            placeholder="VD: 0123456789"
            hint="Từ 6 đến 19 chữ số, không chứa ký tự đặc biệt"
          />

          <Field
            label="Tên chủ tài khoản (Chữ in hoa không dấu) *"
            required
            value={accountName}
            onChange={(e) =>
              setAccountName(removeVietnameseTones(e.target.value))
            }
            placeholder={`VD: ${user?.name ? removeVietnameseTones(user.name).toUpperCase() : "NGUYEN VAN A"}`}
            hint="Hệ thống tự động chuyển sang chữ hoa không dấu"
          />

          <Field
            label="Mật khẩu tài khoản hiện tại *"
            type="password"
            required
            value={bankPassword}
            onChange={(e) => setBankPassword(e.target.value)}
            placeholder="Nhập mật khẩu của bạn..."
            hint="Bắt buộc xác thực mật khẩu để đảm bảo an toàn tài chính"
          />
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: "24px",
            paddingTop: "16px",
            borderTop: "1px solid var(--prof-border)",
          }}
        >
          <Button busy={savingBank}>
            <Lock size={16} /> Xác nhận &amp; Cập nhật tài khoản ngân hàng
          </Button>
        </div>
      </form>
    </div>
  );
}

