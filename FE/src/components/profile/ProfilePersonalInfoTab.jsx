import { User, CheckCircle2 } from "lucide-react";
import { Button, Field } from "../ui";

export function ProfilePersonalInfoTab({
  profile,
  isLandlord,
  isManager,
  isTenant,
  name,
  setName,
  phoneNumber,
  setPhoneNumber,
  email,
  setEmail,
  hometown,
  setHometown,
  savingProfile,
  onSubmit,
}) {
  return (
    <div className="profile-card">
      <h3 className="profile-section-title">
        <User size={18} color="var(--prof-primary-container)" />
        Thông tin hồ sơ định danh
      </h3>
      <p className="profile-section-sub">
        Các thông tin dùng để hiển thị trên hợp đồng, hóa đơn và thông báo hệ
        thống.
      </p>

      <form onSubmit={onSubmit}>
        <div className="form-section form-grid">
          <div className="span-2">
            <Field
              label={`Tên đăng nhập (${
                isLandlord
                  ? "Email"
                  : isManager
                    ? "Số điện thoại"
                    : isTenant
                      ? "Số CCCD định danh"
                      : "Tài khoản Root"
              })`}
              value={profile.username || profile.email || ""}
              disabled
              hint="Tên đăng nhập là trường cố định, không thể thay đổi tại đây."
            />
          </div>

          <Field
            label="Họ và tên *"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="VD: Nguyễn Văn Đức"
          />

          {(isLandlord || isTenant) && (
            <Field
              label="Số điện thoại liên lạc"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="0901234567"
              hint="Chuẩn hóa theo đầu số di động Việt Nam"
            />
          )}

          {(isManager || isTenant) && (
            <Field
              label="Địa chỉ Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
            />
          )}

          {(isTenant || isLandlord) && (
            <div className="span-2">
              <Field
                label={
                  isLandlord
                    ? "Địa chỉ thường trú (ghi trên hợp đồng)"
                    : "Quê quán / Địa chỉ thường trú"
                }
                value={hometown}
                onChange={(e) => setHometown(e.target.value)}
                placeholder="VD: Xã Yên Hòa, Huyện Cẩm Xuyên, Tỉnh Hà Tĩnh"
              />
            </div>
          )}
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
          <Button busy={savingProfile}>
            <CheckCircle2 size={16} /> Lưu thay đổi hồ sơ
          </Button>
        </div>
      </form>
    </div>
  );
}

