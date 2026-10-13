import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { branchService } from "../../services/branchService";

export function TopNavBar({ searchTerm, onSearchChange }) {
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
        position: "sticky",
        top: 0,
        zIndex: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: "64px",
        padding: "0 24px",
        width: "100%",
        backgroundColor: "var(--surface-lowest)",
        borderBottom: "1px solid var(--border-color)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* Left Cluster: Brand & Search */}
      <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              backgroundColor: "var(--primary-container)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>
              apartment
            </span>
          </div>
          <div>
            <span
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--primary)",
                fontWeight: "800",
                fontSize: "1.25rem",
                letterSpacing: "-0.02em",
                lineHeight: 1,
                display: "block",
              }}
            >
              DOMUS ERP
            </span>
            <span
              style={{
                fontSize: "0.68rem",
                color: "var(--neutral-500)",
                fontWeight: "600",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                display: "block",
                marginTop: "2px",
              }}
            >
              Boarding House SaaS Platform
            </span>
          </div>
        </div>

        {/* Quick Search Bar with ⌘K */}
        <div style={{ position: "relative", width: "340px" }}>
          <span
            className="material-symbols-outlined"
            style={{
              position: "absolute",
              left: "10px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--neutral-400)",
              fontSize: "18px",
            }}
          >
            search
          </span>
          <input
            type="text"
            placeholder="Tìm theo mã HĐ, số phòng, tên khách..."
            value={searchTerm || ""}
            onChange={(e) => onSearchChange?.(e.target.value)}
            style={{
              width: "100%",
              padding: "7px 36px 7px 34px",
              fontSize: "0.85rem",
              backgroundColor: "var(--neutral-50)",
              border: "1px solid var(--border-color)",
              borderRadius: "8px",
              outline: "none",
            }}
          />
          <kbd
            style={{
              position: "absolute",
              right: "10px",
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: "10px",
              backgroundColor: "var(--surface-lowest)",
              border: "1px solid var(--border-color)",
              padding: "1px 5px",
              borderRadius: "4px",
              color: "var(--neutral-500)",
              fontFamily: "monospace",
            }}
          >
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right Cluster: Actions & Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        {/* Branch Switcher */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span className="material-symbols-outlined" style={{ color: "var(--primary)", fontSize: "18px" }}>
            location_on
          </span>
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            style={{
              padding: "6px 12px",
              fontSize: "0.85rem",
              borderRadius: "8px",
              border: "1px solid var(--border-color)",
              backgroundColor: "var(--neutral-50)",
              color: "var(--neutral-800)",
              fontWeight: "600",
              cursor: "pointer",
              minWidth: "180px",
            }}
          >
            <option value="">Tất cả cơ sở ({branches.length})</option>
            {branches.map((b) => (
              <option key={b._id || b.id} value={b._id || b.id}>
                {b.name || b.branchName || `Cơ sở ${b._id || b.id}`}
              </option>
            ))}
          </select>
        </div>

        {/* Live SePay Webhook Status */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "4px 10px",
            borderRadius: "9999px",
            backgroundColor: "rgba(15, 118, 110, 0.08)",
            border: "1px solid rgba(15, 118, 110, 0.2)",
            color: "var(--primary-container)",
            fontSize: "0.78rem",
            fontWeight: "600",
          }}
        >
          <span
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              backgroundColor: "var(--success)",
              display: "inline-block",
            }}
          />
          SePay: Online (~1.8s)
        </div>

        {/* Demo Mode / Auth Bypass Badge */}
        <div
          title="Đang bật chế độ xem trước (Backend chưa có Auth) - Đầy đủ tính năng tương tác"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            backgroundColor: "#fef3c7",
            color: "#92400e",
            border: "1px solid #fde68a",
            borderRadius: "20px",
            padding: "3px 10px",
            fontSize: "0.75rem",
            fontWeight: "600",
          }}
        >
          <span style={{ fontSize: "11px" }}>⚡</span>
          <span>Bypass Auth (Dev Mode)</span>
        </div>

        {/* Notification Icon */}
        <button
          type="button"
          style={{
            position: "relative",
            padding: "8px",
            borderRadius: "8px",
            color: "var(--neutral-600)",
            cursor: "pointer",
          }}
          title="Thông báo"
        >
          <span className="material-symbols-outlined">notifications</span>
          <span
            style={{
              position: "absolute",
              top: "6px",
              right: "6px",
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              backgroundColor: "var(--error)",
            }}
          />
        </button>

        {/* Admin Profile */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            paddingLeft: "12px",
            borderLeft: "1px solid var(--border-color)",
          }}
        >
          <div
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "50%",
              backgroundColor: "var(--primary-subtle)",
              border: "2px solid var(--primary-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "700",
              color: "var(--primary)",
              fontSize: "0.85rem",
            }}
          >
            {(user?.name || "AD").substring(0, 2).toUpperCase()}
          </div>
          <div style={{ lineHeight: 1.2 }}>
            <span style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--neutral-900)", display: "block" }}>
              {user?.name || "Admin Quản Trị"}
            </span>
            <span style={{ fontSize: "0.72rem", color: "var(--neutral-500)", display: "block" }}>
              {user?.role || "Super Operator"}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
