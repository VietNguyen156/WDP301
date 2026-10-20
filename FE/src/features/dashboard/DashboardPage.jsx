import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  DoorOpen,
  Users,
  FileText,
  Receipt,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Percent,
  PlusCircle,
  Copy,
  Send,
  RefreshCw,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Scale,
  Clock,
  Zap,
  Droplets,
  HelpCircle,
  Filter,
} from "lucide-react";
import { branchApi, roomApi, contractApi, dashboardApi, errorMessage } from "../../services/api";
import { invoiceService } from "../../services/invoiceService";
import { paymentService } from "../../services/paymentService";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { LoadingState, Button } from "../../components/ui";
import { InvoiceGenerateModal } from "../invoices/InvoiceGenerateModal";
import { formatCurrency, formatDate, formatBillingPeriod } from "../../utils/formatters";
import { money, date } from "../../utils/format";
import { publicAppUrl, publicInvoiceUrl } from "../../utils/publicLink";

export default function DashboardPage() {
  const { user, selectedBranchId } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  // Selected filter (all branches or specific branch)
  const [filterBranchId, setFilterBranchId] = useState(selectedBranchId || "");
  const [billingPeriod, setBillingPeriod] = useState(() =>
    new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 7)
  );

  // Aggregated data from dedicated Dashboard backend (Dev 4 spec)
  const [dashboardStats, setDashboardStats] = useState(null);
  const [dashboardDebts, setDashboardDebts] = useState(null);

  // Raw data from MongoDB (for branch cards & fallback)
  const [branches, setBranches] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [unmatched, setUnmatched] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Quick Action Modal
  const [isQuickInvoiceOpen, setIsQuickInvoiceOpen] = useState(false);

  // Sync filterBranchId with Auth context when changed elsewhere
  useEffect(() => {
    if (selectedBranchId !== undefined) {
      setFilterBranchId(selectedBranchId);
    }
  }, [selectedBranchId]);

  // Fetch dashboard data
  const loadDashboardData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setRefreshing(true);

    try {
      const isLandlord = user?.role === "LANDLORD";
      const [branchRes, invoiceRes, paymentRes, contractRes, unmatchedRes, statsRes, debtsRes] = await Promise.all([
        branchApi.list({ limit: 100 }),
        invoiceService.getInvoices({ limit: 100 }),
        paymentService.getPayments({ limit: 20 }),
        isLandlord
          ? contractApi.list({ limit: 100 })
          : Promise.resolve([]),
        isLandlord
          ? paymentService.listUnmatched({ status: "PENDING_REVIEW" }).catch(() => [])
          : Promise.resolve([]),
        isLandlord
          ? dashboardApi.getStats({
              branchId: filterBranchId || undefined,
              billingPeriod: billingPeriod || undefined,
            }).catch(() => null)
          : Promise.resolve(null),
        isLandlord
          ? dashboardApi.getDebts({
              branchId: filterBranchId || undefined,
            }).catch(() => null)
          : Promise.resolve(null),
      ]);

      setBranches(branchRes?.items || []);
      const rawInvoices = Array.isArray(invoiceRes) ? invoiceRes : invoiceRes?.data || [];
      setInvoices(rawInvoices);
      const rawPayments = Array.isArray(paymentRes) ? paymentRes : paymentRes?.data || [];
      setPayments(rawPayments);
      setContracts(contractRes?.items || []);
      const rawUnmatched = Array.isArray(unmatchedRes) ? unmatchedRes : unmatchedRes?.data || [];
      setUnmatched(rawUnmatched);
      setDashboardStats(statsRes);
      setDashboardDebts(debtsRes);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, filterBranchId, billingPeriod, toast]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Realtime updates from Socket.io (Dev 4 spec)
  useSocketEvent("payment:success", () => {
    loadDashboardData(true);
    toast.success("Đã ghi nhận thanh toán thành công! Dữ liệu dashboard đã được cập nhật.");
  });

  useSocketEvent("invoice_paid", () => {
    loadDashboardData(true);
  });

  useSocketEvent("incident:created", (payload) => {
    loadDashboardData(true);
    toast.warning(`Sự cố phòng mới: "${payload?.title || "Sự cố"}"`);
  });

  useSocketEvent("incident:updated", () => {
    loadDashboardData(true);
  });

  // Filtered dataset according to active branch filter
  const activeBranches = useMemo(() => {
    if (!filterBranchId) return branches;
    return branches.filter((b) => String(b._id) === String(filterBranchId));
  }, [branches, filterBranchId]);

  const activeInvoices = useMemo(() => {
    if (!filterBranchId) return invoices;
    return invoices.filter((inv) => String(inv.branchId) === String(filterBranchId));
  }, [invoices, filterBranchId]);

  const activePayments = useMemo(() => {
    if (!filterBranchId) return payments;
    return payments.filter((payment) => {
      const paymentBranchId =
        payment.branchId?._id || payment.branchId || payment.invoiceId?.branchId?._id || payment.invoiceId?.branchId;
      return String(paymentBranchId) === String(filterBranchId);
    });
  }, [payments, filterBranchId]);

  const activeContracts = useMemo(() => {
    if (!filterBranchId) return contracts;
    return contracts.filter((c) => String(c.branchId) === String(filterBranchId));
  }, [contracts, filterBranchId]);

  // Aggregate Room Occupancy Metrics (Prefers DB aggregate from /dashboard/stats when LANDLORD)
  const roomMetrics = useMemo(() => {
    if (dashboardStats?.occupancy) {
      const occ = dashboardStats.occupancy;
      const totalRooms = occ.totalRooms || 0;
      const rentedRooms = occ.rentedRooms || 0;
      const vacantRooms = occ.byStatus?.EMPTY ?? Math.max(0, totalRooms - rentedRooms);
      return {
        totalRooms,
        rentedRooms,
        vacantRooms,
        cleaningRooms: occ.byStatus?.CLEANING || 0,
        maintenanceRooms: occ.byStatus?.MAINTENANCE || 0,
        occupancyRate: occ.rate || 0,
      };
    }

    let totalRooms = 0;
    let rentedRooms = 0;
    let vacantRooms = 0;
    let cleaningRooms = 0;
    let maintenanceRooms = 0;

    activeBranches.forEach((b) => {
      const stats = b.roomStats || {};
      totalRooms += stats.total || 0;
      rentedRooms += stats.rented || 0;
      vacantRooms += Math.max(0, (stats.total || 0) - (stats.rented || 0));
    });

    const occupancyRate = totalRooms > 0 ? Math.round((rentedRooms / totalRooms) * 100) : 0;

    return {
      totalRooms,
      rentedRooms,
      vacantRooms,
      cleaningRooms,
      maintenanceRooms,
      occupancyRate,
    };
  }, [dashboardStats, activeBranches]);

  // Aggregate Financial Metrics (Prefers DB aggregate from /dashboard/stats when LANDLORD)
  const financialMetrics = useMemo(() => {
    if (dashboardStats?.collection) {
      const col = dashboardStats.collection;
      const debtData = dashboardDebts || dashboardStats.debts || {};
      const debtItems = debtData.items || [];

      return {
        expectedRevenue: col.expectedAmount || 0,
        actualRevenue: col.collectedAmount || 0,
        receivedAmount: col.receivedAmount || 0,
        receivedByMethod: col.receivedByMethod || {},
        debtAmount: debtData.totalAmount || 0,
        debtInvoices: debtItems,
        debtRoomsCount: debtData.roomCount ?? debtItems.length,
        collectionRate: col.collectionRate || 0,
        isFromStatsApi: true,
      };
    }

    // Fallback client-side calculation for PROPERTY_MANAGER
    let expectedRevenue = 0;
    let actualRevenue = 0;
    let debtAmount = 0;
    const debtInvoices = [];

    activeInvoices.forEach((inv) => {
      if (inv.status !== "CANCELLED" && inv.status !== "DRAFT") {
        expectedRevenue += inv.totalAmount || 0;
        actualRevenue += inv.paidAmount || 0;

        const rem = Math.max(0, (inv.totalAmount || 0) - (inv.paidAmount || 0));
        if (rem > 0) {
          debtAmount += rem;
          debtInvoices.push(inv);
        }
      }
    });

    const collectionRate = expectedRevenue > 0 ? Math.round((actualRevenue / expectedRevenue) * 100) : 0;

    debtInvoices.sort((a, b) => {
      const remA = (a.totalAmount || 0) - (a.paidAmount || 0);
      const remB = (b.totalAmount || 0) - (b.paidAmount || 0);
      return remB - remA;
    });

    return {
      expectedRevenue,
      actualRevenue,
      debtAmount,
      debtInvoices,
      debtRoomsCount: debtInvoices.length,
      collectionRate,
      isFromStatsApi: false,
    };
  }, [dashboardStats, dashboardDebts, activeInvoices]);

  // Contracts Status & Expiring Watchlist
  const contractWatchlist = useMemo(() => {
    const totalActive = dashboardStats?.contracts ? dashboardStats.contracts.live : activeContracts.filter(c => c.status === "ACTIVE").length;
    const now = new Date();
    const expiringSoon = [];

    activeContracts.forEach((c) => {
      if (c.status === "ACTIVE" && c.endDate) {
        const end = new Date(c.endDate);
        const diffDays = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
        if (diffDays <= 30 && diffDays >= 0) {
          expiringSoon.push({ ...c, diffDays });
        }
      }
    });

    expiringSoon.sort((a, b) => a.diffDays - b.diffDays);

    return {
      totalActive,
      expiringSoon,
      expired: dashboardStats?.contracts?.expired ?? 0,
    };
  }, [dashboardStats, activeContracts]);

  // Performance Per Branch (Comparison Bar Data)
  const branchPerformance = useMemo(() => {
    return activeBranches.map((branch) => {
      const branchInvs = invoices.filter((inv) => String(inv.branchId) === String(branch._id));
      const exp = branchInvs.reduce((sum, i) => (i.status !== "CANCELLED" && i.status !== "DRAFT" ? sum + (i.totalAmount || 0) : sum), 0);
      const paid = branchInvs.reduce((sum, i) => sum + (i.paidAmount || 0), 0);
      const debt = Math.max(0, exp - paid);
      const rate = exp > 0 ? Math.round((paid / exp) * 100) : 0;
      const totalR = branch.roomStats?.total || 0;
      const rentedR = branch.roomStats?.rented || 0;
      const occRate = totalR > 0 ? Math.round((rentedR / totalR) * 100) : 0;

      return {
        _id: branch._id,
        name: branch.name,
        address: branch.address?.fullAddress || "Chưa có địa chỉ",
        totalRooms: totalR,
        rentedRooms: rentedR,
        occRate,
        expected: exp,
        paid,
        debt,
        rate,
      };
    });
  }, [activeBranches, invoices]);

  // Zalo Reminder Copy Handler
  const handleCopyZaloReminder = (inv) => {
    if (inv.reminderMessage) {
      navigator.clipboard.writeText(inv.reminderMessage);
      const roomNum = inv.room?.roomNumber || inv.roomId?.roomNumber || inv.roomNumber || "phòng trọ";
      toast.success(`Đã sao chép tin nhắn nhắc nợ gửi Zalo cho phòng ${roomNum}!`);
      return;
    }

    const rem = inv.remainingAmount ?? Math.max(0, (inv.totalAmount || 0) - (inv.paidAmount || 0));
    const branchName = inv.branch?.name || inv.branchId?.name || inv.branchName || "Ban quản lý";
    const roomNum = inv.room?.roomNumber || inv.roomId?.roomNumber || inv.roomNumber || "phòng trọ";
    const tenantName = inv.tenant?.name || inv.contractId?.tenantName || inv.tenantName || "Quý khách";
    const publicUrl = inv.publicPath
      ? `${publicAppUrl()}${inv.publicPath}`
      : (inv.publicAccessToken ? publicInvoiceUrl(inv.publicAccessToken) : `${publicAppUrl()}/invoices`);

    const message = `[DOMUS ERP - THÔNG BÁO TIỀN PHÒNG]
Kính gửi Quý khách ${tenantName} (${roomNum} - ${branchName}),
Ban quản lý xin gửi thông báo công nợ tiền thuê phòng & dịch vụ:
- Kỳ hóa đơn: ${formatBillingPeriod(inv.billingPeriod)}
- Số tiền còn phải nộp: ${money(rem)}
- Hạn thanh toán: ${date(inv.dueDate)}
👉 Xem chi tiết và quét mã VietQR tự động gạch nợ tại:
${publicUrl}
(Quý khách vui lòng thanh toán đúng hạn để tránh phát sinh gián đoạn dịch vụ. Trân trọng cảm ơn!)`;

    navigator.clipboard.writeText(message);
    toast.success(`Đã sao chép tin nhắn nhắc nợ gửi Zalo cho phòng ${roomNum}!`);
  };

  if (loading) {
    return (
      <div style={{ padding: "40px", display: "flex", justifyContent: "center" }}>
        <LoadingState />
      </div>
    );
  }

  return (
    <div className="stitch-dash-container">
      {/* ================================================================= */}
      {/* 1. TOP HEADER & MULTI-TENANT CONTEXT BAR                          */}
      {/* ================================================================= */}
      <header className="stitch-dash-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <h1 className="stitch-dash-title">Tổng quan vận hành</h1>
          </div>
          <p className="stitch-dash-subtitle">
            Theo dõi doanh thu, công nợ và tình trạng phòng trong toàn bộ hệ thống.
          </p>
        </div>

        {/* Global Toolbar Controls */}
        <div className="stitch-dash-controls">
          {/* Month Selector for Landlords */}
          {user?.role === "LANDLORD" && (
            <input
              type="month"
              value={billingPeriod}
              onChange={(e) => setBillingPeriod(e.target.value)}
              className="stitch-dash-btn secondary"
              style={{ cursor: "pointer", height: "36px", padding: "0 10px", fontSize: "13px" }}
              title="Chọn kỳ thu phí"
            />
          )}

          {/* Refresh Live Data */}
          <button
            type="button"
            className="stitch-dash-btn secondary"
            onClick={() => loadDashboardData(true)}
            disabled={refreshing}
            title="Tải lại dữ liệu sống"
          >
            <RefreshCw size={15} className={refreshing ? "spin" : ""} />
            <span>Làm mới</span>
          </button>

          {/* Quick Create Invoice CTA */}
          {user?.role === "LANDLORD" && (
            <button
              type="button"
              className="stitch-dash-btn primary"
              onClick={() => setIsQuickInvoiceOpen(true)}
            >
              <PlusCircle size={16} />
              <span>Tạo hóa đơn nhanh</span>
            </button>
          )}
        </div>
      </header>

      {/* ================================================================= */}
      {/* 2. SEPAY UNMATCHED TRANSACTION BANNER (IF PENDING)                */}
      {/* ================================================================= */}
      {unmatched.length > 0 && (
        <div className="stitch-dash-alert-banner">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div className="stitch-dash-alert-icon">
              <AlertTriangle size={18} />
            </div>
            <div>
              <strong style={{ fontSize: "14px", color: "#991b1b" }}>
                Cảnh báo SePay: Có {unmatched.length} giao dịch chuyển khoản chưa khớp cú pháp
              </strong>
              <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#7f1d1d" }}>
                Khách thuê chuyển khoản sai cú pháp hoặc sai số tiền. Vui lòng đối soát và gán vào hóa đơn phòng tương ứng.
              </p>
            </div>
          </div>
          <Link to="/unmatched" className="stitch-dash-alert-action">
            <Scale size={14} />
            <span>Xử lý đối soát ngay</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* ================================================================= */}
      {/* 3. EXECUTIVE 4-CARD FINANCIAL & SCALE KPIs                         */}
      {/* ================================================================= */}
      <section className="stitch-kpi-grid">
        {/* KPI 1: Thực Thu Kỳ Này */}
        <div className="stitch-kpi-card">
          <div className="stitch-kpi-header">
            <div>
              <p className="stitch-kpi-title">Thực thu kỳ này (Đã nhận tiền)</p>
              <div className="stitch-kpi-value-row">
                <span className="stitch-kpi-value" style={{ color: "#047857" }}>
                  {formatCurrency(financialMetrics.actualRevenue)}
                </span>
              </div>
            </div>
            <div className="stitch-kpi-icon" style={{ backgroundColor: "#ecfdf5", color: "#059669" }}>
              <TrendingUp size={22} />
            </div>
          </div>
          <div className="stitch-kpi-footer">
            <span>
              Dự thu: <strong>{formatCurrency(financialMetrics.expectedRevenue)}</strong>
            </span>
            <span
              style={{
                fontWeight: 700,
                color: financialMetrics.collectionRate >= 80 ? "#047857" : "#b45309",
                backgroundColor: financialMetrics.collectionRate >= 80 ? "#ecfdf5" : "#fef3c7",
                padding: "2px 8px",
                borderRadius: "9999px",
              }}
            >
              Đạt {financialMetrics.collectionRate}%
            </span>
          </div>
        </div>

        {/* KPI 2: Hóa Đơn & Công Nợ Chưa Thu */}
        <div
          className="stitch-kpi-card"
          style={{
            border: financialMetrics.debtAmount > 0 ? "1px solid rgba(220, 38, 38, 0.4)" : "1px solid rgba(189, 201, 198, 0.6)",
            background: financialMetrics.debtAmount > 0 ? "linear-gradient(to bottom right, #ffffff, #fff5f5)" : "#ffffff",
          }}
        >
          <div className="stitch-kpi-header">
            <div>
              <p className="stitch-kpi-title" style={{ color: financialMetrics.debtAmount > 0 ? "#dc2626" : "#64748b" }}>
                Công nợ tồn đọng ({financialMetrics.debtRoomsCount} phòng)
              </p>
              <div className="stitch-kpi-value-row">
                <span className="stitch-kpi-value" style={{ color: financialMetrics.debtAmount > 0 ? "#dc2626" : "#131b2e" }}>
                  {formatCurrency(financialMetrics.debtAmount)}
                </span>
              </div>
            </div>
            <div className="stitch-kpi-icon" style={{ backgroundColor: "#fef2f2", color: "#dc2626" }}>
              <Receipt size={22} />
            </div>
          </div>
          <div className="stitch-kpi-footer" style={{ borderTopColor: "rgba(254, 202, 202, 0.7)" }}>
            <span>Phát sinh trễ hạn</span>
            <Link to="/invoices" style={{ color: "#dc2626", fontWeight: 700, textDecoration: "underline" }}>
              Xem {financialMetrics.debtRoomsCount} hóa đơn nợ →
            </Link>
          </div>
        </div>

        {/* KPI 3: Tỷ Lệ Lấp Đầy Toàn Chuỗi */}
        <div className="stitch-kpi-card">
          <div className="stitch-kpi-header">
            <div>
              <p className="stitch-kpi-title">Tỷ lệ lấp đầy toàn chuỗi</p>
              <div className="stitch-kpi-value-row">
                <span className="stitch-kpi-value" style={{ color: "var(--primary, #005c55)" }}>
                  {roomMetrics.occupancyRate}%
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: "9999px",
                    backgroundColor: roomMetrics.occupancyRate >= 90 ? "#ecfdf5" : "#fef3c7",
                    color: roomMetrics.occupancyRate >= 90 ? "#047857" : "#b45309",
                  }}
                >
                  {roomMetrics.occupancyRate >= 90 ? "Tối ưu" : "Còn phòng trống"}
                </span>
              </div>
            </div>
            <div className="stitch-kpi-icon" style={{ backgroundColor: "#eff6ff", color: "#2563eb" }}>
              <Percent size={22} />
            </div>
          </div>
          <div className="stitch-kpi-footer">
            <span>
              <strong>{roomMetrics.rentedRooms}</strong> phòng đang thuê
            </span>
            <span style={{ color: "#b45309", fontWeight: 600 }}>
              {roomMetrics.vacantRooms} phòng trống
            </span>
          </div>
        </div>

        {/* KPI 4: Quy Mô Chuỗi Vận Hành */}
        <div className="stitch-kpi-card">
          <div className="stitch-kpi-header">
            <div>
              <p className="stitch-kpi-title">Quy mô chuỗi vận hành</p>
              <div className="stitch-kpi-value-row">
                <span className="stitch-kpi-value">
                  {roomMetrics.totalRooms}
                </span>
                <span className="stitch-kpi-sub">Phòng / Căn hộ</span>
              </div>
            </div>
            <div className="stitch-kpi-icon" style={{ backgroundColor: "#f5f3ff", color: "#7c3aed" }}>
              <Building2 size={22} />
            </div>
          </div>
          <div className="stitch-kpi-footer">
            <span>
              <strong>{activeBranches.length}</strong> Tòa nhà
            </span>
            <span>
              <strong>{contractWatchlist.totalActive}</strong> Hợp đồng hiệu lực
            </span>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* 4. VISUAL CHARTS: ROOM OCCUPANCY & REVENUE PERFORMANCE            */}
      {/* ================================================================= */}
      <div className="stitch-dash-grid-2">
        {/* Visual Chart 1: Cơ Cấu Trạng Thái Phòng */}
        <div className="stitch-dash-card">
          <div className="stitch-dash-card-header">
            <div>
              <h2 className="stitch-dash-card-title">Cơ Cấu Trạng Thái Phòng</h2>
              <p className="stitch-dash-card-sub">
                Phân bố phòng đang thuê, phòng trống và phòng cần bảo dưỡng
              </p>
            </div>
            <Link to="/rooms" className="stitch-dash-card-link">
              Sơ đồ phòng <ArrowRight size={14} />
            </Link>
          </div>

          {/* Visual Stacked Bar Chart */}
          <div className="stitch-dist-bar-wrap">
            <div className="stitch-dist-bar">
              {roomMetrics.totalRooms > 0 ? (
                <>
                  <div
                    className="stitch-dist-seg rented"
                    style={{ width: `${(roomMetrics.rentedRooms / roomMetrics.totalRooms) * 100}%` }}
                    title={`Đang thuê: ${roomMetrics.rentedRooms} phòng (${Math.round((roomMetrics.rentedRooms / roomMetrics.totalRooms) * 100)}%)`}
                  />
                  <div
                    className="stitch-dist-seg vacant"
                    style={{ width: `${(roomMetrics.vacantRooms / roomMetrics.totalRooms) * 100}%` }}
                    title={`Phòng trống: ${roomMetrics.vacantRooms} phòng (${Math.round((roomMetrics.vacantRooms / roomMetrics.totalRooms) * 100)}%)`}
                  />
                </>
              ) : (
                <div style={{ width: "100%", height: "100%", backgroundColor: "#e2e8f0" }} />
              )}
            </div>

            {/* Legend Breakdown */}
            <div className="stitch-dist-legend">
              <div className="stitch-legend-item">
                <span className="stitch-legend-dot rented" />
                <span className="stitch-legend-label">Đang thuê:</span>
                <strong className="stitch-legend-val">{roomMetrics.rentedRooms}</strong>
                <span className="stitch-legend-pct">
                  ({roomMetrics.totalRooms > 0 ? Math.round((roomMetrics.rentedRooms / roomMetrics.totalRooms) * 100) : 0}%)
                </span>
              </div>

              <div className="stitch-legend-item">
                <span className="stitch-legend-dot vacant" />
                <span className="stitch-legend-label">Phòng trống:</span>
                <strong className="stitch-legend-val">{roomMetrics.vacantRooms}</strong>
                <span className="stitch-legend-pct">
                  ({roomMetrics.totalRooms > 0 ? Math.round((roomMetrics.vacantRooms / roomMetrics.totalRooms) * 100) : 0}%)
                </span>
              </div>

              <div className="stitch-legend-item">
                <span className="stitch-legend-dot cleaning" />
                <span className="stitch-legend-label">Tổng quy mô:</span>
                <strong className="stitch-legend-val">{roomMetrics.totalRooms} phòng</strong>
              </div>
            </div>
          </div>

          {/* Micro Status Summary Cards */}
          <div className="stitch-dash-mini-stat-grid">
            <div className="stitch-dash-mini-stat">
              <span className="mini-label">Cơ sở hoạt động</span>
              <strong className="mini-value">{activeBranches.length}</strong>
              <small className="mini-desc">Đang quản lý vận hành</small>
            </div>
            <div className="stitch-dash-mini-stat">
              <span className="mini-label">Hợp đồng hiệu lực</span>
              <strong className="mini-value">{contractWatchlist.totalActive}</strong>
              <small className="mini-desc">Cư dân đang cư trú</small>
            </div>
            <div className="stitch-dash-mini-stat">
              <span className="mini-label">Sắp hết hạn (30 ngày)</span>
              <strong className="mini-value" style={{ color: contractWatchlist.expiringSoon.length > 0 ? "#d97706" : "#131b2e" }}>
                {contractWatchlist.expiringSoon.length}
              </strong>
              <small className="mini-desc">Cần gia hạn / tìm khách</small>
            </div>
          </div>
        </div>

        {/* Visual Chart 2: Hiệu Suất Thu Tiền Theo Từng Cơ Sở */}
        <div className="stitch-dash-card">
          <div className="stitch-dash-card-header">
            <div>
              <h2 className="stitch-dash-card-title">Hiệu Suất Thu Tiền Từng Cơ Sở</h2>
              <p className="stitch-dash-card-sub">
                So sánh tiến độ thực thu vs công nợ giữa các tòa nhà trong chuỗi
              </p>
            </div>
            <Link to="/branches" className="stitch-dash-card-link">
              Chi tiết cơ sở <ArrowRight size={14} />
            </Link>
          </div>

          {branchPerformance.length === 0 ? (
            <div className="stitch-dash-empty-box">
              <Building2 size={32} color="#94a3b8" />
              <p>Chưa có cơ sở nào được cấu hình trong hệ thống.</p>
              <Link to="/branches" className="stitch-dash-btn primary">
                Khởi tạo cơ sở đầu tiên
              </Link>
            </div>
          ) : (
            <div className="stitch-branch-perf-list">
              {branchPerformance.map((bp) => (
                <div key={bp._id} className="stitch-branch-perf-item">
                  <div className="stitch-branch-perf-top">
                    <div>
                      <strong className="stitch-branch-perf-name">{bp.name}</strong>
                      <span className="stitch-branch-perf-sub">
                        {bp.rentedRooms}/{bp.totalRooms} phòng · {bp.occRate}% lấp đầy
                      </span>
                    </div>
                    <div className="stitch-branch-perf-amounts">
                      <span className="perf-paid">{formatCurrency(bp.paid)}</span>
                      <span className="perf-slash">/</span>
                      <span className="perf-exp">{formatCurrency(bp.expected)}</span>
                    </div>
                  </div>

                  {/* Dual Comparison Bar */}
                  <div className="stitch-branch-bar-track">
                    <div
                      className="stitch-branch-bar-fill"
                      style={{
                        width: `${bp.expected > 0 ? Math.min(100, Math.round((bp.paid / bp.expected) * 100)) : 0}%`,
                      }}
                    />
                  </div>

                  <div className="stitch-branch-perf-foot">
                    <span style={{ color: bp.debt > 0 ? "#dc2626" : "#059669", fontWeight: 600 }}>
                      {bp.debt > 0 ? `Còn nợ: ${formatCurrency(bp.debt)}` : "Đã thu đủ 100%"}
                    </span>
                    <span className="perf-rate-chip">
                      Đạt {bp.rate}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ================================================================= */}
      {/* 5. OPERATIONAL WATCHLISTS: DEBT COLLECTION & EXPIRING CONTRACTS    */}
      {/* ================================================================= */}
      <div className="stitch-dash-grid-2">
        {/* Watchlist 1: Danh Sách Nợ Cần Thu Gấp & Nhắc Zalo 1-Click */}
        <div className="stitch-dash-card">
          <div className="stitch-dash-card-header">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div className="stitch-badge-icon red">
                <Receipt size={16} />
              </div>
              <div>
                <h2 className="stitch-dash-card-title">Phòng Còn Nợ Tiền ({financialMetrics.debtRoomsCount})</h2>
                <p className="stitch-dash-card-sub">
                  Danh sách hóa đơn trễ hạn kèm chức năng gửi tin nhắn Zalo nhắc nợ
                </p>
              </div>
            </div>
            <Link to="/invoices" className="stitch-dash-card-link">
              Xem tất cả <ArrowRight size={14} />
            </Link>
          </div>

          {financialMetrics.debtInvoices.length === 0 ? (
            <div className="stitch-dash-empty-box" style={{ padding: "32px 16px" }}>
              <CheckCircle2 size={36} color="#059669" />
              <p style={{ color: "#047857", fontWeight: 600 }}>
                Tuyệt vời! Toàn bộ khách thuê đã nộp tiền đầy đủ. Không có công nợ tồn đọng.
              </p>
            </div>
          ) : (
            <div className="stitch-table-wrapper" style={{ maxHeight: "320px", overflowY: "auto" }}>
              <table className="stitch-dash-table">
                <thead>
                  <tr>
                    <th>Phòng &amp; Cơ sở</th>
                    <th>Kỳ thu</th>
                    <th>Còn nợ</th>
                    <th>Hạn nộp</th>
                    <th style={{ textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {financialMetrics.debtInvoices.slice(0, 10).map((inv) => {
                    const rem = inv.remainingAmount ?? Math.max(0, (inv.totalAmount || 0) - (inv.paidAmount || 0));
                    const roomNumber = inv.room?.roomNumber || inv.roomId?.roomNumber || inv.roomNumber || "P.?";
                    const branchName = inv.branch?.name || inv.branchId?.name || inv.branchName || "Cơ sở";
                    const isOverdue = inv.overdueDays > 0 || (inv.dueDate && new Date(inv.dueDate) < new Date());
                    const overdueBadge = inv.overdueDays > 0 ? `Quá hạn ${inv.overdueDays} ngày` : formatDate(inv.dueDate);

                    return (
                      <tr key={inv.invoiceId || inv._id}>
                        <td>
                          <strong>{roomNumber}</strong>
                          <small style={{ display: "block", color: "#64748b", fontSize: "11px" }}>
                            {branchName} {inv.tenant?.name ? `· ${inv.tenant.name}` : ""}
                          </small>
                        </td>
                        <td>{formatBillingPeriod(inv.billingPeriod)}</td>
                        <td>
                          <strong style={{ color: "#dc2626" }}>{formatCurrency(rem)}</strong>
                        </td>
                        <td>
                          <span className={`stitch-date-chip ${isOverdue ? "overdue" : ""}`}>
                            {overdueBadge}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            type="button"
                            className="stitch-zalo-copy-btn"
                            onClick={() => handleCopyZaloReminder(inv)}
                            title="Sao chép tin nhắn Zalo nhắc nợ kèm link thanh toán VietQR"
                          >
                            <Send size={13} />
                            <span>Nhắc Zalo</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Watchlist 2: Hợp Đồng Sắp Hết Hạn (Landlord) HOẶC Tình Trạng Phòng Cơ Sở (Manager) */}
        <div className="stitch-dash-card">
          {user?.role === "LANDLORD" ? (
            <>
              <div className="stitch-dash-card-header">
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div className="stitch-badge-icon amber">
                    <Clock size={16} />
                  </div>
                  <div>
                    <h2 className="stitch-dash-card-title">Hợp Đồng Sắp Hết Hạn ({contractWatchlist.expiringSoon.length})</h2>
                    <p className="stitch-dash-card-sub">
                      Các hợp đồng hết hạn trong 30 ngày cần gia hạn hoặc tìm khách mới
                    </p>
                  </div>
                </div>
                <Link to="/contracts" className="stitch-dash-card-link">
                  Hợp đồng <ArrowRight size={14} />
                </Link>
              </div>

              {contractWatchlist.expiringSoon.length === 0 ? (
                <div className="stitch-dash-empty-box" style={{ padding: "32px 16px" }}>
                  <ShieldCheck size={36} color="#0f766e" />
                  <p style={{ color: "#005c55", fontWeight: 600 }}>
                    Không có hợp đồng nào sắp hết hạn trong 30 ngày tới. Vận hành ổn định.
                  </p>
                </div>
              ) : (
                <div className="stitch-table-wrapper" style={{ maxHeight: "320px", overflowY: "auto" }}>
                  <table className="stitch-dash-table">
                    <thead>
                      <tr>
                        <th>Phòng &amp; Cơ sở</th>
                        <th>Khách thuê</th>
                        <th>Ngày kết thúc</th>
                        <th>Còn lại</th>
                        <th style={{ textAlign: "right" }}>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contractWatchlist.expiringSoon.slice(0, 6).map((c) => (
                        <tr key={c._id}>
                          <td>
                            <strong>{c.roomId?.roomNumber || c.roomNumber || "P.?"}</strong>
                            <small style={{ display: "block", color: "#64748b", fontSize: "11px" }}>
                              {c.branchId?.name || "Cơ sở"}
                            </small>
                          </td>
                          <td>
                            <span style={{ fontWeight: 600 }}>{c.tenantName || c.tenantId?.name || "-"}</span>
                            <small style={{ display: "block", color: "#64748b", fontSize: "11px" }}>
                              {c.tenantPhone || "-"}
                            </small>
                          </td>
                          <td>{formatDate(c.endDate)}</td>
                          <td>
                            <span className="stitch-date-chip amber">
                              Còn {c.diffDays} ngày
                            </span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <Link
                              to={`/contracts?search=${c.contractNumber || ""}`}
                              className="button secondary compact"
                              style={{ fontSize: "12px", padding: "4px 8px" }}
                            >
                              Xem HĐ
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="stitch-dash-card-header">
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div className="stitch-badge-icon teal">
                    <Building2 size={16} />
                  </div>
                  <div>
                    <h2 className="stitch-dash-card-title">Tình Trạng Phòng Cơ Sở ({activeBranches.length})</h2>
                    <p className="stitch-dash-card-sub">
                      Theo dõi số lượng phòng đang thuê và phòng trống theo từng cơ sở
                    </p>
                  </div>
                </div>
                <Link to="/rooms" className="stitch-dash-card-link">
                  Quản lý phòng <ArrowRight size={14} />
                </Link>
              </div>

              {activeBranches.length === 0 ? (
                <div className="stitch-dash-empty-box" style={{ padding: "32px 16px" }}>
                  <Building2 size={36} color="#94a3b8" />
                  <p>Bạn chưa được phân công cơ sở nào.</p>
                </div>
              ) : (
                <div className="stitch-table-wrapper" style={{ maxHeight: "320px", overflowY: "auto" }}>
                  <table className="stitch-dash-table">
                    <thead>
                      <tr>
                        <th>Cơ sở</th>
                        <th>Tổng phòng</th>
                        <th>Đang thuê</th>
                        <th>Phòng trống</th>
                        <th style={{ textAlign: "right" }}>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeBranches.map((b) => {
                        const totalR = b.roomStats?.total || 0;
                        const rentedR = b.roomStats?.rented || 0;
                        const vacantR = Math.max(0, totalR - rentedR);
                        return (
                          <tr key={b._id}>
                            <td>
                              <strong>{b.name}</strong>
                              <small style={{ display: "block", color: "#64748b", fontSize: "11px" }}>
                                {b.address?.city || b.address?.fullAddress || "Hà Nội"}
                              </small>
                            </td>
                            <td>
                              <strong>{totalR}</strong> phòng
                            </td>
                            <td>
                              <span style={{ color: "#047857", fontWeight: 700 }}>{rentedR}</span>
                              <small style={{ color: "#64748b" }}> ({totalR > 0 ? Math.round((rentedR / totalR) * 100) : 0}%)</small>
                            </td>
                            <td>
                              <span style={{ color: vacantR > 0 ? "#d97706" : "#64748b", fontWeight: 700 }}>
                                {vacantR}
                              </span>
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <Link
                                to={`/rooms?branchId=${b._id}`}
                                className="button secondary compact"
                                style={{ fontSize: "12px", padding: "4px 8px" }}
                              >
                                Xem phòng
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ================================================================= */}
      {/* 6. RECENT PAYMENTS FEED (VIETQR SEPAY & CASH)                     */}
      {/* ================================================================= */}
      <div className="stitch-dash-card" style={{ marginBottom: "24px" }}>
        <div className="stitch-dash-card-header">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div className="stitch-badge-icon teal">
              <CreditCard size={16} />
            </div>
            <div>
              <h2 className="stitch-dash-card-title">Dòng Tiền Thực Tế &amp; Giao Dịch Mới Nhất</h2>
              <p className="stitch-dash-card-sub">
                Các khoản tiền thuê đã thu qua VietQR SePay tự động và thu tiền mặt
              </p>
            </div>
          </div>
          <Link to="/payments" className="stitch-dash-card-link">
            Xem toàn bộ lịch sử thanh toán <ArrowRight size={14} />
          </Link>
        </div>

        {activePayments.length === 0 ? (
          <div className="stitch-dash-empty-box" style={{ padding: "32px 16px" }}>
            <CreditCard size={36} color="#94a3b8" />
            <p>Chưa có giao dịch thu tiền nào được ghi nhận.</p>
          </div>
        ) : (
          <div className="stitch-table-wrapper">
            <table className="stitch-dash-table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Mã giao dịch</th>
                  <th>Phòng / Chi nhánh</th>
                  <th>Phương thức</th>
                  <th>Số tiền</th>
                  <th style={{ textAlign: "right" }}>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {activePayments.slice(0, 5).map((p) => {
                  const isVietQR = p.paymentMethod === "VIETQR" || p.paymentMethod === "BANK_TRANSFER";
                  return (
                    <tr key={p._id}>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {formatDate(p.paidAt || p.createdAt, true)}
                      </td>
                      <td>
                        <code className="stitch-code-chip">{p.transactionCode || p._id?.slice(-8)}</code>
                      </td>
                      <td>
                        <strong>{p.invoiceId?.roomId?.roomNumber || p.roomNumber || "P.?"}</strong>
                        <span style={{ color: "#64748b", fontSize: "12px", marginLeft: "4px" }}>
                          ({p.branchId?.name || "Tòa nhà"})
                        </span>
                      </td>
                      <td>
                        <span
                          className="stitch-payment-method-chip"
                          style={{
                            backgroundColor: isVietQR ? "#eff6ff" : "#f1f5f9",
                            color: isVietQR ? "#1d4ed8" : "#475569",
                            border: isVietQR ? "1px solid #bfdbfe" : "1px solid #cbd5e1",
                          }}
                        >
                          {isVietQR ? "VietQR (SePay Tự động)" : "Tiền mặt xác nhận"}
                        </span>
                      </td>
                      <td>
                        <strong style={{ color: "#047857", fontSize: "14px" }}>
                          +{formatCurrency(p.amount)}
                        </strong>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span className="stitch-tag-pill primary" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <CheckCircle2 size={13} /> Khớp 100%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* 7. QUICK ACTION HUBS (HIGH-VELOCITY WORKFLOWS)                   */}
      {/* ================================================================= */}
      <section className="stitch-dash-shortcuts">
        <h3 className="stitch-shortcuts-heading">Phím Tắt Nghiệp Vụ Vận Hành</h3>
        <div className="stitch-shortcuts-grid">
          {user?.role === "LANDLORD" ? (
            <>
              <div
                className="stitch-shortcut-tile"
                onClick={() => setIsQuickInvoiceOpen(true)}
              >
                <div className="shortcut-icon teal">
                  <Receipt size={20} />
                </div>
                <div>
                  <strong>Tạo hóa đơn tháng mới</strong>
                  <p>Lập bảng kê điện nước và phát hành hóa đơn</p>
                </div>
              </div>

              <div
                className="stitch-shortcut-tile"
                onClick={() => navigate("/contracts?create=1")}
              >
                <div className="shortcut-icon indigo">
                  <FileText size={20} />
                </div>
                <div>
                  <strong>Ký hợp đồng khách mới</strong>
                  <p>Cấp tài khoản CCCD và ghi nhận cọc</p>
                </div>
              </div>

              <div
                className="stitch-shortcut-tile"
                onClick={() => navigate("/rooms")}
              >
                <div className="shortcut-icon amber">
                  <DoorOpen size={20} />
                </div>
                <div>
                  <strong>Sơ đồ &amp; Trạng thái phòng</strong>
                  <p>Quản lý phòng trống, vệ sinh và sửa chữa</p>
                </div>
              </div>

              <div
                className="stitch-shortcut-tile"
                onClick={() => navigate("/unmatched")}
              >
                <div className="shortcut-icon red">
                  <Scale size={20} />
                </div>
                <div>
                  <strong>Đối soát SePay sai cú pháp</strong>
                  <p>Xử lý giao dịch nhận tiền chưa khớp</p>
                </div>
              </div>
            </>
          ) : (
            <>
              <div
                className="stitch-shortcut-tile"
                onClick={() => navigate("/rooms")}
              >
                <div className="shortcut-icon amber">
                  <DoorOpen size={20} />
                </div>
                <div>
                  <strong>Sơ đồ &amp; Trạng thái phòng</strong>
                  <p>Quản lý phòng trống, kiểm tra dọn vệ sinh</p>
                </div>
              </div>

              <div
                className="stitch-shortcut-tile"
                onClick={() => navigate("/utility-readings")}
              >
                <div className="shortcut-icon teal">
                  <Zap size={20} />
                </div>
                <div>
                  <strong>Chốt số điện nước</strong>
                  <p>Cập nhật số công tơ điện nước cơ sở</p>
                </div>
              </div>

              <div
                className="stitch-shortcut-tile"
                onClick={() => navigate("/incidents")}
              >
                <div className="shortcut-icon red">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <strong>Sự cố &amp; Yêu cầu sửa chữa</strong>
                  <p>Xử lý bảo trì thiết bị và phản ánh cư dân</p>
                </div>
              </div>

              <div
                className="stitch-shortcut-tile"
                onClick={() => navigate("/invoices")}
              >
                <div className="shortcut-icon indigo">
                  <Receipt size={20} />
                </div>
                <div>
                  <strong>Hóa đơn &amp; Báo cáo thu tiền</strong>
                  <p>Rà soát hóa đơn phòng và nộp tiền mặt</p>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Modal Quick Generate Invoice */}
      {isQuickInvoiceOpen && (
        <InvoiceGenerateModal
          isOpen={true}
          defaultBranchId={filterBranchId}
          onClose={() => setIsQuickInvoiceOpen(false)}
          onGenerated={() => {
            setIsQuickInvoiceOpen(false);
            loadDashboardData(true);
            toast.success("Đã sinh hóa đơn thành công!");
          }}
        />
      )}
    </div>
  );
}
