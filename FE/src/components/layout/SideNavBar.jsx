import React from "react";

export function SideNavBar({ activeTab, onTabChange, onQuickCreate }) {
  const navItems = [
    { id: "invoices", label: "Hóa đơn & Thu nợ (VietQR)", icon: "receipt_long", badge: "5", active: true },
    { id: "payments", label: "Thu tiền mặt & Sổ quỹ", icon: "payments" },
    { id: "unmatched", label: "Chuyển khoản chưa khớp", icon: "sync" },
    { id: "public-invoice", label: "Trang khách No-App", icon: "phone_iphone" },
  ];

  return (
    <aside
      style={{
        width: "260px",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "20px 16px",
        backgroundColor: "var(--surface-lowest)",
        borderRight: "1px solid var(--border-color)",
        minHeight: "calc(100vh - 64px)",
        userSelect: "none",
      }}
    >
      <div>
        {/* Brand identity header */}
        <div style={{ padding: "0 8px 16px 8px", marginBottom: "12px", borderBottom: "1px solid var(--border-color)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                backgroundColor: "var(--surface-container)",
                color: "var(--primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "700",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                apartment
              </span>
            </div>
            <div>
              <h2
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "1rem",
                  fontWeight: "700",
                  color: "var(--primary)",
                  lineHeight: 1.1,
                  margin: 0,
                }}
              >
                DOMUS ERP
              </h2>
              <p style={{ fontSize: "0.72rem", color: "var(--neutral-500)", margin: "2px 0 0 0" }}>
                Chuỗi căn hộ & Nhà trọ
              </p>
            </div>
          </div>

          {/* Quick CTA Button */}
          <button
            type="button"
            onClick={onQuickCreate}
            style={{
              marginTop: "14px",
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "9px 12px",
              backgroundColor: "var(--secondary)",
              color: "#ffffff",
              borderRadius: "8px",
              fontSize: "0.88rem",
              fontWeight: "600",
              boxShadow: "var(--shadow-sm)",
              cursor: "pointer",
              transition: "opacity 0.15s ease",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
              flash_on
            </span>
            <span>Tạo hóa đơn nhanh</span>
          </button>
        </div>

        {/* Navigation list */}
        <nav style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  backgroundColor: isActive ? "var(--primary-container)" : "transparent",
                  color: isActive ? "#ffffff" : "var(--neutral-700)",
                  fontWeight: isActive ? "600" : "500",
                  fontSize: "0.88rem",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  textAlign: "left",
                  width: "100%",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = "var(--neutral-100)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: "20px",
                    color: isActive ? "#ffffff" : "var(--neutral-500)",
                  }}
                >
                  {item.icon}
                </span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge && (
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: "700",
                      padding: "1px 6px",
                      borderRadius: "9999px",
                      backgroundColor: isActive ? "rgba(255,255,255,0.25)" : "var(--error-bg)",
                      color: isActive ? "#ffffff" : "var(--error-text)",
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer navigation */}
      <div style={{ paddingTop: "16px", borderTop: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: "6px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", fontSize: "0.82rem", color: "var(--neutral-500)" }}>
          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>settings</span>
          <span>Cài đặt hệ thống</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", fontSize: "0.82rem", color: "var(--neutral-500)" }}>
          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>support_agent</span>
          <span>Hỗ trợ kỹ thuật 24/7</span>
        </div>
      </div>
    </aside>
  );
}
