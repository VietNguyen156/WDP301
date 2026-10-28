import { CheckCircle2, AlertTriangle } from "lucide-react";
import { ROLE_NAMES } from "../../hooks/useProfilePage";

export function ProfileOverviewBanner({ profile, isLandlord }) {
  return (
    <div className="profile-overview-card">
      <div className="profile-user-left">
        <div className="profile-avatar-large">
          {(profile.name || "U").slice(0, 1).toUpperCase()}
        </div>
        <div className="profile-user-info">
          <h2>
            {profile.name}
            <span className="profile-role-badge">
              {ROLE_NAMES[profile.role] || profile.role}
            </span>
          </h2>
          <div className="profile-user-meta">
            <span>
              <strong>Tên đăng nhập:</strong>{" "}
              {profile.username || profile.email}
            </span>
            {profile.phoneNumber && (
              <span>
                <strong>SĐT:</strong> {profile.phoneNumber}
              </span>
            )}
            {profile.email && (
              <span>
                <strong>Email:</strong> {profile.email}
              </span>
            )}
          </div>
        </div>
      </div>

      <div>
        {isLandlord &&
          (profile.hasBankAccount ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12px",
                fontWeight: 700,
                padding: "6px 12px",
                borderRadius: "9999px",
                background: "#ecfdf5",
                color: "#047857",
                border: "1px solid #a7f3d0",
              }}
            >
              <CheckCircle2 size={15} /> Đã cấu hình VietQR
            </span>
          ) : (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12px",
                fontWeight: 700,
                padding: "6px 12px",
                borderRadius: "9999px",
                background: "#fffbeb",
                color: "#b45309",
                border: "1px solid #fde68a",
              }}
            >
              <AlertTriangle size={15} /> Chưa cấu hình tài khoản nhận tiền
            </span>
          ))}
      </div>
    </div>
  );
}

