import {
  Users,
  Search,
  RotateCcw,
  CreditCard,
  Copy,
  Check,
  Phone,
  Mail,
  MapPin,
  Clock,
  CheckCircle2,
  KeyRound,
  Lock,
} from "lucide-react";
import { Button } from "../ui";

export function TenantsTable({
  tenants,
  filteredTenants,
  searchTerm,
  copiedKey,
  onCopyText,
  onResetFilters,
  onResetPassword,
}) {
  return (
    <div className="content-panel">
      <div
        className="panel-heading"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h2>
          <Users size={18} />
          <span>
            Danh sách Khách thuê ({filteredTenants.length}
            {filteredTenants.length !== tenants.length
              ? ` / ${tenants.length}`
              : ""}
            )
          </span>
        </h2>
        {filteredTenants.length !== tenants.length && (
          <span style={{ fontSize: "12px", color: "#64748b" }}>
            Đang lọc theo điều kiện tìm kiếm
          </span>
        )}
      </div>

      {filteredTenants.length === 0 ? (
        <div style={{ padding: "48px 20px", textAlign: "center" }}>
          <div
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "50%",
              backgroundColor: "#f1f5f9",
              color: "#94a3b8",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "12px",
            }}
          >
            <Search size={24} />
          </div>
          <h3
            style={{
              fontSize: "16px",
              fontWeight: 700,
              color: "#1e293b",
              margin: "0 0 6px 0",
            }}
          >
            Không tìm thấy khách thuê phù hợp
          </h3>
          <p
            style={{
              fontSize: "13px",
              color: "#64748b",
              maxWidth: "440px",
              margin: "0 auto 16px auto",
            }}
          >
            {searchTerm
              ? `Không có khách thuê nào khớp với từ khóa "${searchTerm}". Bạn thử tìm theo số CCCD, tên hoặc số điện thoại.`
              : "Không có khách thuê nào khớp với bộ lọc trạng thái hoặc quê quán đã chọn."}
          </p>
          <Button variant="secondary" onClick={onResetFilters}>
            <RotateCcw size={14} />
            <span>Xóa bộ lọc tìm kiếm</span>
          </Button>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="standard-table">
            <thead>
              <tr>
                <th>Họ và tên</th>
                <th>Tài khoản (CCCD 12 số)</th>
                <th>Số điện thoại</th>
                <th>Email</th>
                <th>Quê quán</th>
                <th>Trạng thái</th>
                <th style={{ textAlign: "right" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredTenants.map((item) => {
                const cccd = item.citizenId || item.username || "";
                const phone = item.phoneNumber || "";
                return (
                  <tr key={item._id || item.id}>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                        }}
                      >
                        <div
                          style={{
                            width: "34px",
                            height: "34px",
                            borderRadius: "50%",
                            backgroundColor: "rgba(0, 92, 85, 0.1)",
                            color: "var(--primary, #005c55)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 700,
                            fontSize: "13px",
                            flexShrink: 0,
                          }}
                        >
                          {(item.name || "U").slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <strong
                            style={{
                              display: "block",
                              color: "#0f172a",
                              fontSize: "13.5px",
                            }}
                          >
                            {item.name}
                          </strong>
                          <span
                            style={{ fontSize: "11.5px", color: "#64748b" }}
                          >
                            {cccd
                              ? `CCCD: ${cccd}`
                              : `Username: ${item.username}`}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <span className="mono-badge">
                          <CreditCard size={13} />
                          {cccd || "—"}
                        </span>
                        {cccd && (
                          <button
                            type="button"
                            onClick={() =>
                              onCopyText(cccd, "số CCCD", item._id + "-cccd")
                            }
                            style={{
                              border: "none",
                              background: "none",
                              cursor: "pointer",
                              padding: "3px",
                              color:
                                copiedKey === item._id + "-cccd"
                                  ? "#16a34a"
                                  : "#94a3b8",
                              display: "flex",
                              alignItems: "center",
                              borderRadius: "4px",
                            }}
                            title="Sao chép số CCCD"
                          >
                            {copiedKey === item._id + "-cccd" ? (
                              <Check size={13} />
                            ) : (
                              <Copy size={13} />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                    <td>
                      {phone ? (
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              color: "var(--neutral-700)",
                            }}
                          >
                            <Phone size={13} />
                            {phone}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              onCopyText(
                                phone,
                                "số điện thoại",
                                item._id + "-phone",
                              )
                            }
                            style={{
                              border: "none",
                              background: "none",
                              cursor: "pointer",
                              padding: "3px",
                              color:
                                copiedKey === item._id + "-phone"
                                  ? "#16a34a"
                                  : "#94a3b8",
                              display: "flex",
                              alignItems: "center",
                              borderRadius: "4px",
                            }}
                            title="Sao chép SĐT"
                          >
                            {copiedKey === item._id + "-phone" ? (
                              <Check size={13} />
                            ) : (
                              <Copy size={13} />
                            )}
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: "var(--neutral-400)" }}>—</span>
                      )}
                    </td>
                    <td>
                      {item.email ? (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            color: "var(--neutral-600)",
                          }}
                        >
                          <Mail size={13} />
                          {item.email}
                        </span>
                      ) : (
                        <span style={{ color: "var(--neutral-400)" }}>
                          (Chưa có)
                        </span>
                      )}
                    </td>
                    <td>
                      {item.hometown ? (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            color: "var(--neutral-600)",
                          }}
                        >
                          <MapPin size={13} />
                          {item.hometown}
                        </span>
                      ) : (
                        <span style={{ color: "var(--neutral-400)" }}>—</span>
                      )}
                    </td>
                    <td>
                      {item.status === "INACTIVE" ? (
                        <span
                          className="badge-locked-pill"
                          title="Tự khóa vì không còn hợp đồng. Lập hợp đồng mới cùng CCCD để mở lại, khách dùng mật khẩu cũ."
                        >
                          <Lock size={11} />
                          <span>Tạm khóa (hết hợp đồng)</span>
                        </span>
                      ) : item.mustChangePassword ? (
                        <span
                          className="badge-warning-pill"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <Clock size={11} />
                          <span>Chờ đổi mật khẩu</span>
                        </span>
                      ) : (
                        <span
                          className="badge-active-pill"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <CheckCircle2 size={11} />
                          <span>Đang hoạt động</span>
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <Button
                        variant="secondary"
                        compact
                        onClick={() => onResetPassword(item)}
                        title="Cấp lại mật khẩu ngẫu nhiên cho khách thuê này"
                      >
                        <KeyRound size={14} />
                        <span>Cấp lại mật khẩu</span>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

