import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import { Modal } from "../../components/ui";
import { paymentService } from "../../services/paymentService";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { UnmatchedPaymentList } from "./UnmatchedPaymentList";
import { ExpenseList } from "./ExpenseList";
import {
  formatCurrency,
  formatDate,
  getPaymentMethodMeta,
  getPaymentStatusMeta,
  paymentHandlers,
  paymentPayer,
} from "../../utils/formatters";
import { useLiveRefresh } from "../../hooks/useLiveRefresh";
import { printReceipt } from "./printReceipt";

// Rent & services (invoice payments) and contract deposits are kept in separate histories.
const TABS = ["ledger", "incidents", "deposits", "expenses", "unmatched"];
// Which payment history each tab lists (GET /payments?purpose=...).
const TAB_PURPOSE = { ledger: "INVOICE", incidents: "INCIDENT", deposits: "CONTRACT_DEPOSIT" };

export function PaymentHistoryList() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const [activeSubTab, setActiveSubTab] = useState(
    TABS.includes(requestedTab) ? requestedTab : "ledger",
  );
  const isDeposits = activeSubTab === "deposits";
  const isIncidents = activeSubTab === "incidents";
  function selectTab(tab) {
    setActiveSubTab(tab);
    setPayments([]);
    setSearchParams(tab === "ledger" ? {} : { tab }, { replace: true });
  }
  const tabStyle = (tab, color) => ({
    padding: "6px 14px",
    borderRadius: "6px",
    fontSize: "0.85rem",
    fontWeight: activeSubTab === tab ? "600" : "500",
    backgroundColor: activeSubTab === tab ? "#ffffff" : "transparent",
    color: activeSubTab === tab ? color : "var(--neutral-600)",
    boxShadow: activeSubTab === tab ? "var(--shadow-sm)" : "none",
    border: "none",
    cursor: "pointer",
  });
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [methodFilter, setMethodFilter] = useState("ALL");
  // No global branch switcher: payments of every branch in scope.
  const [branchFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const canReviewCashReports = user?.role === "LANDLORD";
  // Unmatched bank transfers (/payments/unmatched) are landlord-only; tenants/managers would get 403.
  const canReviewUnmatched = user?.role === "LANDLORD";
  // Phiếu chi are internal: landlord and managers only.
  const canSeeExpenses = ["LANDLORD", "PROPERTY_MANAGER"].includes(user?.role);

  const loadPayments = useCallback(async (silent) => {
    try {
      if (silent !== true) setLoading(true);
      const res = await paymentService.getPayments({
        paymentMethod: methodFilter,
        branchId: branchFilter,
        purpose: TAB_PURPOSE[activeSubTab] || "INVOICE",
      });
      const list = Array.isArray(res) ? res : res?.data || [];
      setPayments(list);
    } catch (err) {
      toast.error(
        err.message || "Không thể tải danh sách giao dịch thanh toán",
      );
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [methodFilter, branchFilter, activeSubTab, toast]);
  useLiveRefresh(["payments"], () => loadPayments(true));

  useEffect(() => {
    if (TAB_PURPOSE[activeSubTab]) {
      loadPayments();
    }
  }, [loadPayments, activeSubTab]);


  // One review at a time per row: a double click must not send two approvals.
  const [reviewingId, setReviewingId] = useState(null);
  const [rejecting, setRejecting] = useState(null); // payment being rejected
  const [rejectReason, setRejectReason] = useState("");

  async function approveCashReport(paymentId) {
    if (reviewingId) return;
    setReviewingId(paymentId);
    try {
      await paymentService.confirmCashPayment(paymentId);
      toast.success("Đã duyệt báo cáo thu tiền mặt và cập nhật hóa đơn.");
      loadPayments(true);
    } catch (err) {
      toast.error(err.message || "Không thể duyệt báo cáo thu tiền mặt");
    } finally {
      setReviewingId(null);
    }
  }

  async function rejectCashReport() {
    const paymentId = rejecting?._id || rejecting?.id;
    if (!paymentId || reviewingId || !rejectReason.trim()) return;
    setReviewingId(paymentId);
    try {
      await paymentService.rejectCashPayment(paymentId, rejectReason.trim());
      toast.success("Đã từ chối báo cáo thu tiền mặt.");
      setRejecting(null);
      setRejectReason("");
      loadPayments(true);
    } catch (err) {
      toast.error(err.message || "Không thể từ chối báo cáo thu tiền mặt");
    } finally {
      setReviewingId(null);
    }
  }

  // Client search filter
  const filteredPayments = useMemo(() => {
    if (!searchTerm.trim()) return payments;
    const term = searchTerm.toLowerCase();
    return payments.filter(
      (p) =>
        p.referenceCode?.toLowerCase().includes(term) ||
        p.invoiceCode?.toLowerCase().includes(term) ||
        p.contractCode?.toLowerCase().includes(term) ||
        paymentPayer(p).name.toLowerCase().includes(term) ||
        p.content?.toLowerCase().includes(term),
    );
  }, [payments, searchTerm]);

  // KPI Calculations
  const stats = useMemo(() => {
    let total = 0;
    let cash = 0;
    let vietqr = 0;
    let bank = 0;

    payments.forEach((p) => {
      if (p.status === "SUCCESS") {
        total += p.amount || 0;
        if (p.paymentMethod === "CASH") cash += p.amount || 0;
        else if (p.paymentMethod === "VIETQR") vietqr += p.amount || 0;
        else if (p.paymentMethod === "BANK_TRANSFER") bank += p.amount || 0;
      }
    });

    return { total, cash, vietqr, bank, count: payments.length };
  }, [payments]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Top Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <h2>Sổ quỹ & Đối soát Thu tiền (Finance & Cash Ledger)</h2>
          <p>
            Đối soát dòng tiền thu từ VietQR tự động, tiền mặt tại chỗ và xử lý
            chuyển khoản chưa khớp
          </p>
        </div>

        {/* Sub-tab navigation */}
        <div
          style={{
            display: "flex",
            backgroundColor: "var(--neutral-100)",
            padding: "3px",
            borderRadius: "8px",
            gap: "2px",
          }}
        >
          <button
            type="button"
            onClick={() => selectTab("ledger")}
            style={tabStyle("ledger", "var(--primary)")}
          >
            🧾 Tiền phòng & dịch vụ
          </button>
          <button
            type="button"
            onClick={() => selectTab("incidents")}
            style={tabStyle("incidents", "var(--primary)")}
          >
            🛠 Tiền sửa chữa sự cố
          </button>
          <button
            type="button"
            onClick={() => selectTab("deposits")}
            style={tabStyle("deposits", "var(--primary)")}
          >
            🔐 Tiền cọc
          </button>
          {canSeeExpenses && (
            <button
              type="button"
              onClick={() => selectTab("expenses")}
              style={tabStyle("expenses", "var(--danger, #b91c1c)")}
            >
              💸 Phiếu chi
            </button>
          )}
          {canReviewUnmatched && (
            <button
              type="button"
              onClick={() => selectTab("unmatched")}
              style={tabStyle("unmatched", "var(--warning-text)")}
            >
              ⚡ Chuyển khoản chưa khớp (SePay)
            </button>
          )}
        </div>
      </div>

      {activeSubTab === "unmatched" && canReviewUnmatched ? (
        <UnmatchedPaymentList />
      ) : activeSubTab === "expenses" && canSeeExpenses ? (
        <ExpenseList />
      ) : (
        <>
          {/* KPI Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
            }}
          >
            <Card>
              <div
                style={{
                  fontSize: "0.82rem",
                  color: "var(--neutral-500)",
                  fontWeight: "600",
                }}
              >
                {isDeposits
                  ? "TỔNG TIỀN CỌC ĐÃ NHẬN"
                  : isIncidents
                    ? "TỔNG TIỀN SỬA CHỮA ĐÃ THU"
                    : "TỔNG DÒNG TIỀN THỰC THU"}
              </div>
              <div
                className="tnum"
                style={{
                  fontSize: "1.6rem",
                  fontWeight: "700",
                  color: "var(--primary)",
                  margin: "6px 0 2px 0",
                  fontFamily: "var(--font-heading)",
                }}
              >
                {formatCurrency(stats.total)}
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--neutral-500)" }}>
                {isDeposits
                  ? `${stats.count} hợp đồng · giữ hộ người thuê, không tính doanh thu`
                  : isIncidents
                    ? `${stats.count} giao dịch · người thuê chi trả theo báo giá`
                    : `${stats.count} giao dịch đã hoàn tất`}
              </div>
            </Card>

            <Card>
              <div
                style={{
                  fontSize: "0.82rem",
                  color: "var(--neutral-500)",
                  fontWeight: "600",
                }}
              >
                💵 THU TIỀN MẶT TẠI CHỖ (CASH)
              </div>
              <div
                className="tnum"
                style={{
                  fontSize: "1.6rem",
                  fontWeight: "700",
                  color: "var(--neutral-900)",
                  margin: "6px 0 2px 0",
                  fontFamily: "var(--font-heading)",
                }}
              >
                {formatCurrency(stats.cash)}
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--neutral-500)" }}>
                Thu ngân trực tiếp ký biên nhận
              </div>
            </Card>

            <Card>
              <div
                style={{
                  fontSize: "0.82rem",
                  color: "var(--neutral-500)",
                  fontWeight: "600",
                }}
              >
                📱 QUA VIETQR TỰ ĐỘNG
              </div>
              <div
                className="tnum"
                style={{
                  fontSize: "1.6rem",
                  fontWeight: "700",
                  color: "var(--secondary)",
                  margin: "6px 0 2px 0",
                  fontFamily: "var(--font-heading)",
                }}
              >
                {formatCurrency(stats.vietqr)}
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--neutral-500)" }}>
                Gạch nợ tức thời qua Webhook
              </div>
            </Card>

            <Card>
              <div
                style={{
                  fontSize: "0.82rem",
                  color: "var(--neutral-500)",
                  fontWeight: "600",
                }}
              >
                🏦 CHUYỂN KHOẢN TRỰC TIẾP
              </div>
              <div
                className="tnum"
                style={{
                  fontSize: "1.6rem",
                  fontWeight: "700",
                  color: "var(--neutral-700)",
                  margin: "6px 0 2px 0",
                  fontFamily: "var(--font-heading)",
                }}
              >
                {formatCurrency(stats.bank)}
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--neutral-500)" }}>
                Đối soát sao kê thủ công
              </div>
            </Card>
          </div>

          {/* Filter Toolbar */}
          <Card style={{ padding: "14px 18px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  flexWrap: "wrap",
                }}
              >
                {/* Payment Method Filter */}
                <div
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                >
                  <span
                    style={{ fontSize: "0.85rem", color: "var(--neutral-600)" }}
                  >
                    Kênh thu:
                  </span>
                  <select
                    value={methodFilter}
                    onChange={(e) => setMethodFilter(e.target.value)}
                    style={{ width: "170px" }}
                  >
                    <option value="ALL">Tất cả hình thức</option>
                    <option value="CASH">Tiền mặt (CASH)</option>
                    <option value="VIETQR">VietQR động</option>
                    <option value="BANK_TRANSFER">Chuyển khoản thường</option>
                    <option value="DEPOSIT">Trừ tiền cọc</option>
                  </select>
                </div>
              </div>

              {/* Search box & Refresh */}
              <div
                style={{ display: "flex", gap: "8px", alignItems: "center" }}
              >
                <input
                  type="text"
                  placeholder="🔍 Tìm mã giao dịch, mã hóa đơn..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ minWidth: "240px" }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadPayments()}
                  loading={loading}
                >
                  🔄
                </Button>
              </div>
            </div>
          </Card>

          {/* Payments Table */}
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mã giao dịch / Biên nhận</th>
                  <th>Phòng / Chi nhánh</th>
                  <th>{isDeposits ? "Hợp đồng" : "Mã Hóa đơn"}</th>
                  <th>Phương thức</th>
                  <th>Thời gian giao dịch</th>
                  <th>Người nộp</th>
                  <th>Người thu / duyệt</th>
                  <th style={{ textAlign: "right" }}>Số tiền</th>
                  <th>Trạng thái</th>
                  <th style={{ textAlign: "right" }}>Biên nhận</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan="10"
                      style={{
                        textAlign: "center",
                        padding: "40px",
                        color: "var(--neutral-500)",
                      }}
                    >
                      ⏳ Đang tải dữ liệu sổ quỹ từ máy chủ...
                    </td>
                  </tr>
                ) : filteredPayments.length === 0 ? (
                  <tr>
                    <td
                      colSpan="10"
                      style={{ textAlign: "center", padding: "48px 20px" }}
                    >
                      <div style={{ fontSize: "1.8rem", marginBottom: "8px" }}>
                        📭
                      </div>
                      <div
                        style={{
                          fontWeight: "600",
                          color: "var(--neutral-700)",
                        }}
                      >
                        {isDeposits
                          ? "Chưa có khoản tiền cọc nào"
                          : isIncidents
                            ? "Chưa có khoản thu tiền sửa chữa nào"
                            : "Chưa có giao dịch thu tiền nào"}
                      </div>
                      <div
                        style={{
                          fontSize: "0.85rem",
                          color: "var(--neutral-500)",
                          marginTop: "4px",
                        }}
                      >
                        {isDeposits
                          ? "Tiền cọc nhận qua chuyển khoản hoặc do chủ trọ xác nhận trong hợp đồng sẽ hiển thị tại đây."
                          : isIncidents
                            ? "Hóa đơn sửa chữa sự cố (người thuê chịu phí) trả bằng chuyển khoản hoặc tiền mặt sẽ hiển thị tại đây."
                            : "Các giao dịch thanh toán qua VietQR hoặc thu tiền mặt sẽ tự động hiển thị tại đây."}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map((p) => {
                    const methodMeta = getPaymentMethodMeta(p.paymentMethod);
                    const statusMeta = getPaymentStatusMeta(p.status);
                    const rowId = p._id || p.id;
                    const payer = paymentPayer(p);
                    const rawRoom =
                      p.invoiceId?.roomId?.roomNumber ||
                      p.contractId?.roomId?.roomNumber ||
                      p.roomNumber;
                    const roomLabel = rawRoom
                      ? /^(P\.|Phòng)/i.test(String(rawRoom))
                        ? rawRoom
                        : `P.${rawRoom}`
                      : "—";
                    const branchLabel =
                      p.branchId?.name ||
                      p.invoiceId?.branchId?.name ||
                      p.contractId?.branchId?.name ||
                      "";
                    return (
                      <tr key={rowId}>
                        <td
                          style={{
                            fontWeight: "700",
                            fontFamily: "monospace",
                            color: "var(--neutral-900)",
                          }}
                        >
                          {p.referenceCode}
                        </td>
                        <td>
                          <strong>{roomLabel}</strong>
                          {branchLabel && (
                            <span
                              style={{
                                color: "var(--neutral-500)",
                                fontSize: "0.78rem",
                                marginLeft: "4px",
                              }}
                            >
                              ({branchLabel})
                            </span>
                          )}
                        </td>
                        <td>
                          <span
                            style={{
                              fontWeight: "600",
                              color: "var(--primary)",
                              backgroundColor: "var(--primary-subtle)",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              fontSize: "0.82rem",
                            }}
                          >
                            {isDeposits ? p.contractCode : p.invoiceCode}
                          </span>
                        </td>
                        <td>
                          <Badge
                            variant={methodMeta.className.replace("badge-", "")}
                          >
                            {methodMeta.label}
                          </Badge>
                        </td>
                        <td style={{ color: "var(--neutral-600)" }}>
                          {formatDate(p.transactionDate || p.createdAt, true)}
                        </td>
                        <td>
                          <div style={{ fontWeight: "600" }}>{payer.name}</div>
                          <div style={{ fontSize: "0.78rem", color: "var(--neutral-500)" }}>
                            {[
                              payer.onBehalfOf && `Nộp thay cho ${payer.onBehalfOf}`,
                              payer.phone,
                              payer.place,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                          {p.note && (
                            <div
                              style={{
                                fontSize: "0.78rem",
                                color: "var(--neutral-500)",
                                fontStyle: "italic",
                              }}
                            >
                              Ghi chú: {p.note}
                            </div>
                          )}
                        </td>
                        <td style={{ fontSize: "0.82rem", color: "var(--neutral-600)" }}>
                          {paymentHandlers(p).map((line) => (
                            <div key={line.label}>
                              <span style={{ color: "var(--neutral-500)" }}>{line.label}: </span>
                              <span style={{ fontWeight: 500, color: "var(--neutral-800)" }}>{line.value}</span>
                            </div>
                          ))}
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            fontWeight: "700",
                            // Only SUCCESS reached the invoice; pending / rejected rows are not money in.
                            color: statusMeta.counted ? "var(--success)" : "var(--neutral-500)",
                            textDecoration: p.status === "FAILED" ? "line-through" : undefined,
                            fontSize: "0.95rem",
                          }}
                          className="tnum"
                        >
                          {statusMeta.counted ? "+" : ""}
                          {formatCurrency(p.amount)}
                        </td>
                        <td>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              flexWrap: "wrap",
                            }}
                          >
                            <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                            {canReviewCashReports &&
                              p.status === "PENDING_CONFIRMATION" && (
                                <>
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    loading={reviewingId === rowId}
                                    disabled={!!reviewingId}
                                    onClick={() => approveCashReport(rowId)}
                                  >
                                    Duyệt thu tiền
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={!!reviewingId}
                                    onClick={() => {
                                      setRejecting(p);
                                      setRejectReason("");
                                    }}
                                  >
                                    Từ chối
                                  </Button>
                                </>
                              )}
                          </div>
                          {p.status === "FAILED" && p.reviewNote && (
                            <div style={{ fontSize: "0.75rem", color: "var(--neutral-500)", marginTop: "4px" }}>
                              Lý do: {p.reviewNote}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {p.status === "SUCCESS" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (!printReceipt(p))
                                  toast.error("Trình duyệt đã chặn cửa sổ in, hãy cho phép popup rồi thử lại.");
                              }}
                            >
                              🖨 In
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal
        padded
        isOpen={!!rejecting}
        onClose={() => !reviewingId && setRejecting(null)}
        title="Từ chối báo cáo thu tiền mặt"
        maxWidth="500px"
        subtitle={
          rejecting
            ? `${rejecting.referenceCode} · ${rejecting.invoiceCode} · ${formatCurrency(rejecting.amount)}`
            : ""
        }
        footer={
          <div style={{ display: "flex", gap: "10px", width: "100%", justifyContent: "flex-end" }}>
            <Button variant="outline" onClick={() => setRejecting(null)} disabled={!!reviewingId}>
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={rejectCashReport}
              loading={!!reviewingId}
              disabled={!rejectReason.trim()}
            >
              Từ chối
            </Button>
          </div>
        }
      >
        <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
          Lý do từ chối
        </label>
        <textarea
          rows={3}
          maxLength={1000}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="VD: Chưa nhận được tiền từ quản lý, sai số tiền..."
          style={{ width: "100%" }}
        />
        <p style={{ fontSize: "0.78rem", color: "var(--neutral-500)", marginTop: "6px" }}>
          Hóa đơn không thay đổi. Quản lý có thể báo thu lại bằng số biên lai khác.
        </p>
      </Modal>
    </div>
  );
}
