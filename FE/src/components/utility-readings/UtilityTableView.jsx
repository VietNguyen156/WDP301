import { Camera, Edit2 } from "lucide-react";
import { Button } from "../ui";

export default function UtilityTableView({
  filteredItems,
  setCurrentIndex,
  setViewMode,
}) {
  return (
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
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {filteredItems.map((item, idx) => {
            const isMeterWater = item.waterBillingType === "METER";
            const isLocked = item.reading?.isBilled;

            return (
              <tr key={item.room.id}>
                <td>
                  <strong style={{ fontSize: "14px" }}>
                    {item.room.roomNumber}
                  </strong>
                </td>
                <td>Tầng {item.room.floor}</td>
                <td>
                  {isLocked ? (
                    <span
                      style={{
                        fontSize: "11px",
                        padding: "2px 8px",
                        borderRadius: "9999px",
                        background: "#f5f3ff",
                        color: "#7c3aed",
                        fontWeight: 600,
                      }}
                    >
                      Đã khóa sổ HĐ
                    </span>
                  ) : item.reading ? (
                    <span
                      style={{
                        fontSize: "11px",
                        padding: "2px 8px",
                        borderRadius: "9999px",
                        background: "#ecfdf5",
                        color: "#059669",
                        fontWeight: 600,
                      }}
                    >
                      Đã chốt (
                      {item.reading.readingDate
                        ? item.reading.readingDate.slice(0, 10)
                        : "Đạt"}
                      )
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: "11px",
                        padding: "2px 8px",
                        borderRadius: "9999px",
                        background: "#fffbeb",
                        color: "#d97706",
                        fontWeight: 600,
                      }}
                    >
                      Chưa chốt
                    </span>
                  )}
                </td>
                <td>
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
                <td>
                  {item.reading ? (
                    <strong style={{ color: "#059669" }}>
                      {item.reading.consumedElectric} kWh
                    </strong>
                  ) : (
                    <span style={{ color: "var(--util-text-muted)" }}>—</span>
                  )}
                </td>
                <td>
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
                <td>
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
                <td>
                  <Button
                    variant="secondary"
                    compact
                    onClick={() => {
                      setCurrentIndex(idx);
                      setViewMode("wizard");
                    }}
                  >
                    <Edit2 size={13} />{" "}
                    {item.reading ? "Sửa / Xem" : "Ghi số"}
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

