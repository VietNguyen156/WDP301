import React, { useState, useEffect } from "react";
import { ToastProvider } from "./context/ToastContext";
import { AuthProvider } from "./context/AuthContext";
import { TopNavBar } from "./components/layout/TopNavBar";
import { SideNavBar } from "./components/layout/SideNavBar";
import { InvoiceList } from "./features/invoices/InvoiceList";
import { PaymentHistoryList } from "./features/payments/PaymentHistoryList";
import { UnmatchedPaymentList } from "./features/payments/UnmatchedPaymentList";
import { PublicInvoicePage } from "./features/public-invoice/PublicInvoicePage";
import { InvoiceGenerateModal } from "./features/invoices/InvoiceGenerateModal";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";

function AppContent() {
  const [activeTab, setActiveTab] = useState("invoices");
  const [publicToken, setPublicToken] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);

  // Parse Hash or Path for No-App Tenant Experience (/i/:token or #public/:token)
  useEffect(() => {
    const handleUrlRouting = () => {
      const hash = window.location.hash;
      const pathname = window.location.pathname;

      if (hash.startsWith("#public/")) {
        const token = hash.replace("#public/", "");
        setPublicToken(token);
        setActiveTab("public-tenant-view");
      } else if (pathname.startsWith("/i/")) {
        const token = pathname.replace("/i/", "");
        setPublicToken(token);
        setActiveTab("public-tenant-view");
      }
    };

    handleUrlRouting();
    window.addEventListener("hashchange", handleUrlRouting);
    return () => window.removeEventListener("hashchange", handleUrlRouting);
  }, []);

  // If in direct public tenant view (No-App experience)
  if (activeTab === "public-tenant-view") {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-app)" }}>
        {/* Simple top bar for tenant */}
        <header
          style={{
            backgroundColor: "var(--surface-lowest)",
            borderBottom: "1px solid var(--border-color)",
            padding: "12px 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "6px",
                backgroundColor: "var(--primary-container)",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "800",
                fontSize: "0.95rem",
              }}
            >
              D
            </div>
            <span style={{ fontWeight: "700", color: "var(--neutral-900)" }}>
              DOMUS ERP
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              window.location.hash = "";
              setActiveTab("invoices");
            }}
            style={{
              fontSize: "0.82rem",
              color: "var(--neutral-600)",
              textDecoration: "underline",
              cursor: "pointer",
            }}
          >
            Quay lại Cổng Quản lý
          </button>
        </header>

        <main>
          <PublicInvoicePage token={publicToken} />
        </main>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Top Navigation Bar (Stitch Specification) */}
      <TopNavBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onQuickCreate={() => setIsQuickCreateOpen(true)}
      />

      {/* Main Canvas with Sidebar + Workspace Layout */}
      <div style={{ display: "flex", flex: 1, minHeight: "calc(100vh - 64px)" }}>
        {/* Side Navigation Bar (Stitch Specification) */}
        <SideNavBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onQuickCreate={() => setIsQuickCreateOpen(true)}
        />

        {/* Main Content Workspace */}
        <main
          style={{
            flex: 1,
            padding: "24px 28px 60px 28px",
            overflowY: "auto",
            backgroundColor: "var(--bg-app)",
          }}
        >
          {activeTab === "invoices" && (
            <InvoiceList externalSearchTerm={searchTerm} />
          )}

          {activeTab === "payments" && (
            <PaymentHistoryList />
          )}

          {activeTab === "unmatched" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div>
                <h2>Đối soát Giao dịch Chưa khớp (Unmatched Payments)</h2>
                <p>Danh sách các giao dịch SePay chưa tìm thấy hóa đơn cần khớp nợ</p>
              </div>
              <UnmatchedPaymentList />
            </div>
          )}

          {activeTab === "public-invoice" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <h2>Xem trước Trang Khách thuê (No-App Tenant Portal)</h2>
                <p>
                  Giao diện tối ưu di động cho khách thuê xem hóa đơn qua mã token bí mật không cần tải app hay đăng nhập.
                </p>
              </div>
              <PublicInvoicePage />
            </div>
          )}
        </main>
      </div>

      {/* Quick Create Invoice Modal */}
      {isQuickCreateOpen && (
        <InvoiceGenerateModal
          isOpen={isQuickCreateOpen}
          onClose={() => setIsQuickCreateOpen(false)}
          onGenerated={() => {
            setActiveTab("invoices");
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
