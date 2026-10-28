import {
  Users,
  Plus,
  KeyRound,
  Building2,
  Phone,
  Mail,
  RefreshCw,
} from "lucide-react";
import {
  Button,
  Field,
  Modal,
  FormError,
  LoadingState,
  EmptyState,
  CredentialsModal,
} from "../../components/ui";
import { useStaffManagement } from "../../hooks/useStaffManagement";

export default function StaffPage() {
  const {
    staffList,
    branches,
    loading,
    error,
    loadData,
    isCreateOpen,
    openCreateModal,
    closeCreateModal,
    name,
    setName,
    phoneNumber,
    setPhoneNumber,
    email,
    setEmail,
    assignedBranches,
    toggleBranch,
    busy,
    formError,
    handleCreateStaff,
    resettingStaff,
    setResettingStaff,
    resetBusy,
    confirmResetPassword,
    issuedCreds,
    setIssuedCreds,
    resolveAssignedBranchNames,
  } = useStaffManagement();

  return (
    <div className="staff-management-page">
      <header className="page-heading">
        <div>
          <h1>Đội ngũ Quản lý cơ sở</h1>
          <p>
            Cấp tài khoản đăng nhập (SĐT) và phân quyền cơ sở vận hành cho các
            Quản lý (Property Manager).
          </p>
        </div>
        <div className="page-actions">
          <Button
            variant="secondary"
            onClick={() => loadData()}
            title="Làm mới danh sách"
          >
            <RefreshCw size={15} />
            <span>Làm mới</span>
          </Button>
          <Button onClick={openCreateModal}>
            <Plus size={16} />
            <span>Cấp tài khoản Quản lý</span>
          </Button>
        </div>
      </header>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <EmptyState
          title="Không thể tải dữ liệu"
          description={error}
          action={<Button onClick={() => loadData()}>Thử lại</Button>}
        />
      ) : staffList.length === 0 ? (
        <EmptyState
          title="Chưa có Quản lý cơ sở nào"
          description="Chủ trọ có thể cấp tài khoản cho nhân sự quản lý tòa nhà, chốt số điện nước và phụ trách vận hành chi nhánh."
          action={
            <Button onClick={openCreateModal}>
              <Plus size={16} />
              Cấp tài khoản Quản lý đầu tiên
            </Button>
          }
        />
      ) : (
        <div className="content-panel">
          <div className="panel-heading">
            <h2>
              <Users size={18} />
              <span>Danh sách Quản lý ({staffList.length})</span>
            </h2>
          </div>

          <div className="table-responsive">
            <table className="standard-table">
              <thead>
                <tr>
                  <th>Họ và tên</th>
                  <th>Tài khoản (SĐT)</th>
                  <th>Email</th>
                  <th>Cơ sở phụ trách</th>
                  <th>Trạng thái</th>
                  <th style={{ textAlign: "right" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {staffList.map((item) => {
                  const assignedBranchNames = resolveAssignedBranchNames(
                    item.assignedBranches,
                  );

                  return (
                    <tr key={item._id || item.id}>
                      <td>
                        <strong>{item.name}</strong>
                      </td>
                      <td>
                        <span className="mono-badge">
                          <Phone size={13} />
                          {item.username || item.phoneNumber || "—"}
                        </span>
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
                        {assignedBranchNames ? (
                          <span className="branch-tag">
                            <Building2 size={13} />
                            {assignedBranchNames}
                          </span>
                        ) : (
                          <span style={{ color: "var(--neutral-400)" }}>
                            Chưa gán cơ sở
                          </span>
                        )}
                      </td>
                      <td>
                        {item.mustChangePassword ? (
                          <span className="badge-warning-pill">
                            Chờ đổi mật khẩu
                          </span>
                        ) : (
                          <span className="badge-active-pill">
                            Đang hoạt động
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <Button
                          variant="secondary"
                          compact
                          onClick={() => setResettingStaff(item)}
                          title="Cấp lại mật khẩu ngẫu nhiên cho nhân sự này"
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
        </div>
      )}

      {/* Modal Cấp tài khoản Staff mới */}
      {isCreateOpen && (
        <Modal
          title="Cấp tài khoản Quản lý cơ sở mới"
          subtitle="Hệ thống tự động sinh mật khẩu tạm thời. Quản lý sẽ bắt buộc đổi mật khẩu ở lần đăng nhập đầu tiên."
          onClose={closeCreateModal}
          busy={busy}
        >
          <form onSubmit={handleCreateStaff}>
            <div className="form-section form-grid" style={{ gap: "16px" }}>
              <div className="span-2">
                <Field
                  label="Họ và tên Quản lý"
                  required
                  placeholder="Ví dụ: Lê Quản Lý"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={busy}
                />
              </div>

              <div className="span-2">
                <Field
                  label="Số điện thoại Việt Nam (Tên đăng nhập)"
                  type="tel"
                  required
                  placeholder="Ví dụ: 0977 777 777"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  disabled={busy}
                  hint="10 chữ số (chuẩn hóa về đầu 0). Dùng làm tài khoản đăng nhập."
                />
              </div>

              <div className="span-2">
                <Field
                  label="Địa chỉ Email (tùy chọn)"
                  type="email"
                  placeholder="manager@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={busy}
                  hint="Không bắt buộc"
                />
              </div>

              <div className="span-2">
                <label
                  className="field-label"
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontWeight: 600,
                  }}
                >
                  Phân quyền Cơ sở quản lý:
                </label>
                {branches.length === 0 ? (
                  <p style={{ fontSize: "13px", color: "var(--neutral-500)" }}>
                    Chưa có cơ sở nào. Hãy tạo cơ sở trước khi gán.
                  </p>
                ) : (
                  <div className="branch-selector-grid">
                    {branches.map((b) => {
                      const checked = assignedBranches.includes(b._id);
                      return (
                        <label
                          key={b._id}
                          className={`branch-checkbox-card ${
                            checked ? "selected" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleBranch(b._id)}
                            disabled={busy}
                          />
                          <div>
                            <strong>{b.name}</strong>
                            <small>{b.address?.fullAddress || "—"}</small>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <FormError error={formError} />

            <footer className="modal-footer" style={{ marginTop: "24px" }}>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={closeCreateModal}
              >
                Hủy
              </Button>
              <Button busy={busy}>Cấp tài khoản &amp; Nhận mật khẩu tạm</Button>
            </footer>
          </form>
        </Modal>
      )}

      {/* Modal Xác nhận cấp lại mật khẩu tạm (thay thế window.confirm) */}
      {resettingStaff && (
        <Modal
          title="Xác nhận cấp lại mật khẩu tạm"
          subtitle={`Tài khoản: ${resettingStaff.name} (${
            resettingStaff.username || resettingStaff.phoneNumber
          })`}
          onClose={() => !resetBusy && setResettingStaff(null)}
          busy={resetBusy}
        >
          <p style={{ fontSize: "14px", lineHeight: 1.55, color: "#334155" }}>
            Bạn có chắc chắn muốn sinh mật khẩu tạm mới cho Quản lý{" "}
            <strong>{resettingStaff.name}</strong>? Toàn bộ phiên đăng nhập hiện
            tại của nhân sự này sẽ bị thu hồi và họ sẽ phải đổi mật khẩu ở lần
            đăng nhập kế tiếp.
          </p>
          <footer className="modal-footer" style={{ marginTop: "24px" }}>
            <Button
              type="button"
              variant="secondary"
              disabled={resetBusy}
              onClick={() => setResettingStaff(null)}
            >
              Hủy
            </Button>
            <Button
              type="button"
              busy={resetBusy}
              onClick={confirmResetPassword}
            >
              Xác nhận cấp lại
            </Button>
          </footer>
        </Modal>
      )}

      {/* Hiển thị mật khẩu tạm thời một lần duy nhất */}
      {issuedCreds && (
        <CredentialsModal
          credentials={issuedCreds.credentials}
          recipientName={issuedCreds.recipientName}
          roleLabel={issuedCreds.roleLabel}
          onClose={() => setIssuedCreds(null)}
        />
      )}
    </div>
  );
}
