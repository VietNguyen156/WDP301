import { Plus, Phone, ArrowUpRight } from "lucide-react";
import {
  LoadingState,
  ErrorState,
  EmptyState,
  Pagination,
} from "../ui";
import { money, date } from "../../utils/format";
import { getContractProgress } from "../../hooks/useContractsPage";

export default function ContractsTable({
  resource,
  items,
  landlord,
  selectedContract,
  onSelectContract,
  onOpenDetail,
  onOpenCreate,
  onPageChange,
}) {
  return (
    <div className="contracts-table-card">
      {resource.loading && !items.length ? (
        <LoadingState />
      ) : resource.error && !items.length ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : !items.length ? (
        <EmptyState
          title="Không tìm thấy hợp đồng nào"
          description="Thử thay đổi bộ lọc hoặc thêm hợp đồng mới cho phòng trống."
          action={
            landlord && (
              <button
                type="button"
                className="contracts-btn-primary"
                onClick={onOpenCreate}
              >
                <Plus size={16} />
                <span>Lập hợp đồng ngay</span>
              </button>
            )
          }
        />
      ) : (
        <>
          <div className="contracts-table-wrap">
            <table className="contracts-table">
              <thead>
                <tr>
                  <th>Mã HĐ</th>
                  <th>Phòng & Cơ sở</th>
                  <th>Khách đại diện</th>
                  <th>Thời hạn & Tiến độ</th>
                  <th>Giá thuê & Cọc</th>
                  <th>Trạng thái HĐ</th>
                  <th style={{ textAlign: "right" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => {
                  const isSelected = selectedContract?._id === c._id;
                  const { percent, daysLeft } = getContractProgress(
                    c.startDate,
                    c.endDate,
                  );
                  const isExpiring = c.displayStatus === "EXPIRING_SOON";
                  const isExpired = c.displayStatus === "EXPIRED";

                  return (
                    <tr
                      key={c._id}
                      className={isSelected ? "is-selected" : ""}
                      onClick={() => onSelectContract(c._id)}
                    >
                      {/* Mã HĐ */}
                      <td>
                        <span
                          style={{
                            fontFamily: "monospace",
                            fontWeight: 700,
                            color: "var(--contracts-primary)",
                            fontSize: 13,
                          }}
                        >
                          {c.contractCode}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            color: "#64748b",
                            display: "block",
                          }}
                        >
                          Ký: {date(c.createdAt)}
                        </span>
                      </td>

                      {/* Phòng & Cơ sở */}
                      <td>
                        <div className="room-cell">
                          <span
                            className="room-dot"
                            style={{
                              background:
                                c.displayStatus === "ACTIVE"
                                  ? "#10b981"
                                  : isExpiring
                                    ? "#f59e0b"
                                    : isExpired
                                      ? "#ef4444"
                                      : "#94a3b8",
                            }}
                          />
                          <div>
                            <span className="room-number-text">
                              {c.roomId?.roomNumber || "Phòng"}
                            </span>
                            <span className="room-subtext">
                              {c.branchId?.name || "Cơ sở"}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Khách đại diện */}
                      <td>
                        <div className="tenant-cell">
                          <div className="tenant-avatar-chip">
                            {c.tenantId?.name?.slice(0, 2).toUpperCase() ||
                              "KT"}
                          </div>
                          <div>
                            <div className="tenant-name-text">
                              {c.tenantId?.name || "Khách thuê"}
                            </div>
                            <div className="tenant-contact-text">
                              <Phone size={10} color="#64748b" />
                              <span>
                                {c.tenantId?.phoneNumber ||
                                  c.tenantId?.citizenId ||
                                  "—"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Thời hạn & Tiến độ */}
                      <td>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 500,
                            color: "var(--contracts-on-surface)",
                          }}
                        >
                          {date(c.startDate)} – {date(c.endDate)}
                        </div>
                        <div className="duration-bar-wrap">
                          <div
                            className={`duration-bar-fill ${
                              isExpiring
                                ? "warning"
                                : isExpired
                                  ? "danger"
                                  : ""
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: isExpiring || isExpired ? 600 : 400,
                            color: isExpired
                              ? "#dc2626"
                              : isExpiring
                                ? "#b45309"
                                : "#64748b",
                          }}
                        >
                          {isExpired
                            ? "Đã hết hạn"
                            : isExpiring
                              ? `Còn ${daysLeft} ngày hết hạn`
                              : `Hiệu lực (${daysLeft} ngày)`}
                        </span>
                      </td>

                      {/* Giá thuê & Cọc */}
                      <td>
                        <div className="price-text">
                          {money(c.rentalPrice)}
                        </div>
                        <div className="deposit-text">
                          Cọc: <strong>{money(c.depositAmount)}</strong>
                        </div>
                      </td>

                      {/* Trạng thái HĐ (Dual-coding) */}
                      <td>
                        {c.displayStatus === "ACTIVE" ? (
                          <span className="status-pill-dual active">
                            <span className="dot" /> Hiệu lực
                          </span>
                        ) : c.displayStatus === "EXPIRING_SOON" ? (
                          <span className="status-pill-dual expiring">
                            <span className="dot" /> Sắp hết hạn
                          </span>
                        ) : c.displayStatus === "EXPIRED" ? (
                          <span className="status-pill-dual expired">
                            <span className="dot" /> Quá hạn
                          </span>
                        ) : (
                          <span className="status-pill-dual terminated">
                            <span className="dot" /> Đã thanh lý
                          </span>
                        )}
                      </td>

                      {/* Thao tác */}
                      <td
                        style={{ textAlign: "right" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div style={{ display: "inline-flex", gap: 6 }}>
                          <button
                            type="button"
                            className="contracts-action-btn"
                            title="Mở chi tiết & quyết toán"
                            onClick={() => onOpenDetail(c._id)}
                          >
                            <ArrowUpRight size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div
            style={{
              padding: "10px 16px",
              borderTop: "1px solid var(--contracts-border-subtle)",
            }}
          >
            <Pagination {...resource.data} onChange={onPageChange} />
          </div>
        </>
      )}
    </div>
  );
}

