import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { branchApi, errorMessage } from "../../services/api";
import {
  Button,
  Field,
  SelectField,
  Modal,
  FormError,
} from "../../components/ui";
import { useToast } from "../../context/ToastContext";
const initial = {
  name: "",
  totalFloors: 1,
  address: "",
  defaultElectricityPrice: 3500,
  waterBillingType: "METER",
  defaultWaterPrice: 30000,
  defaultServices: [],
  billingCycleDay: 1,
  paymentDueDays: 5,
  status: "ACTIVE",
};
export default function BranchForm({ branch, onClose, onSaved }) {
  const [form, setForm] = useState(
    branch
      ? {
          ...initial,
          ...branch,
          address: branch.address?.fullAddress || "",
          defaultServices: branch.defaultServices.map(
            ({ name, price, billingType }) => ({ name, price, billingType }),
          ),
        }
      : initial,
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const toast = useToast();
  const change = (key) => (e) =>
    setForm({
      ...form,
      [key]:
        e.target.type === "number" ? Number(e.target.value) : e.target.value,
    });
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const body = Object.fromEntries(
      Object.keys(initial).map((key) => [key, form[key]]),
    );
    body.address = { fullAddress: form.address };
    try {
      if (branch) await branchApi.update(branch._id, body);
      else await branchApi.create(body);
      toast(branch ? "Đã cập nhật cơ sở" : "Đã tạo cơ sở mới");
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={branch ? "Cấu hình cơ sở" : "Thêm cơ sở mới"}
      subtitle="Thiết lập thông tin tòa nhà và biểu giá dịch vụ."
      onClose={onClose}
      busy={busy}
      wide
    >
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          <div className="form-section">
            <h3>01. Thông tin cơ sở</h3>
            <div className="form-grid">
              <Field
                label="Tên cơ sở"
                required
                value={form.name}
                onChange={change("name")}
                placeholder="Ví dụ: Cơ sở Cầu Giấy"
              />
              <Field
                label="Số tầng"
                type="number"
                min="1"
                max="100"
                required
                value={form.totalFloors}
                onChange={change("totalFloors")}
              />
              <div className="span-2">
                <Field
                  label="Địa chỉ"
                  required
                  value={form.address}
                  onChange={change("address")}
                  placeholder="Số nhà, đường, phường, tỉnh / thành phố"
                />
              </div>
              {branch && (
                <SelectField
                  label="Trạng thái"
                  value={form.status}
                  onChange={change("status")}
                >
                  <option value="ACTIVE">Đang hoạt động</option>
                  <option value="INACTIVE">Ngừng hoạt động</option>
                </SelectField>
              )}
            </div>
          </div>
          <div className="form-section">
            <h3>02. Điện nước & kỳ thanh toán</h3>
            <div className="form-grid">
              <Field
                label="Giá điện / kWh (₫)"
                type="number"
                min="0"
                required
                value={form.defaultElectricityPrice}
                onChange={change("defaultElectricityPrice")}
              />
              <SelectField
                label="Cách tính nước"
                value={form.waterBillingType}
                onChange={change("waterBillingType")}
              >
                <option value="METER">Theo đồng hồ (m³)</option>
                <option value="PER_PERSON">Theo đầu người</option>
                <option value="FIXED">Khoán theo phòng</option>
              </SelectField>
              <Field
                label="Đơn giá nước (₫)"
                type="number"
                min="0"
                required
                value={form.defaultWaterPrice}
                onChange={change("defaultWaterPrice")}
              />
              <Field
                label="Ngày chốt hàng tháng"
                type="number"
                min="1"
                max="28"
                required
                value={form.billingCycleDay}
                onChange={change("billingCycleDay")}
              />
              <Field
                label="Hạn thanh toán (ngày)"
                type="number"
                min="1"
                max="90"
                required
                value={form.paymentDueDays}
                onChange={change("paymentDueDays")}
              />
            </div>
            <p className="hint">
              Biểu giá mới áp dụng cho các kỳ tiếp theo, không thay đổi hóa đơn
              đã lập.
            </p>
          </div>
          <div className="form-section">
            <div className="section-heading">
              <h3>03. Dịch vụ cố định</h3>
              <Button
                type="button"
                variant="text"
                onClick={() =>
                  setForm({
                    ...form,
                    defaultServices: [
                      ...form.defaultServices,
                      { name: "", price: 0, billingType: "PER_ROOM" },
                    ],
                  })
                }
              >
                <Plus size={16} />
                Thêm dịch vụ
              </Button>
            </div>
            {form.defaultServices.map((service, index) => (
              <div className="service-row" key={index}>
                <Field
                  label="Tên dịch vụ"
                  required
                  value={service.name}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      defaultServices: form.defaultServices.map((s, i) =>
                        i === index ? { ...s, name: e.target.value } : s,
                      ),
                    })
                  }
                />
                <Field
                  label="Giá (₫)"
                  type="number"
                  min="0"
                  required
                  value={service.price}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      defaultServices: form.defaultServices.map((s, i) =>
                        i === index
                          ? { ...s, price: Number(e.target.value) }
                          : s,
                      ),
                    })
                  }
                />
                <SelectField
                  label="Đơn vị"
                  value={service.billingType}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      defaultServices: form.defaultServices.map((s, i) =>
                        i === index ? { ...s, billingType: e.target.value } : s,
                      ),
                    })
                  }
                >
                  <option value="PER_ROOM">/ phòng</option>
                  <option value="PER_PERSON">/ người</option>
                  <option value="PER_UNIT">/ đơn vị</option>
                </SelectField>
                <button
                  className="icon-button danger-text"
                  type="button"
                  aria-label="Xóa dịch vụ"
                  onClick={() =>
                    setForm({
                      ...form,
                      defaultServices: form.defaultServices.filter(
                        (_, i) => i !== index,
                      ),
                    })
                  }
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
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
          <Button busy={busy}>Lưu cơ sở</Button>
        </footer>
      </form>
    </Modal>
  );
}
