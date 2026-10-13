# Bàn giao Dev 1 — Property Core

## Chạy local

Yêu cầu Node.js 22.12+ (máy hiện tại dùng Node.js 24) và MongoDB replica set / Atlas để hỗ trợ transaction.

```powershell
# Terminal 1
cd BE
npm install
npm run dev

# Terminal 2, từ thư mục gốc
cd FE
npm install
npm run dev
```

FE: http://localhost:5173. BE: http://localhost:5000. Vite proxy `/api` tới BE.
`BE/.env` cần `MONGO_URI`, `JWT_SECRET` ngẫu nhiên tối thiểu 32 ký tự,
`CLIENT_URL=http://localhost:5173`, `NODE_ENV=development`. File `.env` không được commit.
`npm run dev` của BE dùng `node --watch`, không còn cần nodemon.

Database hiện được kiểm tra là trống. Chạy `cd BE` rồi `npm run setup` để tạo tài khoản phát triển `landlord@wdp301.com` / `password123` và gói dùng thử 30 ngày (1 cơ sở, 5 phòng, 1 quản lý). Lệnh chỉ chạy ở development, từ chối nếu đã có dữ liệu, không xóa hoặc ghi đè. Sau đó tạo cơ sở/phòng qua giao diện.

Tài khoản có sẵn nếu đã chạy seed dự án: `landlord@wdp301.com` và `manager@wdp301.com`, mật khẩu `password123`.
Chỉ dùng khi database của bạn đã có dữ liệu seed đó. Không chạy lại `npm run seed` trên dữ liệu đang sử dụng: script seed cũ xóa toàn bộ collection trước khi tạo mẫu.

## Chức năng đã triển khai

- Đăng nhập, thông tin tài khoản, refresh cookie, đăng xuất, kích hoạt tenant bằng OTP.
- CRUD cơ sở, cấu hình điện/nước, dịch vụ cố định, lịch chốt và hạn thanh toán.
- CRUD phòng, trạng thái vận hành, lọc/tìm kiếm/phân trang, sơ đồ theo tầng và dạng bảng.
- Sinh phòng hàng loạt trong transaction, kiểm tra trùng số phòng, tầng và quota.
- Tạo/liên kết tenant + lập hợp đồng + đổi phòng sang RENTED trong cùng transaction.
- Danh sách hợp đồng, chi tiết/in, trạng thái sắp hết hạn/hết hạn suy diễn theo ngày.
- Biên bản thanh lý: ảnh đồng hồ, khoản khấu trừ kèm bằng chứng, dự tính hoàn cọc, xác nhận hai bên; chuyển phòng sang CLEANING trong transaction.
- Soft delete, validation số tiền nguyên VND, audit và response/error thống nhất.
- Giao diện tiếng Việt, desktop/mobile, loading/error/retry/empty, toast và modal xác nhận.

## Quyền và phạm vi

| Vai trò          | Cơ sở                                 | Phòng                                                     | Hợp đồng                                    |
| ---------------- | ------------------------------------- | --------------------------------------------------------- | ------------------------------------------- |
| LANDLORD         | CRUD trong chuỗi của mình             | CRUD/bulk                                                 | Xem/tạo/thanh lý                            |
| PROPERTY_MANAGER | Chỉ xem cơ sở được giao               | Xem và đổi EMPTY/CLEANING/MAINTENANCE tại cơ sở được giao | Không truy cập nghiệp vụ hợp đồng/tài chính |
| TENANT           | Không                                 | Không gọi trực tiếp danh sách phòng                       | Chỉ xem hợp đồng của mình                   |
| SUPER_ADMIN      | Không truy cập dữ liệu tài sản nội bộ | Không                                                     | Không                                       |

Manager không được đổi giá hoặc chuyển phòng đang RENTED sang trạng thái khác.
Trạng thái RENTED chỉ được tạo qua hợp đồng; phải thanh lý trước khi trả phòng.
Middleware tải lại user từ DB trên mỗi request, nên trạng thái khóa và phân công mới có hiệu lực ngay.
Header `x-landlord-id` bị từ chối ở mọi môi trường. `/api/users` cũ không còn được mount vì CRUD đó chưa có phân quyền.

```js
const { authenticate, authorize } = require("../middlewares/auth");
const { getTenantScope, getBranchScope, scoped } = require("../utils/scope");

router.get(
  "/",
  authenticate,
  authorize("LANDLORD", "PROPERTY_MANAGER"),
  controller,
);
// Tài nguyên con, không spread filter client lên scope:
const query = scoped(getTenantScope(req), { branchId: validatedBranchId });
// Riêng Branch: getBranchScope sử dụng _id: {$in: assignedBranches}.
```

`scoped()` kết hợp bằng `$and` và tự thêm `isDeleted: false`, tránh ghi đè scope bởi filter.
Hai scope helper cố ý từ chối SUPER_ADMIN thay vì trả `{}`; route platform của Dev 4 phải dùng authorize SUPER_ADMIN riêng.

## API và response

Giữ các endpoint Branch/Room/Contract trong `TASK_ASSIGNMENT_AND_API_CONTRACT.md`, prefix `/api/v1`.
Mount module mới trong `BE/routes/index.js`.

```json
{ "success": true, "message": "Xử lý thành công", "data": {} }
```

Danh sách: `data = { items, total, page, limit }`, mặc định 20, tối đa 100/trang.
Các record MongoDB giữ `_id`; DTO auth trả `user.id` theo contract đã chốt.
Lỗi: `{ success: false, errorCode, message, data: null }`.
Các lớp dùng chung trong `BE/utils/errors.js`; FE xử lý lỗi qua `services/api.js`.

Endpoint bổ sung không phá API đã chốt:

```text
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
POST /api/v1/auth/otp/request   { email, phoneNumber }
POST /api/v1/auth/otp/verify    { challengeId, code, password }
```

JWT access 15 phút, chỉ lưu in-memory; refresh token 7 ngày trong cookie HttpOnly, lưu hash ở AuthSession.
Production dùng HTTPS, Secure cookie, SameSite=None mặc định; có thể cấu hình `COOKIE_SAME_SITE=lax` khi cùng site.
`CLIENT_URL` phải trùng chính xác origin FE. Khi chạy FE trên cổng khác cần sửa biến này.

Tenant mới có trạng thái `PENDING_ACTIVATION`, mật khẩu ngẫu nhiên không tiết lộ; liên kết tài khoản cũ kiểm tra email/SĐT/CCCD và landlord.
OTP có hiệu lực 5 phút, tối đa 5 lần nhập/challenge, chỉ dùng một lần, có rate limit.
Development khi chưa cấu hình SMS: mã được in trong terminal BE, không trả mã trong API.
Production cần `SMS_API_URL` và `SMS_API_KEY`; adapter nhận POST JSON `{ to, message }`, Bearer key, thành công HTTP 2xx.
Nếu nhà cung cấp dùng payload khác, chỉnh riêng `smsService.sendOtp()`. Chưa có tài khoản SMS thực được cấu hình trong repo.

## Quota interface cho Dev 2 / Dev 4

```js
const mongoose = require("mongoose");
const quota = require("../services/quotaService");
await mongoose.connection.transaction(async (session) => {
  await quota.guard({ landlordId, resource: "manager", count: 1, session });
  await User.create(
    [{ ...validatedInput, landlordId, role: "PROPERTY_MANAGER" }],
    { session },
  );
});
```

`resource`: `branch`, `room`, `manager`; `count` phải là số nguyên 1–500.
Guard bắt buộc session đang trong transaction, đọc Subscription ACTIVE chưa hết hạn và SaaSPlan đang bật.
Giới hạn lấy từ `maxBranches`, `maxRooms`, `maxManagers`; không hardcode theo tên gói.
Ghi `User.quotaVersion` để serialize kiểm tra quota khi nhiều request chạy đồng thời.
Resource insert phải nằm trong cùng transaction. Trả `{resource, used, limit, remaining}`; vượt quota trả 422 QUOTA_EXCEEDED.
Gói hết hạn/không có gói chặn tạo mới nhưng không chặn xem dữ liệu hiện có.

## Audit interface cho Dev 3

```js
const auditService = require("../services/auditService");
await auditService.log({
  req,
  action: "CONFIRM_CASH_PAYMENT",
  entityType: "PAYMENT",
  entityId,
  before,
  after,
  session,
});
```

Truyền cùng session với mutation. Actor, role, landlord, IP và user-agent lấy từ req đã xác thực.
Không đưa password, access/refresh token hoặc OTP vào before/after.
Không emit realtime trước transaction commit.

## Hợp đồng và ranh giới với Finance

`depositStatus` khi tạo chỉ nhận PAID/UNPAID. PAID là xác nhận đã nhận cọc của landlord, được audit.
Tạo hợp đồng chỉ cho phòng EMPTY; nhận `roommates` theo sức chứa. Khách đã thuộc landlord khác không được liên kết lại.
Trạng thái `displayStatus` được suy diễn khi đọc, không phụ thuộc cron; phòng hết hạn vẫn RENTED cho đến thanh lý.

Body thanh lý bổ sung:

```json
{
  "actualEndDate": "2026-10-13",
  "finalElectricIndex": 125,
  "finalWaterIndex": 23,
  "electricImage": "https://example.com/electric.jpg",
  "waterImage": "https://example.com/water.jpg",
  "deductions": [
    {
      "reason": "Hỏng khóa cửa",
      "amount": 100000,
      "evidenceImage": "https://example.com/door.jpg"
    }
  ],
  "settlementNotes": "Đã kiểm tra và hoàn tiền cọc còn lại",
  "confirmedByBothParties": true
}
```

Biên bản lưu snapshot settlement và refundedDepositAmount, chỉ trừ cọc đã nhận.
Điện/nước đồng hồ tính phần tăng từ chỉ số hiện tại; nước PER_PERSON/FIXED phải được chốt trên hóa đơn cuối kỳ của Finance.
Có hóa đơn chưa quyết toán (kể cả DRAFT) thì trả CONTRACT_OUTSTANDING_INVOICES.
Chi phí vượt cọc thì trả SETTLEMENT_BALANCE_DUE, yêu cầu thu/quyết toán ở Finance trước.
Dev 1 không tự tạo Payment hoặc tự đánh dấu hóa đơn đã thanh toán. Tích hợp hóa đơn quyết toán và phân bổ cọc vào công nợ thuộc phần Finance của Dev 3.

## Giao diện theo yêu cầu mới

Tham chiếu công khai: https://quanlytro.me/ và https://quanlytro.me/dang-nhap.
Yêu cầu mới của người dùng thay thế hướng màu teal/Plus Jakarta Sans ban đầu ở DESIGN.md cho phần Dev 1.
Nội dung dùng Mulish; heading dùng system-ui/Segoe UI; xanh chính `#3c9e47`, xanh phụ `#7dbc3f`, nền trắng/xám nhạt.
Font 14–16px cho thao tác chính, bảng cơ sở thay thẻ trang trí, bỏ banner khẩu hiệu, nút/trạng thái dễ phân biệt.
Không sao chép logo LOZIDO, QR, thông tin liên hệ hoặc số liệu khách hàng của trang tham khảo.
Mọi dữ liệu vận hành lấy từ API MongoDB; fixture chỉ nằm trong tests.

## Kiểm tra

```powershell
cd BE
npm test
cd ../FE
npm run lint
npm run build
npm run test:e2e
```

BE tests dùng MongoDB replica set tạm, không load `.env`, không chạm database dự án.
Lần đầu cần mạng tải binary MongoDB 7.0.14. Browser test cần Google Chrome; có thể đổi `channel` trong playwright.config.js.
E2E dùng FE 5174, BE 5001 và database tạm, tự dọn khi kết thúc.
Screenshot desktop/mobile được tạo dưới `FE/test-results/` (gitignored).
