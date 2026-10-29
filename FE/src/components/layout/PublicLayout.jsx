import React from "react";
import { Building2 } from "lucide-react";

/**
 * PublicLayout Component - DOMUS ERP
 * Clean layout shell for unauthenticated/public views (e.g. Public Invoice Portal).
 */
export function PublicLayout({
  children,
  portalTitle = "Cổng Hóa Đơn Khách Thuê",
  maxWidth = "900px",
}) {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-app)" }}>
      <header
        style={{
          backgroundColor: "#fff",
          borderBottom: "1px solid var(--border-color)",
          padding: "14px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              backgroundColor: "var(--primary-container, #0f766e)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Building2 size={20} />
          </div>
          <span
            style={{
              fontWeight: 700,
              fontSize: "1.15rem",
              fontFamily: "var(--font-heading)",
            }}
          >
            DOMUS <span style={{ color: "var(--primary, #005c55)" }}>ERP</span> · {portalTitle}
          </span>
        </div>
      </header>
      <main style={{ padding: "24px", maxWidth, margin: "0 auto" }}>
        {children}
      </main>
    </div>
  );
}

export default PublicLayout;
