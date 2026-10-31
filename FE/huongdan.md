# Hướng dẫn đọc code BE của Duong

Tài liệu này hướng dẫn thứ tự đọc ba phần BE Duong phụ trách:

1. Utility Reading — chốt số điện, nước.
2. Incident — tiếp nhận và xử lý sự cố.
3. Staff — cấp tài khoản Quản lý cơ sở (Property Manager).

## Nên đọc theo thứ tự nào?

Với một request BE, hãy theo đường đi:

**server.js → app.js → routes/index.js → route của module → controller → service → model → helper/test**

- `server.js`: khởi động server, kết nối database và nạp `app`.
- `app.js`: cấu hình middleware, error handler và mount routes vào prefix API.
- `routes/index.js`: nối các route tổng như `/staff`, `/incidents`, `/utility-readings`.
- `*Routes.js`: khai báo endpoint và middleware đăng nhập/phân quyền.
- `*Controller.js`: nhận request, gọi service và trả response.
- `*Service.js`: xử lý nghiệp vụ và thao tác database.
- `models/*.js`: mô tả dữ liệu MongoDB.
- Helper và test: đọc sau khi đã hiểu luồng chính.

**Đừng bắt đầu từ service.** Hãy xem route trước để biết endpoint nào gọi service và role nào được phép truy cập.

## Bước đầu: hiểu cách BE nối các file

Đọc các file này một lần trước khi vào từng module:

1. [BE/server.js](../BE/server.js) — điểm khởi động BE; kết nối database, chạy migration và bật HTTP server.
2. [BE/app.js](../BE/app.js) — middleware dùng chung, error handler, realtime live updates và prefix API `/api/v1` cùng `/api`.
3. [BE/routes/index.js](../BE/routes/index.js) — nơi mount route:
   - `/staff` → `staffRoutes`
   - `/utility-readings` → `utilityReadingRoutes`
   - `/incidents` → `incidentRoutes`
   - Lưu ý: endpoint danh sách Utility Reading nằm trong `branchRoutes`, được mount dưới `/branches`.

Sau đó, với từng module, đọc **route → controller → service → model**. Chỉ mở helper khi thấy service sử dụng helper đó.

## 1. Utility Reading — chốt số điện, nước

### Luồng nghiệp vụ

Quản lý chọn cơ sở và kỳ chốt số, xem các phòng cần ghi, nhập chỉ số mới và có thể thêm ảnh công tơ. BE tính lượng tiêu thụ từ chỉ số cũ và mới; kiểm tra hợp đồng, phạm vi cơ sở, thứ tự kỳ và mức tăng bất thường. Khi lưu, BE cập nhật chỉ số hiện tại của phòng và thử tạo/cập nhật hóa đơn nháp (DRAFT). Chỉ số đã phát hành hóa đơn hoặc kỳ cũ đã có kỳ sau thì không được sửa.

### Đọc code theo thứ tự

1. [BE/routes/index.js](../BE/routes/index.js) — tìm chỗ mount `/branches` và `/utility-readings`.
2. [BE/routes/branchRoutes.js](../BE/routes/branchRoutes.js) — endpoint `GET /branches/:branchId/utility-readings`; endpoint này gọi `utilityReadingController.list`. Các route trong file dùng middleware đăng nhập và chỉ cho LANDLORD/PROPERTY_MANAGER.
3. [BE/routes/utilityReadingRoutes.js](../BE/routes/utilityReadingRoutes.js) — các endpoint:
   - `POST /utility-readings` — tạo bản chốt số.
   - `GET /utility-readings/:readingId` — xem một bản ghi.
   - `PUT /utility-readings/:readingId` — cập nhật bản ghi.
4. [BE/controllers/utilityReadingController.js](../BE/controllers/utilityReadingController.js) — chuyển request sang các hàm `list`, `get`, `create`, `update` trong service.
5. [BE/services/utilityReadingService.js](../BE/services/utilityReadingService.js) — file nghiệp vụ chính. Đọc theo thứ tự hàm:
   - `validateBody`: kiểm tra dữ liệu đầu vào và kỳ chốt số.
   - `getRoom`, `getContract`: tìm phòng/hợp đồng đúng phạm vi.
   - `history`, `abnormal`, `compute`: lấy dữ liệu kỳ trước, tính tiêu thụ và cảnh báo tăng bất thường.
   - `list`, `get`: đọc danh sách và chi tiết.
   - `create`, `update`: tạo/cập nhật bản ghi, cập nhật chỉ số phòng và ghi audit.
   - `syncDraftInvoice`: đồng bộ hóa đơn nháp sau khi chốt số.
6. [BE/models/UtilityReading.js](../BE/models/UtilityReading.js) — cấu trúc bản ghi, trạng thái đã lập hóa đơn và ràng buộc mỗi phòng/cơ sở/kỳ chỉ có một bản ghi.

### File liên quan đọc sau

- [BE/models/Room.js](../BE/models/Room.js) và [BE/models/Contract.js](../BE/models/Contract.js) — chỉ số hiện tại của phòng và chỉ số ban đầu trong hợp đồng.
- [BE/services/invoiceService.js](../BE/services/invoiceService.js) — được gọi để tạo/cập nhật hóa đơn nháp; chỉ cần xem hàm `upsertDraftInvoice`.
- [BE/services/branchService.js](../BE/services/branchService.js) — lấy cơ sở trong đúng phạm vi.
- Helper phạm vi, validate và thời gian: [BE/utils/scope.js](../BE/utils/scope.js), [BE/utils/validation.js](../BE/utils/validation.js), [BE/utils/financeValidation.js](../BE/utils/financeValidation.js), [BE/utils/vnTime.js](../BE/utils/vnTime.js).
- [BE/tests/operations.test.js](../BE/tests/operations.test.js) — test phạm vi, chỉ số giảm, kỳ chốt và cảnh báo bất thường.

## 2. Incident — tiếp nhận và xử lý sự cố

### Luồng nghiệp vụ

Khách thuê hoặc quản lý tạo báo cáo sự cố. Báo cáo bắt đầu ở `PENDING`; quản lý tiếp nhận để xử lý (`IN_PROGRESS`), ghi chi phí, đánh dấu sửa xong (`SOLVED`, cần ảnh nghiệm thu), rồi đóng (`CLOSED`). Báo cáo có thể bị từ chối (`REJECTED`, cần lý do); sự cố đã sửa xong có thể quay lại `IN_PROGRESS` nếu cần xử lý tiếp. Hệ thống cũng có thể phân loại sự cố và gợi ý mức ưu tiên.

### Đọc code theo thứ tự

1. [BE/routes/index.js](../BE/routes/index.js) — tìm route `/incidents`.
2. [BE/routes/incidentRoutes.js](../BE/routes/incidentRoutes.js) — endpoint và role:
   - `GET /incidents`, `POST /incidents`, `GET /incidents/:incidentId` — LANDLORD, PROPERTY_MANAGER, TENANT.
   - `PUT /incidents/:incidentId/status`, `PUT /incidents/:incidentId/cost`, `POST /incidents/:incidentId/triage` — chỉ LANDLORD và PROPERTY_MANAGER.
3. [BE/controllers/incidentController.js](../BE/controllers/incidentController.js) — nối service với HTTP response; khi tạo/cập nhật sự cố, controller còn phát realtime event.
4. [BE/services/incidentService.js](../BE/services/incidentService.js) — file nghiệp vụ chính. Đọc:
   - `TRANSITIONS`, `COST_EDITABLE`: trạng thái chuyển tiếp hợp lệ và lúc được sửa chi phí.
   - `scope`, `find`, `list`, `get`: phạm vi xem sự cố, lọc và phân trang.
   - `target`, `create`: xác định phòng/hợp đồng và tạo báo cáo.
   - `updateStatus`: chuyển trạng thái, người phụ trách, ảnh nghiệm thu và điều kiện đóng phiếu.
   - `updateCost`: chi phí, bên chi trả và điều kiện role.
   - `triageAfterCreate`, `retriage`: phân loại tự động/phân loại lại.
5. [BE/models/Incident.js](../BE/models/Incident.js) — dữ liệu báo cáo, lịch sử trạng thái, ảnh, chi phí và kết quả phân loại.
6. [BE/services/incidentTriage.js](../BE/services/incidentTriage.js) — đọc sau để hiểu phần phân loại và gợi ý ưu tiên; không cần bắt đầu ở file này.

### File liên quan đọc sau

- [BE/models/Room.js](../BE/models/Room.js), [BE/models/Contract.js](../BE/models/Contract.js), [BE/models/User.js](../BE/models/User.js) — phòng, hợp đồng và người báo/người được giao xử lý.
- [BE/realtime/index.js](../BE/realtime/index.js) — cách controller phát sự kiện sự cố cho client.
- [BE/services/planFeatures.js](../BE/services/planFeatures.js) — kiểm tra tính năng sự cố theo gói dịch vụ.
- [BE/tests/operations.test.js](../BE/tests/operations.test.js) — test báo cáo, phạm vi, chuyển trạng thái, ảnh nghiệm thu và chi phí.

## 3. Staff — cấp tài khoản Quản lý cơ sở

### Luồng nghiệp vụ

Chủ trọ xem danh sách, cấp tài khoản Property Manager và chọn các cơ sở được giao. BE kiểm tra thông tin, xác nhận cơ sở thuộc chủ trọ và đang hoạt động, kiểm tra quota gói dịch vụ, sau đó tạo tài khoản với mật khẩu tạm. Manager phải đổi mật khẩu ở lần đăng nhập đầu. Khi reset mật khẩu, các phiên đăng nhập hiện tại bị thu hồi.

### Đọc code theo thứ tự

1. [BE/routes/index.js](../BE/routes/index.js) — route `/staff`.
2. [BE/routes/staffRoutes.js](../BE/routes/staffRoutes.js) — `GET /staff`, `POST /staff`, `POST /staff/:staffId/reset-password`. Tất cả chỉ cho LANDLORD.
3. [BE/controllers/accountController.js](../BE/controllers/accountController.js) — các hàm `listStaff`, `createStaff`, `resetStaffPassword` gọi service với role `PROPERTY_MANAGER`.
4. [BE/services/accountService.js](../BE/services/accountService.js) — file dùng chung cho Staff và Tenant. Khi học Staff, tập trung vào:
   - `profile`: validate và chuẩn hóa thông tin Property Manager.
   - `assignedBranches`: xác nhận cơ sở hoạt động và thuộc chủ trọ.
   - `createAccount`, `createStaff`: tạo tài khoản, sinh mật khẩu tạm, bắt buộc đổi mật khẩu và ghi audit.
   - `list`: lấy danh sách theo role.
   - `resetPassword`: cấp mật khẩu mới và xóa các AuthSession hiện tại.
   - Có thể bỏ qua `tenantForContract`, `reopenTenant` và logic riêng cho Tenant trong lần đọc đầu.
5. [BE/services/accountValidation.js](../BE/services/accountValidation.js) — validate email/số điện thoại và sinh mật khẩu tạm.
6. [BE/models/User.js](../BE/models/User.js) — role `PROPERTY_MANAGER`, `assignedBranches`, username từ số điện thoại và hook băm mật khẩu trước khi lưu.

### File liên quan đọc sau

- [BE/models/Branch.js](../BE/models/Branch.js) — cơ sở được gán cho Manager.
- [BE/models/AuthSession.js](../BE/models/AuthSession.js) — phiên đăng nhập bị xóa khi reset mật khẩu.
- [BE/services/quotaService.js](../BE/services/quotaService.js) — giới hạn số Manager theo gói.
- [BE/services/auditService.js](../BE/services/auditService.js) — ghi lại thao tác cấp tài khoản/reset mật khẩu.
- [BE/tests/auth.test.js](../BE/tests/auth.test.js) — test quyền truy cập và cấp tài khoản Staff; [BE/tests/integration.test.js](../BE/tests/integration.test.js) có test quota Manager.

## Helper dùng chung nên biết

Không cần đọc hết trước. Khi thấy service gọi helper nào, hãy mở đúng file đó:

- [BE/middlewares/auth.js](../BE/middlewares/auth.js) — xác thực đăng nhập và kiểm tra role.
- [BE/utils/scope.js](../BE/utils/scope.js) — giới hạn dữ liệu theo chủ trọ/cơ sở được giao.
- [BE/utils/response.js](../BE/utils/response.js) và [BE/middlewares/errorHandler.js](../BE/middlewares/errorHandler.js) — định dạng response và lỗi API.
- [BE/services/auditService.js](../BE/services/auditService.js) — audit các thao tác quan trọng.

## Cách tự trace một request

Ví dụ tìm luồng tạo Staff:

1. Tìm `POST /staff` trong `staffRoutes.js`.
2. Xem route gọi `createStaff` trong `accountController.js`.
3. Theo `createStaff` sang `accountService.js`.
4. Xem các hàm phụ `createAccount`, `assignedBranches`, `profile`.
5. Theo dữ liệu xuống `User.js`, `Branch.js`; nếu gặp quota/audit thì xem `quotaService.js`, `auditService.js`.
6. Cuối cùng xem test liên quan để hiểu input, output và lỗi được mong đợi.

Áp dụng cách tương tự cho Utility Reading và Incident: bắt đầu từ endpoint trong route, theo controller đến service, rồi xem model và helper. Khi đã hiểu BE, có thể đối chiếu với FE; chưa cần đọc CSS để hiểu nghiệp vụ.
