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
  filteredItems,
  activeItem,
  currentIndex,
  setCurrentIndex,
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

  const invalidElectric = elecDiff !== null && elecDiff < 0;
  const invalidWater = waterDiff !== null && waterDiff < 0;
  const isLocked = activeItem.reading?.isBilled;

  return (
    <div className="util-wizard-box">
      {/* Quick Room Jump Strip for one-handed hallway navigation */}
      {filteredItems.length > 1 && (
        <div
          className="util-room-strip"
          role="navigation"
          aria-label="Chọn nhanh phòng"
        >
          {filteredItems.map((it, idx) => {
            const isCurrent = idx === currentIndex;
            const stateClass = it.reading?.isBilled
              ? "is-billed"
              : it.reading
                ? "is-recorded"
                : "";
            return (
              <button
                key={it.room.id}
                type="button"
                className={`util-room-chip ${stateClass} ${isCurrent ? "is-active" : ""}`}
                onClick={() => setCurrentIndex(idx)}
              >
                {it.reading?.isBilled ? (
                  <Lock size={11} />
                ) : it.reading ? (
                  <CheckCircle2 size={11} />
                ) : null}
                <span>P.{it.room.roomNumber}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="util-wizard-header">
        <div>
          <div className="util-wizard-room-title">
            <span>Phòng {activeItem.room.roomNumber}</span>
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
              <span className="util-status-pill is-billed">
                <Lock size={12} /> Đã khóa sổ HĐ
              </span>
            ) : activeItem.reading ? (
              <span className="util-status-pill is-recorded">
                <CheckCircle2 size={12} /> Đã ghi số
              </span>
            ) : (
              <span className="util-status-pill is-pending">Chưa chốt</span>
            )}
          </div>
          <span className="util-wizard-counter">
            Phòng {currentIndex + 1} / {filteredItems.length}
          </span>
        </div>

        {/* Desktop Pagination Controls */}
        <div className="util-wizard-nav-desktop">
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
            disabled={currentIndex >= filteredItems.length - 1}
            onClick={() =>
              setCurrentIndex((prev) =>
                Math.min(filteredItems.length - 1, prev + 1),
              )
            }
          >
            Phòng kế tiếp <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      {/* Meter Input Cards */}
      <div className="util-meter-card-grid">
        {/* 1. Electric Meter Card */}
        <div className="util-meter-card electric">
          <div className="util-meter-title">
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Zap size={17} color="#d97706" />
              Đồng hồ Điện (kWh)
            </span>
            {elecDiff !== null && (
              <span
                className={`util-consumed-badge ${
                  elecDiff >= 0 ? "positive" : "danger"
                }`}
              >
                {elecDiff >= 0
                  ? `Tiêu thụ: +${elecDiff} kWh`
                  : `Nhỏ hơn số cũ (${elecDiff})`}
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
                inputMode="numeric"
                enterKeyHint={isMeterWater ? "next" : "done"}
                min={activeItem.previousElectricIndex}
                className={`util-new-input ${invalidElectric ? "is-invalid" : ""}`}
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

          {invalidElectric && (
            <div className="util-input-error">
              Chỉ số điện mới phải lớn hơn hoặc bằng{" "}
              {activeItem.previousElectricIndex}.
            </div>
          )}

          <div className="util-image-field">
            <Camera
              size={16}
              color="var(--util-text-muted)"
              style={{ flexShrink: 0 }}
            />
            <input
              type="url"
              placeholder="Link ảnh công tơ điện (tùy chọn)"
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
                style={{
                  color: "var(--util-primary-container)",
                  flexShrink: 0,
                }}
              >
                <ExternalLink size={16} />
              </a>
            )}
          </div>
        </div>

        {/* 2. Water Meter Card */}
        <div className="util-meter-card water">
          <div className="util-meter-title">
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Droplets size={17} color="#0284c7" />
              Đồng hồ Nước (m³)
            </span>
            {isMeterWater ? (
              waterDiff !== null && (
                <span
                  className={`util-consumed-badge ${
                    waterDiff >= 0 ? "positive" : "danger"
                  }`}
                >
                  {waterDiff >= 0
                    ? `Tiêu thụ: +${waterDiff} m³`
                    : `Nhỏ hơn số cũ (${waterDiff})`}
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
                    inputMode="numeric"
                    enterKeyHint="done"
                    min={activeItem.previousWaterIndex}
                    className={`util-new-input ${invalidWater ? "is-invalid" : ""}`}
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

              {invalidWater && (
                <div className="util-input-error">
                  Chỉ số nước mới phải lớn hơn hoặc bằng{" "}
                  {activeItem.previousWaterIndex}.
                </div>
              )}

              <div className="util-image-field">
                <Camera
                  size={16}
                  color="var(--util-text-muted)"
                  style={{ flexShrink: 0 }}
                />
                <input
                  type="url"
                  placeholder="Link ảnh công tơ nước (tùy chọn)"
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
                    style={{
                      color: "var(--util-primary-container)",
                      flexShrink: 0,
                    }}
                  >
                    <ExternalLink size={16} />
                  </a>
                )}
              </div>
            </>
          ) : (
            <div
              style={{
                padding: "22px 14px",
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

      {/* Action Bar (with dedicated Mobile thumb controls) */}
      <div className="util-wizard-footer">
        <div className="util-wizard-hint">
          {isLocked ? (
            <span style={{ color: "#475569", fontWeight: 600 }}>
              Bản chốt số này đã lập hóa đơn, không thể chỉnh sửa.
            </span>
          ) : (
            <span>
              Dữ liệu sẽ tự động đồng bộ sang hóa đơn nháp kỳ {billingPeriod}.
            </span>
          )}
        </div>

        {!isLocked && (
          <div className="util-wizard-submit-group">
            <Button
              busy={submitting}
              disabled={invalidElectric || invalidWater}
              onClick={() => submitReading(activeItem)}
            >
              {activeItem.reading
                ? "Cập nhật chỉ số"
                : "Lưu & Sang phòng tiếp"}
            </Button>
          </div>
        )}

        <div className="util-wizard-mobile-nav">
          <Button
            variant="secondary"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
          >
            <ChevronLeft size={16} /> Phòng trước
          </Button>
          <Button
            variant="secondary"
            disabled={currentIndex >= filteredItems.length - 1}
            onClick={() =>
              setCurrentIndex((prev) =>
                Math.min(filteredItems.length - 1, prev + 1),
              )
            }
          >
            Phòng kế tiếp <ChevronRight size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
