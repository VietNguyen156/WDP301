import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Users,
  DoorOpen,
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
  CheckCircle2,
  Filter,
  Landmark,
  Link2,
  ArrowRight,
} from "lucide-react";
import { adminApi, errorMessage } from "../../services/api";
import { money, today } from "../../utils/format";

// YYYY-MM-DD of a Vietnam calendar day, n days before today.
const vnDay = (daysAgo = 0) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(
    new Date(Date.now() - daysAgo * 86400000),
  );
const vnMonthStart = () => `${today().slice(0, 8)}01`;

// One colour per plan in the plan-mix card (cheapest first), grey for "no plan".
const PLAN_COLORS = ["#94a3b8", "#0284c7", "#059669", "#0f766e", "#7c3aed", "#d97706", "#db2777"];
import { useToast } from "../../context/ToastContext";
import { LoadingState, ErrorState, Button } from "../../components/ui";
import { useLiveRefresh } from "../../hooks/useLiveRefresh";

export function AdminAnalyticsView({ onNavigateTab }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [landlordsList, setLandlordsList] = useState([]);
  const [bankingSummary, setBankingSummary] = useState(null);
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [activePreset, setActivePreset] = useState("month");

  const [from, setFrom] = useState(vnMonthStart);
  const [to, setTo] = useState(today);

  const fetchStats = useCallback(
    async (silent) => {
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

        if (landlordsRes.status === "fulfilled") {
          setLandlordsList(landlordsRes.value?.items || []);
          setBankingSummary(landlordsRes.value?.bankingSummary || null);
        }
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [from, to],
  );

  useLiveRefresh(["admin", "plans", "subscription"], () => fetchStats(true));

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  function setPreset(presetKey) {
    setActivePreset(presetKey);
    setTo(today());
    if (presetKey === "month") setFrom(vnMonthStart());
    else if (presetKey === "all") setFrom("2026-01-01");
    else setFrom(vnDay(Number(presetKey)));
  }

  const handleExportReport = () => {
    toast.info("Đang chuẩn bị bản in báo cáo tổng hợp hệ thống SaaS...");
    setTimeout(() => {
      window.print();
    }, 400);
  };

  const planMix = useMemo(() => {
    const mix = stats?.saas?.planMix;
    const total = mix?.total || 0;
    const pct = (count) => (total ? Math.round((count / total) * 1000) / 10 : 0);
    const rows = (mix?.plans || []).map((p, i) => ({
      key: String(p.planId),
      name: p.name,
      code: p.code,
      price: p.price,
      isActive: p.isActive,
      count: p.count,
      pct: pct(p.count),
      color: PLAN_COLORS[i % PLAN_COLORS.length],
    }));
    if (mix?.withoutPlan)
      rows.push({
        key: "none",
        name: "Chưa có gói hiệu lực",
        code: "",
        price: null,
        isActive: true,
        count: mix.withoutPlan,
        pct: pct(mix.withoutPlan),
        color: "#e2e8f0",
      });
    const paying = (mix?.plans || []).filter((p) => p.price > 0).reduce((n, p) => n + p.count, 0);
    return { total, rows, paying };
  }, [stats]);

  const unmatchedTotal = useMemo(
    () =>
      landlordsList.reduce(
        (sum, l) => sum + (l.banking?.pendingUnmatched || 0),
        0,
      ),
    [landlordsList],
  );

  const eventLogs = useMemo(() => {
    const events = [];
    const saas = stats?.saas;
    const users = stats?.users;

    if ((saas?.overdueInvoiceCount || 0) > 0) {
      events.push({
        id: "overdue-invoices",
        priority: "HIGH",
        priorityText: "Khẩn cấp",
        type: "Hóa đơn SaaS Quá hạn",
        icon: AlertOctagon,
        iconColor: "#dc2626",
        title: `Phát hiện ${saas.overdueInvoiceCount} hóa đơn SaaS quá hạn chưa thanh toán`,
        detail:
          "Cần kiểm tra đối soát hoặc đôn đốc chủ chuỗi thanh toán để duy trì gói thuê bao.",
        time: "Cần xử lý ngay",
        status: "Chờ thu hồi",
        statusBadgeClass: "stitch-badge-danger",
        actionText: "Kiểm tra hóa đơn",
        onAction: () => onNavigateTab?.("invoices"),
      });
    }

    if ((saas?.expiringWithin7Days || 0) > 0) {
      events.push({
        id: "expiring-subs",
        priority: "MEDIUM",
        priorityText: "Trung bình",
        type: "Thuê bao sắp hết hạn",
        icon: Clock,
        iconColor: "#d97706",
        title: `Có ${saas.expiringWithin7Days} gói thuê bao ACTIVE sắp hết hạn trong 7 ngày tới`,
        detail:
          "Admin có thể chủ động tạo kỳ gia hạn hoặc duyệt yêu cầu nâng cấp gói từ chủ trọ.",
        time: "Trong 7 ngày",
        status: "Sắp đáo hạn",
        statusBadgeClass: "stitch-badge-warning",
        actionText: "Quản lý thuê bao",
        onAction: () => onNavigateTab?.("subscriptions"),
      });
    }

    if ((users?.suspendedAccounts || 0) > 0) {
      events.push({
        id: "suspended-users",
        priority: "MEDIUM",
        priorityText: "Trung bình",
        type: "Tài khoản bị tạm khóa",
        icon: AlertTriangle,
        iconColor: "#ea580c",
        title: `Có ${users.suspendedAccounts} tài khoản trên hệ thống đang ở trạng thái SUSPENDED`,
        detail:
          "Phiên đăng nhập của các tài khoản này đã được thu hồi để đảm bảo an toàn vận hành.",
        time: "Đang hiệu lực",
        status: "Đang tạm khóa",
        statusBadgeClass: "stitch-badge-warning",
        actionText: "Xem chủ trọ",
        onAction: () => onNavigateTab?.("landlords"),
      });
    }

    if ((users?.newAccounts || 0) > 0) {
      events.push({
        id: "new-accounts",
        priority: "NORMAL",
        priorityText: "Thông thường",
        type: "Tài khoản mới gia nhập",
        icon: Users,
        iconColor: "#0284c7",
        title: `Ghi nhận +${users.newAccounts} tài khoản mới tạo trong kỳ thống kê`,
        detail:
          "Gồm chủ trọ tự đăng ký, quản lý và khách thuê được chủ trọ cấp tài khoản.",
        time: "Kỳ báo cáo",
        status: "Đã kích hoạt",
        statusBadgeClass: "stitch-badge-info",
        actionText: "Danh sách chủ trọ",
        onAction: () => onNavigateTab?.("landlords"),
      });
    }

    events.push({
      id: "sepay-status",
      priority: "NORMAL",
      priorityText: "Thông thường",
      type: "Đối soát Thu tiền SaaS",
      icon: Zap,
      iconColor: "#005c55",
      title: `Đã thu thành công ${saas?.paidInvoiceCount || 0} hóa đơn SaaS (${money(saas?.collectedAmount || 0)}) trong kỳ`,
      detail: `${bankingSummary?.linked || 0} chủ trọ đã liên kết SePay Bank Hub nhận đối soát tự động.`,
      time: "Theo kỳ báo cáo",
      status: "Đang hoạt động",
      statusBadgeClass: "stitch-badge-info",
      actionText: "Sổ hóa đơn SaaS",
      onAction: () => onNavigateTab?.("invoices"),
    });

    return events;
  }, [stats, bankingSummary, onNavigateTab]);

  const filteredEvents = useMemo(() => {
    if (priorityFilter === "ALL") return eventLogs;
    return eventLogs.filter((evt) => evt.priority === priorityFilter);
  }, [eventLogs, priorityFilter]);

  if (loading && !stats) {
    return <LoadingState message="Đang nạp dữ liệu điều hành toàn sàn..." />;
  }

  if (error && !stats) {
    return <ErrorState message={error} retry={fetchStats} />;
  }

  const { users, saas, property } = stats || {};
  const totalLandlords = users?.landlords || 0;
  const activeLandlords = Math.max(
    0,
    totalLandlords - (users?.suspendedLandlords || 0),
  );
  const activePercent =
    totalLandlords > 0
      ? Math.round((activeLandlords / totalLandlords) * 100)
      : 100;
  const totalRooms = property?.activeRoomCount || 0;
  const overdueInvoicesList = saas?.overdueInvoices || [];

  const funnelSteps = [
    {
      label: "Tổng Chủ trọ đăng ký",
      value: totalLandlords,
      pct: 100,
      tone: "slate",
      sub: `${activeLandlords} tài khoản đang hoạt động`,
    },
    {
      label: "Có thuê bao đang hiệu lực",
      value: saas?.activeLandlords || 0,
      pct: totalLandlords
        ? Math.min(100, Math.round(((saas?.activeLandlords || 0) / totalLandlords) * 100))
        : 0,
      tone: "blue",
      sub: `${saas?.expiringWithin7Days || 0} sắp hết hạn trong 7 ngày`,
    },
    {
      label: "Thuê bao trả phí (Paying)",
      value: saas?.payingLandlords || 0,
      pct: totalLandlords
        ? Math.min(100, Math.round(((saas?.payingLandlords || 0) / totalLandlords) * 100))
        : 0,
      tone: "emerald",
      sub: `Chuyển đổi từ dùng thử: ${saas?.trialConversionRate || 0}%`,
    },
    {
      label: "Đã liên kết SePay Bank Hub",
      value: bankingSummary?.linked || 0,
      pct: totalLandlords
        ? Math.min(100, Math.round(((bankingSummary?.linked || 0) / totalLandlords) * 100))
        : 0,
      tone: "teal",
      sub: "Tự động gạch nợ hóa đơn & tiền cọc",
    },
  ];

  return (
    <div className="admin-view-body animate-fade-in">
      {/* 1. Filter & Action Toolbar */}
      <div className="admin-control-bar admin-surface-toolbar">
        <div className="admin-filters-left">
          <div className="admin-date-group">
            <Calendar size={15} color="#005c55" />
            <span className="admin-date-label">Kỳ thống kê:</span>
            <input
              type="date"
              className="admin-input-compact"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setActivePreset("");
              }}
            />
            <span className="admin-date-separator">→</span>
            <input
              type="date"
              className="admin-input-compact"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setActivePreset("");
              }}
            />
          </div>

          <div className="plans-segmented">
            <button
              type="button"
              className={activePreset === "month" ? "is-active" : ""}
              onClick={() => setPreset("month")}
            >
              Tháng này
            </button>
            <button
              type="button"
              className={activePreset === 7 ? "is-active" : ""}
              onClick={() => setPreset(7)}
            >
              7 ngày qua
            </button>
            <button
              type="button"
              className={activePreset === "all" ? "is-active" : ""}
              onClick={() => setPreset("all")}
            >
              Toàn thời gian
            </button>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Button
            compact
            variant="secondary"
            onClick={() => fetchStats()}
            busy={loading}
          >
            <RotateCw size={14} />
            <span>Làm mới</span>
          </Button>
          <button
            type="button"
            className="stitch-btn-primary"
            onClick={handleExportReport}
          >
            <Download size={15} />
            <span>Xuất báo cáo</span>
          </button>
        </div>
      </div>

      {/* 2. 4 Executive KPI Cards */}
      <div className="admin-metrics-grid">
        {/* Card 1: MRR */}
        <div
          className="stitch-metric-card"
          onClick={() => onNavigateTab?.("subscriptions")}
          title="Bấm để quản lý Thuê bao SaaS"
        >
          <div className="stitch-metric-header">
            <span className="stitch-metric-label">Doanh thu Định kỳ (MRR)</span>
            <div className="stitch-metric-icon teal">
              <Wallet size={18} />
            </div>
          </div>
          <div className="stitch-metric-value-wrap">
            <span className="stitch-metric-number highlight-teal">
              {money(saas?.mrr || 0)}
            </span>
            <span className="stitch-metric-unit">/ tháng</span>
          </div>
          <div className="stitch-metric-footer">
            <div className="stitch-metric-trend up">
              <ArrowUpRight size={15} />
              <span>{saas?.payingLandlords || 0} thuê bao trả phí</span>
            </div>
            <span className="stitch-pill success">
              Trial → Paid: {saas?.trialConversionRate || 0}%
            </span>
          </div>
        </div>

        {/* Card 2: Thực thu SaaS kỳ này */}
        <div
          className="stitch-metric-card"
          onClick={() => onNavigateTab?.("invoices")}
          title="Bấm để xem Hóa đơn & Thu tiền SaaS"
        >
          <div className="stitch-metric-header">
            <span className="stitch-metric-label">Thực thu SaaS Kỳ này</span>
            <div className="stitch-metric-icon amber">
              <CreditCard size={18} />
            </div>
          </div>
          <div className="stitch-metric-value-wrap">
            <span className="stitch-metric-number">
              {money(saas?.collectedAmount || 0)}
            </span>
          </div>
          <div className="stitch-metric-footer">
            <div className="stitch-metric-subtext-dot">
              <span className="stitch-dot success" />
              <span>{saas?.paidInvoiceCount || 0} hóa đơn đã thu</span>
            </div>
            {(saas?.overdueInvoiceCount || 0) > 0 ? (
              <span className="stitch-pill danger">
                {saas.overdueInvoiceCount} quá hạn
              </span>
            ) : (
              <span className="stitch-pill success">0 quá hạn</span>
            )}
          </div>
        </div>

        {/* Card 3: Chủ trọ trên hệ thống */}
        <div
          className="stitch-metric-card"
          onClick={() => onNavigateTab?.("landlords")}
          title="Bấm để xem danh sách Chủ trọ"
        >
          <div className="stitch-metric-header">
            <span className="stitch-metric-label">Chủ trọ Toàn hệ thống</span>
            <div className="stitch-metric-icon blue">
              <Users size={18} />
            </div>
          </div>
          <div className="stitch-metric-value-wrap">
            <span className="stitch-metric-number">{totalLandlords}</span>
            <span className="stitch-metric-unit">chủ chuỗi</span>
          </div>
          <div className="stitch-metric-footer">
            <div className="stitch-metric-trend up">
              <TrendingUp size={15} />
              <span>+{users?.newAccounts || 0} tài khoản mới</span>
            </div>
            <span className="stitch-pill success">
              {activePercent}% hoạt động
            </span>
          </div>
        </div>

        {/* Card 4: Quy mô vận hành toàn sàn */}
        <div
          className="stitch-metric-card"
          onClick={() => onNavigateTab?.("plans")}
          title="Bấm để xem cấu hình Gói dịch vụ & Hạn ngạch"
        >
          <div className="stitch-metric-header">
            <span className="stitch-metric-label">Quy mô Phòng &amp; Nhân sự</span>
            <div className="stitch-metric-icon teal">
              <DoorOpen size={18} />
            </div>
          </div>
          <div className="stitch-metric-value-wrap">
            <span className="stitch-metric-number">{totalRooms}</span>
            <span className="stitch-metric-unit">phòng đang vận hành</span>
          </div>
          <div className="stitch-metric-footer">
            <div className="stitch-metric-subtext">
              <strong>{users?.managers || 0}</strong> quản lý ·{" "}
              <strong>{users?.tenants || 0}</strong> cư dân
            </div>
            <span className="stitch-pill neutral">Toàn sàn</span>
          </div>
        </div>
      </div>

      {/* 3. Analytical Insights Grid (7 Cols Left + 5 Cols Right) */}
      <div className="stitch-analytics-grid">
        {/* Left Column: Funnel + Overdue SaaS Invoices Watchlist */}
        <div className="stitch-chart-card" style={{ marginTop: 0, display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Part A: Subscription & Banking Funnel */}
          <div>
            <div className="stitch-card-header">
              <div>
                <h2 className="stitch-card-title">
                  Phễu Chuyển đổi Thuê bao &amp; Liên kết SePay
                </h2>
                <p className="stitch-card-subtitle">
                  Tỷ lệ chủ trọ kích hoạt gói dịch vụ, chuyển đổi trả phí và kết nối ngân hàng tự động
                </p>
              </div>
              <button
                type="button"
                className="stitch-link-btn"
                onClick={() => onNavigateTab?.("subscriptions")}
              >
                Chi tiết thuê bao <ArrowRight size={13} />
              </button>
            </div>

            <div className="admin-funnel-list">
              {funnelSteps.map((step) => (
                <div key={step.label} className="admin-funnel-item">
                  <div className="admin-funnel-top">
                    <div>
                      <strong className="admin-funnel-label">{step.label}</strong>
                      <span className="admin-funnel-sub">{step.sub}</span>
                    </div>
                    <div className="admin-funnel-nums">
                      <strong>{step.value}</strong>
                      <span>({step.pct}%)</span>
                    </div>
                  </div>
                  <div className="admin-funnel-track">
                    <div
                      className={`admin-funnel-fill ${step.tone}`}
                      style={{ width: `${Math.max(step.pct, step.value > 0 ? 6 : 0)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Part B: Overdue Platform Invoices Watchlist */}
          <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 18 }}>
            <div className="stitch-card-header" style={{ marginBottom: 12 }}>
              <div>
                <h3 className="stitch-card-title-sm">
                  Hóa đơn SaaS Quá hạn Cần Đôn đốc ({overdueInvoicesList.length})
                </h3>
                <p className="stitch-card-subtitle">
                  Danh sách chủ trọ chậm thanh toán phí thuê bao nền tảng
                </p>
              </div>
              <button
                type="button"
                className="stitch-link-btn"
                onClick={() => onNavigateTab?.("invoices")}
              >
                Mở sổ hóa đơn <ArrowRight size={13} />
              </button>
            </div>

            {overdueInvoicesList.length === 0 ? (
              <div className="admin-clean-status-banner">
                <CheckCircle2 size={20} color="#059669" />
                <div>
                  <strong>100% Hóa đơn SaaS đúng hạn</strong>
                  <p>
                    Hiện không có chủ trọ nào nợ quá hạn phí thuê bao nền tảng DOMUS.
                  </p>
                </div>
              </div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Mã HĐ</th>
                      <th>Chủ trọ</th>
                      <th>Gói cước</th>
                      <th>Số tiền</th>
                      <th>Trễ hạn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overdueInvoicesList.slice(0, 5).map((item) => (
                      <tr key={item.invoiceId}>
                        <td style={{ fontFamily: "monospace", fontWeight: 700 }}>
                          {item.invoiceCode}
                        </td>
                        <td>
                          <strong>{item.landlord?.name || "—"}</strong>
                          <div style={{ fontSize: 11, color: "#64748b" }}>
                            {item.landlord?.email || item.landlord?.phoneNumber || ""}
                          </div>
                        </td>
                        <td>
                          <span className="plan-code-badge">
                            {item.plan?.code || item.plan?.name || "SAAS"}
                          </span>
                        </td>
                        <td>
                          <strong style={{ color: "#dc2626" }}>
                            {money(item.amount || 0)}
                          </strong>
                        </td>
                        <td>
                          <span className="status-pill overdue">
                            Quá hạn {item.overdueDays || 1} ngày
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Plan Breakdown + Banking Integration Status */}
        <div className="stitch-side-cards-col">
          {/* Card A: Cơ cấu gói dịch vụ (gói đang hiệu lực của từng chủ trọ) */}
          <div className="stitch-card-box">
            <div className="stitch-card-header">
              <div>
                <h3 className="stitch-card-title-sm">Cơ cấu Gói dịch vụ SaaS</h3>
                <p className="stitch-card-subtitle">Theo gói đang hiệu lực của từng chủ trọ</p>
              </div>
              <span className="stitch-card-meta">
                {planMix.total} chủ trọ · {planMix.paying} trả phí
              </span>
            </div>

            {planMix.total === 0 ? (
              <p className="admin-planmix-empty">Chưa có chủ trọ nào trên hệ thống.</p>
            ) : (
              <>
                <div className="admin-planmix-bar" role="img" aria-label="Tỷ lệ chủ trọ theo gói">
                  {planMix.rows.map((row) => (
                    <span
                      key={row.key}
                      style={{ width: `${row.pct}%`, background: row.color }}
                      title={`${row.name}: ${row.count} (${row.pct}%)`}
                    />
                  ))}
                </div>
                <ul className="admin-planmix-list">
                  {planMix.rows.map((row) => (
                    <li key={row.key}>
                      <span className="admin-planmix-dot" style={{ background: row.color }} />
                      <div className="admin-planmix-name">
                        <strong>{row.name}</strong>
                        <small>
                          {row.price === null
                            ? "Hết hạn, đã hủy hoặc chưa đăng ký"
                            : row.price === 0
                              ? "Miễn phí"
                              : `${money(row.price)} / tháng`}
                          {!row.isActive && " · ngừng bán"}
                        </small>
                      </div>
                      <div className="admin-planmix-count">
                        <strong>{row.count}</strong>
                        <small>{row.pct}%</small>
                      </div>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="stitch-link-btn"
                  onClick={() => onNavigateTab?.("subscriptions")}
                >
                  Xem thuê bao theo gói <ArrowRight size={13} />
                </button>
              </>
            )}
          </div>

          {/* Card B: Liên kết Ngân hàng & SePay Bank Hub */}
          <div className="stitch-card-box">
            <div className="stitch-card-header">
              <div className="stitch-title-with-icon">
                <Landmark size={18} color="#005c55" />
                <h3 className="stitch-card-title-sm">
                  Liên kết SePay &amp; Ngân hàng
                </h3>
              </div>
              <span className="stitch-pill success">
                <Link2 size={12} /> Bank Hub Live
              </span>
            </div>

            <div className="stitch-gateway-metrics-row">
              <div className="stitch-gw-stat">
                <div className="stitch-gw-label">Đã nối Bank Hub</div>
                <div className="stitch-gw-num text-emerald">
                  {bankingSummary?.linked ?? 0}
                </div>
              </div>
              <div className="stitch-gw-stat">
                <div className="stitch-gw-label">Chỉ nhập STK tay</div>
                <div className="stitch-gw-num text-teal">
                  {bankingSummary?.manual ?? 0}
                </div>
              </div>
              <div className="stitch-gw-stat">
                <div className="stitch-gw-label">Chưa cấu hình</div>
                <div className="stitch-gw-num">
                  {bankingSummary?.none ?? 0}
                </div>
              </div>
            </div>

            <div className="stitch-gw-footer">
              <span>
                Giao dịch chờ đối soát:{" "}
                <strong style={{ color: unmatchedTotal > 0 ? "#b45309" : "#0f766e" }}>
                  {unmatchedTotal} giao dịch
                </strong>
              </span>
              <button
                type="button"
                className="stitch-link-btn"
                onClick={() => onNavigateTab?.("landlords")}
              >
                Giám sát TK nhận tiền →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Actionable System Alerts & Event Log */}
      <div className="stitch-alerts-box">
        <div className="stitch-alerts-header">
          <div>
            <h2 className="stitch-alerts-title">
              Tác vụ Cần Lưu ý &amp; Sự kiện Vận hành Nền tảng
            </h2>
            <p className="stitch-alerts-subtitle">
              Tổng hợp tự động các cảnh báo công nợ, thuê bao sắp đáo hạn và biến động tài khoản
            </p>
          </div>

          <div className="stitch-alerts-controls">
            <div className="stitch-filter-select-wrap">
              <Filter size={14} color="#0f766e" />
              <select
                className="stitch-select-compact"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
              >
                <option value="ALL">Tất cả mức độ ({eventLogs.length})</option>
                <option value="HIGH">Khẩn cấp (Cao)</option>
                <option value="MEDIUM">Cần lưu ý (Trung bình)</option>
                <option value="NORMAL">Thông thường</option>
              </select>
            </div>
          </div>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: 120 }}>Mức độ</th>
                <th style={{ width: 200 }}>Phân loại</th>
                <th>Chi tiết sự kiện &amp; Đề xuất xử lý</th>
                <th style={{ width: 130 }}>Phạm vi</th>
                <th style={{ width: 150 }}>Trạng thái</th>
                <th style={{ width: 150, textAlign: "right" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      textAlign: "center",
                      padding: "30px 16px",
                      color: "#64748b",
                    }}
                  >
                    Không có sự kiện hoặc cảnh báo nào trong bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((evt) => {
                  const Icon = evt.icon;
                  return (
                    <tr key={evt.id} className="stitch-event-row">
                      <td>
                        <span
                          className={`stitch-priority-pill ${evt.priority.toLowerCase()}`}
                        >
                          <span
                            className={`stitch-priority-dot ${evt.priority.toLowerCase()}`}
                          />
                          <span>{evt.priorityText}</span>
                        </span>
                      </td>
                      <td>
                        <div className="stitch-event-type-wrap">
                          <Icon size={16} color={evt.iconColor} />
                          <span className="stitch-event-type-text">
                            {evt.type}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="stitch-event-title">{evt.title}</div>
                        <div className="stitch-event-detail">{evt.detail}</div>
                      </td>
                      <td
                        style={{
                          whiteSpace: "nowrap",
                          color: "#64748b",
                          fontSize: 12.5,
                        }}
                      >
                        {evt.time}
                      </td>
                      <td>
                        <span
                          className={`stitch-status-pill ${evt.statusBadgeClass}`}
                        >
                          {evt.status}
                        </span>
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {evt.onAction && (
                          <button
                            type="button"
                            className="stitch-row-action-btn"
                            onClick={evt.onAction}
                          >
                            {evt.actionText}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
