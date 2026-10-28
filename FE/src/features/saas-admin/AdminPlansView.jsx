import React, { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  Building2,
  DoorOpen,
  Users,
  AlertTriangle,
  Sparkles,
  Power,
  Clock,
} from "lucide-react";
import { adminApi, errorMessage } from "../../services/api";
import { money } from "../../utils/format";
import { useToast } from "../../context/ToastContext";
import { LoadingState, ErrorState, EmptyState, Button, Modal, Pagination } from "../../components/ui";
import { useLiveRefresh } from "../../hooks/useLiveRefresh";
import { useDebounced } from "../../hooks/useResource";

// Every plan includes every feature; plans differ only in price and these quotas.
// A quota at or above `unlimited` is shown (and saved) as "Không giới hạn".
const QUOTAS = [
  { key: "maxBranches", label: "Cơ sở", icon: Building2, unlimited: 999 },
  { key: "maxRooms", label: "Phòng", icon: DoorOpen, unlimited: 9999 },
  { key: "maxManagers", label: "Quản lý", icon: Users, unlimited: 99 },
];
const STATUS_FILTERS = [
  { value: "", label: "Tất cả" },
  { value: "true", label: "Đang bán" },
  { value: "false", label: "Tạm ngưng" },
];
const PAGE_SIZE = 20;

const INITIAL_FORM = {
  name: "",
  code: "",
  price: 199000,
  billingCycle: "MONTHLY",
  maxBranches: 1,
  maxRooms: 20,
  maxManagers: 2,
  trialDays: 30,
  isActive: true,
};

const isUnlimited = (plan, quota) => plan[quota.key] >= quota.unlimited;
const codeTone = (code) =>
  ({ FREE_TRIAL: "trial", STARTER: "starter", PRO: "pro", ENTERPRISE: "enterprise" })[code] || "custom";

export function AdminPlansView() {
  const toast = useToast();
  const [plans, setPlans] = useState([]);
  const [includedFeatures, setIncludedFeatures] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  // Query the API once typing pauses, not on every keystroke.
  const debouncedSearch = useDebounced(search);
  const [statusFilter, setStatusFilter] = useState("");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [deletingPlan, setDeletingPlan] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  const fetchPlans = useCallback(async (silent) => {
    if (silent !== true) setLoading(true);
    setError(null);
    try {
      const params = { page, limit: PAGE_SIZE };
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (statusFilter) params.isActive = statusFilter;
      const res = await adminApi.listPlans(params);
      setPlans(res?.items || []);
      setTotal(res?.total || 0);
      setIncludedFeatures(res?.includedFeatures || []);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter]);
  useLiveRefresh(["admin","plans"], () => fetchPlans(true));

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const formOpen = isCreateOpen || !!editingPlan;
  const isTrialForm = form.code === "FREE_TRIAL";

  function closeForm() {
    setIsCreateOpen(false);
    setEditingPlan(null);
  }

  function openCreate() {
    setForm(INITIAL_FORM);
    setIsCreateOpen(true);
  }

  function openEdit(plan) {
    setEditingPlan(plan);
    setForm({
      name: plan.name,
      code: plan.code,
      price: plan.price,
      billingCycle: plan.billingCycle || "MONTHLY",
      maxBranches: plan.maxBranches,
      maxRooms: plan.maxRooms,
      maxManagers: plan.maxManagers,
      trialDays: plan.trialDays || 30,
      isActive: plan.isActive ?? true,
    });
  }

  function setQuotaUnlimited(quota, on) {
    setForm((f) => ({ ...f, [quota.key]: on ? quota.unlimited : 1 }));
  }

  async function handleSavePlan(e) {
    e?.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        price: isTrialForm ? 0 : Number(form.price),
        billingCycle: form.billingCycle,
        maxBranches: Number(form.maxBranches),
        maxRooms: Number(form.maxRooms),
        maxManagers: Number(form.maxManagers),
        isActive: !!form.isActive,
      };
      if (isTrialForm) payload.trialDays = Number(form.trialDays);

      if (editingPlan) {
        await adminApi.updatePlan(editingPlan._id, payload);
        toast.success(`Đã cập nhật gói "${payload.name}"`);
      } else {
        payload.code = form.code.trim().toUpperCase();
        await adminApi.createPlan(payload);
        toast.success(`Đã tạo gói "${payload.name}"`);
      }
      closeForm();
      fetchPlans();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(plan) {
    setTogglingId(plan._id);
    try {
      await adminApi.updatePlan(plan._id, { isActive: !plan.isActive });
      toast.success(plan.isActive ? `Đã tạm ngưng bán gói "${plan.name}"` : `Đã mở bán lại gói "${plan.name}"`);
      fetchPlans();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDeletePlan() {
    if (!deletingPlan) return;
    setSubmitting(true);
    try {
      await adminApi.deletePlan(deletingPlan._id);
      toast.success(`Đã xóa gói "${deletingPlan.name}"`);
      setDeletingPlan(null);
      fetchPlans();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="admin-view-body">
      {/* Mọi gói có cùng tính năng: liệt kê một lần */}
      <section className="plans-included-panel">
        <div className="plans-included-head">
          <Sparkles size={18} />
          <div>
            <h3>Mọi gói đều có đầy đủ tính năng</h3>
            <p>Các gói chỉ khác nhau ở giá và hạn ngạch số cơ sở, phòng, nhân viên quản lý.</p>
          </div>
        </div>
        {includedFeatures.length > 0 && (
          <ul className="plans-included-list">
            {includedFeatures.map((feat) => (
              <li key={feat}>
                <CheckCircle2 size={13} />
                <span>{feat}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Thanh công cụ */}
      <div className="plans-toolbar">
        <div className="plans-search">
          <Search size={15} />
          <input
            type="search"
            className="admin-input"
            placeholder="Tìm theo tên gói..."
            aria-label="Tìm theo tên gói"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="plans-segmented" role="group" aria-label="Lọc theo trạng thái">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              className={statusFilter === f.value ? "is-active" : ""}
              aria-pressed={statusFilter === f.value}
              onClick={() => {
                setStatusFilter(f.value);
                setPage(1);
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} />
          <span>Thêm gói</span>
        </Button>
      </div>

      {loading && !plans.length ? (
        <LoadingState />
      ) : error && !plans.length ? (
        <ErrorState message={error} retry={fetchPlans} />
      ) : !plans.length ? (
        <EmptyState
          title={search || statusFilter ? "Không có gói phù hợp" : "Chưa có gói dịch vụ nào"}
          description={search || statusFilter ? "Thử đổi từ khóa hoặc bộ lọc." : "Tạo gói đầu tiên để chủ trọ có thể đăng ký."}
          action={
            <Button onClick={openCreate}>
              <Plus size={16} />
              <span>Thêm gói</span>
            </Button>
          }
        />
      ) : (
        <>
          <div className="plans-admin-grid">
            {plans.map((p) => {
              const inUse = p.subscriptionCount > 0;
              return (
                <article key={p._id} className={`plan-admin-card tone-${codeTone(p.code)} ${p.isActive ? "" : "is-paused"}`}>
                  <header className="plan-admin-card-head">
                    <span className="plan-admin-code">{p.code}</span>
                    <span className={`status-pill ${p.isActive ? "active" : "cancelled"}`}>
                      {p.isActive ? "Đang bán" : "Tạm ngưng"}
                    </span>
                  </header>

                  <h3 className="plan-admin-name">{p.name}</h3>
                  <div className="plan-admin-price">
                    {p.price === 0 ? (
                      <strong>Miễn phí</strong>
                    ) : (
                      <>
                        <strong>{money(p.price)}</strong>
                        <span>/{p.billingCycle === "YEARLY" ? "năm" : "tháng"}</span>
                      </>
                    )}
                  </div>

                  <dl className="plan-admin-quotas">
                    {QUOTAS.map((q) => {
                      const Icon = q.icon;
                      return (
                        <div key={q.key}>
                          <dt>
                            <Icon size={14} />
                            {q.label}
                          </dt>
                          <dd>{isUnlimited(p, q) ? "Không giới hạn" : p[q.key]}</dd>
                        </div>
                      );
                    })}
                  </dl>

                  <div className="plan-admin-meta">
                    {p.code === "FREE_TRIAL" && (
                      <span>
                        <Clock size={13} /> Dùng thử {p.trialDays || 30} ngày
                      </span>
                    )}
                    <span className={inUse ? "is-used" : ""}>
                      <Users size={13} />
                      {inUse ? `${p.subscriptionCount} thuê bao đang dùng` : "Chưa có thuê bao"}
                    </span>
                  </div>

                  <footer className="plan-admin-actions">
                    <button type="button" className="admin-action-btn" onClick={() => openEdit(p)}>
                      <Edit2 size={13} />
                      <span>Sửa</span>
                    </button>
                    <button
                      type="button"
                      className="admin-action-btn"
                      onClick={() => handleToggleActive(p)}
                      disabled={togglingId === p._id || (p.isActive && inUse)}
                      title={p.isActive && inUse ? "Gói còn thuê bao đang dùng, không thể tạm ngưng" : undefined}
                    >
                      <Power size={13} />
                      <span>{p.isActive ? "Tạm ngưng" : "Mở bán"}</span>
                    </button>
                    <button
                      type="button"
                      className="admin-action-btn danger"
                      onClick={() => setDeletingPlan(p)}
                      disabled={inUse}
                      title={inUse ? "Gói còn thuê bao đang dùng, không thể xóa" : `Xóa gói ${p.name}`}
                      aria-label={`Xóa gói ${p.name}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </footer>
                </article>
              );
            })}
          </div>

          <Pagination page={page} total={total} limit={PAGE_SIZE} onChange={(n) => setPage(n)} />
        </>
      )}

      {/* Tạo / sửa gói */}
      {formOpen && (
        <Modal
          isOpen
          onClose={closeForm}
          title={editingPlan ? `Sửa gói "${editingPlan.name}"` : "Thêm gói dịch vụ"}
          subtitle="Mọi gói có đầy đủ tính năng; chỉ cấu hình giá và hạn ngạch"
          maxWidth="600px"
          footer={
            <>
              <Button variant="secondary" onClick={closeForm} disabled={submitting}>
                Hủy
              </Button>
              <Button onClick={handleSavePlan} busy={submitting}>
                {editingPlan ? "Lưu thay đổi" : "Tạo gói"}
              </Button>
            </>
          }
        >
          <form className="admin-form plan-form" onSubmit={handleSavePlan}>
            <fieldset>
              <legend>Thông tin gói</legend>
              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label htmlFor="plan-name">
                    Tên gói <span className="req">*</span>
                  </label>
                  <input
                    id="plan-name"
                    type="text"
                    required
                    className="admin-input"
                    placeholder="Ví dụ: Gói Chuyên Nghiệp"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label htmlFor="plan-code">
                    Mã gói <span className="req">*</span>
                  </label>
                  <input
                    id="plan-code"
                    type="text"
                    required
                    disabled={!!editingPlan}
                    className="admin-input"
                    placeholder="Ví dụ: PRO"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  />
                  <small className="admin-form-help">
                    {editingPlan ? "Không đổi được sau khi tạo." : "Chữ hoa, số, gạch dưới."}
                  </small>
                </div>
              </div>
            </fieldset>

            <fieldset>
              <legend>Giá và chu kỳ</legend>
              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label htmlFor="plan-price">
                    Giá (VND) <span className="req">*</span>
                  </label>
                  <input
                    id="plan-price"
                    type="number"
                    min="0"
                    step="1000"
                    required
                    disabled={isTrialForm}
                    className="admin-input"
                    value={isTrialForm ? 0 : form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                  />
                  <small className="admin-form-help">
                    {isTrialForm ? "Gói dùng thử luôn miễn phí." : money(Number(form.price) || 0)}
                  </small>
                </div>
                <div className="admin-form-group">
                  <label htmlFor="plan-cycle">Chu kỳ</label>
                  <select
                    id="plan-cycle"
                    className="admin-select"
                    value={form.billingCycle}
                    onChange={(e) => setForm({ ...form, billingCycle: e.target.value })}
                  >
                    <option value="MONTHLY">Hàng tháng</option>
                    <option value="YEARLY">Hàng năm</option>
                  </select>
                </div>
              </div>
              {isTrialForm && (
                <div className="admin-form-group">
                  <label htmlFor="plan-trial">Số ngày dùng thử</label>
                  <input
                    id="plan-trial"
                    type="number"
                    min="1"
                    max="365"
                    className="admin-input"
                    value={form.trialDays}
                    onChange={(e) => setForm({ ...form, trialDays: e.target.value })}
                  />
                </div>
              )}
            </fieldset>

            <fieldset>
              <legend>Hạn ngạch</legend>
              <div className="plan-form-quotas">
                {QUOTAS.map((q) => {
                  const unlimited = Number(form[q.key]) >= q.unlimited;
                  return (
                    <div key={q.key} className="admin-form-group">
                      <label htmlFor={`plan-${q.key}`}>
                        Tối đa {q.label.toLowerCase()} <span className="req">*</span>
                      </label>
                      <input
                        id={`plan-${q.key}`}
                        type="number"
                        min="1"
                        required
                        disabled={unlimited}
                        className="admin-input"
                        value={unlimited ? "" : form[q.key]}
                        placeholder={unlimited ? "Không giới hạn" : undefined}
                        onChange={(e) => setForm({ ...form, [q.key]: e.target.value })}
                      />
                      <label className="plan-form-check">
                        <input
                          type="checkbox"
                          checked={unlimited}
                          onChange={(e) => setQuotaUnlimited(q, e.target.checked)}
                        />
                        <span>Không giới hạn</span>
                      </label>
                    </div>
                  );
                })}
              </div>
            </fieldset>

            <label className="plan-form-check">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
              <span>Đang bán (chủ trọ thấy và đăng ký được)</span>
            </label>
          </form>
        </Modal>
      )}

      {/* Xác nhận xóa */}
      {deletingPlan && (
        <Modal
          isOpen
          onClose={() => setDeletingPlan(null)}
          title="Xóa gói dịch vụ"
          maxWidth="460px"
          footer={
            <>
              <Button variant="secondary" onClick={() => setDeletingPlan(null)} disabled={submitting}>
                Không xóa
              </Button>
              <Button variant="danger" onClick={handleDeletePlan} busy={submitting}>
                Xóa gói
              </Button>
            </>
          }
        >
          <div className="admin-alert-banner warning">
            <AlertTriangle size={20} style={{ flexShrink: 0 }} />
            <div>
              Xóa gói <strong>{deletingPlan.name}</strong> ({deletingPlan.code})? Gói sẽ ẩn khỏi danh sách và chủ trọ
              không đăng ký được nữa.
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
