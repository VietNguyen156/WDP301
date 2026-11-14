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
  Sofa,
} from "lucide-react";
import { FurnishingsEditor } from "../../components/furnishings/FurnishingsEditor";
import { ContractFurnishings } from "../../components/furnishings/FurnishingsTable";
import {
  cleanFurnishings,
  effectiveFurnishings,
  furnishingsError,
  furnishingsTotal,
} from "../../utils/furnishings";
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

  const [activeTab, setActiveTab] = useState("basic"); // "basic" | "furnishings" | "pricing"

  // Furniture handed over with the room: empty room, or furnished with the branch catalogue
  // or a list of its own (each item has a unit compensation price).
  const branchFurnishings = branch.defaultFurnishings || [];
  const [furnishingType, setFurnishingType] = useState(
    () => effectiveFurnishings(room || {}, branch).furnishingType,
  );
  const [ownFurnishings, setOwnFurnishings] = useState(() => Array.isArray(room?.furnishings));
  const [furnishingItems, setFurnishingItems] = useState(() =>
    (Array.isArray(room?.furnishings) ? room.furnishings : branchFurnishings).map(
      ({ name, quantity, price, note }) => ({ name, quantity, price, note: note || "" }),
    ),
  );
  const shownFurnishings =
    furnishingType === "UNFURNISHED" ? [] : ownFurnishings ? furnishingItems : branchFurnishings;
  // Furniture and prices are part of the contract: editable with no contract or a draft one,
  // read-only once the contract is signed (the server refuses it too: ROOM_FURNISHINGS_LOCKED).
  // The room list sends the current contract's status and code next to its id.
  const roomContract = room?.currentContractId
    ? { status: room.currentContractStatus, contractCode: room.currentContractCode }
    : null;
  // Also set when the server answers ROOM_FURNISHINGS_LOCKED (list data was stale or not populated).
  const [lockedByServer, setLockedByServer] = useState(false);
  const furnishingsLocked =
    lockedByServer || Boolean(roomContract?.status && roomContract.status !== "DRAFT");
  const draftContract = roomContract?.status === "DRAFT" ? roomContract : null;

  const [form, setForm] = useState(
    bulk
      ? {
          fromFloor: 1,
          toFloor: branch.totalFloors,
          fromRoomNumber: 101,
          toRoomNumber: 105,
          prefix: "P.",
          basePrice: "",
          maxOccupants: 2,
        }
      : {
          roomNumber: room?.roomNumber || "",
          floor: room?.floor || 1,
          basePrice: room?.basePrice || "",
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

    // Rent is required (the field may be on the other tab, where the browser cannot flag it).
    if (!manager && !(Number.isSafeInteger(form.basePrice) && form.basePrice > 0)) {
      if (!bulk) setActiveTab("basic");
      setError("Vui lòng nhập giá thuê niêm yết lớn hơn 0.");
      return;
    }

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

    if (!bulk && !manager && !furnishingsLocked && furnishingType === "FURNISHED" && ownFurnishings) {
      const problem = furnishingsError(furnishingItems);
      if (problem) {
        setActiveTab("furnishings");
        setError(problem);
        setBusy(false);
        return;
      }
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

        if (!furnishingsLocked) body.furnishingType = furnishingType;
        if (!furnishingsLocked && furnishingType === "FURNISHED") {
          if (ownFurnishings) body.furnishings = cleanFurnishings(furnishingItems);
          else if (Array.isArray(room?.furnishings)) body.furnishings = null; // back to the branch list
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
      // Server refusals are shown as a toast; the form stays open with the user's input.
      toast.error(errorMessage(err));
      if (err?.response?.data?.errorCode === "ROOM_FURNISHINGS_LOCKED") {
        setLockedByServer(true);
        setActiveTab("furnishings");
      }
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
              className={`room-form-tab ${activeTab === "furnishings" ? "is-active" : ""}`}
              onClick={() => setActiveTab("furnishings")}
            >
              <Sofa size={15} />
              <span>Vật dụng bàn giao</span>
              <span className="room-tab-badge">
                {furnishingType === "UNFURNISHED" ? "Phòng trống" : `${shownFurnishings.length} món`}
              </span>
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
                  min="1"
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
                      {form.toRoomNumber} với giá thuê chuẩn {form.basePrice ? money(form.basePrice) : "(chưa nhập)"}
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
                      min="1"
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
            ) : activeTab === "furnishings" ? (
              /* Single Room - Furniture handed over with the room */
              <div className="form-section" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {furnishingsLocked ? (
                  <>
                    <p className="room-furnishings-lock">
                      Phòng đang có hợp đồng {roomContract?.contractCode || ""} đã ký: vật dụng bàn giao và đơn giá
                      là một phần của hợp đồng nên chỉ xem, không sửa được. Sửa được khi phòng chưa có hợp đồng
                      hoặc hợp đồng còn nháp; sau khi thanh lý, danh mục mới áp dụng cho hợp đồng sau. Danh mục đã
                      ký xem trong chi tiết hợp đồng.
                    </p>
                    <ContractFurnishings contract={{ furnishingType, furnishings: shownFurnishings }} />
                  </>
                ) : (
                <>
                <div className="furnishing-type-options" role="radiogroup" aria-label="Loại phòng">
                  <label className={`furnishing-type-option ${furnishingType === "UNFURNISHED" ? "is-selected" : ""}`}>
                    <input
                      type="radio"
                      name="furnishingType"
                      checked={furnishingType === "UNFURNISHED"}
                      onChange={() => setFurnishingType("UNFURNISHED")}
                    />
                    <div>
                      <strong>Phòng trống</strong>
                      <small>Không bàn giao vật dụng nào; hợp đồng ghi rõ phòng không kèm đồ.</small>
                    </div>
                  </label>
                  <label className={`furnishing-type-option ${furnishingType === "FURNISHED" ? "is-selected" : ""}`}>
                    <input
                      type="radio"
                      name="furnishingType"
                      checked={furnishingType === "FURNISHED"}
                      onChange={() => setFurnishingType("FURNISHED")}
                    />
                    <div>
                      <strong>Phòng đầy đủ đồ</strong>
                      <small>Bàn giao kèm vật dụng; đơn giá từng món được ghi vào hợp đồng khi ký.</small>
                    </div>
                  </label>
                </div>

                {furnishingType === "FURNISHED" && (
                  <>
                    <label className="pricing-toggle-card" style={{ cursor: "pointer" }}>
                      <div className="pricing-toggle-left">
                        <div className="pricing-toggle-icon">
                          <Sofa size={20} />
                        </div>
                        <div>
                          <h4 className="pricing-toggle-title">Khai danh mục riêng cho phòng này</h4>
                          <p className="pricing-toggle-desc">
                            {ownFurnishings
                              ? "Phòng dùng danh mục riêng bên dưới, không theo cơ sở."
                              : `Đang dùng danh mục chung của cơ sở ${branch.name} (${branchFurnishings.length} món). Bật để thêm, bớt hoặc đổi đơn giá cho riêng phòng này.`}
                          </p>
                        </div>
                      </div>
                      <span className="room-switch">
                        <input
                          type="checkbox"
                          checked={ownFurnishings}
                          onChange={(e) => setOwnFurnishings(e.target.checked)}
                        />
                        <span className="room-slider" />
                      </span>
                    </label>

                    {ownFurnishings ? (
                      <FurnishingsEditor
                        items={furnishingItems}
                        onChange={setFurnishingItems}
                        disabled={busy}
                      />
                    ) : branchFurnishings.length === 0 ? (
                      <div className="furnishings-empty">
                        Cơ sở chưa có danh mục vật dụng. Khai ở Cơ sở &gt; Cấu hình &gt; Dịch vụ &amp; Vật dụng, hoặc
                        bật danh mục riêng cho phòng này.
                      </div>
                    ) : (
                      <div className="furnishings-table-wrap">
                        <table className="furnishings-table">
                          <thead>
                            <tr>
                              <th>Vật dụng (theo cơ sở)</th>
                              <th>SL</th>
                              <th style={{ textAlign: "right" }}>Đơn giá</th>
                              <th style={{ textAlign: "right" }}>Thành tiền</th>
                            </tr>
                          </thead>
                          <tbody>
                            {branchFurnishings.map((item) => (
                              <tr key={item.name}>
                                <td>{item.name}</td>
                                <td>{item.quantity}</td>
                                <td className="furnishings-amount">{money(item.price)}</td>
                                <td className="furnishings-amount">{money(item.price * item.quantity)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr>
                              <td colSpan={3}>Tổng giá trị tài sản bàn giao</td>
                              <td className="furnishings-amount">{money(furnishingsTotal(branchFurnishings))}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </>
                )}

                </>
                )}

                {draftContract ? (
                  <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
                    Hợp đồng {draftContract.contractCode || ""} còn nháp: khi lưu, hợp đồng nháp nhận danh mục và đơn
                    giá mới.
                  </p>
                ) : null}
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
