import { Sofa } from "lucide-react";
import { money } from "../../utils/format";
import {
  FURNISHING_TYPE_LABELS,
  effectiveFurnishings,
  furnishingsTotal,
} from "../../utils/furnishings";

// Contract detail: furniture handed over with the room and the agreed unit prices.
// New contracts carry their own copy (frozen at signing); older ones fall back to the room's
// current list, flagged as not part of the signed contract.
export function ContractFurnishings({ contract }) {
  const signed = Array.isArray(contract.furnishings) || Boolean(contract.furnishingType);
  const { furnishingType, furnishings } = signed
    ? { furnishingType: contract.furnishingType, furnishings: contract.furnishings || [] }
    : effectiveFurnishings(contract.roomId, contract.branchId);

  return (
    <div className="contract-furnishings">
      <div className="contract-furnishings-head">
        <span className="contract-furnishings-title">
          <Sofa size={15} />
          Tài sản &amp; vật dụng bàn giao kèm phòng
        </span>
        <span className={`contract-furnishings-type is-${(furnishingType || "UNFURNISHED").toLowerCase()}`}>
          {FURNISHING_TYPE_LABELS[furnishingType] || FURNISHING_TYPE_LABELS.UNFURNISHED}
        </span>
      </div>

      {!signed && (
        <p className="contract-furnishings-note">
          Hợp đồng này lập trước khi có danh mục vật dụng, nên danh mục chưa được chốt trong hợp đồng. Bảng
          dưới là danh mục hiện tại của phòng để tham khảo.
        </p>
      )}

      {furnishings.length === 0 ? (
        <p className="contract-furnishings-note">
          Phòng bàn giao không kèm vật dụng. Bên B tự trang bị đồ dùng cá nhân.
        </p>
      ) : (
        <div className="furnishings-table-wrap">
          <table className="furnishings-table" style={{ minWidth: 560 }}>
            <thead>
              <tr>
                <th style={{ width: 40 }}>STT</th>
                <th>Tên vật dụng</th>
                <th style={{ width: 56 }}>SL</th>
                <th style={{ textAlign: "right" }}>Đơn giá đền bù</th>
                <th style={{ textAlign: "right" }}>Thành tiền</th>
                <th>Tình trạng khi giao</th>
              </tr>
            </thead>
            <tbody>
              {furnishings.map((item, index) => (
                <tr key={`${item.name}-${index}`}>
                  <td>{index + 1}</td>
                  <td>{item.name}</td>
                  <td>{item.quantity}</td>
                  <td className="furnishings-amount">{money(item.price)}</td>
                  <td className="furnishings-amount">{money(item.price * item.quantity)}</td>
                  <td>{item.note || "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>Tổng giá trị tài sản bàn giao</td>
                <td className="furnishings-amount">{money(furnishingsTotal(furnishings))}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {furnishings.length > 0 && (
        <p className="contract-furnishings-note">
          Bên B làm mất hoặc hư hỏng vật dụng do lỗi của mình thì bồi thường theo đơn giá trên (hoặc chi phí sửa
          chữa thực tế nếu thấp hơn). Hao mòn tự nhiên không phải bồi thường.
        </p>
      )}
    </div>
  );
}
