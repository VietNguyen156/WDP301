import { ShieldCheck } from "lucide-react";
import { Button, Field, Modal, FormError, CredentialsModal } from "../ui";
import { MANAGER_PERMISSIONS } from "../../utils/managerPermissions";

export function StaffModals({
  branches,
  isCreateOpen,
  closeCreateModal,
  name,
  setName,
  phoneNumber,
  setPhoneNumber,
  email,
  setEmail,
  assignedBranches,
  toggleBranch,
  toggleAllBranches,
  busy,
  formError,
  handleCreateStaff,
  resettingStaff,
  setResettingStaff,
  resetBusy,
  confirmResetPassword,
  lockingStaff,
  setLockingStaff,
  lockBusy,
  confirmToggleLock,
  permissionStaff,
  setPermissionStaff,
  permissionBusyKey,
  togglePermission,
  issuedCreds,
  setIssuedCreds,
}) {
  const activePermsCount = permissionStaff
    ? MANAGER_PERMISSIONS.filter(
        (p) => permissionStaff.permissions?.[p.key] !== false,
      ).length
    : 0;

  return (
    <>
      {isCreateOpen && (
        <Modal
          title="Cấp tài khoản Quản lý cơ sở mới"
          subtitle="Hệ thống tự sinh mật khẩu tạm thời. Quản lý bắt buộc đổi mật khẩu ở lần đăng nhập đầu tiên."
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

              <Field
                label="Số điện thoại (Tên đăng nhập)"
                type="tel"
                required
                placeholder="0977 777 777"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled={busy}
                hint="10 chữ số (đầu 0), dùng để đăng nhập"
              />

              <Field
                label="Địa chỉ Email (tùy chọn)"
                type="email"
                placeholder="manager@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
                hint="Không bắt buộc"
              />

              <div className="span-2">
                <div className="staff-branch-header-row">
                  <label className="field-label" style={{ marginBottom: 0 }}>
                    Phân quyền Cơ sở phụ trách ({assignedBranches.length}/
                    {branches.length})
                  </label>
                  {branches.length > 1 && (
                    <button
                      type="button"
                      className="staff-branch-toggle-all"
                      onClick={toggleAllBranches}
                      disabled={busy}
                    >
                      {assignedBranches.length === branches.length
                        ? "Bỏ chọn tất cả"
                        : "Chọn tất cả"}
                    </button>
                  )}
                </div>
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
              <Button type="submit" busy={busy}>
                Cấp tài khoản &amp; Nhận mật khẩu tạm
              </Button>
            </footer>
          </form>
        </Modal>
      )}

      {resettingStaff && (
        <Modal
          title="Xác nhận cấp lại mật khẩu tạm"
          subtitle={`${resettingStaff.name} (${
            resettingStaff.username || resettingStaff.phoneNumber
          })`}
          onClose={() => !resetBusy && setResettingStaff(null)}
          busy={resetBusy}
        >
          <div className="staff-modal-callout is-warning">
            Hệ thống sẽ tạo một mật khẩu tạm mới cho{" "}
            <strong>{resettingStaff.name}</strong>. Toàn bộ phiên đăng nhập hiện
            tại của nhân sự này sẽ bị thu hồi và bắt buộc đổi mật khẩu mới khi
            đăng nhập lại.
          </div>
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

      {lockingStaff && (
        <Modal
          title={
            lockingStaff.status === "SUSPENDED"
              ? "Mở khóa tài khoản Quản lý"
              : "Khóa tài khoản Quản lý"
          }
          subtitle={`${lockingStaff.name} (${
            lockingStaff.username || lockingStaff.phoneNumber
          })`}
          onClose={() => !lockBusy && setLockingStaff(null)}
          busy={lockBusy}
        >
          <div
            className={`staff-modal-callout ${
              lockingStaff.status === "SUSPENDED" ? "is-success" : "is-danger"
            }`}
          >
            {lockingStaff.status === "SUSPENDED" ? (
              <>
                <strong>{lockingStaff.name}</strong> sẽ đăng nhập lại được bằng
                mật khẩu cũ cùng các quyền và cơ sở đã gán trước đây.
              </>
            ) : (
              <>
                <strong>{lockingStaff.name}</strong> sẽ bị đăng xuất ngay lập tức
                và không thể truy cập hệ thống cho đến khi bạn mở khóa. Mọi dữ
                liệu, cơ sở và cấu hình quyền được giữ nguyên.
              </>
            )}
          </div>
          <footer className="modal-footer" style={{ marginTop: "24px" }}>
            <Button
              type="button"
              variant="secondary"
              disabled={lockBusy}
              onClick={() => setLockingStaff(null)}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant={
                lockingStaff.status === "SUSPENDED" ? "primary" : "danger"
              }
              busy={lockBusy}
              onClick={confirmToggleLock}
            >
              {lockingStaff.status === "SUSPENDED"
                ? "Mở khóa tài khoản"
                : "Khóa tài khoản"}
            </Button>
          </footer>
        </Modal>
      )}

      {permissionStaff && (
        <Modal
          title="Phân quyền Quản lý cơ sở"
          subtitle={`${permissionStaff.name} (${
            permissionStaff.username || permissionStaff.phoneNumber
          })`}
          onClose={() => !permissionBusyKey && setPermissionStaff(null)}
          busy={Boolean(permissionBusyKey)}
        >
          <div className="staff-perm-summary-banner">
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <ShieldCheck size={15} color="#005c55" />
              <span>
                Đang bật{" "}
                <strong>
                  {activePermsCount}/{MANAGER_PERMISSIONS.length}
                </strong>{" "}
                quyền thao tác
              </span>
            </span>
            <span style={{ fontSize: "12px", color: "#64748b" }}>
              {permissionBusyKey
                ? "Đang lưu thay đổi..."
                : "Tự động lưu khi bật/tắt"}
            </span>
          </div>

          <div className="staff-perm-list">
            {MANAGER_PERMISSIONS.map((perm) => {
              const enabled = permissionStaff.permissions?.[perm.key] !== false;
              return (
                <label key={perm.key} className="staff-perm-row">
                  <div>
                    <strong>{perm.label}</strong>
                    <small>{perm.hint}</small>
                  </div>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={enabled}
                    disabled={Boolean(permissionBusyKey)}
                    onChange={(e) => togglePermission(perm.key, e.target.checked)}
                    aria-label={perm.label}
                  />
                </label>
              );
            })}
          </div>
          <footer className="modal-footer" style={{ marginTop: "24px" }}>
            <Button
              type="button"
              variant="secondary"
              disabled={Boolean(permissionBusyKey)}
              onClick={() => setPermissionStaff(null)}
            >
              Đóng
            </Button>
          </footer>
        </Modal>
      )}

      {issuedCreds && (
        <CredentialsModal
          credentials={issuedCreds.credentials}
          recipientName={issuedCreds.recipientName}
          roleLabel={issuedCreds.roleLabel}
          onClose={() => setIssuedCreds(null)}
        />
      )}
    </>
  );
}
