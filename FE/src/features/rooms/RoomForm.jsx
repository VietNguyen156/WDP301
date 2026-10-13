import { useState } from "react";
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
export default function RoomForm({
  branch,
  room,
  bulk = false,
  onSaved,
  onClose,
}) {
  const manager = useAuth().user.role === "PROPERTY_MANAGER",
    toast = useToast();
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
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const change = (key) => (e) =>
    setForm({
      ...form,
      [key]:
        e.target.type === "number" ? Number(e.target.value) : e.target.value,
    });
  const count = bulk
    ? Math.max(0, form.toFloor - form.fromFloor + 1) *
      Math.max(0, form.toRoomNumber - form.fromRoomNumber + 1)
    : 0;
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = bulk
        ? { ...form }
        : manager
          ? { status: form.status }
          : {
              ...form,
              amenities: form.amenities
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean),
            };
      if (room?.status === "RENTED") delete body.status;
      if (bulk) await roomApi.bulk(branch._id, body);
      else if (room) await roomApi.update(room._id, body);
      else await roomApi.create(branch._id, body);
      toast(
        bulk
          ? `Đã tạo ${count} phòng`
          : room
            ? "Đã cập nhật phòng"
            : "Đã thêm phòng",
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
          ? "Sinh phòng hàng loạt"
          : room
            ? `Cập nhật phòng ${room.roomNumber}`
            : "Thêm phòng mới"
      }
      subtitle={branch.name}
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          <div className="form-section form-grid">
            {bulk ? (
              <>
                <Field
                  label="Từ tầng"
                  type="number"
                  min="1"
                  max={branch.totalFloors}
                  required
                  value={form.fromFloor}
                  onChange={change("fromFloor")}
                />
                <Field
                  label="Đến tầng"
                  type="number"
                  min={form.fromFloor}
                  max={branch.totalFloors}
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
                  hint="Ví dụ P. → P.101, P.102…"
                />
              </>
            ) : (
              !manager && (
                <>
                  <Field
                    label="Số / tên phòng"
                    required
                    value={form.roomNumber}
                    onChange={change("roomNumber")}
                    placeholder="P.101"
                  />
                  <Field
                    label="Tầng"
                    type="number"
                    min="1"
                    max={branch.totalFloors}
                    required
                    value={form.floor}
                    onChange={change("floor")}
                  />
                </>
              )
            )}
            {!manager && (
              <>
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
                />
              </>
            )}
            {!bulk && (
              <>
                {room?.status !== "RENTED" && (
                  <SelectField
                    label="Trạng thái vận hành"
                    value={form.status}
                    onChange={change("status")}
                  >
                    <option value="EMPTY">Phòng trống</option>
                    <option value="CLEANING">Cần dọn dẹp</option>
                    <option value="MAINTENANCE">Đang bảo trì</option>
                    {!manager && (
                      <option value="INACTIVE">Ngừng hoạt động</option>
                    )}
                  </SelectField>
                )}
                {!manager && (
                  <>
                    <Field
                      label="Tiện nghi"
                      value={form.amenities}
                      onChange={change("amenities")}
                      hint="Phân cách bằng dấu phẩy"
                    />
                    <div className="span-2">
                      <Field label="Ghi chú">
                        <textarea
                          value={form.notes}
                          onChange={change("notes")}
                          rows={3}
                        />
                      </Field>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
          {bulk && (
            <div className="info-panel">
              <strong>Dự kiến tạo {count} phòng</strong>
              <p>
                Mỗi tầng dùng cùng dải số thứ tự. Ví dụ tầng 1–4, số 101–105 sẽ
                tạo P.101–P.105, …, P.401–P.405. Tối đa 500 phòng/lần.
              </p>
            </div>
          )}
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
          <Button busy={busy}>{bulk ? "Tạo các phòng" : "Lưu phòng"}</Button>
        </footer>
      </form>
    </Modal>
  );
}
