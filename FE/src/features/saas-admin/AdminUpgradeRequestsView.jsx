import React, { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2,
  Clock,
  XCircle,
  Ban,
  ArrowRight,
  Receipt,
  Info,
} from "lucide-react";
import { adminApi, errorMessage } from "../../services/api";
import { money } from "../../utils/format";
import { useToast } from "../../context/ToastContext";
import { LoadingState, ErrorState, EmptyState, Button, Modal, Pagination } from "../../components/ui";

const STATUS_FILTERS = [
  { value: "PENDING", label: "Chờ duyệt", icon: Clock },
  { value: "APPROVED", label: "Đã duyệt", icon: CheckCircle2 },
  { value: "REJECTED", label: "Đã từ chối", icon: XCircle },
  { value: "CANCELLED", label: "Chủ trọ đã hủy", icon: Ban },
];

const STATUS_PILLS = {
  PENDING: { className: "pending", icon: Clock, label: "Chờ duyệt" },
  APPROVED: { className: "paid", icon: CheckCircle2, label: "Đã duyệt" },
  REJECTED: { className: "overdue", icon: XCircle, label: "Đã từ chối" },
  CANCELLED: { className: "cancelled", icon: Ban, label: "Chủ trọ đã hủy" },
};

const localDate = (date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

// Same default as the backend: from today for one billing cycle of the requested plan.
function defaultPeriod(plan) {
  const start = new Date();
  const end = new Date(start);
  if (plan?.billingCycle === "YEARLY") end.setFullYear(end.getFullYear() + 1);
  else end.setMonth(end.getMonth() + 1);
  return { startDate: localDate(start), endDate: localDate(end) };
}

const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : "—";

function PlanCell({ plan, muted }) {
  if (!plan) return <span style={{ fontSize: 12, color: "#94a3b8" }}>Chưa có gói</span>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <strong style={{ color: muted ? "#475569" : "#0f172a", fontSize: 13 }}>{plan.name}</strong>
      <span style={{ fontSize: 11.5, color: "#64748b" }}>
        {plan.code} · {money(plan.price || 0)}
        {plan.billingCycle ? ` / ${plan.billingCycle === "YEARLY" ? "năm" : "tháng"}` : ""}
      </span>
    </div>
  );
}

export function AdminUpgradeRequestsView({ onNavigateTab }) {
  const toast = useToast();
  const [requests, setRequests] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("PENDING");

  const [approving, setApproving] = useState(null);
  const [period, setPeriod] = useState({ startDate: "", endDate: "" });
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.listUpgradeRequests({ status: statusFilter, page, limit: 20 });
      setRequests(res?.items || []);
      setTotal(res?.total || 0);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  function openApprove(request) {
    setApproving(request);
    setPeriod(defaultPeriod(request.planId));
  }

  async function handleApprove(e) {
    e?.preventDefault();
    if (!period.startDate || !period.endDate) {
      toast.error("Vui lòng chọn ngày bắt đầu và ngày kết thúc thuê bao.");
      return;
    }
    if (period.endDate <= period.startDate) {
      toast.error("Ngày kết thúc thuê bao phải sau ngày bắt đầu.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await adminApi.approveUpgradeRequest(approving._id, {
        startDate: period.startDate,
        endDate: period.endDate,
      });
      toast.success(
        `Đã duyệt yêu cầu của ${approving.landlordId?.name || "chủ trọ"}. Hóa đơn SaaS ${
          res?.invoice?.invoiceCode || ""
        } đang chờ thanh toán.`
      );
      setApproving(null);
      fetchRequests();
    } catch (err) {
      const msg = errorMessage(err);
      if (msg.includes("PLAN_QUOTA_BELOW_USAGE")) {
        toast.error("Không thể duyệt: tài nguyên chủ trọ đang dùng vượt hạn ngạch của gói được yêu cầu.");
      } else if (msg.includes("SUBSCRIPTION_PENDING_EXISTS")) {
        toast.error("Chủ trọ đang có một thuê bao chờ thanh toán. Hãy xử lý hoặc hủy thuê bao đó trước.");
      } else {
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReject(e) {
    e?.preventDefault();
    if (!reason.trim()) {
      toast.error("Vui lòng nhập lý do từ chối để gửi lại cho chủ trọ.");
      return;
    }
    setSubmitting(true);
    try {
      await adminApi.rejectUpgradeRequest(rejecting._id, { reason: reason.trim() });
      toast.success(`Đã từ chối yêu cầu của ${rejecting.landlordId?.name || "chủ trọ"}.`);
      setRejecting(null);
      setReason("");
      fetchRequests();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="admin-view-body">
      {/* Control Bar */}
      <div className="admin-control-bar">
        <div className="admin-filters-left">
          {STATUS_FILTERS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              className={`admin-action-btn ${statusFilter === value ? "primary" : ""}`}
              onClick={() => {
                setStatusFilter(value);
                setPage(1);
              }}
            >
              <Icon size={13} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div style={{ fontSize: 13, color: "#64748b" }}>
          Tổng số yêu cầu: <strong>{total}</strong>
        </div>
      </div>

      {statusFilter === "PENDING" && (
        <div className="admin-alert-banner info" style={{ marginBottom: 16 }}>
          <Info size={20} style={{ flexShrink: 0 }} />
          <div>
            Duyệt yêu cầu sẽ tạo <strong>thuê bao chờ thanh toán</strong> và <strong>hóa đơn SaaS</strong>{" "}
            cho chủ trọ. Gói mới chỉ có hiệu lực sau khi hóa đơn được thanh toán (qua cổng SePay hoặc xác
            nhận thủ công ở tab Hóa đơn).
          </div>
        </div>
      )}

      {loading && !requests.length ? (
        <LoadingState />
      ) : error && !requests.length ? (
        <ErrorState message={error} retry={fetchRequests} />
      ) : !requests.length ? (
        <EmptyState
          title="Không có yêu cầu đổi gói nào"
          description={
            statusFilter === "PENDING"
              ? "Chưa có chủ trọ nào gửi yêu cầu nâng cấp hoặc đổi gói đang chờ xử lý."
              : "Chưa có yêu cầu nào khớp với bộ lọc trạng thái được chọn."
          }
        />
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Chủ trọ</th>
                  <th>Gói hiện tại → Gói yêu cầu</th>
                  <th>Hạn ngạch gói yêu cầu</th>
                  <th>Ghi chú</th>
                  <th>Thời gian</th>
                  <th>Trạng thái</th>
                  <th style={{ textAlign: "right" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => {
                  const landlord = request.landlordId;
                  const plan = request.planId;
                  const pill = STATUS_PILLS[request.status] || STATUS_PILLS.PENDING;
                  const PillIcon = pill.icon;
                  const isRenewal =
                    request.currentPlanId && plan && String(request.currentPlanId._id) === String(plan._id);
                  return (
                    <tr key={request._id}>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <strong style={{ color: "#0f172a", fontSize: 13 }}>{landlord?.name || "—"}</strong>
                          <span style={{ fontSize: 11.5, color: "#64748b" }}>{landlord?.email}</span>
                          {landlord?.phoneNumber && (
                            <span style={{ fontSize: 11.5, color: "#64748b" }}>{landlord.phoneNumber}</span>
                          )}
                          {landlord?.status && landlord.status !== "ACTIVE" && (
                            <span className="status-pill suspended" style={{ width: "fit-content" }}>
                              {landlord.status}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <PlanCell plan={request.currentPlanId} muted />
                          <ArrowRight size={14} color="#94a3b8" style={{ flexShrink: 0 }} />
                          <PlanCell plan={plan} />
                        </div>
                        {isRenewal && (
                          <span style={{ fontSize: 11.5, color: "#0f766e", fontWeight: 600 }}>Gia hạn gói đang dùng</span>
                        )}
                      </td>
                      <td>
                        {plan ? (
                          <span style={{ fontSize: 12, color: "#475569" }}>
                            {plan.maxBranches} cơ sở · {plan.maxRooms} phòng · {plan.maxManagers} quản lý
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td style={{ maxWidth: 220 }}>
                        <span style={{ fontSize: 12.5, color: "#334155" }}>{request.note || "—"}</span>
                        {request.status === "REJECTED" && request.rejectReason && (
                          <div style={{ fontSize: 11.5, color: "#dc2626", marginTop: 4 }}>
                            Lý do từ chối: {request.rejectReason}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12 }}>
                          <span>Gửi: {formatDateTime(request.createdAt)}</span>
                          {request.handledAt && (
                            <span style={{ color: "#64748b" }}>Xử lý: {formatDateTime(request.handledAt)}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`status-pill ${pill.className}`}>
                          <PillIcon size={11} /> {pill.label}
                        </span>
                      </td>
                      <td className="admin-table-actions">
                        {request.status === "PENDING" && (
                          <>
                            <button
                              type="button"
                              className="admin-action-btn success"
                              onClick={() => openApprove(request)}
                              title="Duyệt và xuất hóa đơn SaaS chờ thanh toán"
                            >
                              <CheckCircle2 size={13} />
                              <span>Duyệt</span>
                            </button>
                            <button
                              type="button"
                              className="admin-action-btn danger"
                              onClick={() => {
                                setRejecting(request);
                                setReason("");
                              }}
                              title="Từ chối kèm lý do"
                            >
                              <XCircle size={13} />
                              <span>Từ chối</span>
                            </button>
                          </>
                        )}
                        {request.status === "APPROVED" && onNavigateTab && (
                          <button
                            type="button"
                            className="admin-action-btn"
                            onClick={() => onNavigateTab("invoices")}
                            title="Xem hóa đơn SaaS đã xuất"
                          >
                            <Receipt size={13} />
                            <span>Xem hóa đơn</span>
                          </button>
                        )}
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

      {/* Modal Duyệt yêu cầu */}
      {approving && (
        <Modal
          isOpen={true}
          onClose={() => setApproving(null)}
          title={`Duyệt yêu cầu đổi gói: ${approving.landlordId?.name || ""}`}
          subtitle={`Gói yêu cầu: ${approving.planId?.name || ""} · ${money(approving.planId?.price || 0)}`}
          maxWidth="540px"
          footer={
            <>
              <Button variant="secondary" onClick={() => setApproving(null)} disabled={submitting}>
                Hủy bỏ
              </Button>
              <Button onClick={handleApprove} busy={submitting}>
                Duyệt & Xuất hóa đơn SaaS
              </Button>
            </>
          }
        >
          <form className="admin-form" onSubmit={handleApprove}>
            <div className="admin-alert-banner info">
              <Receipt size={20} style={{ flexShrink: 0 }} />
              <div>
                Hệ thống sẽ tạo thuê bao <strong>{approving.planId?.name}</strong> ở trạng thái{" "}
                <strong>chờ thanh toán</strong> và hóa đơn SaaS <strong>{money(approving.planId?.price || 0)}</strong>.
                Chủ trọ vẫn dùng gói hiện tại cho tới khi hóa đơn được thanh toán.
              </div>
            </div>

            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>
                  Ngày bắt đầu <span className="req">*</span>
                </label>
                <input
                  type="date"
                  required
                  className="admin-input"
                  value={period.startDate}
                  onChange={(e) => setPeriod({ ...period, startDate: e.target.value })}
                />
              </div>
              <div className="admin-form-group">
                <label>
                  Ngày kết thúc <span className="req">*</span>
                </label>
                <input
                  type="date"
                  required
                  className="admin-input"
                  value={period.endDate}
                  onChange={(e) => setPeriod({ ...period, endDate: e.target.value })}
                />
              </div>
            </div>
            <small className="admin-form-help">
              Mặc định từ hôm nay đến hết một chu kỳ của gói (
              {approving.planId?.billingCycle === "YEARLY" ? "1 năm" : "1 tháng"}).
            </small>
          </form>
        </Modal>
      )}

      {/* Modal Từ chối yêu cầu */}
      {rejecting && (
        <Modal
          isOpen={true}
          onClose={() => setRejecting(null)}
          title={`Từ chối yêu cầu đổi gói: ${rejecting.landlordId?.name || ""}`}
          subtitle={`Gói yêu cầu: ${rejecting.planId?.name || ""}`}
          maxWidth="520px"
          footer={
            <>
              <Button variant="secondary" onClick={() => setRejecting(null)} disabled={submitting}>
                Hủy bỏ
              </Button>
              <Button variant="danger" onClick={handleReject} busy={submitting}>
                Xác nhận từ chối
              </Button>
            </>
          }
        >
          <form className="admin-form" onSubmit={handleReject}>
            <div className="admin-alert-banner warning">
              <Info size={20} style={{ flexShrink: 0 }} />
              <div>Chủ trọ sẽ thấy lý do này trong lịch sử yêu cầu và có thể gửi lại yêu cầu mới.</div>
            </div>
            <div className="admin-form-group">
              <label>
                Lý do từ chối <span className="req">*</span>
              </label>
              <textarea
                className="admin-textarea"
                rows={4}
                maxLength={1000}
                required
                placeholder="VD: Vui lòng xác minh thông tin doanh nghiệp trước khi nâng cấp gói Doanh nghiệp..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
