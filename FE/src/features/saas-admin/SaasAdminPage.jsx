import React, { lazy, Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ShieldCheck,
  LayoutDashboard,
  Layers,
  Users,
  Crown,
  Receipt,
  Sparkles,
  ArrowUpCircle,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { LoadingState } from "../../components/ui";
import { adminApi } from "../../services/api";
import { useLiveRefresh } from "../../hooks/useLiveRefresh";
import "./SaasAdmin.css";

const tab = (load, name) =>
  lazy(() => load().then((m) => ({ default: m[name] })));
const AdminAnalyticsView = tab(
  () => import("./AdminAnalyticsView"),
  "AdminAnalyticsView",
);
const AdminPlansView = tab(() => import("./AdminPlansView"), "AdminPlansView");
const AdminLandlordsView = tab(
  () => import("./AdminLandlordsView"),
  "AdminLandlordsView",
);
const AdminSubscriptionsView = tab(
  () => import("./AdminSubscriptionsView"),
  "AdminSubscriptionsView",
);
const AdminInvoicesView = tab(
  () => import("./AdminInvoicesView"),
  "AdminInvoicesView",
);
const AdminUpgradeRequestsView = tab(
  () => import("./AdminUpgradeRequestsView"),
  "AdminUpgradeRequestsView",
);
const AdminSecurityView = tab(
  () => import("./AdminSecurityView"),
  "AdminSecurityView",
);

const TABS = [
  {
    id: "analytics",
    label: "Tổng quan Hệ thống",
    shortLabel: "Tổng quan",
    subtitle:
      "Giám sát doanh thu định kỳ MRR, quy mô chủ trọ, phễu chuyển đổi gói cước và cảnh báo vận hành toàn sàn.",
    icon: LayoutDashboard,
  },
  {
    id: "landlords",
    label: "Chủ trọ & Ngân hàng",
    shortLabel: "Chủ trọ",
    subtitle:
      "Quản lý trạng thái tài khoản chủ chuỗi, theo dõi liên kết SePay Bank Hub và đối soát tự động.",
    icon: Users,
  },
  {
    id: "plans",
    label: "Gói dịch vụ SaaS",
    shortLabel: "Gói cước",
    subtitle:
      "Thiết lập bảng giá, chu kỳ thu phí và hạn ngạch tài nguyên (Cơ sở, Phòng, Quản lý) cho từng gói cước.",
    icon: Layers,
  },
  {
    id: "subscriptions",
    label: "Thuê bao & Hạn ngạch",
    shortLabel: "Thuê bao",
    subtitle:
      "Quản lý vòng đời thuê bao, cấp mới hoặc gia hạn gói dịch vụ và tự động phát hành hóa đơn nền tảng.",
    icon: Crown,
  },
  {
    id: "upgrade-requests",
    label: "Yêu cầu đổi gói",
    shortLabel: "Đổi gói",
    subtitle:
      "Phê duyệt hoặc từ chối yêu cầu nâng cấp / gia hạn gói dịch vụ từ các chủ chuỗi cơ sở.",
    icon: ArrowUpCircle,
  },
  {
    id: "invoices",
    label: "Hóa đơn & Thu tiền",
    shortLabel: "Hóa đơn SaaS",
    subtitle:
      "Theo dõi công nợ hóa đơn nền tảng (PlatformInvoice) và xác nhận thanh toán kích hoạt thuê bao.",
    icon: Receipt,
  },
  {
    id: "security",
    label: "Bảo mật & Audit Log",
    shortLabel: "Audit Log",
    subtitle:
      "Tra cứu nhật ký kiểm toán bất biến cho mọi tác vụ quản trị tài khoản, thuê bao và thanh toán trên toàn sàn.",
    icon: ShieldCheck,
  },
];

export default function SaasAdminPage({ initialTab = "analytics" }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(urlTab || initialTab);
  const [badges, setBadges] = useState({
    pendingUpgrades: 0,
    overdueInvoices: 0,
    expiringSubs: 0,
  });

  useEffect(() => {
    if (urlTab && urlTab !== activeTab) {
      setActiveTab(urlTab);
    }
  }, [urlTab, activeTab]);

  const loadBadges = useCallback(async () => {
    try {
      const [upgRes, statsRes] = await Promise.allSettled([
        adminApi.listUpgradeRequests({ status: "PENDING", page: 1, limit: 1 }),
        adminApi.getAnalytics({}),
      ]);
      const pendingUpgrades =
        upgRes.status === "fulfilled" ? upgRes.value?.total || 0 : 0;
      const overdueInvoices =
        statsRes.status === "fulfilled"
          ? statsRes.value?.saas?.overdueInvoiceCount || 0
          : 0;
      const expiringSubs =
        statsRes.status === "fulfilled"
          ? statsRes.value?.saas?.expiringWithin7Days || 0
          : 0;
      setBadges({ pendingUpgrades, overdueInvoices, expiringSubs });
    } catch {
      // Ignore silent badge errors
    }
  }, []);

  useEffect(() => {
    loadBadges();
  }, [loadBadges]);

  useLiveRefresh(["admin", "plans", "subscription"], loadBadges);

  function handleTabChange(tabId) {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
  }

  const currentTabMeta =
    TABS.find((t) => t.id === activeTab) || TABS[0];

  const getTabBadge = (tabId) => {
    if (tabId === "upgrade-requests" && badges.pendingUpgrades > 0) {
      return { count: badges.pendingUpgrades, tone: "warning" };
    }
    if (tabId === "invoices" && badges.overdueInvoices > 0) {
      return { count: badges.overdueInvoices, tone: "danger" };
    }
    if (tabId === "subscriptions" && badges.expiringSubs > 0) {
      return { count: badges.expiringSubs, tone: "warning" };
    }
    return null;
  };

  return (
    <div className="admin-container admin-shell animate-fade-in">
      {/* Unified Executive Command Header */}
      <header className="admin-header-card admin-shell-header">
        <div className="admin-title-wrap">
          <div className="admin-shield-icon">
            <ShieldCheck size={26} />
          </div>
          <div className="admin-header-titles">
            <div className="admin-header-eyebrow-row">
              <span className="admin-badge-super">
                <Sparkles size={12} color="#a3faef" />
                <span>SUPER ADMIN CONSOLE</span>
              </span>
              <span className="admin-header-module-pill">
                {currentTabMeta.label}
              </span>
            </div>
            <h1>{currentTabMeta.label}</h1>
            <p>{currentTabMeta.subtitle}</p>
          </div>
        </div>

        {/* Live Actionable Status Chips */}
        <div className="admin-header-quick-chips">
          {badges.pendingUpgrades > 0 && (
            <button
              type="button"
              className="admin-header-alert-chip warning"
              onClick={() => handleTabChange("upgrade-requests")}
              title="Bấm để xử lý yêu cầu đổi gói chờ duyệt"
            >
              <ArrowUpCircle size={14} />
              <span>
                <strong>{badges.pendingUpgrades}</strong> yêu cầu đổi gói chờ duyệt
              </span>
            </button>
          )}
          {badges.overdueInvoices > 0 && (
            <button
              type="button"
              className="admin-header-alert-chip danger"
              onClick={() => handleTabChange("invoices")}
              title="Bấm để kiểm tra hóa đơn SaaS quá hạn"
            >
              <AlertTriangle size={14} />
              <span>
                <strong>{badges.overdueInvoices}</strong> hóa đơn SaaS quá hạn
              </span>
            </button>
          )}
          {badges.expiringSubs > 0 && (
            <button
              type="button"
              className="admin-header-alert-chip info"
              onClick={() => handleTabChange("subscriptions")}
              title="Bấm để xem các thuê bao sắp hết hạn trong 7 ngày"
            >
              <Clock size={14} />
              <span>
                <strong>{badges.expiringSubs}</strong> thuê bao sắp hết hạn
              </span>
            </button>
          )}
        </div>
      </header>

      {/* Segmented Navigation Bar */}
      <nav
        className="admin-tabs-nav admin-shell-tabs"
        role="tablist"
        aria-label="Phân hệ Quản trị Hệ thống"
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          const badge = getTabBadge(t.id);
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`admin-tab-btn ${isActive ? "is-active" : ""}`}
              onClick={() => handleTabChange(t.id)}
            >
              <Icon size={16} />
              <span>{t.label}</span>
              {badge && (
                <span className={`admin-tab-count ${badge.tone}`}>
                  {badge.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Active Tab Content */}
      <Suspense fallback={<LoadingState />}>
        {activeTab === "analytics" && (
          <AdminAnalyticsView onNavigateTab={handleTabChange} />
        )}
        {activeTab === "plans" && <AdminPlansView />}
        {activeTab === "landlords" && (
          <AdminLandlordsView onNavigateTab={handleTabChange} />
        )}
        {activeTab === "subscriptions" && (
          <AdminSubscriptionsView onNavigateTab={handleTabChange} />
        )}
        {activeTab === "upgrade-requests" && (
          <AdminUpgradeRequestsView onNavigateTab={handleTabChange} />
        )}
        {activeTab === "invoices" && <AdminInvoicesView />}
        {activeTab === "security" && <AdminSecurityView />}
      </Suspense>
    </div>
  );
}
