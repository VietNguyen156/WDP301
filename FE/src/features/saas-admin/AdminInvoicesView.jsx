import React, { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  CreditCard,
  ExternalLink,
  ShieldCheck,
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

  // Payment Confirmation Modal
  const [confirmingInvoice, setConfirmingInvoice] = useState(null);
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
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);
  useLiveRefresh(["admin","plans","subscription"], () => fetchInvoices(true));

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  function openConfirmModal(inv) {
    setConfirmingInvoice(inv);
    const dateFormatted = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    setPayForm({
      paymentReference: `SAAS-BANK-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomSuffix}`,
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
          `Xác nhận thu tiền thành công cho hóa đơn ${confirmingInvoice.invoiceCode}! Thuê bao SaaS tương ứng đã được kích hoạt ACTIVE.`
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
    <div className="admin-view-body">
      {/* Control Bar */}
      <div className="admin-control-bar">
        <div className="admin-filters-left">
          <button
            type="button"
            className={`admin-action-btn ${!statusFilter ? "primary" : ""}`}
            onClick={() => {
              setStatusFilter("");
              setPage(1);
            }}
          >
            Tất cả hóa đơn
          </button>
          <button
            type="button"
            className={`admin-action-btn ${statusFilter === "PENDING" ? "primary" : ""}`}
            onClick={() => {
              setStatusFilter("PENDING");
              setPage(1);
            }}
          >
            <Clock size={13} />
            <span>Chờ thanh toán</span>
          </button>
          <button
            type="button"
            className={`admin-action-btn ${statusFilter === "OVERDUE" ? "danger" : ""}`}
            onClick={() => {
              setStatusFilter("OVERDUE");
              setPage(1);
            }}
          >
            <AlertTriangle size={13} />
            <span>Quá hạn</span>
          </button>
          <button
            type="button"
            className={`admin-action-btn ${statusFilter === "PAID" ? "primary" : ""}`}
            onClick={() => {
              setStatusFilter("PAID");
              setPage(1);
            }}
          >
            <CheckCircle2 size={13} />
            <span>Đã thu tiền</span>
          </button>
          <button
            type="button"
            className={`admin-action-btn ${statusFilter === "CANCELLED" ? "primary" : ""}`}
            onClick={() => {
              setStatusFilter("CANCELLED");
              setPage(1);
            }}
          >
            <span>Đã hủy</span>
          </button>
        </div>

        <div style={{ fontSize: 13, color: "#64748b" }}>
          Tổng số hóa đơn: <strong>{total}</strong>
        </div>
      </div>

      {loading && !invoices.length ? (
        <LoadingState />
      ) : error && !invoices.length ? (
        <ErrorState message={error} retry={fetchInvoices} />
      ) : !invoices.length ? (
        <EmptyState
          title="Không có hóa đơn SaaS nào"
          description="Chưa có hóa đơn nào khớp với bộ lọc trạng thái được chọn."
        />
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Mã hóa đơn</th>
                  <th>Số tiền</th>
                  <th>Chu kỳ</th>
                  <th>Hạn thanh toán</th>
                  <th>Trạng thái</th>
                  <th>Chi tiết thanh toán</th>
                  <th style={{ textAlign: "right" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const displayStatus = inv.displayStatus || inv.status;
                  const isPaid = displayStatus === "PAID";
                  const isPendingOrOverdue =
                    displayStatus === "PENDING" || displayStatus === "OVERDUE";

                  return (
                    <tr key={inv._id}>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <strong style={{ color: "#0f172a", fontFamily: "monospace", fontSize: 13 }}>
                            {inv.invoiceCode}
                          </strong>
                          <span style={{ fontSize: 11.5, color: "#64748b" }}>
                            Tạo: {new Date(inv.createdAt).toLocaleDateString("vi-VN")}
                          </span>
                        </div>
                      </td>
                      <td>
                        <strong style={{ color: "#005c55", fontSize: 14 }}>
                          {money(inv.amount || 0)}
                        </strong>
                      </td>
                      <td>
                        <span style={{ fontSize: 12.5, color: "#475569" }}>
                          {inv.billingCycle === "YEARLY" ? "Năm" : "Tháng"}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: 12.5 }}>
                          <span
                            style={{
                              color: displayStatus === "OVERDUE" ? "#dc2626" : "#334155",
                              fontWeight: displayStatus === "OVERDUE" ? 700 : 500,
                            }}
                          >
                            {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("vi-VN") : "—"}
                          </span>
                        </div>
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
                placeholder="VD: SAAS-VCB-20261014-001 hoặc Mã giao dịch SePay..."
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
