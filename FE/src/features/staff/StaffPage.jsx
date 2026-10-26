import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Plus,
  KeyRound,
  ShieldCheck,
  Building2,
  Phone,
  Mail,
  RefreshCw,
} from "lucide-react";
import { staffApi, branchApi, errorMessage } from "../../services/api";
import { useToast } from "../../context/ToastContext";
import {
  Button,
  Field,
  Modal,
  FormError,
  LoadingState,
  EmptyState,
} from "../../components/ui";
import { CredentialsModal } from "../../components/ui/CredentialsModal";

export default function StaffPage() {
  const toast = useToast();
  const [staffList, setStaffList] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal create states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [assignedBranches, setAssignedBranches] = useState([]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  // Credentials dialog for newly created or reset staff
  const [issuedCreds, setIssuedCreds] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [staffRes, branchRes] = await Promise.all([
        staffApi.list({ limit: 50 }),
        branchApi.list({ limit: 100 }),
      ]);
      setStaffList(staffRes?.items || []);
      setBranches(branchRes?.items || []);
    } catch (err) {
      setError(errorMessage(err));
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleCreateStaff(e) {
    e.preventDefault();
    setBusy(true);
    setFormError("");

    try {
      const res = await staffApi.create({
        name: name.trim(),
        phoneNumber: phoneNumber.trim(),
        email: email.trim() || undefined,
        assignedBranches,
      });

      toast.success("Cấp tài khoản Quản lý cơ sở thành công!");
      setIsCreateOpen(false);
      setName("");
      setPhoneNumber("");
      setEmail("");
      setAssignedBranches([]);

      // Trigger credentials modal with temporary password
      if (res?.credentials) {
        setIssuedCreds({
          credentials: res.credentials,
          recipientName: res.user?.name || name,
          roleLabel: "Quản lý cơ sở (Property Manager)",
        });
      }
      loadData();
    } catch (err) {
      const msg = errorMessage(err);
      setFormError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleResetPassword(staffMember) {
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn cấp lại mật khẩu tạm cho Quản lý "${staffMember.name}" (${staffMember.username || staffMember.phoneNumber})? Phiên làm việc cũ của họ sẽ bị thu hồi.`,
      )
    ) {
      return;
    }

    try {
      const res = await staffApi.resetPassword(
        staffMember._id || staffMember.id,
      );
      toast.success("Đã cấp lại mật khẩu tạm thời thành công!");
      if (res?.credentials) {
        setIssuedCreds({
          credentials: res.credentials,
          recipientName: staffMember.name,
          roleLabel: "Quản lý cơ sở (Cấp lại mật khẩu)",
        });
      }
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  function toggleBranch(branchId) {
    setAssignedBranches((prev) =>
      prev.includes(branchId)
        ? prev.filter((id) => id !== branchId)
        : [...prev, branchId],
    );
  }

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
            onClick={loadData}
            title="Làm mới danh sách"
          >
            <RefreshCw size={15} />
            <span>Làm mới</span>
          </Button>
          <Button onClick={() => setIsCreateOpen(true)}>
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
          action={<Button onClick={loadData}>Thử lại</Button>}
        />
      ) : staffList.length === 0 ? (
        <EmptyState
          title="Chưa có Quản lý cơ sở nào"
          description="Chủ trọ có thể cấp tài khoản cho nhân sự quản lý tòa nhà, chốt số điện nước và phụ trách vận hành chi nhánh."
          action={
            <Button onClick={() => setIsCreateOpen(true)}>
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
                  const assignedBranchNames = (item.assignedBranches || [])
                    .map((bId) => {
                      const found = branches.find(
                        (b) => String(b._id) === String(bId),
                      );
                      return found?.name || bId;
                    })
                    .join(", ");

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
                          onClick={() => handleResetPassword(item)}
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
          onClose={() => setIsCreateOpen(false)}
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
                          className={`branch-checkbox-card ${checked ? "selected" : ""}`}
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
                onClick={() => setIsCreateOpen(false)}
              >
                Hủy
              </Button>
              <Button busy={busy}>Cấp tài khoản & Nhận mật khẩu tạm</Button>
            </footer>
          </form>
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
