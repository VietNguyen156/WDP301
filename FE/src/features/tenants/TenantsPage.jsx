import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Plus,
  KeyRound,
  CreditCard,
  Phone,
  Mail,
  MapPin,
  RefreshCw,
} from "lucide-react";
import { tenantApi, errorMessage } from "../../services/api";
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

export default function TenantsPage() {
  const toast = useToast();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [citizenId, setCitizenId] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [hometown, setHometown] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  // Credentials dialog for newly created or reset tenant
  const [issuedCreds, setIssuedCreds] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await tenantApi.list({ limit: 100 });
      setTenants(res?.items || []);
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

  async function handleCreateTenant(e) {
    e.preventDefault();
    setBusy(true);
    setFormError("");

    if (!/^\d{12}$/.test(citizenId.trim())) {
      setFormError("Số CCCD phải gồm đúng 12 chữ số.");
      setBusy(false);
      return;
    }

    try {
      const res = await tenantApi.create({
        name: name.trim(),
        citizenId: citizenId.trim(),
        phoneNumber: phoneNumber.trim() || undefined,
        email: email.trim() || undefined,
        hometown: hometown.trim() || undefined,
      });

      toast.success("Cấp tài khoản Khách thuê thành công!");
      setIsCreateOpen(false);
      setName("");
      setCitizenId("");
      setPhoneNumber("");
      setEmail("");
      setHometown("");

      // Trigger credentials modal with temporary password
      if (res?.credentials) {
        setIssuedCreds({
          credentials: res.credentials,
          recipientName: res.user?.name || name,
          roleLabel: "Khách thuê (Tenant)",
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

  async function handleResetPassword(tenant) {
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn cấp lại mật khẩu tạm cho Khách thuê "${tenant.name}" (CCCD: ${tenant.citizenId || tenant.username})? Phiên đăng nhập cũ của họ sẽ bị thu hồi.`,
      )
    ) {
      return;
    }

    try {
      const res = await tenantApi.resetPassword(tenant._id || tenant.id);
      toast.success("Đã cấp lại mật khẩu tạm thời thành công!");
      if (res?.credentials) {
        setIssuedCreds({
          credentials: res.credentials,
          recipientName: tenant.name,
          roleLabel: "Khách thuê (Cấp lại mật khẩu)",
        });
      }
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <div className="tenants-management-page">
      <header className="page-heading">
        <div>
          <h1>Hồ sơ Khách thuê & Cư dân</h1>
          <p>
            Cấp và quản lý tài khoản khách thuê theo CCCD (12 số). Mật khẩu tạm
            thời chỉ hiển thị một lần duy nhất tại đây.
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
            <span>Cấp tài khoản Khách thuê</span>
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
      ) : tenants.length === 0 ? (
        <EmptyState
          title="Chưa có Khách thuê nào trong chuỗi"
          description="Khách thuê có thể được cấp tài khoản tại đây hoặc tự động khởi tạo khi lập Hợp đồng thuê phòng mới."
          action={
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus size={16} />
              Cấp tài khoản Khách thuê đầu tiên
            </Button>
          }
        />
      ) : (
        <div className="content-panel">
          <div className="panel-heading">
            <h2>
              <Users size={18} />
              <span>Danh sách Khách thuê ({tenants.length})</span>
            </h2>
          </div>

          <div className="table-responsive">
            <table className="standard-table">
              <thead>
                <tr>
                  <th>Họ và tên</th>
                  <th>Tài khoản (CCCD)</th>
                  <th>Số điện thoại</th>
                  <th>Email</th>
                  <th>Quê quán</th>
                  <th>Trạng thái</th>
                  <th style={{ textAlign: "right" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((item) => (
                  <tr key={item._id || item.id}>
                    <td>
                      <strong>{item.name}</strong>
                    </td>
                    <td>
                      <span className="mono-badge">
                        <CreditCard size={13} />
                        {item.citizenId || item.username || "—"}
                      </span>
                    </td>
                    <td>
                      {item.phoneNumber ? (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            color: "var(--neutral-700)",
                          }}
                        >
                          <Phone size={13} />
                          {item.phoneNumber}
                        </span>
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
                        title="Cấp lại mật khẩu ngẫu nhiên cho khách thuê này"
                      >
                        <KeyRound size={14} />
                        <span>Cấp lại mật khẩu</span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Cấp tài khoản Tenant mới */}
      {isCreateOpen && (
        <Modal
          title="Cấp tài khoản Khách thuê mới"
          subtitle="Tên đăng nhập là số CCCD (12 chữ số). Hệ thống tự sinh mật khẩu tạm thời để bàn giao."
          onClose={() => setIsCreateOpen(false)}
          busy={busy}
        >
          <form onSubmit={handleCreateTenant}>
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
