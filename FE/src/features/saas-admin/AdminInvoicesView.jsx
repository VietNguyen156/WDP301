import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  CreditCard,
  ExternalLink,
  ShieldCheck,
  Receipt,
  Search,
  DollarSign,
} from "lucide-react";
import { adminApi, errorMessage } from "../../services/api";
import { money } from "../../utils/format";
import { useToast } from "../../context/ToastContext";
import { LoadingState, ErrorState, EmptyState, Button, Modal, Pagination } from "../../components/ui";
import { useLiveRefresh } from "../../hooks/useLiveRefresh";

export function AdminInvoicesView() {
  const toast = useToast();
  const [invoices, setInvoices] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Payment Confirmation Modal
  const [confirmingInvoice, setConfirmingInvoice] = useState(null);
  // Totals over every invoice (GET /admin/invoices summary), for the KPI cards.
  const [summary, setSummary] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [payForm, setPayForm] = useState(() => {
    const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    return {
      paymentReference: "",
      paymentGateway: "BANK_TRANSFER_MANUAL",
      paidAt: now,
      paymentEvidence: "",
    };
  });

  const fetchInvoices = useCallback(async (silent) => {
    if (silent !== true) setLoading(true);
    setError(null);
    try {
      const params = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter;
      const res = await adminApi.listInvoices(params);
      setInvoices(res?.items || []);
      setTotal(res?.total || 0);
      setSummary(res?.summary || null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);
  useLiveRefresh(["admin", "plans", "subscription"], () => fetchInvoices(true));

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const filteredInvoices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter((inv) => {
      const code = `${inv.invoiceCode || ""}`.toLowerCase();
      const ref = `${inv.paymentReference || ""} ${inv.paymentGateway || ""}`.toLowerCase();
      const owner = `${inv.landlordId?.name || ""} ${inv.landlordId?.email || ""}`.toLowerCase();
      const plan = `${inv.planId?.name || ""} ${inv.planId?.code || ""}`.toLowerCase();
      return code.includes(q) || ref.includes(q) || owner.includes(q) || plan.includes(q);
    });
  }, [invoices, searchQuery]);

  const empty = { count: 0, amount: 0 };
  const paid = summary?.paid || empty;
  const pending = summary?.pending || empty;
  const overdue = summary?.overdue || empty;

  function openConfirmModal(inv) {
    setConfirmingInvoice(inv);
    const dateFormatted = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);

    setPayForm({
      paymentReference: "",
      paymentGateway: "BANK_TRANSFER_MANUAL",
      paidAt: dateFormatted,
      paymentEvidence: "",
    });
  }

  async function handleConfirmPayment(e) {
    e.preventDefault();
    if (!payForm.paymentReference.trim()) {
      toast.error("Vui lòng nhập Mã tham chiếu thanh toán.");
      return;
    }
    if (!/^https?:\/\//i.test(payForm.paymentEvidence.trim())) {
      toast.error("Đường dẫn chứng từ thanh toán phải bắt đầu bằng http:// hoặc https://");
      return;
    }
    if (new Date(payForm.paidAt) > new Date()) {
      toast.error("Ngày thanh toán không được ở tương lai.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await adminApi.confirmInvoice(confirmingInvoice._id, {
        paymentReference: payForm.paymentReference.trim(),
        paymentGateway: payForm.paymentGateway.trim(),
        paidAt: new Date(payForm.paidAt).toISOString(),
        paymentEvidence: payForm.paymentEvidence.trim(),
      });

      if (res?.duplicate) {
        toast.info("Hóa đơn này đã được xác nhận thanh toán trước đó với cùng mã tham chiếu.");
      } else {
        toast.success(
          `Xác nhận thu tiền thành công cho hóa đơn ${confirmingInvoice.invoiceCode}! Thuê bao SaaS tương ứng đã được kích hoạt ACTIVE.`,
        );
      }
      setConfirmingInvoice(null);
      fetchInvoices();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="admin-view-body animate-fade-in">
      {/* 1. KPI Summary Strip */}
      <div className="admin-kpi-ribbon">
        <div className="admin-kpi-card">
          <div className="admin-kpi-top">
            <span className="admin-kpi-label">Tổng số Hóa đơn SaaS</span>
            <div className="admin-kpi-icon primary">
              <Receipt size={18} />
            </div>
          </div>
          <div className="admin-kpi-num">{total}</div>
          <div className="admin-kpi-sub primary">
            <span>Khớp bộ lọc hiện tại</span>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-top">
            <span className="admin-kpi-label">Đã thu tiền</span>
            <div className="admin-kpi-icon success">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="admin-kpi-num">{money(paid.amount)}</div>
          <div className="admin-kpi-sub success">
            <CheckCircle2 size={13} />
            <span>{paid.count} hóa đơn đã thu</span>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-top">
            <span className="admin-kpi-label">Chờ thu (chưa đến hạn)</span>
            <div className="admin-kpi-icon warning">
              <Clock size={18} />
            </div>
          </div>
          <div className="admin-kpi-num">{money(pending.amount)}</div>
          <div className="admin-kpi-sub warning">
            <span>{pending.count} hóa đơn còn trong hạn nộp</span>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-top">
            <span className="admin-kpi-label">Quá hạn chưa thu</span>
            <div className="admin-kpi-icon secondary">
              <CreditCard size={18} />
            </div>
          </div>
          <div className="admin-kpi-num" style={overdue.count ? { color: "#dc2626" } : undefined}>
            {money(overdue.amount)}
          </div>
          <div className="admin-kpi-sub secondary">
            <span>
              {overdue.count ? `${overdue.count} hóa đơn cần đôn đốc` : "Không có hóa đơn quá hạn"}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Control Bar */}
      <div className="admin-surface-toolbar">
        <div className="admin-toolbar-left">
          <div className="plans-segmented" role="tablist" aria-label="Lọc trạng thái hóa đơn">
            <button
              type="button"
              className={!statusFilter ? "is-active" : ""}
              onClick={() => {
                setStatusFilter("");
                setPage(1);
              }}
            >
              Tất cả hóa đơn
            </button>
            <button
              type="button"
              className={statusFilter === "PENDING" ? "is-active" : ""}
              onClick={() => {
                setStatusFilter("PENDING");
                setPage(1);
              }}
            >
              Chờ thanh toán
            </button>
            <button
              type="button"
              className={statusFilter === "OVERDUE" ? "is-active" : ""}
              onClick={() => {
                setStatusFilter("OVERDUE");
                setPage(1);
              }}
            >
              Quá hạn
            </button>
            <button
              type="button"
              className={statusFilter === "PAID" ? "is-active" : ""}
              onClick={() => {
                setStatusFilter("PAID");
                setPage(1);
              }}
            >
              Đã thu tiền
            </button>
            <button
              type="button"
              className={statusFilter === "CANCELLED" ? "is-active" : ""}
              onClick={() => {
                setStatusFilter("CANCELLED");
                setPage(1);
              }}
            >
              Đã hủy
            </button>
          </div>
        </div>

        <div className="admin-toolbar-right">
          <div style={{ position: "relative", minWidth: 250 }}>
            <Search
              size={14}
              style={{ position: "absolute", left: 10, top: 10, color: "#94a3b8" }}
            />
            <input
              type="text"
              className="admin-input"
              style={{ paddingLeft: 30, width: "100%" }}
              placeholder="Tìm mã HĐ, chủ trọ, gói, mã GD..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <span style={{ fontSize: 13, color: "#64748b" }}>
            Hiển thị <strong>{filteredInvoices.length}</strong> / <strong>{total}</strong> hóa đơn
          </span>
        </div>
      </div>

      {/* 3. Invoices Table Card */}
      <div className="admin-table-card">
        <div className="admin-card-header">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h2 className="admin-card-title">Sổ cái Hóa đơn Nền tảng (Platform Invoices)</h2>
              <span className="stitch-badge-live">SaaS Billing</span>
            </div>
            <p className="admin-card-subtitle">
              Mỗi hóa đơn phát hành có hạn nộp tiền 7 ngày kể từ ngày lập. Khi đã thu tiền, gói thuê bao có hiệu lực suốt chu kỳ (1 tháng hoặc 1 năm).
            </p>
          </div>
        </div>

        {loading && !invoices.length ? (
          <LoadingState />
        ) : error && !invoices.length ? (
          <ErrorState message={error} retry={fetchInvoices} />
        ) : !filteredInvoices.length ? (
          <EmptyState
            title="Không có hóa đơn SaaS nào"
            description="Chưa có hóa đơn nào khớp với bộ lọc trạng thái hoặc từ khóa tìm kiếm."
          />
        ) : (
          <>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Mã hóa đơn</th>
                    <th>Chủ trọ & Gói SaaS</th>
                    <th>Số tiền</th>
                    <th>Thời hạn hiệu lực gói</th>
                    <th>Hạn nộp hóa đơn</th>
                    <th>Trạng thái</th>
                    <th>Chi tiết thanh toán</th>
                    <th style={{ textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((inv) => {
                    const displayStatus = inv.displayStatus || inv.status;
                    const isPaid = displayStatus === "PAID";
                    const isCancelled = displayStatus === "CANCELLED";
                    const isPendingOrOverdue =
                      displayStatus === "PENDING" || displayStatus === "OVERDUE";
                    const owner = inv.landlordId;
                    const plan = inv.planId;
                    const sub = inv.subscriptionId;

                    return (
                      <tr key={inv._id}>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <strong style={{ color: "#0f172a", fontFamily: "monospace", fontSize: 13 }}>
                              {inv.invoiceCode}
                            </strong>
                            <span style={{ fontSize: 11.5, color: "#64748b" }}>
                              Ngày lập: {new Date(inv.createdAt).toLocaleDateString("vi-VN")}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                            <strong style={{ color: "#0f172a", fontSize: 13 }}>
                              {owner?.name || "Chủ trọ hệ thống"}
                            </strong>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              {plan?.code && (
                                <span className={`plan-code-badge ${plan.code.toLowerCase()}`}>
                                  {plan.code}
                                </span>
                              )}
                              <span style={{ fontSize: 11.5, color: "#64748b" }}>
                                {plan?.name || (inv.billingCycle === "YEARLY" ? "Gói Năm" : "Gói Tháng")}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <strong style={{ color: "#005c55", fontSize: 14 }}>
                            {money(inv.amount || 0)}
                          </strong>
                          <div style={{ fontSize: 11.5, color: "#64748b" }}>
                            {inv.billingCycle === "YEARLY" ? "Chu kỳ 12 tháng" : "Chu kỳ 01 tháng"}
                          </div>
                        </td>
                        <td>
                          {sub?.startDate && sub?.endDate ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12.5 }}>
                              <span>
                                {new Date(sub.startDate).toLocaleDateString("vi-VN")}
                                <span style={{ color: "#94a3b8", margin: "0 4px" }}>→</span>
                                <strong style={{ color: "#0f766e" }}>
                                  {new Date(sub.endDate).toLocaleDateString("vi-VN")}
                                </strong>
                              </span>
                              <span style={{ fontSize: 11, color: "#64748b" }}>
                                Thời hạn sử dụng gói
                              </span>
                            </div>
                          ) : (
                            <span style={{ fontSize: 12.5, color: "#475569" }}>
                              {inv.billingCycle === "YEARLY" ? "01 Năm từ ngày kích hoạt" : "01 Tháng từ ngày kích hoạt"}
                            </span>
                          )}
                        </td>
                        <td>
                          {isPaid ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12 }}>
                              <strong style={{ color: "#047857" }}>Đã tất toán</strong>
                              <span style={{ fontSize: 11, color: "#64748b" }}>
                                Thu ngày: {inv.paidAt ? new Date(inv.paidAt).toLocaleDateString("vi-VN") : "—"}
                              </span>
                            </div>
                          ) : isCancelled ? (
                            <span style={{ fontSize: 12, color: "#94a3b8" }}>Đã hủy</span>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12.5 }}>
                              <span
                                style={{
                                  color: displayStatus === "OVERDUE" ? "#dc2626" : "#334155",
                                  fontWeight: displayStatus === "OVERDUE" ? 700 : 600,
                                }}
                              >
                                {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("vi-VN") : "—"}
                              </span>
                              <span style={{ fontSize: 11, color: "#64748b" }}>
                                Hạn đóng tiền HĐ (7 ngày)
                              </span>
                            </div>
                          )}
                        </td>
                        <td>
                          {displayStatus === "PAID" && (
                            <span className="status-pill paid">
                              <CheckCircle2 size={11} /> Đã thu tiền
                            </span>
                          )}
                          {displayStatus === "PENDING" && (
                            <span className="status-pill pending">
                              <Clock size={11} /> Chờ thanh toán
                            </span>
                          )}
                          {displayStatus === "OVERDUE" && (
                            <span className="status-pill overdue">
                              <AlertTriangle size={11} /> Quá hạn
                            </span>
                          )}
                          {displayStatus === "CANCELLED" && (
                            <span className="status-pill cancelled">
                              <XCircle size={11} /> Đã hủy
                            </span>
                          )}
                        </td>
                        <td>
                          {isPaid ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12 }}>
                              <span>
                                Mã GD: <strong>{inv.paymentReference}</strong>
                              </span>
                              <span style={{ color: "#64748b" }}>
                                Cổng: {inv.paymentGateway} ·{" "}
                                {inv.paidAt ? new Date(inv.paidAt).toLocaleDateString("vi-VN") : ""}
                              </span>
                              {inv.paymentEvidence && (
                                <a
                                  href={inv.paymentEvidence}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 3,
                                    color: "#0f766e",
                                    fontSize: 11.5,
                                    fontWeight: 600,
                                  }}
                                >
                                  <span>Xem chứng từ</span>
                                  <ExternalLink size={10} />
                                </a>
                              )}
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, color: "#94a3b8" }}>Chưa phát sinh thu</span>
                          )}
                        </td>
                        <td className="admin-table-actions">
                          <div className="admin-row-actions">
                            {isPendingOrOverdue && (
                              <button
                                type="button"
                                className="admin-action-btn success"
                                onClick={() => openConfirmModal(inv)}
                                title="Xác nhận đã nhận tiền SaaS qua ngân hàng / tiền mặt"
                              >
                                <ShieldCheck size={13} />
                                <span>Xác nhận đã thu</span>
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

            <div style={{ padding: "12px 16px", borderTop: "1px solid var(--outline-variant)" }}>
              <Pagination page={page} total={total} limit={20} onChange={(p) => setPage(p)} />
            </div>
          </>
        )}
      </div>

      {/* Modal Xác nhận đã nhận tiền SaaS */}
      {confirmingInvoice && (
        <Modal
          isOpen={true}
          onClose={() => setConfirmingInvoice(null)}
          title={`Xác nhận đã thu tiền SaaS: ${confirmingInvoice.invoiceCode}`}
          subtitle={`Số tiền thu: ${money(confirmingInvoice.amount)} (${
            confirmingInvoice.billingCycle === "YEARLY" ? "Thuê bao Năm" : "Thuê bao Tháng"
          })`}
          maxWidth="540px"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setConfirmingInvoice(null)}
                disabled={submitting}
              >
                Hủy bỏ
              </Button>
              <Button onClick={handleConfirmPayment} busy={submitting}>
                Ghi nhận thanh toán & Kích hoạt thuê bao
              </Button>
            </>
          }
        >
          <form className="admin-form" onSubmit={handleConfirmPayment}>
            <div className="admin-alert-banner info">
              <CreditCard size={20} style={{ flexShrink: 0 }} />
              <div>
                Xác nhận thanh toán nghĩa là Admin đã kiểm tra và nhận đủ 100% tổng tiền{" "}
                <strong>{money(confirmingInvoice.amount)}</strong>. Sau khi lưu, Hóa đơn chuyển sang{" "}
                <strong>PAID</strong> và Thuê bao SaaS chuyển sang <strong>ACTIVE</strong> ngay lập tức.
              </div>
            </div>

            <div className="admin-form-group">
              <label>
                Mã tham chiếu thanh toán (Payment Reference) <span className="req">*</span>
              </label>
              <input
                type="text"
                required
                className="admin-input"
                placeholder="Mã giao dịch trên sao kê ngân hàng hoặc mã giao dịch SePay"
                value={payForm.paymentReference}
                onChange={(e) => setPayForm({ ...payForm, paymentReference: e.target.value })}
              />
              <small className="admin-form-help">
                Mã tham chiếu là duy nhất và được lưu trữ kiểm toán để tránh trùng lặp doanh thu.
              </small>
            </div>

            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>
                  Phương thức / Cổng thanh toán <span className="req">*</span>
                </label>
                <select
                  className="admin-select"
                  value={payForm.paymentGateway}
                  onChange={(e) => setPayForm({ ...payForm, paymentGateway: e.target.value })}
                >
                  <option value="BANK_TRANSFER_MANUAL">Chuyển khoản Ngân hàng (Manual)</option>
                  <option value="SEPAY">SePay Webhook</option>
                  <option value="VIETQR">VietQR Động</option>
                  <option value="MOMO">Ví MoMo</option>
                  <option value="VNPAY">Cổng VNPAY</option>
                </select>
              </div>

              <div className="admin-form-group">
                <label>
                  Thời điểm thanh toán <span className="req">*</span>
                </label>
                <input
                  type="datetime-local"
                  required
                  className="admin-input"
                  value={payForm.paidAt}
                  onChange={(e) => setPayForm({ ...payForm, paidAt: e.target.value })}
                />
              </div>
            </div>

            <div className="admin-form-group">
              <label>
                Đường dẫn chứng từ chuyển khoản (URL) <span className="req">*</span>
              </label>
              <input
                type="url"
                required
                className="admin-input"
                placeholder="https://..."
                value={payForm.paymentEvidence}
                onChange={(e) => setPayForm({ ...payForm, paymentEvidence: e.target.value })}
              />
              <small className="admin-form-help">
                Bắt buộc định dạng URL http:// hoặc https:// dẫn đến biên lai hoặc ảnh chụp giao dịch.
              </small>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
