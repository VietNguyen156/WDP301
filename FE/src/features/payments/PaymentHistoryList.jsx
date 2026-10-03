import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import { paymentService } from "../../services/paymentService";
import { branchService } from "../../services/branchService";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { UnmatchedPaymentList } from "./UnmatchedPaymentList";
import {
  formatCurrency,
  formatDate,
  getPaymentMethodMeta,
} from "../../utils/formatters";

export function PaymentHistoryList() {
  const { selectedBranchId } = useAuth();
  const { toast } = useToast();

  const [activeSubTab, setActiveSubTab] = useState("ledger"); // "ledger" or "unmatched"
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState([]);

  // Filters
  const [methodFilter, setMethodFilter] = useState("ALL");
  const [branchFilter, setBranchFilter] = useState(selectedBranchId || "");
  const [searchTerm, setSearchTerm] = useState("");

  const loadPayments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await paymentService.getPayments({
        paymentMethod: methodFilter,
        branchId: branchFilter,
      });
      const list = Array.isArray(res) ? res : res?.data || [];
      setPayments(list);
    } catch (err) {
      toast.error(err.message || "Không thể tải danh sách giao dịch thanh toán");
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [methodFilter, branchFilter, toast]);

  useEffect(() => {
    branchService.getBranches().then((data) => {
      if (Array.isArray(data)) setBranches(data);
    });
  }, []);

  useEffect(() => {
    if (activeSubTab === "ledger") {
      loadPayments();
    }
  }, [loadPayments, activeSubTab]);

  // Client search filter
  const filteredPayments = useMemo(() => {
    if (!searchTerm.trim()) return payments;
    const term = searchTerm.toLowerCase();
    return payments.filter(
      (p) =>
        p.referenceCode?.toLowerCase().includes(term) ||
        p.invoiceCode?.toLowerCase().includes(term) ||
        p.payerName?.toLowerCase().includes(term) ||
        p.content?.toLowerCase().includes(term)
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2>Sổ quỹ & Đối soát Thu tiền (Finance & Cash Ledger)</h2>
          <p>Đối soát dòng tiền thu từ VietQR tự động, tiền mặt tại chỗ và xử lý chuyển khoản chưa khớp</p>
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
            onClick={() => setActiveSubTab("ledger")}
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              fontSize: "0.85rem",
              fontWeight: activeSubTab === "ledger" ? "600" : "500",
              backgroundColor: activeSubTab === "ledger" ? "#ffffff" : "transparent",
              color: activeSubTab === "ledger" ? "var(--primary)" : "var(--neutral-600)",
              boxShadow: activeSubTab === "ledger" ? "var(--shadow-sm)" : "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            📋 Sổ quỹ đã khớp ({payments.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("unmatched")}
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              fontSize: "0.85rem",
              fontWeight: activeSubTab === "unmatched" ? "600" : "500",
              backgroundColor: activeSubTab === "unmatched" ? "#ffffff" : "transparent",
              color: activeSubTab === "unmatched" ? "var(--warning-text)" : "var(--neutral-600)",
              boxShadow: activeSubTab === "unmatched" ? "var(--shadow-sm)" : "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            ⚡ Chuyển khoản chưa khớp (SePay)
          </button>
        </div>
      </div>

      {activeSubTab === "unmatched" ? (
        <UnmatchedPaymentList />
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
              <div style={{ fontSize: "0.82rem", color: "var(--neutral-500)", fontWeight: "600" }}>
                TỔNG DÒNG TIỀN THỰC THU
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
                {stats.count} giao dịch đã hoàn tất
              </div>
            </Card>

            <Card>
              <div style={{ fontSize: "0.82rem", color: "var(--neutral-500)", fontWeight: "600" }}>
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
              <div style={{ fontSize: "0.82rem", color: "var(--neutral-500)", fontWeight: "600" }}>
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
              <div style={{ fontSize: "0.82rem", color: "var(--neutral-500)", fontWeight: "600" }}>
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
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                {/* Payment Method Filter */}
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "0.85rem", color: "var(--neutral-600)" }}>Kênh thu:</span>
                  <select
                    value={methodFilter}
                    onChange={(e) => setMethodFilter(e.target.value)}
                    style={{ width: "170px" }}
                  >
                    <option value="ALL">Tất cả hình thức</option>
                    <option value="CASH">Tiền mặt (CASH)</option>
                    <option value="VIETQR">VietQR động</option>
                    <option value="BANK_TRANSFER">Chuyển khoản thường</option>
                  </select>
                </div>

                {/* Branch Filter */}
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "0.85rem", color: "var(--neutral-600)" }}>Cơ sở:</span>
                  <select
                    value={branchFilter}
                    onChange={(e) => setBranchFilter(e.target.value)}
                    style={{ width: "180px" }}
                  >
                    <option value="">Tất cả cơ sở</option>
                    {branches.map((b) => (
                      <option key={b._id || b.id} value={b._id || b.id}>
                        {b.name || b.branchName || `Cơ sở ${b._id || b.id}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Search box & Refresh */}
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input
                  type="text"
                  placeholder="🔍 Tìm mã giao dịch, mã hóa đơn..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ minWidth: "240px" }}
                />
                <Button variant="outline" size="sm" onClick={loadPayments} loading={loading}>
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
                  <th>Mã Hóa đơn</th>
                  <th>Phương thức</th>
                  <th>Thời gian giao dịch</th>
                  <th>Người nộp / Ghi chú</th>
                  <th>Người xác nhận / Gateway</th>
                  <th style={{ textAlign: "right" }}>Số tiền</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: "center", padding: "40px", color: "var(--neutral-500)" }}>
                      ⏳ Đang tải dữ liệu sổ quỹ từ máy chủ...
                    </td>
                  </tr>
                ) : filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: "center", padding: "48px 20px" }}>
                      <div style={{ fontSize: "1.8rem", marginBottom: "8px" }}>📭</div>
                      <div style={{ fontWeight: "600", color: "var(--neutral-700)" }}>
                        Chưa có giao dịch thu tiền nào
                      </div>
                      <div style={{ fontSize: "0.85rem", color: "var(--neutral-500)", marginTop: "4px" }}>
                        Các giao dịch thanh toán qua VietQR hoặc thu tiền mặt sẽ tự động hiển thị tại đây.
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map((p) => {
                    const methodMeta = getPaymentMethodMeta(p.paymentMethod);
                    return (
                      <tr key={p._id || p.id}>
                        <td style={{ fontWeight: "700", fontFamily: "monospace", color: "var(--neutral-900)" }}>
                          {p.referenceCode}
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
                            {p.invoiceCode}
                          </span>
                        </td>
                        <td>
                          <Badge variant={methodMeta.className.replace("badge-", "")}>
                            {methodMeta.label}
                          </Badge>
                        </td>
                        <td style={{ color: "var(--neutral-600)" }}>
                          {formatDate(p.transactionDate || p.createdAt, true)}
                        </td>
                        <td>
                          <div style={{ fontWeight: "500" }}>{p.payerName || "Khách thuê"}</div>
                          {p.note && (
                            <div style={{ fontSize: "0.78rem", color: "var(--neutral-500)" }}>
                              {p.note}
                            </div>
                          )}
                        </td>
                        <td style={{ color: "var(--neutral-600)" }}>
                          {p.confirmedBy
                            ? `Thu ngân (${typeof p.confirmedBy === "object" ? p.confirmedBy.name || p.confirmedBy._id : p.confirmedBy})`
                            : p.gateway || "Hệ thống"}
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            fontWeight: "700",
                            color: "var(--success)",
                            fontSize: "0.95rem",
                          }}
                          className="tnum"
                        >
                          +{formatCurrency(p.amount)}
                        </td>
                        <td>
                          <Badge variant={p.status === "SUCCESS" ? "success" : "neutral"}>
                            {p.status === "SUCCESS" ? "Thành công" : p.status}
                          </Badge>
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
    </div>
  );
}
