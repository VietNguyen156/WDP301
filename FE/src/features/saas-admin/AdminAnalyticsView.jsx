import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Users,
  Building,
  CreditCard,
  Wallet,
  TrendingUp,
  AlertTriangle,
  AlertOctagon,
  Clock,
  Calendar,
  RotateCw,
  Download,
  Zap,
  ArrowUpRight,
  ShieldCheck,
  Filter,
} from "lucide-react";
import { adminApi, errorMessage } from "../../services/api";
import { money } from "../../utils/format";
import { useToast } from "../../context/ToastContext";
import { LoadingState, ErrorState, EmptyState, Button } from "../../components/ui";
import { useLiveRefresh } from "../../hooks/useLiveRefresh";

export function AdminAnalyticsView({ onNavigateTab }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [landlordsList, setLandlordsList] = useState([]);
  const [priorityFilter, setPriorityFilter] = useState("ALL");

  // Date range filters
  const [from, setFrom] = useState(() =>
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  );
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const fetchStats = useCallback(async (silent) => {
    if (silent !== true) setLoading(true);
    setError(null);
    try {
      const [statsRes, landlordsRes] = await Promise.allSettled([
        adminApi.getAnalytics({ from, to }),
        adminApi.listLandlords({ limit: 100 }),
      ]);

      if (statsRes.status === "fulfilled") {
        setStats(statsRes.value);
      } else {
        throw statsRes.reason;
      }

      if (landlordsRes.status === "fulfilled" && landlordsRes.value?.items) {
        setLandlordsList(landlordsRes.value.items);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [from, to]);
  useLiveRefresh(["admin","plans","subscription"], () => fetchStats(true));

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  function setPreset(days) {
    const end = new Date();
    const start = new Date();
    if (days === "month") {
      const first = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString()
        .slice(0, 10);
      setFrom(first);
      setTo(new Date().toISOString().slice(0, 10));
      return;
    }
    if (days === "all") {
      setFrom("2026-01-01");
      setTo(new Date().toISOString().slice(0, 10));
      return;
    }
    start.setDate(end.getDate() - days);
    setFrom(start.toISOString().slice(0, 10));
    setTo(end.toISOString().slice(0, 10));
  }

  // Handle Export report
  const handleExportReport = () => {
    toast.info("Đang tạo tệp tổng hợp dữ liệu SaaS kỳ này...");
    setTimeout(() => {
      window.print();
    }, 500);
  };

  // Calculate Plan Distribution from live data
  const planDistribution = useMemo(() => {
    const total = landlordsList.length || stats?.users?.landlords || 0;
    let freeCount = 0;
    let starterCount = 0;
    let proCount = 0;
    let enterpriseCount = 0;

    if (landlordsList.length > 0) {
      landlordsList.forEach((landlord) => {
        const code = landlord.subscriptionId?.planId?.code?.toUpperCase() || "";
        const price = landlord.subscriptionId?.planId?.price || 0;
        if (!landlord.subscriptionId || code === "FREE_TRIAL" || price === 0) {
          freeCount++;
        } else if (code === "STARTER" || price <= 199000) {
          starterCount++;
        } else if (code === "ENTERPRISE" || price >= 999000) {
          enterpriseCount++;
        } else {
          proCount++;
        }
      });
    }

    const freePct = total ? Math.round((freeCount / total) * 100) : 0;
    const starterPct = total ? Math.round((starterCount / total) * 100) : 0;
    const proPct = total ? Math.round((proCount / total) * 100) : 0;
    const entPct = total ? Math.max(0, 100 - freePct - starterPct - proPct) : 0;

    return {
      total,
      free: { count: freeCount, pct: freePct },
      starter: { count: starterCount, pct: starterPct },
      pro: { count: proCount, pct: proPct },
      enterprise: { count: enterpriseCount, pct: entPct },
    };
  }, [landlordsList, stats]);

  // Dynamic Event Logs
  const eventLogs = useMemo(() => {
    const events = [];
    const saas = stats?.saas;
    const users = stats?.users;

    // 1. Overdue Invoices Alert
    if ((saas?.overdueInvoiceCount || 0) > 0) {
      events.push({
        id: "overdue-invoices",
        priority: "HIGH",
        priorityText: "Cao",
        type: "Hóa đơn SaaS Quá hạn",
        icon: AlertOctagon,
        iconColor: "#dc2626",
        title: `Phát hiện ${saas.overdueInvoiceCount} hóa đơn SaaS quá hạn chưa thanh toán`,
        detail: "Cần kiểm tra đối soát hoặc đôn đốc chủ chuỗi thanh toán để duy trì tài khoản",
        time: "Cần xử lý ngay",
        status: "Chờ Admin đôn đốc",
        statusBadgeClass: "stitch-badge-danger",
        actionText: "Kiểm tra hóa đơn",
        onAction: () => onNavigateTab?.("invoices"),
      });
    }

    // 2. Expiring Subscriptions Alert
    if ((saas?.expiringWithin7Days || 0) > 0) {
      events.push({
        id: "expiring-subs",
        priority: "MEDIUM",
        priorityText: "Trung bình",
        type: "Thuê bao sắp hết hạn",
        icon: Clock,
        iconColor: "#d97706",
        title: `Có ${saas.expiringWithin7Days} gói thuê bao ACTIVE sắp tới hạn gia hạn trong 7 ngày`,
        detail: "Hệ thống sẽ gửi thông báo tự động; Admin có thể gia hạn hoặc nâng cấp gói trước",
        time: "Trong 7 ngày",
        status: "Chờ gia hạn",
        statusBadgeClass: "stitch-badge-warning",
        actionText: "Xử lý thuê bao",
        onAction: () => onNavigateTab?.("subscriptions"),
      });
    }

    // 3. Suspended Accounts
    if ((users?.suspendedAccounts || 0) > 0) {
      events.push({
        id: "suspended-users",
        priority: "MEDIUM",
        priorityText: "Trung bình",
        type: "Tài khoản bị tạm khóa",
        icon: AlertTriangle,
        iconColor: "#ea580c",
        title: `Có ${users.suspendedAccounts} tài khoản trong hệ thống đang ở trạng thái SUSPENDED`,
        detail: "Các tài khoản vi phạm hoặc theo biên bản xử lý; quyền truy cập và session đã thu hồi",
        time: "Đang hiệu lực",
        status: "Đang tạm khóa",
        statusBadgeClass: "stitch-badge-warning",
        actionText: "Quản lý chủ trọ",
        onAction: () => onNavigateTab?.("landlords"),
      });
    }

    // 4. New Landlord Signups
    if ((users?.newAccounts || 0) > 0) {
      events.push({
        id: "new-accounts",
        priority: "NORMAL",
        priorityText: "Thông thường",
        type: "Chủ trọ mới gia nhập",
        icon: Users,
        iconColor: "#0284c7",
        title: `Ghi nhận +${users.newAccounts} tài khoản mới tạo trong kỳ thống kê`,
        detail: "Chủ trọ đã được cấp gói dùng thử và tự động kích hoạt quyền quản trị cơ sở",
        time: "Kỳ này",
        status: "Đã kích hoạt",
        statusBadgeClass: "stitch-badge-info",
        actionText: "Xem danh sách",
        onAction: () => onNavigateTab?.("landlords"),
      });
    }

    // 5. SePay Webhook Status
    events.push({
      id: "sepay-status",
      priority: "NORMAL",
      priorityText: "Thông thường",
      type: "Cổng VietQR SePay",
      icon: Zap,
      iconColor: "#005c55",
      title: "Cổng thanh toán tự động VietQR kết nối liên ngân hàng NAPAS 247",
      detail: `Đã ghi nhận ${saas?.paidInvoiceCount || 0} hóa đơn SaaS đã thanh toán trong kỳ`,
      time: "Theo kỳ báo cáo",
      status: "Chưa có dữ liệu giám sát",
      statusBadgeClass: "stitch-badge-neutral",
    });

    return events;
  }, [stats, onNavigateTab]);

  const filteredEvents = useMemo(() => {
    if (priorityFilter === "ALL") return eventLogs;
    return eventLogs.filter((evt) => evt.priority === priorityFilter);
  }, [eventLogs, priorityFilter]);

  if (loading && !stats) {
    return <LoadingState message="Đang nạp dữ liệu vận hành Super Admin..." />;
  }

  if (error && !stats) {
    return <ErrorState message={error} retry={fetchStats} />;
  }

  const { users, saas, property } = stats || {};
  const totalLandlords = users?.landlords || 0;
  const activeLandlords = Math.max(0, totalLandlords - (users?.suspendedAccounts || 0));
  const activePercent = totalLandlords > 0 ? Math.round((activeLandlords / totalLandlords) * 100) : 100;
  const totalRooms = property?.activeRoomCount || 0;
  // Estimated branches based on active rooms (average 12 rooms/branch) or minimum 1

  return (
    <div className="admin-view-body animate-fade-in">
      {/* ========================================================
          TOP DIAGNOSTIC STATUS STRIP (Matching Stitch Header Specs)
          ======================================================== */}
      <div className="stitch-diag-strip">
        <div className="stitch-diag-left">
          <div className="stitch-diag-badge success">
            <span className="stitch-diag-dot success"></span>
            <span>Uptime: <strong>Chưa có dữ liệu</strong></span>
          </div>
          <div className="stitch-diag-badge info">
            <span className="stitch-diag-dot info"></span>
            <span>DB Load: <strong>Chưa có dữ liệu</strong></span>
          </div>
          <div className="stitch-diag-badge teal">
            <span className="stitch-diag-dot teal pulse"></span>
            <span>SePay Webhook: <strong>Chưa có dữ liệu</strong></span>
          </div>
          <div className="stitch-diag-node">
            <ShieldCheck size={13} color="#0f766e" />
            <span>Thông tin hạ tầng chưa được cung cấp từ API</span>
          </div>
        </div>

        <div className="stitch-diag-right">
          <button
            type="button"
            className="stitch-action-link"
            onClick={() => onNavigateTab?.("landlords")}
          >
            + Cấp quyền Landlord
          </button>
          <span className="stitch-action-link">
            SePay: chưa có dữ liệu giám sát
          </span>
        </div>
      </div>

      {/* ========================================================
          PAGE HEADER (Title & Master Control Action Group)
          ======================================================== */}
      <div className="stitch-page-header">
        <div className="stitch-header-titles">
          <div className="stitch-title-badge-row">
            <h1 className="stitch-page-title">
              Tổng quan Vận hành Nền tảng Toàn sàn
            </h1>
            <span className="stitch-badge-super-view">
              Super Admin View
            </span>
          </div>
          <p className="stitch-page-subtitle">
            Giám sát thời gian thực quy mô cơ sở lưu trú, lưu lượng luân chuyển dòng tiền SePay và thuê bao gói dịch vụ SaaS.
          </p>
        </div>

        <div className="stitch-header-actions">
          <span className="stitch-btn-secondary">
            Hạ tầng Cloud: chưa có dữ liệu từ API
          </span>
          <button
            type="button"
            className="stitch-btn-primary"
            onClick={handleExportReport}
          >
            <Download size={15} />
            <span>Xuất báo cáo hệ thống</span>
          </button>
        </div>
      </div>

      {/* ========================================================
          CONTROL / FILTER BAR (Date Range & Quick Presets)
          ======================================================== */}
      <div className="admin-control-bar">
        <div className="admin-filters-left">
          <Calendar size={18} color="#005c55" />
          <div className="admin-date-group">
            <span className="admin-date-label">Kỳ thống kê:</span>
            <input
              type="date"
              className="admin-input-compact"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
            <span className="admin-date-separator">đến</span>
            <input
              type="date"
              className="admin-input-compact"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>

          <div className="admin-presets-wrap">
            <button
              type="button"
              className="admin-action-btn"
              onClick={() => setPreset("month")}
            >
              Tháng này
            </button>
            <button
              type="button"
              className="admin-action-btn"
              onClick={() => setPreset(7)}
            >
              7 ngày qua
            </button>
            <button
              type="button"
              className="admin-action-btn"
              onClick={() => setPreset("all")}
            >
              Toàn sàn
            </button>
          </div>
        </div>

        <Button compact variant="secondary" onClick={fetchStats} busy={loading}>
          <RotateCw size={14} />
          <span>Làm mới dữ liệu</span>
        </Button>
      </div>

      {/* ========================================================
          SECTION 1: 4 PRIMARY METRIC CARDS (Exact Stitch Layout)
          ======================================================== */}
      <div className="admin-metrics-grid">
        {/* Metric 1: Chủ trọ trên Hệ thống */}
        <div
          className="stitch-metric-card"
          onClick={() => onNavigateTab?.("landlords")}
          title="Bấm để xem danh sách Chủ trọ"
        >
          <div className="stitch-metric-header">
            <span className="stitch-metric-label">Chủ trọ trên Hệ thống</span>
            <div className="stitch-metric-icon teal">
              <Users size={18} />
            </div>
          </div>
          <div className="stitch-metric-value-wrap">
            <span className="stitch-metric-number">{totalLandlords}</span>
            <span className="stitch-metric-unit">chủ trọ</span>
          </div>
          <div className="stitch-metric-footer">
            <div className="stitch-metric-trend up">
              <TrendingUp size={15} />
              <span>+{users?.newAccounts || 0} kỳ này</span>
            </div>
            <span className="stitch-pill success">{activePercent}% active</span>
          </div>
        </div>

        {/* Metric 2: Tổng Tòa nhà / Cơ sở */}
        <div className="stitch-metric-card">
          <div className="stitch-metric-header">
            <span className="stitch-metric-label">Tổng Tòa nhà / Cơ sở</span>
            <div className="stitch-metric-icon blue">
              <Building size={18} />
            </div>
          </div>
          <div className="stitch-metric-value-wrap">
            <span className="stitch-metric-number">-</span>
            <span className="stitch-metric-unit">tòa nhà</span>
          </div>
          <div className="stitch-metric-footer">
            <div className="stitch-metric-subtext">
            Quy mô phòng: <strong>{totalRooms}</strong>
            </div>
            <span className="stitch-pill neutral">Số cơ sở chưa có trong API</span>
          </div>
        </div>

        {/* Metric 3: GMV VietQR SePay Tháng Này */}
        <div
          className="stitch-metric-card"
          onClick={() => onNavigateTab?.("invoices")}
          title="Bấm để xem chi tiết đối soát thu tiền"
        >
          <div className="stitch-metric-header">
            <span className="stitch-metric-label">GMV VietQR SePay Tháng Này</span>
            <div className="stitch-metric-icon amber">
              <CreditCard size={18} />
            </div>
          </div>
          <div className="stitch-metric-value-wrap">
            <span className="stitch-metric-number highlight-teal">
              {money(saas?.collectedAmount || 0)}
            </span>
          </div>
          <div className="stitch-metric-footer">
            <div className="stitch-metric-subtext-dot">
              <span className="stitch-dot success"></span>
              <span>{saas?.paidInvoiceCount || 0} lượt gạch nợ tự động</span>
            </div>
            <span className="stitch-pill neutral">Chưa có dữ liệu đối soát</span>
          </div>
        </div>

        {/* Metric 4: Doanh thu SaaS (MRR) */}
        <div
          className="stitch-metric-card"
          onClick={() => onNavigateTab?.("subscriptions")}
          title="Bấm để xem danh sách thuê bao SaaS"
        >
          <div className="stitch-metric-header">
            <span className="stitch-metric-label">Doanh thu SaaS (MRR)</span>
            <div className="stitch-metric-icon purple">
              <Wallet size={18} />
            </div>
          </div>
          <div className="stitch-metric-value-wrap">
            <span className="stitch-metric-number">
              {money(saas?.mrr || 0)}
            </span>
            <span className="stitch-metric-unit">đ/tháng</span>
          </div>
          <div className="stitch-metric-footer">
            <div className="stitch-metric-trend up">
              <ArrowUpRight size={15} />
              <span>+{saas?.trialConversionRate || 0}% chuyển đổi</span>
            </div>
            <span className="stitch-pill purple">Định kỳ</span>
          </div>
        </div>
      </div>

      {/* ========================================================
          SECTION 2: CHARTS & ANALYTICS (12-Col Grid)
          ======================================================== */}
      <div className="stitch-analytics-grid">
        {/* Left: 6-Month Growth Area/Bar Chart (7 cols) */}
        <div className="stitch-chart-card">
          <div className="stitch-card-header">
            <div>
              <h2 className="stitch-card-title">Tăng trưởng Cơ sở & Chủ trọ mới</h2>
              <p className="stitch-card-subtitle">
                Thống kê số lượng phòng và chủ trọ gia nhập hệ sinh thái DOMUS (6 tháng gần nhất)
              </p>
            </div>
            <div className="stitch-legend-inline">
              <span className="stitch-legend-item">
                <span className="stitch-legend-color indigo"></span>
                <span>Số phòng mới</span>
              </span>
              <span className="stitch-legend-item">
                <span className="stitch-legend-color emerald"></span>
                <span>Chủ trọ mới</span>
              </span>
            </div>
          </div>

          {/* Trend data is not part of the current analytics API contract. */}
          <div className="stitch-svg-container">
            <EmptyState
              title="Chưa có dữ liệu xu hướng"
              description="API analytics hiện chỉ trả về số liệu tổng hợp theo kỳ, chưa có chuỗi dữ liệu theo tháng."
            />
          </div>
        </div>

        {/* Right: Subscription Breakdown & Gateway Pulse (5 cols) */}
        <div className="stitch-side-cards-col">
          {/* Card A: Phân bố Gói Cước SaaS */}
          <div className="stitch-card-box">
            <div className="stitch-card-header">
              <h3 className="stitch-card-title-sm">Phân bố Gói Cước SaaS</h3>
              <span className="stitch-card-meta">{planDistribution.total} tài khoản</span>
            </div>

            {/* Segmented Progress Bar */}
            <div className="stitch-segmented-bar">
              <div
                className="stitch-seg-fill gray"
                style={{ width: `${planDistribution.free.pct}%` }}
                title={`Free Trial: ${planDistribution.free.pct}%`}
              />
              <div
                className="stitch-seg-fill blue"
                style={{ width: `${planDistribution.starter.pct}%` }}
                title={`Starter: ${planDistribution.starter.pct}%`}
              />
              <div
                className="stitch-seg-fill emerald"
                style={{ width: `${planDistribution.pro.pct}%` }}
                title={`Pro Chuỗi: ${planDistribution.pro.pct}%`}
              />
              <div
                className="stitch-seg-fill purple"
                style={{ width: `${planDistribution.enterprise.pct}%` }}
                title={`Enterprise: ${planDistribution.enterprise.pct}%`}
              />
            </div>

            {/* Legend Grid */}
            <div className="stitch-plan-legend-grid">
              <div className="stitch-legend-pill-box">
                <div className="stitch-pill-label">
                  <span className="stitch-dot-circle gray"></span>
                  <span>Free Trial ({planDistribution.free.pct}%)</span>
                </div>
                <span className="stitch-pill-val">{planDistribution.free.count}</span>
              </div>

              <div className="stitch-legend-pill-box">
                <div className="stitch-pill-label">
                  <span className="stitch-dot-circle blue"></span>
                  <span>Starter ({planDistribution.starter.pct}%)</span>
                </div>
                <span className="stitch-pill-val">{planDistribution.starter.count}</span>
              </div>

              <div className="stitch-legend-pill-box">
                <div className="stitch-pill-label">
                  <span className="stitch-dot-circle emerald"></span>
                  <span>Pro Chuỗi ({planDistribution.pro.pct}%)</span>
                </div>
                <span className="stitch-pill-val highlight-emerald">
                  {planDistribution.pro.count}
                </span>
              </div>

              <div className="stitch-legend-pill-box">
                <div className="stitch-pill-label">
                  <span className="stitch-dot-circle purple"></span>
                  <span>Enterprise ({planDistribution.enterprise.pct}%)</span>
                </div>
                <span className="stitch-pill-val highlight-purple">
                  {planDistribution.enterprise.count}
                </span>
              </div>
            </div>
          </div>

          {/* Card B: SePay & Cổng Ngân Hàng Status */}
          <div className="stitch-card-box">
            <div className="stitch-card-header">
              <div className="stitch-title-with-icon">
                <Zap size={18} color="#005c55" />
                <h3 className="stitch-card-title-sm">SePay &amp; Cổng Ngân Hàng</h3>
              </div>
              <span className="stitch-pill neutral">
                <span>Chưa có dữ liệu giám sát</span>
              </span>
            </div>

            <div className="stitch-gateway-metrics-row">
              <div className="stitch-gw-stat">
                <div className="stitch-gw-label">Độ trễ trung bình</div>
                <div className="stitch-gw-num text-emerald">-</div>
              </div>
              <div className="stitch-gw-stat">
                <div className="stitch-gw-label">Tỷ lệ khớp lệnh</div>
                <div className="stitch-gw-num text-teal">-</div>
              </div>
              <div className="stitch-gw-stat">
                <div className="stitch-gw-label">VietQR Banks</div>
                <div className="stitch-gw-num">-</div>
              </div>
            </div>

            <div className="stitch-gw-footer">
              <span>Hàng đợi Webhook: <strong>Chưa có dữ liệu</strong></span>
              <button
                type="button"
                className="stitch-link-btn"
                onClick={() => onNavigateTab?.("invoices")}
              >
                Xem nhật ký Hóa đơn & Thu tiền →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================
          SECTION 3: SYSTEM ALERTS & EVENT LOG (Stitch Real-time Table)
          ======================================================== */}
      <div className="stitch-alerts-box">
        <div className="stitch-alerts-header">
          <div>
            <h2 className="stitch-alerts-title">Cảnh báo Thời gian thực &amp; Sự kiện Nền tảng</h2>
            <p className="stitch-alerts-subtitle">
              Các trường hợp cần can thiệp vận hành của Super Admin Master
            </p>
          </div>

          <div className="stitch-alerts-controls">
            <div className="stitch-filter-select-wrap">
              <Filter size={14} color="#d97706" />
              <select
                className="stitch-select-compact"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
              >
                <option value="ALL">Tất cả mức độ ưu tiên</option>
                <option value="HIGH">Mức độ Cao (Khẩn cấp)</option>
                <option value="MEDIUM">Mức độ Trung bình</option>
                <option value="NORMAL">Mức độ Thông thường</option>
              </select>
            </div>
            <button
              type="button"
              className="stitch-text-btn"
              onClick={() => toast.success("Đã ghi nhận tất cả cảnh báo vận hành")}
            >
              Đánh dấu đã đọc tất cả
            </button>
          </div>
        </div>

        {/* Table of Events */}
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: 110 }}>Mức độ</th>
                <th style={{ width: 200 }}>Loại sự kiện</th>
                <th>Chi tiết sự kiện &amp; Chủ thể</th>
                <th style={{ width: 130 }}>Thời gian</th>
                <th style={{ width: 160 }}>Trạng thái xử lý</th>
                <th style={{ width: 140, textAlign: "right" }}>Thao tác Admin</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "30px 16px", color: "#64748b" }}>
                    Không có sự kiện hoặc cảnh báo nào trong bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((evt) => {
                  const Icon = evt.icon;
                  return (
                    <tr key={evt.id} className="stitch-event-row">
                      {/* Priority */}
                      <td>
                        <span className={`stitch-priority-pill ${evt.priority.toLowerCase()}`}>
                          <span className={`stitch-priority-dot ${evt.priority.toLowerCase()}`}></span>
                          <span>{evt.priorityText}</span>
                        </span>
                      </td>

                      {/* Event Type */}
                      <td>
                        <div className="stitch-event-type-wrap">
                          <Icon size={16} color={evt.iconColor} />
                          <span className="stitch-event-type-text">{evt.type}</span>
                        </div>
                      </td>

                      {/* Detail */}
                      <td>
                        <div className="stitch-event-title">{evt.title}</div>
                        <div className="stitch-event-detail">{evt.detail}</div>
                      </td>

                      {/* Time */}
                      <td style={{ whiteSpace: "nowrap", color: "#64748b", fontSize: 12.5 }}>
                        {evt.time}
                      </td>

                      {/* Status */}
                      <td>
                        <span className={`stitch-status-pill ${evt.statusBadgeClass}`}>
                          {evt.status}
                        </span>
                      </td>

                      {/* Action */}
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button
                          type="button"
                          className="stitch-row-action-btn"
                          onClick={evt.onAction}
                        >
                          {evt.actionText}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="stitch-alerts-footer">
          <div className="stitch-alerts-counter">
            Hiển thị <strong>{filteredEvents.length}</strong> trên <strong>{eventLogs.length}</strong> cảnh báo &amp; sự kiện hệ thống
          </div>
          <div className="stitch-alerts-pagination">
            <button type="button" className="stitch-page-btn" disabled>
              Trước
            </button>
            <button type="button" className="stitch-page-btn active">
              1
            </button>
            <button type="button" className="stitch-page-btn" disabled>
              Sau
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
