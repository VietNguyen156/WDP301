1. Utility Reading — chốt số điện, nước
Mục tiêu: Mỗi kỳ, người quản lý ghi chỉ số công tơ cho phòng đang thuê để hệ thống tính lượng sử dụng và chuẩn bị hóa đơn.

Luồng nghiệp vụ:

Chủ trọ hoặc Quản lý cơ sở chọn cơ sở và kỳ ghi số. Quản lý chỉ thấy các cơ sở được giao.
Hệ thống hiển thị danh sách phòng cần ghi. Thường là phòng đang thuê; phòng có bản ghi trong kỳ cũng được hiển thị để xem hoặc cập nhật.
Người quản lý nhập chỉ số điện mới, chỉ số nước mới nếu phòng tính nước theo đồng hồ; có thể kèm ảnh công tơ.
Hệ thống đối chiếu chỉ số mới với chỉ số kỳ trước hoặc chỉ số ban đầu trong hợp đồng:
Tính lượng tiêu thụ = chỉ số mới − chỉ số cũ.
Không cho ghi chỉ số thấp hơn chỉ số cũ.
Không cho chốt kỳ tương lai; phòng cần có hợp đồng đang hiệu lực.
Nếu mức tiêu thụ vượt 2,5 lần trung bình của tối đa 3 kỳ trước, hệ thống cảnh báo. Người nhập kiểm tra lại hoặc xác nhận tiếp tục.
Khi lưu, hệ thống cập nhật chỉ số hiện tại của phòng và thử tạo/cập nhật hóa đơn nháp cho kỳ đó.
Khi hóa đơn đã phát hành, chỉ số kỳ đó bị khóa, không được sửa. Cũng không thể sửa kỳ cũ nếu đã có bản chốt số ở kỳ sau.
Bạn có thể hình dung nhiệm vụ chính là: chọn kỳ → ghi số từng phòng → xử lý cảnh báo → kiểm tra kết quả/hóa đơn nháp.

Các file thể hiện luồng này: giao diện UtilityReadingsPage.jsx, xử lý thao tác useUtilityReadingsPage.js, nghiệp vụ phía BE utilityReadingService.js.

2. Incident — tiếp nhận và xử lý sự cố
Mục tiêu: Khách thuê hoặc nhân viên báo sự cố; bên quản lý tiếp nhận, xử lý, ghi nhận chi phí và đóng hồ sơ.

Luồng nghiệp vụ:

Tạo báo cáo:
Khách thuê báo sự cố thuộc phòng đang có hợp đồng của mình.
Chủ trọ/Quản lý chọn cơ sở và phòng.
Báo cáo gồm tiêu đề, mô tả, mức ưu tiên và ảnh hiện trường nếu có.
Báo cáo mới bắt đầu ở trạng thái PENDING — Chờ tiếp nhận.
Hệ thống có thể tự phân loại sự cố và gợi ý mức ưu tiên. Quá trình này chạy sau khi tạo báo cáo; nếu là báo cáo của khách thuê, mức ưu tiên có thể được cập nhật theo kết quả gợi ý. Nhân viên cũng có thể chạy phân loại lại khi sự cố còn đang chờ hoặc đang xử lý.
Tiếp nhận và xử lý: Quản lý chuyển trạng thái sang IN_PROGRESS — Đang xử lý. Nếu chưa có người phụ trách thì người tiếp nhận được gán làm người phụ trách; có thể gán chủ trọ hoặc Quản lý của cơ sở đó.
Khi sửa xong, chuyển sang SOLVED — Đã khắc phục và phải có ít nhất một ảnh nghiệm thu.
Người có quyền ghi nhận chi phí nhập số tiền và bên chịu phí:
Chủ trọ có thể chọn khách thuê chịu phí nếu sự cố có hợp đồng liên quan.
Quản lý cơ sở không được quyết định khoản phí do khách thuê chịu.
Có lựa chọn chủ trọ trả hoặc miễn phí/bảo hành.
Sau khi đã ghi nhận chi phí, có thể chuyển sang CLOSED — Hoàn tất đóng.
Nếu không tiếp nhận sự cố, chuyển sang REJECTED — Đã từ chối và phải ghi lý do. Sự cố đã đóng hoặc bị từ chối không có luồng chuyển tiếp tiếp theo; sự cố đã sửa xong có thể được mở lại để xử lý.
Luồng trạng thái chính là:

PENDING → IN_PROGRESS → SOLVED → CLOSED

Nhánh khác: PENDING → REJECTED; hoặc SOLVED → IN_PROGRESS nếu cần xử lý lại.

Nhiệm vụ của bạn ở module này là: tạo/xem báo cáo, theo dõi trạng thái, phân công xử lý, lưu ảnh nghiệm thu, cập nhật chi phí và hoàn tất hồ sơ.

Các file thể hiện luồng này: trang IncidentsPage.jsx, nghiệp vụ phía BE incidentService.js, và quy tắc trạng thái nằm ở đầu file service đó.

3. Staff — cấp tài khoản Quản lý cơ sở
Lưu ý: Trong phần này, “Staff” đang có nghĩa cụ thể là Property Manager / Quản lý cơ sở. Đây là quản lý tài khoản đăng nhập, không phải chấm công hay phân ca nhân viên.

Luồng nghiệp vụ:

Chủ trọ mở danh sách Quản lý cơ sở và xem tài khoản cùng các cơ sở được phân công.
Khi tạo tài khoản, chủ trọ nhập tên, số điện thoại (dùng làm tên đăng nhập), email nếu có và chọn các cơ sở phụ trách.
BE kiểm tra cơ sở được chọn có đang hoạt động và thuộc chủ trọ đó không; đồng thời kiểm tra giới hạn số quản lý theo gói dịch vụ.
Hệ thống tạo tài khoản Quản lý cơ sở và sinh mật khẩu tạm thời. Người quản lý phải đổi mật khẩu ở lần đăng nhập đầu tiên.
Nếu cần cấp lại mật khẩu, chủ trọ xác nhận thao tác; hệ thống sinh mật khẩu tạm, thu hồi các phiên đăng nhập hiện tại và yêu cầu đổi mật khẩu lần tiếp theo.
Phạm vi tính năng Staff hiện thấy là xem danh sách, cấp tài khoản, gán cơ sở và cấp lại mật khẩu; mình không thấy luồng sửa hoặc xóa tài khoản trong các route này.

Các file thể hiện luồng này: trang StaffPage.jsx, xử lý giao diện useStaffManagement.js, nghiệp vụ phía BE accountService.js.

Tóm tắt phần Duong cần nắm
Utility Reading: ghi và kiểm tra chỉ số để phục vụ tính tiền điện nước.
Incident: theo dõi một sự cố từ lúc báo đến lúc sửa xong/đóng hồ sơ.
Staff: cấp tài khoản cho Quản lý cơ sở và giới hạn họ vào đúng các cơ sở được giao.
Nếu bạn muốn đọc để hiểu sản phẩm trước, hãy bắt đầu từ 3 trang FE; sau đó đọc 3 service BE tương ứng để hiểu quy tắc nghiệp vụ và điều kiện hệ thống áp