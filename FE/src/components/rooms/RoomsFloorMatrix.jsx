import { Link } from "react-router-dom";
import {
  Layers,
  Brush,
  Wrench,
  Sparkles,
  Users,
  FilePlus2,
  CheckCircle2,
  FileText,
  Settings2,
  Trash2,
} from "lucide-react";
import { money, labels } from "../../utils/format";

export function RoomsFloorMatrix({
  roomsByFloor,
  branch,
  canEdit,
  isLandlord,
  onQuickStatusChange,
  onEditRoom,
  onDeleteRoom,
}) {
  return (
    <div className="rooms-matrix">
      {roomsByFloor.map(({ floor: f, rooms }) => {
        const floorRented = rooms.filter(
          (r) => r.status === "RENTED" || r.currentContractId,
        ).length;
        const floorEmpty = rooms.filter((r) => r.status === "EMPTY").length;
        const floorRate = rooms.length
          ? Math.round((floorRented / rooms.length) * 100)
          : 0;

        return (
          <section className="rooms-floor-section" key={f}>
            <div className="rooms-floor-header">
              <div className="rooms-floor-title">
                <Layers size={18} color="var(--room-primary-container)" />
                <h3>Tầng {f}</h3>
              </div>
              <div className="rooms-floor-meta">
                <span>
                  {rooms.length} phòng ({floorRented} đang thuê · {floorEmpty}{" "}
                  trống)
                </span>
                <span className="rooms-floor-occupancy-pill">
                  {floorRate}% lấp đầy
                </span>
              </div>
            </div>

            <div className="rooms-unit-grid">
              {rooms.map((room) => {
                const isRented =
                  room.status === "RENTED" || Boolean(room.currentContractId);

                return (
                  <article
                    key={room._id}
                    className={`unit-card status-${room.status.toLowerCase()}`}
                  >
                    <div className="unit-card-header">
                      <span className="unit-card-room-num">
                        {room.roomNumber}
                      </span>
                      <span className="unit-card-badge">
                        <span className="unit-card-badge-dot" />
                        {labels[room.status] || room.status}
                      </span>
                    </div>

                    <div className="unit-card-body">
                      {isRented ? (
                        <div className="unit-card-tenant">
                          <div className="unit-card-tenant-avatar">
                            {(room.currentTenantName || "U")
                              .slice(0, 1)
                              .toUpperCase()}
                          </div>
                          <span>{room.currentTenantName || "Đang thuê"}</span>
                        </div>
                      ) : room.status === "CLEANING" ? (
                        <div className="unit-card-tenant is-empty">
                          <Brush
                            size={14}
                            color="var(--status-cleaning-dot)"
                          />
                          <span>Cần dọn vệ sinh phòng</span>
                        </div>
                      ) : room.status === "MAINTENANCE" ? (
                        <div className="unit-card-tenant is-empty">
                          <Wrench size={14} color="var(--status-maint-dot)" />
                          <span>Đang bảo trì thiết bị</span>
                        </div>
                      ) : (
                        <div className="unit-card-tenant is-empty">
                          <Sparkles size={14} color="#0284c7" />
                          <span>Sẵn sàng đón khách mới</span>
                        </div>
                      )}

                      <div className="unit-card-meta">
                        <span className="unit-card-capacity">
                          <Users size={13} />
                          Tối đa {room.maxOccupants} người
                        </span>
                        <span>Tầng {room.floor}</span>
                      </div>

                      <div className="unit-card-price-row">
                        <span className="unit-card-price">
                          {money(room.basePrice)}
                        </span>
                        <span className="unit-card-price-sub">/ tháng</span>
                      </div>

                      {room.amenities?.length > 0 && (
                        <div
                          className="unit-card-amenities"
                          title={room.amenities.join(", ")}
                        >
                          {room.amenities.join(" · ")}
                        </div>
                      )}
                    </div>

                    <div className="unit-card-footer">
                      <div className="unit-card-primary-action">
                        {canEdit &&
                          room.status === "EMPTY" &&
                          branch.status === "ACTIVE" && (
                            <Link
                              className="unit-btn-quick primary"
                              to={`/contracts?create=1&branchId=${branch._id}&roomId=${room._id}`}
                            >
                              <FilePlus2 size={14} />
                              Lập hợp đồng
                            </Link>
                          )}

                        {canEdit && room.status === "CLEANING" && (
                          <button
                            type="button"
                            className="unit-btn-quick outline-teal"
                            onClick={() =>
                              onQuickStatusChange(
                                room,
                                "EMPTY",
                                "Dọn dẹp xong",
                              )
                            }
                          >
                            <CheckCircle2 size={14} />
                            Đã dọn xong
                          </button>
                        )}

                        {canEdit && room.status === "MAINTENANCE" && (
                          <button
                            type="button"
                            className="unit-btn-quick outline-amber"
                            onClick={() =>
                              onQuickStatusChange(
                                room,
                                "EMPTY",
                                "Bảo trì xong",
                              )
                            }
                          >
                            <CheckCircle2 size={14} />
                            Xong bảo trì
                          </button>
                        )}

                        {isRented && room.currentContractId && (
                          <Link
                            className="unit-btn-quick outline-teal"
                            to={`/contracts?contractId=${room.currentContractId._id || room.currentContractId}`}
                          >
                            <FileText size={14} />
                            Xem hợp đồng
                          </Link>
                        )}
                      </div>

                      {canEdit && (
                        <div className="unit-card-icon-actions">
                          <button
                            type="button"
                            className="unit-btn-icon"
                            aria-label={`Sửa phòng ${room.roomNumber}`}
                            title="Cấu hình & tiện nghi phòng"
                            onClick={() => onEditRoom(room)}
                          >
                            <Settings2 size={15} />
                          </button>
                          {isLandlord && (
                            <button
                              type="button"
                              className="unit-btn-icon danger-hover"
                              aria-label={`Xóa phòng ${room.roomNumber}`}
                              disabled={isRented}
                              title={
                                isRented
                                  ? "Không thể xóa phòng đang có hợp đồng thuê"
                                  : `Xóa phòng ${room.roomNumber}`
                              }
                              onClick={() => onDeleteRoom(room)}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

