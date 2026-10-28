import {
  Zap,
  Droplets,
  CheckCircle2,
  Lock,
  ChevronLeft,
  ChevronRight,
  Camera,
  ExternalLink,
} from "lucide-react";
import { Button } from "../ui";

export default function UtilityWizardView({
  activeItem,
  currentIndex,
  setCurrentIndex,
  filteredLength,
  getItemValues,
  handleInputChange,
  submitting,
  billingPeriod,
  submitReading,
}) {
  if (!activeItem) return null;

  const vals = getItemValues(activeItem);
  const isMeterWater = activeItem.waterBillingType === "METER";

  const elecDiff =
    vals.electricNewIndex !== ""
      ? Number(vals.electricNewIndex) - activeItem.previousElectricIndex
      : null;
  const waterDiff =
    isMeterWater && vals.waterNewIndex !== ""
      ? Number(vals.waterNewIndex) - activeItem.previousWaterIndex
      : null;

  const isLocked = activeItem.reading?.isBilled;

  return (
    <div className="util-wizard-box">
      <div className="util-wizard-header">
        <div>
          <div className="util-wizard-room-title">
            Phòng {activeItem.room.roomNumber}
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                padding: "2px 10px",
                borderRadius: "9999px",
                background: "#f1f5f9",
                color: "#475569",
              }}
            >
              Tầng {activeItem.room.floor}
            </span>
            {activeItem.reading?.isBilled ? (
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  padding: "2px 10px",
                  borderRadius: "9999px",
                  background: "#f5f3ff",
                  color: "#7c3aed",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <Lock size={12} /> Đã khóa sổ HĐ
              </span>
            ) : activeItem.reading ? (
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  padding: "2px 10px",
                  borderRadius: "9999px",
                  background: "#ecfdf5",
                  color: "#059669",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <CheckCircle2 size={12} /> Đã ghi số
              </span>
            ) : (
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  padding: "2px 10px",
                  borderRadius: "9999px",
                  background: "#fffbeb",
                  color: "#d97706",
                }}
              >
                Chưa chốt
              </span>
            )}
          </div>
          <span
            style={{
              fontSize: "13px",
              color: "var(--util-text-muted)",
            }}
          >
            Phòng {currentIndex + 1} / {filteredLength}
          </span>
        </div>

        {/* Pagination Controls */}
        <div style={{ display: "flex", gap: "8px" }}>
          <Button
            variant="secondary"
            compact
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
          >
            <ChevronLeft size={16} /> Phòng trước
          </Button>
          <Button
            variant="secondary"
            compact
            disabled={currentIndex === filteredLength - 1}
            onClick={() =>
              setCurrentIndex((prev) => Math.min(filteredLength - 1, prev + 1))
            }
          >
            Phòng kế tiếp <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      {/* Meter Input Cards */}
      <div>
        <div className="util-meter-card-grid">
          {/* 1. Electric Meter Card */}
          <div className="util-meter-card electric">
            <div className="util-meter-title">
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Zap size={18} color="#d97706" />
                Đồng hồ Điện (kWh)
              </span>
              {elecDiff !== null && (
                <span
                  className={`util-consumed-badge ${
                    elecDiff >= 0 ? "positive" : "warning"
                  }`}
                >
                  Tiêu thụ: {elecDiff >= 0 ? `+${elecDiff}` : elecDiff} kWh
                </span>
              )}
            </div>

            <div className="util-index-row">
              <div className="util-index-box">
                <span className="util-index-label">Chỉ số cũ</span>
                <div className="util-old-val">
                  {activeItem.previousElectricIndex}
                </div>
              </div>
              <div className="util-index-box">
                <span className="util-index-label">Chỉ số mới</span>
                <input
                  type="number"
                  min={activeItem.previousElectricIndex}
                  className="util-new-input"
                  placeholder="Nhập số mới..."
                  disabled={isLocked || submitting}
                  value={vals.electricNewIndex}
                  onChange={(e) =>
                    handleInputChange(
                      activeItem.room.id,
                      "electricNewIndex",
                      e.target.value,
                    )
                  }
                />
              </div>
            </div>

            {/* Image Link Input */}
            <div className="util-image-field">
              <Camera size={16} color="var(--util-text-muted)" />
              <input
                type="url"
                placeholder="Link ảnh công tơ điện (http://...)"
                disabled={isLocked || submitting}
                value={vals.electricImage}
                onChange={(e) =>
                  handleInputChange(
                    activeItem.room.id,
                    "electricImage",
                    e.target.value,
                  )
                }
              />
              {vals.electricImage && (
                <a
                  href={vals.electricImage}
                  target="_blank"
                  rel="noreferrer"
                  title="Xem ảnh"
                  style={{ color: "var(--util-primary-container)" }}
                >
                  <ExternalLink size={16} />
                </a>
              )}
            </div>
          </div>

          {/* 2. Water Meter Card */}
          <div className="util-meter-card water">
            <div className="util-meter-title">
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Droplets size={18} color="#0284c7" />
                Đồng hồ Nước (m³)
              </span>
              {isMeterWater ? (
                waterDiff !== null && (
                  <span
                    className={`util-consumed-badge ${
                      waterDiff >= 0 ? "positive" : "warning"
                    }`}
                  >
                    Tiêu thụ: {waterDiff >= 0 ? `+${waterDiff}` : waterDiff} m³
                  </span>
                )
              ) : (
                <span
                  style={{
                    fontSize: "11px",
                    padding: "2px 8px",
                    borderRadius: "4px",
                    background: "#f1f5f9",
                    color: "#475569",
                  }}
                >
                  {activeItem.waterBillingType === "PER_PERSON"
                    ? "Tính theo đầu người"
                    : "Khoán trọn gói"}
                </span>
              )}
            </div>

            {isMeterWater ? (
              <>
                <div className="util-index-row">
                  <div className="util-index-box">
                    <span className="util-index-label">Chỉ số cũ</span>
                    <div className="util-old-val">
                      {activeItem.previousWaterIndex}
                    </div>
                  </div>
                  <div className="util-index-box">
                    <span className="util-index-label">Chỉ số mới</span>
                    <input
                      type="number"
                      min={activeItem.previousWaterIndex}
                      className="util-new-input"
                      placeholder="Nhập số mới..."
                      disabled={isLocked || submitting}
                      value={vals.waterNewIndex}
                      onChange={(e) =>
                        handleInputChange(
                          activeItem.room.id,
                          "waterNewIndex",
                          e.target.value,
                        )
                      }
                    />
                  </div>
                </div>

                <div className="util-image-field">
                  <Camera size={16} color="var(--util-text-muted)" />
                  <input
                    type="url"
                    placeholder="Link ảnh công tơ nước (http://...)"
                    disabled={isLocked || submitting}
                    value={vals.waterImage}
                    onChange={(e) =>
                      handleInputChange(
                        activeItem.room.id,
                        "waterImage",
                        e.target.value,
                      )
                    }
                  />
                  {vals.waterImage && (
                    <a
                      href={vals.waterImage}
                      target="_blank"
                      rel="noreferrer"
                      title="Xem ảnh"
                      style={{ color: "var(--util-primary-container)" }}
                    >
                      <ExternalLink size={16} />
                    </a>
                  )}
                </div>
              </>
            ) : (
              <div
                style={{
                  padding: "24px 16px",
                  background: "#ffffff",
                  borderRadius: "8px",
                  textAlign: "center",
                  fontSize: "13px",
                  color: "var(--util-text-muted)",
                  border: "1px dashed var(--util-border)",
                }}
              >
                Phòng này áp dụng hình thức{" "}
                <strong>
                  {activeItem.waterBillingType === "PER_PERSON"
                    ? "thu tiền nước theo đầu người"
                    : "thu khoán trọn gói theo phòng"}
                </strong>
                . Không cần chốt chỉ số đồng hồ nước.
              </div>
            )}
          </div>
        </div>

        {/* Action Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: "14px",
            borderTop: "1px solid var(--util-border)",
          }}
        >
          <div
            style={{
              fontSize: "13px",
              color: "var(--util-text-muted)",
            }}
          >
            {isLocked ? (
              <span style={{ color: "#7c3aed" }}>
                Bản chốt số này đã lập hóa đơn, không thể chỉnh sửa.
              </span>
            ) : (
              <span>
                Dữ liệu sẽ tự động đồng bộ sang hóa đơn nháp kỳ {billingPeriod}.
              </span>
            )}
          </div>

          {!isLocked && (
            <div style={{ display: "flex", gap: "10px" }}>
              <Button
                busy={submitting}
                onClick={() => submitReading(activeItem)}
              >
                {activeItem.reading
                  ? "Cập nhật chỉ số"
                  : "Lưu & Sang phòng tiếp"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

