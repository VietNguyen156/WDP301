import {
  Users,
  Search,
  RotateCcw,
  Phone,
  Copy,
  Check,
  Mail,
  Building2,
  ShieldCheck,
  Lock,
  LockOpen,
  KeyRound,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Button } from "../ui";
import { MANAGER_PERMISSIONS } from "../../utils/managerPermissions";

function enabledCount(staff) {
  return MANAGER_PERMISSIONS.filter(
    (p) => staff.permissions?.[p.key] !== false,
  ).length;
}

function getInitials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "QL";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function StaffTable({
  staffList,
  filteredStaff,
  searchTerm,
  copiedKey,
  onCopyPhone,
  onResetFilters,
  resolveAssignedBranches,
  onOpenPermissions,
  onOpenLock,
  onOpenResetPassword,
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
            Danh sách Quản lý cơ sở ({filteredStaff.length}
            {filteredStaff.length !== staffList.length
              ? ` / ${staffList.length}`
              : ""}
            )
          </span>
        </h2>
        {filteredStaff.length !== staffList.length && (
          <span style={{ fontSize: "12px", color: "#64748b" }}>
            Đang hiển thị kết quả đã lọc
          </span>
        )}
      </div>

      {filteredStaff.length === 0 ? (
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
            Không tìm thấy nhân sự phù hợp
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
              ? `Không có nhân sự nào khớp với từ khóa "${searchTerm}". Thử tìm theo tên, SĐT hoặc cơ sở.`
              : "Không có nhân sự nào khớp với bộ lọc trạng thái hoặc cơ sở đã chọn."}
          </p>
          <Button variant="secondary" compact onClick={onResetFilters}>
            <RotateCcw size={14} />
            <span>Xóa bộ lọc tìm kiếm</span>
          </Button>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="standard-table">
            <thead>
              <tr>
                <th>Nhân sự</th>
                <th>Tài khoản (SĐT)</th>
                <th>Email</th>
                <th>Cơ sở phụ trách</th>
                <th>Trạng thái</th>
                <th>Quyền thao tác</th>
                <th style={{ textAlign: "right" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredStaff.map((item) => {
                const rowId = item.id || item._id;
                const phone = item.username || item.phoneNumber || "";
                const branches = resolveAssignedBranches(item.assignedBranches);
                const activePerms = enabledCount(item);
                const totalPerms = MANAGER_PERMISSIONS.length;
                const isSuspended = item.status === "SUSPENDED";

                return (
                  <tr key={rowId}>
                    <td>
                      <div className="staff-person-cell">
                        <div
                          className={`staff-avatar ${
                            isSuspended ? "is-suspended" : ""
                          }`}
                        >
                          {getInitials(item.name)}
                        </div>
                        <div>
                          <span className="staff-person-name">{item.name}</span>
                          <span className="staff-person-role">
                            {branches.length > 0
                              ? `Phụ trách ${branches.length} cơ sở`
                              : "Quản lý cơ sở"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      {phone ? (
                        <div className="staff-phone-cell">
                          <span className="mono-badge">
                            <Phone size={12} />
                            {phone}
                          </span>
                          <button
                            type="button"
                            className={`staff-copy-btn ${
                              copiedKey === rowId ? "is-copied" : ""
                            }`}
                            onClick={() => onCopyPhone(phone, rowId)}
                            title="Sao chép số điện thoại"
                            aria-label={`Sao chép số điện thoại ${phone}`}
                          >
                            {copiedKey === rowId ? (
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
                      {branches.length > 0 ? (
                        <div className="staff-branch-list">
                          {branches.map((b) => (
                            <span key={b.id} className="staff-branch-pill">
                              <Building2 size={12} />
                              {b.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="staff-branch-empty">
                          Chưa gán cơ sở
                        </span>
                      )}
                    </td>
                    <td>
                      {isSuspended ? (
                        <span className="badge-locked-pill" style={{ gap: "4px" }}>
                          <Lock size={11} />
                          <span>Đã khóa</span>
                        </span>
                      ) : item.mustChangePassword ? (
                        <span className="badge-warning-pill" style={{ gap: "4px" }}>
                          <Clock size={11} />
                          <span>Chờ đổi mật khẩu</span>
                        </span>
                      ) : (
                        <span className="badge-active-pill" style={{ gap: "4px" }}>
                          <CheckCircle2 size={11} />
                          <span>Đang hoạt động</span>
                        </span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`staff-perm-pill ${
                          activePerms === totalPerms
                            ? "is-full"
                            : "is-restricted"
                        }`}
                        onClick={() => onOpenPermissions(item)}
                        title="Nhấn để bật/tắt quyền chi tiết"
                      >
                        <ShieldCheck size={13} />
                        <span>
                          {activePerms}/{totalPerms} quyền
                        </span>
                      </button>
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <div className="staff-row-actions">
                        <button
                          type="button"
                          className="staff-action-btn is-perm"
                          onClick={() => onOpenPermissions(item)}
                          title="Phân quyền chi tiết"
                          aria-label={`Phân quyền cho ${item.name}`}
                        >
                          <ShieldCheck size={15} strokeWidth={2} />
                        </button>
                        <button
                          type="button"
                          className={`staff-action-btn ${
                            isSuspended ? "is-unlock" : "is-lock"
                          }`}
                          onClick={() => onOpenLock(item)}
                          title={
                            isSuspended
                              ? "Mở khóa tài khoản"
                              : "Khóa tài khoản"
                          }
                          aria-label={
                            isSuspended
                              ? `Mở khóa ${item.name}`
                              : `Khóa ${item.name}`
                          }
                        >
                          {isSuspended ? (
                            <LockOpen size={15} strokeWidth={2} />
                          ) : (
                            <Lock size={15} strokeWidth={2} />
                          )}
                        </button>
                        <button
                          type="button"
                          className="staff-action-btn is-reset"
                          disabled={isSuspended}
                          onClick={() => onOpenResetPassword(item)}
                          title={
                            isSuspended
                              ? "Mở khóa tài khoản trước khi cấp lại mật khẩu"
                              : "Cấp lại mật khẩu tạm thời"
                          }
                          aria-label={`Cấp lại mật khẩu cho ${item.name}`}
                        >
                          <KeyRound size={15} strokeWidth={2} />
                        </button>
                      </div>
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
