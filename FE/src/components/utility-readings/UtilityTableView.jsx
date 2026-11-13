import { Camera, Edit2, Zap, Droplets, Lock, CheckCircle2 } from "lucide-react";
import { Button } from "../ui";

function StatusBadge({ item }) {
  if (item.reading?.isBilled) {
    return (
      <span className="util-status-pill is-billed">
        <Lock size={11} /> Đã khóa HĐ
      </span>
    );
  }
  if (item.reading) {
    return (
      <span className="util-status-pill is-recorded">
        <CheckCircle2 size={11} /> Đã chốt (
        {item.reading.readingDate
          ? item.reading.readingDate.slice(0, 10)
          : "Đạt"}
        )
      </span>
    );
  }
  return <span className="util-status-pill is-pending">Chưa chốt</span>;
}

export default function UtilityTableView({
  filteredItems,
  setCurrentIndex,
  setViewMode,
}) {
  return (
    <>
      {/* Desktop Table */}
      <div className="util-table-wrap">
        <table className="util-table">
          <thead>
            <tr>
              <th>Số phòng</th>
              <th>Tầng</th>
              <th>Trạng thái chốt</th>
              <th>Điện (Cũ → Mới)</th>
              <th>Tiêu thụ điện</th>
              <th>Nước (Cũ → Mới)</th>
              <th>Tiêu thụ nước</th>
              <th>Ảnh công tơ</th>
              <th style={{ textAlign: "right" }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item, idx) => {
              const isMeterWater = item.waterBillingType === "METER";

              return (
                <tr key={item.room.id}>
                  <td>
                    <strong style={{ fontSize: "14px" }}>
                      {item.room.roomNumber}
                    </strong>
                  </td>
                  <td>Tầng {item.room.floor}</td>
                  <td>
                    <StatusBadge item={item} />
                  </td>
                  <td className="tnum">
                    <span style={{ color: "var(--util-text-muted)" }}>
                      {item.previousElectricIndex}
                    </span>{" "}
                    →{" "}
                    <strong>
                      {item.reading?.newElectricIndex ?? (
                        <span style={{ color: "#d97706" }}>—</span>
                      )}
                    </strong>
                  </td>
                  <td className="tnum">
                    {item.reading ? (
                      <strong style={{ color: "#059669" }}>
                        {item.reading.consumedElectric} kWh
                      </strong>
                    ) : (
                      <span style={{ color: "var(--util-text-muted)" }}>—</span>
                    )}
                  </td>
                  <td className="tnum">
                    {isMeterWater ? (
                      <>
                        <span style={{ color: "var(--util-text-muted)" }}>
                          {item.previousWaterIndex}
                        </span>{" "}
                        →{" "}
                        <strong>
                          {item.reading?.newWaterIndex ?? (
                            <span style={{ color: "#0284c7" }}>—</span>
                          )}
                        </strong>
                      </>
                    ) : (
                      <span
                        style={{
                          fontSize: "11px",
                          color: "var(--util-text-muted)",
                        }}
                      >
                        Theo người/khoán
                      </span>
                    )}
                  </td>
                  <td className="tnum">
                    {item.reading && isMeterWater ? (
                      <strong style={{ color: "#0284c7" }}>
                        {item.reading.consumedWater} m³
                      </strong>
                    ) : (
                      <span style={{ color: "var(--util-text-muted)" }}>—</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "6px" }}>
                      {item.reading?.electricImage && (
                        <a
                          href={item.reading.electricImage}
                          target="_blank"
                          rel="noreferrer"
                          title="Xem ảnh điện"
                          style={{ color: "#f59e0b" }}
                        >
                          <Camera size={15} />
                        </a>
                      )}
                      {item.reading?.waterImage && (
                        <a
                          href={item.reading.waterImage}
                          target="_blank"
                          rel="noreferrer"
                          title="Xem ảnh nước"
                          style={{ color: "#0284c7" }}
                        >
                          <Camera size={15} />
                        </a>
                      )}
                      {!item.reading?.electricImage &&
                        !item.reading?.waterImage && (
                          <span style={{ color: "#cbd5e1" }}>—</span>
                        )}
                    </div>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <Button
                      variant="secondary"
                      compact
                      onClick={() => {
                        setCurrentIndex(idx);
                        setViewMode("wizard");
                      }}
                    >
                      <Edit2 size={13} />
                      <span>{item.reading ? "Sửa / Xem" : "Ghi số"}</span>
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List (no horizontal table scrolling) */}
      <div className="util-mobile-cards">
        {filteredItems.map((item, idx) => {
          const isMeterWater = item.waterBillingType === "METER";
          return (
            <div key={item.room.id} className="util-mobile-card">
              <div className="util-mobile-card-head">
                <div>
                  <strong style={{ fontSize: "15px", color: "#0f172a" }}>
                    Phòng {item.room.roomNumber}
                  </strong>
                  <span
                    style={{
                      fontSize: "12px",
                      color: "#64748b",
                      marginLeft: "6px",
                    }}
                  >
                    Tầng {item.room.floor}
                  </span>
                </div>
                <StatusBadge item={item} />
              </div>

              <div className="util-mobile-card-metrics">
                <div className="util-mobile-metric-box">
                  <div className="util-mobile-metric-title">
                    <Zap size={13} color="#d97706" /> Điện (kWh)
                  </div>
                  <div className="tnum">
                    {item.previousElectricIndex} →{" "}
                    <strong>{item.reading?.newElectricIndex ?? "—"}</strong>
                  </div>
                  {item.reading && (
                    <div
                      style={{
                        color: "#059669",
                        fontWeight: 700,
                        marginTop: "2px",
                      }}
                    >
                      +{item.reading.consumedElectric} kWh
                    </div>
                  )}
                </div>

                <div className="util-mobile-metric-box">
                  <div className="util-mobile-metric-title">
                    <Droplets size={13} color="#0284c7" /> Nước (m³)
                  </div>
                  {isMeterWater ? (
                    <>
                      <div className="tnum">
                        {item.previousWaterIndex} →{" "}
                        <strong>{item.reading?.newWaterIndex ?? "—"}</strong>
                      </div>
                      {item.reading && (
                        <div
                          style={{
                            color: "#0284c7",
                            fontWeight: 700,
                            marginTop: "2px",
                          }}
                        >
                          +{item.reading.consumedWater} m³
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ color: "#64748b" }}>Theo người / khoán</div>
                  )}
                </div>
              </div>

              <Button
                variant={item.reading ? "secondary" : "primary"}
                compact
                onClick={() => {
                  setCurrentIndex(idx);
                  setViewMode("wizard");
                }}
              >
                <Edit2 size={13} />
                <span>{item.reading ? "Sửa / Xem chi tiết" : "Ghi số ngay"}</span>
              </Button>
            </div>
          );
        })}
      </div>
    </>
  );
}
