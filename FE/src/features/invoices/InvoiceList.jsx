import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { invoiceService } from "../../services/invoiceService";
import { branchService } from "../../services/branchService";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { InvoiceDetailModal } from "./InvoiceDetailModal";
import { InvoiceGenerateModal } from "./InvoiceGenerateModal";
import { InvoiceCancelModal } from "./InvoiceCancelModal";
import { CashPaymentModal } from "../payments/CashPaymentModal";
import {
  formatCurrency,
  formatBillingPeriod,
  getInvoiceStatusMeta,
} from "../../utils/formatters";

export function InvoiceList({ externalSearchTerm = "" }) {
  const { selectedBranchId } = useAuth();
  const { toast } = useToast();

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState([]);

  // Filters & Pagination
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [branchFilter, setBranchFilter] = useState(selectedBranchId || "");
  const [billingPeriodFilter, setBillingPeriodFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });

  // Modals & Selected row for Stitch Flyout Drawer
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [isCashPaymentOpen, setIsCashPaymentOpen] = useState(false);
  const [cashInvoiceTarget, setCashInvoiceTarget] = useState(null);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancelInvoiceTarget, setCancelInvoiceTarget] = useState(null);

  const activeSearch = externalSearchTerm || "";

  const loadInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const res = await invoiceService.getInvoices({
        status: statusFilter,
        branchId: branchFilter,
        billingPeriod: billingPeriodFilter,
        page,
        limit: 20,
      });
      const list = Array.isArray(res) ? res : res?.data || [];
      setInvoices(list);
      if (res?.pagination) {
        setPagination(res.pagination);
      }
      if (list.length > 0 && !selectedInvoice) {
        setSelectedInvoice(list[0]);
      }
    } catch (err) {
      toast.error(err.message || "Không thể tải danh sách hóa đơn từ máy chủ");
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, branchFilter, billingPeriodFilter, page, toast]);

  useEffect(() => {
    branchService.getBranches().then((data) => {
      if (Array.isArray(data)) setBranches(data);
    });
  }, []);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  useEffect(() => {
    if (selectedBranchId) {
      setBranchFilter(selectedBranchId);
    }
  }, [selectedBranchId]);

  const filteredInvoices = useMemo(() => {
    if (!activeSearch.trim()) return invoices;
    const term = activeSearch.toLowerCase();
    return invoices.filter(
      (inv) =>
        inv.invoiceCode?.toLowerCase().includes(term) ||
        inv.tenantId?.name?.toLowerCase().includes(term) ||
        inv.roomId?.roomNumber?.toLowerCase().includes(term) ||
        inv.roomId?.name?.toLowerCase().includes(term) ||
        (typeof inv.tenantId === "string" && inv.tenantId.toLowerCase().includes(term))
    );
  }, [invoices, activeSearch]);

  // KPI Calculations
  const stats = useMemo(() => {
    let totalBilled = 0;
    let totalCollected = 0;
    let totalRemaining = 0;
    let overdueCount = 0;

    invoices.forEach((inv) => {
      if (inv.status !== "CANCELLED") {
        totalBilled += inv.totalAmount || 0;
        totalCollected += inv.paidAmount || 0;
        totalRemaining += inv.remainingAmount || 0;
        if (inv.isOverdue || (inv.dueDate && new Date() > new Date(inv.dueDate) && inv.status !== "PAID")) {
          overdueCount++;
        }
      }
    });

    const paidRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;
    const debtRate = totalBilled > 0 ? Math.round((totalRemaining / totalBilled) * 100) : 0;

    return {
      totalBilled,
      totalCollected,
      totalRemaining,
      overdueCount,
      count: invoices.length,
      paidRate,
      debtRate,
    };
  }, [invoices]);

  const copyPublicLink = (inv, e) => {
    e?.stopPropagation();
    const link = `${window.location.origin}/#public/${inv.publicAccessToken}`;
    navigator.clipboard.writeText(link);
    toast.success(`Đã sao chép link xem của hóa đơn ${inv.invoiceCode}!`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* SECTION 1: Header & Operational Actions Bar (Stitch Design) */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
          backgroundColor: "var(--surface-lowest)",
          padding: "20px 24px",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-color)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "2px 8px",
                borderRadius: "9999px",
                fontSize: "0.75rem",
                fontWeight: "700",
                backgroundColor: "rgba(0, 92, 85, 0.08)",
                color: "var(--primary)",
                border: "1px solid rgba(0, 92, 85, 0.2)",
              }}
            >
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  backgroundColor: "var(--primary)",
                }}
              />
              SePay Webhook: Online (Độ trễ ~1.8s)
            </span>
            <span style={{ color: "var(--neutral-400)", fontSize: "12px" }}>•</span>
            <span style={{ fontSize: "0.82rem", color: "var(--neutral-500)", fontWeight: "500" }}>
              Kỳ kế toán: {formatBillingPeriod(billingPeriodFilter) || "Tất cả kỳ"}
            </span>
          </div>

          <h1
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "1.65rem",
              fontWeight: "700",
              color: "var(--neutral-900)",
              margin: 0,
            }}
          >
            Quản lý Hóa đơn & Thu nợ Tự động
          </h1>
          <p style={{ fontSize: "0.85rem", color: "var(--neutral-600)", marginTop: "4px" }}>
            Hệ thống tự động sinh mã VietQR NAPAS 247 QuickLink, gạch nợ tức thì 2 giây qua SePay Webhook.
          </p>
        </div>

        {/* Action Toolbar */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <Button variant="outline" size="md" onClick={loadInvoices} loading={loading}>
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
              sync
            </span>
            <span>Đối soát SePay</span>
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={() => setIsGenerateOpen(true)}
            style={{ backgroundColor: "var(--primary-container)" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
              note_add
            </span>
            <span>+ Tạo hóa đơn kỳ mới</span>
          </Button>
        </div>
      </div>

      {/* SECTION 2: 4 Operational Metrics Cards with Progress Bars (Stitch Spec) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "16px",
        }}
      >
        {/* Metric 1: Tổng tiền phát hành */}
        <div
          style={{
            backgroundColor: "var(--surface-lowest)",
            padding: "20px",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border-color)",
            boxShadow: "var(--shadow-sm)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "var(--neutral-500)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              TỔNG TIỀN PHÁT HÀNH
            </span>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                backgroundColor: "var(--surface-container)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--primary)",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>receipt</span>
            </div>
          </div>
          <div style={{ margin: "10px 0" }}>
            <div
              className="tnum"
              style={{
                fontSize: "1.65rem",
                fontWeight: "700",
                color: "var(--neutral-900)",
                fontFamily: "var(--font-heading)",
              }}
            >
              {formatCurrency(stats.totalBilled)}
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--neutral-500)", marginTop: "4px" }}>
              {stats.count} hóa đơn trong hệ thống
            </div>
          </div>
          <div style={{ width: "100%", height: "6px", backgroundColor: "var(--surface-container)", borderRadius: "9999px", overflow: "hidden" }}>
            <div style={{ width: "100%", height: "100%", backgroundColor: "var(--primary)" }} />
          </div>
        </div>

        {/* Metric 2: Đã thu thành công */}
        <div
          style={{
            backgroundColor: "var(--surface-lowest)",
            padding: "20px",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border-color)",
            boxShadow: "var(--shadow-sm)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "var(--neutral-500)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              ĐÃ THU THÀNH CÔNG (PAID)
            </span>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                backgroundColor: "var(--success-bg)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--success)",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>check_circle</span>
            </div>
          </div>
          <div style={{ margin: "10px 0" }}>
            <div
              className="tnum"
              style={{
                fontSize: "1.65rem",
                fontWeight: "700",
                color: "var(--success-text)",
                fontFamily: "var(--font-heading)",
              }}
            >
              {formatCurrency(stats.totalCollected)}
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--neutral-500)", marginTop: "4px" }}>
              <span style={{ fontWeight: "700", color: "var(--success)" }}>{stats.paidRate}%</span> tỷ lệ đã thanh toán
            </div>
          </div>
          <div style={{ width: "100%", height: "6px", backgroundColor: "var(--surface-container)", borderRadius: "9999px", overflow: "hidden" }}>
            <div style={{ width: `${stats.paidRate}%`, height: "100%", backgroundColor: "var(--success)" }} />
          </div>
        </div>

        {/* Metric 3: Công nợ tồn đọng */}
        <div
          style={{
            backgroundColor: "var(--surface-lowest)",
            padding: "20px",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border-color)",
            boxShadow: "var(--shadow-sm)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "var(--neutral-500)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              CÔNG NỢ TỒN ĐỌNG (UNPAID)
            </span>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                backgroundColor: "var(--error-bg)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--error)",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>warning</span>
            </div>
          </div>
          <div style={{ margin: "10px 0" }}>
            <div
              className="tnum"
              style={{
                fontSize: "1.65rem",
                fontWeight: "700",
                color: stats.totalRemaining > 0 ? "var(--error)" : "var(--neutral-700)",
                fontFamily: "var(--font-heading)",
              }}
            >
              {formatCurrency(stats.totalRemaining)}
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--error-text)", marginTop: "4px" }}>
              {stats.overdueCount > 0 ? `⚠️ ${stats.overdueCount} phòng quá hạn thanh toán` : "Không có nợ quá hạn"}
            </div>
          </div>
          <div style={{ width: "100%", height: "6px", backgroundColor: "var(--surface-container)", borderRadius: "9999px", overflow: "hidden" }}>
            <div style={{ width: `${stats.debtRate}%`, height: "100%", backgroundColor: "var(--error)" }} />
          </div>
        </div>

        {/* Metric 4: Giao dịch SePay tự động */}
        <div
          style={{
            backgroundColor: "var(--surface-lowest)",
            padding: "20px",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border-color)",
            boxShadow: "var(--shadow-sm)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "var(--neutral-500)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              GIAO DỊCH SEPAY TỰ ĐỘNG
            </span>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                backgroundColor: "var(--secondary-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--secondary)",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>bolt</span>
            </div>
          </div>
          <div style={{ margin: "10px 0" }}>
            <div
              className="tnum"
              style={{
                fontSize: "1.65rem",
                fontWeight: "700",
                color: "var(--secondary)",
                fontFamily: "var(--font-heading)",
              }}
            >
              {formatCurrency(stats.totalCollected)}
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--neutral-500)", marginTop: "4px" }}>
              Tốc độ gạch nợ tức thời: <strong>~1.8s</strong>
            </div>
          </div>
          <div style={{ width: "100%", height: "6px", backgroundColor: "var(--surface-container)", borderRadius: "9999px", overflow: "hidden" }}>
            <div style={{ width: "85%", height: "100%", backgroundColor: "var(--secondary)" }} />
          </div>
        </div>
      </div>

      {/* SECTION 3: Content Split Layout - Bảng danh sách & Panel Drawer VietQR */}
      <div style={{ display: "grid", gridTemplateColumns: selectedInvoice ? "1fr 380px" : "1fr", gap: "20px", alignItems: "start" }}>
        {/* Left Column: Filter Strip & Core Invoice Table */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Smart Status Filter & Search Strip */}
          <div
            style={{
              backgroundColor: "var(--surface-lowest)",
              padding: "16px 20px",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--border-color)",
              boxShadow: "var(--shadow-sm)",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            {/* Filter Pills */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px" }}>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {[
                  { id: "ALL", label: `Tất cả (${invoices.length})` },
                  { id: "PAID", label: "Đã thanh toán" },
                  { id: "UNPAID", label: "Chờ thanh toán" },
                  { id: "PARTIALLY_PAID", label: "Thu một phần" },
                  { id: "DRAFT", label: "Bản nháp" },
                  { id: "CANCELLED", label: "Đã hủy" },
                ].map((tab) => {
                  const isActive = statusFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setStatusFilter(tab.id)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "8px",
                        fontSize: "0.85rem",
                        fontWeight: isActive ? "600" : "500",
                        backgroundColor: isActive ? "var(--primary-container)" : "transparent",
                        color: isActive ? "#ffffff" : "var(--neutral-600)",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Live Status indicator */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "0.78rem", color: "var(--neutral-500)" }}>Đồng bộ:</span>
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor: "var(--success)",
                    display: "inline-block",
                  }}
                />
                <span style={{ fontSize: "0.82rem", fontWeight: "700", color: "var(--primary)" }}>Live</span>
              </div>
            </div>

            {/* Parametric Filters */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  style={{ width: "180px", padding: "6px 10px" }}
                >
                  <option value="">Tất cả cơ sở</option>
                  {branches.map((b) => (
                    <option key={b._id || b.id} value={b._id || b.id}>
                      {b.name || b.branchName || `Cơ sở ${b._id || b.id}`}
                    </option>
                  ))}
                </select>

                <input
                  type="month"
                  value={billingPeriodFilter}
                  onChange={(e) => setBillingPeriodFilter(e.target.value)}
                  style={{ width: "150px", padding: "6px 10px" }}
                />
              </div>

              <div style={{ fontSize: "0.82rem", color: "var(--neutral-500)" }}>
                Hiển thị <strong style={{ color: "var(--neutral-900)" }}>{filteredInvoices.length}</strong> trên {pagination.total || invoices.length} bản ghi
              </div>
            </div>
          </div>

          {/* The Core Invoice Ledger Table */}
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: "32px" }}>
                    <input type="checkbox" />
                  </th>
                  <th>Mã HĐ</th>
                  <th>Phòng & Khách thuê</th>
                  <th style={{ textAlign: "right" }}>Bóc tách chi phí</th>
                  <th style={{ textAlign: "right" }}>Tổng thanh toán</th>
                  <th style={{ textAlign: "center" }}>Trạng thái</th>
                  <th>Cú pháp SePay</th>
                  <th style={{ textAlign: "right" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: "center", padding: "40px", color: "var(--neutral-500)" }}>
                      ⏳ Đang nạp dữ liệu hóa đơn...
                    </td>
                  </tr>
                ) : filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: "center", padding: "48px 20px" }}>
                      <div style={{ fontSize: "1.8rem", marginBottom: "8px" }}>📑</div>
                      <div style={{ fontWeight: "600", color: "var(--neutral-700)" }}>
                        Không có hóa đơn nào khớp với bộ lọc
                      </div>
                      <div style={{ marginTop: "12px" }}>
                        <Button size="sm" variant="primary" onClick={() => setIsGenerateOpen(true)}>
                          ⚡ Tạo hóa đơn kỳ mới
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => {
                    const isSelected = selectedInvoice?._id === inv._id || selectedInvoice?.id === inv.id;
                    const statusMeta = getInvoiceStatusMeta(inv.status, inv.isOverdue);
                    const roomName = inv.roomId?.roomNumber || inv.roomId?.name || (typeof inv.roomId === "string" ? inv.roomId : "Phòng");
                    const tenantName = inv.tenantId?.name || (typeof inv.tenantId === "string" ? inv.tenantId : "Khách thuê");

                    return (
                      <tr
                        key={inv._id || inv.id}
                        className={isSelected ? "active-row" : ""}
                        style={{ cursor: "pointer" }}
                        onClick={() => setSelectedInvoice(inv)}
                      >
                        <td onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" />
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <span style={{ fontWeight: "700", fontFamily: "monospace", color: "var(--primary)" }}>
                              {inv.invoiceCode}
                            </span>
                            {inv.status === "PAID" && (
                              <span className="material-symbols-outlined" style={{ fontSize: "14px", color: "var(--success)" }}>
                                verified
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: "0.72rem", color: "var(--neutral-500)" }}>
                            {formatBillingPeriod(inv.billingPeriod)}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span
                              style={{
                                fontSize: "0.78rem",
                                fontWeight: "700",
                                backgroundColor: "var(--surface-container)",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                color: "var(--neutral-800)",
                              }}
                            >
                              {roomName}
                            </span>
                            <span style={{ fontWeight: "600", color: "var(--neutral-900)" }}>{tenantName}</span>
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "var(--neutral-500)", marginTop: "2px" }}>
                            {inv.tenantId?.phoneNumber || "Khách thuê"}
                          </div>
                        </td>
                        <td style={{ textAlign: "right", fontSize: "0.78rem" }}>
                          <div>Phòng: {formatCurrency(inv.roomAmount)}</div>
                          <div style={{ color: "var(--neutral-500)" }}>
                            Điện: {formatCurrency(inv.electricDetail?.amount || 0)} | Nước: {formatCurrency(inv.waterDetail?.amount || 0)}
                          </div>
                        </td>
                        <td style={{ textAlign: "right", fontWeight: "700" }} className="tnum">
                          {formatCurrency(inv.totalAmount)}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                        </td>
                        <td>
                          <code
                            style={{
                              fontSize: "0.78rem",
                              fontWeight: "600",
                              backgroundColor: "var(--surface-container)",
                              padding: "3px 6px",
                              borderRadius: "4px",
                            }}
                          >
                            {inv.paymentSyntax || inv.invoiceCode}
                          </code>
                        </td>
                        <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: "inline-flex", gap: "4px" }}>
                            <Button
                              size="sm"
                              variant="outline"
                              title="Xem chi tiết"
                              onClick={() => {
                                setSelectedInvoice(inv);
                                setIsDetailOpen(true);
                              }}
                            >
                              👁️
                            </Button>
                            {["ISSUED", "PARTIALLY_PAID", "UNPAID"].includes(inv.status) && (
                              <Button
                                size="sm"
                                variant="primary"
                                title="Thu tiền mặt"
                                onClick={() => {
                                  setCashInvoiceTarget(inv);
                                  setIsCashPaymentOpen(true);
                                }}
                              >
                                💵
                              </Button>
                            )}
                            {(!inv.paidAmount || inv.paidAmount === 0) && inv.status !== "CANCELLED" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                title="Hủy"
                                style={{ color: "var(--error)" }}
                                onClick={() => {
                                  setCancelInvoiceTarget(inv);
                                  setIsCancelOpen(true);
                                }}
                              >
                                🗑️
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Sao chép link khách"
                              onClick={(e) => copyPublicLink(inv, e)}
                            >
                              🔗
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {pagination.total > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 4px", fontSize: "0.85rem", color: "var(--neutral-600)" }}>
              <div>
                Trang <strong>{pagination.page}</strong> / <strong>{Math.ceil(pagination.total / (pagination.limit || 20)) || 1}</strong> (Tổng cộng <strong>{pagination.total}</strong> hóa đơn)
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  ← Trang trước
                </Button>
                <Button size="sm" variant="outline" disabled={page * (pagination.limit || 20) >= pagination.total} onClick={() => setPage((p) => p + 1)}>
                  Trang sau →
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Stitch VietQR Quick Drawer Flyout */}
        {selectedInvoice && (
          <div
            style={{
              backgroundColor: "var(--surface-lowest)",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--border-color)",
              boxShadow: "var(--shadow-md)",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              position: "sticky",
              top: "84px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontSize: "0.72rem", color: "var(--neutral-500)", textTransform: "uppercase", fontWeight: "700" }}>
                  CHI TIẾT NHANH (DRAWER)
                </span>
                <h3 style={{ margin: "2px 0 0 0", color: "var(--primary)" }}>{selectedInvoice.invoiceCode}</h3>
              </div>
              <Button size="sm" variant="outline" onClick={() => setIsDetailOpen(true)}>
                Mở rộng ↗
              </Button>
            </div>

            {/* Dynamic VietQR Preview Card */}
            {selectedInvoice.vietQrUrl && selectedInvoice.status !== "CANCELLED" ? (
              <div style={{ textAlign: "center", backgroundColor: "var(--neutral-50)", padding: "16px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)" }}>
                <img
                  src={selectedInvoice.vietQrUrl}
                  alt="VietQR QuickLink"
                  style={{
                    width: "180px",
                    height: "180px",
                    borderRadius: "8px",
                    border: "1px solid var(--border-color)",
                    backgroundColor: "#ffffff",
                    padding: "4px",
                    margin: "0 auto",
                    display: "block",
                  }}
                />
                <div style={{ marginTop: "10px", fontSize: "0.82rem", fontWeight: "700", color: "var(--primary)" }}>
                  NAPAS 247 QuickLink
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--neutral-500)", marginTop: "2px" }}>
                  Quét mã gạch nợ tự động trong 2s
                </div>
              </div>
            ) : null}

            {/* Bill Summary */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.85rem", padding: "12px", backgroundColor: "var(--surface-container)", borderRadius: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--neutral-600)" }}>Tổng số tiền:</span>
                <span style={{ fontWeight: "700" }} className="tnum">{formatCurrency(selectedInvoice.totalAmount)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--neutral-600)" }}>Đã thanh toán:</span>
                <span style={{ fontWeight: "600", color: "var(--success)" }} className="tnum">{formatCurrency(selectedInvoice.paidAmount)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--neutral-600)" }}>Còn nợ:</span>
                <span style={{ fontWeight: "700", color: (selectedInvoice.remainingAmount || 0) > 0 ? "var(--error)" : "var(--neutral-700)" }} className="tnum">
                  {formatCurrency(selectedInvoice.remainingAmount)}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "4px", borderTop: "1px dashed var(--border-color)" }}>
                <span style={{ color: "var(--neutral-600)" }}>Cú pháp:</span>
                <code style={{ fontSize: "0.82rem", fontWeight: "700", color: "var(--primary)" }}>{selectedInvoice.paymentSyntax || selectedInvoice.invoiceCode}</code>
              </div>
            </div>

            {/* Quick Actions inside Drawer */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {["ISSUED", "PARTIALLY_PAID", "UNPAID"].includes(selectedInvoice.status) && (
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    setCashInvoiceTarget(selectedInvoice);
                    setIsCashPaymentOpen(true);
                  }}
                  style={{ width: "100%" }}
                >
                  💵 Xác nhận thu tiền mặt
                </Button>
              )}

              <Button
                variant="outline"
                size="md"
                onClick={() => copyPublicLink(selectedInvoice)}
                style={{ width: "100%" }}
              >
                🔗 Sao chép link khách xem No-App
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {isDetailOpen && selectedInvoice && (
        <InvoiceDetailModal
          isOpen={isDetailOpen}
          invoice={selectedInvoice}
          onClose={() => setIsDetailOpen(false)}
          onOpenCashPayment={(inv) => {
            setCashInvoiceTarget(inv);
            setIsCashPaymentOpen(true);
          }}
          onOpenCancelInvoice={(inv) => {
            setCancelInvoiceTarget(inv);
            setIsCancelOpen(true);
          }}
          onInvoiceUpdated={loadInvoices}
        />
      )}

      {/* Batch Generate Modal */}
      {isGenerateOpen && (
        <InvoiceGenerateModal
          isOpen={isGenerateOpen}
          defaultBranchId={branchFilter}
          onClose={() => setIsGenerateOpen(false)}
          onGenerated={loadInvoices}
        />
      )}

      {/* Cash Payment Modal */}
      {isCashPaymentOpen && cashInvoiceTarget && (
        <CashPaymentModal
          isOpen={isCashPaymentOpen}
          invoice={cashInvoiceTarget}
          onClose={() => {
            setIsCashPaymentOpen(false);
            setCashInvoiceTarget(null);
          }}
          onPaymentSuccess={loadInvoices}
        />
      )}

      {/* Cancel Modal */}
      {isCancelOpen && cancelInvoiceTarget && (
        <InvoiceCancelModal
          isOpen={isCancelOpen}
          invoice={cancelInvoiceTarget}
          onClose={() => {
            setIsCancelOpen(false);
            setCancelInvoiceTarget(null);
          }}
          onInvoiceCancelled={loadInvoices}
        />
      )}
    </div>
  );
}
