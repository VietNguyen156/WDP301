import React, { useState, useEffect, useCallback } from "react";
import {
  Plus,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  FileText,
} from "lucide-react";
import { adminApi, errorMessage } from "../../services/api";
import { money } from "../../utils/format";
import { useToast } from "../../context/ToastContext";
import {
  LoadingState,
  ErrorState,
  EmptyState,
  Button,
  Modal,
  Pagination,
} from "../../components/ui";

export function AdminSubscriptionsView() {
  const toast = useToast();
  const [subscriptions, setSubscriptions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [expiringFilter, setExpiringFilter] = useState(false);

  // Options for modal
  const [landlordsList, setLandlordsList] = useState([]);
  const [plansList, setPlansList] = useState([]);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingSub, setEditingSub] = useState(null);
  const [cancellingSub, setCancellingSub] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [form, setForm] = useState(() => ({
    landlordId: "",
    planId: "",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  }));

  const fetchSubscriptions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: 20 };
      if (expiringFilter) {
        params.expiringWithinDays = 7;
      } else if (statusFilter) {
        params.status = statusFilter;
      }
      const res = await adminApi.listSubscriptions(params);
      setSubscriptions(res?.items || []);
      setTotal(res?.total || 0);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, expiringFilter]);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  // Load landlords and plans when create modal is opened
  async function loadCreateOptions() {
    try {
      const [lRes, pRes] = await Promise.all([
        adminApi.listLandlords({ limit: 100, status: "ACTIVE" }),
        adminApi.listPlans({ limit: 100, isActive: "true" }),
      ]);
      setLandlordsList(lRes?.items || []);
      const plans = pRes?.items || [];
      setPlansList(plans);
      if (plans.length > 0 && !form.planId) {
        setForm((prev) => ({ ...prev, planId: plans[0]._id }));
      }
      if (lRes?.items?.length > 0 && !form.landlordId) {
        setForm((prev) => ({ ...prev, landlordId: lRes.items[0]._id }));
      }
    } catch (err) {
      toast.error(
        "Không thể tải danh sách Chủ trọ hoặc Gói cước: " + errorMessage(err),
      );
    }
  }

  function openCreate() {
    loadCreateOptions();
    const today = new Date().toISOString().slice(0, 10);
    const monthLater = new Date(Date.now() + 30 * 86400000)
      .toISOString()
      .slice(0, 10);
    setForm({
      landlordId: landlordsList[0]?._id || "",
      planId: plansList[0]?._id || "",
      startDate: today,
      endDate: monthLater,
    });
    setIsCreateOpen(true);
  }

  function openEdit(sub) {
    loadCreateOptions();
    setEditingSub(sub);
    setForm({
      landlordId: sub.landlordId?._id || "",
      planId: sub.planId?._id || "",
      startDate: new Date(sub.startDate).toISOString().slice(0, 10),
      endDate: new Date(sub.endDate).toISOString().slice(0, 10),
    });
  }

  async function handleSaveSubscription(e) {
    e.preventDefault();
    if (!form.landlordId && !editingSub) {
      toast.error("Vui lòng chọn Chủ trọ.");
      return;
    }
    if (!form.planId) {
      toast.error("Vui lòng chọn Gói SaaS.");
      return;
    }
    if (new Date(form.endDate) <= new Date(form.startDate)) {
      toast.error("Ngày kết thúc thuê bao phải sau ngày bắt đầu.");
      return;
    }

    setSubmitting(true);
    try {
      if (!editingSub) {
        await adminApi.createSubscription({
          landlordId: form.landlordId,
          planId: form.planId,
          startDate: form.startDate,
          endDate: form.endDate,
        });
        toast.success(
          "Tạo thuê bao thành công! Đã tự động xuất hóa đơn SaaS (PlatformInvoice) chờ thanh toán.",
        );
        setIsCreateOpen(false);
      } else {
        await adminApi.updateSubscription(editingSub._id, {
          planId: form.planId,
          startDate: form.startDate,
          endDate: form.endDate,
        });
        toast.success(
          "Đã cập nhật thuê bao chờ thanh toán & làm mới hóa đơn tương ứng!",
        );
        setEditingSub(null);
      }
      fetchSubscriptions();
    } catch (err) {
      const msg = errorMessage(err);
      if (msg.includes("PLAN_QUOTA_BELOW_USAGE")) {
        toast.error(
          "Hạ gói thất bại: Số cơ sở, phòng hoặc nhân sự hiện tại của Chủ trọ vượt quá hạn ngạch gói mới.",
        );
      } else if (msg.includes("SUBSCRIPTION_PENDING_EXISTS")) {
        toast.error(
          "Chủ trọ này đã có một thuê bao chờ thanh toán. Vui lòng xử lý hoặc hủy thuê bao chờ cũ trước.",
        );
      } else {
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelSubscription() {
    if (!cancellingSub) return;
    setSubmitting(true);
    try {
      await adminApi.updateSubscription(cancellingSub._id, {
        status: "CANCELLED",
      });
      toast.success(
        "Đã hủy thuê bao thành công. Các hóa đơn chưa thanh toán liên quan đã được hủy.",
      );
      setCancellingSub(null);
      fetchSubscriptions();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="admin-view-body">
      {/* Control Toolbar */}
      <div className="admin-control-bar">
        <div className="admin-filters-left">
          <button
            type="button"
            className={`admin-action-btn ${!statusFilter && !expiringFilter ? "primary" : ""}`}
            onClick={() => {
              setStatusFilter("");
              setExpiringFilter(false);
              setPage(1);
            }}
          >
            Tất cả
          </button>
          <button
            type="button"
            className={`admin-action-btn ${expiringFilter ? "danger" : ""}`}
            onClick={() => {
              setExpiringFilter(true);
              setStatusFilter("");
              setPage(1);
            }}
          >
            <Clock size={13} />
            <span>Hết hạn trong 7 ngày</span>
          </button>
          <button
            type="button"
            className={`admin-action-btn ${statusFilter === "PENDING_PAYMENT" ? "primary" : ""}`}
            onClick={() => {
              setStatusFilter("PENDING_PAYMENT");
              setExpiringFilter(false);
              setPage(1);
            }}
          >
            Chờ thanh toán
          </button>
          <button
            type="button"
            className={`admin-action-btn ${statusFilter === "ACTIVE" ? "primary" : ""}`}
            onClick={() => {
              setStatusFilter("ACTIVE");
              setExpiringFilter(false);
              setPage(1);
            }}
          >
            Đang hoạt động
          </button>
          <button
            type="button"
            className={`admin-action-btn ${statusFilter === "EXPIRED" ? "primary" : ""}`}
            onClick={() => {
              setStatusFilter("EXPIRED");
              setExpiringFilter(false);
              setPage(1);
            }}
          >
            Đã hết hạn
          </button>
          <button
            type="button"
            className={`admin-action-btn ${statusFilter === "CANCELLED" ? "primary" : ""}`}
            onClick={() => {
              setStatusFilter("CANCELLED");
              setExpiringFilter(false);
              setPage(1);
            }}
          >
            Đã hủy
          </button>
        </div>

        <Button onClick={openCreate}>
          <Plus size={16} />
          <span>Tạo / Gia hạn thuê bao</span>
        </Button>
      </div>

      {loading && !subscriptions.length ? (
        <LoadingState />
      ) : error && !subscriptions.length ? (
        <ErrorState message={error} retry={fetchSubscriptions} />
      ) : !subscriptions.length ? (
        <EmptyState
          title="Không tìm thấy thuê bao nào"
          description="Chưa có thuê bao phù hợp bộ lọc hiện tại."
          action={
            <Button onClick={openCreate}>
              <Plus size={16} />
              <span>Tạo thuê bao ngay</span>
            </Button>
          }
        />
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Chủ chuỗi cơ sở</th>
                  <th>Gói dịch vụ</th>
                  <th>Chu kỳ & Giá niêm yết</th>
                  <th>Thực thu</th>
                  <th>Thời hạn thuê bao</th>
                  <th>Trạng thái</th>
                  <th style={{ textAlign: "right" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((sub) => {
                  const owner = sub.landlordId;
                  const plan = sub.planId;
                  const isPending = sub.status === "PENDING_PAYMENT";
                  const isCancelled = sub.status === "CANCELLED";
                  const displayStatus = sub.displayStatus || sub.status;

                  return (
                    <tr key={sub._id}>
                      <td>
                        <div
                          style={{ display: "flex", flexDirection: "column" }}
                        >
                          <strong style={{ color: "#0f172a" }}>
                            {owner?.name || "Chủ trọ"}
                          </strong>
                          <span style={{ fontSize: 12, color: "#64748b" }}>
                            {owner?.email ||
                              owner?.phoneNumber ||
                              sub.landlordId}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <span className="plan-code-badge pro">
                            {plan?.code || "PLAN"}
                          </span>
                          <span style={{ fontWeight: 600 }}>
                            {plan?.name || "Gói SaaS"}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div
                          style={{ display: "flex", flexDirection: "column" }}
                        >
                          <strong style={{ color: "#005c55" }}>
                            {money(sub.quotedPrice || 0)}
                          </strong>
                          <span style={{ fontSize: 11.5, color: "#64748b" }}>
                            {sub.billingCycle === "YEARLY" ? "Năm" : "Tháng"}
                          </span>
                        </div>
                      </td>
                      <td>
                        <strong
                          style={{
                            color: sub.pricePaid > 0 ? "#047857" : "#64748b",
                          }}
                        >
                          {money(sub.pricePaid || 0)}
                        </strong>
                      </td>
                      <td>
                        <div style={{ fontSize: 12.5, color: "#334155" }}>
                          <span>
                            {new Date(sub.startDate).toLocaleDateString(
                              "vi-VN",
                            )}
                          </span>
                          <span style={{ color: "#94a3b8", margin: "0 4px" }}>
                            →
                          </span>
                          <strong
                            style={{
                              color:
                                displayStatus === "EXPIRED"
                                  ? "#dc2626"
                                  : "inherit",
                            }}
                          >
                            {new Date(sub.endDate).toLocaleDateString("vi-VN")}
                          </strong>
                          {sub.startsInFuture && (
                            <span
                              style={{
                                display: "block",
                                fontSize: 11,
                                color: "#0f766e",
                                fontWeight: 600,
                              }}
                            >
                              (Hiệu lực trong tương lai)
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        {displayStatus === "ACTIVE" && (
                          <span className="status-pill active">
                            <CheckCircle2 size={11} /> Hoạt động
                          </span>
                        )}
                        {displayStatus === "PENDING_PAYMENT" && (
                          <span className="status-pill pending">
                            <Clock size={11} /> Chờ thanh toán
                          </span>
                        )}
                        {displayStatus === "EXPIRED" && (
                          <span className="status-pill expired">
                            <AlertTriangle size={11} /> Đã hết hạn
                          </span>
                        )}
                        {displayStatus === "CANCELLED" && (
                          <span className="status-pill cancelled">
                            <XCircle size={11} /> Đã hủy
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div className="admin-row-actions">
                          {isPending && (
                            <button
                              type="button"
                              className="admin-action-btn"
                              onClick={() => openEdit(sub)}
                              title="Sửa gói hoặc thời hạn thuê bao chờ"
                            >
                              <Edit2 size={13} />
                              <span>Sửa</span>
                            </button>
                          )}
                          {!isCancelled && (
                            <button
                              type="button"
                              className="admin-action-btn danger"
                              onClick={() => setCancellingSub(sub)}
                              title="Hủy thuê bao"
                            >
                              <Trash2 size={13} />
                              <span>Hủy</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            total={total}
            limit={20}
            onChange={(p) => setPage(p)}
          />
        </>
      )}

      {/* Modal Tạo / Sửa thuê bao */}
      {(isCreateOpen || editingSub) && (
        <Modal
          isOpen={true}
          onClose={() => {
            setIsCreateOpen(false);
            setEditingSub(null);
          }}
          title={
            editingSub
              ? "Sửa thuê bao chờ thanh toán"
              : "Cấp mới / Gia hạn Thuê bao SaaS"
          }
          subtitle="Tạo kỳ thuê bao và tự động phát hành hóa đơn PlatformInvoice tương ứng"
          maxWidth="560px"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setIsCreateOpen(false);
                  setEditingSub(null);
                }}
                disabled={submitting}
              >
                Hủy bỏ
              </Button>
              <Button onClick={handleSaveSubscription} busy={submitting}>
                {editingSub
                  ? "Cập nhật thuê bao"
                  : "Tạo thuê bao & Xuất hóa đơn"}
              </Button>
            </>
          }
        >
          <form className="admin-form" onSubmit={handleSaveSubscription}>
            <div className="admin-alert-banner info">
              <FileText size={20} style={{ flexShrink: 0 }} />
              <div>
                Hệ thống sẽ tạo thuê bao ở trạng thái{" "}
                <strong>PENDING_PAYMENT</strong> và tự động sinh hóa đơn SaaS
                (PlatformInvoice). Sau khi xác nhận đã nhận thanh toán, thuê bao
                sẽ chuyển sang <strong>ACTIVE</strong>.
              </div>
            </div>

            <div className="admin-form-group">
              <label>
                Chủ chuỗi cơ sở (Landlord) <span className="req">*</span>
              </label>
              <select
                className="admin-select"
                required
                disabled={!!editingSub}
                value={form.landlordId}
                onChange={(e) =>
                  setForm({ ...form, landlordId: e.target.value })
                }
              >
                <option value="">-- Chọn Chủ trọ nhận thuê bao --</option>
                {landlordsList.map((l) => (
                  <option key={l._id} value={l._id}>
                    {l.name} ({l.email || l.username})
                  </option>
                ))}
              </select>
            </div>

            <div className="admin-form-group">
              <label>
                Gói dịch vụ SaaS áp dụng <span className="req">*</span>
              </label>
              <select
                className="admin-select"
                required
                value={form.planId}
                onChange={(e) => {
                  const pId = e.target.value;
                  const selected = plansList.find((p) => p._id === pId);
                  const isYearly = selected?.billingCycle === "YEARLY";
                  const start = new Date(form.startDate || Date.now());
                  const end = new Date(start);
                  if (isYearly) end.setFullYear(end.getFullYear() + 1);
                  else end.setMonth(end.getMonth() + 1);

                  setForm({
                    ...form,
                    planId: pId,
                    endDate: end.toISOString().slice(0, 10),
                  });
                }}
              >
                <option value="">-- Chọn gói SaaS --</option>
                {plansList.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name} ({p.code}) — {money(p.price)} / {p.billingCycle}
                  </option>
                ))}
              </select>
            </div>

            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>
                  Ngày bắt đầu hiệu lực <span className="req">*</span>
                </label>
                <input
                  type="date"
                  required
                  className="admin-input"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm({ ...form, startDate: e.target.value })
                  }
                />
              </div>

              <div className="admin-form-group">
                <label>
                  Ngày kết thúc (Hết hạn) <span className="req">*</span>
                </label>
                <input
                  type="date"
                  required
                  className="admin-input"
                  value={form.endDate}
                  onChange={(e) =>
                    setForm({ ...form, endDate: e.target.value })
                  }
                />
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Hủy thuê bao */}
      {cancellingSub && (
        <Modal
          isOpen={true}
          onClose={() => setCancellingSub(null)}
          title="Xác nhận hủy thuê bao"
          maxWidth="480px"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setCancellingSub(null)}
                disabled={submitting}
              >
                Đóng
              </Button>
              <Button
                variant="danger"
                onClick={handleCancelSubscription}
                busy={submitting}
              >
                Xác nhận hủy thuê bao
              </Button>
            </>
          }
        >
          <div className="admin-alert-banner danger">
            <AlertTriangle size={20} style={{ flexShrink: 0 }} />
            <div>
              Bạn có chắc chắn muốn hủy thuê bao của Chủ trọ{" "}
              <strong>{cancellingSub.landlordId?.name || "Chủ trọ"}</strong>?
              <br />
              <small>
                Mọi hóa đơn chưa trả liên quan sẽ được tự động hủy; các hóa đơn
                đã thanh toán trước đó vẫn được bảo toàn chứng từ.
              </small>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
