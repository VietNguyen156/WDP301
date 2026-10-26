import React, { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Building2,
  DoorOpen,
  Users,
  AlertTriangle,
} from "lucide-react";
import { adminApi, errorMessage } from "../../services/api";
import { money } from "../../utils/format";
import { useToast } from "../../context/ToastContext";
import { LoadingState, ErrorState, EmptyState, Button, Modal, Pagination } from "../../components/ui";

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
  featuresInput: "Quản lý cơ sở\nChốt số điện nước\nVietQR động\nĐối soát SePay",
};

export function AdminPlansView() {
  const toast = useToast();
  const [plans, setPlans] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(""); // "" | "true" | "false"

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [deletingPlan, setDeletingPlan] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: 20 };
      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.isActive = statusFilter;
      const res = await adminApi.listPlans(params);
      setPlans(res?.items || []);
      setTotal(res?.total || 0);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

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
      featuresInput: (plan.features || []).join("\n"),
    });
  }

  async function handleSavePlan(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const features = form.featuresInput
        .split("\n")
        .map((f) => f.trim())
        .filter(Boolean);

      const payload = {
        name: form.name.trim(),
        price: Number(form.price),
        billingCycle: form.billingCycle,
        maxBranches: Number(form.maxBranches),
        maxRooms: Number(form.maxRooms),
        maxManagers: Number(form.maxManagers),
        trialDays: Number(form.trialDays),
        isActive: !!form.isActive,
        features,
      };

      if (!editingPlan) {
        payload.code = form.code.trim().toUpperCase();
        if (payload.code === "FREE_TRIAL") payload.price = 0;
        await adminApi.createPlan(payload);
        toast.success(`Đã tạo gói SaaS "${payload.name}" thành công!`);
        setIsCreateOpen(false);
      } else {
        if (editingPlan.code === "FREE_TRIAL") payload.price = 0;
        await adminApi.updatePlan(editingPlan._id, payload);
        toast.success(`Đã cập nhật gói "${payload.name}" thành công!`);
        setEditingPlan(null);
      }
      fetchPlans();
    } catch (err) {
      const msg = errorMessage(err);
      if (msg.includes("PLAN_IN_USE") || msg.includes("thuê bao")) {
        toast.error("Không thể sửa/giảm hạn ngạch: Gói đang có thuê bao ACTIVE sử dụng.");
      } else {
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeletePlan() {
    if (!deletingPlan) return;
    setSubmitting(true);
    try {
      await adminApi.deletePlan(deletingPlan._id);
      toast.success(`Đã xóa mềm gói "${deletingPlan.name}".`);
      setDeletingPlan(null);
      fetchPlans();
    } catch (err) {
      const msg = errorMessage(err);
      if (msg.includes("PLAN_IN_USE") || msg.includes("thuê bao")) {
        toast.error("Không thể xóa: Gói đang có thuê bao ACTIVE sử dụng.");
      } else {
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="admin-view-body">
      {/* Control Toolbar */}
      <div className="admin-control-bar">
        <div className="admin-filters-left">
          <div style={{ position: "relative", minWidth: 240 }}>
            <Search
              size={15}
              style={{ position: "absolute", left: 10, top: 10, color: "#94a3b8" }}
            />
            <input
              type="text"
              className="admin-input"
              style={{ paddingLeft: 32 }}
              placeholder="Tìm theo tên gói..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <select
            className="admin-select"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="true">Đang kích hoạt</option>
            <option value="false">Tạm ngưng</option>
          </select>
        </div>

        <Button onClick={openCreate}>
          <Plus size={16} />
          <span>Thêm gói dịch vụ mới</span>
        </Button>
      </div>

      {loading && !plans.length ? (
        <LoadingState />
      ) : error && !plans.length ? (
        <ErrorState message={error} retry={fetchPlans} />
      ) : !plans.length ? (
        <EmptyState
          title="Chưa có gói dịch vụ nào"
          description="Bấm 'Thêm gói dịch vụ mới' để tạo cấu hình gói SaaS đầu tiên."
          action={
            <Button onClick={openCreate}>
              <Plus size={16} />
              <span>Tạo gói mới</span>
            </Button>
          }
        />
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Tên gói</th>
                  <th>Mã gói</th>
                  <th>Giá niêm yết</th>
                  <th>Chu kỳ</th>
                  <th>Hạn ngạch cơ sở / phòng / quản lý</th>
                  <th>Dùng thử</th>
                  <th>Tính năng</th>
                  <th>Trạng thái</th>
                  <th style={{ textAlign: "right" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => {
                  const isPro = p.code === "PRO";
                  const isEnterprise = p.code === "ENTERPRISE";

                  return (
                    <tr key={p._id}>
                      <td>
                        <strong style={{ color: "#0f172a", fontSize: 14 }}>{p.name}</strong>
                      </td>
                      <td>
                        <span
                          className={`plan-code-badge ${
                            isPro ? "pro" : isEnterprise ? "enterprise" : ""
                          }`}
                        >
                          {p.code}
                        </span>
                      </td>
                      <td>
                        <strong style={{ color: "#005c55" }}>
                          {p.price === 0 ? "0 ₫ (Miễn phí)" : money(p.price)}
                        </strong>
                      </td>
                      <td>
                        <span style={{ fontSize: 12, color: "#64748b" }}>
                          {p.billingCycle === "YEARLY" ? "Theo Năm" : "Theo Tháng"}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 10, fontSize: 12.5, color: "#334155" }}>
                          <span title="Tối đa cơ sở">
                            <Building2 size={13} style={{ display: "inline", verticalAlign: "middle" }} />{" "}
                            {p.maxBranches >= 999 ? "∞" : p.maxBranches} CS
                          </span>
                          <span title="Tối đa phòng">
                            <DoorOpen size={13} style={{ display: "inline", verticalAlign: "middle" }} />{" "}
                            {p.maxRooms >= 9999 ? "∞" : p.maxRooms} P
                          </span>
                          <span title="Tối đa nhân viên quản lý">
                            <Users size={13} style={{ display: "inline", verticalAlign: "middle" }} />{" "}
                            {p.maxManagers >= 99 ? "∞" : p.maxManagers} QL
                          </span>
                        </div>
                      </td>
                      <td>{p.trialDays ? `${p.trialDays} ngày` : "—"}</td>
                      <td>
                        <div className="features-chips-wrap">
                          {(p.features || []).slice(0, 3).map((feat, idx) => (
                            <span key={idx} className="feature-chip">
                              {feat}
                            </span>
                          ))}
                          {(p.features || []).length > 3 && (
                            <span className="feature-chip" style={{ fontWeight: 600 }}>
                              +{(p.features || []).length - 3}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        {p.isActive ? (
                          <span className="status-pill active">
                            <CheckCircle2 size={11} /> Hoạt động
                          </span>
                        ) : (
                          <span className="status-pill cancelled">
                            <XCircle size={11} /> Tạm ngưng
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div className="admin-row-actions">
                          <button
                            type="button"
                            className="admin-action-btn"
                            onClick={() => openEdit(p)}
                            title="Sửa cấu hình gói"
                          >
                            <Edit2 size={13} />
                            <span>Sửa</span>
                          </button>
                          <button
                            type="button"
                            className="admin-action-btn danger"
                            onClick={() => setDeletingPlan(p)}
                            title="Xóa mềm gói"
                            aria-label={`Xóa mềm gói ${p.name}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination page={page} total={total} limit={20} onChange={(p) => setPage(p)} />
        </>
      )}

      {/* Modal Tạo/Sửa gói SaaS */}
      {(isCreateOpen || editingPlan) && (
        <Modal
          isOpen={true}
          onClose={() => {
            setIsCreateOpen(false);
            setEditingPlan(null);
          }}
          title={editingPlan ? `Chỉnh sửa gói "${editingPlan.name}"` : "Tạo gói SaaS mới"}
          subtitle="Cấu hình hạn ngạch tài nguyên, chu kỳ thanh toán và đơn giá gói"
          maxWidth="640px"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setIsCreateOpen(false);
                  setEditingPlan(null);
                }}
                disabled={submitting}
              >
                Hủy bỏ
              </Button>
              <Button onClick={handleSavePlan} busy={submitting}>
                {editingPlan ? "Lưu thay đổi" : "Tạo gói ngay"}
              </Button>
            </>
          }
        >
          <form className="admin-form" onSubmit={handleSavePlan}>
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>
                  Tên gói dịch vụ <span className="req">*</span>
                </label>
                <input
                  type="text"
                  required
                  className="admin-input"
                  placeholder="Ví dụ: Gói Chuyên Nghiệp"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div className="admin-form-group">
                <label>
                  Mã gói (Code) <span className="req">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={!!editingPlan}
                  className="admin-input"
                  placeholder="Ví dụ: PRO, ENTERPRISE..."
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                />
                <small className="admin-form-help">
                  {editingPlan
                    ? "Mã gói không thể sửa sau khi đã khởi tạo."
                    : "Chữ hoa, số hoặc gạch dưới (VD: STARTER_PLUS)"}
                </small>
              </div>
            </div>

            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>
                  Giá niêm yết (VND) <span className="req">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  required
                  className="admin-input"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
                <small className="admin-form-help">
                  {form.code === "FREE_TRIAL" ? "Gói FREE_TRIAL bắt buộc giá = 0 ₫" : `Hiển thị: ${money(Number(form.price) || 0)}`}
                </small>
              </div>

              <div className="admin-form-group">
                <label>
                  Chu kỳ thanh toán <span className="req">*</span>
                </label>
                <select
                  className="admin-select"
                  style={{ width: "100%", height: 38 }}
                  value={form.billingCycle}
                  onChange={(e) => setForm({ ...form, billingCycle: e.target.value })}
                >
                  <option value="MONTHLY">Hàng tháng (MONTHLY)</option>
                  <option value="YEARLY">Hàng năm (YEARLY)</option>
                </select>
              </div>
            </div>

            {/* Quotas */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              <div className="admin-form-group">
                <label>
                  Tối đa cơ sở <span className="req">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  className="admin-input"
                  value={form.maxBranches}
                  onChange={(e) => setForm({ ...form, maxBranches: e.target.value })}
                />
              </div>

              <div className="admin-form-group">
                <label>
                  Tối đa phòng <span className="req">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  className="admin-input"
                  value={form.maxRooms}
                  onChange={(e) => setForm({ ...form, maxRooms: e.target.value })}
                />
              </div>

              <div className="admin-form-group">
                <label>
                  Tối đa Quản lý <span className="req">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  className="admin-input"
                  value={form.maxManagers}
                  onChange={(e) => setForm({ ...form, maxManagers: e.target.value })}
                />
              </div>
            </div>

            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>Số ngày dùng thử (Trial days)</label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  className="admin-input"
                  value={form.trialDays}
                  onChange={(e) => setForm({ ...form, trialDays: e.target.value })}
                />
              </div>

              <div className="admin-form-group" style={{ justifyContent: "center" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginTop: 18 }}>
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    style={{ width: 17, height: 17, accentColor: "#0f766e" }}
                  />
                  <span>Kích hoạt hiển thị cho khách hàng</span>
                </label>
              </div>
            </div>

            <div className="admin-form-group">
              <label>Danh sách tính năng nổi bật (Mỗi dòng 1 tính năng)</label>
              <textarea
                rows={4}
                className="admin-textarea"
                placeholder="Ví dụ:&#10;Quản lý cơ sở&#10;Tự động tính tiền điện nước&#10;Mã VietQR động"
                value={form.featuresInput}
                onChange={(e) => setForm({ ...form, featuresInput: e.target.value })}
              />
            </div>
          </form>
        </Modal>
      )}

      {/* Modal xác nhận xóa gói */}
      {deletingPlan && (
        <Modal
          isOpen={true}
          onClose={() => setDeletingPlan(null)}
          title="Xác nhận xóa gói dịch vụ"
          maxWidth="460px"
          footer={
            <>
              <Button variant="secondary" onClick={() => setDeletingPlan(null)} disabled={submitting}>
                Không xóa
              </Button>
              <Button variant="danger" onClick={handleDeletePlan} busy={submitting}>
                Xóa mềm gói
              </Button>
            </>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="admin-alert-banner warning">
              <AlertTriangle size={20} style={{ flexShrink: 0 }} />
              <div>
                Bạn có chắc chắn muốn xóa gói <strong>{deletingPlan.name}</strong> ({deletingPlan.code})?
                <br />
                <small>Nếu gói đang có thuê bao ACTIVE sử dụng, hệ thống sẽ từ chối để bảo toàn dịch vụ.</small>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
