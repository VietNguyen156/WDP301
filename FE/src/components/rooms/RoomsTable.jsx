import { Link } from "react-router-dom";
import { FilePlus2, Settings2, Trash2 } from "lucide-react";
import { Badge } from "../ui";
import { money } from "../../utils/format";

export function RoomsTable({
  items,
  branch,
  canEdit,
  isLandlord,
  onEditRoom,
  onDeleteRoom,
}) {
  return (
    <div className="rooms-table-wrap">
      <table className="rooms-table">
        <thead>
          <tr>
            <th>Số phòng</th>
            <th>Tầng</th>
            <th>Trạng thái</th>
            <th>Khách thuê hiện tại</th>
            <th>Sức chứa</th>
            <th>Giá thuê / tháng</th>
            <th>Tiện nghi</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {items.map((room) => {
            const isRented =
              room.status === "RENTED" || Boolean(room.currentContractId);
            return (
              <tr key={room._id}>
                <td>
                  <span className="rooms-table-room-num">
                    {room.roomNumber}
                  </span>
                </td>
                <td>Tầng {room.floor}</td>
                <td>
                  <Badge status={room.status} />
                </td>
                <td>
                  {room.currentTenantName ? (
                    <strong>{room.currentTenantName}</strong>
                  ) : (
                    <span className="muted">Trống</span>
                  )}
                </td>
                <td>{room.maxOccupants} người</td>
                <td>
                  <span className="rooms-table-price">
                    {money(room.basePrice)}
                  </span>
                </td>
                <td>
                  {room.amenities?.length ? (
                    <span className="muted" style={{ fontSize: "12px" }}>
                      {room.amenities.join(", ")}
                    </span>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    {isLandlord &&
                      room.status === "EMPTY" &&
                      branch.status === "ACTIVE" && (
                        <Link
                          className="text-link"
                          to={`/contracts?create=1&branchId=${branch._id}&roomId=${room._id}`}
                        >
                          <FilePlus2 size={15} /> Lập HĐ
                        </Link>
                      )}
                    {canEdit && (
                      <button
                        type="button"
                        className="unit-btn-icon"
                        onClick={() => onEditRoom(room)}
                        title="Sửa phòng"
                      >
                        <Settings2 size={14} />
                      </button>
                    )}
                    {isLandlord && (
                      <button
                        type="button"
                        className="unit-btn-icon danger-hover"
                        disabled={isRented}
                        onClick={() => onDeleteRoom(room)}
                        title="Xóa phòng"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

