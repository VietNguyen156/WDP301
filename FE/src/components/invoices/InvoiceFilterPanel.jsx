export default function InvoiceFilterPanel({
  statusTabs,
  statusFilter,
  setStatusFilter,
  billingPeriodFilter,
  setBillingPeriodFilter,
  filteredCount,
  totalCount,
}) {
  return (
    <div
      className="invoice-filter-panel"
      style={{
        backgroundColor: "var(--surface-lowest)",
        padding: "16px 20px",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border-color)",
        boxShadow: "var(--shadow-sm)",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      {/* Filter Pills */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "8px",
          borderBottom: "1px solid var(--border-color)",
          paddingBottom: "12px",
        }}
      >
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {statusTabs.map((tab) => {
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "8px",
                  fontSize: "0.85rem",
                  fontWeight: isActive ? "600" : "500",
                  backgroundColor: isActive
                    ? "var(--primary-container)"
                    : "transparent",
                  color: isActive ? "#ffffff" : "var(--neutral-600)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Live Status indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "0.78rem", color: "var(--neutral-500)" }}>
            Đồng bộ:
          </span>
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: "var(--success)",
              display: "inline-block",
            }}
          />
          <span
            style={{
              fontSize: "0.82rem",
              fontWeight: "700",
              color: "var(--primary)",
            }}
          >
            Đang theo dõi
          </span>
        </div>
      </div>

      {/* Parametric Filters */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <input
            type="month"
            value={billingPeriodFilter}
            onChange={(e) => setBillingPeriodFilter(e.target.value)}
            style={{ width: "150px", padding: "6px 10px" }}
          />
        </div>

        <div style={{ fontSize: "0.82rem", color: "var(--neutral-500)" }}>
          Hiển thị{" "}
          <strong style={{ color: "var(--neutral-900)" }}>
            {filteredCount}
          </strong>{" "}
          trên {totalCount} bản ghi
        </div>
      </div>
    </div>
  );
}

