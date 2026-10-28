import { Receipt, CheckCircle2, AlertTriangle, Zap } from "lucide-react";
import { formatCurrency } from "../../utils/formatters";

export default function InvoiceMetricsGrid({ stats, perms }) {
  return (
    <div
      className="invoice-metrics"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: "16px",
      }}
    >
      {/* Metric 1: Tổng tiền phát hành */}
      <div
        style={{
          backgroundColor: "var(--surface-lowest)",
          padding: "20px",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-color)",
          boxShadow: "var(--shadow-sm)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontSize: "0.75rem",
              fontWeight: "700",
              color: "var(--neutral-500)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {perms.isTenant ? "TỔNG TIỀN HÓA ĐƠN" : "TỔNG TIỀN PHÁT HÀNH"}
          </span>
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              backgroundColor: "var(--surface-container)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--primary)",
            }}
          >
            <Receipt size={17} />
          </div>
        </div>
        <div style={{ margin: "10px 0" }}>
          <div
            className="tnum"
            style={{
              fontSize: "1.65rem",
              fontWeight: "700",
              color: "var(--neutral-900)",
              fontFamily: "var(--font-heading)",
            }}
          >
            {formatCurrency(stats.totalBilled)}
          </div>
          <div
            style={{
              fontSize: "0.78rem",
              color: "var(--neutral-500)",
              marginTop: "4px",
            }}
          >
            {stats.count} hóa đơn{perms.isTenant ? "" : " trong hệ thống"}
          </div>
        </div>
        <div
          style={{
            width: "100%",
            height: "6px",
            backgroundColor: "var(--surface-container)",
            borderRadius: "9999px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: "var(--primary)",
            }}
          />
        </div>
      </div>

      {/* Metric 2: Đã thu thành công */}
      <div
        style={{
          backgroundColor: "var(--surface-lowest)",
          padding: "20px",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-color)",
          boxShadow: "var(--shadow-sm)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontSize: "0.75rem",
              fontWeight: "700",
              color: "var(--neutral-500)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            ĐÃ THU THÀNH CÔNG (PAID)
          </span>
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              backgroundColor: "var(--success-bg)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--success)",
            }}
          >
            <CheckCircle2 size={17} />
          </div>
        </div>
        <div style={{ margin: "10px 0" }}>
          <div
            className="tnum"
            style={{
              fontSize: "1.65rem",
              fontWeight: "700",
              color: "var(--success-text)",
              fontFamily: "var(--font-heading)",
            }}
          >
            {formatCurrency(stats.totalCollected)}
          </div>
          <div
            style={{
              fontSize: "0.78rem",
              color: "var(--neutral-500)",
              marginTop: "4px",
            }}
          >
            <span style={{ fontWeight: "700", color: "var(--success)" }}>
              {stats.paidRate}%
            </span>{" "}
            tỷ lệ đã thanh toán
          </div>
        </div>
        <div
          style={{
            width: "100%",
            height: "6px",
            backgroundColor: "var(--surface-container)",
            borderRadius: "9999px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${stats.paidRate}%`,
              height: "100%",
              backgroundColor: "var(--success)",
            }}
          />
        </div>
      </div>

      {/* Metric 3: Công nợ tồn đọng */}
      <div
        style={{
          backgroundColor: "var(--surface-lowest)",
          padding: "20px",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-color)",
          boxShadow: "var(--shadow-sm)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontSize: "0.75rem",
              fontWeight: "700",
              color: "var(--neutral-500)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {perms.isTenant
              ? "CÒN PHẢI THANH TOÁN"
              : "CÔNG NỢ TỒN ĐỌNG (UNPAID)"}
          </span>
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              backgroundColor: "var(--error-bg)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--error)",
            }}
          >
            <AlertTriangle size={17} />
          </div>
        </div>
        <div style={{ margin: "10px 0" }}>
          <div
            className="tnum"
            style={{
              fontSize: "1.65rem",
              fontWeight: "700",
              color:
                stats.totalRemaining > 0
                  ? "var(--error)"
                  : "var(--neutral-700)",
              fontFamily: "var(--font-heading)",
            }}
          >
            {formatCurrency(stats.totalRemaining)}
          </div>
          <div
            style={{
              fontSize: "0.78rem",
              color: "var(--error-text)",
              marginTop: "4px",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            {stats.overdueCount > 0 ? (
              <>
                <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                <span>
                  {stats.overdueCount} {perms.isTenant ? "hóa đơn" : "phòng"}{" "}
                  quá hạn thanh toán
                </span>
              </>
            ) : (
              "Không có nợ quá hạn"
            )}
          </div>
        </div>
        <div
          style={{
            width: "100%",
            height: "6px",
            backgroundColor: "var(--surface-container)",
            borderRadius: "9999px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${stats.debtRate}%`,
              height: "100%",
              backgroundColor: "var(--error)",
            }}
          />
        </div>
      </div>

      {/* Metric 4: Giao dịch SePay tự động (landlord only) */}
      {perms.isLandlord && (
        <div
          style={{
            backgroundColor: "var(--surface-lowest)",
            padding: "20px",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border-color)",
            boxShadow: "var(--shadow-sm)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: "700",
                color: "var(--neutral-500)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              GIAO DỊCH SEPAY TỰ ĐỘNG
            </span>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                backgroundColor: "var(--secondary-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--secondary)",
              }}
            >
              <Zap size={17} />
            </div>
          </div>
          <div style={{ margin: "10px 0" }}>
            <div
              className="tnum"
              style={{
                fontSize: "1.65rem",
                fontWeight: "700",
                color: "var(--secondary)",
                fontFamily: "var(--font-heading)",
              }}
            >
              {formatCurrency(stats.totalCollected)}
            </div>
            <div
              style={{
                fontSize: "0.78rem",
                color: "var(--neutral-500)",
                marginTop: "4px",
              }}
            >
              Giao dịch tự động được cập nhật từ hệ thống thanh toán
            </div>
          </div>
          <div
            style={{
              width: "100%",
              height: "6px",
              backgroundColor: "var(--surface-container)",
              borderRadius: "9999px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: "85%",
                height: "100%",
                backgroundColor: "var(--secondary)",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

