# Phan cong task va API contract

> Cap nhat 04/11/2026: dong bo voi code hien tai (hop dong nhap / ky 2 ben, bien nhan coc, so thanh toan theo loai, phieu chi, su co nguoi thue chiu phi, payOS, Bank Hub, realtime theo nguoi nhan). Chi tiet tung API: `BE/API.md`. Quy tac nghiep vu: `docs/PROJECT_RULES.md`.

## 1. Muc tieu

Tai lieu nay chot pham vi lam viec cua 4 developer va API contract chung cho Branch, Room, Contract, Tenant, Utility Reading, Invoice, Payment, Expense, Dashboard, Incident, Notification, SaaS Plan va SaaS Admin.

Tat ca API dung prefix:

```text
/api/v1
```

Backend dung role `SUPER_ADMIN`. Chu "ADMIN" tren giao dien chi la nhan hien thi.

## 2. Quy tac lam viec chung

- Moi developer lam tren mot branch rieng.
- Khong doi ten field hoac endpoint da chot neu khong co approval cua ca nhom.
- Moi tai nguyen tenant-level phai co `landlordId`.
- Moi truy van phai kiem tra `isDeleted: false`, landlord scope va branch scope (`getTenantScope`, `getBranchScope`, `scoped`, `assertBranchScope` trong `BE/utils/scope.js`).
- Tien luu bang so nguyen VND, khong dung so thuc.
- Khong xoa cung invoice / payment / expense da phat sinh; huy bang trang thai (`CANCELLED`, `FAILED`, `VOID`) kem ly do.
- Controller mong; logic nghiep vu nam trong `services/`.
- API thanh cong dung `success: true`; API loi dung `success: false`, `errorCode` va `message`.
- `message` loi la cau tieng Viet nghiep vu, khong chua ma loi, ma trang thai tho hay ten truong API. `errorCode` chi de code xu ly, khong hien len man hinh (muc 5).
- Nhom trang thai hop dong dung chung (`BE/utils/statuses.js`): `LIVE_CONTRACT_STATUSES` (da ky du 2 ben, duoc tinh tien) va `OPEN_CONTRACT_STATUSES` (`DRAFT` + live: giu phong, nhan coc).
- Backend khong tu tao tai khoan nao khi khoi dong (admin tao truc tiep trong DB). Khong chay script seed tren DB that.
- Hanh dong ghi moi phai khai bao nhom nguoi nhan "activity" (`OWNER` / `STAFF` / `TENANT` / `ADMIN`, muc 6).

## 3. Phan cong 4 developer

### DEV 1 - Property Core

**Phu trach:** Co so, phong, hop dong, khach thue, xac thuc va nen tang dung chung.

```text
BE/controllers/branchController.js      BE/routes/branchRoutes.js      BE/services/branchService.js
BE/controllers/roomController.js        BE/routes/roomRoutes.js        BE/services/roomService.js
BE/controllers/contractController.js    BE/routes/contractRoutes.js    BE/services/contractService.js
BE/services/contractSettlementService.js
BE/controllers/accountController.js     BE/routes/tenantRoutes.js      BE/services/accountService.js
BE/services/accountValidation.js        BE/services/propertyValidation.js
BE/routes/authRoutes.js                 BE/services/authService.js     BE/middlewares/auth.js
BE/controllers/profileController.js     BE/routes/profileRoutes.js     BE/services/profileService.js
BE/jobs/tenantAccess.js
BE/models/Branch.js  BE/models/Room.js  BE/models/Contract.js  BE/models/User.js  BE/models/AuthSession.js
BE/utils/scope.js  BE/utils/errors.js  BE/utils/response.js  BE/utils/validation.js
BE/utils/statuses.js  BE/utils/statusLabels.js  BE/config/migrations.js
FE/src/features/auth/  FE/src/features/branches/  FE/src/features/rooms/
FE/src/features/contracts/  FE/src/features/tenants/  FE/src/features/profile/ (tru BankHubModal)
FE/src/context/AuthContext.jsx  FE/src/hooks/useAuthForms.js  FE/src/services/api.js (interceptor loi)
```

**Ownership:**

- Authentication, session token, dang ky chu tro (dang ky xong tu dang nhap), chon tai khoan khi cung CCCD o nhieu chu tro (`selectionRequired` / `accountId`).
- Scope helper, phan quyen theo role, error classes, response format, `friendlyErrorMessage` o FE.
- Quota guard cho branch, room va manager; audit helper dung chung.
- Hop dong nhap -> ky 2 ben -> hieu luc (`ACTIVATE_CONTRACT`), huy nhap, gia han, quyet toan / thanh ly.
- Tien coc: VietQR coc, xac nhan nhan coc (tao bien nhan `Payment` `CONTRACT_DEPOSIT` qua `services/payments/depositPayment.js` cua DEV 3).
- Tu khoa / mo lai tai khoan khach thue theo hop dong (`jobs/tenantAccess.js`).
- Danh ba khach thue (`GET /tenants`).

**Ban giao:** auth contract, scope helper, model branch/room/contract/user, nhom trang thai hop dong va quota interface.

### DEV 2 - Operations

**Phu trach:** Chot dien nuoc, su co, phieu chi sua chua, nhan su.

```text
BE/controllers/utilityReadingController.js  BE/routes/utilityReadingRoutes.js  BE/services/utilityReadingService.js
BE/controllers/incidentController.js        BE/routes/incidentRoutes.js        BE/services/incidentService.js
BE/services/incidentTriage.js
BE/controllers/expenseController.js         BE/routes/expenseRoutes.js         BE/services/expenseService.js
BE/routes/staffRoutes.js
BE/models/UtilityReading.js  BE/models/Incident.js  BE/models/Expense.js
FE/src/features/utility-readings/  FE/src/components/utility-readings/
FE/src/features/incidents/  FE/src/components/incidents/  (IncidentChargePanel, IncidentExpensePanel, TransitionModal)
FE/src/features/payments/ExpenseList.jsx
FE/src/features/staff/
```

**Nghiep vu:**

- Chot dien nuoc chi cho phong co hop dong da ky (live); canh bao tang > 2.5 lan.
- Su co: `PENDING -> IN_PROGRESS -> SOLVED -> CLOSED`, phan loai TypeSafe, anh nghiem thu tuy chon.
- Ben chiu phi chon mot lan: chu tro chiu / mien phi, hoac bao gia cho nguoi thue; nguoi thue tu choi bao gia thi chi chu tro duoc nhan chiu phi.
- Su co nguoi thue chiu phi: bao gia -> nguoi thue duyet -> sua -> quan ly nghiem thu -> nguoi thue nghiem thu -> xuat hoa don `invoiceType: INCIDENT`.
- Phieu chi (`Expense`) tra tho / don vi sua; xem thu - chi - chenh lech cua tung su co (chi nhan vien).

**Quy tac:** dung auth/scope va quota do Dev 1 ban giao; khong tao scope rieng. Hoa don su co tao trong `incidentService` theo dung schema `Invoice` cua Dev 3.

### DEV 3 - Finance

**Phu trach:** Hoa don, thanh toan, doi soat ngan hang, so thanh toan.

```text
BE/controllers/invoiceController.js   BE/routes/invoiceRoutes.js   BE/services/invoiceService.js
BE/controllers/paymentController.js   BE/routes/paymentRoutes.js   BE/services/paymentService.js
BE/services/payments/applyPayment.js  BE/services/payments/bankTransferService.js
BE/services/payments/cashPaymentService.js  BE/services/payments/depositPayment.js
BE/services/payments/unmatchedPaymentService.js
BE/services/financeCalculation.js  BE/utils/financeValidation.js  BE/utils/paymentSimulator.js  BE/utils/vnTime.js
BE/controllers/bankHubController.js   BE/routes/bankHubRoutes.js   BE/services/bankHubService.js  BE/services/bankHubClient.js
BE/middlewares/financeSecurity.js     BE/services/auditService.js  BE/utils/auditPolicy.js
BE/models/Invoice.js  BE/models/Payment.js  BE/models/PaymentReceipt.js  BE/models/UnmatchedPayment.js  BE/models/AuditLog.js
FE/src/features/invoices/  FE/src/components/invoices/
FE/src/features/payments/ (PaymentHistoryList, CashPaymentModal, ResolveUnmatchedModal, UnmatchedPaymentList, printReceipt)
FE/src/features/public-invoice/  FE/src/features/profile/BankHubModal.jsx
FE/src/utils/formatters.js (getPaymentStatusMeta, paymentPayer, paymentHandlers)
```

**Nghiep vu bat buoc:** tinh hoa don, VietQR, hoa don cong khai, webhook SePay + IPN Bank Hub, idempotency, thanh toan mot phan / thua, thu tien mat co duyet (quan ly bao -> chu tro duyet / tu choi), giao dich chua khop, gia lap (chi sandbox), audit transaction.

**So thanh toan:** `Payment.purpose` = `INVOICE` | `CONTRACT_DEPOSIT`; tab Tien phong & dich vu / Tien sua chua su co / Tien coc / Phieu chi / Chuyen khoan chua khop; ghi ro nguoi nop, nguoi thu, nguoi duyet; in bien nhan.

### DEV 4 - Platform, Dashboard va Realtime

**Phu trach:** Dashboard, goi SaaS va thanh toan goi, admin nen tang, thong bao, tim kiem, realtime, layout.

```text
BE/controllers/dashboardController.js  BE/routes/dashboardRoutes.js  BE/services/dashboardService.js
BE/controllers/planController.js       BE/routes/planRoutes.js       BE/services/saasPlanService.js
BE/services/saasPaymentService.js (payOS)  BE/services/upgradeRequestService.js  BE/services/planFeatures.js
BE/services/quotaService.js  BE/utils/planFeatures.js  BE/utils/httpJson.js  BE/utils/appUrls.js
BE/controllers/adminController.js      BE/routes/adminRoutes.js      BE/services/adminService.js
BE/services/analyticsService.js        BE/controllers/userController.js  BE/routes/userRoutes.js
BE/controllers/searchController.js     BE/routes/searchRoutes.js     BE/services/searchService.js
BE/routes/notificationRoutes.js        BE/services/notificationService.js
BE/realtime/index.js  BE/realtime/liveUpdates.js  BE/realtime/activity.js  BE/realtime/audience.js
BE/models/SaaSPlan.js  BE/models/Subscription.js  BE/models/PlatformInvoice.js  BE/models/PlanUpgradeRequest.js
BE/services/emailService.js  BE/services/debtReminderService.js  BE/models/DebtReminder.js  BE/jobs/debtReminders.js
FE/src/components/layout/ (AppLayout, Sidebar, TopBar, NotificationBell, GlobalSearch, PublicLayout)
FE/src/features/dashboard/  FE/src/components/dashboard/
FE/src/features/plans/  FE/src/features/saas-admin/
FE/src/hooks/useLiveRefresh.js  FE/src/services/socket.js
```

**Nghiep vu:** Socket.io (`data:changed`, `activity` theo nhom nguoi nhan), chuong "Viec can xu ly" + "Hoat dong gan day", dashboard chu tro (dong tien thu, phieu chi, dong tien rong), goi SaaS (moi goi du tinh nang, khac han ngach), thanh toan goi qua **payOS**, nhac no qua email (gui tay + job tu dong, thay mat chu tro), admin: goi, chu tro (giam sat tai khoan nhan tien - chi xem), thue bao, hoa don SaaS, yeu cau doi goi, analytics, audit log; tim kiem toan cuc.

## 4. API contract chung

### 4.1 Authentication

```http
POST /api/v1/auth/register          (chu tro tu dang ky, 201, khong tao phien)
POST /api/v1/auth/login
POST /api/v1/auth/refresh           (cookie refreshToken)
POST /api/v1/auth/change-password
POST /api/v1/auth/logout
GET  /api/v1/auth/me
```

Request login (`email` hoac `username`; `accountId` khi chon tai khoan):

```json
{ "username": "001234567890", "password": "password123", "accountId": "user_id (tuy chon)" }
```

Response dang nhap thanh cong:

```json
{
  "success": true,
  "data": {
    "token": "jwt-token",
    "user": {
      "id": "user_id",
      "name": "Manager A",
      "role": "PROPERTY_MANAGER",
      "landlordId": "landlord_id",
      "assignedBranches": ["branch_id"],
      "mustChangePassword": false
    }
  }
}
```

Nhieu tai khoan cung dung mat khau (cung CCCD o nhieu chu tro) -> chua tao phien:

```json
{
  "success": true,
  "data": {
    "selectionRequired": true,
    "accounts": [{ "id": "user_id", "roleName": "Khach thue", "landlordName": "Chu tro A", "places": ["Toa Cau Giay - Phong P.101"] }]
  }
}
```

Request co header `Authorization: Bearer <token>`. `mustChangePassword: true` -> moi API nghiep vu tra `403 PASSWORD_CHANGE_REQUIRED`. Khach thue bi tam khoa vi het hop dong -> `403 TENANT_INACTIVE`.

### 4.2 Branch

```http
GET    /api/v1/branches
POST   /api/v1/branches                      (LANDLORD)
GET    /api/v1/branches/:branchId
PUT    /api/v1/branches/:branchId            (LANDLORD)
DELETE /api/v1/branches/:branchId            (LANDLORD)
```

POST body:

```json
{
  "name": "Co so Cau Giay",
  "totalFloors": 4,
  "address": { "fullAddress": "Ha Noi" },
  "defaultElectricityPrice": 3500,
  "waterBillingType": "METER",
  "defaultWaterPrice": 30000,
  "defaultServices": [{ "name": "Wifi", "price": 100000, "billingType": "PER_ROOM" }],
  "billingCycleDay": 1,
  "paymentDueDays": 5
}
```

### 4.3 Room

```http
GET    /api/v1/branches/:branchId/rooms?status=EMPTY
POST   /api/v1/branches/:branchId/rooms        (LANDLORD, basePrice bat buoc >= 1)
POST   /api/v1/branches/:branchId/rooms/bulk   (LANDLORD, basePrice bat buoc)
GET    /api/v1/rooms/:roomId
PUT    /api/v1/rooms/:roomId
DELETE /api/v1/rooms/:roomId                   (LANDLORD, khong xoa phong con hop dong nhap / dang chay)
```

POST bulk body:

```json
{ "fromFloor": 1, "toFloor": 4, "fromRoomNumber": 101, "toRoomNumber": 105, "prefix": "P.", "basePrice": 3500000 }
```

### 4.4 Contract va Tenant

```http
GET  /api/v1/contracts?status=DRAFT|ACTIVE|EXPIRING_SOON|EXPIRED|TERMINATED&branchId=&search=&depositStatus=&confirmation=PENDING|CONFIRMED
POST /api/v1/contracts                               (LANDLORD)
GET  /api/v1/contracts/:contractId
POST /api/v1/contracts/:contractId/confirm/landlord  (LANDLORD)
POST /api/v1/contracts/:contractId/confirm/tenant    (TENANT dung ten)
POST /api/v1/contracts/:contractId/cancel            (LANDLORD, chi DRAFT)
POST /api/v1/contracts/:contractId/renew             (LANDLORD)
POST /api/v1/contracts/:contractId/deposit/received  (LANDLORD)
POST /api/v1/contracts/:contractId/deposit/simulate  (chi sandbox)
POST /api/v1/contracts/:contractId/settlement        (LANDLORD)
POST /api/v1/contracts/:contractId/terminate         (LANDLORD)
GET  /api/v1/tenants?search=&status=&page=1&limit=20 (LANDLORD, PROPERTY_MANAGER)
POST /api/v1/tenants/:tenantId/reset-password
```

POST body tao hop dong:

```json
{
  "branchId": "branch_id",
  "roomId": "room_id",
  "tenant": { "name": "Nguyen Van A", "citizenId": "001234567890", "email": "tenant@example.com", "phoneNumber": "0912345678" },
  "startDate": "2026-10-01",
  "endDate": "2027-10-01",
  "rentalPrice": 3500000,
  "depositAmount": 3500000,
  "depositStatus": "UNPAID",
  "initialElectricIndex": 100,
  "initialWaterIndex": 20,
  "roommates": []
}
```

- Tao hop dong trong 1 transaction: tao / lien ket tenant, phong `RENTED` (giu cho), hop dong `status: DRAFT`, **chua ai ky**. Tenant moi -> response 201 co `tenantCredentials: { username, temporaryPassword, mustChangePassword: true }`. `depositStatus: PAID` -> tao bien nhan coc ngay.
- Ky: `confirm/landlord` / `confirm/tenant` ghi `landlordConfirmedAt` / `tenantConfirmedAt`; chu ky thu hai chuyen `DRAFT -> ACTIVE` (`activatedAt`, audit `ACTIVATE_CONTRACT`). Response `data` = hop dong day du (co `status`, `displayStatus`, `confirmedByBothParties`).
- Hop dong `DRAFT`: nhan coc duoc; khong chot dien nuoc, khong tao hoa don (`409 CONTRACT_NOT_SIGNED`), khong gia han / quyet toan.
- `cancel` `{ reason? }`: `TERMINATED` + `cancelledAt`, phong ve `EMPTY`, coc da nhan ghi `REFUNDED`. Hop dong da ky -> `409 CONTRACT_NOT_DRAFT`.
- `renew` `{ endDate, rentalPrice?, notes? }`: them `renewals[]`, mo lai tai khoan khach neu dang tam khoa.
- `deposit/received` `{ paymentMethod?: "CASH" | "BANK_TRANSFER", note? }`: `UNPAID -> PAID`, tao `Payment` `purpose: CONTRACT_DEPOSIT`, thong bao nguoi thue.

Danh ba khach thue - response:

```json
{
  "success": true,
  "data": {
    "items": [{ "_id": "user_id", "name": "Nguyen Van A", "username": "001234567890", "phoneNumber": "0912345678", "status": "ACTIVE", "hometown": "Ha Noi" }],
    "total": 1, "page": 1, "limit": 20
  }
}
```

### 4.5 Utility Reading

```http
GET  /api/v1/branches/:branchId/utility-readings?billingPeriod=2026-10
POST /api/v1/utility-readings
GET  /api/v1/utility-readings/:readingId
PUT  /api/v1/utility-readings/:readingId
```

POST body:

```json
{ "branchId": "branch_id", "roomId": "room_id", "billingPeriod": "2026-10", "electricNewIndex": 145, "waterNewIndex": 24, "electricImage": "https://...", "waterImage": "https://..." }
```

Rules: chi so moi >= chi so cu; chi so da lap hoa don khong sua duoc; tang > 2.5 lan trung binh can xac nhan (`confirmAbnormal: true`); chi phong co hop dong da ky.

### 4.6 Invoice

```http
GET  /api/v1/invoices?status=&branchId=&billingPeriod=2026-10
POST /api/v1/invoices/generate                        (LANDLORD)
GET  /api/v1/invoices/:invoiceId
GET  /api/v1/invoices/:invoiceId/payments
POST /api/v1/invoices/:invoiceId/issue
POST /api/v1/invoices/:invoiceId/cancel
GET  /api/v1/invoices/public/:publicAccessToken        (khong dang nhap)
POST /api/v1/invoices/public/:publicAccessToken/simulate-payment  (chi sandbox)
```

Generate body:

```json
{ "branchId": "branch_id", "billingPeriod": "2026-10", "dueDate": "2026-10-05", "roomIds": ["room_id_1"] }
```

- Khong truyen `roomIds`: tao cho moi phong dang thue, **bo qua phong co hop dong nhap**. Truyen `roomIds` co phong nhap -> `409 CONTRACT_NOT_SIGNED`.
- `invoiceType`: `MONTHLY` | `SETTLEMENT` | `INCIDENT` (hoa don sua chua, ma `HDSC...`, co `incidentId`, phat hanh ngay). Moi phong / ky chi 1 hoa don `MONTHLY` / `SETTLEMENT` song; `INCIDENT` gioi han 1 hoa don song / su co.

Invoice response phai co:

```json
{
  "id": "invoice_id",
  "invoiceCode": "HD2026100001",
  "invoiceType": "MONTHLY",
  "billingPeriod": "2026-10",
  "tenantId": "tenant_id",
  "branchId": "branch_id",
  "roomId": "room_id",
  "totalAmount": 3850000,
  "paidAmount": 0,
  "remainingAmount": 3850000,
  "overpaidAmount": 0,
  "status": "ISSUED",
  "isOverdue": false,
  "dueDate": "2026-10-05",
  "vietQrUrl": "https://img.vietqr.io/image/...",
  "paymentSyntax": "HD2026100001 P101"
}
```

### 4.7 Payment, thu tien mat va doi soat

```http
POST /api/v1/payments/webhook                          (SePay, khong dang nhap)
POST /api/v1/payments/cash                             (LANDLORD, PROPERTY_MANAGER)
POST /api/v1/payments/cash/:paymentId/confirm          (LANDLORD)
POST /api/v1/payments/cash/:paymentId/reject           (LANDLORD, { reason })
GET  /api/v1/payments?purpose=INVOICE|INCIDENT|CONTRACT_DEPOSIT&paymentMethod=&branchId=&contractId=
GET  /api/v1/payments/:paymentId
GET  /api/v1/payments/unmatched?status=PENDING_REVIEW|RESOLVED|IGNORED   (LANDLORD)
POST /api/v1/payments/unmatched/:unmatchedPaymentId/resolve              (LANDLORD, { invoiceId })
POST /api/v1/bank-hub/ipn   POST /api/v1/bank-hub/events                 (SePay Bank Hub, khong dang nhap)
GET  /api/v1/bank-hub   POST /api/v1/bank-hub/link-token   POST /api/v1/bank-hub/sync   (LANDLORD)
```

POST cash body:

```json
{
  "invoiceId": "invoice_id",
  "amount": 3850000,
  "receiptNumber": "CASH-20260930-0001",
  "transactionDate": "2026-09-30T10:30:00.000Z",
  "payerName": "Nguyen Van A",
  "cashCollectionPoint": "Quay thu co so A",
  "note": "Thu tien phong thang 10"
}
```

Response (chu tro ghi):

```json
{
  "success": true,
  "message": "Da xac nhan thu tien mat",
  "data": {
    "payment": { "id": "payment_id", "invoiceId": "invoice_id", "amount": 3850000, "paymentMethod": "CASH", "referenceCode": "CASH-20260930-0001", "status": "SUCCESS", "reportedBy": "user_id", "confirmedBy": "user_id" },
    "invoice": { "id": "invoice_id", "paidAmount": 3850000, "remainingAmount": 0, "overpaidAmount": 0, "status": "PAID" }
  }
}
```

Quan ly ghi -> `payment.status: PENDING_CONFIRMATION`, `pendingConfirmation: true`, hoa don chua doi.

Payment rules:

- `referenceCode` / `receiptNumber` duy nhat trong (chu tro, phuong thuc) va immutable.
- Khong thu invoice `CANCELLED`, khong thu tiep invoice `PAID`.
- Tao Payment, update Invoice va AuditLog trong cung transaction; emit realtime sau khi commit.
- Webhook trung reference tra HTTP 200, khong tao giao dich thu hai.
- Thu tien mat ghi `reportedBy`, `confirmedBy`, audit `CONFIRM_CASH_PAYMENT` / `REPORT_CASH_PAYMENT` / `REJECT_CASH_PAYMENT`.
- `GET /payments` (chu tro / quan ly) populate `invoiceId` / `contractId` kem phong, co so, nguoi thue (`name`, `phoneNumber`) va `reportedBy` / `confirmedBy` / `reviewedBy` (`name`, `role`). Nguoi thue chi thay giao dich hoa don cua minh va bien nhan coc hop dong dung ten minh.
- Gia lap (`simulate-payment`, `deposit/simulate`): code tu tao giao dich `SANDBOX_SIMULATOR` / `SIM-...` va chay cung ham doi soat; khong qua SePay; tat o production.

### 4.8 Expense (phieu chi)

```http
GET  /api/v1/expenses?branchId=&incidentId=&status=RECORDED|VOID&page=&limit=   (LANDLORD, PROPERTY_MANAGER)
POST /api/v1/expenses                                                         (LANDLORD, PROPERTY_MANAGER)
POST /api/v1/expenses/:expenseId/void                                         (LANDLORD, { reason })
```

POST body (su co da bat dau xu ly):

```json
{ "incidentId": "incident_id", "payee": "Tho dien Anh Tuan", "amount": 350000, "paymentMethod": "CASH", "paidAt": "2026-11-03", "referenceCode": "PC-001", "note": "Vat tu + cong" }
```

`GET` tra `{ data, pagination, totals: { all, CASH, BANK_TRANSFER } }` (khong tinh phieu `VOID`). Nguoi thue khong truy cap duoc.

### 4.9 Dashboard landlord

```http
GET /api/v1/dashboard/stats?branchId=&billingPeriod=2026-10
GET /api/v1/dashboard/debts?branchId=
```

Response:

```json
{
  "success": true,
  "data": {
    "collection": {
      "expectedAmount": 10000000,
      "collectedAmount": 7500000,
      "collectionRate": 75,
      "receivedAmount": 7800000,
      "receivedByMethod": { "BANK_TRANSFER": 5000000, "CASH": 2800000 },
      "paidOutAmount": 350000,
      "netCashFlow": 7450000
    },
    "debts": { "roomCount": 2, "totalAmount": 2500000, "items": [] },
    "occupancy": { "totalRooms": 20, "rentedRooms": 16, "rate": 80 },
    "contracts": { "live": 16, "expiringSoon": 2, "expired": 0 }
  }
}
```

Tien coc khong tinh vao `receivedAmount`. `PROPERTY_MANAGER` khong duoc xem doanh thu tong cua chu tro.

Moi dong trong `/dashboard/debts` co them `tenant.email` (null = khach chua co email) va `lastReminder { sentAt, status: SENT|FAILED, auto }`.

### 4.9.1 Nhac no qua email

```http
POST /api/v1/invoices/:invoiceId/reminders     (LANDLORD, PROPERTY_MANAGER trong co so duoc giao)
GET  /api/v1/dashboard/reminder-settings       (LANDLORD)
PUT  /api/v1/dashboard/reminder-settings       (LANDLORD) body { "autoEmail": true|false }
```

- Email gui thay mat chu tro: ten nguoi gui `<ten chu tro> - <ten co so>`, `Reply-To` = email chu tro, kem link No-App `/i/<token>` de quet VietQR.
- `POST .../reminders` tra `{ id, invoiceId, to, auto, status, sentAt }`. Loi: `409 INVOICE_NOT_OWING`, `422 TENANT_EMAIL_MISSING`, `429 REMINDER_RECENTLY_SENT` (gui lai trong 10 phut), `503 EMAIL_NOT_CONFIGURED`, `502 EMAIL_UNAVAILABLE`.
- Job `jobs/debtReminders.js`: moi gio, chi gui 8:00-20:00 gio VN; ngay gui: 3 ngay truoc han, dung han, 1 ngay sau han, roi 3 ngay mot lan toi 60 ngay qua han; toi da 1 email / hoa don / ngay. Chu tro tat bang `autoEmail: false`; tat toan he thong bang `DEBT_REMINDER_AUTO=false`.
- Luon gui that. Env: `EMAIL_PROVIDER=smtp|brevo` (trong = tu chon theo khoa), `SMTP_USER`, `SMTP_PASS` (Gmail App Password), `SMTP_HOST`, `SMTP_PORT`, `BREVO_API_KEY`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME`. Chua cau hinh -> `503 EMAIL_NOT_CONFIGURED`, job khong gui.

### 4.10 Incident va Staff

```http
GET  /api/v1/incidents?branchId=&status=&priority=&category=&needsReview=true
POST /api/v1/incidents
GET  /api/v1/incidents/:incidentId
PUT  /api/v1/incidents/:incidentId/status            (LANDLORD, PROPERTY_MANAGER)
PUT  /api/v1/incidents/:incidentId/cost              (LANDLORD, PROPERTY_MANAGER)
POST /api/v1/incidents/:incidentId/triage            (LANDLORD, PROPERTY_MANAGER)
POST /api/v1/incidents/:incidentId/quote             (LANDLORD, PROPERTY_MANAGER)
POST /api/v1/incidents/:incidentId/quote/respond     (TENANT dung ten hop dong)
POST /api/v1/incidents/:incidentId/acceptance        (TENANT dung ten hop dong)

GET  /api/v1/staff
POST /api/v1/staff
POST /api/v1/staff/:staffId/reset-password
```

Incident status:

```text
PENDING -> IN_PROGRESS -> SOLVED -> CLOSED      (PENDING -> REJECTED; SOLVED -> IN_PROGRESS khi mo lai)
```

- `PUT status` body `{ status, note?, assignedTo?, resolvedImages? }`; `resolvedImages` (anh nghiem thu) **tuy chon**.
- `PUT cost` `{ repairCost, costPayer: "LANDLORD" | "NONE", note? }`; khong nhan `TENANT` (`INCIDENT_QUOTE_REQUIRED`). Phieu da bao gia cho nguoi thue -> `INCIDENT_PAYER_LOCKED`, tru khi nguoi thue da tu choi (chi LANDLORD).
- `quote` `{ amount, note? }`: chi khi `PENDING`, co hop dong, chua ghi chu tro chiu phi. `quote/respond` `{ accept, note? }` (tu choi bat buoc `note`). Chua `ACCEPTED` thi khong `IN_PROGRESS` (`INCIDENT_QUOTE_NOT_ACCEPTED`).
- `acceptance` `{ accept, note? }`: chi khi `SOLVED` + nguoi thue chiu phi. Dat -> `CLOSED` + hoa don `INCIDENT` (`chargeInvoiceId`, `chargeInvoiceCode`); chua dat -> `IN_PROGRESS`. Nhan vien khong tu `CLOSED` phieu nguoi thue chiu phi.
- `GET /incidents/:id` (nhan vien) tra them `expenses` va `finance { payer, billed, collected, invoice, paidOut, net }`.

### 4.11 Profile, Notification va Search

```http
GET  /api/v1/profile        PUT /api/v1/profile        PUT /api/v1/profile/bank-account (LANDLORD)
GET  /api/v1/notifications              (nhom "Viec can xu ly" theo vai tro)
GET  /api/v1/notifications/activity     (20 hoat dong gan nhat, dung pham vi nguoi xem)
GET  /api/v1/search?q=<keyword>         (LANDLORD, PROPERTY_MANAGER)
```

Search tra `{ branches, rooms, contracts, invoices }`, moi muc `{ id, title, subtitle, type, link }`, gioi han theo `landlordId` va `assignedBranches`.

### 4.12 SaaS Plan va thanh toan goi (payOS)

```http
GET  /api/v1/plans                                       (LANDLORD)
GET  /api/v1/plans/upgrade-requests    POST /api/v1/plans/upgrade-requests
POST /api/v1/plans/upgrade-requests/:requestId/cancel
GET  /api/v1/plans/invoices
POST /api/v1/plans/invoices/:invoiceId/checkout          (tao link payOS)
POST /api/v1/plans/invoices/:invoiceId/verify-payment    (hoi payOS trang thai don)
POST /api/v1/plans/payments/ipn                          (webhook payOS, khong dang nhap)
```

Checkout response:

```json
{ "success": true, "data": { "gateway": "PAYOS", "checkoutUrl": "https://pay.payos.vn/web/...", "method": "GET", "orderCode": 1730700000000123, "paymentLinkId": "...", "qrCode": "..." } }
```

- FE chuyen trinh duyet toi `checkoutUrl`; payOS tra ve `PAYOS_RETURN_URL?payment=success|cancel&invoice=<ma>` -> FE goi `verify-payment`.
- Webhook xac thuc `signature` (HMAC-SHA256 hex bang `PAYOS_CHECKSUM_KEY`, key cua `data` sap xep a-z, dang `key=value&...`). Sai -> `401 WEBHOOK_UNAUTHORIZED`. Don la -> 200 `{ ignored: true }`.
- Truoc khi tao link moi phai hoi payOS cac don cu: da tra -> `409 PLATFORM_INVOICE_ALREADY_PAID`. Tra trung / sai so tien -> `UNAPPLIED` cho admin hoan tien.
- Chua cau hinh khoa -> `503 PAYMENT_GATEWAY_NOT_CONFIGURED`; payOS loi -> `502 PAYMENT_GATEWAY_UNAVAILABLE`.

### 4.13 SaaS Admin

```http
GET    /api/v1/admin/plans          POST /api/v1/admin/plans
PUT    /api/v1/admin/plans/:planId  DELETE /api/v1/admin/plans/:planId
GET    /api/v1/admin/landlords?search=&status=
PUT    /api/v1/admin/landlords/:landlordId/status          ({ status: ACTIVE | SUSPENDED, reason })
GET    /api/v1/admin/subscriptions  POST /api/v1/admin/subscriptions
PUT    /api/v1/admin/subscriptions/:subscriptionId
GET    /api/v1/admin/invoices       POST /api/v1/admin/invoices/:invoiceId/paid
GET    /api/v1/admin/upgrade-requests
POST   /api/v1/admin/upgrade-requests/:requestId/approve
POST   /api/v1/admin/upgrade-requests/:requestId/reject
GET    /api/v1/admin/analytics
GET    /api/v1/admin/audit-logs
GET    /api/v1/users   GET /api/v1/users/:id
```

Chi role `SUPER_ADMIN`. `GET /admin/landlords` tra them moi chu tro `banking { source: "BANK_HUB" | "MANUAL" | null, linkedAt, autoReconcile, pendingUnmatched, lastTransferAt }` va `bankingSummary { linked, manual, none }`; admin chi xem, khong cau hinh STK / khoa API thay chu tro.

Quota error:

```json
{ "success": false, "errorCode": "QUOTA_EXCEEDED", "message": "Vui long nang cap goi SaaS de them tai nguyen" }
```

## 5. Response va error code

Thanh cong:

```json
{ "success": true, "data": {}, "message": "" }
```

Loi:

```json
{ "success": false, "errorCode": "INVOICE_ALREADY_PAID", "message": "Hoa don da duoc thanh toan day du", "data": null }
```

Quy tac hien thi loi:

- `message` la cau nghiep vu tieng Viet; dung nhan trang thai (`BE/utils/statusLabels.js`) va nhan truong (`FIELD_LABELS` trong `BE/utils/financeValidation.js`), khong lo ma.
- Loi dich vu ngoai (payOS, SePay Bank Hub, TypeSafe) va loi validation mac dinh cua Mongoose: chi tiet ghi log server, nguoi dung nhan cau chung.
- FE: interceptor axios gan `error.message = friendlyErrorMessage(error)`; khong bao gio hien `errorCode` hay "Request failed with status code ...".

Error code chuan:

```text
AUTH_REQUIRED                  FORBIDDEN                       RESOURCE_NOT_FOUND
INVALID_ID                     VALIDATION_ERROR                QUOTA_EXCEEDED
BRANCH_SCOPE_FORBIDDEN         PASSWORD_CHANGE_REQUIRED        TENANT_INACTIVE
BANK_NOT_CONFIGURED            INVOICE_ALREADY_PAID            INVOICE_CANCELLED
INVOICE_NOT_DRAFT              INVOICE_CANNOT_CANCEL           PAYMENT_AMOUNT_INVALID
PAYMENT_REFERENCE_DUPLICATED   CASH_REPORT_NOT_FOUND           READING_LOWER_THAN_PREVIOUS
READING_ALREADY_BILLED         CONTRACT_NOT_ACTIVE             CONTRACT_NOT_SIGNED
CONTRACT_NOT_DRAFT             CONTRACT_SETTLEMENT_PREPARED    DEPOSIT_ALREADY_RECEIVED
DEPOSIT_NOT_REQUIRED           INCIDENT_INVALID_TRANSITION     INCIDENT_QUOTE_REQUIRED
INCIDENT_QUOTE_NOT_ACCEPTED    INCIDENT_PAYER_LOCKED           INCIDENT_TENANT_ACCEPTANCE_REQUIRED
INCIDENT_NOT_AWAITING_TENANT   INCIDENT_NOT_STARTED            EXPENSE_ALREADY_VOID
PLATFORM_INVOICE_ALREADY_PAID  PLATFORM_INVOICE_NOT_PAYABLE    PAYMENT_GATEWAY_NOT_CONFIGURED
PAYMENT_GATEWAY_UNAVAILABLE    WEBHOOK_UNAUTHORIZED            WEBHOOK_NOT_CONFIGURED
SIMULATION_IN_PROGRESS         SIMULATION_WOULD_NOT_MATCH      SEARCH_QUERY_INVALID
INVOICE_NOT_OWING              TENANT_EMAIL_MISSING            REMINDER_RECENTLY_SENT
EMAIL_NOT_CONFIGURED           EMAIL_UNAVAILABLE               INVALID_AUTO_EMAIL
```

## 6. Realtime contract

Socket rooms:

```text
user:<userId>        moi tai khoan (thong bao rieng cua nguoi do)
landlord:<landlordId>
branch:<branchId>    quan ly duoc giao co so
scope:<landlordId>   ca chuoi (chu tro, quan ly, khach thue) - chi nhan "data:changed"
invoice:<invoiceId>  trang hoa don dang mo
admins / landlords
```

Su kien:

- `data:changed` `{ resources: ["contracts", "payments", ...], at }`: chi neu ten nhom du lieu, khong co ban ghi / so tien. FE dung `useLiveRefresh([...], refresh)`.
- `activity` `{ id, at, actor, action, message, details, room, branch, code, link }`: chi gui ben lien quan theo nhom trong `BE/realtime/audience.js`:
  - `OWNER` - chi chu tro (tao co so, them nhan vien, huy phieu chi).
  - `STAFF` - chu tro + quan ly cua dung co so (viec noi bo: phong, dien nuoc, hoa don nhap, chi phi, phan loai, phieu thu cho duyet, phieu chi).
  - `TENANT` - STAFF + dung nguoi thue dung ten (hop dong, hoa don da phat hanh, tien da nhan, su co / bao gia / nghiem thu).
  - `ADMIN` - quan tri + chu tro lien quan (goi, hoa don SaaS, trang thai tai khoan).
- Su kien cu giu nguyen: `invoice_paid`, `payment:success`, `incident:*`, `contract:deposit_received`.

Payload `payment:success`:

```json
{ "invoiceId": "invoice_id", "paymentId": "payment_id", "paidAmount": 3850000, "remainingAmount": 0, "status": "PAID" }
```

Khong emit event truoc khi MongoDB transaction commit.

## 7. Thu tu lam viec va phu thuoc

```text
DEV 1: Auth + scope + model + nhom trang thai hop dong + API convention
        |
        +--> DEV 2: Utility, Incident (bao gia / nghiem thu), Expense, Staff
        +--> DEV 3: Invoice, Payment, Cash collection, Bank Hub, so thanh toan
        +--> DEV 4: Admin, Dashboard, payOS, Notification theo contract

DEV 1 Contract (DRAFT / LIVE) --> DEV 3 Invoice generation, DEV 2 Utility reading
DEV 3 Invoice schema (INCIDENT) --> DEV 2 hoa don su co
DEV 3 depositPayment --> DEV 1 xac nhan coc
DEV 3 Payment API --> DEV 4 Realtime va Dashboard live update
DEV 4 audience.js --> moi dev khai bao nguoi nhan cho hanh dong moi
DEV 1 Plan/quota interface + DEV 4 SaaS Plan --> Quota integration
```

Moi dev duoc dung mock/fixture khi dependency chua merge.

## 8. Checklist truoc khi merge

- [ ] API dung `/api/v1`.
- [ ] Co landlord scope va branch scope.
- [ ] Co `isDeleted: false` trong query thong thuong.
- [ ] Tien la integer VND.
- [ ] Khong de logic nghiep vu trong controller.
- [ ] Co `errorCode` + `message` nghiep vu tieng Viet, khong lo ma / ten truong.
- [ ] Hanh dong ghi moi da co nhan trong `realtime/activity.js` + nhom nguoi nhan.
- [ ] Payment cash co receipt, reportedBy / confirmedBy va audit.
- [ ] Invoice update va Payment creation co transaction.
- [ ] Frontend co loading, error va empty state.
- [ ] Chay `npm run lint` o BE va FE, `npm run build` o FE; BE load duoc (`node -e "require('./app')"`).

## 9. Branch de nghi

```text
feature/dev1-property-core
feature/dev2-operations
feature/dev3-finance
feature/dev4-platform-dashboard
```
