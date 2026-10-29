import { Link } from "react-router-dom";
import {
  Building2,
  MapPin,
  ShieldCheck,
  ArrowRight,
  Settings2,
  Trash2,
} from "lucide-react";
import { Badge } from "../ui";
import { money } from "../../utils/format";

export function BranchTable({
  items,
  canEdit,
  getBranchManagers,
  onEdit,
  onDelete,
}) {
  return (
    <div className="table-wrap branch-table">
      <table>
        <thead>
          <tr>
            <th>Cơ sở / Địa chỉ</th>
            <th>Số tầng</th>
            <th>Số phòng</th>
            <th>Đang thuê</th>
            <th>Đơn giá dịch vụ</th>
            <th>Trạng thái</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {items.map((branch) => {
            const managers = getBranchManagers(branch);
            return (
              <tr key={branch._id}>
                <td data-label="Cơ sở">
                  <div className="branch-identity">
                    <div className="branch-icon">
                      <Building2 size={24} />
                    </div>
                    <div>
                      <Link
                        className="branch-name"
                        to={`/rooms?branchId=${branch._id}`}
                      >
                        {branch.name}
                      </Link>
                      <p className="address">
                        <MapPin size={14} />
                        {branch.address?.fullAddress || "Chưa có địa chỉ"}
                      </p>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "var(--branch-text-muted)",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          marginTop: "3px",
                        }}
                      >
                        <ShieldCheck
                          size={13}
                          style={{ color: "var(--branch-primary)" }}
                        />
                        <span>Quản lý: </span>
                        {managers.length > 0 ? (
                          <strong
                            style={{ color: "var(--branch-primary)" }}
                            title={managers
                              .map(
                                (m) =>
                                  `${m.name}${m.phoneNumber ? ` (SĐT: ${m.phoneNumber})` : ""}`,
                              )
                              .join(" · ")}
                          >
                            {managers[0].name}
                            {managers.length > 1 &&
                              ` (+${managers.length - 1})`}
                          </strong>
                        ) : (
                          <span style={{ fontStyle: "italic", opacity: 0.7 }}>
                            Chưa phân công
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                <td data-label="Số tầng">{branch.totalFloors}</td>
                <td data-label="Số phòng">
                  <strong>{branch.roomStats?.total || 0}</strong>
                </td>
                <td data-label="Đang thuê">
                  <span className="rented-count">
                    {branch.roomStats?.rented || 0}
                  </span>
                  <small>/{branch.roomStats?.total || 0} phòng</small>
                </td>
                <td data-label="Đơn giá dịch vụ">
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#64748b",
                      lineHeight: "1.4",
                    }}
                  >
                    <div>
                      Điện: {money(branch.defaultElectricityPrice ?? 3500)}/kWh
                    </div>
                    <div>
                      Nước: {money(branch.defaultWaterPrice ?? 30000)}/
                      {branch.waterBillingType === "METER" ? "m³" : "người"}
                    </div>
                  </div>
                </td>
                <td data-label="Trạng thái">
                  <Badge status={branch.status} />
                </td>
                <td data-label="Thao tác">
                  <div className="branch-row-actions">
                    <Link
                      className="button secondary compact"
                      to={`/rooms?branchId=${branch._id}`}
                    >
                      Xem phòng <ArrowRight size={15} />
                    </Link>
                    {canEdit && (
                      <>
                        <button
                          type="button"
                          className="icon-button"
                          title="Cấu hình cơ sở"
                          aria-label={`Cấu hình ${branch.name}`}
                          onClick={() => onEdit(branch)}
                        >
                          <Settings2 size={17} />
                        </button>
                        <button
                          type="button"
                          className="icon-button danger-text"
                          title="Xóa cơ sở"
                          aria-label={`Xóa ${branch.name}`}
                          onClick={() => onDelete(branch)}
                        >
                          <Trash2 size={17} />
                        </button>
                      </>
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

