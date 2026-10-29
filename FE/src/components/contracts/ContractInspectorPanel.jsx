import {
  ArrowUpRight,
  Clock,
  AlertTriangle,
  Phone,
  FileText,
  Printer,
} from "lucide-react";
import { money, date } from "../../utils/format";

export default function ContractInspectorPanel({
  selectedContract,
  onOpenDetail,
  onPrintPdf,
}) {
  if (!selectedContract) return null;

  const isDepositPaid = selectedContract.depositStatus === "PAID";

  return (
    <aside className="contracts-inspector-panel">
      <div className="inspector-header">
        <div>
          <h3 className="inspector-title">Hồ sơ Hợp đồng Chi tiết</h3>
          <span className="inspector-subtitle">
            {selectedContract.contractCode} ·{" "}
            {selectedContract.roomId?.roomNumber || "Phòng"}
          </span>
        </div>
        <button
          type="button"
          className="contracts-action-btn"
          onClick={() => onOpenDetail(selectedContract._id)}
          title="Mở toàn màn hình"
        >
          <ArrowUpRight size={14} />
        </button>
      </div>

      <div className="inspector-body">
        {/* Expiry alert */}
        {selectedContract.displayStatus === "EXPIRING_SOON" && (
          <div className="inspector-alert-banner warning">
            <Clock size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong>Cảnh báo gia hạn hợp đồng:</strong>
              <br />
              Hợp đồng sắp hết hiệu lực vào ngày{" "}
              {date(selectedContract.endDate)}. Vui lòng liên hệ khách thuê để
              xác nhận gia hạn hoặc chuẩn bị thủ tục trả cọc.
            </div>
          </div>
        )}

        {selectedContract.displayStatus === "EXPIRED" && (
          <div className="inspector-alert-banner danger">
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong>Hợp đồng đã quá hạn thuê:</strong>
              <br />
              Thời hạn thuê đã kết thúc ({date(selectedContract.endDate)}). Vui
              lòng chốt số điện nước để thanh lý hoặc ký hợp đồng mới.
            </div>
          </div>
        )}

        {/* Section 1: Đại diện thuê */}
        <div className="inspector-section">
          <div className="inspector-section-title">
            <span>Đại diện pháp lý ký kết</span>
            <span style={{ fontSize: 10, color: "#059669", fontWeight: 700 }}>
              CCCD ĐÃ XÁC THỰC
            </span>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div
              className="tenant-avatar-chip"
              style={{ width: 40, height: 40, fontSize: 14 }}
            >
              {selectedContract.tenantId?.name?.slice(0, 2).toUpperCase() ||
                "KT"}
            </div>
            <div>
              <strong
                style={{
                  fontSize: 14,
                  color: "var(--contracts-on-surface)",
                }}
              >
                {selectedContract.tenantId?.name}
              </strong>
              <div
                style={{
                  fontSize: 12,
                  color: "#64748b",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Phone size={11} />
                {selectedContract.tenantId?.phoneNumber || "Chưa có SĐT"}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "#64748b",
                  fontFamily: "monospace",
                }}
              >
                CCCD: {selectedContract.tenantId?.citizenId || "—"}
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Tài chính & Tiền cọc (Bento boxes) */}
        <div className="inspector-section">
          <div className="inspector-section-title">
            <span>Tài chính & Tiền cọc đảm bảo</span>
          </div>
          <div className="inspector-bento-grid">
            <div
              className={`inspector-bento-box ${isDepositPaid ? "highlight" : "highlight-warning"}`}
            >
              <span className="inspector-bento-label">Tiền cọc giữ:</span>
              <span
                className="inspector-bento-value"
                style={{ color: isDepositPaid ? "#065f46" : "#dc2626" }}
              >
                {money(selectedContract.depositAmount)}
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: isDepositPaid ? "#059669" : "#dc2626",
                  fontWeight: 600,
                }}
              >
                {isDepositPaid ? "✓ Đã thu đủ" : "⚠ Chưa nhận cọc"}
              </span>
            </div>

            <div className="inspector-bento-box">
              <span className="inspector-bento-label">Giá thuê / tháng:</span>
              <span className="inspector-bento-value">
                {money(selectedContract.rentalPrice)}
              </span>
              <span style={{ fontSize: 10, color: "#64748b" }}>
                Thu ngày 05 hàng tháng
              </span>
            </div>
          </div>
        </div>

        {/* Section 3: Thời hạn thuê */}
        <div className="inspector-section">
          <div className="inspector-section-title">
            <span>Thời hạn & Chỉ số ban đầu</span>
          </div>
          <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>
            <div>
              Thời hạn: <strong>{date(selectedContract.startDate)}</strong> đến{" "}
              <strong>{date(selectedContract.endDate)}</strong>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 4,
                paddingTop: 4,
                borderTop: "1px dashed #e2e8f0",
              }}
            >
              <span>
                Điện ban đầu:{" "}
                <strong>{selectedContract.initialElectricIndex} kWh</strong>
              </span>
              <span>
                Nước ban đầu:{" "}
                <strong>{selectedContract.initialWaterIndex} m³</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Section 4: Người ở cùng */}
        {selectedContract.roommates &&
          selectedContract.roommates.length > 0 && (
            <div className="inspector-section">
              <div className="inspector-section-title">
                <span>
                  Thành viên ở cùng ({selectedContract.roommates.length} người)
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  fontSize: 12,
                }}
              >
                {selectedContract.roommates.map((r, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "4px 8px",
                      background: "#ffffff",
                      borderRadius: 6,
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <span>
                      <strong>{r.fullName}</strong>
                    </span>
                    <span style={{ color: "#64748b" }}>
                      {r.phoneNumber || r.citizenId || "Đã khai báo"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
      </div>

      {/* Inspector Footer Actions */}
      <div className="inspector-footer">
        <div className="inspector-footer-grid">
          <button
            type="button"
            className="contracts-btn-primary"
            onClick={() => onOpenDetail(selectedContract._id)}
            style={{ justifyContent: "center" }}
          >
            <FileText size={15} />
            <span>Chi tiết hợp đồng</span>
          </button>
          <button
            type="button"
            className="contracts-btn-outline"
            onClick={() => onPrintPdf(selectedContract.contractCode)}
            style={{ justifyContent: "center" }}
          >
            <Printer size={15} />
            <span>In bản PDF</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

