import React, { lazy, Suspense, useState, useEffect } from "react";
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
} from "lucide-react";
import { LoadingState } from "../../components/ui";
import "./SaasAdmin.css";

// Each tab is its own chunk, fetched the first time the admin opens it.
const tab = (load, name) => lazy(() => load().then((m) => ({ default: m[name] })));
const AdminAnalyticsView = tab(() => import("./AdminAnalyticsView"), "AdminAnalyticsView");
const AdminPlansView = tab(() => import("./AdminPlansView"), "AdminPlansView");
const AdminLandlordsView = tab(() => import("./AdminLandlordsView"), "AdminLandlordsView");
const AdminSubscriptionsView = tab(() => import("./AdminSubscriptionsView"), "AdminSubscriptionsView");
const AdminInvoicesView = tab(() => import("./AdminInvoicesView"), "AdminInvoicesView");
const AdminUpgradeRequestsView = tab(() => import("./AdminUpgradeRequestsView"), "AdminUpgradeRequestsView");
const AdminSecurityView = tab(() => import("./AdminSecurityView"), "AdminSecurityView");

const TABS = [
  { id: "analytics", label: "Tổng quan Hệ thống", icon: LayoutDashboard },
  { id: "plans", label: "Gói dịch vụ SaaS", icon: Layers },
  { id: "landlords", label: "Chủ trọ & Cấu hình SePay", icon: Users },
  { id: "subscriptions", label: "Thuê bao & Hạn ngạch", icon: Crown },
  { id: "upgrade-requests", label: "Yêu cầu đổi gói", icon: ArrowUpCircle },
  { id: "invoices", label: "Hóa đơn & Thu tiền SaaS", icon: Receipt },
  { id: "security", label: "Bảo mật & Audit Log", icon: ShieldCheck },
];

export default function SaasAdminPage({ initialTab = "analytics" }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(urlTab || initialTab);

  useEffect(() => {
    if (urlTab && urlTab !== activeTab) {
      setActiveTab(urlTab);
    }
  }, [urlTab, activeTab]);

  function handleTabChange(tabId) {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
  }

  return (
    <div className="admin-container admin-shell animate-fade-in">
      {/* 1. Header Card */}
      <div className="admin-header-card admin-shell-header">
        <div className="admin-title-wrap">
          <div className="admin-shield-icon">
            <ShieldCheck size={28} />
          </div>
          <div className="admin-header-titles">
            <h1>DOMUS ERP · Nền Tảng Quản Trị Hệ Thống SaaS</h1>
            <p>
              Bảng điều hành toàn sàn, kế toán thuê bao MRR & cấu hình hạn ngạch
              dành riêng cho SUPER_ADMIN
            </p>
          </div>
        </div>

        <div className="admin-badge-super">
          <Sparkles size={14} color="#a3faef" />
          <span>ROLE: SUPER_ADMIN</span>
        </div>
      </div>

      {/* 2. Tabs Navigation */}
      <div className="admin-tabs-nav admin-shell-tabs" role="tablist">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`admin-tab-btn ${isActive ? "is-active" : ""}`}
              onClick={() => handleTabChange(tab.id)}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. Tab Views */}
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
