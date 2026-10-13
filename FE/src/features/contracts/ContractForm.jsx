import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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
import { money, today } from "../../utils/format";
export default function ContractForm({
  branchId = "",
  roomId = "",
  onClose,
  onSaved,
}) {
  const toast = useToast();
  const branches = useResource(branchApi.options);
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
    () =>
      form.branchId ? roomApi.available(form.branchId) : Promise.resolve([]),
    [form.branchId],
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const initialized = useRef(false);
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
  const change = (key) => (e) =>
    setForm({
      ...form,
      [key]:
        e.target.type === "number" ? Number(e.target.value) : e.target.value,
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
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await contractApi.create(form);
      toast("Đã tạo hợp đồng và chuyển phòng sang đang thuê");
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  const selectedRoom = rooms.data?.find((r) => r._id === form.roomId);
  return (
    <Modal
      title="Tạo hợp đồng thuê phòng"
      subtitle="Thông tin khách thuê, giá thuê và chỉ số bàn giao."
      onClose={onClose}
      busy={busy}
      wide
    >
      {branches.loading ? (
        <LoadingState />
      ) : branches.error ? (
        <ErrorState message={branches.error} retry={branches.reload} />
      ) : (
        <form onSubmit={submit}>
          <fieldset disabled={busy}>
            <div className="form-section">
              <h3>01. Chọn phòng</h3>
              <div className="form-grid">
                <SelectField
                  label="Cơ sở"
                  required
                  value={form.branchId}
                  onChange={(e) =>
                    setForm({ ...form, branchId: e.target.value, roomId: "" })
                  }
                >
                  <option value="">Chọn cơ sở</option>
                  {branches.data
                    .filter((b) => b.status === "ACTIVE")
                    .map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.name}
                      </option>
                    ))}
                </SelectField>
                <SelectField
                  label="Phòng trống"
                  required
                  value={form.roomId}
                  disabled={!form.branchId || rooms.loading}
                  onChange={(e) => chooseRoom(e.target.value)}
                >
                  <option value="">
                    {rooms.loading ? "Đang tải phòng…" : "Chọn phòng"}
                  </option>
                  {rooms.data?.map((r) => (
                    <option key={r._id} value={r._id}>
                      {r.roomNumber} · {money(r.basePrice)}
                    </option>
                  ))}
                </SelectField>
              </div>
              {rooms.error && (
                <ErrorState message={rooms.error} retry={rooms.reload} />
              )}
              {selectedRoom && (
                <div className="hint">
                  Sức chứa: {selectedRoom.maxOccupants} người · Chỉ số hiện tại:
                  điện {selectedRoom.currentElectricIndex}, nước{" "}
                  {selectedRoom.currentWaterIndex}.{" "}
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => chooseRoom(selectedRoom._id)}
                  >
                    Dùng giá và chỉ số của phòng
                  </button>
                </div>
              )}
              {form.branchId &&
                !rooms.loading &&
                !rooms.error &&
                rooms.data?.length === 0 && (
                  <p className="form-error">
                    Cơ sở chưa có phòng trống. Hãy thêm phòng hoặc hoàn tất dọn
                    dẹp.
                  </p>
                )}
            </div>
            <div className="form-section">
              <h3>02. Người đại diện thuê phòng</h3>
              <div className="form-grid">
                <Field
                  label="Họ và tên"
                  required
                  value={form.tenant.name}
                  onChange={tenantChange("name")}
                />
                <Field
                  label="Số điện thoại"
                  type="tel"
                  required
                  value={form.tenant.phoneNumber}
                  onChange={tenantChange("phoneNumber")}
                />
                <Field
                  label="Email"
                  type="email"
                  required
                  value={form.tenant.email}
                  onChange={tenantChange("email")}
                />
                <Field
                  label="CCCD / CMND"
                  required
                  value={form.tenant.citizenId}
                  onChange={tenantChange("citizenId")}
                />
                <div className="span-2">
                  <Field
                    label="Quê quán"
                    value={form.tenant.hometown}
                    onChange={tenantChange("hometown")}
                  />
                </div>
              </div>
              <p className="hint">
                Khách đã có tài khoản sẽ được liên kết theo email, số điện thoại
                và CCCD.
              </p>
            </div>
            <div className="form-section">
              <h3>03. Điều khoản & bàn giao</h3>
              <div className="form-grid">
                <Field
                  label="Ngày bắt đầu"
                  type="date"
                  required
                  value={form.startDate}
                  onChange={change("startDate")}
                />
                <Field
                  label="Ngày kết thúc"
                  type="date"
                  min={form.startDate}
                  required
                  value={form.endDate}
                  onChange={change("endDate")}
                />
                <Field
                  label="Tiền thuê (₫/tháng)"
                  type="number"
                  min="0"
                  required
                  value={form.rentalPrice}
                  onChange={change("rentalPrice")}
                />
                <Field
                  label="Tiền cọc (₫)"
                  type="number"
                  min="0"
                  required
                  value={form.depositAmount}
                  onChange={change("depositAmount")}
                />
                <Field
                  label="Chỉ số điện bàn giao"
                  type="number"
                  min={selectedRoom?.currentElectricIndex || 0}
                  required
                  value={form.initialElectricIndex}
                  onChange={change("initialElectricIndex")}
                />
                <Field
                  label="Chỉ số nước bàn giao"
                  type="number"
                  min={selectedRoom?.currentWaterIndex || 0}
                  required
                  value={form.initialWaterIndex}
                  onChange={change("initialWaterIndex")}
                />
                <SelectField
                  label="Tình trạng nhận cọc"
                  value={form.depositStatus}
                  onChange={change("depositStatus")}
                >
                  <option value="UNPAID">Chưa nhận cọc</option>
                  <option value="PAID">Đã nhận cọc</option>
                </SelectField>
              </div>
            </div>
            <div className="form-section">
              <div className="section-heading">
                <h3>04. Người ở cùng ({form.roommates.length})</h3>
                <Button
                  type="button"
                  variant="text"
                  onClick={() =>
                    setForm({
                      ...form,
                      roommates: [
                        ...form.roommates,
                        { fullName: "", citizenId: "", phoneNumber: "" },
                      ],
                    })
                  }
                >
                  <Plus size={16} />
                  Thêm người
                </Button>
              </div>
              {form.roommates.map((r, index) => (
                <div className="service-row" key={index}>
                  {[
                    ["fullName", "Họ tên"],
                    ["citizenId", "CCCD"],
                    ["phoneNumber", "Số điện thoại"],
                  ].map(([key, label]) => (
                    <Field
                      key={key}
                      label={label}
                      required={key === "fullName"}
                      value={r[key]}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          roommates: form.roommates.map((person, i) =>
                            i === index
                              ? { ...person, [key]: e.target.value }
                              : person,
                          ),
                        })
                      }
                    />
                  ))}
                  <button
                    type="button"
                    className="icon-button danger-text"
                    aria-label="Xóa người ở cùng"
                    onClick={() =>
                      setForm({
                        ...form,
                        roommates: form.roommates.filter((_, i) => i !== index),
                      })
                    }
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              ))}
              <Field label="Ghi chú hợp đồng">
                <textarea
                  value={form.notes}
                  onChange={change("notes")}
                  rows={2}
                />
              </Field>
            </div>
          </fieldset>
          <FormError error={error} />
          <footer className="modal-footer">
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={onClose}
            >
              Hủy
            </Button>
            <Button busy={busy} disabled={rooms.loading || !!rooms.error}>
              Tạo hợp đồng
            </Button>
          </footer>
        </form>
      )}
    </Modal>
  );
}
