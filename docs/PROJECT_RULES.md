# ĐẶC TẢ DỰ ÁN & BỘ QUY TẮC PHÁT TRIỂN (PROJECT RULES)

## NỀN TẢNG B2B SAAS QUẢN LÝ & TỰ ĐỘNG HÓA HÓA ĐƠN NHÀ TRỌ / CĂN HỘ DỊCH VỤ

_(Pragmatic Boarding House Management SaaS Platform)_

> Cập nhật 28/10/2026: gói dịch vụ đủ tính năng, tên đăng nhập theo từng chủ trọ & chọn tài khoản, tự khóa / mở lại tài khoản khách thuê, gia hạn hợp đồng, tiền cọc (VietQR + đối soát tự động), realtime `data:changed` / `activity`, chuông "Việc cần xử lý", phân loại sự cố bằng TypeSafe, AuditLog chỉ lưu trường thay đổi + TTL, code split FE. API chi tiết: `BE/API.md`.

---

# MỤC LỤC TỔNG THỂ

1. [01. Product Principles (Nguyên tắc sản phẩm)](#01-product-principles)
2. [02. System Architecture (Kiến trúc hệ thống)](#02-system-architecture)
3. [03. Roles & RBAC (Ma trận phân quyền 4 vai trò thống nhất)](#03-roles--rbac)
4. [04. Multi-tenancy & Tenant Context (Cô lập dữ liệu & Scope Helper)](#04-multi-tenancy--tenant-context)
5. [05. Database Rules & Soft Delete Policy (Quy tắc MongoDB & Xóa mềm)](#05-database-rules--soft-delete-policy)
6. [06. Backend MVC Rules (Quy tắc Backend Express)](#06-backend-mvc-rules)
7. [07. API Rules (Quy chuẩn thiết kế API)](#07-api-rules)
8. [08. Authentication, Account Provisioning & Security (Xác thực, Cấp tài khoản & Bảo mật)](#08-authentication-account-provisioning--security)
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
  1. **Quản trị Khách hàng B2B (Chủ trọ - `User.role = 'LANDLORD'`) & Người dùng Toàn sàn**:
     - Xem danh sách và thông tin chi tiết toàn bộ người dùng trên hệ thống qua `GET /api/v1/users` (không trả thông tin ngân hàng nội bộ của Landlord).
     - **Khóa / Mở khóa tài khoản**: Chuyển trạng thái `ACTIVE` $\longleftrightarrow$ `SUSPENDED` (chặn đăng nhập khi vi phạm điều khoản hoặc gian lận). Khi Landlord bị khóa, Manager và Tenant thuộc chuỗi cũng bị chặn đồng nhất ở cả Property Core và Finance.
     - **Tài khoản Khởi tạo & Không can thiệp Cấp quyền**: Backend tự động tạo sẵn tài khoản `admin / admin` (mật khẩu băm bằng bcrypt) nếu chưa tồn tại; tài khoản admin seed cũ `admin@wdp301.com` được chuyển một lần sang `admin / admin`. Không có API công khai tạo admin; các thao tác `POST / PUT / DELETE` trên `/users` bị loại bỏ để bảo toàn cơ chế cấp tài khoản chuẩn.
  2. **Quản lý Gói cước SaaS (`SaaSPlan` CRUD)**:
     - Tạo, sửa, xóa, định giá các gói dịch vụ (`FREE_TRIAL`, `STARTER`, `PRO`, `ENTERPRISE`).
     - Thiết lập hạn ngạch tài nguyên cho từng gói: Số cơ sở tối đa (`maxBranches`), số phòng tối đa (`maxRooms`), số nhân viên quản lý tối đa (`maxManagers`), giá và thời gian dùng thử (`trialDays`, chỉ gói `FREE_TRIAL`).
     - **Mọi gói có đầy đủ tính năng** (danh sách hiển thị chung: `BE/utils/planFeatures.js` → `INCLUDED_FEATURES`); các gói chỉ khác **giá và hạn ngạch**. Không cấu hình `features` / `featureFlags` theo từng gói. Các tính năng tự động (đối soát SePay/Bank Hub, sự cố) chỉ yêu cầu chủ trọ có **thuê bao đang hiệu lực**.
     - Hạn ngạch "Không giới hạn" lưu bằng số lớn quy ước: `999` cơ sở, `9999` phòng, `99` quản lý.
     - Không cho tạm ngưng / xóa gói khi còn thuê bao đang dùng (`PLAN_IN_USE`); màn admin hiển thị `subscriptionCount` của từng gói.
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
- **Cơ chế Đăng ký**: Tự đăng ký bằng email và mật khẩu qua `POST /api/v1/auth/register`; trạng thái `ACTIVE` ngay, không chờ duyệt/OTP/email verification. Được cấp thuê bao 30 ngày dùng thử (gói `FREE_TRIAL` hoặc fallback cấu hình 1 cơ sở, 5 phòng, 1 manager).
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
     - **Cấp tài khoản Quản lý (`POST /api/v1/staff`)**: Landlord trực tiếp cấp tài khoản cho nhân sự. Username bắt buộc là số điện thoại Việt Nam 10 chữ số (hệ thống tự động chuẩn hóa `+84` về `0`), email tùy chọn. Hệ thống tạo mật khẩu ngẫu nhiên và gắn cờ `mustChangePassword: true`.
     - **Mật khẩu Tạm hiển thị 1 lần**: Mật khẩu ngẫu nhiên chỉ trả về một lần duy nhất trong phản hồi HTTP 201 cho Landlord bàn giao cho nhân sự. Hệ thống không lưu mật khẩu dạng rõ, không trả lại trong API danh sách hoặc audit log.
     - **Cấp lại mật khẩu (`POST /api/v1/staff/:staffId/reset-password`)**: Sinh mật khẩu ngẫu nhiên mới, thu hồi mọi phiên đăng nhập cũ và yêu cầu đổi mật khẩu lần nữa.
     - **Phân công chi nhánh phụ trách**: Gán danh sách cơ sở cụ thể (`assignedBranches = [BranchA, BranchB]`). Mọi cơ sở phải đang hoạt động, chưa xóa và thuộc sở hữu của Landlord. Quota manager được kiểm tra chặt chẽ trong cùng transaction.
  4. **Quản lý Hợp đồng & Tự động Cấp tài khoản Tenant**:
     - **Ký hợp đồng mới (`POST /api/v1/contracts`)**: Nhập thông tin khách thuê (Họ tên và CCCD 12 chữ số bắt buộc; SĐT và Email là tùy chọn) $\rightarrow$ Hệ thống tự động kiểm tra CCCD trong scope của Landlord:
       - Nếu khách mới: Tự động cấp tài khoản `TENANT` ở trạng thái `ACTIVE` với username là CCCD (giữ số 0 đầu), mật khẩu ngẫu nhiên, gắn cờ `mustChangePassword: true`. Trả về thông tin đăng nhập tạm thời `tenantCredentials` trong response tạo hợp đồng để Landlord bàn giao. Không có API cấp Tenant độc lập; không sử dụng xác thực OTP.
       - Nếu khách đã có tài khoản: Tự động liên kết hợp đồng vào Tenant hiện hữu và giữ nguyên mật khẩu cũ.
     - **Cấp lại mật khẩu Tenant (`POST /api/v1/tenants/:tenantId/reset-password`)**: Sinh mật khẩu ngẫu nhiên mới, thu hồi phiên cũ và yêu cầu đổi mật khẩu.
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
- ⚠️ **Ranh giới Phân quyền Nghiêm ngặt (RBAC Boundary) & Quy tắc Mật khẩu**:
  - **Định danh**: Username là số điện thoại 10 chữ số (chuẩn hóa `+84` về `0`). Nhận mật khẩu tạm ngẫu nhiên từ Landlord và **bắt buộc đổi mật khẩu ở lần đăng nhập đầu tiên** (`mustChangePassword: true`).
  - **Chặn truy cập khi chưa đổi mật khẩu**: Khi `mustChangePassword: true`, mọi API nghiệp vụ có bảo vệ đều trả về lỗi `403 PASSWORD_CHANGE_REQUIRED`. Chỉ được phép gọi `login`, `refresh`, `logout`, `me` và `change-password`.
  - **CHỈ ĐƯỢC** thao tác trong phạm vi các chi nhánh được phân công (`assignedBranches`).
  - **TUYỆT ĐỐI KHÔNG ĐƯỢC** xem doanh thu tài chính tổng của Chủ trọ, không xem MRR, không thể sửa tài khoản ngân hàng và không được can thiệp vào gói cước SaaS.

---

## 3.4. 📱 TENANT (Khách thuê phòng trọ)

- **Đối tượng**: Người thuê trọ (phần lớn là sinh viên, nhân viên văn phòng, Gen Z).
- **Mục tiêu**: Thanh toán hóa đơn nhanh chóng trong 5 giây mà không cần cài app phiền toái; phản ánh sự cố minh bạch.
- **Chức năng nghiệp vụ chi tiết**:
  1. **Cấp Tài khoản Tự động & Bắt buộc Đổi Mật khẩu Lần đầu**:
     - Tài khoản được tự động tạo khi Chủ trọ ký hợp đồng thuê phòng; username là CCCD dạng chuỗi 12 chữ số (giữ số 0 đầu), trạng thái `ACTIVE` ngay.
     - Nhận mật khẩu tạm ngẫu nhiên từ Chủ trọ và **bắt buộc đổi mật khẩu ở lần đăng nhập đầu tiên** (`mustChangePassword: true`).
     - Trước khi đổi mật khẩu, mọi API nghiệp vụ đều bị chặn với mã lỗi `403 PASSWORD_CHANGE_REQUIRED`.
     - **Bãi bỏ cơ chế kích hoạt OTP**: Hệ thống không gửi OTP kích hoạt (hai endpoint kích hoạt OTP cũ trả HTTP 410 `OTP_ACTIVATION_RETIRED`).
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
- `Payments`: `{ landlordId: 1, paymentMethod: 1, referenceCode: 1 }` (**UNIQUE** — mã giao dịch chỉ duy nhất trong từng chủ trọ & phương thức; chống ghi nhận trùng). `PaymentReceipt` giữ một biên nhận cho mỗi (chủ trọ, nguồn, mã tham chiếu) cho cả giao dịch đã khớp, chưa khớp và tiền cọc.
- `Users`: `{ email: 1, landlordId: 1 }` và `{ username: 1, landlordId: 1 }` (**UNIQUE** partial) — tên đăng nhập duy nhất **trong từng chủ trọ** (xem 08.1).
- Trang danh sách sắp theo `createdAt` mới nhất: `{ landlordId: 1, isDeleted: 1, createdAt: -1 }` trên `Invoices`, `Contracts`, `Branches`, `Incidents`; `Rooms`: `{ landlordId: 1, branchId: 1, isDeleted: 1, floor: 1, roomNumber: 1 }`.
- `AuditLogs`: `{ landlordId: 1, createdAt: -1 }`, `{ entityType: 1, entityId: 1, createdAt: -1 }`, `{ createdAt: -1 }`, `{ action: 1, createdAt: -1 }`, `{ entityType: 1, createdAt: -1 }` và TTL `{ expiresAt: 1 }` (xem 17).
- Index cũ bị thay thế được xóa tự động khi khởi động (`BE/config/migrations.js`) trước khi `createIndexes()`.
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
- `401 UNAUTHORIZED`: Thiếu token, token không hợp lệ hoặc session đã bị thu hồi/logout.
- `403 FORBIDDEN`: Không có quyền truy cập chi nhánh/tài nguyên này.
- `403 PASSWORD_CHANGE_REQUIRED`: Bắt buộc đổi mật khẩu trước khi truy cập các API nghiệp vụ.
- `404 NOT_FOUND`: Không tìm thấy bản ghi.
- `409 CONFLICT`: Xung đột dữ liệu (trùng email, trùng username/SĐT/CCCD, mã hóa đơn trùng, phòng đang có hợp đồng hoạt động).
- `410 OTP_ACTIVATION_RETIRED`: Endpoint kích hoạt tài khoản bằng mã OTP cũ đã bãi bỏ.
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
- Nhóm API Xác thực & Phiên làm việc:
  - `POST /auth/register`: Đăng ký tài khoản Landlord (Public, ACTIVE ngay).
  - `POST /auth/login`: Đăng nhập bằng `username` (hoặc `email`) + `password` (Public).
  - `GET /auth/me`: Đọc thông tin người dùng đang đăng nhập (Bearer token, hỗ trợ tài khoản `mustChangePassword`).
  - `POST /auth/change-password`: Đổi mật khẩu bắt buộc hoặc chủ động (Bearer token, thu hồi mọi phiên cũ).
  - `POST /auth/refresh` & `POST /auth/logout`: Làm mới token / Đăng xuất qua HttpOnly cookie.
- Nhóm API Cấp & Quản lý Tài khoản (Scope Landlord):
  - `POST /staff`: Landlord cấp tài khoản Manager mới (trả mật khẩu tạm 1 lần duy nhất).
  - `GET /staff`: Danh sách nhân sự cơ sở.
  - `POST /staff/:staffId/reset-password`: Cấp lại mật khẩu ngẫu nhiên cho Manager.
  - `GET /tenants`: Danh sách khách thuê thuộc chuỗi trọ.
  - `POST /tenants/:tenantId/reset-password`: Cấp lại mật khẩu ngẫu nhiên cho Tenant.
  - Khách thuê mới được tự động cấp tài khoản qua `POST /contracts`, không có API cấp Tenant độc lập.
- Nhóm API Quản trị Toàn sàn:
  - `GET /users`: Super Admin xem danh sách và chi tiết người dùng (loại bỏ POST/PUT/DELETE trên `/users`).
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
  - `LANDLORD`: toàn quyền trong tenant scope của chính mình; nhận báo cáo và là người duy nhất duyệt hoặc từ chối thu tiền mặt ở mọi branch thuộc landlord.
  - `PROPERTY_MANAGER`: chỉ thao tác trong `assignedBranches`; được xem phòng, chốt điện nước, xử lý incident và lập báo cáo thu tiền mặt tại branch được giao; không được tự xác nhận cuối cùng, không xem doanh thu tổng hoặc sửa bank config/SaaS.
- `TENANT`: chỉ xem dữ liệu của mình, invoice public bằng token và tạo/theo dõi incident thuộc hợp đồng; không tạo/xác nhận Payment, sửa Invoice hoặc truy cập dashboard landlord.
- Mọi route phải khai báo authentication, role authorization và tenant/branch scope trước controller.

### 7. Chuẩn Error Code

- Mã lỗi nghiệp vụ dùng `SCREAMING_SNAKE_CASE`, ổn định và độc lập với thông điệp tiếng Việt.
- Mã bắt buộc gồm: `AUTH_REQUIRED`, `UNAUTHORIZED`, `FORBIDDEN`, `PASSWORD_CHANGE_REQUIRED`, `OTP_ACTIVATION_RETIRED`, `NOT_FOUND`, `INVALID_ID`, `VALIDATION_ERROR`, `CONFLICT`, `QUOTA_EXCEEDED`, `BRANCH_SCOPE_FORBIDDEN`, `LANDLORD_SCOPE_FORBIDDEN`, `INVOICE_ALREADY_PAID`, `INVOICE_CANCELLED`, `INVOICE_NOT_ISSUED`, `PAYMENT_AMOUNT_INVALID`, `PAYMENT_REFERENCE_DUPLICATED`, `PAYMENT_NOT_ALLOWED`, `READING_LOWER_THAN_PREVIOUS`, `READING_ALREADY_BILLED`, `BUSINESS_RULE_ERROR`, `TOO_MANY_REQUESTS`, `INTERNAL_SERVER_ERROR`.
- Không dùng message để frontend quyết định logic; frontend phải dựa vào `errorCode`.

### 8. Vòng đời Invoice và Payment

- Invoice chỉ dùng các trạng thái: `DRAFT`, `ISSUED`, `PARTIALLY_PAID`, `PAID`, `OVERPAID`, `CANCELLED`.
- `OVERDUE` là điều kiện suy diễn: `now > dueDate` và status là `ISSUED` hoặc `PARTIALLY_PAID`; không lưu `OVERDUE` thành status riêng.
- Payment chỉ dùng các trạng thái `SUCCESS`, `FAILED`, `REFUNDED` và các method `VIETQR`, `BANK_TRANSFER`, `CASH`.
- Payment `CASH` bắt buộc có số biên lai/reference duy nhất, `transactionDate` và điểm thu nếu có.
- Thu tiền mặt bởi `PROPERTY_MANAGER` tạo Payment trạng thái `PENDING_CONFIRMATION`, lưu `reportedBy` và chưa cộng vào hóa đơn. `LANDLORD` duyệt qua endpoint xác nhận thì Payment chuyển `SUCCESS`, lưu `confirmedBy` và hệ thống mới cập nhật `paidAmount`/trạng thái Invoice. Landlord có thể từ chối với lý do, chuyển Payment sang `FAILED`; mọi bước phải ghi `AuditLog`.
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

# 08. AUTHENTICATION, ACCOUNT PROVISIONING & SECURITY

### 1. Quy chuẩn Tài khoản & Định danh Username theo 4 Vai trò (Áp dụng 14/10/2026)

Hệ thống thống nhất cơ chế định danh không trùng lặp toàn hệ sinh thái, phân định rõ trách nhiệm khởi tạo giữa các vai trò:

| Vai trò                | Định danh (`username`)                                         | Cơ chế Khởi tạo                                  | Trạng thái ban đầu                          | Mật khẩu & Chính sách                                                    |
| :--------------------- | :------------------------------------------------------------- | :----------------------------------------------- | :------------------------------------------ | :----------------------------------------------------------------------- |
| **`LANDLORD`**         | Email hợp lệ                                                   | Tự đăng ký (`POST /auth/register`)               | `ACTIVE` ngay lập tức (không chờ duyệt/OTP) | Tự đặt ($\ge 8$ ký tự, tối đa 72 byte UTF-8); cấp dùng thử 30 ngày       |
| **`PROPERTY_MANAGER`** | Số điện thoại VN 10 chữ số (chuẩn hóa `+84` $\rightarrow$ `0`) | Chủ trọ cấp trực tiếp (`POST /staff`)            | `ACTIVE`, gắn cờ `mustChangePassword: true` | Mật khẩu ngẫu nhiên; hiển thị 1 lần duy nhất; bắt buộc đổi lần đầu       |
| **`TENANT`**           | Số CCCD 12 chữ số (dạng chuỗi, giữ số 0 đầu)                   | Tự động cấp khi lập hợp đồng (`POST /contracts`) | `ACTIVE`, gắn cờ `mustChangePassword: true` | Mật khẩu ngẫu nhiên; hiển thị 1 lần duy nhất; bắt buộc đổi lần đầu       |
| **`SUPER_ADMIN`**      | `admin`                                                        | Tạo thủ công trực tiếp trong DB (backend **không** tự tạo) | `ACTIVE`                                    | Mật khẩu băm bcrypt; không có API công khai tạo admin |

- **Ràng buộc Duy nhất theo Chủ trọ (cập nhật 28/10/2026)**:
  - `username` và `email` là duy nhất **trong phạm vi một chủ trọ**, không còn duy nhất toàn sàn. Một người (cùng CCCD / SĐT / email) có thể có tài khoản riêng ở **mỗi chủ trọ** mà họ thuê hoặc làm việc; mỗi tài khoản có mật khẩu riêng.
  - **Unique Partial Index**: `{ email: 1, landlordId: 1 }` (filter `{ email: { $type: "string" } }`, không lưu chuỗi rỗng) và `{ username: 1, landlordId: 1 }`. `LANDLORD` và `SUPER_ADMIN` không có `landlordId` nên email / username vẫn không trùng nhau giữa các chủ trọ.
  - Trong cùng một chủ trọ, username / email đã dùng (kể cả tài khoản xóa mềm) không được cấp lại cho tài khoản khác.
  - Khách thuê (`TENANT`) và Quản lý (`PROPERTY_MANAGER`) trực thuộc đúng một `LANDLORD` (`landlordId`).
- **Đăng nhập khi một tên đăng nhập có nhiều tài khoản** (`POST /auth/login`):
  1. Backend lấy mọi tài khoản trùng username/email và kiểm tra mật khẩu với từng tài khoản.
  2. Chỉ một tài khoản đúng mật khẩu $\rightarrow$ đăng nhập như bình thường.
  3. Nhiều tài khoản cùng đúng mật khẩu $\rightarrow$ trả `{ selectionRequired: true, accounts: [{ id, roleName, status, landlordName, places }] }` (**chưa tạo phiên, chưa đặt cookie**). `places` liệt kê "Cơ sở – Phòng" của các hợp đồng còn hiệu lực (khách thuê) hoặc cơ sở được giao (quản lý).
  4. FE hiển thị màn **"Chọn tài khoản"**; người dùng chọn $\rightarrow$ FE gửi lại `{ username, password, accountId }` (mật khẩu được kiểm tra lại). Danh sách chỉ lộ ra sau khi nhập đúng mật khẩu.
  5. Tự đăng nhập lại sau khi đổi mật khẩu luôn gửi kèm `accountId` để quay về đúng tài khoản.

### 2. Quy chuẩn Mật khẩu, Mật khẩu Tạm & Đổi Mật khẩu Bắt buộc (`mustChangePassword`)

1. **Quy tắc Mật khẩu Người dùng Tự đặt**:
   - Độ dài tối thiểu **8 ký tự**, tối đa **72 byte** (chuẩn an toàn của thuật toán băm bcrypt UTF-8).
   - Mật khẩu mới **bắt buộc phải khác** mật khẩu hiện tại.
2. **Cơ chế Mật khẩu Tạm (One-time Temporary Password)**:
   - Khi Landlord cấp tài khoản Quản lý (`POST /staff`), cấp lại mật khẩu (`reset-password`) hoặc lập hợp đồng cho khách thuê mới (`POST /contracts`): Backend sinh mật khẩu tạm ngẫu nhiên, băm lưu vào DB và trả về mật khẩu thô **một lần duy nhất** trong response JSON (`credentials` hoặc `tenantCredentials`).
   - Mật khẩu thô **tuyệt đối không được lưu trữ** trong database, không ghi vào AuditLog, và không bao giờ xuất hiện lại trong bất kỳ API `GET` danh sách hay chi tiết nào.
   - Frontend hiển thị modal bàn giao để Landlord trực tiếp gửi cho nhân sự / khách thuê (không tự động gửi SMS/Email ngầm trong luồng này).
3. **Cơ chế Khóa API Nghiệp vụ khi Chưa Đổi Mật khẩu (`PASSWORD_CHANGE_REQUIRED`)**:
   - Mọi tài khoản có cờ `mustChangePassword: true` khi gọi bất kỳ API nghiệp vụ có bảo vệ nào (Property Core, Finance, Dashboard...) đều bị middleware chặn với mã lỗi:
     $$\text{HTTP } 403 \text{ FORBIDDEN} \quad \text{với errorCode: } \mathbf{PASSWORD\_CHANGE\_REQUIRED}$$
   - **Các ngoại lệ duy nhất được phép truy cập khi chưa đổi mật khẩu**:
     - `POST /api/v1/auth/login`
     - `POST /api/v1/auth/refresh`
     - `POST /api/v1/auth/logout`
     - `GET /api/v1/auth/me` (cho phép đọc thông tin hồ sơ của chính mình)
     - `POST /api/v1/auth/change-password` (thực hiện đổi mật khẩu)
     - Link hóa đơn No-App `/i/:token` (sử dụng public access token riêng biệt).
4. **Quy trình Đổi Mật khẩu Bắt buộc (`POST /api/v1/auth/change-password`)**:
   - Payload: `{ currentPassword, newPassword }`.
   - Backend thực thi trong **MongoDB Transaction**:
     1. Xác thực `currentPassword` khớp với hash trong DB.
     2. Băm `newPassword` và cập nhật vào `User.password`.
     3. Đặt `mustChangePassword = false`.
     4. Tăng phiên bản xác thực (`authVersion`) và **thu hồi toàn bộ các phiên đăng nhập (refresh sessions) cũ**.
   - Phản hồi: HTTP 200 `{ success: true, message: "...", data: { user: { ... }, requiresLogin: true } }`.
   - **Hành vi bắt buộc ở Frontend**: Xóa ngay access token trong React in-memory, hủy phiên hiện tại và điều hướng người dùng về màn hình Đăng nhập để đăng nhập lại với mật khẩu mới. Toàn bộ token cũ đều bị vô hiệu hóa.

### 3. Kiến trúc Bảo mật 2 Tầng Token & Quản lý Phiên (Session Management)

```
[ FRONTEND (React In-Memory) ]                          [ BACKEND & DATABASE ]
              │                                                     │
              ├─────── 1. POST /auth/login (username + pwd) ───────►│ Xác thực thông tin
              │◄────── 2. Access Token (15m, JSON Body) ────────────┤ Lưu Session Hash DB
              │◄────── 3. Refresh Token (7d, HttpOnly Cookie) ──────┤ Set-Cookie /api
              │                                                     │
     (Gọi API nghiệp vụ)                                            │
              ├─────── 4. Bearer <AccessToken> ────────────────────►│ Verify JWT + Session
              │                                                     │
       (Hết hạn 15m)                                                │
              ├─────── 5. POST /auth/refresh (Cookie Auto) ────────►│ Verify Session Hash DB
              │◄────── 6. Access Token Mới (JSON Body) ─────────────┤ Xoay vòng session
              │                                                     │
         (Đăng xuất)                                                │
              ├─────── 7. POST /auth/logout (Cookie Auto) ─────────►│ Xóa Session Hash DB
              │◄────── 8. Clear Cookie ─────────────────────────────┤ Thu hồi token
```

1. **Access Token (Thời hạn 15 phút)**:
   - Lưu trữ tuyệt đối trong **React In-Memory State** (biến module/context).
   - **TUYỆT ĐỐI CẤM** lưu Access Token vào `localStorage`, `sessionStorage` hoặc Cookie không an toàn để triệt tiêu nguy cơ tấn công XSS đánh cắp quyền truy cập.
   - Access token bắt buộc chứa `sessionId`. Mọi token không chứa `sessionId` hoặc mang `sessionId` đã bị thu hồi/đăng xuất sẽ bị từ chối `401 UNAUTHORIZED`.
2. **Refresh Token (Thời hạn 7 ngày) & Cơ chế HttpOnly Cookie**:
   - Refresh token được truyền độc quyền qua **HttpOnly Cookie** (không bao giờ trả trong JSON response).
   - Backend lưu trữ **Hash của Refresh Token** trong bảng phiên đăng nhập (`UserSession`) trong database.
   - Cấu hình Cookie:
     - `path: "/api"` (phục vụ đồng bộ cả endpoint chuẩn `/api/v1` và alias tương thích cũ `/api`).
     - `httpOnly: true` (chống JavaScript truy cập).
     - **Môi trường Production (Cross-Site Vercel $\leftrightarrow$ Render)**: `secure: true`, `sameSite: "none"`.
     - **Môi trường Cùng Domain (`app.wdp301.com` $\leftrightarrow$ `api.wdp301.com`)**: `secure: true`, `sameSite: "lax"`.
3. **Cấu hình CORS & Credentials**:
   - Backend Express CORS bắt buộc: `credentials: true`.
   - `origin`: Bắt buộc trỏ chính xác vào `process.env.CLIENT_URL` (Tuyệt đối **CẤM** dùng ký tự đại diện `*` khi bật credentials).
4. **Yêu cầu Bảo mật `JWT_SECRET`**:
   - `JWT_SECRET` **bắt buộc phải cấu hình qua file `.env`** và có độ dài tối thiểu **32 ký tự**.
   - Tuyệt đối loại bỏ mọi chuỗi secret dự phòng (fallback hardcoded) trong mã nguồn.

### 4. Chi tiết Các Endpoint Xác thực & Cấp Tài khoản

#### A. Xác thực Cơ bản (Public & Session)

- **`POST /api/v1/auth/register` (Public — Dành riêng cho Landlord)**:
  - Request: `{ name, email, password, phoneNumber? }`.
  - Có thể gửi kèm `role: "LANDLORD"`; mọi giá trị role khác bị từ chối `403 FORBIDDEN`.
  - Không nhận các trường can thiệp: `landlordId`, `status`, `mustChangePassword`, `assignedBranches`.
  - Response (201): Cấp tài khoản `ACTIVE` ngay, gán gói `FREE_TRIAL` 30 ngày (hoặc cấu hình dùng thử mặc định).
  - Không tự động đăng nhập sau đăng ký; Client phải chuyển sang bước gọi API login. Email/username trùng trả `409 CONFLICT`.
- **`POST /api/v1/auth/login` (Public — Đa định danh)**:
  - Request: `{ username, password }` hoặc `{ email, password }` (chỉ gửi 1 trong 2).
  - `username` chấp nhận: Email của Landlord, SĐT 10 số của Manager, CCCD 12 số của Tenant, hoặc `admin`.
  - Response (200): Trả access token và thông tin `user` DTO trong `data`; cookie refresh token gửi kèm header `Set-Cookie`.
- **`GET /api/v1/auth/me` (Bearer Token)**:
  - Trả thông tin `user` DTO hiện tại. Cho phép tài khoản có `mustChangePassword: true` đọc thông tin cá nhân.
- **`POST /api/v1/auth/change-password` (Bearer Token)**:
  - Request: `{ currentPassword, newPassword }`.
  - Đổi mật khẩu, xóa cờ `mustChangePassword`, thu hồi mọi phiên cũ, trả `requiresLogin: true`.
- **`POST /api/v1/auth/refresh` & `POST /api/v1/auth/logout`**:
  - Gửi cookie tự động qua `withCredentials: true`.
  - `refresh`: Trả access token mới và user DTO.
  - `logout`: Hủy session trong database và xóa cookie trên client.

#### B. Cấp & Quản trị Nhân sự / Khách thuê (Landlord Scope)

- **`POST /api/v1/staff` (Bearer Token Landlord)**:
  - Request: `{ name, phoneNumber, assignedBranches?, email? }`.
  - Kiểm tra quota manager, xác thực chi nhánh hợp lệ thuộc quyền sở hữu của Landlord trong cùng transaction.
  - Response (201): Trả `user` DTO và object `credentials: { username, temporaryPassword, mustChangePassword: true }`.
- **`GET /api/v1/staff` & `GET /api/v1/tenants` (Bearer Token Landlord)**:
  - Hỗ trợ `page`, `limit`; trả danh sách nhân sự/khách thuê thuộc tenant scope của Landlord (`isDeleted: false`). Không trả mật khẩu.
- **`POST /api/v1/staff/:staffId/reset-password` & `POST /api/v1/tenants/:tenantId/reset-password` (Bearer Token Landlord)**:
  - Request body: `{}`. Chỉ Landlord sở hữu tài khoản mới có quyền cấp lại.
  - Sinh mật khẩu ngẫu nhiên mới, thu hồi session cũ, đặt `mustChangePassword: true`.
  - Hỗ trợ chuyển tài khoản Tenant cũ từ `PENDING_ACTIVATION` sang `ACTIVE`. Không tự ý mở khóa tài khoản `SUSPENDED`.
  - Response (200): Trả `credentials` chứa mật khẩu tạm một lần.
- **`POST /api/v1/contracts` (Tích hợp Cấp Khách thuê Mới)**:
  - Request hợp đồng: `tenant.name` và `tenant.identityCard` (CCCD 12 chữ số) là **bắt buộc**; `tenant.phoneNumber` và `tenant.email` là **tùy chọn**.
  - Hệ thống tự tra cứu CCCD trong scope của Landlord:
    - Nếu đã có: Liên kết Tenant hiện hữu, giữ nguyên mật khẩu cũ.
    - Nếu chưa có: Tạo mới tài khoản Tenant `ACTIVE`, mật khẩu ngẫu nhiên, `mustChangePassword: true` trong cùng transaction tạo hợp đồng.
  - Response (201): **Chỉ khi tạo mới Tenant**, response mới bổ sung thêm `data.tenantCredentials: { username, temporaryPassword, mustChangePassword: true }`. Không lưu trường này vào contract document; các API xem hợp đồng sau đó không trả lại mật khẩu.

### 5. Bãi bỏ Hoàn toàn Cơ chế Xác thực OTP (OTP Deprecation)

- Kể từ ngày **14/10/2026**, hệ thống **chính thức khai tử cơ chế kích hoạt tài khoản bằng mã OTP**.
- Hai endpoint OTP kích hoạt cũ bị vô hiệu hóa và luôn trả về:
  $$\text{HTTP } 410 \text{ GONE} \quad \text{với errorCode: } \mathbf{OTP\_ACTIVATION\_RETIRED}$$
- Không còn bất kỳ màn hình nhập mã OTP nào trên ứng dụng Frontend cho tài khoản mới.

### 6. Giới hạn Tuyệt đối trên Collection User đối với Super Admin

- Endpoint `/api/v1/users` dành cho `SUPER_ADMIN` **chỉ hỗ trợ thao tác đọc (`GET`)**: Xem danh sách tổng quan và chi tiết cơ bản.
- **Tuyệt đối không trả về thông tin tài khoản ngân hàng nội bộ của Landlord**.
- Các endpoint `POST / PUT / DELETE` trên `/users` **bị loại bỏ hoàn toàn** để ngăn chặn việc tạo/sửa người dùng tùy tiện vượt qua quy trình băm mật khẩu, cấp hạn ngạch và logic nghiệp vụ của hệ sinh thái.

### 7. Khóa Chặt Cơ chế Bypass Header (Strict Production Lock)

- Header `x-landlord-id` / `x-user-id` và Mock Auth **bị từ chối ở mọi môi trường** (kể cả development): middleware trả `403 FORBIDDEN`. Phạm vi dữ liệu chỉ lấy từ JWT.
- **CORS & Origin**: REST API, đăng nhập và Socket.io dùng chung `isAllowedOrigin` (`BE/utils/appUrls.js`): các origin trong `CLIENT_URL` (nhiều origin cách nhau bằng dấu phẩy) và link preview Vercel **của đúng team** (`VERCEL_PREVIEW_SUFFIX`). Không mở wildcard kiểu `wdp-*.vercel.app` vì API cho phép gửi cookie.

### 8. Rate Limiting cho Endpoint Công khai

- **Public Invoice Link (`/i/:token`)**: Giới hạn tối đa **60 requests/phút/IP** để ngăn chặn quét brute-force token.
- **Webhook Payment (`/api/payments/webhook`)**: Giới hạn tối đa **120 requests/phút/IP** để chống tấn công DoS.
- **Auth Endpoints (`/api/v1/auth/login`, `/api/v1/auth/register`)**: Giới hạn tối đa **20 requests/phút/IP** để chống tấn công vét cạn mật khẩu (Brute-force/Credential Stuffing).

### 9. Tự khóa & Mở lại Tài khoản Khách thuê theo Hợp đồng

- **Tự khóa** (`BE/jobs/tenantAccess.js`, chạy khi khởi động và mỗi 6 giờ): tài khoản `TENANT` chuyển `status: "INACTIVE"` (`deactivationReason: "NO_ACTIVE_CONTRACT"`) khi đồng thời:
  - không còn hợp đồng đang chạy, hoặc hợp đồng đã hết hạn / đã trả phòng **quá `TENANT_LOCK_AFTER_DAYS` ngày** (mặc định 30; hết hạn tính theo `endDate`, đã thanh lý tính theo `actualEndDate`);
  - **không còn hóa đơn nợ** (`ISSUED`, `PARTIALLY_PAID`, `UNPAID` còn tiền) — khách còn nợ vẫn đăng nhập được để thanh toán.
- Khi khóa: tăng `authVersion`, xóa toàn bộ phiên đăng nhập, audit `DEACTIVATE_TENANT` (actor `SYSTEM`). Đăng nhập đúng mật khẩu nhận `403 TENANT_INACTIVE` kèm lời giải thích; sai mật khẩu vẫn báo sai như thường (không lộ trạng thái). Link hóa đơn `/i/:token` vẫn hoạt động.
- **Mở lại**: lập hợp đồng mới cùng CCCD (cùng chủ trọ) hoặc gia hạn hợp đồng $\rightarrow$ tài khoản trở lại trạng thái trước khi khóa, **giữ nguyên mật khẩu khách đã đổi**, không cấp mật khẩu tạm, không bắt đổi mật khẩu (audit `REACTIVATE_TENANT`).
- Tắt bằng `TENANT_AUTO_LOCK=false`.

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

### 4. Tiêu chuẩn Thiết lập Tài khoản VietQR & Ngôn ngữ Giao tiếp Chuyên nghiệp

- **Yêu cầu Bắt buộc trước khi Phát hành Hóa đơn**:
  - Mỗi Cơ sở (`Branch`) hoặc Chuỗi trọ của Chủ nhà (`Landlord`) bắt buộc phải cấu hình tài khoản ngân hàng nhận tiền hợp lệ (`bankConfig` gồm `bankCode`, `accountNumber`, `accountHolder`).
  - Nếu chưa thiết lập, hệ thống sẽ chặn hành động phát hành hóa đơn (`400 Bad Request` với mã lỗi nội bộ `BANK_NOT_CONFIGURED`).
- **Quy chuẩn Thông điệp Người dùng (UX Copywriting Guidelines)**:
  - **TUYỆT ĐỐI KHÔNG HIỂN THỊ MÃ LỖI THÔ KỸ THUẬT** (như `BANK_NOT_CONFIGURED`, `HTTP 400`, `NullReferenceException`) trên giao diện người dùng.
  - Thông điệp cảnh báo phải lịch sự, chuẩn mực và định hướng hành động theo vai trò:
    - **Dành cho Chủ nhà (`LANDLORD`)**:
      > *"Cơ sở này chưa thiết lập tài khoản ngân hàng nhận tiền. Vui lòng cài đặt thông tin VietQR để kích hoạt tính năng phát hành hóa đơn và nhận thanh toán tự động."* (Kèm nút CTA điều hướng trực tiếp: **[Cài đặt tài khoản ngân hàng]**).
    - **Dành cho Quản lý cơ sở (`PROPERTY_MANAGER`)**:
      > *"Cơ sở hiện chưa được cấu hình tài khoản nhận tiền. Bạn vui lòng liên hệ Chủ nhà để thiết lập thông tin ngân hàng trước khi phát hành hóa đơn."*
  - Triệt tiêu hoàn toàn các thông báo mang tính đe dọa, dùng từ ngữ chuyên môn hoặc xưng hô không phù hợp.

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

### 3. Đối soát Tiền cọc qua Ngân hàng (SePay webhook / Bank Hub IPN)

- Nội dung chuyển cọc chuẩn: `COC <mã hợp đồng bỏ dấu gạch>` (ví dụ `COC HDT20269B2095CAAB10`), in sẵn trong mã VietQR cọc. Mã cọc được dò **trước** mã hóa đơn.
- Khớp đúng một hợp đồng, cọc đang `UNPAID`, hợp đồng chưa thanh lý và **số tiền đúng bằng `depositAmount`** $\rightarrow$ `depositStatus: PAID`, lưu `depositReceivedAt` (ngày giao dịch), `depositReferenceCode`, `PaymentReceipt.contractId`, audit `RECEIVE_CONTRACT_DEPOSIT` (actor `SYSTEM`), phát `contract:deposit_received`.
- Sai số tiền / cọc đã nhận / hợp đồng đã kết thúc $\rightarrow$ vào `UnmatchedPayment` kèm ghi chú lý do; không tự gạch.
- Chỉ áp dụng khi chủ trọ có thuê bao đang hiệu lực; webhook trùng trả 200 và không ghi nhận lần hai.

---

# 11. CONTRACT & CHECK-OUT RULES

### 1. Ràng buộc Tính hợp lệ của Phòng

- Chỉ được tạo hợp đồng mới cho các phòng đang ở trạng thái `EMPTY`.
- Sau khi hợp đồng được kích hoạt: Tự động đổi trạng thái phòng `EMPTY` $\rightarrow$ `RENTED`.

### 2. Tự động Cấp Tài khoản Khách thuê qua Hợp đồng

- Khi tạo hợp đồng (`POST /api/v1/contracts`), hệ thống kiểm tra số CCCD (dạng chuỗi 12 chữ số) trong tenant scope của Landlord:
  - **Khách thuê đã tồn tại**: Tự động liên kết hợp đồng mới vào Tenant ID hiện hữu, giữ nguyên mật khẩu cũ của khách (không reset mật khẩu).
  - **Khách thuê mới**: Tạo mới tài khoản `User` (`role = 'TENANT'`, `username = tenant.identityCard`, `landlordId = contract.landlordId`, `status = 'ACTIVE'`, mật khẩu ngẫu nhiên băm bcrypt, `mustChangePassword: true`) trong cùng MongoDB transaction tạo hợp đồng.
  - `tenant.name` và `tenant.identityCard` là thông tin bắt buộc; `tenant.phoneNumber` và `tenant.email` là tùy chọn (nếu nhập phải khớp tài khoản đã có, ngược lại `TENANT_IDENTITY_CONFLICT`).
  - **Khách đang bị tạm khóa vì hết hợp đồng** (08.9): tài khoản được mở lại với mật khẩu cũ, không trả `tenantCredentials`.
  - Cùng CCCD ở **chủ trọ khác**: tạo tài khoản mới thuộc chủ trọ này (tên đăng nhập duy nhất theo chủ trọ, 08.1).
  - **Bảo toàn bảo mật mật khẩu & Giao tiếp thông tin chuyên nghiệp**:
    - Response tạo hợp đồng thành công (HTTP 201) **chỉ trả về `data.tenantCredentials: { username, temporaryPassword, mustChangePassword: true }` khi tạo mới khách thuê**.
    - Tuyệt đối không lưu trường `tenantCredentials` vào document `Contract` trong cơ sở dữ liệu.
    - Mọi API đọc hợp đồng sau này (`GET /contracts`, `GET /contracts/:id`) tuyệt đối không trả lại mật khẩu.
    - Bãi bỏ các biệt ngữ kỹ thuật khó hiểu (như "Zero-Touch Provisioning", "bãi bỏ OTP theo quy chuẩn 14/10/2026") khỏi giao diện người dùng; thay thế bằng hướng dẫn bàn giao thông tin đăng nhập tự động minh bạch cho khách thuê.

### 3. Quy trình Nghiệm thu Trả phòng & Quyết toán Tiền cọc (Check-out Settlement)

- **Nguyên tắc minh bạch tài chính**:
  1. **Chốt số điện nước kết thúc**: Ghi nhận chỉ số điện/nước tại thời điểm trả phòng, chụp ảnh đồng hồ.
  2. **Biên bản Nghiệm thu Vật tư**: Kiểm tra danh mục tài sản ban đầu; nếu có hư hỏng thiết bị, đính kèm ảnh và chi phí sửa chữa.
  3. **Hóa đơn Quyết toán Cuối cùng (Final Settlement Invoice)**:
     $$\text{Tiền cọc hoàn trả} = \text{Tiền cọc} - (\text{Tiền phòng nợ cũ} + \text{Điện nước cuối kỳ} + \text{Phí hư hại vật tư})$$
     - Nếu kết quả $> 0$: Chủ trọ hoàn lại tiền cọc thừa cho Tenant.
     - Nếu kết quả $< 0$: Tenant thanh toán số tiền còn thiếu trước khi rời đi.
  4. **Thanh lý Hợp đồng**: Hợp đồng chuyển `TERMINATED`. Phòng chuyển sang `CLEANING` để dọn dẹp đón khách mới.

### 4. Xác nhận Hợp đồng Điện tử 2 Chiều (Two-Way Electronic Signing)

- **Cơ sở pháp lý**: Căn cứ Luật Giao dịch điện tử 2023 và Bộ luật Dân sự 2015, hợp đồng điện tử được xác nhận số giữa Chủ trọ và Khách thuê có giá trị pháp lý tương đương văn bản giấy.
- **Quy tắc Nghiệp vụ Backend**:
  1. **Chủ trọ xác nhận (`POST /api/v1/contracts/:contractId/confirm/landlord`)**:
     - Quyền thực hiện: Chỉ `LANDLORD` sở hữu hợp đồng.
     - Ghi nhận `landlordConfirmedAt = new Date()`, `landlordConfirmedBy = req.user._id`.
     - Tự động cập nhật `confirmedByBothParties = !!contract.tenantConfirmedAt`.
     - Ghi nhận `AuditLog` với action `CONFIRM_CONTRACT_LANDLORD`.
  2. **Khách thuê xác nhận (`POST /api/v1/contracts/:contractId/confirm/tenant`)**:
     - Quyền thực hiện: Chỉ `TENANT` đại diện ký trong hợp đồng (`contract.tenantId.toString() === req.user._id.toString()`).
     - Ghi nhận `tenantConfirmedAt = new Date()`, `tenantConfirmedBy = req.user._id`.
     - Tự động cập nhật `confirmedByBothParties = !!contract.landlordConfirmedAt`.
     - Ghi nhận `AuditLog` với action `CONFIRM_CONTRACT_TENANT`.
  3. **Ràng buộc Chặt chẽ**:
     - Không cho phép xác nhận nếu hợp đồng đã ở trạng thái thanh lý (`status === 'TERMINATED'`).
     - Không cho phép xác nhận lặp lại nếu bên đó đã ký nhận trước đó.
     - Payload body là tùy chọn (chấp nhận `{}` hoặc rỗng), danh tính được xác thực hoàn toàn qua JWT session token.
- **Quy chuẩn UX/UI Frontend**:
  - Tích hợp nút ký nhận trực tiếp ngay trong thẻ trạng thái xác nhận điện tử (`Ký xác nhận ngay` cho Chủ trọ hoặc `Đồng ý ký hợp đồng` cho Khách thuê).
  - Tự động chuyển thẻ trạng thái sang màu xanh lục bảo (`.verified`) và hiển thị huy hiệu `✓ Đã ký kết hợp lệ bởi 2 bên` khi cả hai bên hoàn tất.
  - Bản in PDF hợp đồng nhúng đầy đủ ngày giờ xác nhận điện tử của cả hai bên.

### 5. Gia hạn Hợp đồng (Phụ lục Gia hạn)

- `POST /api/v1/contracts/:contractId/renew` (`LANDLORD`), body `{ endDate, rentalPrice?, notes? }`.
- Chỉ cho hợp đồng chưa thanh lý (`ACTIVE` / `EXPIRING_SOON` / `EXPIRED`) và chưa lập phiếu quyết toán (`CONTRACT_SETTLEMENT_PREPARED`). `endDate` mới phải sau ngày kết thúc hiện tại và ở tương lai.
- Gia hạn **ngay trên hợp đồng hiện tại**: giữ nguyên mã hợp đồng, tiền cọc, khách thuê; phòng không đổi trạng thái. Giá thuê mới áp dụng cho hóa đơn tạo sau đó (hóa đơn đã lập giữ nguyên).
- Mỗi lần gia hạn thêm một mục `contract.renewals[]` (`previousEndDate`, `endDate`, `previousRentalPrice`, `rentalPrice`, `notes`, `renewedAt`, `renewedBy`) — hiển thị "Lịch sử gia hạn" trong hồ sơ hợp đồng. Audit `RENEW_CONTRACT`; mở lại tài khoản khách nếu đang bị tạm khóa.

### 6. Tiền cọc

- Hợp đồng có cọc `UNPAID` và còn hiệu lực trả thêm `depositPayment` trong `GET /contracts/:id`: số tiền, ngân hàng của chủ trọ, nội dung `COC ...`, `vietQrUrl`, `autoConfirm`. FE hiển thị khung VietQR chuyển cọc cho cả chủ trọ và khách thuê.
- Chủ trọ xác nhận thủ công: `POST /contracts/:id/deposit/received` (chỉ `UNPAID` $\rightarrow$ `PAID`, idempotent, audit `RECEIVE_CONTRACT_DEPOSIT`). Chuyển khoản đúng cú pháp được tự ghi nhận (10.3).
- Môi trường sandbox: `POST /contracts/:id/deposit/simulate` giả lập chuyển cọc qua đúng luồng đối soát (tắt ở production / `PAYMENT_SIMULATOR=false`).

### 7. Nội dung Hợp đồng & Bản in

- Hồ sơ hợp đồng luôn hiển thị đủ thông tin **Bên A** (chủ trọ: họ tên, CCCD, SĐT, địa chỉ thường trú — chủ trọ tự nhập trong Hồ sơ cá nhân) và **Bên B**, cùng **8 điều khoản** (quyền & nghĩa vụ hai bên, bảo quản tài sản, giá & thanh toán, tiền cọc, chấm dứt, giải quyết tranh chấp, điều khoản chung) căn cứ Bộ luật Dân sự 2015 & Luật Nhà ở 2023; số liệu lấy từ `contractTerms` và hợp đồng.
- Điều khoản không được thu gọn mặc định. Nút "In bản Hợp đồng" in **toàn bộ** hồ sơ (CSS `@media print` gỡ giới hạn chiều cao modal, ẩn sidebar / nút).

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
3. **Phân loại Tự động bằng TypeSafe Jev** (`BE/services/incidentTriage.js`, bật khi có `TYPESAFE_API_KEY`):
   - Jev chỉ trả lời **câu hỏi nhận định** (1 Choice: bộ phận hỏng; 6 Noul: có phải sự cố, nguy hiểm cho người, nước đang rò gây hư hại, mất hẳn tiện ích, phòng không khóa được, chỉ là lỗi nhỏ). **Quyết định nằm trong code** theo bảng: nguy hiểm $\rightarrow$ `URGENT`; nguy hiểm chưa chắc / nước rò / mất tiện ích / không khóa được $\rightarrow$ `HIGH`; lỗi nhỏ $\rightarrow$ `LOW`; còn lại `MEDIUM`. Ngưỡng Noul: ≥ 0.7 là có, < 0.3 là không, ở giữa $\rightarrow$ `triage.needsReview = true`.
   - Toàn bộ câu hỏi, lựa chọn, ngưỡng nằm trong **một file**; sửa câu hỏi phải chạy thử lại trên bộ báo cáo mẫu (kể cả ca giữ lại không dùng khi chỉnh), không viết tiêu chí cho riêng một ca lỗi.
   - Chạy nền **sau khi trả response** tạo sự cố; lỗi gọi API được lưu `triage.status: FAILED`, **không bao giờ coi lỗi là câu trả lời**. Sự cố do khách báo nhận mức ưu tiên gợi ý; nhân viên tạo thì giữ mức họ chọn. Nhân viên có thể "Phân loại lại" (`POST /incidents/:id/triage`).
   - Tiêu đề & mô tả sự cố được gửi tới `api.typesafe.ai`; tiếng Việt kém chính xác hơn tiếng Anh nên luôn có cờ "Cần xem lại" cho người quản lý.

---

# 14. NOTIFICATION RULES

1. **Đa kênh No-App**:
   - Hóa đơn và thông báo tiền phòng được gửi qua link trực tiếp qua SMS / Zalo OA / Email.
2. **Nội dung Nhắc nợ Thân thiện**:
   - Hỗ trợ nút sao chép nhanh nội dung nhắc nợ lịch sự để Chủ nhà gửi Zalo cho từng khách trọ.
3. **Chuông Thông báo trên TopBar** (`GET /notifications`, `GET /notifications/activity`):
   - **"Việc cần xử lý"**: đếm trực tiếp từ dữ liệu (không lưu bảng thông báo), theo vai trò. Mỗi nhóm có tổng số và tối đa 5 bản ghi gấp nhất, **ghi cụ thể** phòng – cơ sở – khách – mã hợp đồng/hóa đơn – số tiền – hạn / số ngày quá hạn, bấm mở đúng bản ghi. Nhóm: sự cố khẩn cấp / mới / cần xem lại, giao dịch chưa khớp, hóa đơn quá hạn, phiếu thu tiền mặt chờ duyệt, hợp đồng chờ xác nhận / sắp hết hạn, cọc chưa nhận, gói sắp hết hạn; khách thuê: hóa đơn cần trả / quá hạn, hợp đồng chờ xác nhận, cọc chưa chuyển; admin: yêu cầu đổi gói, hóa đơn SaaS chưa thu.
   - **"Hoạt động gần đây"**: 20 hoạt động gần nhất từ AuditLog (đúng phạm vi người xem) + sự kiện `activity` realtime; toast khi **người khác** thao tác.
   - Số đỏ trên chuông chỉ đếm phần **mới kể từ lần mở chuông trước** (nhớ theo tài khoản trên trình duyệt).

---

# 15. FRONTEND ARCHITECTURE RULES

1. **Cấu trúc Thư mục Feature-based & Modular Layout**:
   ```text
   FE/src/
   ├── assets/
   ├── components/
   │   ├── common/       # UI Components dùng chung cơ bản (Button, Modal, Table, Toast, Badge)
   │   └── layout/       # Khung điều hướng & cấu trúc ứng dụng phân tách:
   │       ├── AppLayout.jsx     # Khung làm việc chính (Sidebar + TopBar + Main Content Outlet)
   │       ├── Sidebar.jsx       # Menu điều hướng chính phân quyền theo Role, Logo & Badge
   │       ├── TopBar.jsx        # Thanh công cụ trên cùng (Quick Search CTA, Thông báo, Profile)
   │       ├── PublicLayout.jsx  # Khung trang công khai độc lập (Hóa đơn không cần cài App)
   │       ├── GlobalSearch.jsx  # Hộp thoại tìm kiếm nhanh toàn cục (Ctrl + K)
   │       └── index.js          # Barrel export layout components
   ├── context/          # AuthContext, ToastContext
   ├── hooks/            # useResource (reload / refresh ngầm), useDebounced, useLiveRefresh, useSocketEvent, hook theo trang
   ├── features/         # Module nghiệp vụ chuyên biệt (dashboard, branches, rooms, contracts, utility-readings, invoices, incidents, staff, tenants)
   ├── services/         # Toàn bộ logic gọi API Axios tập trung, không gọi trực tiếp trong UI components
   └── utils/            # Helper format tiền tệ VNĐ, ngày tháng, regex, storage
   ```

2. **Quy chuẩn Component UI**:
   - Tuyệt đối không gọi API trực tiếp trong các component render lớn. Mọi API logic phải nằm trong `services/`.
   - **Bắt buộc có đủ 3 trạng thái**: `LoadingState` (Skeleton/Spinner), `ErrorState` (Alert/Retry button), và `EmptyState` (Hình minh họa + Nút CTA).
   - **Debounce bắt buộc cho mọi ô tìm kiếm gọi API** (300ms, `useDebounced`); gợi ý địa chỉ (Photon) 350ms, tối thiểu 3 ký tự và hủy request cũ bằng `AbortController`. Ô chỉ lọc dữ liệu đã tải trên trình duyệt thì không cần.
   - Màn hình tự cập nhật bằng `useLiveRefresh([resources], refresh)` (16); làm mới ngầm không hiện spinner toàn trang và giữ dữ liệu cũ nếu lỗi.
   - Bộ lọc "Tất cả cơ sở" nghĩa là **không lọc** — không tự lấy `selectedBranchId` toàn cục làm giá trị mặc định / fallback.
   - Mở một bản ghi cụ thể bằng tham số URL (ví dụ `/contracts?contractId=...`, `/invoices?search=<mã>`), không lọc danh sách theo trường khác nghĩa.
   - Bắt buộc sử dụng **Toast Notification**. **TUYỆT ĐỐI CẤM** dùng hàm `alert()` mặc định của trình duyệt (_"local say"_).
   - `App.jsx` giữ vai trò router và bootstrap ứng dụng tinh gọn; mọi logic khung giao diện, thanh bên và thanh tiêu đề chuyển giao toàn bộ cho `components/layout/`.

3. **Công cụ Tìm kiếm Toàn cục (Global Quick Search Engine - `Ctrl + K`)**:
   - Hệ thống trang bị hộp thoại tìm kiếm nhanh toàn cục có thể kích hoạt bằng phím tắt `Ctrl + K` (Windows) hoặc `⌘ + K` (macOS), hoặc bấm vào ô tìm kiếm trên `TopBar`.
   - Tự động debounce 300ms và gửi truy vấn tới endpoint `GET /api/v1/search?q=<keyword>`.
   - Kết quả trả về được phân nhóm trực quan gồm:
     - **Cơ sở (Branches)**: Tên cơ sở, địa chỉ.
     - **Phòng (Rooms)**: Tên phòng, tầng, cơ sở trực thuộc.
     - **Hợp đồng (Contracts)**: Mã hợp đồng, tên khách thuê, số CCCD, phòng thuê.
     - **Hóa đơn (Invoices)**: Mã hóa đơn, phòng, số tiền, trạng thái gạch nợ.
   - Điều hướng trực tiếp tới đúng trang chi tiết của đối tượng khi người dùng click vào kết quả hoặc ấn Enter.
   - Cơ chế bảo mật: Backend tự động phân quyền dữ liệu theo `landlordId` và `assignedBranches` của người tìm kiếm.

4. **Bộ lọc Đa Tiêu chí Danh bạ Khách thuê (Tenant Directory Multi-Criteria Filter)**:
   - Danh bạ khách thuê hỗ trợ tìm kiếm kết hợp đa trường:
     - **Từ khóa tìm kiếm**: Tìm đồng thời trên Họ tên, Số CCCD 12 số, Số điện thoại, Email và Quê quán.
     - **Lọc Trạng thái**: Tất cả, Đang hoạt động (`ACTIVE`), Chờ đổi mật khẩu (`mustChangePassword`), Tạm khóa – hết hợp đồng (`INACTIVE`, 08.9).
     - **Lọc Quê quán / Tỉnh thành**: Trích xuất danh sách tỉnh thành duy nhất có trong dữ liệu khách thuê để lọc nhanh.
   - Hỗ trợ nút xóa nhanh bộ lọc (`Xóa lọc`) khi có bất kỳ tiêu chí nào đang áp dụng.

5. **Quy chuẩn Giao diện Modal Phức Tạp & Quản lý Cuộn Độc Lập (Scroll Containment)**:
   - Các màn hình chi tiết nhiều thông tin trong modal (như `ContractDetail.jsx`):
     - **Bento Grid / Card-based Structure**: Chia các khối thông tin thành các thẻ độc lập (Thẻ xác nhận điện tử 2 bên, Thẻ thông tin khách thuê & liên hệ, Thẻ chu kỳ & tài chính, Thẻ chỉ số bàn giao ban đầu, Điều khoản pháp lý).
     - **Quản lý Cuộn Độc Lập**: Khung nội dung modal phải được giới hạn chiều cao tối đa (`max-height: calc(88vh - 130px)`) và cho phép cuộn độc lập (`overflow-y: auto`) với thanh cuộn tuỳ biến tinh tế (chiều rộng 6px, bo góc mượt mà). Các khối con trong khung cuộn flex phải `flex-shrink: 0` (khối có `overflow: hidden` sẽ bị co về 0px nếu thiếu).
     - **Footer Cố Định (Sticky Modal Footer)**: Toàn bộ nút hành động nghiệp vụ (In hợp đồng, Sửa, Xác nhận ký, Đóng) đưa vào thuộc tính `footer` của `Modal` hoặc cố định ở chân, tuyệt đối không bị che khuất hoặc tràn màn hình khi người dùng cuộn nội dung.

6. **Code Splitting & Bundle**:
   - Mọi trang, modal lớn (Tạo hóa đơn, Chọn gói) và **từng tab admin** dùng `React.lazy` + `Suspense`; chỉ tải khi mở lần đầu.
   - `vite.config.js` tách thư viện thành chunk riêng (`vendor-react`, `vendor-network`, `vendor-icons`) để trình duyệt giữ cache qua các lần deploy; chunk ứng dụng chính giữ nhỏ (~14 KB gzip).

---

# 16. REALTIME / SOCKET.IO RULES

1. **Phân chia Socket Rooms** (`BE/realtime/index.js`):
   - `landlord:<landlordId>`: chủ trọ — doanh thu, hóa đơn được thanh toán, hoạt động chi tiết.
   - `branch:<branchId>`: quản lý của cơ sở đó — sự cố, hoạt động trong cơ sở.
   - `invoice:<invoiceId>`: trang hóa đơn (đăng nhập hoặc link công khai) — tín hiệu gạch nợ tức thì.
   - `user:<userId>`: mọi tài khoản — hoạt động liên quan trực tiếp tới người đó (hóa đơn, hợp đồng, sự cố của khách).
   - `scope:<landlordId>`: chủ trọ, quản lý, khách thuê của một chuỗi — chỉ nhận gợi ý làm mới `data:changed`.
   - `admins` / `landlords`: SUPER_ADMIN / mọi chủ trọ (thay đổi gói, thuê bao).
2. **Sự kiện**:
   - `payment:success`, `invoice_paid`: sau khi transaction commit $\rightarrow$ trang hóa đơn tự chuyển tích xanh không cần F5.
   - `incident:created`, `incident:updated`, `contract:deposit_received`.
   - `data:changed` `{ resources: [...] }` (`BE/realtime/liveUpdates.js`): phát sau **mọi** thao tác ghi thành công (middleware sau response), webhook ngân hàng, IPN cổng thanh toán, phân loại sự cố. **Không chứa dữ liệu** — chỉ tên nhóm (contracts, rooms, invoices, payments, unmatched, incidents, dashboard, notifications, ...), nên được gửi cho cả chuỗi. Bảng `RELATED` quy định một thay đổi ảnh hưởng những màn nào.
   - `activity` (`BE/realtime/activity.js`): **ai làm gì, phòng nào, cơ sở nào, mã hợp đồng / hóa đơn nào, số tiền**. Vì có dữ liệu cá nhân nên **chỉ gửi** `landlord:`, `branch:` của cơ sở liên quan, `user:` của khách liên quan và `admins` (việc về gói). Danh sách hành động & câu chữ: `ACTIONS`.
3. **Nguyên tắc**: chỉ phát sau khi transaction commit; lỗi realtime không được làm hỏng request đã thành công; FE gộp các thay đổi liên tiếp (debounce 400ms) thành một lần làm mới.

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
     before: Object,          // Chỉ các trường đã thay đổi (giá trị cũ)
     after: Object,           // Chỉ các trường đã thay đổi (giá trị mới)
     ipAddress: String,
     userAgent: String,
     expiresAt: Date,         // Hạn lưu trữ (TTL)
     createdAt: Date
   }
   ```
   - `actorRole` có thêm `SYSTEM` cho thay đổi không có người đăng nhập (webhook ngân hàng, IPN, job tự khóa tài khoản).
   - **Chỉ lưu trường thay đổi** (`BE/utils/auditPolicy.js` → `changedFields`): so sánh cấp đầu, bỏ qua `_id`, `__v`, `createdAt`, `updatedAt`, các trường version nội bộ. Bản ghi tạo mới / xóa lưu nguyên dữ liệu truyền vào.
   - **Hạn lưu trữ (TTL index `expiresAt`)**: log thường `AUDIT_RETENTION_DAYS` (mặc định 365 ngày); **log tài chính** `AUDIT_FINANCE_RETENTION_DAYS` (mặc định 3650 ngày) — `entityType` `INVOICE` / `PLATFORM_INVOICE` / `SUBSCRIPTION` hoặc action chứa `PAYMENT`, `BANK`, `DEPOSIT`, `SETTLE`, `PRICING`, `COST`. Đặt `0` để giữ vĩnh viễn.
   - Trang audit của admin: tổng số khi không lọc dùng `estimatedDocumentCount`.
2. **Các hành động Bắt buộc Ghi Audit**:
   - Sửa đổi biểu giá điện/nước.
   - Thay đổi STK ngân hàng nhận tiền.
   - Hủy hóa đơn hoặc xác nhận thanh toán tiền mặt thủ công.
   - Gia hạn (`RENEW_CONTRACT`) hoặc thanh lý hợp đồng thuê phòng; xác nhận / tự ghi nhận tiền cọc (`RECEIVE_CONTRACT_DEPOSIT`).
   - Tự khóa / mở lại tài khoản khách thuê (`DEACTIVATE_TENANT`, `REACTIVATE_TENANT`); phân loại lại sự cố (`TRIAGE_INCIDENT`).
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
   - Chạy song song các truy vấn độc lập (`Promise.all`), ví dụ xác thực mỗi request kiểm tra user và phiên cùng lúc.
   - Sắp xếp / giới hạn / đếm trong MongoDB (aggregate, `$group`) thay vì tải hàng loạt về Node rồi lọc; `$lookup` chỉ chạy sau `$limit`.
   - Mỗi kiểu sắp xếp của trang danh sách phải có compound index tương ứng (05.2).
2. **Tối ưu Bundle Size Frontend**:
   - Tách bundle bằng Dynamic Import (`React.lazy`) cho trang, modal và tab admin; tách chunk thư viện (15.6).
   - Dashboard tải 2 đợt: số liệu chính (thống kê, công nợ tính sẵn ở BE) hiện ngay, danh sách phụ tải sau.
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
   - Cung cấp file `.env.example` đầy đủ các key mẫu. Các key thêm gần đây: `CLIENT_URL` (nhiều origin, phẩy), `PUBLIC_APP_URL`, `VERCEL_PREVIEW_SUFFIX`, `TRUST_PROXY`, `COOKIE_SAME_SITE`, `AUDIT_RETENTION_DAYS`, `AUDIT_FINANCE_RETENTION_DAYS`, `TENANT_AUTO_LOCK`, `TENANT_LOCK_AFTER_DAYS`, `TYPESAFE_API_KEY`, `TYPESAFE_MODEL`, `PAYMENT_SIMULATOR`.
3. **Migration khi khởi động** (`BE/config/migrations.js`, chạy trước `createIndexes()`, idempotent): xóa index cũ bị thay thế, backfill dữ liệu (ví dụ `expiresAt` của AuditLog), gỡ `features` / `featureFlags` cũ khỏi gói. Sau mỗi lần cập nhật cần khởi động lại BE.

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
