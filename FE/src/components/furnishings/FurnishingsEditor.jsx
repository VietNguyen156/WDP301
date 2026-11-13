import { Plus, Trash2 } from "lucide-react";
import { money } from "../../utils/format";
import { furnishingsTotal } from "../../utils/furnishings";

// Common items with a typical compensation price, to fill the list quickly.
const PRESETS = [
  { name: "Điều hòa", price: 7000000 },
  { name: "Bình nóng lạnh", price: 2500000 },
  { name: "Tủ lạnh", price: 4000000 },
  { name: "Máy giặt", price: 5000000 },
  { name: "Giường", price: 2000000 },
  { name: "Đệm", price: 1500000 },
  { name: "Tủ quần áo", price: 1500000 },
  { name: "Bàn ghế", price: 800000 },
];

// Editable list of furniture handed over with a room: name, quantity, unit price, note.
// `items` is controlled by the parent; every change calls onChange with the new list.
export function FurnishingsEditor({ items, onChange, disabled = false }) {
  const update = (index, key, value) =>
    onChange(items.map((item, i) => (i === index ? { ...item, [key]: value } : item)));

  function addPreset(preset) {
    if (items.some((item) => item.name.trim().toLowerCase() === preset.name.toLowerCase())) return;
    onChange([...items, { name: preset.name, quantity: 1, price: preset.price, note: "" }]);
  }

  return (
    <div className="furnishings-editor">
      <div className="furnishings-presets">
        <span>Thêm nhanh:</span>
        {PRESETS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            className="stitch-service-chip"
            disabled={disabled}
            onClick={() => addPreset(preset)}
          >
            <Plus size={13} />
            {preset.name}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="furnishings-empty">
          Chưa có vật dụng nào. Bấm &quot;Thêm vật dụng&quot; hoặc chọn gợi ý bên trên.
        </div>
      ) : (
        <div className="furnishings-table-wrap">
          <table className="furnishings-table">
            <thead>
              <tr>
                <th>Tên vật dụng</th>
                <th style={{ width: 80 }}>SL</th>
                <th style={{ width: 150 }}>Đơn giá đền bù (₫)</th>
                <th>Tình trạng / ghi chú</th>
                <th style={{ width: 120, textAlign: "right" }}>Thành tiền</th>
                <th style={{ width: 40 }} aria-label="Xóa" />
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index}>
                  <td>
                    <input
                      required
                      value={item.name}
                      placeholder="Ví dụ: Điều hòa Daikin 9000BTU"
                      disabled={disabled}
                      aria-label="Tên vật dụng"
                      onChange={(e) => update(index, "name", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      required
                      type="number"
                      min="1"
                      value={item.quantity}
                      disabled={disabled}
                      aria-label="Số lượng"
                      onChange={(e) => update(index, "quantity", e.target.value === "" ? "" : Number(e.target.value))}
                    />
                  </td>
                  <td>
                    <input
                      required
                      type="number"
                      min="0"
                      step="1000"
                      value={item.price}
                      disabled={disabled}
                      aria-label="Đơn giá đền bù"
                      onChange={(e) => update(index, "price", e.target.value === "" ? "" : Number(e.target.value))}
                    />
                  </td>
                  <td>
                    <input
                      value={item.note || ""}
                      placeholder="Mới 100%, trầy nhẹ..."
                      disabled={disabled}
                      aria-label="Tình trạng"
                      onChange={(e) => update(index, "note", e.target.value)}
                    />
                  </td>
                  <td className="furnishings-amount">
                    {money((Number(item.price) || 0) * (Number(item.quantity) || 0))}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="icon-button"
                      title="Xóa vật dụng"
                      aria-label="Xóa vật dụng"
                      disabled={disabled}
                      onClick={() => onChange(items.filter((_, i) => i !== index))}
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>Tổng giá trị tài sản bàn giao</td>
                <td className="furnishings-amount">{money(furnishingsTotal(items))}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <button
        type="button"
        className="furnishings-add"
        disabled={disabled}
        onClick={() => onChange([...items, { name: "", quantity: 1, price: 0, note: "" }])}
      >
        <Plus size={15} />
        Thêm vật dụng
      </button>
    </div>
  );
}
