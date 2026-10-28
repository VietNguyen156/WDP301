import {
  Receipt,
  FileText,
  DoorOpen,
  Scale,
  Zap,
  AlertTriangle,
} from "lucide-react";

export default function DashboardShortcuts({ userRole, navigate }) {
  return (
    <section className="stitch-dash-shortcuts">
      <h3 className="stitch-shortcuts-heading">Phím Tắt Nghiệp Vụ Vận Hành</h3>
      <div className="stitch-shortcuts-grid">
        {userRole === "LANDLORD" ? (
          <>
            <div
              className="stitch-shortcut-tile"
              onClick={() => navigate("/invoices")}
            >
              <div className="shortcut-icon teal">
                <Receipt size={20} />
              </div>
              <div>
                <strong>Sổ Hóa đơn &amp; Báo cáo</strong>
                <p>Theo dõi hóa đơn phòng và đối soát thanh toán</p>
              </div>
            </div>

            <div
              className="stitch-shortcut-tile"
              onClick={() => navigate("/contracts?create=1")}
            >
              <div className="shortcut-icon indigo">
                <FileText size={20} />
              </div>
              <div>
                <strong>Ký hợp đồng khách mới</strong>
                <p>Cấp tài khoản CCCD và ghi nhận cọc</p>
              </div>
            </div>

            <div
              className="stitch-shortcut-tile"
              onClick={() => navigate("/rooms")}
            >
              <div className="shortcut-icon amber">
                <DoorOpen size={20} />
              </div>
              <div>
                <strong>Sơ đồ &amp; Trạng thái phòng</strong>
                <p>Quản lý phòng trống, vệ sinh và sửa chữa</p>
              </div>
            </div>

            <div
              className="stitch-shortcut-tile"
              onClick={() => navigate("/unmatched")}
            >
              <div className="shortcut-icon red">
                <Scale size={20} />
              </div>
              <div>
                <strong>Đối soát SePay sai cú pháp</strong>
                <p>Xử lý giao dịch nhận tiền chưa khớp</p>
              </div>
            </div>
          </>
        ) : (
          <>
            <div
              className="stitch-shortcut-tile"
              onClick={() => navigate("/rooms")}
            >
              <div className="shortcut-icon amber">
                <DoorOpen size={20} />
              </div>
              <div>
                <strong>Sơ đồ &amp; Trạng thái phòng</strong>
                <p>Quản lý phòng trống, kiểm tra dọn vệ sinh</p>
              </div>
            </div>

            <div
              className="stitch-shortcut-tile"
              onClick={() => navigate("/utility-readings")}
            >
              <div className="shortcut-icon teal">
                <Zap size={20} />
              </div>
              <div>
                <strong>Chốt số điện nước</strong>
                <p>Cập nhật số công tơ điện nước cơ sở</p>
              </div>
            </div>

            <div
              className="stitch-shortcut-tile"
              onClick={() => navigate("/incidents")}
            >
              <div className="shortcut-icon red">
                <AlertTriangle size={20} />
              </div>
              <div>
                <strong>Sự cố &amp; Yêu cầu sửa chữa</strong>
                <p>Xử lý bảo trì thiết bị và phản ánh cư dân</p>
              </div>
            </div>

            <div
              className="stitch-shortcut-tile"
              onClick={() => navigate("/invoices")}
            >
              <div className="shortcut-icon indigo">
                <Receipt size={20} />
              </div>
              <div>
                <strong>Hóa đơn &amp; Báo cáo thu tiền</strong>
                <p>Rà soát hóa đơn phòng và nộp tiền mặt</p>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

