import { useState } from "react";
import {
  Plus,
  Trash2,
  Zap,
  Droplets,
  Receipt,
  ShieldAlert,
  Layers,
  Sparkles,
  SlidersHorizontal,
  Building,
  CheckCircle2,
} from "lucide-react";
import {
  Button,
  Field,
  SelectField,
  Modal,
  FormError,
} from "../../components/ui";
import { roomApi, errorMessage } from "../../services/api";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import { money } from "../../utils/format";

export default function RoomForm({
  branch,
  room,
  bulk = false,
  onSaved,
  onClose,
}) {
  const manager = useAuth().user.role === "PROPERTY_MANAGER";
  const toast = useToast();

  const [activeTab, setActiveTab] = useState("basic"); // "basic" | "pricing"

  const [form, setForm] = useState(
    bulk
      ? {
          fromFloor: 1,
          toFloor: branch.totalFloors,
          fromRoomNumber: 101,
          toRoomNumber: 105,
          prefix: "P.",
          basePrice: 0,
          maxOccupants: 2,
        }
      : {
          roomNumber: room?.roomNumber || "",
          floor: room?.floor || 1,
          basePrice: room?.basePrice || 0,
          maxOccupants: room?.maxOccupants || 2,
          status: room?.status || "EMPTY",
          amenities: room?.amenities?.join(", ") || "",
          notes: room?.notes || "",
        },
  );

  // Pricing & Services overrides (Landlord only)
  const [hasCustomPricing, setHasCustomPricing] = useState(() => {
    return Boolean(
      room?.electricityPrice !== undefined ||
        room?.waterPrice !== undefined ||
        room?.waterBillingType ||
        room?.services !== undefined,
    );
  });

  const [electricityPrice, setElectricityPrice] = useState(
    room?.electricityPrice !== undefined ? room.electricityPrice : "",
  );
  const [waterBillingType, setWaterBillingType] = useState(
    room?.waterBillingType || "",
  );
  const [waterPrice, setWaterPrice] = useState(
    room?.waterPrice !== undefined ? room.waterPrice : "",
  );

  const [serviceOption, setServiceOption] = useState(() => {
    if (Array.isArray(room?.services) && room.services.length === 0)
      return "NONE";
    if (Array.isArray(room?.services) && room.services.length > 0)
      return "CUSTOM";
    return "BRANCH";
  });

  const [customServices, setCustomServices] = useState(() => {
    if (Array.isArray(room?.services) && room.services.length > 0) {
      return room.services.map((s) => ({
        name: s.name || "",
        price: s.price ?? 0,
        billingType: s.billingType || "FIXED",
        unit: s.unit || "",
      }));
    }
    return [];
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const change = (key) => (e) =>
    setForm((current) => ({
      ...current,
      [key]:
        e.target.type === "number" && e.target.value !== ""
          ? Number(e.target.value)
          : e.target.value,
    }));

  const branchFloorLimit = Math.max(1, Number(branch.totalFloors) || 1);

  const count = bulk
    ? Number.isInteger(form.fromFloor) &&
      Number.isInteger(form.toFloor) &&
      Number.isInteger(form.fromRoomNumber) &&
      Number.isInteger(form.toRoomNumber)
      ? Math.max(0, form.toFloor - form.fromFloor + 1) *
        Math.max(0, form.toRoomNumber - form.fromRoomNumber + 1)
      : 0
    : 0;

  function addService() {
    setCustomServices((prev) => [
      ...prev,
      { name: "", price: 0, billingType: "FIXED", unit: "" },
    ]);
  }

  function removeService(index) {
    setCustomServices((prev) => prev.filter((_, i) => i !== index));
  }

  function updateService(index, field, value) {
    setCustomServices((prev) =>
      prev.map((s, i) =>
        i === index
          ? {
              ...s,
              [field]: field === "price" ? Math.max(0, Number(value)) : value,
            }
          : s,
      ),
    );
  }

  async function submit(e) {
    e.preventDefault();
    setError("");

    const floorStart = bulk ? form.fromFloor : form.floor;
    const floorEnd = bulk ? form.toFloor : form.floor;
    const floorChanged =
      !bulk && room ? Number(form.floor) !== Number(room.floor) : true;
    const hasValidFloorRange =
      Number.isInteger(floorStart) &&
      Number.isInteger(floorEnd) &&
      floorStart >= 1 &&
      floorEnd >= floorStart &&
      (!floorChanged || floorEnd <= branchFloorLimit);

    if (!hasValidFloorRange) {
      setError(
        bulk
          ? `Tầng phải là số nguyên từ 1 đến ${branchFloorLimit}, và tầng kết thúc không được nhỏ hơn tầng bắt đầu.`
          : `Tầng phải là số nguyên từ 1 đến ${branchFloorLimit}.`,
      );
      return;
    }

    setBusy(true);

    // Manager guard: cannot reactivate INACTIVE room
    if (manager && room?.status === "INACTIVE") {
      setError(
        "Quản lý cơ sở không được phép mở lại phòng đã ngừng hoạt động (INACTIVE).",
      );
      setBusy(false);
      return;
    }

    // Occupants reduction guard
    const currentOccupants =
      room?.occupantsCount ||
      room?.currentOccupants ||
      (room?.status === "RENTED" ? 1 : 0);
    if (!bulk && !manager && form.maxOccupants < currentOccupants) {
      setError(
        `Không thể giảm sức chứa xuống ${form.maxOccupants} vì phòng đang có ${currentOccupants} người ở.`,
      );
      setBusy(false);
      return;
    }

    // Services validation
    if (!bulk && !manager && hasCustomPricing && serviceOption === "CUSTOM") {
      const names = new Set();
      for (const s of customServices) {
        const trimmedName = s.name.trim();
        if (!trimmedName) {
          setError("Tên dịch vụ không được để trống.");
          setBusy(false);
          return;
        }
        if (trimmedName.includes(".") || trimmedName.includes("$")) {
          setError(
            `Tên dịch vụ "${trimmedName}" không được chứa ký tự "." hoặc "$".`,
          );
          setBusy(false);
          return;
        }
        if (names.has(trimmedName)) {
          setError(`Tên dịch vụ "${trimmedName}" bị trùng lặp trong phòng.`);
          setBusy(false);
          return;
        }
        names.add(trimmedName);
        if (s.price < 0 || !Number.isInteger(Number(s.price))) {
          setError(
            `Đơn giá dịch vụ "${trimmedName}" phải là số nguyên không âm.`,
          );
          setBusy(false);
          return;
        }
      }
    }

    try {
      let body;
      if (bulk) {
        body = { ...form };
      } else if (manager) {
        body = { status: form.status };
      } else {
        body = {
          ...form,
          amenities: form.amenities
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean),
        };

        if (room && !floorChanged) {
          delete body.floor;
        }

        if (hasCustomPricing) {
          if (electricityPrice !== "") {
            body.electricityPrice = Math.max(
              0,
              Math.round(Number(electricityPrice)),
            );
          } else {
            body.electricityPrice = undefined;
          }

          if (waterBillingType) {
            body.waterBillingType = waterBillingType;
          } else {
            body.waterBillingType = undefined;
          }

          if (waterPrice !== "") {
            body.waterPrice = Math.max(0, Math.round(Number(waterPrice)));
          } else {
            body.waterPrice = undefined;
          }

          if (serviceOption === "NONE") {
            body.services = []; // Explicitly no services for this room
          } else if (serviceOption === "CUSTOM") {
            body.services = customServices.map((s) => ({
              name: s.name.trim(),
              price: Math.max(0, Math.round(Number(s.price))),
              billingType: s.billingType,
              unit: s.unit?.trim() || undefined,
            }));
          } else {
            body.services = undefined; // Fallback to branch services
          }
        } else {
          // Reset custom overrides to branch defaults
          body.electricityPrice = undefined;
          body.waterPrice = undefined;
          body.waterBillingType = undefined;
          body.services = undefined;
        }
      }

      // Do not allow status change if rented
      if (room?.status === "RENTED") {
        delete body.status;
      }

      if (bulk) await roomApi.bulk(branch._id, body);
      else if (room) await roomApi.update(room._id, body);
      else await roomApi.create(branch._id, body);

      toast.success(
        bulk
          ? `Đã tạo ${count} phòng thành công.`
          : room
            ? `Đã cập nhật phòng ${form.roomNumber || room.roomNumber}`
            : `Đã thêm phòng ${form.roomNumber} mới`,
      );
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={
        bulk
          ? "Sinh phòng nhanh hàng loạt"
          : room
            ? `Cập nhật phòng ${room.roomNumber}`
            : "Thêm phòng mới"
      }
      subtitle={`Cơ sở: ${branch.name}`}
      onClose={onClose}
      busy={busy}
      wide={!bulk && !manager}
    >
      <div className="room-modal-wrapper">
        {/* Tab Switcher for Landlord in Single Room mode */}
        {!bulk && !manager && (
          <div className="room-form-tabs">
            <button
              type="button"
              className={`room-form-tab ${activeTab === "basic" ? "is-active" : ""}`}
              onClick={() => setActiveTab("basic")}
            >
              <SlidersHorizontal size={15} />
              <span>Thông tin cơ bản & Tiện nghi</span>
            </button>
            <button
              type="button"
              className={`room-form-tab ${activeTab === "pricing" ? "is-active" : ""}`}
              onClick={() => setActiveTab("pricing")}
            >
              <Zap size={15} />
              <span>Đơn giá & Dịch vụ riêng</span>
              {hasCustomPricing && (
                <span className="room-tab-badge">Đang bật</span>
              )}
            </button>
          </div>
        )}

        <form onSubmit={submit}>
          <fieldset
            disabled={busy}
            style={{ border: "none", padding: 0, margin: 0 }}
          >
            {bulk ? (
              /* Bulk Generation Mode */
              <div className="form-section form-grid">
                <Field
                  label="Từ tầng"
                  type="number"
                  min="1"
                  max={branchFloorLimit}
                  required
                  value={form.fromFloor}
                  onChange={change("fromFloor")}
                />
                <Field
                  label="Đến tầng"
                  type="number"
                  min={form.fromFloor}
                  max={branchFloorLimit}
                  required
                  value={form.toFloor}
                  onChange={change("toFloor")}
                />
                <Field
                  label="Số phòng bắt đầu"
                  type="number"
                  min="1"
                  required
                  value={form.fromRoomNumber}
                  onChange={change("fromRoomNumber")}
                />
                <Field
                  label="Số phòng kết thúc"
                  type="number"
                  min={form.fromRoomNumber}
                  required
                  value={form.toRoomNumber}
                  onChange={change("toRoomNumber")}
                />
                <Field
                  label="Tiền tố tên phòng"
                  value={form.prefix}
                  onChange={change("prefix")}
                  hint="Ví dụ: P. → P.101, P.102…"
                />
                <Field
                  label="Giá thuê niêm yết chuẩn (₫/tháng)"
                  type="number"
                  min="0"
                  required
                  value={form.basePrice}
                  onChange={change("basePrice")}
                />
                <Field
                  label="Số người tối đa chuẩn"
                  type="number"
                  min="1"
                  max="30"
                  required
                  value={form.maxOccupants}
                  onChange={change("maxOccupants")}
                />

                <div className="span-2">
                  <div className="room-batch-preview">
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        marginBottom: "6px",
                      }}
                    >
                      <Layers size={18} color="#16a34a" />
                      <strong>Dự kiến sinh {count} phòng tự động</strong>
                    </div>
                    <p style={{ margin: 0, color: "var(--room-text-muted)" }}>
                      Phân bố từ Tầng {form.fromFloor} đến Tầng {form.toFloor}. Mỗi
                      tầng gồm các phòng từ {form.prefix}
                      {form.fromRoomNumber} đến {form.prefix}
                      {form.toRoomNumber} với giá thuê chuẩn {money(form.basePrice)}
                      /tháng.
                    </p>
                  </div>
                </div>
              </div>
            ) : activeTab === "basic" ? (
              /* Single Room - Basic Info Tab */
              <div className="form-section form-grid">
                {!manager && (
                  <>
                    <Field
                      label="Số / tên phòng"
                      required
                      value={form.roomNumber}
                      onChange={change("roomNumber")}
                      placeholder="VD: P.101, P.202"
                    />
                    <Field
                      label="Tầng"
                      type="number"
                      min="1"
                      max="100"
                      required
                      value={form.floor}
                      onChange={change("floor")}
                      hint={`Tầng hợp lệ theo cơ sở: 1-${branchFloorLimit}`}
                    />
                    <Field
                      label="Giá thuê niêm yết (₫/tháng)"
                      type="number"
                      min="0"
                      required
                      value={form.basePrice}
                      onChange={change("basePrice")}
                    />
                    <Field
                      label="Số người tối đa"
                      type="number"
                      min="1"
                      max="30"
                      required
                      value={form.maxOccupants}
                      onChange={change("maxOccupants")}
                      hint="Không thể giảm dưới số người đang cư trú"
                    />
                  </>
                )}

                {room?.status !== "RENTED" ? (
                  <SelectField
                    label="Trạng thái vận hành"
                    value={form.status}
                    onChange={change("status")}
                    disabled={manager && room?.status === "INACTIVE"}
                  >
                    <option value="EMPTY">Phòng trống (Sẵn sàng)</option>
                    <option value="CLEANING">Cần dọn dẹp</option>
                    <option value="MAINTENANCE">Đang bảo trì</option>
                    {!manager && (
                      <option value="INACTIVE">Ngừng hoạt động (Tạm dừng)</option>
                    )}
                  </SelectField>
                ) : (
                  <div
                    className="span-2"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "10px 14px",
                      background: "#f0fdf4",
                      borderRadius: "8px",
                      border: "1px solid #bbf7d0",
                      color: "#166534",
                      fontSize: "13px",
                    }}
                  >
                    <ShieldAlert size={16} />
                    <span>
                      Phòng đang có hợp đồng thuê hoạt động. Không thể thay đổi
                      trạng thái cho đến khi thanh lý hợp đồng.
                    </span>
                  </div>
                )}

                {!manager && (
                  <>
                    <Field
                      label="Tiện nghi phòng"
                      value={form.amenities}
                      onChange={change("amenities")}
                      placeholder="Điều hòa, Nóng lạnh, Tủ lạnh, Ban công..."
                      hint="Phân cách bằng dấu phẩy"
                    />
                    <div className="span-2">
                      <Field label="Ghi chú nội bộ">
                        <textarea
                          value={form.notes}
                          onChange={change("notes")}
                          rows={2}
                          placeholder="Ghi chú chi tiết về tình trạng bàn giao, chìa khóa..."
                        />
                      </Field>
                    </div>
                  </>
                )}
              </div>
            ) : (
              /* Single Room - Custom Pricing & Services Tab */
              <div>
                {/* Modern Toggle Switch Card */}
                <div
                  className={`pricing-toggle-card ${hasCustomPricing ? "is-active" : ""}`}
                >
                  <div className="pricing-toggle-left">
                    <div className="pricing-toggle-icon">
                      <Zap size={20} />
                    </div>
                    <div>
                      <h4 className="pricing-toggle-title">
                        Tùy chỉnh biểu giá & Dịch vụ riêng cho phòng này
                      </h4>
                      <p className="pricing-toggle-desc">
                        Bật công tắc này nếu phòng áp dụng đơn giá điện, nước hoặc
                        dịch vụ đặc thù khác với quy chuẩn chung của cơ sở (
                        {branch.name}).
                      </p>
                    </div>
                  </div>

                  <label className="room-switch">
                    <input
                      type="checkbox"
                      checked={hasCustomPricing}
                      onChange={(e) => setHasCustomPricing(e.target.checked)}
                    />
                    <span className="room-slider" />
                  </label>
                </div>

                {hasCustomPricing ? (
                  <div className="custom-pricing-box">
                    <div className="custom-pricing-grid">
                      <Field
                        label="Đơn giá điện riêng (₫/kWh)"
                        type="number"
                        min="0"
                        placeholder={`Mặc định cơ sở: ${branch.pricing?.electricityPrice || branch.defaultElectricityPrice || 0}₫`}
                        value={electricityPrice}
                        onChange={(e) => setElectricityPrice(e.target.value)}
                        hint="Để trống nếu muốn áp dụng theo cơ sở"
                      />

                      <SelectField
                        label="Cách tính nước riêng"
                        value={waterBillingType}
                        onChange={(e) => setWaterBillingType(e.target.value)}
                      >
                        <option value="">
                          Theo cơ sở ({branch.waterBillingType || "Mặc định"})
                        </option>
                        <option value="METER">Theo đồng hồ (₫/m³)</option>
                        <option value="PER_PERSON">
                          Theo đầu người (₫/người/tháng)
                        </option>
                        <option value="FIXED">
                          Khoán trọn gói (₫/phòng/tháng)
                        </option>
                      </SelectField>

                      <Field
                        label="Đơn giá nước riêng (₫)"
                        type="number"
                        min="0"
                        placeholder={`Mặc định cơ sở: ${branch.pricing?.waterPrice || branch.defaultWaterPrice || 0}₫`}
                        value={waterPrice}
                        onChange={(e) => setWaterPrice(e.target.value)}
                        hint="Để trống nếu muốn áp dụng theo cơ sở"
                      />

                      <SelectField
                        label="Chính sách Dịch vụ"
                        value={serviceOption}
                        onChange={(e) => setServiceOption(e.target.value)}
                      >
                        <option value="BRANCH">
                          Kế thừa toàn bộ dịch vụ của Cơ sở
                        </option>
                        <option value="NONE">
                          Phòng này miễn thu phí dịch vụ
                        </option>
                        <option value="CUSTOM">
                          Thiết lập danh mục dịch vụ riêng
                        </option>
                      </SelectField>
                    </div>

                    {serviceOption === "CUSTOM" && (
                      <div className="custom-services-section">
                        <div className="custom-services-header">
                          <h4>Danh mục dịch vụ riêng của phòng:</h4>
                          <Button
                            type="button"
                            variant="secondary"
                            compact
                            onClick={addService}
                          >
                            <Plus size={14} /> Thêm dịch vụ
                          </Button>
                        </div>

                        {customServices.length === 0 ? (
                          <div className="custom-service-empty">
                            Chưa có dịch vụ riêng nào. Nhấn "Thêm dịch vụ" để
                            tạo mới.
                          </div>
                        ) : (
                          <div>
                            {customServices.map((srv, idx) => (
                              <div className="custom-service-row" key={idx}>
                                <input
                                  type="text"
                                  placeholder="Tên dịch vụ (VD: Giữ xe máy)"
                                  value={srv.name}
                                  onChange={(e) =>
                                    updateService(idx, "name", e.target.value)
                                  }
                                  required
                                />
                                <input
                                  type="number"
                                  placeholder="Đơn giá (₫)"
                                  min="0"
                                  value={srv.price}
                                  onChange={(e) =>
                                    updateService(idx, "price", e.target.value)
                                  }
                                  required
                                />
                                <select
                                  value={srv.billingType}
                                  onChange={(e) =>
                                    updateService(
                                      idx,
                                      "billingType",
                                      e.target.value,
                                    )
                                  }
                                >
                                  <option value="FIXED">Khoán/phòng</option>
                                  <option value="PER_PERSON">Đầu người</option>
                                  <option value="PER_UNIT">Theo số lượng</option>
                                </select>
                                <button
                                  type="button"
                                  className="unit-btn-icon danger-hover"
                                  onClick={() => removeService(idx)}
                                  title="Xóa dịch vụ này"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    style={{
                      background: "#f8fafc",
                      border: "1px dashed var(--room-border)",
                      borderRadius: "12px",
                      padding: "20px",
                      display: "flex",
                      alignItems: "center",
                      gap: "14px",
                    }}
                  >
                    <Building size={24} color="var(--room-primary-container)" />
                    <div>
                      <h4
                        style={{
                          margin: "0 0 4px 0",
                          fontSize: "13px",
                          fontWeight: 700,
                          color: "var(--room-text-main)",
                        }}
                      >
                        Đang áp dụng biểu giá mặc định của Cơ sở ({branch.name})
                      </h4>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "12px",
                          color: "var(--room-text-muted)",
                          lineHeight: 1.5,
                        }}
                      >
                        • Điện:{" "}
                        {branch.pricing?.electricityPrice ||
                          branch.defaultElectricityPrice ||
                          0}{" "}
                        ₫/kWh &nbsp; | &nbsp; • Nước:{" "}
                        {branch.waterBillingType || "Mặc định"} (
                        {branch.pricing?.waterPrice ||
                          branch.defaultWaterPrice ||
                          0}{" "}
                        ₫) &nbsp; | &nbsp; • Dịch vụ: Kế thừa tất cả dịch vụ chung
                        của cơ sở.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </fieldset>

          <FormError error={error} />

          <footer className="modal-footer" style={{ marginTop: "20px" }}>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={onClose}
            >
              Hủy bỏ
            </Button>
            <Button busy={busy}>
              {bulk ? "Tạo danh sách phòng" : "Lưu thay đổi"}
            </Button>
          </footer>
        </form>
      </div>
    </Modal>
  );
}
