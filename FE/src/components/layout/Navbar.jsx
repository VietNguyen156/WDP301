import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { branchService } from "../../services/branchService";

export function Navbar({ activeTab, onTabChange }) {
  const { user, selectedBranchId, setSelectedBranchId } = useAuth();
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    let isMounted = true;
    branchService.getBranches().then((data) => {
      if (isMounted && Array.isArray(data)) {
        setBranches(data);
        if (!selectedBranchId && data.length > 0) {
          setSelectedBranchId(data[0]._id || data[0].id);
        }
      }
    });
    return () => {
      isMounted = false;
    };
  }, [selectedBranchId, setSelectedBranchId]);

  return (
    <header
      style={{
        backgroundColor: "var(--white)",
        borderBottom: "1px solid var(--border-color)",
        position: "sticky",
        top: 0,
        zIndex: 100,
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
          padding: "0 24px",
          height: "60px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "20px",
        }}
      >
        {/* Brand & Module Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "8px",
                backgroundColor: "var(--primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                fontWeight: "800",
                fontSize: "1.1rem",
                letterSpacing: "-0.05em",
              }}
            >
              D
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontWeight: "800", fontSize: "1.05rem", color: "var(--neutral-900)" }}>
                  DOMUS ERP
                </span>
                <span
                  style={{
                    fontSize: "0.68rem",
                    fontWeight: "700",
                    color: "var(--primary)",
                    backgroundColor: "var(--primary-subtle)",
                    padding: "1px 6px",
                    borderRadius: "4px",
                    border: "1px solid var(--primary-border)",
                  }}
                >
                  FINANCE
                </span>
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--neutral-500)", marginTop: "-2px" }}>
                Hóa đơn & Thu tiền PropTech
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <button
              type="button"
              onClick={() => onTabChange("invoices")}
              style={{
                padding: "8px 14px",
                borderRadius: "6px",
                fontSize: "0.92rem",
                fontWeight: activeTab === "invoices" ? "600" : "500",
                color: activeTab === "invoices" ? "var(--primary)" : "var(--neutral-600)",
                backgroundColor: activeTab === "invoices" ? "var(--primary-subtle)" : "transparent",
                border: "none",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              📄 Quản lý Hóa đơn
            </button>

            <button
              type="button"
              onClick={() => onTabChange("payments")}
              style={{
                padding: "8px 14px",
                borderRadius: "6px",
                fontSize: "0.92rem",
                fontWeight: activeTab === "payments" ? "600" : "500",
                color: activeTab === "payments" ? "var(--primary)" : "var(--neutral-600)",
                backgroundColor: activeTab === "payments" ? "var(--primary-subtle)" : "transparent",
                border: "none",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              💵 Thu tiền mặt & Sổ quỹ
            </button>

            <button
              type="button"
              onClick={() => onTabChange("public-invoice")}
              style={{
                padding: "8px 14px",
                borderRadius: "6px",
                fontSize: "0.92rem",
                fontWeight: activeTab === "public-invoice" ? "600" : "500",
                color: activeTab === "public-invoice" ? "var(--secondary)" : "var(--neutral-600)",
                backgroundColor: activeTab === "public-invoice" ? "var(--secondary-subtle)" : "transparent",
                border: "none",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              📱 Trang khách xem No-App (/i/:token)
            </button>
          </nav>
        </div>

        {/* Right Tools: Branch Selector & Operator */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {/* Branch Switcher */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "0.82rem", color: "var(--neutral-500)", fontWeight: "500" }}>
              Cơ sở:
            </span>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              style={{
                padding: "5px 10px",
                fontSize: "0.85rem",
                borderRadius: "6px",
                border: "1px solid var(--border-color)",
                backgroundColor: "var(--neutral-50)",
                color: "var(--neutral-800)",
                cursor: "pointer",
                fontWeight: "500",
                minWidth: "160px",
              }}
            >
              <option value="">Tất cả cơ sở</option>
              {branches.map((b) => (
                <option key={b._id || b.id} value={b._id || b.id}>
                  {b.name || b.branchName || `Cơ sở ${b._id || b.id}`}
                </option>
              ))}
            </select>
          </div>

          {/* User Badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              paddingLeft: "12px",
              borderLeft: "1px solid var(--border-color)",
            }}
          >
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                backgroundColor: "var(--neutral-200)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.85rem",
                fontWeight: "700",
                color: "var(--neutral-700)",
              }}
            >
              {(user?.name || "QL").substring(0, 2).toUpperCase()}
            </div>
            <div style={{ lineHeight: 1.2 }}>
              <div style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--neutral-900)" }}>
                {user?.name || "Chủ trọ / Quản lý"}
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--neutral-500)" }}>
                {user?.role || "LANDLORD"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
