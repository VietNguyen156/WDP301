# ĐẶC TẢ DỰ ÁN & BỘ QUY TẮC PHÁT TRIỂN (PROJECT RULES)
## NỀN TẢNG B2B SAAS QUẢN LÝ & TỰ ĐỘNG HÓA HÓA ĐƠN CHO CHUỖI TRỌ / CĂN HỘ DỊCH VỤ
*(Pragmatic Boarding House Management SaaS)*

---

# PHẦN 1: QUAN ĐIỂM DỰ ÁN THIẾT THỰC (PRAGMATIC PERSPECTIVES)

Để dự án đạt tính khả thi cao, giải quyết đúng nỗi đau thị trường và tối ưu hiệu quả kinh tế (đặc biệt trong giai đoạn triển khai thực tế/đồ án/startup), toàn bộ hệ thống được định hình dựa trên 3 góc nhìn thực tế:

```
                  +-------------------------------------------------------+
                  |               3 GÓC NHÌN DỰ ÁN THIẾT THỰC             |
                  +-------------------------------------------------------+
                                              |
       +--------------------------------------+--------------------------------------+
       |                                      |                                      |
       v                                      v                                      v
1. KHÁCH HÀNG B2B                       2. KHÁCH HÀNG B2C                      3. KỸ THUẬT & HẠ TẦNG
(Chủ trọ / Quản lý chuỗi)               (Người thuê trọ - Gen Z)               (SaaS Ops & Zero-Cost Stack)
* Zero-friction UX:                     * No-App Experience:                   * Multi-tenancy Logical Separation:
  Chốt số 1 tay trên mobile               Không bắt tải App, dùng link web        Chung 1 DB, phân tách bằng landlordId
* Trực quan hóa dòng tiền:              * 1-Click Payment:                     * Tối ưu Free-Tier:
  Trả lời đúng 3 câu hỏi chính            Mã VietQR động + Nút copy STK/nội dung  MongoDB Atlas + Render/Vercel + SePay
```

---

### 1. Góc nhìn Khách hàng B2B (Chủ nhà / Quản lý Chuỗi)
* **Thực tế thị trường:** Chủ nhà trọ truyền thống (đặc biệt là người lớn tuổi hoặc các chủ chuỗi vừa) rất ngại sự phức tạp. Họ không muốn mất nhiều giờ học cách sử dụng một hệ thống ERP/POS cồng kềnh.
* **Nguyên tắc thiết kế sản phẩm:**
  - **Zero-friction UX (Trải nghiệm không ma sát):** Giao diện chốt số điện/nước hàng tháng được tối ưu riêng cho thiết bị di động. Quản lý cơ sở chỉ cần thao tác bằng một tay (1 tay cầm đèn pin/điện thoại, 1 tay gõ bàn phím số lướt qua từng phòng nhanh như nhắn tin).
  - **Trực quan hóa Dòng tiền (3-Second Dashboard):** Màn hình chính của Chủ trọ không làm rối mắt bằng các biểu đồ tài chính hàn lâm, mà phải trả lời ngay lập tức 3 câu hỏi sống còn:
    1. **Tháng này tổng thu được bao nhiêu tiền?** *(Doanh thu thực thu so với tổng tiền dự thu)*.
    2. **Còn bao nhiêu phòng chưa đóng?** *(Danh sách cụ thể: Ai? Phòng nào? Quá hạn bao nhiêu ngày? Nợ bao nhiêu tiền? + 1 nút bấm gửi tin nhắc nợ)*.
    3. **Tỷ lệ lấp đầy phòng là bao nhiêu %?** *(Số phòng đang thuê / Tổng số phòng)*.

---

### 2. Góc nhìn Khách hàng B2C (Người thuê trọ - Gen Z)
* **Thực tế người dùng:** Khách thuê phòng trọ không bao giờ muốn phải tải thêm một ứng dụng lạ chỉ để nhận duy nhất 1 thông báo hóa đơn mỗi tháng.
* **Nguyên tắc thiết kế sản phẩm:**
  - **No-App Experience (Trải nghiệm không cần cài App):** Hóa đơn được gửi dưới dạng đường link Web App siêu nhẹ (Responsive Mobile Web / PWA) thông qua Zalo OA, tin nhắn Zalo cá nhân hoặc Email. Khách bấm vào link là hiển thị ngay hóa đơn chi tiết mà không cần đăng nhập phức tạp.
  - **Thanh toán 1-Click qua VietQR Động:**
    - Khách không cần nhớ số tài khoản, không cần tự gõ số tiền hay nội dung chuyển khoản.
    - Hệ thống tự sinh mã **VietQR động** chuẩn NAPAS 247 đã nhúng sẵn số tiền chính xác và cú pháp gạch nợ.
    - Cung cấp nút: `Lưu mã QR vào thư viện ảnh` và `Sao chép STK & Nội dung` để khách dán vào App Ngân hàng bất kỳ là thanh toán xong trong 5 giây.

---

### 3. Góc nhìn Kỹ thuật & Chi phí Vận hành (SaaS Operations & Zero-Cost Infrastructure)
* **Thực tế tài nguyên:** Là dự án khởi nghiệp / đồ án quy mô ban đầu, chi phí hạ tầng (Hosting, Database, Server) cần được duy trì ở mức tối thiểu hoặc $0.
* **Nguyên tắc kỹ thuật:**
  - **Kiến trúc Multi-tenant dạng Logical Separation:** Thay vì tạo riêng từng Database cho mỗi Chủ nhà (tốn tài nguyên, tốn chi phí và khó khăn trong bảo trì/migration), hệ thống áp dụng mô hình **Shared Database, Isolated Data**.
    - Tất cả các bảng/collection nghiệp vụ (`Rooms`, `Contracts`, `Invoices`, `UtilityReadings`...) đều bắt buộc gắn `landlordId`.
    - Thiết lập **Compound Indexes** cẩn thận: `{ landlordId: 1, createdAt: -1 }`, `{ invoiceCode: 1 }` để tốc độ truy vấn luôn dưới 50ms.
  - **Tối ưu Cloud Free Tier:**
    - **Database:** MongoDB Atlas (M0 Cluster - 512MB Free Tier đủ sức phục vụ hàng ngàn giao dịch hóa đơn nếu tối ưu document).
    - **Backend:** Node.js Express deploy trên Render / Railway (Free/Hobby Tier).
    - **Frontend:** React / Vite deploy trên Vercel / Netlify (Free Tier).
    - **Gạch nợ tự động:** Tích hợp Webhook biến động số dư qua dịch vụ mở (như SePay / Casso) với chi phí thấp hoặc cổng mở, tự động nhận diện giao dịch không cần can thiệp người dùng.

---

# PHẦN 2: PHÂN TÍCH CHI TIẾT KIẾN TRÚC & QUY TRÌNH NGHIỆP VỤ

## 1. Luồng Nghiệp vụ Trọng tâm: "Từ Chốt Số Điện/Nước đến Gạch Nợ Tự Động"

```
[Quản lý Cơ sở (Property Manager)]
      │
      ├─► (1) Nhập số Điện/Nước đầu - cuối kỳ trên Mobile Web (Bàn phím số 1 tay)
      │
[Hệ thống Backend (Express API)]
      │
      ├─► (2) Tính toán: [Tiền phòng + (Δ Điện x Giá) + (Δ Nước x Giá) + Phí dịch vụ cố định]
      ├─► (3) Tạo Hóa đơn (Invoice) trong DB -> Trạng thái: UNPAID
      ├─► (4) Sinh mã VietQR Động chứa Syntax: [STK Chủ trọ + Số tiền chuẩn + Cú pháp: HDxxx]
      ├─► (5) Gửi Notification (Zalo/Email) kèm Link xem Hóa đơn cho Người thuê
      │
[Người thuê trọ (Tenant)]
      │
      ├─► (6) Mở Link, quét VietQR / Chuyển tiền qua App Ngân hàng cá nhân
      │
[Cổng Thanh toán / Ngân hàng / SePay Webhook]
      │
      ├─► (7) Bắn HTTP POST Request (Biến động số dư) sang Server Backend
      │
[Hệ thống Backend (Xử lý Idempotency & Đối soát)]
      │
      ├─► (8) Parser Regex đọc Nội dung chuyển khoản -> Bóc tách mã Hóa đơn "HDxxx"
      ├─► (9) So khớp: Số tiền thực nhận == Số tiền Hóa đơn yêu cầu
      ├─► (10) Đổi trạng thái Hóa đơn: UNPAID -> PAID + Lưu log giao dịch Payment
      └─► (11) Bắn tin nhắn Cảm ơn / Cập nhật biên lai cho Khách thuê & Chủ nhà qua Realtime (Socket.io)
```

---

## 2. Chi tiết 11 Bước trong Luồng Trọng tâm

### Bước 1: Quản lý cơ sở chốt chỉ số
- Giao diện dạng danh sách cuộn nhanh: Phòng 101, Phòng 102, Phòng 103...
- Hiển thị sẵn **Chỉ số tháng trước**. Quản lý chỉ cần gõ **Chỉ số tháng này**.
- **Quy tắc chặn lỗi (Validation Guard):**
  - $\text{Chỉ số mới} \ge \text{Chỉ số cũ}$. Nếu nhỏ hơn, chặn không cho lưu và cảnh báo đỏ ngay tại ô nhập.
  - Nếu tiêu thụ điện tăng vọt $> 2.5$ lần mức bình thường: Bật popup cảnh báo *"Lượng điện tăng bất thường, vui lòng kiểm tra lại đồng hồ trước khi xác nhận"*.

### Bước 2: Công thức tính toán Hóa đơn tự động
$$\text{Tổng tiền hóa đơn} = \text{Tiền phòng} + (E_{mới} - E_{cũ}) \times P_{điện} + W_{tính} \times P_{nước} + \sum \text{Phí cố định} + \text{Phí phát sinh} - \text{Giảm trừ}$$
Trong đó:
- $W_{tính}$: Số khối nước tiêu thụ (nếu đo bằng đồng hồ) HOẶC số người ở thực tế (nếu tính theo đầu người).
- Phí cố định: Internet, Vệ sinh rác, Gửi xe.

### Bước 3 & 4: Khởi tạo Hóa đơn & Sinh mã VietQR Động
- Hóa đơn được tạo với mã định danh duy nhất trong toàn hệ thống, ví dụ: `HD1024`.
- Trạng thái khởi tạo: `UNPAID`.
- Sinh chuỗi URL hình ảnh VietQR theo chuẩn QuickLink NAPAS 247:
  ```text
  https://img.vietqr.io/image/<BANK_ID>-<ACCOUNT_NO>-compact2.png?amount=<TOTAL_AMOUNT>&addInfo=HD1024 P301&accountName=<ACCOUNT_NAME>
  ```
  - `addInfo` được chuẩn hóa cú pháp: `HD<invoiceNumber> P<roomNumber>` (Ví dụ: `HD1024 P301`).

### Bước 5: Gửi thông báo No-App cho Khách thuê
- Khách thuê nhận được tin nhắn Zalo/Email:
  > *"Thông báo tiền phòng Tháng 09/2026 - Phòng 301. Tổng tiền: 3.450.000đ. Nhấn vào link sau để xem chi tiết và thanh toán: https://wdp301.app/i/HD1024"*
- Link chứa token công khai an toàn, mở trực tiếp hóa đơn mà không đòi hỏi mật khẩu phiền toái.

### Bước 6: Khách thanh toán qua App Ngân hàng
- Khách mở link $\rightarrow$ chọn **Mở App Ngân hàng quét QR** hoặc **Sao chép STK & Số tiền**.
- Khi chuyển khoản, nội dung `HD1024 P301` được giữ nguyên vẹn trong tin nhắn ngân hàng.

### Bước 7: Webhook biến động số dư chuyển về Backend
- SePay / Cổng ngân hàng gửi một `POST /api/v1/payments/webhook` chứa payload:
  ```json
  {
    "id": 982342,
    "gateway": "MBBank",
    "transactionDate": "2026-09-10 16:30:00",
    "accountNumber": "0987654321",
    "amount": 3450000,
    "content": "HD1024 P301 chuyen tien phong thang 9",
    "referenceCode": "FT26253198716"
  }
  ```

### Bước 8 & 9: Parser Regex & So khớp (Xử lý Idempotency chống trừ trùng)
- **Kiểm tra Idempotency (Chống xử lý lặp):** 
  - Tìm trong bảng `Payments` xem `referenceCode` (Mã giao dịch ngân hàng) này đã xử lý chưa. Nếu đã có $\rightarrow$ Trả về `HTTP 200 OK` ngay lập tức để tránh gạch nợ 2 lần.
- **Regex bóc tách mã hóa đơn:**
  - Regex pattern: `/HD\d{3,8}/i`
  - Kết quả trích xuất: `HD1024`.
- **So khớp số tiền:**
  - Tìm hóa đơn `HD1024` trong cơ sở dữ liệu.
  - Nếu `amount_nhan >= invoice.totalAmount`:
    - Chuyển `invoice.status = 'PAID'`.
    - Lưu lại lịch sử giao dịch trong `Payments`.
  - Nếu `amount_nhan < invoice.totalAmount`:
    - Chuyển `invoice.status = 'PARTIALLY_PAID'`.
    - Ghi nhận số tiền còn thiếu vào công nợ phòng.

### Bước 10 & 11: Hoàn tất & Realtime Feedback qua Socket.io
- Cập nhật cơ sở dữ liệu.
- Kích hoạt sự kiện Socket.io: `socket.emit('invoice_paid', { invoiceId: 'HD1024', room: 'P301' })`.
- Màn hình Web của Khách thuê ngay lập tức hiện dấu tích xanh: **"Thanh toán thành công! Biên lai đã được lưu."**
- Dashboard của Chủ nhà / Quản lý tự động nhảy số tiền thu mới mà không cần F5 tải lại trang.

---

# PHẦN 3: BỘ QUY TẮC MÃ NGUỒN & CƠ SỞ DỮ LIỆU (TECHNICAL RULES)

## 1. Quy tắc Thiết kế Database (MongoDB Multi-tenancy)
1. **Cô lập dữ liệu (Logical Isolation):**
   - Mọi model con (`Room`, `Contract`, `UtilityReading`, `Invoice`, `Payment`, `Incident`) **BẮT BUỘC** phải có trường:
     ```javascript
     landlordId: {
       type: mongoose.Schema.Types.ObjectId,
       ref: "User",
       required: true,
       index: true
     }
     ```
2. **Nguyên tắc truy vấn an toàn (Mandatory Query Filter):**
   - Mọi controller khi tìm kiếm dữ liệu đều phải kèm `landlordId` lấy từ JWT Token:
     ```javascript
     // CHUẨN:
     const rooms = await Room.find({ landlordId: req.user.landlordId });
     // CẤM: Không bao giờ được gọi Room.find() thiếu landlordId!
     ```
3. **Compound Indexing tối ưu Free Tier (512MB RAM):**
   - `Invoices`: `{ landlordId: 1, status: 1, createdAt: -1 }`
   - `Invoices`: `{ invoiceCode: 1 }` (Unique)
   - `Payments`: `{ referenceCode: 1 }` (Unique - chống duplicate webhook)
   - `Rooms`: `{ landlordId: 1, branchId: 1, roomNumber: 1 }`

## 2. Quy tắc Backend (Node.js MVC)
- **Tách bạch Controller và Service:** Logic tính toán hóa đơn phức tạp (điện, nước, bậc thang, giảm giá) nên viết thành hàm helper riêng trong `services/invoiceService.js`, không nhồi nhét vào Controller.
- **Xử lý Transaction:** Khi tạo hóa đơn và cập nhật chỉ số điện nước, hoặc khi gạch nợ thanh toán, sử dụng `mongoose.startSession()` để đảm bảo tính toàn vẹn dữ liệu (ACID).
- **Format API Response nhất quán:**
  ```json
  {
    "success": true,
    "message": "Thanh toán hóa đơn thành công",
    "data": { ... }
  }
  ```

## 3. Quy tắc Frontend & Toàn vẹn Dữ liệu (Zero Mock Data Policy)
- **NGHIÊM CẤM DỮ LIỆU GIẢ / DEMO (Zero Mock Data - 100% Live MongoDB Data):**
  - Tuyệt đối **CẤM** hardcode dữ liệu giả, mảng mẫu (dummy/mock array), số liệu tĩnh (như "10 phòng", "5.000.000đ", `const mockRooms = [...]`) trên bất kỳ màn hình nào của Frontend (Dashboard, Cơ sở, Phòng, Hợp đồng, Hóa đơn, Sự cố, Admin).
  - Tất cả thông tin hiển thị và số liệu thống kê **BẮT BUỘC 100% phải được fetch từ API Backend và truy vấn trực tiếp từ cơ sở dữ liệu MongoDB**.
  - **Quy chuẩn Xử lý Trạng thái Rỗng (Empty State First-Class Citizen):**
    - Khi người dùng mới đăng ký hoặc cơ sở chưa phát sinh dữ liệu, hệ thống **phải hiển thị giao diện Empty State chuyên nghiệp**: Biểu tượng minh họa, dòng thông điệp rõ ràng (*"Chưa có phòng nào được tạo"*, *"Tháng này chưa phát sinh hóa đơn"*, *"Doanh thu: 0đ"*).
    - Đi kèm **Nút hành động dẫn dắt (Call To Action - CTA)** như: `+ Thêm phòng mới`, `+ Tạo hợp đồng ngay`.
    - Tuyệt đối **KHÔNG ĐƯỢC** tự ý bịa dữ liệu giả để lấp đầy giao diện khi dữ liệu rỗng.
  - **Môi trường Phát triển & Kiểm thử (Seed Script Only):** Khi dev hoặc demo tính năng cho giảng viên/khách hàng, toàn bộ nhóm bắt buộc chạy script nạp dữ liệu chuẩn:
    ```bash
    npm run seed
    ```
    Script [BE/seeds/seed.js](file:///d:/KI8/WDP301/project/BE/seeds/seed.js) sẽ tự động nạp dữ liệu thật vào MongoDB để Frontend gọi API hiển thị.
- **Mobile First cho Quản lý:** Bàn phím số tự động bật lên (`input type="number" pattern="[0-9]*" inputmode="numeric"`), hỗ trợ nút Next nhảy ngay sang phòng tiếp theo mà không cần chạm tay vào ô khác.
- **Tenant Invoice View:** Tải trang dưới 1.5 giây, hiển thị mã VietQR to rõ ràng ở trung tâm màn hình, tương thích mọi kích thước điện thoại.

---

## 4. Quy tắc Xác thực & Phân quyền (Authentication & RBAC - Option B)

Hệ thống tuân thủ chuẩn xác thực **Enterprise SaaS Multi-tenancy** nhằm bảo mật tối đa dữ liệu giữa các chuỗi trọ và ngăn chặn rác dữ liệu:

### 1. Kiến trúc Bảo mật 2 Tầng Token (OWASP Compliant)
- **Access Token (15 phút):** Lưu trữ hoàn toàn trong **Bộ nhớ React (In-Memory State)**. Tuyệt đối **CẤM** lưu Access Token trong `localStorage` hoặc `sessionStorage` để triệt tiêu nguy cơ tấn công XSS.
- **Refresh Token (7 ngày):** Được lưu trữ trong **HttpOnly Cookie** (`httpOnly: true`, `sameSite: 'lax'`, `secure` trên production). Trình duyệt tự động gửi cookie này khi gọi API refresh.
- **Silent Refresh & Token Rotation:**
  - Client cấu hình interceptor tự động bắt mã lỗi `401 Token Expired`.
  - Gọi ngầm `POST /api/auth/refresh` để nhận Access Token mới và xoay vòng Refresh Token (Token Rotation).
  - Tự động thử lại (retry) request nghiệp vụ ban đầu mà người dùng không hề bị gián đoạn hay văng ra ngoài.
- **Thu hồi phiên (Revoke Sessions):** Trường `refreshTokens: [String]` trong Model `User` lưu danh sách token hợp lệ. Khi `POST /api/auth/logout`, token hiện tại sẽ bị xóa khỏi cơ sở dữ liệu và cookie bị clear.

### 2. Nguyên tắc Phân tầng Đăng ký (Multi-tenant Onboarding Guard)
```
[ Khách vãng lai ] ──► Đăng ký Public ──► CHỈ CẤP CHO VAI TRÒ: LANDLORD (Chủ chuỗi trọ)
                                               │
                                               ▼
                                      Tự động gán: landlordId = user._id
```
- **Chỉ LANDLORD được phép tự đăng ký (Public Register):** Ngăn chặn người lạ tự đăng ký làm `TENANT` hoặc `PROPERTY_MANAGER` mà không thuộc chuỗi trọ nào.
- **PROPERTY_MANAGER:** Do Landlord trực tiếp khởi tạo trong module Quản lý nhân sự, gán danh sách chi nhánh phụ trách (`assignedBranches`) và thừa hưởng `landlordId`.
- **TENANT (Khách thuê):** Tự động khởi tạo tài khoản khi Landlord/Manager tạo Hợp đồng thuê phòng (`Contract`).
- **ADMIN:** Tài khoản quản trị cấp cao nhất, quản lý toàn bộ các gói SaaS và tenant trong hệ thống.

### 3. Quy trình Xác thực Email Bắt buộc (Email Verification Flow)
1. Sau khi Landlord đăng ký thành công, tài khoản ở trạng thái `isEmailVerified: false`.
2. Hệ thống sinh token ngẫu nhiên bảo mật 32 bytes (`crypto.randomBytes`) kèm hạn sử dụng 24 giờ và gửi email kích hoạt HTML (kèm bản Plain Text theo chuẩn MIME) qua Nodemailer SMTP.
3. Khi đăng nhập (`POST /api/auth/login`), nếu tài khoản chưa xác thực email:
   - Trả về mã lỗi: `403 EMAIL_NOT_VERIFIED`.
   - Frontend hiển thị thông báo kèm nút **"Gửi lại link kích hoạt"** (`POST /api/auth/resend-verification`).
4. Khi người dùng nhấp vào link email:
   - Gọi `GET /api/auth/verify-email?token=...`.
   - Kích hoạt `isEmailVerified: true`, `status: 'ACTIVE'`.
   - Tự động cấp Access Token và Cookie Refresh Token để người dùng vào thẳng Dashboard.

### 4. Quy tắc Kiểm tra Quyền & Cô lập Dữ liệu (Enforce Tenant Middleware)
Mọi API tài nguyên nghiệp vụ bắt buộc phải gắn middleware `protect` và `authorize`:
```javascript
// Middleware protect giải mã JWT và gán Tenant Context:
req.user = user;
req.landlordId = user.role === "LANDLORD" ? user._id : user.landlordId;

// Middleware authorize kiểm tra RBAC:
router.post("/branches", protect, authorize("ADMIN", "LANDLORD"), createBranch);
```
Mọi truy vấn Mongoose trong Controller **BẮT BUỘC** phải lọc theo `req.landlordId`:
```javascript
// BẮT BUỘC:
const invoices = await Invoice.find({ landlordId: req.landlordId });
```
