import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Trash2,
  Calendar,
  Building,
  Home,
  User,
  ShieldCheck,
  CreditCard,
  Zap,
  Droplets,
  Layers,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  FileCheck2,
} from "lucide-react";
import {
  branchApi,
  roomApi,
  contractApi,
  errorMessage,
} from "../../services/api";
import { useResource } from "../../hooks/useResource";
import { useToast } from "../../context/ToastContext";
import {
  Button,
  Field,
  SelectField,
  Modal,
  FormError,
  LoadingState,
  ErrorState,
} from "../../components/ui";
import { CredentialsModal } from "../../components/ui/CredentialsModal";
import { money, today } from "../../utils/format";
import "./Contracts.css";

export default function ContractForm({
  branchId = "",
  roomId = "",
  onClose,
  onSaved,
}) {
  const toast = useToast();
  const branches = useResource(branchApi.options);
  const [step, setStep] = useState(1); // Step 1: Room & Duration | Step 2: Tenant & Services
  const [issuedCredentials, setIssuedCredentials] = useState(null);
  const [serviceQuantities, setServiceQuantities] = useState({});

  const [form, setForm] = useState({
    branchId,
    roomId,
    tenant: {
      name: "",
      email: "",
      phoneNumber: "",
      citizenId: "",
      hometown: "",
    },
    startDate: today(),
    endDate: "",
    rentalPrice: 0,
    depositAmount: 0,
    depositStatus: "UNPAID",
    initialElectricIndex: 0,
    initialWaterIndex: 0,
    roommates: [],
    notes: "",
  });

  const rooms = useResource(
    () => (form.branchId ? roomApi.available(form.branchId) : Promise.resolve([])),
    [form.branchId],
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const initialized = useRef(false);

  // Sync initial room if roomId passed
  useEffect(() => {
    const selected = rooms.data?.find((room) => room._id === roomId);
    if (!initialized.current && selected) {
      initialized.current = true;
      setForm((current) =>
        current.roomId === roomId
          ? {
              ...current,
              rentalPrice: selected.basePrice,
              depositAmount: selected.basePrice,
              initialElectricIndex: selected.currentElectricIndex,
              initialWaterIndex: selected.currentWaterIndex,
            }
          : current,
      );
    }
  }, [rooms.data, roomId]);

  // Quick End Date Calculator (3, 6, 12, 24 months)
  function applyQuickDuration(months) {
    if (!form.startDate) return;
    const start = new Date(form.startDate);
    const end = new Date(start);
    end.setMonth(end.getMonth() + months);
    end.setDate(end.getDate() - 1);
    const yyyy = end.getFullYear();
    const mm = String(end.getMonth() + 1).padStart(2, "0");
    const dd = String(end.getDate()).padStart(2, "0");
    setForm((f) => ({ ...f, endDate: `${yyyy}-${mm}-${dd}` }));
  }

  const change = (key) => (e) =>
    setForm({
      ...form,
      [key]: e.target.type === "number" ? Number(e.target.value) : e.target.value,
    });

  const tenantChange = (key) => (e) =>
    setForm({ ...form, tenant: { ...form.tenant, [key]: e.target.value } });

  function chooseRoom(id) {
    const room = rooms.data.find((r) => r._id === id);
    setForm({
      ...form,
      roomId: id,
      rentalPrice: room?.basePrice || 0,
      depositAmount: room?.basePrice || 0,
      initialElectricIndex: room?.currentElectricIndex || 0,
      initialWaterIndex: room?.currentWaterIndex || 0,
    });
  }

  const selectedBranch = branches.data?.find((b) => b._id === form.branchId);
  const selectedRoom = rooms.data?.find((r) => r._id === form.roomId);

  // Derive effective services for the selected room/branch
  const effectiveServices = (() => {
    if (selectedRoom && Array.isArray(selectedRoom.services)) {
      return selectedRoom.services;
    }
    return selectedBranch?.services || [];
  })();

  const perUnitServices = effectiveServices.filter((s) => s.billingType === "PER_UNIT");

  useEffect(() => {
    if (perUnitServices.length > 0) {
      setServiceQuantities((prev) => {
        const next = { ...prev };
        for (const s of perUnitServices) {
          if (next[s.name] === undefined) {
            next[s.name] = 1;
          }
        }
        return next;
      });
    }
  }, [form.roomId, form.branchId]);

  function handleQuantityChange(serviceName, val) {
    const num = Math.max(0, parseInt(val, 10) || 0);
    setServiceQuantities((prev) => ({
      ...prev,
      [serviceName]: num,
    }));
  }

  function validateStep1() {
    if (!form.branchId) {
      setError("Vui lòng chọn cơ sở quản lý.");
      return false;
    }
    if (!form.roomId) {
      setError("Vui lòng chọn phòng trống cần lập hợp đồng.");
      return false;
    }
    if (!form.startDate || !form.endDate) {
      setError("Vui lòng nhập ngày bắt đầu và ngày kết thúc hợp đồng.");
      return false;
    }
    if (new Date(form.endDate) <= new Date(form.startDate)) {
      setError("Ngày kết thúc hợp đồng phải sau ngày bắt đầu.");
      return false;
    }
    if (form.rentalPrice <= 0) {
      setError("Giá thuê thỏa thuận phải lớn hơn 0.");
      return false;
    }
    if (form.depositAmount < 0) {
      setError("Tiền cọc không được là số âm.");
      return false;
    }
    setError("");
    return true;
  }

  function handleNextStep() {
    if (validateStep1()) {
      setStep(2);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setError("");

    // Validate CCCD
    if (!form.tenant.name.trim()) {
      setError("Vui lòng nhập họ và tên khách đại diện ký hợp đồng.");
      return;
    }
    const cleanCCCD = form.tenant.citizenId.trim();
    if (!cleanCCCD || !/^\d{12}$/.test(cleanCCCD)) {
      setError("Số CCCD của khách thuê bắt buộc phải gồm 12 chữ số theo quy định.");
      return;
    }

    // Validate PER_UNIT service quantities
    if (perUnitServices.length > 0) {
      for (const s of perUnitServices) {
        const q = serviceQuantities[s.name];
        if (q === undefined || q === null || q === "" || Number(q) < 0) {
          setError(`Vui lòng xác định số lượng hợp lệ cho dịch vụ "${s.name}".`);
          return;
        }
      }
    }

    setBusy(true);

    try {
      const payload = {
        ...form,
        tenant: {
          ...form.tenant,
          citizenId: cleanCCCD,
        },
        serviceQuantities: perUnitServices.length > 0 ? serviceQuantities : undefined,
      };

      const res = await contractApi.create(payload);

      toast.success(
        `Đã tạo hợp đồng thành công cho phòng ${selectedRoom?.roomNumber || ""}. Phòng chuyển trạng thái Đang thuê (RENTED).`
      );

      // Check if credentials returned for new tenant
      const creds = res?.tenantCredentials || res?.data?.tenantCredentials;
      if (creds) {
        setIssuedCredentials({
          ...creds,
          tenantName: form.tenant.name,
          roomNumber: selectedRoom?.roomNumber,
        });
      } else {
        onSaved?.();
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function addRoommate() {
    setForm({
      ...form,
      roommates: [
        ...form.roommates,
        { fullName: "", citizenId: "", phoneNumber: "" },
      ],
    });
  }

  function updateRoommate(index, key, val) {
    const list = [...form.roommates];
    list[index][key] = val;
    setForm({ ...form, roommates: list });
  }

  function removeRoommate(index) {
    const list = form.roommates.filter((_, i) => i !== index);
    setForm({ ...form, roommates: list });
  }

  return (
    <>
      <Modal
        title="Lập Hợp đồng Thuê phòng & Cấp Tài khoản Khách thuê"
        subtitle="Quy trình 2 bước chuẩn hóa: Chọn phòng, định mức dịch vụ & định danh CCCD tự động"
        onClose={onClose}
        busy={busy}
        maxWidth="820px"
        className="contract-form-modal"
      >
        {/* Stepper Header (Stitch Screen 2df030b8 & 11d71634) */}
        <div className="contract-stepper-header">
          <div
            className={`stepper-step ${step === 1 ? "active" : step > 1 ? "completed" : ""}`}
            onClick={() => setStep(1)}
          >
            <div className="stepper-circle">
              {step > 1 ? "✓" : "1"}
            </div>
            <div>
              <div className="stepper-title">Bước 1: Chọn phòng & Thời hạn</div>
              <div className="stepper-subtitle">Cơ sở, phòng trống, giá thuê & cọc</div>
            </div>
          </div>

          <div
            className={`stepper-step ${step === 2 ? "active" : ""}`}
            onClick={() => {
              if (validateStep1()) setStep(2);
            }}
          >
            <div className="stepper-circle">2</div>
            <div>
              <div className="stepper-title">Bước 2: Khách thuê & Dịch vụ</div>
              <div className="stepper-subtitle">Định danh CCCD 12 số, thành viên & dịch vụ</div>
            </div>
          </div>
        </div>

        <form onSubmit={submit} className="contract-form-content">
          {error && <FormError message={error} />}

          {/* STEP 1: Chọn phòng & Thời hạn */}
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Chọn Cơ sở */}
              <div className="form-grid-2col">
                <SelectField
                  label="Cơ sở / Tòa nhà"
                  value={form.branchId}
                  onChange={(e) => {
                    setForm({ ...form, branchId: e.target.value, roomId: "" });
                  }}
                  required
                >
                  <option value="">-- Chọn cơ sở --</option>
                  {branches.data?.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.name}
                    </option>
                  ))}
                </SelectField>

                <div style={{ display: "flex", alignItems: "flex-end" }}>
                  <div style={{ fontSize: 12, color: "#64748b", paddingBottom: 8 }}>
                    {form.branchId && (
                      <span>
                        Số phòng trống sẵn sàng: <strong>{rooms.data?.length || 0} phòng</strong>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Lưới chọn Phòng Trống */}
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--contracts-on-surface)", marginBottom: 6 }}>
                  Chọn phòng trống cần ký hợp đồng <span style={{ color: "var(--contracts-error)" }}>*</span>
                </label>
                {rooms.loading ? (
                  <LoadingState message="Đang tải danh sách phòng trống..." />
                ) : !form.branchId ? (
                  <div style={{ padding: "16px", background: "#f8fafc", borderRadius: 8, textAlign: "center", color: "#64748b", fontSize: 13 }}>
                    Vui lòng chọn cơ sở bên trên để xem danh sách phòng trống.
                  </div>
                ) : !rooms.data?.length ? (
                  <div style={{ padding: "16px", background: "#fffbeb", borderRadius: 8, textAlign: "center", color: "#b45309", fontSize: 13 }}>
                    Cơ sở này hiện không còn phòng trống (`EMPTY`). Vui lòng chọn cơ sở khác.
                  </div>
                ) : (
                  <div className="room-selection-grid">
                    {rooms.data.map((r) => {
                      const isSel = form.roomId === r._id;
                      return (
                        <div
                          key={r._id}
                          className={`room-card-select ${isSel ? "is-selected" : ""}`}
                          onClick={() => chooseRoom(r._id)}
                        >
                          <span className="room-title">P.{r.roomNumber}</span>
                          <span style={{ fontSize: 11, color: "#64748b" }}>Tầng {r.floor || 1}</span>
                          <div className="room-price">{money(r.basePrice)}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Thời hạn hợp đồng & Nút chọn nhanh */}
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--contracts-on-surface)" }}>
                    Thời hạn thuê phòng
                  </span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <span style={{ fontSize: 11, color: "#64748b", alignSelf: "center", marginRight: 4 }}>
                      Gợi ý nhanh:
                    </span>
                    <button type="button" className="quick-duration-btn" onClick={() => applyQuickDuration(3)}>
                      3 Tháng
                    </button>
                    <button type="button" className="quick-duration-btn" onClick={() => applyQuickDuration(6)}>
                      6 Tháng
                    </button>
                    <button type="button" className="quick-duration-btn" onClick={() => applyQuickDuration(12)}>
                      1 Năm (12T)
                    </button>
                    <button type="button" className="quick-duration-btn" onClick={() => applyQuickDuration(24)}>
                      2 Năm
                    </button>
                  </div>
                </div>

                <div className="form-grid-2col">
                  <Field
                    label="Ngày bắt đầu hiệu lực"
                    type="date"
                    value={form.startDate}
                    onChange={change("startDate")}
                    required
                  />
                  <Field
                    label="Ngày kết thúc hợp đồng"
                    type="date"
                    value={form.endDate}
                    onChange={change("endDate")}
                    required
                  />
                </div>
              </div>

              {/* Tài chính & Tiền cọc */}
              <div className="form-grid-3col">
                <Field
                  label="Giá thuê thỏa thuận (đ/tháng)"
                  type="number"
                  value={form.rentalPrice}
                  onChange={change("rentalPrice")}
                  required
                />
                <Field
                  label="Tiền cọc phòng (đ)"
                  type="number"
                  value={form.depositAmount}
                  onChange={change("depositAmount")}
                  required
                />
                <SelectField
                  label="Trạng thái cọc hiện tại"
                  value={form.depositStatus}
                  onChange={change("depositStatus")}
                >
                  <option value="UNPAID">Chưa thu cọc</option>
                  <option value="PAID">Đã thu đủ tiền cọc</option>
                </SelectField>
              </div>

              {/* Chỉ số điện / nước ban đầu bàn giao */}
              <div className="form-grid-2col">
                <Field
                  label="Chỉ số điện bàn giao ban đầu (kWh)"
                  type="number"
                  value={form.initialElectricIndex}
                  onChange={change("initialElectricIndex")}
                  required
                />
                <Field
                  label="Chỉ số nước bàn giao ban đầu (m³)"
                  type="number"
                  value={form.initialWaterIndex}
                  onChange={change("initialWaterIndex")}
                  required
                />
              </div>

              {/* Footer Buttons Step 1 */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10, paddingTop: 12, borderTop: "1px solid #e2e8f0" }}>
                <Button variant="secondary" onClick={onClose} disabled={busy}>
                  Hủy bỏ
                </Button>
                <Button type="button" onClick={handleNextStep}>
                  <span>Tiếp tục sang Bước 2</span>
                  <ArrowRight size={16} />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: Khách thuê, CCCD & Dịch vụ */}
          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Zero-Touch Provisioning Banner (PROJECT_RULES Section 08 & 11) */}
              <div style={{ padding: "12px 14px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, fontSize: 12.5, color: "#166534", lineHeight: 1.45 }}>
                <strong style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <ShieldCheck size={16} color="#16a34a" />
                  Cơ chế cấp tài khoản tự động (Zero-Touch Provisioning):
                </strong>
                Hệ thống sẽ tự động cấp tài khoản cho khách thuê với <strong>Username là Số CCCD 12 số</strong>. Mật khẩu tạm ngẫu nhiên sẽ được hiển thị ngay sau khi tạo để bạn bàn giao cho khách (Bãi bỏ hoàn toàn OTP theo quy chuẩn 14/10/2026).
              </div>

              {/* Thông tin Đại diện ký hợp đồng */}
              <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--contracts-on-surface)", display: "block", marginBottom: 10 }}>
                  Thông tin Khách thuê Đại diện
                </span>

                <div className="form-grid-2col">
                  <Field
                    label="Họ và tên khách thuê"
                    value={form.tenant.name}
                    onChange={tenantChange("name")}
                    placeholder="Nguyễn Văn A"
                    required
                  />
                  <Field
                    label="Số CCCD gắn chip (12 chữ số)"
                    value={form.tenant.citizenId}
                    onChange={tenantChange("citizenId")}
                    placeholder="001095012345"
                    maxLength={12}
                    required
                  />
                </div>

                <div className="form-grid-3col" style={{ marginTop: 10 }}>
                  <Field
                    label="Số điện thoại (Tùy chọn)"
                    value={form.tenant.phoneNumber}
                    onChange={tenantChange("phoneNumber")}
                    placeholder="0912345678"
                  />
                  <Field
                    label="Email (Tùy chọn)"
                    type="email"
                    value={form.tenant.email}
                    onChange={tenantChange("email")}
                    placeholder="khach@email.com"
                  />
                  <Field
                    label="Quê quán / Hộ khẩu (Tùy chọn)"
                    value={form.tenant.hometown}
                    onChange={tenantChange("hometown")}
                    placeholder="Hà Nội, Hải Phòng..."
                  />
                </div>
              </div>

              {/* Dịch vụ theo số lượng (PER_UNIT) */}
              {perUnitServices.length > 0 && (
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--contracts-on-surface)", display: "block", marginBottom: 4 }}>
                    Định mức Dịch vụ theo số lượng (PER_UNIT)
                  </span>
                  <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 10px 0" }}>
                    Nhập số lượng thực tế khách đăng ký sử dụng (Ví dụ: số xe máy gửi, số người dùng nước theo đầu người).
                  </p>

                  <div className="form-grid-2col">
                    {perUnitServices.map((s) => (
                      <div key={s.name}>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>
                          {s.name} ({money(s.unitPrice)}/đơn vị)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={serviceQuantities[s.name] ?? 1}
                          onChange={(e) => handleQuantityChange(s.name, e.target.value)}
                          className="contracts-search-input"
                          style={{ paddingLeft: 12 }}
                          required
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Danh sách thành viên ở cùng */}
              <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--contracts-on-surface)" }}>
                      Thành viên ở cùng ({form.roommates.length} người)
                    </span>
                    <span style={{ fontSize: 11.5, color: "#64748b", display: "block" }}>
                      Khai báo để phục vụ công tác đăng ký tạm trú với Công an khu vực
                    </span>
                  </div>
                  <button type="button" className="contracts-btn-outline" onClick={addRoommate}>
                    <Plus size={13} />
                    <span>+ Thêm người</span>
                  </button>
                </div>

                {form.roommates.map((r, i) => (
                  <div key={i} className="roommate-row">
                    <input
                      type="text"
                      className="contracts-search-input"
                      style={{ paddingLeft: 10, fontSize: 12 }}
                      placeholder="Họ và tên"
                      value={r.fullName}
                      onChange={(e) => updateRoommate(i, "fullName", e.target.value)}
                      required
                    />
                    <input
                      type="text"
                      className="contracts-search-input"
                      style={{ paddingLeft: 10, fontSize: 12 }}
                      placeholder="Số CCCD"
                      value={r.citizenId}
                      onChange={(e) => updateRoommate(i, "citizenId", e.target.value)}
                    />
                    <input
                      type="text"
                      className="contracts-search-input"
                      style={{ paddingLeft: 10, fontSize: 12 }}
                      placeholder="Số điện thoại"
                      value={r.phoneNumber}
                      onChange={(e) => updateRoommate(i, "phoneNumber", e.target.value)}
                    />
                    <button
                      type="button"
                      className="contracts-action-btn"
                      onClick={() => removeRoommate(i)}
                      title="Xóa người ở cùng"
                    >
                      <Trash2 size={13} color="#dc2626" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Ghi chú hợp đồng */}
              <Field
                label="Ghi chú & Thỏa thuận riêng"
                as="textarea"
                rows={2}
                value={form.notes}
                onChange={change("notes")}
                placeholder="Ví dụ: Giờ giấc ra vào tự do, phòng bàn giao 1 điều hòa, 1 nóng lạnh..."
              />

              {/* Footer Buttons Step 2 */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 12, borderTop: "1px solid #e2e8f0" }}>
                <Button variant="secondary" onClick={() => setStep(1)} disabled={busy}>
                  <ArrowLeft size={16} />
                  <span>Quay lại Bước 1</span>
                </Button>
                <div style={{ display: "flex", gap: 10 }}>
                  <Button variant="secondary" onClick={onClose} disabled={busy}>
                    Hủy bỏ
                  </Button>
                  <Button type="submit" busy={busy}>
                    <CheckCircle2 size={16} />
                    <span>Xác nhận Ký Hợp đồng</span>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </form>
      </Modal>

      {/* Credentials Modal (Bàn giao thông tin đăng nhập tự động cấp) */}
      {issuedCredentials && (
        <CredentialsModal
          credentials={issuedCredentials}
          tenantName={issuedCredentials.tenantName}
          roomNumber={issuedCredentials.roomNumber}
          onClose={() => {
            setIssuedCredentials(null);
            onSaved?.();
          }}
        />
      )}
    </>
  );
}
