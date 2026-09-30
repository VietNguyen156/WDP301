# ĐẶC TẢ DỰ ÁN & BỘ QUY TẮC PHÁT TRIỂN (PROJECT RULES)

## NỀN TẢNG B2B SAAS QUẢN LÝ & TỰ ĐỘNG HÓA HÓA ĐƠN NHÀ TRỌ / CĂN HỘ DỊCH VỤ

_(Pragmatic Boarding House Management SaaS Platform)_

---

# MỤC LỤC TỔNG THỂ

1. [01. Product Principles (Nguyên tắc sản phẩm)](#01-product-principles)
2. [02. System Architecture (Kiến trúc hệ thống)](#02-system-architecture)
3. [03. Roles & RBAC (Ma trận phân quyền 4 vai trò thống nhất)](#03-roles--rbac)
4. [04. Multi-tenancy & Tenant Context (Cô lập dữ liệu & Scope Helper)](#04-multi-tenancy--tenant-context)
5. [05. Database Rules & Soft Delete Policy (Quy tắc MongoDB & Xóa mềm)](#05-database-rules--soft-delete-policy)
6. [06. Backend MVC Rules (Quy tắc Backend Express)](#06-backend-mvc-rules)
7. [07. API Rules (Quy chuẩn thiết kế API)](#07-api-rules)
8. [08. Authentication & Security (Bảo mật, Rate Limit & Data Masking)](#08-authentication--security)
9. [09. Invoice & Billing Rules (Vòng đời hóa đơn & Phân định pháp lý)](#09-invoice--billing-rules)
10. [10. Payment, Webhook & Unmatched Engine (Bảo mật thanh toán & Xử lý nhầm lẫn)](#10-payment-webhook--unmatched-engine)
11. [11. Contract & Check-out Rules (Nghiệm thu trả cọc & Thanh lý)](#11-contract--check-out-rules)
12. [12. Utility Reading Rules (Chốt số điện nước & Đồng bộ hóa đơn)](#12-utility-reading-rules)
13. [13. Maintenance Rules (Quản lý sự cố & Ràng buộc tài chính)](#13-maintenance-rules)
14. [14. Notification Rules (Quy tắc thông báo đa kênh No-App)](#14-notification-rules)
15. [15. Frontend Architecture Rules (Quy chuẩn React & Trạng thái UI)](#15-frontend-architecture-rules)
16. [16. Realtime / Socket.io Rules (Giao tiếp thời gian thực sau commit)](#16-realtime--socketio-rules)
17. [17. Audit & Logging (Nhật ký kiểm toán hệ thống)](#17-audit--logging)
18. [18. Centralized Error Handling (Xử lý lỗi tập trung)](#18-centralized-error-handling)
19. [19. Performance & Optimization (Tối ưu hiệu năng Free-Tier)](#19-performance--optimization)
20. [20. Testing Pyramid (Chiến lược kiểm thử)](#20-testing-pyramid)
21. [21. Deployment & Infrastructure (Triển khai & Vận hành Cross-Site)](#21-deployment--infrastructure)
22. [22. Data Privacy & Masking (Bảo vệ dữ liệu cá nhân trên link No-App)](#22-data-privacy--masking-bảo-vệ-dữ-liệu-cá-nhân)
23. [23. Coding Conventions (Quy ước mã nguồn sạch)](#23-coding-conventions)

---

# 01. PRODUCT PRINCIPLES

1. **Zero-friction Mobile UX cho Quản lý cơ sở**:
   - Thao tác chốt số điện nước được thiết kế 1 tay trên điện thoại: Tự động bật bàn phím số, tự động nhảy phòng kế tiếp khi bấm lưu.
   - Có validation guard ngăn chặn nhập sai hoặc nhập tăng vọt bất thường.
2. **No-App Experience cho Khách thuê (Tenant)**:
   - Khách thuê không bắt buộc phải tải ứng dụng di động. Hóa đơn được gửi qua Web link an toàn `/i/:token`.
   - Xem hóa đơn minh bạch toàn bộ các khoản và thanh toán VietQR động trong 5 giây.
3. **Trực quan hóa Dòng tiền (3-Second Dashboard cho Chủ trọ)**:
   - Trả lời ngay lập tức 3 câu hỏi sống còn: Tháng này thu được bao nhiêu? Còn bao nhiêu phòng chưa đóng (quá hạn mấy ngày)? Tỷ lệ lấp đầy phòng là bao nhiêu %?
4. **Tách biệt Doanh thu SaaS và Tiền phòng**:
   - Doanh thu của Nền tảng SaaS là tiền bán gói phần mềm (`SaaSPlan`, `Subscription`, `PlatformInvoice`).
   - Tiền phòng, điện nước, cọc phòng là dòng tiền nội bộ của từng Chủ trọ (`LANDLORD`). Tuyệt đối không gộp chung vào báo cáo tài chính nền tảng.
5. **Zero Mock Data Policy (100% MongoDB Live Data)**:
   - Tuyệt đối cấm hardcode dữ liệu giả trên Frontend. Toàn bộ thông tin hiển thị phải được fetch từ API kết nối MongoDB thật.
6. **Bảo toàn Pháp lý & Chống Tranh chấp Dân sự**:
   - Mọi khoản thu (tiền phòng, cọc, phạt, bồi thường hư hại) đều phải có chứng từ, hình ảnh hiện trường và xác nhận 2 bên để tránh tranh chấp dân sự.

---

# 02. SYSTEM ARCHITECTURE

```
                                [ CLIENT TIER ]
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        ▼                              ▼                              ▼
  Desktop Web Admin             Mobile Web Manager              No-App Web Tenant
(React + Vite SaaS UI)        (React Mobile Recording)        (PWA / VietQR 1-Click)
        │                              │                              │
        └──────────────────────────────┼──────────────────────────────┘
                                       │ HTTPS / WSS
                                       ▼
                             [ API GATEWAY TIER ]
                        Express.js (Node.js REST API)
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         ▼                             ▼                             ▼
   [Middlewares]                [Core Services]               [Integrations]
 - Tenant Context Scope       - InvoiceService              - SePay Webhook (NAPAS 247)
 - Rate Limiter Guard         - UtilityService              - VietQR QuickLink API
 - Data Masking Filter        - AuditService                - Socket.io Realtime Engine
 - Error Centralizer          - SettlementService           - Unmatched Payment Engine
         │                             │                             │
         └─────────────────────────────┼─────────────────────────────┘
                                       │
                                       ▼
                            [ PERSISTENCE TIER ]
                    MongoDB Atlas (Replica Set / Multi-tenant)
                   ├── Platform-level Collections (No landlordId)
                   └── Tenant-level Collections (Compound Indexed landlordId)
```

---

# 03. ROLES & RBAC (CHI TIẾT CHỨC NĂNG 4 VAI TRÒ)

Hệ thống thống nhất định danh 4 vai trò với bảng phân quyền và chức năng chi tiết:

---

## 3.1. 🛡️ SUPER_ADMIN (Quản trị viên Cấp cao Nền tảng SaaS)

- **Đối tượng**: Đội ngũ phát triển và vận hành hệ thống phần mềm (Platform Owner).
- **Mục tiêu**: Quản lý việc kinh doanh phần mềm B2B SaaS, đảm bảo hạ tầng và kiểm soát các khách hàng doanh nghiệp (Chủ trọ).
- **Chức năng nghiệp vụ chi tiết**:
  1. **Quản trị Khách hàng B2B (Chủ trọ - `User.role = 'LANDLORD'`)**:
     - Xem danh sách toàn bộ các Chủ trọ đã đăng ký trên hệ thống kèm thông tin định danh (Họ tên, SĐT, Email, CCCD, ngày đăng ký, trạng thái).
     - **Duyệt đăng ký tài khoản từ Chủ trọ**: Xem yêu cầu đăng ký mới $\rightarrow$ Duyệt (`PENDING` $\rightarrow$ `APPROVED` $\rightarrow$ `ACTIVE`) hoặc Từ chối (`PENDING` $\rightarrow$ `REJECTED`).
     - **Khóa / Mở khóa tài khoản**: Chuyển trạng thái `ACTIVE` $\longleftrightarrow$ `SUSPENDED` (chặn đăng nhập khi vi phạm điều khoản hoặc gian lận).
  2. **Quản lý Gói cước SaaS (`SaaSPlan` CRUD)**:
     - Tạo, sửa, xóa, định giá các gói dịch vụ (`FREE_TRIAL`, `STARTER`, `PRO`, `ENTERPRISE`).
     - Thiết lập hạn ngạch tài nguyên cho từng gói: Số cơ sở tối đa (`maxBranches`), số phòng tối đa (`maxRooms`), số nhân viên quản lý tối đa (`maxManagers`), tính năng cho phép và thời gian dùng thử (`trialDays`).
  3. **Quản lý Thuê bao (Subscription) & Hóa đơn SaaS**:
     - **Xuất hóa đơn SaaS trước khi thanh toán**: Hệ thống xuất hóa đơn mua phần mềm (`PlatformInvoice`) với trạng thái `PENDING` $\rightarrow$ Khách thanh toán $\rightarrow$ `PAID`.
     - Quản lý thời hạn thuê bao, hỗ trợ gia hạn hoặc nâng cấp/hạ cấp gói cước thủ công.
     - **Thông báo gia hạn**: Hệ thống tự động gửi thông báo khi subscription sắp hết hạn (`FREE_TRIAL` $\rightarrow$ `PAID` $\rightarrow$ `RENEW` $\rightarrow$ `EXPIRED`).
  4. **Platform Analytics Dashboard (Đo lường Doanh thu Toàn sàn)**:
     - Theo dõi chỉ số **MRR (Monthly Recurring Revenue)** - Doanh thu định kỳ hàng tháng từ tiền bán phần mềm (tách biệt hoàn toàn với tiền thuê trọ của các chủ trọ).
     - **Thống kê người dùng toàn sàn**: Tổng số Landlord, Tenant, Manager; Số tài khoản đăng ký mới, số tài khoản bị khóa.
     - **Thống kê chậm thanh toán SaaS**: Danh sách các chuỗi trọ quá hạn thanh toán subscription.
     - Tổng số phòng đang hoạt động và **Tỷ lệ chuyển đổi** từ gói Dùng thử sang gói Trả phí.
- ⚠️ **Giới hạn Tuyệt đối**: Không xem/sửa chi tiết tiền phòng hay tài khoản ngân hàng nội bộ của Landlord.

---

## 3.2. 👑 LANDLORD (Chủ chuỗi Cơ sở / Chủ nhà trọ)

- **Đối tượng**: Khách hàng B2B trả tiền mua gói phần mềm để quản lý chuỗi phòng trọ/chung cư mini của mình.
- **Mục tiêu**: Tự động hóa vận hành, tối ưu tỷ lệ lấp đầy phòng và kiểm soát dòng tiền chính xác, minh bạch.
- **Chức năng nghiệp vụ chi tiết**:
  1. **3-Second Dashboard (Giám sát Dòng tiền & Tình trạng Phòng)**:
     - **Thống kê Cơ cấu Phòng & Tỷ lệ Lấp đầy**:
       - Tổng số phòng, phân loại: Đang thuê (`RENTED`), Phòng trống (`EMPTY`), Đang bảo trì (`MAINTENANCE`), Cần dọn dẹp (`CLEANING`).
       - **Tỷ lệ lấp đầy phòng**: $\text{Occupancy Rate} = \frac{\text{RENTED}}{\text{Total Active Rooms}} \times 100\%$.
     - **Giám sát Dòng tiền**: 3 số liệu sống còn: Tổng tiền thực thu vs dự thu, Danh sách các phòng nợ tiền kèm nút **"Sao chép tin nhắn nhắc nợ gửi Zalo"**, Tỷ lệ lấp đầy phòng (%).
  2. **Quản lý Cơ sở, Phòng & Sinh phòng hàng loạt**:
     - Thiết lập các Cơ sở/Tòa nhà (`Branch`), cấu hình đơn giá điện (kWh), hình thức tính nước (đồng hồ/đầu người/khoán), phí wifi, rác, gửi xe.
     - Tạo phòng đơn lẻ hoặc dùng công cụ **Sinh phòng nhanh hàng loạt** (ví dụ: Tầng 1 $\rightarrow$ 4, P.101 $\rightarrow$ P.405).
  3. **Quản lý Nhân sự Cơ sở (`PROPERTY_MANAGER`)**:
     - **Tạo tài khoản Quản lý**: Nhập Họ tên, SĐT, Email, CCCD $\rightarrow$ Hệ thống tạo tài khoản với `role = 'PROPERTY_MANAGER'`.
     - **Phân công chi nhánh phụ trách**: Gán danh sách cơ sở cụ thể (`assignedBranches = [BranchA, BranchB]`).
     - CRUD Quản lý: Xem danh sách, sửa thông tin, phân công lại chi nhánh, khóa/mở khóa tài khoản.
  4. **Quản lý Hợp đồng & Cấp tài khoản Tenant**:
     - **Ký hợp đồng mới**: Nhập thông tin khách (Họ tên, SĐT, CCCD, Quê quán) $\rightarrow$ Tự động tạo và kích hoạt tài khoản `TENANT` (xác thực OTP) $\rightarrow$ Cập nhật phòng `EMPTY` $\rightarrow$ `RENTED`, ghi nhận tiền cọc và chỉ số điện nước ban đầu.
     - **Thống kê Hợp đồng**: Danh sách hợp đồng đang hoạt động (`Active`), sắp hết hạn (`Expiring Soon` trong 30 ngày), đã hết hạn (`Expired`), đã thanh lý (`Terminated`).
     - **Thanh lý Hợp đồng**: Chốt chỉ số điện nước cuối cùng $\rightarrow$ Lập phiếu quyết toán cấn trừ cọc $\rightarrow$ Phòng chuyển `CLEANING`.
  5. **Tài chính & Thu tiền Tự động**:
     - Cấu hình số tài khoản ngân hàng nhận tiền để hệ thống sinh mã VietQR NAPAS 247.
     - **Xuất hóa đơn trước khi thanh toán**: Xuất hóa đơn hàng loạt sau khi chốt số điện nước, gửi link No-App cho khách qua Zalo/SMS/Email.
     - Theo dõi tiền về tự động qua Webhook SePay, hoặc bấm nút **"Xác nhận thu tiền mặt"**.
     - Xử lý các giao dịch chuyển khoản sai cú pháp (`UnmatchedPayment`) để gán thủ công vào đúng phòng.
  6. **Quản lý Sự cố**: Phê duyệt chi phí sửa chữa hỏng hóc và quyết định người chịu chi phí (Chủ nhà chịu hay Trừ vào cọc của khách).

---

## 3.3. 👷 PROPERTY_MANAGER (Quản lý Cơ sở / Nhân sự Vận hành)

- **Đối tượng**: Người quản lý được Chủ trọ thuê để trực tiếp trông coi, vận hành tại từng tòa nhà/chi nhánh.
- **Mục tiêu**: Giảm thiểu ma sát vận hành hằng ngày, xử lý tại chỗ nhanh gọn bằng điện thoại di động.
- **Chức năng nghiệp vụ chi tiết**:
  1. **Chốt số Điện/Nước Hàng tháng (Mobile-First UX)**:
     - Thao tác 1 tay trên điện thoại: Bàn phím số tự kích hoạt, phím "Tiếp tục" tự động nhảy sang phòng kế tiếp.
     - Kiểm soát chốt số: Cảnh báo đỏ tức thì nếu nhập số mới nhỏ hơn số cũ; cảnh báo popup nếu lượng điện tăng vọt $> 2.5$ lần.
  2. **Cập nhật Tiền Điện Nước & Gửi Thông báo đến Người thuê**:
     - Sau khi Quản lý nhập/chốt chỉ số: Hệ thống tự động tính toán ra số tiền điện và tiền nước của từng phòng $\rightarrow$ Cập nhật vào hóa đơn (`DRAFT`).
     - Hệ thống tự động gửi thông báo (SMS / Zalo / Email) đến người thuê: _"Hóa đơn tháng MM/YYYY của phòng [P.xxx] đã được cập nhật số điện nước. Vui lòng kiểm tra chi tiết."_
  3. **Tiếp nhận & Xử lý Yêu cầu Sự cố từ Người thuê**:
     - Tiếp nhận yêu cầu sửa chữa thiết bị từ Tenant trong cơ sở mình phụ trách.
     - Cập nhật trạng thái xử lý xuyên suốt: `PENDING` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `SOLVED` $\rightarrow$ `CLOSED`.
     - Xem ảnh hiện trường, ghi chú xử lý, giao việc cho thợ sửa, cập nhật chi phí vật tư và đánh dấu hoàn thành.
  4. **Giám sát Thực địa Cơ sở**:
     - Nắm bắt tình trạng phòng thực tế (đang thuê `RENTED`, phòng trống `EMPTY`, phòng cần dọn vệ sinh `CLEANING`, phòng bảo trì `MAINTENANCE`) tại các chi nhánh được giao.
     - Cập nhật trạng thái phòng vận hành giữa `EMPTY` $\longleftrightarrow$ `CLEANING` $\longleftrightarrow$ `MAINTENANCE`.
- ⚠️ **Ranh giới Phân quyền Nghiêm ngặt (RBAC Boundary)**:
  - **CHỈ ĐƯỢC** thao tác trong phạm vi các chi nhánh được phân công (`assignedBranches`).
  - **TUYỆT ĐỐI KHÔNG ĐƯỢC** xem doanh thu tài chính tổng của Chủ trọ, không xem MRR, không thể sửa tài khoản ngân hàng và không được can thiệp vào gói cước SaaS.

---

## 3.4. 📱 TENANT (Khách thuê phòng trọ)

- **Đối tượng**: Người thuê trọ (phần lớn là sinh viên, nhân viên văn phòng, Gen Z).
- **Mục tiêu**: Thanh toán hóa đơn nhanh chóng trong 5 giây mà không cần cài app phiền toái; phản ánh sự cố minh bạch.
- **Chức năng nghiệp vụ chi tiết**:
  1. **Cấp Tài khoản & Xác thực OTP**:
     - Tài khoản được tự động tạo khi Chủ trọ ký hợp đồng thuê phòng (dựa trên CCCD + SĐT).
     - Xác thực kích hoạt qua mã OTP gửi về điện thoại $\rightarrow$ Tài khoản chuyển sang trạng thái `ACTIVE`.
  2. **Trải nghiệm Nhận & Xem Hóa đơn No-App (`/i/:token`)**:
     - Nhận tin nhắn thông báo hóa đơn qua SĐT / Zalo / Email kèm link xem trực tiếp.
     - Mở hóa đơn tức thì dưới 1.5 giây mà **không cần đăng nhập tài khoản**.
     - Xem chi tiết minh bạch từng khoản: Tiền phòng, số điện cũ - mới, số nước cũ - mới, tiền rác, wifi, giảm giá, tổng tiền.
  3. **Thanh toán 1-Click qua VietQR Động**:
     - Mở App ngân hàng quét mã VietQR đã nhúng sẵn số tiền chính xác và cú pháp gạch nợ chuẩn `HDxxx P...`.
     - Hoặc bấm nút "Lưu ảnh QR" hoặc "Sao chép STK & Nội dung" để dán vào App ngân hàng.
     - Nhận phản hồi thanh toán thành công (dấu tích xanh) ngay tức thì trên màn hình nhờ Socket.io.
  4. **Báo cáo Hỏng hóc / Sự cố**:
     - Gửi yêu cầu sửa chữa thiết bị trong phòng (bình nóng lạnh hỏng, vòi nước rò rỉ...) kèm ảnh chụp hiện trường để Quản lý và Chủ trọ xử lý.
     - Theo dõi tiến trình sửa chữa theo thời gian thực (`PENDING` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `SOLVED`).
  5. **Hồ sơ Cá nhân (Khi đăng nhập Web Portal)**:
     - Xem thông tin cá nhân, phòng đang thuê, chi tiết hợp đồng thuê phòng của bản thân.
     - Xem toàn bộ lịch sử các kỳ hóa đơn đã thanh toán và lịch sử các yêu cầu bảo trì đã gửi.

---

# 04. MULTI-TENANCY & TENANT CONTEXT

### 1. Phân tầng Collections (Platform-Level vs Tenant-Level)

- **Platform-Level Collections (Không cần `landlordId`)**:
  - `User` (với `SUPER_ADMIN`, hoặc `LANDLORD` thì `landlordId: null`).
  - `SaaSPlan`: Danh mục các gói dịch vụ SaaS (`FREE_TRIAL`, `STARTER`, `PRO`, `ENTERPRISE`).
  - `Subscription`: Thuê bao mua gói SaaS của Chủ trọ.
  - `PlatformInvoice`: Hóa đơn tiền phần mềm giữa Nền tảng và Chủ trọ.
  - `PlatformSetting`: Cấu hình hệ thống toàn sàn.
  - `AuditLog`: Nhật ký kiểm toán toàn sàn.

- **Tenant-Level Collections (BẮT BUỘC phải có `landlordId: ObjectId`)**:
  - `Branch`: Cơ sở / Tòa nhà trọ.
  - `Room`: Danh sách phòng trọ.
  - `Contract`: Hợp đồng thuê phòng.
  - `UtilityReading`: Bản ghi chốt số điện / nước.
  - `Invoice`: Hóa đơn tiền thuê phòng hàng tháng.
  - `Payment`: Lịch sử thanh toán tiền phòng (Webhook SePay / Tiền mặt).
  - `MaintenanceRequest` (Incident): Yêu cầu sửa chữa, bảo trì thiết bị.
  - `Notification`: Thông báo gửi đến cư dân / chủ nhà.
  - `UnmatchedPayment`: Giao dịch chuyển khoản sai cú pháp/treo chờ đối soát.

### 2. Tenant Context Security Scope Helper (Phân biệt Branch vs Sub-models)

Để tránh lỗi tìm sai trường khi Manager query danh sách cơ sở, hệ thống quy định helper chuyên biệt:

```javascript
// Scope áp dụng cho các tài nguyên con (Room, Contract, Invoice, UtilityReading, Incident...)
const getTenantScope = (req) => {
  const { user } = req;

  if (user.role === "LANDLORD") {
    return { landlordId: user._id };
  }

  if (user.role === "PROPERTY_MANAGER") {
    return {
      landlordId: user.landlordId,
      branchId: { $in: user.assignedBranches || [] },
    };
  }

  if (user.role === "TENANT") {
    return {
      tenantId: user._id,
      landlordId: user.landlordId,
    };
  }

  if (user.role === "SUPER_ADMIN") {
    return {};
  }

  throw new ForbiddenError("Không xác định được phạm vi truy cập hợp lệ");
};

// Scope áp dụng RIÊNG cho collection Branch (Do Branch có khóa chính là _id)
const getBranchScope = (req) => {
  const { user } = req;

  if (user.role === "LANDLORD") {
    return { landlordId: user._id };
  }

  if (user.role === "PROPERTY_MANAGER") {
    return {
      landlordId: user.landlordId,
      _id: { $in: user.assignedBranches || [] },
    };
  }

  if (user.role === "SUPER_ADMIN") {
    return {};
  }

  throw new ForbiddenError("Không có quyền truy cập cơ sở này");
};
```

---

# 05. DATABASE RULES & SOFT DELETE POLICY

### 1. Chính sách Xóa mềm (Soft Delete Policy - Bảo toàn Dữ liệu Kế toán)

- **Vấn đề thực tế**: Nếu xóa cứng (`deleteOne`/`deleteMany`) một Phòng hoặc Cơ sở đã từng phát sinh giao dịch, toàn bộ các hóa đơn, hợp đồng cũ sẽ bị mất liên kết (`orphan`), gây lỗi vỡ giao diện lịch sử và sai lệch sổ sách tài chính.
- **Quy tắc Bắt buộc**:
  1. Các model `Branch`, `Room`, `Contract`, `User` **BẮT BUỘC áp dụng Xóa mềm**:
     ```javascript
     status: { type: String, enum: ["ACTIVE", "INACTIVE", ...], default: "ACTIVE" },
     isDeleted: { type: Boolean, default: false }
     ```
  2. **Điều kiện cho phép Xóa cứng (Hard Delete)**: Chỉ được phép xóa cứng khi đối tượng đó **HOÀN TOÀN CHƯA PHÁT SINH HỢP ĐỒNG HOẶC HÓA ĐƠN NÀO** trong cơ sở dữ liệu.
  3. Mọi query thông thường mặc định kèm bộ lọc: `{ isDeleted: false }`.

### 2. Compound Indexing tối ưu SaaS Multi-tenancy

- `Invoices`: `{ landlordId: 1, invoiceCode: 1 }` (**UNIQUE**) — Không dùng invoiceCode độc lập toàn cầu.
- `Invoices`: `{ landlordId: 1, status: 1, billingPeriod: -1 }`.
- `Invoices`: `{ landlordId: 1, status: 1, dueDate: 1 }` (Tối ưu lọc công nợ).
- `Payments`: `{ referenceCode: 1 }` (**UNIQUE** — chống duplicate webhook).
- `Rooms`: `{ landlordId: 1, branchId: 1, roomNumber: 1 }` (**UNIQUE**).
- `UtilityReadings`: `{ landlordId: 1, branchId: 1, roomId: 1, billingPeriod: 1 }` (**UNIQUE**).
- `Contracts`: `{ landlordId: 1, roomId: 1, status: 1 }`.

### 3. Quy tắc Tiền tệ (Integer Currency) & Thời gian

- **Tuyệt đối KHÔNG dùng JS Float cho tiền tệ**: Lưu tiền bằng số nguyên VNĐ (`totalAmount: 3450000`).
- Database luôn lưu trữ `Date` ở chuẩn **UTC**. Kỳ hóa đơn bắt buộc dùng chuỗi `billingPeriod: "YYYY-MM"`. Múi giờ kinh doanh: `Asia/Ho_Chi_Minh` (GMT+7).

---

# 06. BACKEND MVC RULES

1. **Nguyên tắc "Skinny Controller - Fat Service"**:
   - Controller chỉ làm 3 việc: Nhận request, Kiểm tra quyền truy cập (Auth/Scope), Trả response qua chuẩn format.
   - Toàn bộ logic tính toán phức tạp (tiền điện bậc thang, lũy tiến, chia tiền nước, kiểm tra chỉ số cũ/mới, sinh mã VietQR, cấn trừ cọc) **bắt buộc nằm trong thư mục `services/`**.
2. **Quản lý Transaction cho Nghiệp vụ Trọng yếu**:
   - Bắt buộc dùng Transaction khi:
     - Chốt chỉ số điện nước $\rightarrow$ Cập nhật `Room.currentElectricIndex` $\rightarrow$ Sinh bản ghi `UtilityReading` $\rightarrow$ Cập nhật `Invoice`.
     - Gạch nợ Webhook $\rightarrow$ Tạo `Payment` record $\rightarrow$ Cập nhật `Invoice.status = PAID` $\rightarrow$ Commit Transaction $\rightarrow$ Phát sự kiện Socket.io.
3. **Audit Trail tự động**:
   - Mọi thao tác ghi đè, xóa hoặc thay đổi trạng thái nhạy cảm đều phải gọi `auditService.log(...)`.

---

# 07. API RULES

### 1. Chuẩn hóa Format Response nhất quán 100%

- **Thành công (HTTP 200, 201)**:
  ```json
  {
    "success": true,
    "message": "Xử lý thành công",
    "data": { ... }
  }
  ```
- **Thất bại (HTTP 4xx, 5xx)**:
  ```json
  {
    "success": false,
    "message": "Thông điệp lỗi thân thiện",
    "errorCode": "STANDARD_ERROR_CODE",
    "data": null,
    "errors": [ ... ]
  }
  ```

### 2. Danh mục Mã lỗi HTTP chuẩn

- `400 VALIDATION_ERROR`: Dữ liệu đầu vào sai định dạng.
- `401 UNAUTHORIZED`: Thiếu token hoặc token hết hạn.
- `403 FORBIDDEN`: Không có quyền truy cập chi nhánh/tài nguyên này.
- `404 NOT_FOUND`: Không tìm thấy bản ghi.
- `409 CONFLICT`: Xung đột dữ liệu (mã hóa đơn trùng, phòng đang có hợp đồng hoạt động).
- `422 BUSINESS_RULE_ERROR`: Vi phạm luật nghiệp vụ (sửa hóa đơn đã PAID, chỉ số mới nhỏ hơn cũ).
- `429 TOO_MANY_REQUESTS`: Vượt quá giới hạn gọi API (Rate limit).
- `500 INTERNAL_SERVER_ERROR`: Lỗi hệ thống server không mong muốn.

### 3. Chuẩn hóa Model và Field

- Tên model dùng **PascalCase**, số ít: `User`, `Branch`, `Room`, `Contract`, `UtilityReading`, `Invoice`, `Payment`, `AuditLog`, `UnmatchedPayment`, `SaaSPlan`, `Subscription`, `PlatformInvoice`, `Incident`.
- Tên field dùng **camelCase**, mô tả rõ nghiệp vụ; không dùng tên viết tắt tùy ý.
- Khóa tham chiếu dùng hậu tố `Id` và kiểu `ObjectId`: `landlordId`, `branchId`, `roomId`, `contractId`, `tenantId`, `invoiceId`.
- Model phải được đặt trong `BE/models/` và export tập trung tại `BE/models/index.js`.
- Trạng thái phải là enum chữ hoa, không lưu chuỗi trạng thái tự do.
- Ngày giờ lưu kiểu `Date` theo UTC; kỳ hóa đơn dùng chuỗi `billingPeriod` định dạng `YYYY-MM`.
- Tiền tệ lưu bằng số nguyên VNĐ, không dùng JavaScript Float.
- Không nhận `landlordId`, `tenantId` hoặc quyền từ dữ liệu client nếu các giá trị đó có thể suy ra từ token và resource scope.

### 4. Chuẩn hóa API Endpoint

- Mọi API nghiệp vụ mới bắt buộc dùng prefix `/api/v1`.
- Dùng danh từ số nhiều cho resource: `/branches`, `/rooms`, `/contracts`, `/invoices`, `/payments`, `/incidents`.
- Dùng nested resource khi quan hệ trực tiếp giúp giới hạn scope, ví dụ `/branches/:branchId/rooms` và `/invoices/:invoiceId/payments`.
- Dùng HTTP method đúng ngữ nghĩa: `GET` để đọc, `POST` để tạo/workflow, `PUT` để cập nhật, `DELETE` chỉ cho xóa mềm.
- Workflow nghiệp vụ dùng action rõ ràng, ví dụ `/invoices/:invoiceId/issue`, `/contracts/:contractId/terminate`, `/payments/webhook` và `/payments/cash`.
- Invoice public dùng API `GET /api/v1/invoices/public/:publicAccessToken`; frontend route tương ứng là `/i/:token`.
- Không tạo endpoint trùng chức năng chỉ khác tên; thay đổi breaking phải tăng version API.

### 5. Chuẩn Request và Response

- Request body dùng JSON và phải validate ở boundary trước khi gọi service.
- Client không được tự gửi các field bảo mật hoặc scope như `landlordId`, `confirmedBy`, `actorId`, `paidAmount`, `remainingAmount`, `status` nếu server có thể tự tính.
- Request có xác thực phải gửi `Authorization: Bearer <access-token>` và `Content-Type: application/json`.
- Response thành công dùng thống nhất:
  ```json
  {
    "success": true,
    "message": "Xử lý thành công",
    "data": {}
  }
  ```
- Response lỗi dùng thống nhất:
  ```json
  {
    "success": false,
    "message": "Thông điệp lỗi thân thiện",
    "errorCode": "STANDARD_ERROR_CODE",
    "data": null,
    "errors": []
  }
  ```
- Không trả password, refresh token, raw webhook hoặc dữ liệu nhạy cảm không cần thiết trong response.

### 6. Role và Quyền Truy cập

- `SUPER_ADMIN`: quản lý SaaS plan, landlord, subscription và platform analytics; không xem hoặc sửa chi tiết tiền phòng nội bộ của landlord.
- `LANDLORD`: toàn quyền trong tenant scope của chính mình; được xác nhận thu tiền mặt ở mọi branch thuộc landlord.
- `PROPERTY_MANAGER`: chỉ thao tác trong `assignedBranches`; được xem phòng, chốt điện nước, xử lý incident và xác nhận thu tiền mặt tại branch được giao; không xem doanh thu tổng hoặc sửa bank config/SaaS.
- `TENANT`: chỉ xem dữ liệu của mình, invoice public bằng token và tạo/theo dõi incident thuộc hợp đồng; không tạo/xác nhận Payment, sửa Invoice hoặc truy cập dashboard landlord.
- Mọi route phải khai báo authentication, role authorization và tenant/branch scope trước controller.

### 7. Chuẩn Error Code

- Mã lỗi nghiệp vụ dùng `SCREAMING_SNAKE_CASE`, ổn định và độc lập với thông điệp tiếng Việt.
- Mã bắt buộc gồm: `AUTH_REQUIRED`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `INVALID_ID`, `VALIDATION_ERROR`, `CONFLICT`, `QUOTA_EXCEEDED`, `BRANCH_SCOPE_FORBIDDEN`, `LANDLORD_SCOPE_FORBIDDEN`, `INVOICE_ALREADY_PAID`, `INVOICE_CANCELLED`, `INVOICE_NOT_ISSUED`, `PAYMENT_AMOUNT_INVALID`, `PAYMENT_REFERENCE_DUPLICATED`, `PAYMENT_NOT_ALLOWED`, `READING_LOWER_THAN_PREVIOUS`, `READING_ALREADY_BILLED`, `BUSINESS_RULE_ERROR`, `TOO_MANY_REQUESTS`, `INTERNAL_SERVER_ERROR`.
- Không dùng message để frontend quyết định logic; frontend phải dựa vào `errorCode`.

### 8. Vòng đời Invoice và Payment

- Invoice chỉ dùng các trạng thái: `DRAFT`, `ISSUED`, `PARTIALLY_PAID`, `PAID`, `OVERPAID`, `CANCELLED`.
- `OVERDUE` là điều kiện suy diễn: `now > dueDate` và status là `ISSUED` hoặc `PARTIALLY_PAID`; không lưu `OVERDUE` thành status riêng.
- Payment chỉ dùng các trạng thái `SUCCESS`, `FAILED`, `REFUNDED` và các method `VIETQR`, `BANK_TRANSFER`, `CASH`.
- Payment `CASH` bắt buộc có số biên lai/reference duy nhất, `confirmedBy`, `transactionDate` và điểm thu nếu có.
- Server tự tính `remainingAmount = max(totalAmount - paidAmount, 0)` và `overpaidAmount = max(paidAmount - totalAmount, 0)`.
- Tạo Payment, cập nhật Invoice và ghi AuditLog phải nằm trong cùng MongoDB transaction.
- Invoice `PAID` hoặc `OVERPAID` không được sửa trực tiếp; phải dùng refund, adjustment note hoặc credit note.

### 9. Quy ước Branch, landlordId và tenantId

- `landlordId` là tenant root của branch, room, contract, utility reading, invoice, payment, incident và unmatched payment.
- Với `LANDLORD`, server lấy `landlordId` từ `req.user._id`; với `PROPERTY_MANAGER`, lấy từ `req.user.landlordId`.
- `PROPERTY_MANAGER` bắt buộc có `branchId` thuộc `req.user.assignedBranches`.
- Với `TENANT`, server lấy `tenantId` từ `req.user._id` và kiểm tra quan hệ contract/room tương ứng.
- `branchId` luôn tham chiếu đến `Branch._id`; không dùng `branchId` thay thế `landlordId` trong scope.
- Resource con phải kiểm tra đồng thời landlord scope và branch scope trước khi đọc hoặc ghi.
- Client không được tự chọn landlord khác bằng body, query string hoặc header `x-landlord-id` trong production.
- Query thông thường luôn kèm `isDeleted: false`; dữ liệu tài chính đã phát sinh không được hard delete.

---

# 08. AUTHENTICATION & SECURITY

### 1. Kiến trúc Bảo mật 2 Tầng Token & Cấu hình SameSite Cookie Cross-Site

- **Access Token (15 phút)**: Lưu trữ trong **React In-Memory State**. Tuyệt đối **CẤM** lưu Access Token vào `localStorage` hoặc `sessionStorage`.
- **Refresh Token (7 ngày) - Quy tắc SameSite theo Hạ tầng Triển khai**:
  - **Trường hợp 1: Triển khai Cross-Site (Vercel Frontend `xxx.vercel.app` & Render Backend `yyy.onrender.com`)**:
    - Cookie Refresh Token **BẮT BUỘC**: `httpOnly: true`, `secure: true`, `sameSite: "none"`.
    - Backend Express CORS **BẮT BUỘC**: `credentials: true` và gán `origin: process.env.CLIENT_URL` (Tuyệt đối **CẤM** dùng `*`).
  - **Trường hợp 2: Triển khai Cùng Tên Miền (Custom Domain: `app.wdp301.com` & `api.wdp301.com`)**:
    - Cấu hình: `sameSite: "lax"`, `secure: true`, `domain: ".wdp301.com"`.

### 2. Khóa Chặt Cơ chế Bypass Header (Strict Production Lock)

- Header `x-landlord-id` hoặc Mock Auth **CHỈ ĐƯỢC PHÉP HOẠT ĐỘNG KHI `NODE_ENV === 'development' || NODE_ENV === 'test'`**.
- Trên môi trường **Production (`NODE_ENV === 'production'`)**:
  - **TUYỆT ĐỐI CẤM MỌI HÌNH THỨC BYPASS**.
  - Bất kỳ request nào gửi kèm `x-landlord-id` trên production sẽ bị middleware từ chối ngay lập tức với mã lỗi `403 FORBIDDEN` và ghi log cảnh báo xâm nhập an ninh.

### 3. Rate Limiting cho Endpoint Công khai

- **Public Invoice Link (`/i/:token`)**: Giới hạn tối đa **60 requests/phút/IP** để ngăn chặn quét brute-force token.
- **Webhook Payment (`/api/payments/webhook`)**: Giới hạn tối đa **120 requests/phút/IP** để chống tấn công DoS.

---

# 09. INVOICE & BILLING RULES

### 1. Phân định Tính chất Pháp lý của Hóa đơn Tiền phòng

- **Quy chuẩn rõ ràng**: "Hóa đơn tiền phòng" trong hệ thống thực chất là **Giấy báo thu tiền phòng / Phiếu báo thu dịch vụ nội bộ (Billing Notice / Debit Note)**, KHÔNG PHẢI là Hóa đơn Giá trị gia tăng (VAT Invoice) do cơ quan Thuế quản lý.
- Trên giao diện web và bản in PDF, tiêu đề chuẩn là:
  > **GIẤY BÁO TIỀN PHÒNG & DỊCH VỤ - THÁNG MM/YYYY**
  > _(Ghi rõ: "Chứng từ nội bộ phục vụ thanh toán tiền thuê phòng")_. Điều này tránh hoàn toàn vi phạm về hành vi phát hành hóa đơn thương mại trái phép theo Nghị định 123/2020/NĐ-CP.

### 2. Vòng đời Chuẩn của Hóa đơn (Strict Invoice Lifecycle)

```
[DRAFT] (Bản nháp - Quản lý chốt số, có thể sửa đổi tự do)
   │
   ▼ Landlord bấm "Phát hành hóa đơn" (Khóa UtilityReading.isBilled = true)
[ISSUED] (Đã phát hành chính thức - Sinh mã VietQR, gửi link No-App cho Tenant, paidAmount = 0)
   │
   ├──────────────────────────────┬──────────────────────────────┐
   │ Khách trả 1 phần             │ Khách trả đủ                │ Khách trả dư
   ▼                              ▼                              ▼
[PARTIALLY_PAID]               [PAID]                        [OVERPAID]
   │                              │                              │
   └────────► Khách trả nốt ──────┤                              ▼
                                  ▼                    Ghi nhận vào Ví dư phòng
                          Biên lai hoàn tất            (Tự trừ vào hóa đơn kỳ sau)
```

- **Trạng thái hủy**: `CANCELLED` (bắt buộc kèm lý do hủy và ghi vào AuditLog).
- **Tách OVERDUE thành Trạng thái Suy diễn (Derived Condition)**:
  $$\text{isOverdue} = (\text{now} > \text{dueDate}) \quad \text{AND} \quad \text{status} \in [\text{'ISSUED'}, \text{'PARTIALLY\_PAID'}]$$

### 3. Bất biến Hóa đơn sau Thanh toán (PAID Immutability)

- **Quy tắc Thép**: Hóa đơn khi đã đạt trạng thái `PAID` hoặc `OVERPAID` **TUYỆT ĐỐI KHÔNG ĐƯỢC PHÉP CHỈNH SỬA TRỰC TIẾP** bất kỳ trường số tiền nào.
- Sai lệch tài chính phát sinh sau khi đã thanh toán bắt buộc xử lý qua:
  - **Phiếu điều chỉnh (Adjustment Note)**.
  - **Khấu trừ vào hóa đơn kỳ sau (Credit Note)**.
  - Hoặc **Phiếu hoàn tiền (Refund)**.

---

# 10. PAYMENT, WEBHOOK & UNMATCHED ENGINE

### 1. Pipeline Bảo mật Webhook 8 bước

1. **Verify Signature / Secret**: Xác thực chữ ký số hoặc Webhook Secret Header từ cổng thanh toán. Sai $\rightarrow$ `401 Unauthorized`.
2. **Validate Bank Account**: Kiểm tra số tài khoản nhận tiền trong payload có khớp chính xác với `landlord.bankConfig.accountNumber` không. Không khớp $\rightarrow$ Từ chối xử lý & Log cảnh báo.
3. **Check Idempotency**: Kiểm tra mã giao dịch ngân hàng `referenceCode` trong bảng `Payment`. Đã tồn tại $\rightarrow$ Trả về ngay `HTTP 200 OK` (chống xử lý lặp/trừ trùng).
4. **Parse invoiceCode**: Dùng Regex bóc tách mã hóa đơn từ nội dung giao dịch.
5. **Find Invoice & Scope**: Tìm hóa đơn trong DB, kiểm tra trạng thái không ở dạng `CANCELLED`.
6. **Validate Amount**: So khớp số tiền nhận với số tiền hóa đơn yêu cầu.
7. **Execute Mongo Transaction**: Tạo bản ghi `Payment`, cập nhật `Invoice` (`PAID` hoặc `PARTIALLY_PAID`), ghi `AuditLog`.
8. **Commit Transaction & Emit Socket.io**: Hoàn tất lưu DB rồi mới kích hoạt thông báo realtime.

### 2. Cơ chế Xử lý Chuyển khoản Nhầm / Sai Cú pháp (Unmatched Payment Engine)

- **Vấn đề thực tế**: Khách thuê chuyển tiền nhưng quên ghi nội dung, ghi sai số phòng hoặc ghi cú pháp không nhận dạng được.
- **Quy tắc xử lý**:
  1. Nếu Webhook nhận tiền thành công nhưng Regex không tìm thấy `invoiceCode` hợp lệ:
     - Hệ thống **KHÔNG ĐƯỢC BỎ QUA**, mà tự động tạo bản ghi trong bảng `UnmatchedPayment`:
       ```javascript
       {
         landlordId: ObjectId,
         referenceCode: "FT262...",
         amount: 3500000,
         content: "Nguyen Van A chuyen tien",
         senderAccountNumber: "...",
         senderBank: "...",
         status: "PENDING_REVIEW"
       }
       ```
  2. Trên Dashboard của Landlord hiển thị cảnh báo đỏ: _"Có 1 giao dịch nhận tiền chưa được đối soát"_.
  3. Landlord có nút **"Gán thủ công vào phòng [chọn phòng]"** $\rightarrow$ Hệ thống tự động liên kết với hóa đơn của phòng đó và chuyển trạng thái hóa đơn sang `PAID` kèm log audit.

---

# 11. CONTRACT & CHECK-OUT RULES

### 1. Ràng buộc Tính hợp lệ của Phòng

- Chỉ được tạo hợp đồng mới cho các phòng đang ở trạng thái `EMPTY`.
- Sau khi hợp đồng được kích hoạt: Tự động đổi trạng thái phòng `EMPTY` $\rightarrow$ `RENTED`.

### 2. Kích hoạt Tài khoản Tenant

- Khi ký hợp đồng, hệ thống tự động kiểm tra xem số điện thoại của Tenant đã có trong DB chưa:
  - Nếu chưa: Tạo mới `User` (`role = 'TENANT'`, `landlordId = contract.landlordId`).
  - Nếu đã có: Liên kết hợp đồng vào Tenant ID hiện hữu.

### 3. Quy trình Nghiệm thu Trả phòng & Quyết toán Tiền cọc (Check-out Settlement)

- **Nguyên tắc minh bạch tài chính**:
  1. **Chốt số điện nước kết thúc**: Ghi nhận chỉ số điện/nước tại thời điểm trả phòng, chụp ảnh đồng hồ.
  2. **Biên bản Nghiệm thu Vật tư**: Kiểm tra danh mục tài sản ban đầu; nếu có hư hỏng thiết bị, đính kèm ảnh và chi phí sửa chữa.
  3. **Hóa đơn Quyết toán Cuối cùng (Final Settlement Invoice)**:
     $$\text{Tiền cọc hoàn trả} = \text{Tiền cọc} - (\text{Tiền phòng nợ cũ} + \text{Điện nước cuối kỳ} + \text{Phí hư hại vật tư})$$
     - Nếu kết quả $> 0$: Chủ trọ hoàn lại tiền cọc thừa cho Tenant.
     - Nếu kết quả $< 0$: Tenant thanh toán số tiền còn thiếu trước khi rời đi.
  4. **Thanh lý Hợp đồng**: Hợp đồng chuyển `TERMINATED`. Phòng chuyển sang `CLEANING` để dọn dẹp đón khách mới.

---

# 12. UTILITY READING RULES

### 1. Cấu hình Giá Dịch vụ Điện & Nước

- Đơn giá điện/nước được cấu hình linh hoạt theo từng Cơ sở (`Branch`) hoặc ghi đè riêng theo từng Phòng (`Room`):
  - **Điện**: Đơn giá cố định/kWh (ví dụ 3.800đ/kWh).
  - **Nước**: Tính theo 3 phương thức: Theo đồng hồ đo ($m^3$), Theo đầu người ở thực tế (`BY_PERSON`), hoặc Thu trọn gói cố định phòng (`FIXED`).
- **Tính Bất biến của Biểu giá Lịch sử**: Khi Chủ trọ thay đổi đơn giá điện/nước của cơ sở, thay đổi này **CHỈ ÁP DỤNG CHO CÁC KỲ TƯƠNG LAI**, tuyệt đối không tự động tính lại các hóa đơn đã chốt trong quá khứ.

### 2. Cơ chế Đồng bộ: UtilityReading $\longrightarrow$ DRAFT $\longrightarrow$ ISSUED

1. Quản lý ghi số $\rightarrow$ Lưu `UtilityReading` (`isBilled: false`).
2. Hệ thống tự động tính toán và tạo/cập nhật `Invoice` ở trạng thái `DRAFT` (cho phép sửa chỉ số nếu nhập nhầm).
3. Chủ trọ bấm **"Phát hành hóa đơn"**:
   - `Invoice.status` chuyển `DRAFT` $\rightarrow$ `ISSUED`.
   - Cập nhật `UtilityReading.isBilled = true` $\rightarrow$ **Khóa cứng số liệu**, không cho sửa chỉ số kỳ này nữa.
   - Kích hoạt VietQR động và gửi link No-App cho khách thuê.

---

# 13. MAINTENANCE RULES

1. **Quy trình Xử lý Sự cố Chuẩn**:
   $$\text{TENANT tạo yêu cầu} \longrightarrow \text{PENDING} \longrightarrow \text{Tiếp nhận (IN\_PROGRESS)} \longrightarrow \text{Sửa xong (SOLVED)} \longrightarrow \text{Đóng phiếu (CLOSED)}$$
2. **Minh bạch Chi phí**:
   - Phiếu bảo trì bắt buộc ghi rõ: Mô tả hỏng hóc, Ảnh hiện trường, Chi phí vật tư/thợ, và **Người chịu phí** (`LANDLORD` hay `TENANT`/trừ tiền cọc).

---

# 14. NOTIFICATION RULES

1. **Đa kênh No-App**:
   - Hóa đơn và thông báo tiền phòng được gửi qua link trực tiếp qua SMS / Zalo OA / Email.
2. **Nội dung Nhắc nợ Thân thiện**:
   - Hỗ trợ nút sao chép nhanh nội dung nhắc nợ lịch sự để Chủ nhà gửi Zalo cho từng khách trọ.

---

# 15. FRONTEND ARCHITECTURE RULES

1. **Cấu trúc Thư mục Feature-based**:
   ```text
   FE/src/
   ├── assets/
   ├── components/       # Các UI Component dùng chung (Button, Modal, Table, Toast)
   ├── context/          # AuthContext, SocketContext
   ├── features/         # Module nghiệp vụ chuyên biệt (dashboard, branches, rooms, meter-reading, invoices, incidents)
   ├── services/         # Toàn bộ logic gọi API Axios nằm ở đây, không viết trực tiếp trong component
   └── utils/            # Helper format tiền tệ VNĐ, ngày tháng, regex
   ```
2. **Quy chuẩn Component UI**:
   - Tuyệt đối không gọi API trực tiếp trong các component render lớn. Mọi API logic phải nằm trong `services/`.
   - **Bắt buộc có đủ 3 trạng thái**: `LoadingState` (Skeleton/Spinner), `ErrorState` (Alert/Retry button), và `EmptyState` (Hình minh họa + Nút CTA).
   - Tối ưu Debounce (300ms) cho các ô tìm kiếm danh sách phòng/khách thuê.
   - Bắt buộc sử dụng **Toast Notification**. **TUYỆT ĐỐI CẤM** dùng hàm `alert()` mặc định của trình duyệt (_"local say"_).

---

# 16. REALTIME / SOCKET.IO RULES

1. **Phân chia Socket Rooms**:
   - `landlord:<landlordId>`: Nhận biến động doanh thu, hóa đơn mới được thanh toán.
   - `branch:<branchId>`: Quản lý nhận thông báo sự cố mới phát sinh.
   - `invoice:<invoiceId>`: Khách thuê mở trang hóa đơn sẽ join room này để nhận tín hiệu gạch nợ tức thì.
2. **Sự kiện Trọng tâm**:
   - `payment:success`: Bắn sau khi Transaction commit thành công $\rightarrow$ Màn hình khách thuê tự động chuyển tích xanh _"Thanh toán thành công"_ mà không cần F5.

---

# 17. AUDIT & LOGGING

1. **Schema AuditLog**:
   ```javascript
   {
     actorId: ObjectId,       // Ai thực hiện
     actorRole: String,       // SUPER_ADMIN, LANDLORD, PROPERTY_MANAGER
     landlordId: ObjectId,    // Chuỗi trọ nào
     action: String,          // CREATE_INVOICE, CANCEL_INVOICE, CONFIRM_CASH_PAYMENT, SETTLE_CONTRACT...
     entityType: String,      // INVOICE, CONTRACT, ROOM, BRANCH, PRICING
     entityId: ObjectId,      // ID của đối tượng bị thay đổi
     before: Object,          // Dữ liệu trước khi sửa
     after: Object,           // Dữ liệu sau khi sửa
     ipAddress: String,
     userAgent: String,
     createdAt: Date
   }
   ```
2. **Các hành động Bắt buộc Ghi Audit**:
   - Sửa đổi biểu giá điện/nước.
   - Thay đổi STK ngân hàng nhận tiền.
   - Hủy hóa đơn hoặc xác nhận thanh toán tiền mặt thủ công.
   - Gia hạn hoặc thanh lý hợp đồng thuê phòng.
   - Gán giao dịch chuyển khoản nhầm (`UnmatchedPayment`) vào hóa đơn.

---

# 18. CENTRALIZED ERROR HANDLING

1. **Kiến trúc Middleware Xử lý lỗi Tập trung**:
   - Tuyệt đối không dùng `throw new Error("Lỗi chung chung")`.
   - Định nghĩa các lớp lỗi kế thừa chuẩn: `AppError`, `ValidationError`, `NotFoundError`, `ForbiddenError`, `BusinessRuleError`.
2. **ErrorHandler Middleware**:
   - Bắt mọi lỗi từ Controller (thông qua `next(error)` hoặc Express async handler).
   - Đảm bảo server không bao giờ bị crash và luôn trả về đúng cấu trúc JSON `{ success: false, message, errorCode, data: null }`.

---

# 19. PERFORMANCE & OPTIMIZATION (CLOUD FREE-TIER)

1. **Tối ưu RAM 512MB MongoDB Atlas**:
   - Luôn sử dụng `.lean()` cho các query đọc chỉ hiển thị dữ liệu trên Frontend để giảm tải tiêu hao bộ nhớ Mongoose.
   - Giới hạn `limit()` và `skip()` trong mọi API lấy danh sách, không trả về toàn bộ hàng ngàn document cùng lúc.
2. **Tối ưu Bundle Size Frontend**:
   - Tách bundle bằng Dynamic Import (`React.lazy`).
   - Sử dụng Vite build tối ưu nén tài nguyên static.

---

# 20. TESTING PYRAMID

1. **Unit Tests (Nền tảng)**:
   - Viết Unit Test độc lập cho `services/invoiceService.js` (kiểm tra tính toán tiền điện bậc thang, làm tròn tiền, chia tiền nước).
   - Kiểm tra Validation Guard của chỉ số điện nước.
2. **Integration Tests (API & Webhook)**:
   - Giả lập bắn Webhook SePay với các kịch bản: Chuyển đủ tiền, chuyển thiếu tiền, chuyển thừa tiền, gửi lặp webhook (Idempotency), và chuyển nhầm cú pháp (`UnmatchedPayment`).
3. **E2E / Flow Verification**:
   - Kiểm thử toàn vẹn luồng: Nhập chỉ số $\rightarrow$ Xuất hóa đơn $\rightarrow$ Quét VietQR $\rightarrow$ Webhook $\rightarrow$ Nhận tích xanh Realtime.

---

# 21. DEPLOYMENT & INFRASTRUCTURE

1. **Kiến trúc Triển khai Không Tốn Chi Phí (Zero-Cost Stack)**:
   - **Database**: MongoDB Atlas (M0 Free Tier - 512MB).
   - **Backend**: Node.js Express trên Render / Railway.
   - **Frontend**: React + Vite trên Vercel / Netlify.
   - **Webhook**: Cổng nhận diện giao dịch ngân hàng mở (SePay / Casso).
2. **Bảo mật Biến Môi trường (Environment Variables)**:
   - Tuyệt đối không commit file `.env` lên GitHub.
   - Cung cấp file `.env.example` đầy đủ các key mẫu.

---

# 22. DATA PRIVACY & MASKING (BẢO VỆ DỮ LIỆU CÁ NHÂN)

### 1. Quy tắc Che mờ Dữ liệu (Data Masking) trên Link Public No-App (`/i/:token`)

- **Dữ liệu nhạy cảm**: Số CCCD/CMND, Số điện thoại, Quê quán, Hình ảnh hợp đồng.
- Khi khách thuê mở link hóa đơn công khai, hệ thống **BẮT BUỘC CHE MỜ** các trường nhạy cảm:
  - Họ tên: Hiển thị dạng che chữ cái giữa: `Nguyễn V*** A***`.
  - Số điện thoại: Chỉ hiện 3 số đầu và 3 số cuối: `091****111`.
  - **TUYỆT ĐỐI KHÔNG IN SỐ CCCD, NGÀY SINH, QUÊ QUÁN** lên trang xem hóa đơn công khai.
- **Quyền thu hồi dữ liệu**: Khách thuê sau khi kết thúc hợp đồng có thể được ẩn thông tin cá nhân khỏi danh bạ hoạt động của chuỗi trọ.

---

# 23. CODING CONVENTIONS

1. **Ngôn ngữ & Đặt tên**:
   - Tên biến, tên hàm, tên file, tên Schema, tên Route bằng **Tiếng Anh** (camelCase cho biến/hàm, PascalCase cho Model/Component, kebab-case cho tên file route).
   - Thông điệp phản hồi cho người dùng, nhãn UI, thông báo lỗi hiển thị bằng **Tiếng Việt**.
2. **Clean Code & Boy Scout Rule**:
   - Code ngắn gọn, trực diện, không over-engineering.
   - Tự document bằng cách đặt tên biến rõ nghĩa thay vì comment tràn lan.
   - Khi chỉnh sửa file, luôn dọn dẹp sạch sẽ hơn lúc ban đầu.
