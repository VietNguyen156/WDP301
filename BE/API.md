# WDP301 Backend API

Tài liệu API của Backend `/BE`, gộp từ các file `*_API.md` trước đây. Prefix chung `/api/v1`.
Response thành công `{ success: true, data, message }`; lỗi `{ success: false, errorCode, message, data }`.

## Mục lục

1. [Auth và cấp tài khoản](#auth)
2. [Hồ sơ cá nhân & Tài khoản nhận tiền](#profile)
3. [Property Core — Branch, Room, Contract](#property)
4. [Operations — Utility Reading & Incident (Dev 2)](#operations)
5. [Backend Finance](#finance)
6. [SePay Bank Hub — Chủ trọ liên kết tài khoản nhận tiền](#bankhub)
7. [Dashboard chủ trọ & Realtime (Dev 4)](#dashboard-realtime)
8. [Bảng gói SaaS cho chủ trọ](#plans)
9. [Thanh toán gói SaaS qua Cổng thanh toán SePay](#saas-payment)
10. [Admin nền tảng SaaS](#admin)

<a id="auth"></a>

## 1. Auth và cấp tài khoản

Áp dụng yêu cầu ngày 14/10/2026. Prefix chính: `/api/v1`. Chỉ Backend đã được cập nhật; FE cần tích hợp các màn hình và hành vi bên dưới.

### Quy tắc tài khoản

- **LANDLORD:** tự đăng ký bằng email và mật khẩu; trạng thái `ACTIVE` ngay, không chờ duyệt/OTP/email verification. Nếu gói `FREE_TRIAL` đang hoạt động và miễn phí, được cấp thuê bao theo `trialDays` do Admin cấu hình (mặc định 30 ngày). Khi chưa có gói này, backend tạo cấu hình dùng thử: 1 cơ sở, 5 phòng, 1 manager.
- **PROPERTY_MANAGER:** chỉ Landlord cấp; username là số điện thoại Việt Nam 10 chữ số (chuẩn hóa `+84` về `0`), mật khẩu ngẫu nhiên, bắt buộc đổi lần đầu.
- **TENANT:** chỉ Landlord cấp; username là CCCD dạng chuỗi 12 chữ số, giữ số 0 đầu. Mật khẩu ngẫu nhiên, bắt buộc đổi lần đầu. Tự động cấp khi Landlord tạo hợp đồng cho khách mới; không có API cấp Tenant độc lập.
- **SUPER_ADMIN:** backend **không** tự tạo tài khoản admin hay dữ liệu mẫu; tài khoản SUPER_ADMIN phải có sẵn trong DB (mật khẩu băm bcrypt). Không có API công khai tạo admin.
- Email của Manager/Tenant là tùy chọn. Username và email đã sử dụng không được cấp cho tài khoản khác, kể cả tài khoản xóa mềm. Tenant hiện vẫn thuộc một Landlord theo mô hình dữ liệu của dự án.
- Mật khẩu do người dùng tự đặt: từ 8 ký tự, tối đa 72 byte UTF-8. Mật khẩu mới phải khác mật khẩu hiện tại. Ngoại lệ mật khẩu khởi tạo `admin` là yêu cầu cụ thể của chủ dự án.

### Chuyển đổi database cũ và khởi động

Không chạy lại seed demo để nâng cấp database vì seed demo có xóa dữ liệu.

Database cũ cần chủ dự án cập nhật thủ công khi backend đã dừng:

- Chuẩn hóa username: email cho Landlord, SĐT cho Manager, CCCD cho Tenant; kiểm tra định danh thiếu/sai hoặc trùng trước khi cập nhật.
- Thay index email cũ bằng unique partial index với filter `{ email: { $type: "string" } }`; tạo index username với filter tương ứng. Không lưu email rỗng cho tài khoản không có email.
- Giữ mật khẩu Manager/Tenant cũ; tài khoản chưa có cờ đổi mật khẩu cần được đánh dấu `mustChangePassword: true`. Tenant cũ `PENDING_ACTIVATION` dùng endpoint cấp lại mật khẩu để chuyển sang luồng mới.
- Không còn file script migration. Chưa cập nhật database trong lần triển khai này.
- Database mới không cần migration. Khi khởi động server, backend tạo admin sau khi khởi tạo index thành công. Không reset tài khoản đã có. Backend không khởi động nếu index lỗi.
- `JWT_SECRET` phải cấu hình qua `.env`, tối thiểu 32 ký tự; đã bỏ secret dự phòng trong code.
- Access token cũ không có session ID sẽ bị từ chối; người dùng cần đăng nhập lại sau khi cập nhật.
- Chưa chạy migration, seed, server hoặc test trên database trong lần triển khai này.

### API đăng ký và đăng nhập

#### POST /auth/register — public

```json
{
  "name": "Nguyễn Văn Chủ",
  "email": "owner@example.com",
  "phoneNumber": "0912345678",
  "password": "mat-khau-moi-123"
}
```

`phoneNumber` tùy chọn. Có thể gửi `role: "LANDLORD"`; mọi role khác bị từ chối 403. Không nhận `landlordId`, `status`, `mustChangePassword`, `assignedBranches` hoặc quyền từ client.

HTTP 201: `{ "success": true, "message": "...", "data": { "user": { "id": "...", "username": "owner@example.com", "role": "LANDLORD", "status": "ACTIVE", "mustChangePassword": false } } }`.

Sau đăng ký gọi API login; register không tự tạo phiên đăng nhập. Email/username trùng trả 409 `CONFLICT`.

#### POST /auth/login — public

```json
{ "username": "0912345678", "password": "mat-khau-tam-duoc-cap" }
```

`username` nhận email Landlord, SĐT Manager, CCCD Tenant hoặc `admin`. Request cũ `{ "email": "...", "password": "..." }` vẫn được hỗ trợ cho tài khoản có email. Chỉ gửi một trong hai field `username` và `email`.

HTTP 200:

```json
{
  "success": true,
  "message": "Xử lý thành công",
  "data": {
    "token": "access-token",
    "user": {
      "id": "...",
      "username": "0912345678",
      "name": "Quản lý A",
      "role": "PROPERTY_MANAGER",
      "status": "ACTIVE",
      "landlordId": "...",
      "assignedBranches": ["..."],
      "mustChangePassword": true
    }
  }
}
```

Refresh token chỉ nằm trong HttpOnly cookie, không nằm trong response JSON. Access token 15 phút; refresh session 7 ngày, lưu token hash trong DB. Cookie path `/api` phục vụ cả prefix chuẩn và alias cũ; production mặc định `Secure; SameSite=None`. CORS chỉ cho `CLIENT_URL`, với `credentials: true`.

#### GET /auth/me — Bearer token

Trả `data` là user DTO. Cho phép tài khoản đang bắt buộc đổi mật khẩu đọc thông tin của chính mình.

#### POST /auth/change-password — Bearer token

```json
{
  "currentPassword": "mat-khau-tam-duoc-cap",
  "newPassword": "mat-khau-rieng-moi-123"
}
```

HTTP 200: `{ "success": true, "message": "...", "data": { "user": { "mustChangePassword": false }, "requiresLogin": true } }` (user trả đầy đủ các field DTO).

- Backend hash mật khẩu mới, xóa cờ bắt buộc đổi, tăng phiên bản xác thực và thu hồi mọi session cũ trong cùng transaction.
- FE xóa access token trong memory và đưa người dùng về đăng nhập. Access token/refresh token cũ đều không dùng được nữa.
- Trước khi đổi mật khẩu, mọi API nghiệp vụ có bảo vệ đều trả 403 `PASSWORD_CHANGE_REQUIRED`, kể cả khi gọi trực tiếp ngoài FE.
- Auth vẫn cho phép login, refresh, logout, me và change-password; public invoice vẫn theo token công khai riêng.

#### POST /auth/refresh và POST /auth/logout

Gửi cookie bằng `credentials: include` / `withCredentials: true`. Refresh trả `{ token, user }` trong `data`; logout thu hồi session và cookie. Access token gắn với session đã logout cũng bị từ chối.

### API Landlord cấp tài khoản

Các endpoint sau cần Bearer token của `LANDLORD`. `landlordId` luôn lấy từ user đang đăng nhập. Manager/Tenant/Admin không được cấp tài khoản qua các endpoint này.

#### POST /staff

```json
{
  "name": "Quản lý A",
  "phoneNumber": "0912345678",
  "assignedBranches": ["branch-id"],
  "email": "manager@example.com"
}
```

`email` và `assignedBranches` tùy chọn. Mọi cơ sở được gán phải đang hoạt động, chưa xóa và thuộc Landlord. Kiểm tra quota manager trong cùng transaction tạo user và audit. API cập nhật Staff đầy đủ nằm ngoài thay đổi auth này.

API tạo Manager trả HTTP 201:

```json
{
  "success": true,
  "message": "Xử lý thành công",
  "data": {
    "user": { "id": "...", "username": "...", "mustChangePassword": true },
    "credentials": {
      "username": "...",
      "temporaryPassword": "mat-khau-ngau-nhien",
      "mustChangePassword": true
    }
  }
}
```

`user` là DTO đầy đủ; ví dụ chỉ rút gọn các field. Mật khẩu tạm chỉ trả tại lần cấp/cấp lại, không lưu dạng rõ trong DB, audit hoặc API danh sách. FE cần hiển thị để Landlord bàn giao cho người được cấp; không tự gửi SMS/email trong luồng này.

#### GET /staff và GET /tenants

Hỗ trợ `page`, `limit`; trả `data: { items, total, page, limit }`, chỉ các tài khoản đúng role thuộc Landlord và chưa xóa. Không trả mật khẩu.

#### POST /staff/:staffId/reset-password và POST /tenants/:tenantId/reset-password

Body `{}`. Chỉ Landlord sở hữu tài khoản được cấp lại mật khẩu ngẫu nhiên. Response giống cấp tài khoản, HTTP 200. Thu hồi session cũ, bắt đổi mật khẩu lần nữa; hỗ trợ chuyển Tenant cũ `PENDING_ACTIVATION` sang `ACTIVE`. Không tự mở khóa tài khoản `SUSPENDED`.

#### POST /contracts — tích hợp tài khoản Tenant

Giữ request hợp đồng cũ, nhưng `tenant.email` và `tenant.phoneNumber` không còn bắt buộc; `tenant.name` và CCCD 12 chữ số bắt buộc. Tìm Tenant theo CCCD trong scope Landlord. Nếu đã có, liên kết và giữ nguyên mật khẩu. Nếu chưa có, tạo tài khoản ACTIVE có mật khẩu tạm, lập hợp đồng và cập nhật phòng trong cùng transaction.

Response vẫn là contract trong `data`; **chỉ khi tạo mới Tenant** mới thêm `data.tenantCredentials: { username, temporaryPassword, mustChangePassword: true }`. Không lưu field này vào document Contract; GET hợp đồng không trả lại mật khẩu.

### Các thay đổi tích hợp cần FE xử lý

1. Thay ô login chỉ nhận email bằng ô tài khoản nhận email/SĐT/CCCD/admin, gửi `username`.
2. Thêm form đăng ký Landlord.
3. Khi `user.mustChangePassword=true` hoặc nhận `PASSWORD_CHANGE_REQUIRED`, đưa đến màn hình đổi mật khẩu bắt buộc. Sau đổi thành công, đăng nhập lại.
4. Thêm luồng Landlord cấp Manager/cấp lại mật khẩu và hiển thị mật khẩu tạm một lần. Tenant được cấp tự động qua hợp đồng: đọc `tenantCredentials` sau tạo hợp đồng, không tạo màn hình cấp Tenant riêng.
5. Hai endpoint OTP kích hoạt cũ trả 410 `OTP_ACTIVATION_RETIRED`. Không dùng màn hình OTP cho tài khoản mới.
6. `/users` dành cho SUPER_ADMIN chỉ còn GET danh sách/chi tiết cơ bản, không trả ngân hàng nội bộ. POST/PUT/DELETE cũ bị loại bỏ để không vượt qua cơ chế cấp tài khoản và hash mật khẩu.
7. Access token chỉ lưu trong memory ở FE theo Project Rules. Thay đổi lần này không sửa FE.

### Thu tiền mặt qua Quản lý cơ sở

- `PROPERTY_MANAGER` được phép gửi `POST /api/v1/payments/cash` cho hóa đơn thuộc branch trong `assignedBranches`.
- Báo cáo tạo Payment `CASH` với trạng thái `PENDING_CONFIRMATION`, lưu người lập báo cáo và chưa cập nhật số tiền đã thanh toán của Invoice.
- `LANDLORD` xem các payment chờ duyệt qua sổ quỹ và gọi `POST /api/v1/payments/cash/:paymentId/confirm` để duyệt. Chỉ bước này mới cập nhật Invoice và chuyển Payment sang `SUCCESS`.
- `LANDLORD` có thể gọi `POST /api/v1/payments/cash/:paymentId/reject` với `{ "reason": "..." }`; Payment chuyển `FAILED`, Invoice không thay đổi.
- Cả lập báo cáo, duyệt và từ chối đều ghi `AuditLog`; receipt number vẫn duy nhất để chống ghi nhận trùng.

### Kiểm tra thủ công đề xuất

1. Đăng ký Landlord và login ngay; thử đăng ký với role Manager/Tenant/Admin phải bị từ chối.
2. Tạo Manager chỉ có tên/SĐT, gán cơ sở của mình; gán cơ sở chuỗi khác hoặc vượt quota phải thất bại và không tạo user.
3. Đăng nhập Manager bằng mật khẩu tạm; gọi branches/invoices/payments phải trả `PASSWORD_CHANGE_REQUIRED`. Đổi mật khẩu rồi login lại mới dùng được quyền được giao.
4. Tạo hợp đồng cho khách mới không có email; kiểm tra tài khoản dùng CCCD được tạo tự động. Gọi POST /tenants phải trả 404 và không tạo tài khoản.
5. Tạo hợp đồng với Tenant mới: chỉ response tạo trả mật khẩu tạm. Tạo hợp đồng khác liên kết Tenant đã có không reset mật khẩu.
6. Đổi/cấp lại mật khẩu: mật khẩu cũ, access token cũ và refresh token cũ đều không dùng được. Landlord khác không cấp lại được.
7. Khóa Landlord: Manager/Tenant bị chặn đồng nhất ở Property Core và Finance.
8. Kiểm tra mật khẩu lưu dạng hash trong DB và không xuất hiện trong JSON/audit.
9. Kiểm tra cookie refresh/logout trên cả `/api/v1/auth` và alias `/api/auth`; logout vô hiệu hóa access token cùng session.

Đã bổ sung `tests/auth.test.js` và cập nhật test hợp đồng sang luồng mật khẩu tạm. Không thực thi automated tests; chủ dự án kiểm thử và nghiệm thu.

### Gói SaaS của chủ trọ trong phiên đăng nhập

`POST /auth/login`, `POST /auth/register`, `POST /auth/refresh` và `GET /auth/me` trả thêm cho `LANDLORD`:

```json
{
  "subscription": {
    "id": "...", "status": "ACTIVE", "startDate": "...", "endDate": "...",
    "plan": { "id": "...", "code": "PRO", "name": "Gói Pro", "maxBranches": 5, "maxRooms": 100, "maxManagers": 5 }
  },
  "subscriptionPlan": "PRO",
  "pendingSubscription": null
}
```

- `subscription` là gói **đang có hiệu lực**, cùng nguồn mà quota dùng. Không còn gói nào hiệu lực → `null`.
- Admin đổi gói thì tạo thuê bao `PENDING_PAYMENT` kèm hóa đơn SaaS. Trong lúc chờ, gói mới nằm ở `pendingSubscription` và chủ trọ vẫn dùng gói cũ. Khi admin xác nhận hóa đơn đã thanh toán (`POST /admin/invoices/:id/paid`), gói mới mới có hiệu lực.
- FE đọc thông tin này khi đăng nhập hoặc khi tải lại trang (qua `/auth/refresh`). Nếu chủ trọ đang mở sẵn trang lúc admin xác nhận, cần tải lại trang để thấy gói mới.
- Các vai trò khác không có các trường này.

---

<a id="profile"></a>

## 2. Hồ sơ cá nhân & Tài khoản nhận tiền

Chỉ Backend `/BE`. Prefix `/api/v1`. Tài khoản phải đăng nhập, và đã đổi mật khẩu tạm nếu có (nếu chưa đổi → `403 PASSWORD_CHANGE_REQUIRED`).
Response có header `Cache-Control: no-store`.

### GET /profile

Trả về hồ sơ của chính người đang đăng nhập (dữ liệu giống `/auth/me`, cộng thêm `phoneNumber` và `hometown`).
Riêng `LANDLORD` có thêm:

```json
{
  "bankAccount": { "bankCode": "MB", "bankName": "MBBank", "accountNumber": "0123456789", "accountName": "NGUYEN VAN DUC" },
  "hasBankAccount": true
}
```

Khi chưa cấu hình thì `bankAccount: null` và `hasBankAccount: false`. FE nên nhắc chủ trọ cấu hình, vì nếu chưa có tài khoản thì không phát hành được hóa đơn (`BANK_NOT_CONFIGURED`).
`/auth/me` vẫn không trả thông tin ngân hàng.

### PUT /profile

Chỉ được sửa các trường **không phải tên đăng nhập**. Gửi trường nằm ngoài danh sách dưới đây sẽ bị trả `400 VALIDATION_ERROR`.

| Vai trò | Trường được sửa | Tên đăng nhập (không sửa ở đây) |
| --- | --- | --- |
| LANDLORD | `name`, `phoneNumber` | email |
| PROPERTY_MANAGER | `name`, `email` | số điện thoại |
| TENANT | `name`, `phoneNumber`, `email`, `hometown` | CCCD |
| SUPER_ADMIN | `name` | `admin` |

- `phoneNumber` được chuẩn hóa: `+84 901 234 567` → `0901234567`. Gửi chuỗi rỗng `""` sẽ xóa SĐT hoặc email.
- Email đã có người dùng → `409 EMAIL_IN_USE`.
- Thao tác được ghi audit log `UPDATE_PROFILE`.

### PUT /profile/bank-account

Chỉ dành cho `LANDLORD`; vai trò khác bị 403. Bắt buộc nhập lại mật khẩu, vì đây là tài khoản nhận tiền của khách thuê.

```json
{
  "bankCode": "MB",
  "bankName": "MBBank",
  "accountNumber": "0123456789",
  "accountName": "Nguyễn Văn Đức",
  "currentPassword": "mật khẩu hiện tại"
}
```

- `bankCode` là mã ngân hàng theo VietQR, có thể là tên viết tắt (`MB`, `VCB`, `ICB`, `TCB`...) hoặc mã BIN 6 số (`970422`). BE tự chuyển sang chữ hoa. FE nên cho người dùng chọn từ danh sách ngân hàng, ví dụ lấy từ `https://api.vietqr.io/v2/banks` và dùng trường `code`.
- `accountNumber` gồm 6–19 chữ số; khoảng trắng, dấu `.` và `-` được tự bỏ.
- `accountName` được chuyển sang chữ in hoa không dấu (`Nguyễn Văn Đức` → `NGUYEN VAN DUC`), tối đa 50 ký tự.
- `bankName` không bắt buộc, chỉ dùng để hiển thị.
- Response `200`: dữ liệu giống `GET /profile`, kèm `refreshedInvoices` là số hóa đơn chưa thanh toán đã được đổi mã QR.

#### Hóa đơn đang mở được đổi sang tài khoản mới

Webhook SePay chỉ nhận diện chủ trọ theo **số tài khoản hiện tại**. Vì vậy khi đổi tài khoản, BE cập nhật `bankSnapshot` và `vietQrUrl` của các hóa đơn `ISSUED`, `PARTIALLY_PAID` và `UNPAID` còn nợ, trong cùng một transaction. Khách mở link hóa đơn sẽ thấy QR của tài khoản mới.
Các hóa đơn đã thanh toán xong giữ nguyên thông tin ngân hàng cũ để đối soát lịch sử.

#### Bảo mật

- Audit log `CHANGE_BANK_ACCOUNT` chỉ lưu 4 số cuối (`****6789`), vì log này hiển thị cho SUPER_ADMIN. `/users` và `/admin/landlords` không trả thông tin ngân hàng.
- Mỗi tài khoản chỉ được gửi tối đa 10 yêu cầu trong 15 phút, vượt quá → `429 TOO_MANY_REQUESTS`.

#### Mã lỗi

| errorCode | HTTP | Ý nghĩa |
| --- | --- | --- |
| `CURRENT_PASSWORD_INVALID` | 400 | Sai mật khẩu hiện tại |
| `VALIDATION_ERROR` | 400 | Mã ngân hàng, số tài khoản hoặc tên chủ tài khoản không hợp lệ |
| `BANK_ACCOUNT_IN_USE` | 422 | Số tài khoản đã được chủ trọ khác đăng ký (webhook không thể phân biệt hai chủ trọ dùng chung một tài khoản) |
| `FORBIDDEN` | 403 | Người gọi không phải LANDLORD |
| `TOO_MANY_REQUESTS` | 429 | Gửi quá nhiều yêu cầu |

---

<a id="property"></a>

## 3. Property Core — Branch, Room, Contract

Chỉ Backend `/BE`. Prefix `/api/v1`. Operations (Utility Reading, Incident) xem [mục Operations](#operations).

### Branch và Room

- Branch giữ các endpoint CRUD trong API contract. Landlord tạo/sửa/xóa; Manager chỉ xem các cơ sở được gán. Mọi dữ liệu lọc landlord/branch và `isDeleted: false`.
- Tạo Branch/Room có quota và transaction. Thao tác tạo/sửa Room khóa bản ghi Branch để không chạy đua với việc giảm tầng, ngừng hoạt động hoặc xóa Branch.
- Phòng có hợp đồng chưa thanh lý không được xóa hoặc đổi trạng thái. Không được giảm `maxOccupants` dưới số người đang ở.
- Manager chỉ đổi trạng thái giữa `EMPTY`, `CLEANING`, `MAINTENANCE`; không được mở lại phòng `INACTIVE`.
- Room nhận thêm các field tùy chọn `electricityPrice`, `waterPrice`, `waterBillingType`, `services` để đồng bộ cấu hình với Finance. Manager không được sửa các field giá. Nếu không khai báo, dùng giá/dịch vụ Branch. `services: []` nghĩa là không thu dịch vụ cho phòng đó.
- Tên dịch vụ không trùng nhau, không chứa `.` hoặc `$`. Tiền/số lượng là số nguyên không âm. Số phòng đã xóa mềm vẫn được giữ để bảo toàn định danh lịch sử.

### Tạo Contract

`POST /contracts` chỉ dành cho Landlord. Giữ các field request cũ; Tenant mới được tự động cấp tài khoản bằng CCCD trong cùng transaction tạo hợp đồng và chuyển phòng `EMPTY → RENTED`. Không có bước cấp Tenant độc lập.

Thêm field `serviceQuantities` khi phòng/cơ sở có dịch vụ `PER_UNIT`:

```json
{
  "serviceQuantities": { "Giữ xe": 2 }
}
```

Thiếu số lượng của một dịch vụ `PER_UNIT` sẽ bị từ chối trước khi tạo Tenant/hợp đồng. Dữ liệu Tenant/mật khẩu tạm xem [mục Auth & cấp tài khoản](#auth).

### Quyết toán và thanh lý

#### 1. POST /contracts/:contractId/settlement

Bearer token của Landlord sở hữu hợp đồng. Body:

```json
{
  "actualEndDate": "2026-10-14",
  "finalElectricIndex": 120,
  "finalWaterIndex": 12,
  "electricImage": "https://example.com/electric.jpg",
  "waterImage": "https://example.com/water.jpg",
  "deductions": [
    { "reason": "Sửa khóa", "amount": 100000, "evidenceImage": "https://example.com/lock.jpg" }
  ],
  "confirmedByBothParties": true,
  "settlementNotes": "Biên bản trả phòng đã được hai bên xác nhận"
}
```

Backend tạo Invoice `invoiceType: SETTLEMENT` đã phát hành và dùng phần cọc đã nhận để thanh toán các hóa đơn còn nợ theo hạn thanh toán, rồi đến hóa đơn cuối kỳ. Mỗi lần cấn cọc có Payment `paymentMethod: DEPOSIT`, mã tham chiếu duy nhất, người xác nhận và audit. Cọc không được coi là khoản thu tiền mặt mới.

Tạo Invoice, cấn cọc, cập nhật số cuối của Room và chốt biên bản Contract nằm trong cùng transaction. Contract giữ trạng thái đang thuê; `settlement.state = PREPARED`. Room vẫn `RENTED` cho đến khi hoàn tất thanh lý. Trong thời gian này không sửa Room hoặc phát sinh hóa đơn tháng mới cho hợp đồng.

HTTP 200, `data` gồm hợp đồng, `settlement` và `settlementInvoices`. Các field cần FE đọc:

- `settlement.invoiceId`: ID hóa đơn cuối kỳ.
- `settlement.invoiceIds`: các hóa đơn liên quan đến quyết toán.
- `settlement.heldDeposit`, `depositAppliedAmount`, `refundedDepositAmount`: cọc đã nhận, đã cấn và phải hoàn.
- `settlement.remainingDue`: tổng số tiền cần thu thêm hiện tại.
- `settlementInvoices`: số dư từng hóa đơn và thông tin thanh toán.

Gọi lại với `{}` hoặc đúng biên bản đã chốt chỉ đọc lại phiếu/số dư, không tạo Invoice hay cấn cọc lần nữa. Thay nội dung biên bản đã chốt bị từ chối `SETTLEMENT_IMMUTABLE`.

#### 2. Thu phần còn thiếu

Sử dụng API Finance hiện có: `POST /payments/cash`, hoặc chuyển khoản theo Invoice để nhận webhook. Thu đúng `remainingAmount` trên từng hóa đơn chưa trả đủ. Sau khi thanh toán, gọi lại `/settlement` với `{}` hoặc GET chi tiết hợp đồng để xem số dư mới.

Ví dụ cọc 1 triệu, tổng nợ và chi phí 1,5 triệu: backend ghi nhận cấn 1 triệu bằng DEPOSIT; còn 500 nghìn cần thu qua Payment. Các giao dịch/hóa đơn cũ được giữ nguyên.

#### 3. POST /contracts/:contractId/terminate

Sau khi đã lập phiếu và thu đủ, gửi `{}`. Backend kiểm tra số dư từ Invoice trong DB, cập nhật `TERMINATED`, `settlement.state = COMPLETED`, tiền cọc hoàn và trạng thái cọc; Room chuyển `CLEANING`, bỏ `currentContractId`.

`confirmedByBothParties` trong biên bản là xác nhận nghiệm thu và số tiền hoàn cọc; chủ trọ cần thực hiện bàn giao tiền hoàn cho khách theo biên bản trước khi kết thúc luồng.

Để tương thích request cũ, `/terminate` vẫn nhận đầy đủ body biên bản. Nếu cọc đủ, backend có thể lập phiếu và thanh lý trong một transaction. Nếu thiếu, toàn bộ thao tác đó rollback và trả `SETTLEMENT_BALANCE_DUE`; dùng `/settlement` để lập phiếu rồi thu phần thiếu. Không tự kết thúc hợp đồng còn nợ.

### Cách tính

- Điện/nước đồng hồ: lấy số đã lập hóa đơn gần nhất của chính hợp đồng (hoặc số bàn giao), tính phần tiêu thụ chưa lập hóa đơn đến số cuối. Số cuối không được nhỏ hơn số đã ghi nhận.
- Tiền phòng, nước khoán/theo người và dịch vụ: tính theo số ngày ở thực tế trong tháng, gồm ngày trả phòng; dùng lịch Việt Nam UTC+7. Làm tròn mỗi khoản sang VND nguyên.
- Nếu đã có hóa đơn tháng cho hợp đồng ở kỳ đó, không thu lại các khoản định kỳ; chỉ tính điện/nước đồng hồ tăng thêm và khấu trừ có bằng chứng. Hóa đơn đã phát hành được giữ nguyên, không tự sửa/hoàn tiền để tính lại theo ngày.
- Các tháng chưa từng được lập hóa đơn trong thời gian thuê được tổng hợp vào phiếu cuối kỳ; không bỏ sót nợ tiền phòng chưa lập hóa đơn.
- Ưu tiên giá/dịch vụ Room, sau đó Branch. Biên bản đã lập lưu số tiền và đơn giá, không tính lại khi giá Branch thay đổi.
- Hóa đơn nháp phải phát hành/hủy trước khi chốt. Hóa đơn kỳ sau ngày trả phòng hoặc có tiền trả thừa cần được xử lý/đối soát trước; không tự xóa, tự hoàn hoặc bỏ qua giao dịch.
- Cọc dùng hết có `depositStatus: APPLIED`; còn một phần hoàn là `PARTIALLY_REFUNDED`; hoàn toàn bộ là `REFUNDED`.

### Chuyển đổi database cũ

Invoice cần cho phép hóa đơn tháng và quyết toán cùng tháng, đồng thời phân biệt hợp đồng mới khi cùng phòng đổi khách trong tháng. Index mới là `(landlordId, roomId, contractId, billingPeriod, invoiceType)` cho bản ghi chưa xóa.

Với backend đã dừng, chủ dự án cập nhật thủ công database cũ:

1. Gán `invoiceType: MONTHLY` cho Invoice chưa có field này.
2. Tạo unique index `(landlordId, roomId, contractId, billingPeriod, invoiceType)` với partial filter `{ isDeleted: false }`.
3. Sau khi tạo index mới thành công, bỏ unique index cũ `(landlordId, roomId, billingPeriod)`.

Không xóa Invoice/Payment. Cần cập nhật dữ liệu/index cũ trước khi dùng quyết toán. Database mới dùng schema/index mới trực tiếp. Không còn file script migration; agent chưa cập nhật database.

### Kiểm tra thủ công

1. Landlord khác không xem/sửa Branch, Room, Contract; Manager chỉ xem cơ sở được gán và chỉ đổi các trạng thái vận hành.
2. Tạo Room/bulk vượt quota, trùng số phòng, tầng vượt Branch hoặc tạo đồng thời: thất bại phải rollback toàn bộ.
3. Tạo Contract với CCCD mới: nhận mật khẩu tạm một lần; thất bại không để lại Tenant. Dịch vụ PER_UNIT thiếu số lượng phải bị từ chối.
4. Thanh lý ngày 10/10, tiền phòng 3.100.000: kỳ chưa có hóa đơn phải tính 1.000.000. Kiểm tra nước/dịch vụ theo cùng tỷ lệ.
5. Đã lập hóa đơn tháng: không thu lại tiền phòng/dịch vụ, không tính lại số điện/nước đã lập hóa đơn.
6. Cọc đủ nợ: kiểm tra Payment DEPOSIT, số dư Invoice và cọc hoàn; không có giao dịch tiền mặt giả.
7. Cọc thiếu: lập phiếu, thu phần thiếu bằng API Payment, thanh lý. Room chỉ chuyển CLEANING sau khi đã thu đủ.
8. Gọi lại lập phiếu, gọi thanh toán đồng thời hoặc thay biên bản: không cấn cọc hai lần, không tạo phiếu trùng, không sửa phiếu đã chốt.
9. Giảm sức chứa dưới số người đang ở, Manager mở phòng INACTIVE, sửa Room đang quyết toán: bị từ chối.
10. Cập nhật dữ liệu/index trên bản sao database cũ; tạo hợp đồng mới cùng phòng/cùng tháng và kiểm tra hóa đơn không lấy nhầm khách trước.

Không thêm dependency. Chỉ chạy phân tích tĩnh/lint. Automated testing do project owner thực hiện.

---

<a id="operations"></a>

## 4. Operations — Utility Reading & Incident (Dev 2)

Chỉ Backend `/BE`. Prefix `/api/v1`. Mọi response theo format chung `{ success, data, message }`; lỗi `{ success: false, errorCode, message, data }`.
Staff API đã có sẵn ở [mục Auth & cấp tài khoản](#auth).

### 1. Chốt số điện nước (Utility Reading)

Vai trò: `LANDLORD` (mọi cơ sở của mình), `PROPERTY_MANAGER` (chỉ cơ sở được giao). `TENANT` và `SUPER_ADMIN` bị 403.

#### GET /branches/:branchId/utility-readings?billingPeriod=2026-10

Bảng chốt số của một kỳ, dùng cho màn hình nhập 1 tay trên mobile (duyệt lần lượt từng phòng). Bỏ `billingPeriod` thì mặc định lấy kỳ hiện tại theo giờ Việt Nam.
Danh sách gồm các phòng `RENTED`, cộng thêm các phòng đã có bản chốt trong kỳ. Thứ tự sắp xếp: tầng, rồi số phòng.

```json
{
  "billingPeriod": "2026-10",
  "items": [
    {
      "room": { "id": "...", "roomNumber": "A.101", "floor": 1, "status": "RENTED" },
      "waterBillingType": "METER",
      "previousElectricIndex": 100,
      "previousWaterIndex": 10,
      "reading": null
    }
  ],
  "stats": { "total": 12, "recorded": 8, "pending": 4, "billed": 0 }
}
```

`reading` là `null` khi phòng chưa chốt số. Khi đã chốt, `reading` có dạng giống response của POST bên dưới.
`waterBillingType` khác `METER` (`PER_PERSON` / `FIXED`) thì FE có thể ẩn ô nhập nước.

#### POST /utility-readings

```json
{
  "branchId": "...",
  "roomId": "...",
  "billingPeriod": "2026-10",
  "electricNewIndex": 145,
  "waterNewIndex": 24,
  "electricImage": "https://...",
  "waterImage": "https://...",
  "readingDate": "2026-10-01",
  "confirmAbnormal": false
}
```

- Bắt buộc: `branchId`, `roomId`, `billingPeriod`, `electricNewIndex`. Còn `waterNewIndex` chỉ bắt buộc khi tính nước theo đồng hồ (`METER`).
- Chỉ số là số nguyên ≥ 0. Ảnh phải là URL http/https; BE chỉ lưu URL, không nhận file upload.
- Chỉ số cũ do BE tự tính: lấy giá trị lớn hơn giữa chỉ số mới của kỳ liền trước và chỉ số ban đầu ghi trong hợp đồng.
- Phòng phải có hợp đồng đang hiệu lực và chưa ở bước quyết toán. Hợp đồng phải bắt đầu trước khi kỳ đó kết thúc.
- **Cảnh báo tăng đột biến**: BE so mức tiêu thụ kỳ này với trung bình 3 kỳ gần nhất. Nếu vượt quá 2.5 lần, BE trả `409 READING_ABNORMAL_INCREASE` kèm chi tiết:
  ```json
  { "data": { "warnings": [{ "type": "ELECTRIC", "consumed": 200, "average": 50, "ratio": 4 }], "oldElectricIndex": 200, "newElectricIndex": 400, "...": "..." } }
  ```
  FE hiện hộp xác nhận cho người dùng, rồi gửi lại cùng body đó kèm `"confirmAbnormal": true`.
- Response `201`: bản ghi `UtilityReading` gồm `oldElectricIndex`, `newElectricIndex`, `consumedElectric`, `oldWaterIndex`, `newWaterIndex`, `consumedWater` và `isBilled`. Có thêm các trường alias `id`, `electricImage`, `waterImage`, cùng `draftInvoiceId` và `draftInvoiceError` (xem mục Đồng bộ với hóa đơn).
- Ghi số xong, BE cập nhật `Room.currentElectricIndex` / `currentWaterIndex` và ghi audit log.

#### GET /utility-readings/:readingId

Lấy chi tiết một bản chốt số trong phạm vi được phép.

#### PUT /utility-readings/:readingId

Sửa chỉ số nếu nhập nhầm. Body chỉ gồm các field `electricNewIndex`, `waterNewIndex`, `electricImage`, `waterImage`, `readingDate`, `confirmAbnormal`, và field nào cũng có thể bỏ. Chỉ số cũ được giữ nguyên.
Hóa đơn `DRAFT` của kỳ được tính lại tiền điện nước trong cùng transaction. Đơn giá và hạn thanh toán của bản nháp được giữ nguyên.

#### Đồng bộ với hóa đơn

`Chốt số (BE tự tạo DRAFT) → sửa chỉ số nếu cần (DRAFT được tính lại) → POST /invoices/:id/issue`

- Mỗi lần POST hoặc PUT chốt số, BE tự tạo (hoặc tính lại) hóa đơn `MONTHLY` ở trạng thái `DRAFT` cho phòng và kỳ đó, trong cùng transaction với bản chốt. Chủ trọ không cần bấm tạo hóa đơn nữa.
- Hạn thanh toán mặc định của bản nháp mới là ngày hiện tại (giờ Việt Nam) cộng `Branch.paymentDueDays` (mặc định 5 ngày). Chủ trọ đổi hạn bằng `POST /invoices/generate` với `dueDate`; endpoint này vẫn dùng được để tạo hoặc tính lại hàng loạt.
- `draftInvoiceId` là id hóa đơn nháp (`null` nếu kỳ đó đã có hóa đơn không còn ở DRAFT).
- Nếu không tạo được bản nháp, bản chốt **vẫn được lưu**, `draftInvoiceId: null` và `draftInvoiceError: { errorCode, message }`. Ví dụ: hợp đồng không phủ kỳ này (`CONTRACT_NOT_ACTIVE`). Nếu hóa đơn kỳ đó đã bị hủy, BE tạo một bản nháp mới thay thế. FE nên hiện thông báo này cho người dùng.
- Manager chốt số vẫn tạo được bản nháp, nhưng không xem được hóa đơn (quyền tài chính chỉ thuộc chủ trọ).

Khi phát hành hóa đơn, `isBilled = true` và bản chốt bị khóa: mọi lần sửa sau đó trả `409 READING_ALREADY_BILLED`.

#### Mã lỗi

| errorCode | HTTP | Ý nghĩa |
| --- | --- | --- |
| `READING_LOWER_THAN_PREVIOUS` | 400 | Chỉ số mới nhỏ hơn chỉ số cũ |
| `READING_PERIOD_INVALID` | 400 / 422 | Kỳ ở tương lai, hoặc hợp đồng chưa bắt đầu trong kỳ |
| `READING_ABNORMAL_INCREASE` | 409 | Tiêu thụ > 2.5 lần trung bình; cần gửi `confirmAbnormal: true` |
| `READING_ALREADY_BILLED` | 409 | Đã phát hành hóa đơn, không sửa được |
| `READING_ALREADY_EXISTS` | 422 | Phòng đã chốt kỳ này, dùng PUT để sửa |
| `READING_PERIOD_CONFLICT` | 422 | Đã có bản chốt kỳ sau: không chốt bổ sung hay sửa kỳ trước được |
| `CONTRACT_NOT_ACTIVE` / `CONTRACT_SETTLEMENT_PENDING` | 422 | Phòng không có hợp đồng hợp lệ / đang quyết toán |
| `BRANCH_SCOPE_FORBIDDEN` | 403 | Manager thao tác ngoài cơ sở được giao |

### 2. Sự cố (Incident)

Luồng trạng thái:

```text
PENDING ──> IN_PROGRESS ──> SOLVED ──> CLOSED
   │                          │
   └──> REJECTED              └──> IN_PROGRESS (mở lại)
```

| Vai trò | Xem | Tạo | Đổi trạng thái | Ghi chi phí |
| --- | --- | --- | --- | --- |
| LANDLORD | Toàn chuỗi | Mọi phòng | Có | Có, gồm cả `costPayer: TENANT` |
| PROPERTY_MANAGER | Cơ sở được giao | Phòng trong cơ sở được giao | Có | Chỉ `LANDLORD` / `NONE` |
| TENANT | Sự cố mình báo hoặc thuộc hợp đồng của mình | Phòng mình đang thuê | Không | Không |

#### GET /incidents?branchId=&roomId=&status=&priority=&page=1&limit=20

Response: `{ items, total, page, limit, stats: { PENDING: 3, IN_PROGRESS: 1, ... } }`. `stats` được tính theo cùng bộ lọc.
Mỗi item đã populate sẵn `roomId { roomNumber, floor }`, `branchId { name }`, `reportedBy { name, role }`, `assignedTo { name, role }`.

#### GET /incidents/:incidentId

Chi tiết một sự cố, populate giống như ở danh sách, kèm `statusHistory: [{ status, changedBy, changedAt, note }]`.

#### POST /incidents

```json
{
  "branchId": "...",
  "roomId": "...",
  "title": "Hỏng vòi nước",
  "description": "Vòi bồn rửa bị rò rỉ",
  "images": ["https://..."],
  "priority": "HIGH"
}
```

- Tenant không cần gửi `branchId`. Chỉ khi đang thuê nhiều phòng thì phải gửi `roomId`.
- Landlord và Manager bắt buộc gửi `branchId` và `roomId`.
- `priority` nhận `LOW | MEDIUM | HIGH | URGENT`, mặc định `MEDIUM`. `images` tối đa 10 URL.
- BE tự gắn `contractId` theo hợp đồng hiện tại của phòng, dùng khi cần khấu trừ cọc.

#### PUT /incidents/:incidentId/status

```json
{ "status": "IN_PROGRESS", "note": "Đã gọi thợ", "assignedTo": "userId", "resolvedImages": ["https://..."] }
```

- Sai luồng trạng thái → `422 INCIDENT_INVALID_TRANSITION`.
- `REJECTED` bắt buộc có `note` (lý do).
- `SOLVED` cần ít nhất 1 ảnh nghiệm thu trong `resolvedImages`, nếu thiếu → `400 INCIDENT_EVIDENCE_REQUIRED`.
- `CLOSED` cần đã ghi nhận chi phí qua API cost bên dưới, nếu chưa → `422 INCIDENT_COST_REQUIRED`.
- `assignedTo` phải là chủ trọ hoặc một manager được giao cơ sở đó. Khi chuyển sang `IN_PROGRESS` mà không gửi `assignedTo`, BE gán người đang thao tác.

#### PUT /incidents/:incidentId/cost

```json
{ "repairCost": 200000, "costPayer": "TENANT", "note": "Khách làm vỡ" }
```

- `repairCost` là số nguyên VND ≥ 0. `costPayer` nhận `LANDLORD | TENANT | NONE`. Nếu `repairCost > 0` thì không được chọn `NONE`.
- Chỉ ghi được khi sự cố đang `IN_PROGRESS` hoặc `SOLVED`, ngoài ra → `422 INCIDENT_COST_LOCKED`.
- `TENANT` chịu phí: chỉ Landlord được chọn, và sự cố phải gắn với một hợp đồng.

Mọi thao tác tạo, đổi trạng thái và ghi chi phí đều được ghi audit log.

---

<a id="finance"></a>

## 5. Backend Finance

Phạm vi: Invoice, Payment, thu tiền mặt, hóa đơn công khai và đối soát chuyển khoản chưa khớp. Không có thay đổi frontend.

### Chạy backend

Yêu cầu Node.js >= 22 và MongoDB Atlas hoặc MongoDB replica set. Không có fallback ghi tài chính ngoài transaction.

```powershell
cd BE
npm install
# Tạo .env theo .env.example; cấu hình MONGO_URI, JWT_SECRET, CLIENT_URL và SePay.
npm run dev
npm run lint
```

Backend được khởi tạo trực tiếp trong `server.js`; các route được gắn qua `routes/index.js`. `npm run lint` chỉ phân tích tĩnh bằng kiểm tra cú pháp và Oxlint. Chế độ dev dùng `node --watch`. Chủ dự án trực tiếp thực hiện kiểm thử và xác nhận tích hợp; agent không chạy test hoặc tự bật server để kiểm thử.

### Checklist kiểm thử thủ công dành cho chủ dự án

1. Khởi động backend bằng `npm start`: server kết nối MongoDB, khởi tạo index và mở cổng đã cấu hình.
2. Tạo rồi phát hành hóa đơn bằng tài khoản LANDLORD: tổng tiền đúng theo điện/nước/dịch vụ; reading chuyển `isBilled=true` và có VietQR.
3. Thu tiền mặt một phần rồi thu phần còn lại: trạng thái lần lượt `PARTIALLY_PAID` và `PAID`; biên lai trùng bị từ chối.
4. Gửi webhook SePay hợp lệ hai lần với cùng mã giao dịch: chỉ ghi nhận một Payment; lần gửi lại trả thành công với `duplicate=true`.
5. Mở Public Invoice: tên và SĐT được che; không có CCCD; hóa đơn DRAFT/CANCELLED không truy cập được.
6. Dùng tài khoản chủ trọ khác để đọc hóa đơn hoặc thanh toán: không nhận được dữ liệu ngoài phạm vi sở hữu.

Index mới `{landlordId, roomId, billingPeriod}` unique với `isDeleted: false` bảo đảm mỗi phòng/kỳ có một hóa đơn. Nếu database cũ có bản ghi trùng, cần đối soát trước khi tạo index; không tự xóa hóa đơn. `PaymentReceipt` dành riêng để giữ reference duy nhất xuyên suốt CASH, Payment và UnmatchedPayment.

### Auth và quyền

API riêng nhận `Authorization: Bearer <access-token>`. Middleware kiểm tra HS256 bằng `JWT_SECRET`, thời hạn tối đa 15 phút từ `iat`, `exp` bắt buộc, user đang ACTIVE và chưa xóa. ID lấy từ `sub`, `id` hoặc `_id`. Nếu token có `type`, giá trị phải là `access`. Role và phạm vi được đọc từ database, không tin role/landlordId do client gửi. Không hỗ trợ bypass header.

Module không tạo endpoint đăng nhập/refresh: Dev 1 cung cấp Auth theo contract chung. Khi tích hợp, dùng cùng `JWT_SECRET` hoặc thay middleware bằng middleware Auth chính của nhóm.

- LANDLORD: đọc và thao tác tài chính trong chuỗi của mình.
- TENANT: chỉ đọc hóa đơn đã phát hành và lịch sử thanh toán của mình.
- PROPERTY_MANAGER và SUPER_ADMIN: không được gọi API tiền phòng.
- Public Invoice và webhook dùng cơ chế xác thực riêng bên dưới.

CRUD `/api/users` có sẵn được bảo vệ bằng Auth + SUPER_ADMIN để người ngoài không thể đổi role hoặc bank config bằng route mẫu. Các API tài khoản hoàn chỉnh thuộc Dev 1.

### API

Prefix: `/api/v1`.

| Method | Endpoint | Quyền | Chức năng |
|---|---|---|---|
| GET | `/invoices` | Landlord/Tenant | Lọc `branchId`, `billingPeriod`, `status`, `page`, `limit` |
| POST | `/invoices/generate` | Landlord | Tạo hoặc cập nhật nháp theo kỳ |
| GET | `/invoices/:invoiceId` | Landlord/Tenant | Chi tiết hóa đơn trong scope |
| POST | `/invoices/:invoiceId/issue` | Landlord | Tính lại nháp theo reading hiện tại, chốt reading, phát hành QR |
| POST | `/invoices/:invoiceId/cancel` | Landlord | Hủy hóa đơn chưa thu tiền, bắt buộc `reason`. Bản chốt số của kỳ được mở khóa (`isBilled: false`) để sửa và lập hóa đơn mới |
| GET | `/invoices/public/:publicAccessToken` | Công khai | Chỉ hóa đơn đã phát hành; che tên/SĐT, loại bỏ CCCD/email/contract/raw webhook |
| GET | `/invoices/:invoiceId/payments` | Landlord/Tenant | Lịch sử thanh toán hóa đơn |
| POST | `/payments/cash` | Landlord | Xác nhận thu tiền mặt |
| POST | `/payments/webhook` | SePay | Nhận chuyển khoản; trả 200 khi xử lý xong, trùng hoặc lưu unmatched |
| GET | `/payments` | Landlord/Tenant | Lọc `branchId`, `paymentMethod`, `page`, `limit` |
| GET | `/payments/:paymentId` | Landlord/Tenant | Chi tiết thanh toán; không trả raw webhook |
| GET | `/payments/unmatched` | Landlord | Danh sách giao dịch chưa đối soát; lọc `status` |
| POST | `/payments/unmatched/:unmatchedPaymentId/resolve` | Landlord | Gán giao dịch vào hóa đơn bằng `invoiceId` |

`page` mặc định 1, `limit` mặc định 20, tối đa 100. Response danh sách có `{success, data, pagination: {page, limit, total}}`. Response lỗi có `{success: false, errorCode, message, data: null}`.

#### Tạo hóa đơn

```json
{
  "branchId": "<ObjectId>",
  "billingPeriod": "2026-10",
  "dueDate": "2026-10-05",
  "roomIds": ["<ObjectId>"]
}
```

Bỏ `roomIds` để lấy các phòng RENTED trong cơ sở; tối đa 500 phòng/lần. Mỗi phòng phải có hợp đồng hiện tại hợp lệ và reading đúng kỳ. Cả batch nằm trong một transaction. Gọi lại cập nhật DRAFT; các hóa đơn đã phát hành được trả lại nguyên trạng; hóa đơn CANCELLED được giữ làm lịch sử, và kỳ đó được lập một hóa đơn DRAFT mới thay thế.

Tiền phòng là tiền thuê tháng đầy đủ theo hợp đồng (chưa chia theo ngày vào/ra phòng). Điện tính theo chỉ số; nước hỗ trợ METER/PER_PERSON/FIXED. Số người = người ký + roommates. Dịch vụ PER_UNIT lấy số lượng từ `Contract.serviceQuantities`, ví dụ `{"Gửi xe": 2}`; thiếu số lượng sẽ báo lỗi. Room có thể ghi đè `electricityPrice`, `waterPrice`, `waterBillingType`, `services`; nếu `services` không có thì dùng cấu hình cơ sở, nếu là `[]` thì không tính dịch vụ. Các khoản tiền là số nguyên VND; tiêu thụ điện/nước có thể thập phân và tiền được làm tròn đến VND.

Đơn giá, tiền thuê và đơn giá dịch vụ được chụp tại lần tạo nháp đầu tiên, không tự đổi khi chỉnh cấu hình cơ sở. Khi phát hành, reading được tính lại và `isBilled=true` trong cùng transaction. API không cho sửa tiền trực tiếp trên hóa đơn đã phát hành hoặc đã thanh toán. QR có số tiền còn nợ và nội dung `<invoiceCode> P<roomNumber>`. Tài khoản ngân hàng được snapshot để giữ nguyên thông tin hóa đơn đã phát hành.

#### Thu tiền mặt

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

`invoiceId`, `amount`, `receiptNumber`, `transactionDate` bắt buộc. `amount` phải là số nguyên dương; ngày thu không được ở tương lai. Server gán `confirmedBy` và ghi audit `CONFIRM_CASH_PAYMENT`. Số biên lai là duy nhất trong phạm vi tiền mặt của từng chủ trọ: hai chủ trọ có thể cùng dùng `PT001`, và số biên lai không xung đột với mã giao dịch ngân hàng.

Payment + Invoice + AuditLog + PaymentReceipt được ghi chung một transaction. Thanh toán thiếu chuyển PARTIALLY_PAID; đủ chuyển PAID; thừa chuyển OVERPAID và ghi `overpaidAmount`. PAID/OVERPAID không nhận thêm thu tiền mặt. Tiền thừa được ghi nhận để đối soát; ví dư và tự động khấu trừ kỳ sau chưa nằm trong API contract MVP này.

#### SePay

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

Ngày SePay không có timezone được hiểu là giờ Việt Nam (+07:00). `id` và `referenceCode` dùng để chống trùng; `referenceCode` là duy nhất theo từng chủ trọ; payload đổi số tiền/reference trên receipt đã có sẽ bị từ chối. Tài khoản nhận phải khớp chính xác một LANDLORD (chưa xóa). Nếu chủ trọ đang bị khóa, tiền vẫn được ghi vào UnmatchedPayment kèm ghi chú, để chủ trọ đối soát sau khi được mở khóa. Không suy ra chủ trọ từ invoiceCode hoặc header client. Nếu nhiều chủ trọ dùng cùng số tài khoản, backend từ chối vì không xác định được scope.

invoiceCode được nhận diện cả khi ngân hàng bỏ dấu cách (`HD...PA101`); mã hóa đơn của chủ trọ khác bị bỏ qua. Không tìm thấy một invoiceCode rõ ràng (hoặc có nhiều mã), invoiceCode thuộc chủ khác, hóa đơn nháp/hủy/đã thanh toán: tiền được giữ trong UnmatchedPayment, không tự gạch nợ. Giao dịch `out` được bỏ qua. Gán unmatched vào hóa đơn dùng transaction và audit `RESOLVE_UNMATCHED_PAYMENT`; gán lần hai bị từ chối. Webhook trùng trả HTTP 200, không tạo Payment/Audit/event thứ hai.

Rate limit: public invoice 60 request/phút/IP; webhook 120 request/phút/IP. Bộ đếm ở memory của từng backend instance; khi scale nhiều instance cần shared store. Nếu chạy sau reverse proxy, cấu hình Express `trust proxy` đúng số hop của hạ tầng trước khi dùng IP của khách.

Tham khảo chính thức: [payload SePay](https://developer.sepay.vn/vi/sepay-webhooks/tich-hop-webhook), [xác thực SePay](https://developer.sepay.vn/vi/sepay-webhooks/xac-thuc), [transaction Mongoose](https://mongoosejs.com/docs/transactions.html).

### Điểm tích hợp cho các developer khác

- Dev 1: Auth token/middleware; hợp đồng phải set `Room.currentContractId`, `tenantId`, `serviceQuantities` và scope đúng.
- Dev 2: reading dùng field model `oldElectricIndex`, `newElectricIndex`, `oldWaterIndex`, `newWaterIndex`; chỉ sửa khi `isBilled=false`. Sau lưu reading, có thể gọi `generateInvoices` trong luồng nghiệp vụ riêng để đồng bộ DRAFT. Backend hiện cung cấp endpoint generate, chưa gắn tự động vào utility API chưa tồn tại.
- Dev 4: gắn Socket.io bằng `app.set('io', io)`. Controller phát `payment:success` sau commit; phát thêm `invoice_paid` khi PAID/OVERPAID. Rooms và payload theo contract chung. Dev 4 kiểm tra quyền khi join rooms. Finance không khởi tạo Socket.io server. Thất bại phát event không rollback giao dịch đã commit; đối soát bằng GET API.
- Gửi link hóa đơn qua SMS/Zalo/Email và frontend `/i/:token` thuộc phần tích hợp khác; API Finance chỉ trả token/dữ liệu công khai.
- Không có API xóa Payment, sửa tiền Invoice đã thanh toán, adjustment/refund hoặc tự thu SaaS. Tiền thuê và doanh thu phần mềm vẫn tách biệt.

---

<a id="bankhub"></a>

## 6. SePay Bank Hub — Chủ trọ liên kết tài khoản nhận tiền

Chỉ Backend `/BE`. Prefix `/api/v1`.

- **Chủ trọ** tự liên kết tài khoản ngân hàng của mình qua SePay Bank Hub (giao diện iframe do SePay cung cấp). Mọi biến động số dư được SePay báo về `/bank-hub/ipn` và tự động gạch nợ hóa đơn.
- **Admin** thu tiền gói SaaS qua cổng thanh toán SePay riêng của nền tảng. Phần đó không dùng Bank Hub và không nằm trong tài liệu này.
- Đang chạy ở **sandbox**. Backend không cấu hình sẵn tài khoản test nào: chủ trọ tự nhập tài khoản test trong iframe sandbox.

### 1. Cài đặt

Trong `BE/.env` (tham khảo `.env.example`):

```env
SEPAY_BANKHUB_ENV=sandbox                 # sandbox | production
SEPAY_BANKHUB_CLIENT_ID=...               # SePay cấp
SEPAY_BANKHUB_CLIENT_SECRET=...           # SePay cấp, chỉ nằm ở backend
SEPAY_BANKHUB_IPN_API_KEY=...             # API key SePay dùng khi gọi IPN biến động số dư
SEPAY_BANKHUB_WEBHOOK_SECRET=...          # chuỗi ngẫu nhiên 32-64 ký tự, cho webhook sự kiện liên kết
SEPAY_BANKHUB_REDIRECT_URI=               # tùy chọn; production bắt buộc HTTPS
```

Nếu chưa đặt client id/secret, các API của chủ trọ trả `503 BANKHUB_NOT_CONFIGURED`. Nếu chưa đặt khóa IPN hoặc secret webhook, endpoint tương ứng trả `503 WEBHOOK_NOT_CONFIGURED`.

SePay chỉ gọi được URL **HTTPS công khai**. Khi chạy local, mở tunnel (ví dụ `ngrok http 5000`), rồi:

1. **IPN biến động số dư:** gửi SePay URL `https://<domain>/api/v1/bank-hub/ipn`. SePay sẽ gửi header `Authorization: Apikey <SEPAY_BANKHUB_IPN_API_KEY>`.
2. **Webhook sự kiện liên kết/hủy liên kết:** đăng ký một lần bằng API Bank Hub `POST /v1/webhook`:

   ```json
   {
     "webhook_url": "https://<domain>/api/v1/bank-hub/events",
     "auth_type": "SECRET_KEY",
     "secret_key": "<SEPAY_BANKHUB_WEBHOOK_SECRET>",
     "active": 1,
     "allow_events": ["BANK_ACCOUNT_LINKED", "BANK_ACCOUNT_UNLINKED", "BANK_ACCOUNT_INACTIVATED"]
   }
   ```

Webhook sự kiện là kênh dự phòng: FE vẫn gọi `POST /bank-hub/sync` ngay khi iframe báo hoàn tất, nên không bắt buộc phải có webhook.

### 2. API cho chủ trọ (`LANDLORD`)

| Method | Endpoint | Mô tả |
| --- | --- | --- |
| GET | `/bank-hub` | Trạng thái: `{ configured, environment, companyXid, linked, bankAccountXid, linkedAt, bankAccount }`. |
| POST | `/bank-hub/link-token` | Body `{ "purpose": "LINK" }` (mặc định) hoặc `{ "purpose": "UNLINK" }`. Trả `{ purpose, hostedLinkUrl, linkTokenXid, expiresAt }`. |
| POST | `/bank-hub/sync` | Đọc lại tài khoản đang hoạt động từ Bank Hub, gán làm tài khoản nhận tiền và cập nhật QR của các hóa đơn còn nợ (`refreshedInvoices`). |

Luật nghiệp vụ:

- Lần đầu tạo link, backend tự tạo một "công ty" Bank Hub cho chủ trọ (`full_name` = tên + id chủ trọ) và lưu `companyXid`.
- `LINK` cần gói đang hiệu lực (gói nào cũng được); nếu không có → `403 FEATURE_NOT_IN_PLAN`. Đã liên kết rồi → `422 BANK_HUB_LINKED`. `UNLINK` khi chưa liên kết → `422 BANK_HUB_NOT_LINKED`.
- Link token chỉ dùng **một lần** và có hạn (`expiresAt`); mỗi lần mở iframe cần gọi lại API này.
- Tài khoản liên kết trở thành `bankConfig`:
  - `bankCode` = mã BIN 6 số (VietQR chấp nhận).
  - `bankName` = tên ngân hàng (`brand_name`).
  - `accountName` = tên chủ tài khoản, in hoa không dấu.
- Số tài khoản đã thuộc chủ trọ khác → `422 BANK_ACCOUNT_IN_USE`.
- Khi đang liên kết, `PUT /profile/bank-account` bị chặn (`422 BANK_HUB_LINKED`): muốn đổi tài khoản thì hủy liên kết trước. `GET /profile` có thêm `bankHubLinked`.

### 3. Tích hợp FE (iframe)

```jsx
const { hostedLinkUrl } = await bankHubApi.createLinkToken({ purpose: "LINK" });
// <iframe src={hostedLinkUrl} allow="clipboard-write" style={{ width: "100%", height: 600 }} />

useEffect(() => {
  const allowed = new URL(hostedLinkUrl).origin; // sandbox/production có thể khác domain
  const onMessage = async (event) => {
    if (event.origin !== allowed) return;
    switch (event.data?.event) {
      case "FINISHED_BANK_ACCOUNT_LINK":
      case "FINISHED_BANK_ACCOUNT_UNLINK":
        await bankHubApi.sync(); // POST /bank-hub/sync, rồi tải lại trạng thái
        break;
      case "BANKHUB_TOKEN_EXPIRED":
      case "BANKHUB_SESSION_EXPIRED":
        // tạo link token mới
        break;
      case "BANKHUB_CLOSE_LINK":
        // người dùng đóng iframe
        break;
    }
  };
  window.addEventListener("message", onMessage);
  return () => window.removeEventListener("message", onMessage);
}, [hostedLinkUrl]);
```

Không tin `metadata` trong postMessage để hiển thị số tài khoản: luôn lấy kết quả từ `POST /bank-hub/sync` hoặc `GET /bank-hub`.

### 4. Endpoint cho SePay gọi

#### POST /bank-hub/ipn — biến động số dư

Header: `Authorization: Apikey <SEPAY_BANKHUB_IPN_API_KEY>`. Payload theo tài liệu Bank Hub: `gateway`, `transaction_date`, `account_number`, `bank_account_xid`, `content`, `transfer_type`, `amount`, `reference_code`, `transaction_id`...

- `transfer_type: "debit"` → bỏ qua.
- Chủ trọ được xác định theo `bank_account_xid` (nếu không có thì theo `account_number`).
- Chống trùng theo `transaction_id`: SePay gửi lại cùng giao dịch thì trả `duplicate: true` và không tạo thanh toán thứ hai. Khi `reference_code` là `null`, mã giao dịch được lưu là `BH-<transaction_id>`.
- Phần gạch nợ dùng chung logic với webhook SePay hiện có:
  - Nhận diện mã hóa đơn `HD...` trong nội dung, kể cả khi ngân hàng bỏ dấu cách.
  - Không khớp hóa đơn, chủ trọ bị khóa, hoặc không có gói hiệu lực → tiền được giữ ở **giao dịch chưa đối soát**.
- Response: `{ "success": true, "duplicate": false, "unmatched": false, "ignored": false }`.

#### POST /bank-hub/events — sự kiện liên kết

Header: `X-Secret-Key: <SEPAY_BANKHUB_WEBHOOK_SECRET>`.

- `BANK_ACCOUNT_LINKED` → backend đọc lại tài khoản từ Bank Hub để biết `company_xid`, rồi đồng bộ cho chủ trọ tương ứng.
- `BANK_ACCOUNT_UNLINKED` / `BANK_ACCOUNT_INACTIVATED` → bỏ liên kết. `bankConfig` được giữ lại để QR cũ vẫn trỏ đúng tài khoản, nhưng không còn tự động gạch nợ.
- Các sự kiện khác → `{ "success": true, "ignored": true }`.
- Mọi thay đổi được ghi audit log với `actorRole: SYSTEM` và số tài khoản đã che (`****7777`).

---

<a id="dashboard-realtime"></a>

## 7. Dashboard chủ trọ & Realtime (Dev 4)

Chỉ Backend `/BE`. Prefix `/api/v1`. Phần admin nền tảng (gói, chủ trọ, thuê bao, hóa đơn SaaS, analytics) xem [mục Admin nền tảng](#admin) và [mục Gói SaaS](#plans).

### 1. Dashboard chủ trọ ("3-Second Dashboard")

Chỉ `LANDLORD` gọi được. `PROPERTY_MANAGER` nhận 403 vì không được xem doanh thu tổng.
`branchId` là tùy chọn; truyền cơ sở không thuộc chủ trọ thì nhận 404. FE nên gọi hai API này thay cho việc tự tính từ danh sách (hiện bị giới hạn 100 bản ghi).

#### GET /dashboard/stats?branchId=&billingPeriod=2026-10

Bỏ `billingPeriod` thì mặc định là kỳ hiện tại (giờ Việt Nam).

```json
{
  "billingPeriod": "2026-10",
  "branchId": null,
  "collection": {
    "expectedAmount": 10000000,
    "collectedAmount": 7500000,
    "collectionRate": 75,
    "outstandingAmount": 2500000,
    "overpaidAmount": 0,
    "invoiceCount": 20,
    "paidInvoiceCount": 15,
    "receivedAmount": 8200000,
    "receivedByMethod": { "BANK_TRANSFER": 6000000, "CASH": 2200000 }
  },
  "debts": { "roomCount": 2, "invoiceCount": 3, "overdueCount": 2, "totalAmount": 2500000, "items": [] },
  "occupancy": {
    "totalRooms": 20, "rentedRooms": 16, "rate": 80,
    "byStatus": { "RENTED": 16, "EMPTY": 2, "MAINTENANCE": 1, "CLEANING": 1 }
  },
  "contracts": { "live": 16, "expiringSoon": 2, "expired": 0 }
}
```

| Nhóm | Cách tính |
| --- | --- |
| `collection.expectedAmount` / `collectedAmount` | Tổng tiền và số đã thu của các hóa đơn **thuộc kỳ** `billingPeriod` đã phát hành (không tính DRAFT/CANCELLED). Phần trả thừa không cộng vào số đã thu mà nằm ở `overpaidAmount`. |
| `collection.receivedAmount` | Dòng tiền **thực nhận trong tháng** (thanh toán `SUCCESS` có ngày giao dịch trong tháng đó), bất kể trả cho kỳ nào. Trả lời câu hỏi "tháng này thu được bao nhiêu". |
| `debts` | Mọi hóa đơn còn nợ (`ISSUED / PARTIALLY_PAID / UNPAID`), **không giới hạn theo kỳ**. `items` chỉ lấy 10 khoản quá hạn lâu nhất; danh sách đủ ở `/dashboard/debts`. |
| `occupancy` | Phòng chưa xóa và không `INACTIVE`. `rate = RENTED / tổng × 100`, làm tròn 2 chữ số. |
| `contracts.expiringSoon` | Hợp đồng còn hiệu lực sẽ hết hạn trong 30 ngày tới. |

#### GET /dashboard/debts?branchId=

```json
{
  "roomCount": 2, "invoiceCount": 3, "overdueCount": 2, "totalAmount": 2500000,
  "items": [{
    "invoiceId": "...", "invoiceCode": "HD202610...", "billingPeriod": "2026-10", "status": "PARTIALLY_PAID",
    "room": { "id": "...", "roomNumber": "P.101", "floor": 1 },
    "branch": { "id": "...", "name": "Cơ sở Vườn Xanh" },
    "tenant": { "id": "...", "name": "Nguyễn Văn A", "phoneNumber": "0912..." },
    "totalAmount": 3850000, "paidAmount": 1000000, "remainingAmount": 2850000,
    "dueDate": "...", "overdueDays": 5,
    "publicPath": "/i/<token>",
    "reminderMessage": "Chào Nguyễn Văn A, phòng P.101 còn 2.850.000đ tiền phòng kỳ 10/2026 (đã quá hạn 5 ngày). Anh/chị vui lòng thanh toán qua link: http://localhost:5173/i/<token>. Cảm ơn anh/chị!"
  }]
}
```

Danh sách sắp theo số ngày quá hạn giảm dần, rồi theo số tiền nợ. `reminderMessage` dùng cho nút **"Sao chép tin nhắn nhắc nợ gửi Zalo"**; link trong tin nhắn lấy theo `CLIENT_URL`.

### 2. Realtime (Socket.io)

Socket.io gắn vào cùng server HTTP với API (cổng `PORT`), CORS theo `CLIENT_URL`. FE cài `socket.io-client@4`.

```js
import { io } from "socket.io-client";
const socket = io(import.meta.env.VITE_SOCKET_URL || "http://localhost:5000", {
  auth: { token: accessToken }, // bỏ trống cho trang hóa đơn công khai /i/:token
  transports: ["websocket"],
});
socket.on("connect_error", (err) => {
  // err.message === "AUTH_REQUIRED" → làm mới token rồi kết nối lại
});
```

- Token là access token 15 phút như REST API. Sai token → `connect_error` với `AUTH_REQUIRED`. Tài khoản chưa đổi mật khẩu tạm → `PASSWORD_CHANGE_REQUIRED`. Khi token được làm mới, FE gán `socket.auth.token` mới rồi gọi `socket.connect()` lại.
- Không gửi token vẫn kết nối được, nhưng chỉ dùng được `invoice:subscribe_public`.

#### Room

| Room | Ai vào | Cách vào |
| --- | --- | --- |
| `landlord:<landlordId>` | Chủ trọ | Tự động khi kết nối |
| `branch:<branchId>` | Quản lý được phân công cơ sở đó | Tự động khi kết nối |
| `invoice:<invoiceId>` | Người xem hóa đơn | `socket.emit("invoice:subscribe", { invoiceId }, ack)` (đã đăng nhập, hóa đơn trong phạm vi của mình) hoặc `socket.emit("invoice:subscribe_public", { token }, ack)` (trang `/i/:token`, token là `publicAccessToken`) |

`ack` nhận `{ ok: true, ... }` hoặc `{ ok: false, message: "RESOURCE_NOT_FOUND" | "AUTH_REQUIRED" | "INVALID_ID" | "FORBIDDEN" }`. Rời room: `socket.emit("invoice:unsubscribe", { invoiceId })`.

#### Sự kiện (chỉ phát **sau khi transaction đã commit**)

| Sự kiện | Gửi tới | Payload | Khi nào |
| --- | --- | --- | --- |
| `payment:success` | `landlord:*`, `branch:*`, `invoice:*` của hóa đơn | `{ invoiceId, paymentId, paidAmount, remainingAmount, status }` | Thanh toán `SUCCESS`: chủ trọ thu tiền mặt, duyệt báo cáo tiền mặt của quản lý, webhook SePay, IPN Bank Hub, gán giao dịch chưa đối soát |
| `invoice_paid` | như trên | như trên | Khi hóa đơn chuyển sang `PAID` / `OVERPAID` |
| `incident:created` | `landlord:*`, `branch:*` | `{ incidentId, branchId, roomId, title, priority, status }` | Có sự cố mới |
| `incident:updated` | như trên | như trên | Sự cố đổi trạng thái |

- Báo cáo tiền mặt của quản lý (`PENDING_CONFIRMATION`) **không** phát `payment:success`; sự kiện chỉ phát khi chủ trọ duyệt.
- Payload không chứa thông tin cá nhân hay ngân hàng, nên an toàn cho trang công khai.
- FE coi sự kiện là tín hiệu để **tải lại dữ liệu** (dashboard, chi tiết hóa đơn), không thay cho kết quả REST.

### 3. Bổ sung cho analytics admin

`GET /admin/analytics` trả thêm `saas.overdueInvoices`: tối đa 20 hóa đơn SaaS quá hạn, quá hạn lâu nhất đứng trước. Mỗi dòng gồm `{ invoiceId, invoiceCode, amount, dueDate, overdueDays, landlord { id, name, email, phoneNumber, status }, plan { code, name } }`. Đây là danh sách "chuỗi trọ chậm thanh toán SaaS" theo PROJECT_RULES §3.1.

---

<a id="plans"></a>

## 8. Bảng gói SaaS cho chủ trọ

Chỉ Backend `/BE`. Prefix `/api/v1`. Dùng thay cho mảng `SAAS_PLANS_DATA` đang viết cứng trong `FE/src/features/plans/SaaSPlansModal.jsx`.

### GET /plans

Chỉ `LANDLORD` gọi được: chưa đăng nhập → 401, vai trò khác → 403. Admin quản lý gói qua `/admin/plans`.
API trả các gói đang bán (`isActive: true`, chưa xóa) trong DB, sắp theo giá tăng dần. Mỗi khi Admin sửa giá, giới hạn hoặc tính năng, FE sẽ thấy ngay lần gọi tiếp theo.

```json
{
  "current": {
    "id": "...", "status": "ACTIVE", "startDate": "...", "endDate": "2026-11-18T00:00:00.000Z",
    "plan": { "id": "...", "code": "FREE_TRIAL", "name": "Gói Dùng Thử", "maxBranches": 1, "maxRooms": 5, "maxManagers": 1 }
  },
  "pending": null,
  "usage": {
    "branches": { "used": 1, "limit": 1 },
    "rooms": { "used": 4, "limit": 5 },
    "managers": { "used": 0, "limit": 1 }
  },
  "items": [
    {
      "id": "...",
      "code": "STARTER",
      "name": "Gói Starter (Chuỗi nhỏ)",
      "price": 199000,
      "billingCycle": "MONTHLY",
      "maxBranches": 1,
      "maxRooms": 20,
      "maxManagers": 2,
      "features": ["Tự động hóa tính toán tiền phòng", "..."],
      "isCurrent": false,
      "isPending": false,
      "selectable": true,
      "blockedBy": []
    }
  ]
}
```

| Trường | Ý nghĩa |
| --- | --- |
| `current` | Gói đang có hiệu lực, cùng nguồn với kiểm tra quota. `null` khi đã hết hạn hoặc chưa có thuê bao. |
| `pending` | Gói Admin đã tạo nhưng đang chờ thanh toán hóa đơn SaaS. |
| `usage.*.used` | Số cơ sở, phòng hoặc quản lý đang dùng, đếm đúng như khi chặn quota (tính cả phòng `INACTIVE`, không tính bản ghi đã xóa). |
| `usage.*.limit` | Giới hạn của gói hiện tại; `null` khi không có gói hiệu lực. |
| `items[].isCurrent` / `isPending` | Gói đang dùng / gói đang chờ thanh toán. Dùng để hiện nhãn "Đang sử dụng" / "Chờ thanh toán". |
| `items[].blockedBy` | Những giới hạn của gói nhỏ hơn mức đang dùng, ví dụ `["maxRooms"]`. Admin không đổi được sang gói này (`PLAN_QUOTA_BELOW_USAGE`). |
| `items[].selectable` | `false` với gói dùng thử (chỉ cấp khi đăng ký) hoặc khi `blockedBy` không rỗng. |
| `items[].trialDays` | Chỉ có ở gói `FREE_TRIAL`. |
| `items[].features` | Danh sách tính năng chung, giống nhau ở mọi gói (bằng `includedFeatures`). |
| `items[].isRequested` | Gói mà chủ trọ đã gửi yêu cầu đổi sang và đang chờ admin xử lý. |
| `upgradeRequest` | Yêu cầu đổi gói đang chờ (`PENDING`), hoặc `null`. |
| `includedFeatures` | Tính năng có trong mọi gói, để FE hiển thị một lần. |

#### Gợi ý hiển thị cho FE

- Thanh tiến độ: `usage.rooms.used / usage.rooms.limit`, ví dụ "4/5 phòng". Còn ít chỗ thì nhắc chủ trọ nâng cấp.
- "Không giới hạn" vẫn là một số lớn trong DB (gói Doanh nghiệp đang có `999 / 9999 / 99`). FE tự quy ước ngưỡng hiển thị, ví dụ `>= 999` cơ sở, `>= 9999` phòng, `>= 99` quản lý.
- Nút "Chọn nâng cấp" gọi `POST /plans/upgrade-requests` (xem bên dưới). Dùng `isRequested` / `upgradeRequest` để hiện nhãn "Đã gửi yêu cầu".

### Tính năng theo gói

Mọi gói có **đầy đủ tính năng**; các gói chỉ khác giá và hạn ngạch `maxBranches`, `maxRooms`, `maxManagers`. Danh sách hiển thị nằm ở `BE/utils/planFeatures.js` (`INCLUDED_FEATURES`).

- Đối soát SePay/Bank Hub tự động và quản lý sự cố chỉ cần chủ trọ có gói đang hiệu lực. Không có gói hiệu lực (hết hạn) → không tự đối soát (tiền vào giao dịch chưa đối soát) và tạo/sửa sự cố → `403 FEATURE_NOT_IN_PLAN`.
- `POST/PUT /admin/plans` không nhận `features`, `featureFlags` nữa (gửi lên → 400). `GET /admin/plans` trả thêm `includedFeatures` và `items[].subscriptionCount` (số thuê bao đang dùng hoặc chờ thanh toán).
- Khi khởi động, server xóa `featureFlags` và `features` cũ khỏi các gói đã lưu.

### Yêu cầu đổi gói

#### Phía chủ trọ (`LANDLORD`)

| Method | Endpoint | Mô tả |
| --- | --- | --- |
| POST | `/plans/upgrade-requests` | Body `{ "planId": "...", "note": "tùy chọn" }`. Trả 201 với yêu cầu `PENDING`. |
| GET | `/plans/upgrade-requests` | Lịch sử yêu cầu của mình (mới nhất trước), có `planId`, `currentPlanId` (đã populate), `status`, `rejectReason`. |
| POST | `/plans/upgrade-requests/:requestId/cancel` | Hủy yêu cầu đang chờ. |

Lỗi khi gửi yêu cầu: `PLAN_NOT_SELECTABLE` (gói dùng thử), `PLAN_QUOTA_BELOW_USAGE` (gói nhỏ hơn mức đang dùng), `UPGRADE_REQUEST_PENDING` (đã có yêu cầu chờ), `SUBSCRIPTION_PENDING_EXISTS` (còn hóa đơn SaaS chưa thanh toán). Được phép chọn lại chính gói đang dùng để xin gia hạn.

#### Phía admin (`SUPER_ADMIN`)

| Method | Endpoint | Mô tả |
| --- | --- | --- |
| GET | `/admin/upgrade-requests?status=PENDING` | Hàng chờ (cũ nhất trước), có `landlordId { name, email, phoneNumber, status }`. `status` nhận `PENDING / APPROVED / REJECTED / CANCELLED`. |
| POST | `/admin/upgrade-requests/:requestId/approve` | Body tùy chọn `{ startDate, endDate }`, mặc định từ hôm nay đến hết một chu kỳ của gói (1 tháng hoặc 1 năm). Tạo thuê bao `PENDING_PAYMENT` và hóa đơn SaaS trong cùng transaction, giống `POST /admin/subscriptions`. |
| POST | `/admin/upgrade-requests/:requestId/reject` | Body `{ "reason": "..." }` bắt buộc. |

Sau khi duyệt, luồng thanh toán giữ nguyên: admin xác nhận hóa đơn SaaS (`POST /admin/invoices/:id/paid`) thì gói mới mới có hiệu lực. Xử lý một yêu cầu đã đóng → `422 UPGRADE_REQUEST_CLOSED`. Mọi thao tác đều được ghi audit log.

---

<a id="saas-payment"></a>

## 9. Thanh toán gói SaaS qua Cổng thanh toán SePay

Chỉ Backend `/BE`. Prefix `/api/v1`.

- Nền tảng (admin) thu tiền gói SaaS của chủ trọ qua **Cổng thanh toán SePay**: form checkout tại `pay.sepay.vn` và IPN `ORDER_PAID`.
- Tiền phòng của khách thuê vẫn chảy vào tài khoản riêng của từng chủ trọ qua Bank Hub, xem [mục SePay Bank Hub](#bankhub). Hai dòng tiền này tách biệt hoàn toàn.

### 1. Cài đặt (sandbox)

1. Vào my.sepay.vn → **Cổng thanh toán** → **Đăng ký** → **Bắt đầu ngay** → chọn **Sandbox**, rồi sao chép `MERCHANT ID` và `SECRET KEY`.
2. Trong `BE/.env`:

   ```env
   SEPAY_PG_ENV=sandbox                      # sandbox | production
   SEPAY_PG_MERCHANT_ID=...                  # MERCHANT ID của Sandbox
   SEPAY_PG_SECRET_KEY=...                   # SECRET KEY của Sandbox, chỉ nằm ở backend
   SEPAY_PG_IPN_SECRET=...                   # secret key đặt ở mục cấu hình IPN (auth type SECRET_KEY)
   SEPAY_PG_RETURN_URL=http://localhost:5173/plans
   ```

3. Trong my.sepay.vn → **Cổng thanh toán → Cấu hình → IPN**:
   - URL: `https://<domain>/api/v1/plans/payments/ipn`. SePay chỉ gọi được HTTPS công khai; khi chạy local, dùng `ngrok http 5000`.
   - Auth type: `SECRET_KEY`, giá trị bằng `SEPAY_PG_IPN_SECRET`. SePay gửi giá trị này trong header `X-Secret-Key`.

Chuyển sang production: thay bộ merchant id / secret key bằng bộ production, đặt `SEPAY_PG_ENV=production` (checkout `pay.sepay.vn`), và cấu hình lại IPN production.

Nếu thiếu merchant id hoặc secret key, checkout trả `503 PAYMENT_GATEWAY_NOT_CONFIGURED`. Nếu thiếu `SEPAY_PG_IPN_SECRET`, IPN trả `503 WEBHOOK_NOT_CONFIGURED`.

### 2. Luồng

```text
Admin duyệt yêu cầu đổi gói (hoặc tự tạo thuê bao)
  → Subscription PENDING_PAYMENT + PlatformInvoice PENDING
Chủ trọ: GET /plans/invoices → bấm "Thanh toán"
  → POST /plans/invoices/:id/checkout → FE gửi form POST tới SePay
  → khách thanh toán trên pay-sandbox.sepay.vn → SePay đưa về SEPAY_PG_RETURN_URL?payment=success
SePay gọi IPN ORDER_PAID → backend đánh dấu PlatformInvoice PAID → Subscription ACTIVE → gói mới có hiệu lực
```

Admin vẫn có thể xác nhận tay bằng `POST /admin/invoices/:id/paid` (chuyển khoản ngoài cổng). Cả hai cách dùng chung một hàm xử lý.

### 3. API cho chủ trọ (`LANDLORD`)

#### GET /plans/invoices

Danh sách hóa đơn SaaS của chính mình, mới nhất trước:

```json
{ "items": [{ "id": "...", "invoiceCode": "SAAS-...", "amount": 499000, "billingCycle": "MONTHLY",
  "dueDate": "...", "status": "PENDING", "paidAt": null, "paymentGateway": null,
  "plan": { "id": "...", "code": "PRO", "name": "Gói Pro" }, "payable": true, "createdAt": "..." }],
  "total": 1, "page": 1, "limit": 20 }
```

#### POST /plans/invoices/:invoiceId/checkout

Body tùy chọn `{ "paymentMethod": "BANK_TRANSFER" }`, nhận một trong `BANK_TRANSFER`, `NAPAS_BANK_TRANSFER`, `CARD`; mặc định `BANK_TRANSFER`. Trả 201:

```json
{
  "environment": "sandbox",
  "checkoutUrl": "https://pay-sandbox.sepay.vn/v1/checkout/init",
  "method": "POST",
  "orderInvoiceNumber": "SAAS-...-MGX1A2B3",
  "fields": {
    "operation": "PURCHASE", "payment_method": "BANK_TRANSFER", "order_invoice_number": "SAAS-...-MGX1A2B3",
    "order_amount": 499000, "currency": "VND", "order_description": "Thanh toan goi PRO SAAS-...",
    "customer_id": "...", "success_url": "...", "error_url": "...", "cancel_url": "...",
    "merchant": "...", "signature": "..."
  }
}
```

- Mỗi lần gọi tạo một `order_invoice_number` mới (SePay yêu cầu mã đơn là duy nhất). Gọi lại khi khách thanh toán lại cũng không sao.
- `signature` = HMAC-SHA256 bằng secret key, ký chuỗi các cặp `field=value` nối bằng dấu phẩy theo đúng thứ tự trường, mã hóa base64 (giống SDK `sepay-pg-node`).
- **FE phải gửi các trường đúng thứ tự trả về, không sửa giá trị nào**, nếu không chữ ký sẽ sai.
- Hóa đơn không ở trạng thái chờ thanh toán, hoặc thuê bao đã hết hạn hay bị hủy → `422 PLATFORM_INVOICE_NOT_PAYABLE`. Hóa đơn của chủ trọ khác → 404.

FE tự gửi form như sau:

```js
const { checkoutUrl, fields } = await planApi.checkout(invoiceId);
const form = document.createElement("form");
form.method = "POST";
form.action = checkoutUrl;
for (const [name, value] of Object.entries(fields)) {
  const input = document.createElement("input");
  input.type = "hidden";
  input.name = name;
  input.value = value;
  form.appendChild(input);
}
document.body.appendChild(form);
form.submit();
```

Trang `SEPAY_PG_RETURN_URL` nhận thêm `?payment=success|error|cancel&invoice=<invoiceCode>`. **Không coi `payment=success` là đã thanh toán**: chỉ IPN mới kích hoạt gói. FE nên gọi lại `GET /plans/invoices` hoặc `/auth/me` để biết trạng thái thật.

### 4. IPN — `POST /plans/payments/ipn`

Header `X-Secret-Key`. Backend xử lý:

| Trường hợp | Kết quả |
| --- | --- |
| Sai hoặc thiếu `X-Secret-Key` | 401 |
| `order_invoice_number` không thuộc hóa đơn nào | 200 `{ success: true, ignored: true }` |
| `ORDER_PAID`, giao dịch `APPROVED`, số tiền đúng bằng hóa đơn (VND) | Hóa đơn `PAID` (`paymentReference = SEPAY_PG:<transaction_id>`, `paymentGateway = SEPAY_PG_<payment_method>`), thuê bao `ACTIVE`, gói cũ bị thay. 200 `{ success: true, paid: true }` |
| Gửi lại cùng giao dịch | 200 `{ duplicate: true }`, không xử lý lần hai |
| Số tiền lệch, thuê bao đã hủy hoặc hết hạn, quota không còn phù hợp | Không kích hoạt gói. Ghi chú vào hóa đơn và audit log `UNAPPLIED_PLATFORM_PAYMENT` để admin xử lý hoặc hoàn tiền. Vẫn trả 200 để SePay không gửi lại |
| `TRANSACTION_VOID` của giao dịch đã ghi nhận (thẻ bị hủy) | Không tự hạ gói. Ghi audit `UNAPPLIED_PLATFORM_PAYMENT` để admin quyết định |

Thời điểm thanh toán lấy theo `transaction_date` (giờ Việt Nam), nhưng không sớm hơn lúc tạo hóa đơn, để tránh sai do lệch giờ.

Audit `CONFIRM_PLATFORM_PAYMENT` do cổng tạo có `actorRole: SYSTEM` và không có `confirmedBy`.

---

<a id="admin"></a>

## 10. Admin nền tảng SaaS

Prefix `/api/v1/admin`. Tất cả endpoint yêu cầu Bearer token có role `SUPER_ADMIN`; Landlord/Manager/Tenant bị từ chối 403. Tài khoản SUPER_ADMIN phải có sẵn trong DB, xem [mục Auth & cấp tài khoản](#auth).

Admin chỉ xem tài khoản cơ bản, cấu hình gói, thuê bao, hóa đơn SaaS và số lượng tài nguyên tổng hợp. Không trả mật khẩu, bankConfig, hóa đơn tiền phòng hoặc giao dịch nội bộ của Landlord. Không có API tạo Admin hoặc sửa role.

### Gói dịch vụ

- `GET /plans?page=1&limit=20&search=...&isActive=true`
- `POST /plans`
- `PUT /plans/:planId`
- `DELETE /plans/:planId` — xóa mềm.

Ví dụ tạo gói:

```json
{
  "name": "Gói chuyên nghiệp",
  "code": "PRO",
  "price": 299000,
  "billingCycle": "MONTHLY",
  "maxBranches": 5,
  "maxRooms": 100,
  "maxManagers": 10,
  "features": ["VietQR", "Dashboard"],
  "isActive": true,
  "trialDays": 30
}
```

Mã gói không sửa sau khi tạo; mã đã xóa mềm không tái sử dụng. Giá/quota là số nguyên không âm. `FREE_TRIAL` luôn miễn phí; `trialDays` 1–365 được sử dụng khi Landlord đăng ký mới. `features` là cấu hình danh mục, không tự thay đổi quyền RBAC.

Nếu gói còn thuê bao ACTIVE chưa hết hạn hoặc PENDING_PAYMENT, không được xóa/ngừng hoạt động/giảm quota (`PLAN_IN_USE`). Tăng quota hoặc sửa giá được phép; giá hóa đơn/thuê bao đã tạo không thay đổi. Để hạ gói, tạo thuê bao mới cho từng Landlord, kiểm tra tài nguyên thực tế, chuyển xong rồi mới giảm/xóa gói cũ.

### Landlord

- `GET /landlords?page=1&limit=20&search=...&status=ACTIVE`
- `PUT /landlords/:landlordId/status`

```json
{ "status": "SUSPENDED", "reason": "Tạm khóa theo biên bản xử lý" }
```

Chỉ nhận ACTIVE/SUSPENDED và lý do bắt buộc. Khi trạng thái đổi, thu hồi session và tăng authVersion của Landlord cùng Manager/Tenant thuộc chuỗi trong một transaction. Mở khóa yêu cầu đăng nhập lại; không tự mở khóa những tài khoản con đã bị khóa riêng. GET `/api/v1/users` vẫn cung cấp danh sách/chi tiết cơ bản toàn sàn.

### Thuê bao và hóa đơn SaaS

- `GET /subscriptions?page=1&limit=20&landlordId=...&status=ACTIVE`
- `GET /subscriptions?expiringWithinDays=7` — danh sách cảnh báo cần gia hạn.
- `POST /subscriptions` — mua/gia hạn/nâng-hạ gói, xuất hóa đơn trước.
- `PUT /subscriptions/:subscriptionId` — sửa thuê bao chờ thanh toán hoặc hủy thuê bao.
- `GET /invoices?page=1&limit=20&landlordId=...&status=OVERDUE`
- `POST /invoices/:invoiceId/paid` — xác nhận đã thu tiền SaaS thủ công.

Ví dụ tạo thuê bao:

```json
{
  "landlordId": "landlord-id",
  "planId": "plan-id",
  "startDate": "2026-10-14T00:00:00+07:00",
  "endDate": "2026-11-14T00:00:00+07:00"
}
```

`startDate` tùy chọn, mặc định hiện tại. Thời hạn phải hợp lệ/chưa hết hạn. Backend kiểm tra quota gói đích với số Branch/Room/Manager chưa xóa của Landlord. Mỗi Landlord chỉ có một thuê bao đang PENDING_PAYMENT.

HTTP 201 trả `data: { subscription, invoice }`. Thuê bao mới PENDING_PAYMENT; hóa đơn PlatformInvoice mới PENDING với giá/chu kỳ của gói được lưu riêng. Chưa thanh toán thì thuê bao hiện tại tiếp tục có hiệu lực đến hạn cũ. Giá là giá niêm yết của một gói cho khoảng thời hạn Admin chọn; chưa có tính tiền chênh lệch tự động khi đổi gói. Admin cần chọn khoảng thời hạn phù hợp chu kỳ MONTHLY/YEARLY.

Sửa thuê bao chờ thanh toán nhận `planId`, `startDate`, `endDate`: hủy hóa đơn chờ cũ và xuất hóa đơn mới, giữ lịch sử. Thuê bao đã kích hoạt giữ nguyên lịch sử; gia hạn/đổi gói dùng POST để tạo kỳ mới. Không nhận `pricePaid`, `quotedPrice` hoặc `status: ACTIVE` từ client.

Hủy thuê bao:

```json
{ "status": "CANCELLED" }
```

Hủy các hóa đơn chưa trả liên quan; giữ hóa đơn đã thanh toán và chứng từ. Việc hủy không tự hoàn tiền. Có thể hủy thuê bao của Landlord đang bị khóa.

Xác nhận thanh toán:

```json
{
  "paymentReference": "SAAS-RECEIPT-20261014-001",
  "paymentGateway": "BANK_TRANSFER_MANUAL",
  "paidAt": "2026-10-14T10:30:00+07:00",
  "paymentEvidence": "https://example.com/receipts/001.jpg"
}
```

Ngày thanh toán phải sau thời điểm xuất hóa đơn, không trong tương lai. Xác nhận nghĩa là đã thu đủ tổng tiền; không hỗ trợ trả một phần trong luồng SaaS này. Tham chiếu thanh toán duy nhất, lưu người xác nhận, chứng từ và audit. Invoice → PAID, Subscription → ACTIVE trong cùng transaction. Gọi lại cùng hóa đơn/tham chiếu trả `duplicate: true`; khác tham chiếu hoặc tham chiếu đã dùng ở hóa đơn khác bị từ chối.

Thuê bao bắt đầu ngay thay thuê bao cũ, giữ lịch sử cũ với status CANCELLED. Thuê bao bắt đầu trong tương lai không cắt quyền hiện tại; quota xác định thuê bao ACTIVE còn trong thời hạn có ngày bắt đầu mới nhất khi được sử dụng, cập nhật subscriptionId tương ứng. Không có script/cron hoặc server nền được bổ sung.

`displayStatus` thể hiện EXPIRED/OVERDUE theo thời gian thực, không cần sửa trạng thái bằng job. Cảnh báo gia hạn/chậm thanh toán được cung cấp qua API để frontend hiển thị; chưa tích hợp gửi email/SMS hoặc webhook thanh toán SaaS. Webhook tiền phòng hiện tại vẫn thuộc Finance và không dùng để xác nhận PlatformInvoice.

### Analytics

`GET /analytics?from=2026-10-01&to=2026-10-14T23:59:59+07:00`

Ngày không kèm giờ được hiểu theo lịch Việt Nam: `from` bắt đầu ngày, `to` kết thúc ngày. Mặc định thống kê từ đầu tháng hiện tại đến thời điểm gọi API.

HTTP 200 trả:

- `users`: số Landlord/Manager/Tenant, tài khoản mới trong kỳ, tài khoản bị khóa.
- `saas.mrr`: doanh thu định kỳ từ thuê bao ACTIVE trong thời hạn của Landlord ACTIVE; chỉ một thuê bao hiện hành cho mỗi Landlord. Gói YEARLY chia 12, tổng làm tròn sang VND. Gói miễn phí có MRR bằng 0.
- `saas.collectedAmount` / `paidInvoiceCount`: tiền thực thu và số hóa đơn SaaS PAID theo paidAt trong kỳ; không cộng Invoice/Payment tiền phòng.
- `overdueInvoiceCount`, `expiringWithin7Days`: số hóa đơn quá hạn và thuê bao sắp hết hạn.
- `trialLandlords`, `convertedTrialLandlords`, `trialConversionRate`: Landlord từng dùng gói miễn phí và từng có thuê bao trả phí đã thanh toán.
- `property.activeRoomCount`: chỉ số phòng chưa xóa/chưa INACTIVE; không trả chi tiết phòng/hợp đồng.

### Dữ liệu cũ

Database mới dùng defaults/index của model. Với database cũ, chủ dự án cần cập nhật thủ công `isDeleted: false` cho SaaSPlan, Subscription, PlatformInvoice chưa có field; thêm quotedPrice/billingCycle cho Subscription theo chứng từ/gói lịch sử, không dùng giá mới của gói để thay lịch sử. Kiểm tra paymentReference trùng trước khi tạo unique partial index của PlatformInvoice. Không có file script migration và chưa cập nhật database trong lượt triển khai.

### Kiểm tra thủ công

1. Admin login và gọi từng endpoint; role khác trả 403, không có token trả 401.
2. Tạo/sửa gói: tiền/quota thập phân hoặc âm, mã trùng, sửa code bị từ chối. Gói còn người dùng không giảm quota/xóa được.
3. Khóa Landlord: token Landlord/Manager/Tenant cũ bị vô hiệu; mở khóa phải login lại; kiểm tra JSON không có bankConfig/password.
4. Tạo thuê bao: hóa đơn PENDING có trước khi thanh toán, không đổi quyền hiện hành. Hạ gói dưới tài nguyên đang dùng thất bại và rollback.
5. Xác nhận thanh toán: Invoice PAID/Subscription ACTIVE; gọi lại không nhân doanh thu; tham chiếu trùng ở hóa đơn khác bị từ chối.
6. Sửa giá gói sau xuất hóa đơn: số tiền invoice/quotedPrice và MRR của thuê bao đó giữ nguyên.
7. Gia hạn tương lai: quyền cũ còn đến kỳ mới; khi kỳ mới bắt đầu quota dùng gói mới. Hủy giữ chứng từ đã thanh toán.
8. Analytics chỉ lấy tiền SaaS, kiểm tra MONTHLY/YEARLY, cảnh báo hạn và lọc ngày.

Dependencies added: None. Automated testing chưa thực hiện; việc kiểm thử do project owner đảm nhiệm.

## Audit log

- Mỗi bản ghi chỉ lưu các trường thay đổi ở cấp đầu (`before`/`after`), bỏ qua `_id`, `__v`, `createdAt`, `updatedAt` và các trường version nội bộ. Bản ghi tạo mới (không có `before`) hoặc xóa (không có `after`) lưu nguyên dữ liệu được truyền vào.
- Bản ghi có `expiresAt`; MongoDB tự xóa khi quá hạn (TTL index). Log thường giữ `AUDIT_RETENTION_DAYS` ngày (mặc định 365). Log tài chính giữ `AUDIT_FINANCE_RETENTION_DAYS` ngày (mặc định 3650): `entityType` là `INVOICE`, `PLATFORM_INVOICE`, `SUBSCRIPTION`, hoặc `action` chứa `PAYMENT`, `BANK`, `DEPOSIT`, `SETTLE`, `PRICING`, `COST`. Đặt `0` để giữ vĩnh viễn.
- Khi khởi động, server xóa các index đơn cũ (`actorId_1`, `landlordId_1`, `action_1`, `entityType_1`) và gán `expiresAt` cho log cũ tính từ `createdAt`. Đổi số ngày giữ chỉ áp dụng cho log mới và log chưa có `expiresAt`.
- Trang audit của admin dùng index `{createdAt:-1}`, `{action:1, createdAt:-1}`, `{entityType:1, createdAt:-1}`, `{landlordId:1, createdAt:-1}`; tổng số khi không lọc dùng `estimatedDocumentCount`.

## Tiền cọc hợp đồng

- `GET /contracts/:contractId` trả thêm `depositPayment` khi cọc chưa nhận (`depositStatus: UNPAID`, `depositAmount > 0`, hợp đồng còn hiệu lực), ngược lại là `null`. Có `amount`, `bankConfigured`; khi chủ trọ đã cấu hình ngân hàng thì có thêm `bank`, `paymentSyntax` (`COC <mã hợp đồng bỏ dấu gạch>`) và `vietQrUrl`.
- `POST /contracts/:contractId/deposit/received` (LANDLORD, body rỗng): chuyển `UNPAID` → `PAID`, lưu `depositReceivedAt`, `depositReceivedBy`, ghi audit `RECEIVE_CONTRACT_DEPOSIT`. Cọc đã nhận → `422 DEPOSIT_ALREADY_RECEIVED`; hợp đồng không có cọc → `DEPOSIT_NOT_REQUIRED`; hợp đồng đã kết thúc → `CONTRACT_NOT_ACTIVE`.
- Đối soát tự động (gói có `SEPAY_WEBHOOK`, webhook SePay hoặc IPN Bank Hub): nội dung chứa đúng một mã `COC HDT<năm><12 ký tự>` thì giao dịch được khớp với hợp đồng, kiểm tra trước mã hóa đơn. Cọc đang `UNPAID`, hợp đồng còn hiệu lực và số tiền đúng bằng `depositAmount` → `depositStatus: PAID`, `depositReceivedAt` = ngày giao dịch, `depositReferenceCode`, audit `RECEIVE_CONTRACT_DEPOSIT` (actor SYSTEM), `PaymentReceipt.contractId`, realtime `contract:deposit_received` tới phòng `landlord:` và `branch:`. Sai số tiền, cọc đã nhận hoặc hợp đồng đã kết thúc → `UnmatchedPayment` kèm ghi chú lý do; gói không có đối soát tự động thì chủ trọ xác nhận thủ công bằng API trên.
- `depositPayment` có thêm `autoConfirm` (gói có đối soát tự động) và `simulator`. `POST /contracts/:contractId/deposit/simulate` (LANDLORD, TENANT; chỉ khi bật giả lập, không chạy ở production) giả lập khách chuyển cọc qua đúng luồng đối soát ngân hàng; trả `received`, `unmatched`, `reason`, `contract`.

## Lọc danh sách hợp đồng

`GET /contracts` nhận thêm:

- `search`: khớp mã hợp đồng, số phòng, tên / SĐT / CCCD của khách thuê, hoặc tên / SĐT / CCCD người ở cùng (không phân biệt hoa thường).
- `depositStatus`: `UNPAID`, `PAID`, `APPLIED`, `PARTIALLY_REFUNDED`, `REFUNDED`.
- `confirmation`: `PENDING` (một trong hai bên chưa xác nhận) hoặc `CONFIRMED` (cả hai đã xác nhận).
- Vẫn kết hợp được với `status` và `branchId`.

## Phân loại sự cố tự động (TypeSafe)

Bật bằng `TYPESAFE_API_KEY` trong `BE/.env` (để trống = tắt). Tiêu đề và mô tả sự cố được gửi tới `api.typesafe.ai` (model `TYPESAFE_MODEL`, mặc định `jev-latest`). Câu hỏi, lựa chọn và ngưỡng nằm trong `services/incidentTriage.js`.

- Jev trả lời 1 câu Choice (sự cố thuộc bộ phận nào) và 6 câu Noul: có phải sự cố cần sửa không, có thể gây nguy hiểm không, nước có đang rò/tràn không, có mất hẳn điện/nước/nhà vệ sinh không, phòng có không khóa được không, có chỉ là lỗi nhỏ không. Code quyết định từ các câu trả lời (ngưỡng có ≥ 0.7, không < 0.3):
  - nguy hiểm → `URGENT`; nguy hiểm chưa chắc, hoặc nước đang rò / mất tiện ích / không khóa được → `HIGH`; chỉ là lỗi nhỏ → `LOW`; còn lại → `MEDIUM`.
  - `triage.needsReview = true` khi Jev chưa chắc đó có phải sự cố, có nguy hiểm, hoặc có thuộc nhóm nâng mức hay không; nội dung không giống sự cố → `category: OTHER`.
- Khi tạo sự cố, việc phân loại chạy nền sau khi trả response (không làm chậm hay làm hỏng việc báo sự cố) rồi phát `incident:updated`. Sự cố do khách thuê báo được đặt mức ưu tiên gợi ý; sự cố do nhân viên tạo giữ mức họ chọn, gợi ý chỉ lưu ở `triage.suggestedPriority`.
- Lỗi gọi API được lưu `triage.status: FAILED` kèm `error`; loại và mức ưu tiên giữ nguyên (lỗi không bao giờ được coi là câu trả lời).
- `POST /incidents/:incidentId/triage` (LANDLORD, PROPERTY_MANAGER): phân loại lại sự cố đang `PENDING`/`IN_PROGRESS`, áp dụng cả loại và mức ưu tiên, ghi audit `TRIAGE_INCIDENT`. Chưa cấu hình key → `503 TRIAGE_DISABLED`; TypeSafe lỗi → `502`.
- `GET /incidents` nhận thêm `category` (`ELECTRICAL`, `PLUMBING`, `APPLIANCE`, `DOOR_LOCK_WINDOW`, `WALL_CEILING_FLOOR`, `INTERNET`, `PEST_CLEANING`, `SHARED_AREA`, `OTHER`, hoặc `UNCLASSIFIED` = chưa phân loại) và `needsReview=true`; trả thêm `triageEnabled`.
- Jev hỗ trợ tiếng Việt kém hơn tiếng Anh: nên chạy thử trên dữ liệu thật trước khi tin hoàn toàn vào kết quả.

## Realtime: tự cập nhật và hoạt động

Sau mọi thao tác ghi thành công (POST/PUT/PATCH/DELETE có người dùng đăng nhập, trừ `/auth`), webhook ngân hàng, IPN cổng SePay và phân loại sự cố, server phát hai loại sự kiện Socket.io (`realtime/liveUpdates.js`, `realtime/activity.js`):

- `data:changed` `{ resources: ["contracts", "rooms", ...], at }`: chỉ nêu nhóm dữ liệu bị ảnh hưởng, không có bản ghi hay số tiền. Gửi tới phòng `scope:<landlordId>` (chủ trọ, quản lý, khách thuê của chuỗi); thay đổi của admin gửi `admins` + `landlords`. FE dùng `useLiveRefresh([...], refresh)` để trang tự tải lại ngầm.
- `activity` `{ id, at, actor: { id, name, role }, action, message, details, room, branch, code, link }`: ai làm gì, phòng nào, cơ sở nào, mã hợp đồng / hóa đơn nào. Ví dụ `message`: "Nguyễn Văn An (Khách thuê) báo sự cố", `details`: "Phòng P.101 · Tòa Cầu Giấy · "Vỡ ống nước"". Chỉ gửi tới người được xem: `landlord:<id>`, `branch:<id>` (quản lý cơ sở đó), `user:<tenantId>` (khách thuê liên quan), `admins` (việc về gói dịch vụ). Danh sách hành động nằm trong `ACTIONS` của `realtime/activity.js`.
- Phòng socket mới: `user:<userId>` (mọi tài khoản), `scope:<landlordId>`, `admins`, `landlords`; các phòng cũ (`landlord:`, `branch:`, `invoice:`) và sự kiện cũ (`payment:success`, `invoice_paid`, `incident:*`, `contract:deposit_received`) giữ nguyên.

## Khóa / mở lại tài khoản khách thuê theo hợp đồng

- Job `jobs/tenantAccess.js` chạy khi server khởi động và mỗi 6 giờ. Khách thuê bị khóa (`status: INACTIVE`, `deactivationReason: NO_ACTIVE_CONTRACT`) khi đồng thời:
  - không còn hợp đồng đang chạy, hoặc hết hạn / trả phòng chưa quá `TENANT_LOCK_AFTER_DAYS` ngày (mặc định 30, tính theo `endDate`, hợp đồng đã thanh lý tính theo `actualEndDate`);
  - không còn hóa đơn nào chưa trả (`ISSUED`, `PARTIALLY_PAID`, `UNPAID` còn tiền).
- Khi khóa: tăng `authVersion` và xóa phiên đăng nhập (đăng xuất mọi thiết bị), ghi audit `DEACTIVATE_TENANT` (actor SYSTEM). Đăng nhập đúng mật khẩu nhận `403 TENANT_INACTIVE` kèm lời giải thích. Link hóa đơn công khai `/i/:token` vẫn dùng được.
- Lập hợp đồng mới với cùng CCCD (cùng chủ trọ): tài khoản được mở lại về trạng thái trước khi khóa, **giữ nguyên mật khẩu khách đã đổi**, không cấp mật khẩu tạm, không bắt đổi mật khẩu; audit `REACTIVATE_TENANT`. Email/SĐT nhập trong hợp đồng mới (nếu có) vẫn phải khớp tài khoản cũ.
- Tắt bằng `TENANT_AUTO_LOCK=false`.

## Gia hạn hợp đồng

`POST /contracts/:contractId/renew` (LANDLORD) `{ endDate, rentalPrice?, notes? }`:
- Chỉ cho hợp đồng chưa thanh lý (`ACTIVE`/`EXPIRING_SOON`/`EXPIRED`) và chưa lập phiếu quyết toán (`CONTRACT_SETTLEMENT_PREPARED`). `endDate` phải sau ngày kết thúc hiện tại và ở tương lai.
- Giữ nguyên mã hợp đồng, tiền cọc, khách thuê; `endDate`, `rentalPrice` được cập nhật (giá mới áp dụng cho hóa đơn tạo sau đó). Mỗi lần gia hạn thêm một mục vào `contract.renewals` (`previousEndDate`, `endDate`, `previousRentalPrice`, `rentalPrice`, `notes`, `renewedAt`, `renewedBy`). Audit `RENEW_CONTRACT`.
- Khách thuê đã bị tạm khóa vì hết hạn được mở lại, giữ mật khẩu cũ (audit `REACTIVATE_TENANT`, lý do `CONTRACT_RENEWED`).

## Tên đăng nhập theo từng chủ trọ

- `users`: `email` và `username` (CCCD của khách thuê, SĐT của quản lý, email của chủ trọ) là duy nhất **trong từng chủ trọ** (index `{email, landlordId}`, `{username, landlordId}`), không còn duy nhất toàn hệ thống. Cùng một CCCD có thể có tài khoản ở nhiều chủ trọ. Chủ trọ và admin (không có `landlordId`) vẫn không trùng email với nhau. Server tự xóa index cũ `email_1`, `username_1` khi khởi động.
- Đăng nhập: thử mật khẩu với mọi tài khoản trùng tên đăng nhập. Chỉ một tài khoản đúng mật khẩu → đăng nhập như cũ. Nhiều tài khoản cùng đúng mật khẩu → `POST /auth/login` trả `{ selectionRequired: true, accounts: [{ id, role, roleName, status, landlordName, places: ["Tòa Cầu Giấy – Phòng P.101", ...] }] }` (chưa tạo phiên, chưa đặt cookie). Client gửi lại `{ username, password, accountId }` để vào tài khoản đã chọn (mật khẩu được kiểm tra lại). `accountId` không thuộc danh sách khớp → 401.
