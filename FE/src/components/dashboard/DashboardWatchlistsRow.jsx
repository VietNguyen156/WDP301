import { Link } from "react-router-dom";
import {
  Receipt,
  ArrowRight,
  CheckCircle2,
  Mail,
  Clock,
  ShieldCheck,
  Building2,
  RefreshCw,
} from "lucide-react";
import {
  formatCurrency,
  formatDate,
  formatBillingPeriod,
} from "../../utils/formatters";

export function DetailsPlaceholder() {
  return (
    <div
      className="stitch-dash-empty-box"
      style={{ padding: "32px 16px" }}
      aria-busy="true"
    >
      <RefreshCw size={22} className="spin" color="#94a3b8" />
      <p>Đang tải dữ liệu...</p>
    </div>
  );
}

export default function DashboardWatchlistsRow({
  userRole,
  financialMetrics,
  contractWatchlist,
  activeBranches,
  detailsLoading,
  onSendEmailReminder,
  sendingReminderId,
  reminderSettings,
  savingReminderSettings,
  onToggleAutoReminder,
}) {
  return (
    <div className="stitch-dash-grid-2">
      {/* Watchlist 1: Danh Sách Nợ Cần Thu Gấp & Nhắc nợ qua email */}
      <div className="stitch-dash-card">
        <div className="stitch-dash-card-header">
          <div
            style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}
          >
            <div className="stitch-badge-icon red" style={{ flex: "none" }}>
              <Receipt size={16} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h2 className="stitch-dash-card-title">
                Phòng Còn Nợ Tiền ({financialMetrics.debtRoomsCount})
              </h2>
              <p className="stitch-dash-card-sub">
                Danh sách hóa đơn còn nợ kèm chức năng gửi email nhắc nợ cho
                khách thuê
              </p>
              {reminderSettings && (
                <label
                  className="stitch-auto-remind"
                  title={`Lịch gửi: ${reminderSettings.schedule}`}
                >
                  <input
                    type="checkbox"
                    checked={reminderSettings.autoEmail}
                    disabled={savingReminderSettings}
                    onChange={(e) => onToggleAutoReminder(e.target.checked)}
                  />
                  <span>Tự động gửi email nhắc nợ</span>
                  {!reminderSettings.emailConfigured && (
                    <em> (máy chủ chưa cấu hình email)</em>
                  )}
                </label>
              )}
            </div>
          </div>
          <Link to="/invoices" className="stitch-dash-card-link">
            Xem tất cả <ArrowRight size={14} />
          </Link>
        </div>

        {financialMetrics.debtInvoices.length === 0 ? (
          <div
            className="stitch-dash-empty-box"
            style={{ padding: "32px 16px" }}
          >
            <CheckCircle2 size={36} color="#059669" />
            <p style={{ color: "#047857", fontWeight: 600 }}>
              Tuyệt vời! Toàn bộ khách thuê đã nộp tiền đầy đủ. Không có công nợ
              tồn đọng.
            </p>
          </div>
        ) : (
          <div
            className="stitch-table-wrapper"
            style={{ maxHeight: "320px", overflowY: "auto" }}
          >
            <table className="stitch-dash-table">
              <thead>
                <tr>
                  <th>Phòng &amp; Cơ sở</th>
                  <th>Kỳ thu</th>
                  <th>Còn nợ</th>
                  <th>Hạn nộp</th>
                  <th style={{ textAlign: "right" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {financialMetrics.debtInvoices.slice(0, 10).map((inv) => {
                  const rem =
                    inv.remainingAmount ??
                    Math.max(0, (inv.totalAmount || 0) - (inv.paidAmount || 0));
                  const roomNumber =
                    inv.room?.roomNumber ||
                    inv.roomId?.roomNumber ||
                    inv.roomNumber ||
                    "P.?";
                  const branchName =
                    inv.branch?.name ||
                    inv.branchId?.name ||
                    inv.branchName ||
                    "Cơ sở";
                  const isOverdue =
                    inv.overdueDays > 0 ||
                    (inv.dueDate && new Date(inv.dueDate) < new Date());
                  const overdueBadge =
                    inv.overdueDays > 0
                      ? `Quá hạn ${inv.overdueDays} ngày`
                      : formatDate(inv.dueDate);

                  return (
                    <tr key={inv.invoiceId || inv._id}>
                      <td>
                        <strong>{roomNumber}</strong>
                        <small
                          style={{
                            display: "block",
                            color: "#64748b",
                            fontSize: "11px",
                          }}
                        >
                          {branchName}{" "}
                          {inv.tenant?.name ? `· ${inv.tenant.name}` : ""}
                        </small>
                      </td>
                      <td>{formatBillingPeriod(inv.billingPeriod)}</td>
                      <td>
                        <strong style={{ color: "#dc2626" }}>
                          {formatCurrency(rem)}
                        </strong>
                      </td>
                      <td>
                        <span
                          className={`stitch-date-chip ${isOverdue ? "overdue" : ""}`}
                        >
                          {overdueBadge}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {(() => {
                          const id = inv.invoiceId || inv._id;
                          const noEmail = inv.tenant && !inv.tenant.email;
                          const sending = sendingReminderId === id;
                          const last = inv.lastReminder;
                          return (
                            <>
                              <button
                                type="button"
                                className="stitch-remind-btn"
                                onClick={() => onSendEmailReminder(inv)}
                                disabled={noEmail || sending}
                                title={
                                  noEmail
                                    ? "Khách thuê chưa có email, cập nhật trong hồ sơ khách thuê"
                                    : `Gửi email nhắc nợ kèm link thanh toán VietQR${inv.tenant?.email ? ` tới ${inv.tenant.email}` : ""}`
                                }
                              >
                                {sending ? (
                                  <RefreshCw size={13} className="spin" />
                                ) : (
                                  <Mail size={13} />
                                )}
                                <span>
                                  {noEmail ? "Chưa có email" : "Gửi email"}
                                </span>
                              </button>
                              {last && (
                                <small
                                  className={`stitch-remind-last ${last.status === "FAILED" ? "failed" : ""}`}
                                >
                                  {last.status === "FAILED"
                                    ? "Gửi lỗi"
                                    : last.auto
                                      ? "Tự nhắc"
                                      : "Đã nhắc"}{" "}
                                  {formatDate(last.sentAt)}
                                </small>
                              )}
                            </>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Watchlist 2: Hợp Đồng Sắp Hết Hạn (Landlord) HOẶC Tình Trạng Phòng Cơ Sở (Manager) */}
      <div className="stitch-dash-card">
        {userRole === "LANDLORD" ? (
          <>
            <div className="stitch-dash-card-header">
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <div className="stitch-badge-icon amber">
                  <Clock size={16} />
                </div>
                <div>
                  <h2 className="stitch-dash-card-title">
                    Hợp Đồng Sắp Hết Hạn (
                    {contractWatchlist.expiringSoon.length})
                  </h2>
                  <p className="stitch-dash-card-sub">
                    Các hợp đồng hết hạn trong 30 ngày cần gia hạn hoặc tìm
                    khách mới
                  </p>
                </div>
              </div>
              <Link to="/contracts" className="stitch-dash-card-link">
                Hợp đồng <ArrowRight size={14} />
              </Link>
            </div>

            {detailsLoading ? (
              <DetailsPlaceholder />
            ) : contractWatchlist.expiringSoon.length === 0 ? (
              <div
                className="stitch-dash-empty-box"
                style={{ padding: "32px 16px" }}
              >
                <ShieldCheck size={36} color="#0f766e" />
                <p style={{ color: "#005c55", fontWeight: 600 }}>
                  Không có hợp đồng nào sắp hết hạn trong 30 ngày tới. Vận hành
                  ổn định.
                </p>
              </div>
            ) : (
              <div
                className="stitch-table-wrapper"
                style={{ maxHeight: "320px", overflowY: "auto" }}
              >
                <table className="stitch-dash-table">
                  <thead>
                    <tr>
                      <th>Phòng &amp; Cơ sở</th>
                      <th>Khách thuê</th>
                      <th>Ngày kết thúc</th>
                      <th>Còn lại</th>
                      <th style={{ textAlign: "right" }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contractWatchlist.expiringSoon.slice(0, 6).map((c) => (
                      <tr key={c._id}>
                        <td>
                          <strong>
                            {c.roomId?.roomNumber || c.roomNumber || "P.?"}
                          </strong>
                          <small
                            style={{
                              display: "block",
                              color: "#64748b",
                              fontSize: "11px",
                            }}
                          >
                            {c.branchId?.name || "Cơ sở"}
                          </small>
                        </td>
                        <td>
                          <span style={{ fontWeight: 600 }}>
                            {c.tenantName || c.tenantId?.name || "-"}
                          </span>
                          <small
                            style={{
                              display: "block",
                              color: "#64748b",
                              fontSize: "11px",
                            }}
                          >
                            {c.tenantPhone || "-"}
                          </small>
                        </td>
                        <td>{formatDate(c.endDate)}</td>
                        <td>
                          <span className="stitch-date-chip amber">
                            Còn {c.diffDays} ngày
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <Link
                            to={`/contracts?search=${c.contractNumber || ""}`}
                            className="button secondary compact"
                            style={{ fontSize: "12px", padding: "4px 8px" }}
                          >
                            Xem HĐ
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="stitch-dash-card-header">
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <div className="stitch-badge-icon teal">
                  <Building2 size={16} />
                </div>
                <div>
                  <h2 className="stitch-dash-card-title">
                    Tình Trạng Phòng Cơ Sở ({activeBranches.length})
                  </h2>
                  <p className="stitch-dash-card-sub">
                    Theo dõi số lượng phòng đang thuê và phòng trống theo từng
                    cơ sở
                  </p>
                </div>
              </div>
              <Link to="/rooms" className="stitch-dash-card-link">
                Quản lý phòng <ArrowRight size={14} />
              </Link>
            </div>

            {activeBranches.length === 0 ? (
              <div
                className="stitch-dash-empty-box"
                style={{ padding: "32px 16px" }}
              >
                <Building2 size={36} color="#94a3b8" />
                <p>Bạn chưa được phân công cơ sở nào.</p>
              </div>
            ) : (
              <div
                className="stitch-table-wrapper"
                style={{ maxHeight: "320px", overflowY: "auto" }}
              >
                <table className="stitch-dash-table">
                  <thead>
                    <tr>
                      <th>Cơ sở</th>
                      <th>Tổng phòng</th>
                      <th>Đang thuê</th>
                      <th>Phòng trống</th>
                      <th style={{ textAlign: "right" }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeBranches.map((b) => {
                      const totalR = b.roomStats?.total || 0;
                      const rentedR = b.roomStats?.rented || 0;
                      const vacantR = Math.max(0, totalR - rentedR);
                      return (
                        <tr key={b._id}>
                          <td>
                            <strong>{b.name}</strong>
                            <small
                              style={{
                                display: "block",
                                color: "#64748b",
                                fontSize: "11px",
                              }}
                            >
                              {b.address?.city ||
                                b.address?.fullAddress ||
                                "Hà Nội"}
                            </small>
                          </td>
                          <td>
                            <strong>{totalR}</strong> phòng
                          </td>
                          <td>
                            <span style={{ color: "#047857", fontWeight: 700 }}>
                              {rentedR}
                            </span>
                            <small style={{ color: "#64748b" }}>
                              {" "}
                              (
                              {totalR > 0
                                ? Math.round((rentedR / totalR) * 100)
                                : 0}
                              %)
                            </small>
                          </td>
                          <td>
                            <span
                              style={{
                                color: vacantR > 0 ? "#d97706" : "#64748b",
                                fontWeight: 700,
                              }}
                            >
                              {vacantR}
                            </span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <Link
                              to={`/rooms?branchId=${b._id}`}
                              className="button secondary compact"
                              style={{ fontSize: "12px", padding: "4px 8px" }}
                            >
                              Xem phòng
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

