# Backend Finance

Phạm vi: Invoice, Payment, thu tiền mặt, hóa đơn công khai và đối soát chuyển khoản chưa khớp. Không có thay đổi frontend.

## Chạy backend

Yêu cầu Node.js >= 22 và MongoDB Atlas hoặc MongoDB replica set. Không có fallback ghi tài chính ngoài transaction.

```powershell
cd BE
npm install
# Tạo .env theo .env.example; cấu hình MONGO_URI, JWT_SECRET, CLIENT_URL và SePay.
npm run dev
npm run lint
```

Backend được khởi tạo trực tiếp trong `server.js`; các route được gắn qua `routes/index.js`. `npm run lint` chỉ phân tích tĩnh bằng kiểm tra cú pháp và Oxlint. Chế độ dev dùng `node --watch`. Chủ dự án trực tiếp thực hiện kiểm thử và xác nhận tích hợp; agent không chạy test hoặc tự bật server để kiểm thử.

## Checklist kiểm thử thủ công dành cho chủ dự án

1. Khởi động backend bằng `npm start`: server kết nối MongoDB, khởi tạo index và mở cổng đã cấu hình.
2. Tạo rồi phát hành hóa đơn bằng tài khoản LANDLORD: tổng tiền đúng theo điện/nước/dịch vụ; reading chuyển `isBilled=true` và có VietQR.
3. Thu tiền mặt một phần rồi thu phần còn lại: trạng thái lần lượt `PARTIALLY_PAID` và `PAID`; biên lai trùng bị từ chối.
4. Gửi webhook SePay hợp lệ hai lần với cùng mã giao dịch: chỉ ghi nhận một Payment; lần gửi lại trả thành công với `duplicate=true`.
5. Mở Public Invoice: tên và SĐT được che; không có CCCD; hóa đơn DRAFT/CANCELLED không truy cập được.
6. Dùng tài khoản chủ trọ khác để đọc hóa đơn hoặc thanh toán: không nhận được dữ liệu ngoài phạm vi sở hữu.

Index mới `{landlordId, roomId, billingPeriod}` unique với `isDeleted: false` bảo đảm mỗi phòng/kỳ có một hóa đơn. Nếu database cũ có bản ghi trùng, cần đối soát trước khi tạo index; không tự xóa hóa đơn. `PaymentReceipt` dành riêng để giữ reference duy nhất xuyên suốt CASH, Payment và UnmatchedPayment.

## Auth và quyền

API riêng nhận `Authorization: Bearer <access-token>`. Middleware kiểm tra HS256 bằng `JWT_SECRET`, thời hạn tối đa 15 phút từ `iat`, `exp` bắt buộc, user đang ACTIVE và chưa xóa. ID lấy từ `sub`, `id` hoặc `_id`. Nếu token có `type`, giá trị phải là `access`. Role và phạm vi được đọc từ database, không tin role/landlordId do client gửi. Không hỗ trợ bypass header.

Module không tạo endpoint đăng nhập/refresh: Dev 1 cung cấp Auth theo contract chung. Khi tích hợp, dùng cùng `JWT_SECRET` hoặc thay middleware bằng middleware Auth chính của nhóm.

- LANDLORD: đọc và thao tác tài chính trong chuỗi của mình.
- TENANT: chỉ đọc hóa đơn đã phát hành và lịch sử thanh toán của mình.
- PROPERTY_MANAGER và SUPER_ADMIN: không được gọi API tiền phòng.
- Public Invoice và webhook dùng cơ chế xác thực riêng bên dưới.

CRUD `/api/users` có sẵn được bảo vệ bằng Auth + SUPER_ADMIN để người ngoài không thể đổi role hoặc bank config bằng route mẫu. Các API tài khoản hoàn chỉnh thuộc Dev 1.

## API

Prefix: `/api/v1`.

| Method | Endpoint | Quyền | Chức năng |
|---|---|---|---|
| GET | `/invoices` | Landlord/Tenant | Lọc `branchId`, `billingPeriod`, `status`, `page`, `limit` |
| POST | `/invoices/generate` | Landlord | Tạo hoặc cập nhật nháp theo kỳ |
| GET | `/invoices/:invoiceId` | Landlord/Tenant | Chi tiết hóa đơn trong scope |
| POST | `/invoices/:invoiceId/issue` | Landlord | Tính lại nháp theo reading hiện tại, chốt reading, phát hành QR |
| POST | `/invoices/:invoiceId/cancel` | Landlord | Hủy hóa đơn chưa thu tiền, bắt buộc `reason` |
| GET | `/invoices/public/:publicAccessToken` | Công khai | Chỉ hóa đơn đã phát hành; che tên/SĐT, loại bỏ CCCD/email/contract/raw webhook |
| GET | `/invoices/:invoiceId/payments` | Landlord/Tenant | Lịch sử thanh toán hóa đơn |
| POST | `/payments/cash` | Landlord | Xác nhận thu tiền mặt |
| POST | `/payments/webhook` | SePay | Nhận chuyển khoản; trả 200 khi xử lý xong, trùng hoặc lưu unmatched |
| GET | `/payments` | Landlord/Tenant | Lọc `branchId`, `paymentMethod`, `page`, `limit` |
| GET | `/payments/:paymentId` | Landlord/Tenant | Chi tiết thanh toán; không trả raw webhook |
| GET | `/payments/unmatched` | Landlord | Danh sách giao dịch chưa đối soát; lọc `status` |
| POST | `/payments/unmatched/:unmatchedPaymentId/resolve` | Landlord | Gán giao dịch vào hóa đơn bằng `invoiceId` |

`page` mặc định 1, `limit` mặc định 20, tối đa 100. Response danh sách có `{success, data, pagination: {page, limit, total}}`. Response lỗi có `{success: false, errorCode, message, data: null}`.

### Tạo hóa đơn

```json
{
  "branchId": "<ObjectId>",
  "billingPeriod": "2026-10",
  "dueDate": "2026-10-05",
  "roomIds": ["<ObjectId>"]
}
```

Bỏ `roomIds` để lấy các phòng RENTED trong cơ sở; tối đa 500 phòng/lần. Mỗi phòng phải có hợp đồng hiện tại hợp lệ và reading đúng kỳ. Cả batch nằm trong một transaction. Gọi lại cập nhật DRAFT; các hóa đơn đã phát hành được trả lại nguyên trạng; CANCELLED trả lỗi và không tự sinh chứng từ thay thế.

Tiền phòng là tiền thuê tháng đầy đủ theo hợp đồng (chưa chia theo ngày vào/ra phòng). Điện tính theo chỉ số; nước hỗ trợ METER/PER_PERSON/FIXED. Số người = người ký + roommates. Dịch vụ PER_UNIT lấy số lượng từ `Contract.serviceQuantities`, ví dụ `{"Gửi xe": 2}`; thiếu số lượng sẽ báo lỗi. Room có thể ghi đè `electricityPrice`, `waterPrice`, `waterBillingType`, `services`; nếu `services` không có thì dùng cấu hình cơ sở, nếu là `[]` thì không tính dịch vụ. Các khoản tiền là số nguyên VND; tiêu thụ điện/nước có thể thập phân và tiền được làm tròn đến VND.

Đơn giá, tiền thuê và đơn giá dịch vụ được chụp tại lần tạo nháp đầu tiên, không tự đổi khi chỉnh cấu hình cơ sở. Khi phát hành, reading được tính lại và `isBilled=true` trong cùng transaction. API không cho sửa tiền trực tiếp trên hóa đơn đã phát hành hoặc đã thanh toán. QR có số tiền còn nợ và nội dung `<invoiceCode> P<roomNumber>`. Tài khoản ngân hàng được snapshot để giữ nguyên thông tin hóa đơn đã phát hành.

### Thu tiền mặt

```json
{
  "invoiceId": "<ObjectId>",
  "amount": 1000000,
  "receiptNumber": "CASH-20261003-0001",
  "transactionDate": "2026-10-03T10:00:00+07:00",
  "payerName": "Nguyễn Văn A",
  "cashCollectionPoint": "Quầy cơ sở A",
  "note": "Thu một phần tiền phòng"
}
```

`invoiceId`, `amount`, `receiptNumber`, `transactionDate` bắt buộc. `amount` phải là số nguyên dương; ngày thu không được ở tương lai. Server gán `confirmedBy` và ghi audit `CONFIRM_CASH_PAYMENT`. Biên lai không thể dùng lại, kể cả reference đã lưu trong UnmatchedPayment.

Payment + Invoice + AuditLog + PaymentReceipt được ghi chung một transaction. Thanh toán thiếu chuyển PARTIALLY_PAID; đủ chuyển PAID; thừa chuyển OVERPAID và ghi `overpaidAmount`. PAID/OVERPAID không nhận thêm thu tiền mặt. Tiền thừa được ghi nhận để đối soát; ví dư và tự động khấu trừ kỳ sau chưa nằm trong API contract MVP này.

### SePay

Cấu hình webhook JSON, URL `/api/v1/payments/webhook`; bật gửi tất cả giao dịch tiền vào, kể cả không nhận diện được payment code, để lưu giao dịch sai nội dung.

Chọn một phương thức:

- `SEPAY_AUTH_MODE=apikey`: cấu hình API Key tại SePay và `SEPAY_API_KEY` tại backend; header `Authorization: Apikey <key>`.
- `SEPAY_AUTH_MODE=hmac`: cấu hình `SEPAY_WEBHOOK_SECRET`; kiểm tra HMAC-SHA256 của `<timestamp>.<raw body>`, header `X-SePay-Signature: sha256=<hex>` và `X-SePay-Timestamp`; lệch quá 5 phút bị từ chối. JSON gốc được giữ trước khi parse.

```json
{
  "id": 92704,
  "gateway": "MBBank",
  "transactionDate": "2026-10-03 10:00:00",
  "accountNumber": "1234567890",
  "content": "HD202610ABCDEF123456 P101",
  "transferType": "in",
  "transferAmount": 3850000,
  "referenceCode": "FT202610030001"
}
```

Ngày SePay không có timezone được hiểu là giờ Việt Nam (+07:00). `id` và `referenceCode` dùng để chống trùng; payload đổi số tiền/reference trên receipt đã có sẽ bị từ chối. Tài khoản nhận phải khớp chính xác một LANDLORD ACTIVE. Không suy ra chủ trọ từ invoiceCode hoặc header client. Nếu nhiều chủ trọ dùng cùng số tài khoản, backend từ chối vì không xác định được scope.

Không tìm thấy một invoiceCode rõ ràng, invoiceCode thuộc chủ khác, hóa đơn nháp/hủy/đã thanh toán: tiền được giữ trong UnmatchedPayment, không tự gạch nợ. Giao dịch `out` được bỏ qua. Gán unmatched vào hóa đơn dùng transaction và audit `RESOLVE_UNMATCHED_PAYMENT`; gán lần hai bị từ chối. Webhook trùng trả HTTP 200, không tạo Payment/Audit/event thứ hai.

Rate limit: public invoice 60 request/phút/IP; webhook 120 request/phút/IP. Bộ đếm ở memory của từng backend instance; khi scale nhiều instance cần shared store. Nếu chạy sau reverse proxy, cấu hình Express `trust proxy` đúng số hop của hạ tầng trước khi dùng IP của khách.

Tham khảo chính thức: [payload SePay](https://developer.sepay.vn/vi/sepay-webhooks/tich-hop-webhook), [xác thực SePay](https://developer.sepay.vn/vi/sepay-webhooks/xac-thuc), [transaction Mongoose](https://mongoosejs.com/docs/transactions.html).

## Điểm tích hợp cho các developer khác

- Dev 1: Auth token/middleware; hợp đồng phải set `Room.currentContractId`, `tenantId`, `serviceQuantities` và scope đúng.
- Dev 2: reading dùng field model `oldElectricIndex`, `newElectricIndex`, `oldWaterIndex`, `newWaterIndex`; chỉ sửa khi `isBilled=false`. Sau lưu reading, có thể gọi `generateInvoices` trong luồng nghiệp vụ riêng để đồng bộ DRAFT. Backend hiện cung cấp endpoint generate, chưa gắn tự động vào utility API chưa tồn tại.
- Dev 4: gắn Socket.io bằng `app.set('io', io)`. Controller phát `payment:success` sau commit; phát thêm `invoice_paid` khi PAID/OVERPAID. Rooms và payload theo contract chung. Dev 4 kiểm tra quyền khi join rooms. Finance không khởi tạo Socket.io server. Thất bại phát event không rollback giao dịch đã commit; đối soát bằng GET API.
- Gửi link hóa đơn qua SMS/Zalo/Email và frontend `/i/:token` thuộc phần tích hợp khác; API Finance chỉ trả token/dữ liệu công khai.
- Không có API xóa Payment, sửa tiền Invoice đã thanh toán, adjustment/refund hoặc tự thu SaaS. Tiền thuê và doanh thu phần mềm vẫn tách biệt.
