# Phan cong task va API contract

## 1. Muc tieu

Tai lieu nay chot pham vi lam viec cua 4 developer va API contract chung cho cac giai doan Branch, Room, Contract, Utility Reading, Invoice, Payment, Dashboard, Incident va SaaS Admin.

Tat ca API moi dung prefix:

```text
/api/v1
```

Backend dung role `SUPER_ADMIN`. Chu "ADMIN" tren giao dien chi la nhan hien thi.

## 2. Quy tac lam viec chung

- Moi developer lam tren mot branch rieng.
- Khong doi ten field hoac endpoint da chot neu khong co approval cua ca nhom.
- Moi tai nguyen tenant-level phai co `landlordId`.
- Moi truy van phai kiem tra `isDeleted: false`, landlord scope va branch scope.
- Tien luu bang so nguyen VND, khong dung so thuc.
- Khong xoa cung invoice/payment da phat sinh giao dich.
- Controller mong; logic nghiep vu nam trong `services/`.
- API thanh cong dung `success: true`; API loi dung `success: false` va `errorCode`.

## 3. Phan cong 4 developer

### DEV 1 - Property Core

**Phu trach:** Giai doan 1, Giai doan 2 va nen tang dung chung.

```text
BE/controllers/branchController.js
BE/routes/branchRoutes.js
BE/controllers/roomController.js
BE/routes/roomRoutes.js
BE/controllers/contractController.js
BE/routes/contractRoutes.js
BE/models/Branch.js
BE/models/Room.js
BE/models/Contract.js
FE/src/features/branches/
FE/src/features/rooms/
FE/src/features/contracts/
```

**Them vao ownership:**

- Authentication middleware.
- `getTenantScope()` va `getBranchScope()`.
- Authorization theo role.
- Error classes va response format.
- Quota guard cho branch, room va manager.
- Audit helper dung chung.

**Ban giao:** auth contract, scope helper, model branch/room/contract va quota interface.

### DEV 2 - Operations

**Phu trach:** Giai doan 3 va Giai doan 7.

```text
BE/controllers/utilityReadingController.js
BE/routes/utilityReadingRoutes.js
BE/services/utilityReadingService.js
BE/controllers/incidentController.js
BE/routes/incidentRoutes.js
BE/controllers/staffController.js
BE/routes/staffRoutes.js
FE/src/features/utility-readings/
FE/src/features/incidents/
FE/src/features/staff/
```

**Quy tac:** dung auth/scope va quota do Dev 1 ban giao; khong tao scope rieng.

### DEV 3 - Finance

**Phu trach:** Giai doan 4, Giai doan 5.1, thu tien mat va Dashboard API.

```text
BE/services/invoiceService.js
BE/controllers/invoiceController.js
BE/routes/invoiceRoutes.js
BE/services/paymentService.js
BE/controllers/paymentController.js
BE/routes/paymentRoutes.js
BE/services/auditService.js
FE/src/features/invoices/
FE/src/features/payments/
FE/src/features/public-invoice/
```

**Nghiep vu bat buoc:** invoice calculation, VietQR, public invoice, webhook, idempotency, partial payment, overpayment, cash payment va audit transaction.

### DEV 4 - Platform, Dashboard va Realtime

**Phu trach:** Giai doan 5.2, Giai doan 6 frontend va Giai doan 8.

```text
BE/controllers/dashboardController.js
BE/routes/dashboardRoutes.js
BE/controllers/saasPlanController.js
BE/routes/saasPlanRoutes.js
BE/controllers/adminController.js
BE/routes/adminRoutes.js
BE/services/analyticsService.js
FE/src/features/dashboard/
FE/src/features/admin/
BE/realtime/
```

**Nghiep vu:** Socket.io, dashboard landlord, SaaS plan, landlord directory, subscription, MRR va admin analytics.

## 4. API contract chung

### 4.1 Authentication

```http
POST /api/v1/auth/login
GET  /api/v1/auth/me
```

Request login:

```json
{
  "email": "manager@example.com",
  "password": "password123"
}
```

Response:

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
      "assignedBranches": ["branch_id"]
    }
  }
}
```

Request co header:

```http
Authorization: Bearer <token>
```

### 4.2 Branch

```http
GET    /api/v1/branches
POST   /api/v1/branches
GET    /api/v1/branches/:branchId
PUT    /api/v1/branches/:branchId
DELETE /api/v1/branches/:branchId
```

POST body:

```json
{
  "name": "Co so Cau Giay",
  "totalFloors": 4,
  "address": {
    "fullAddress": "Ha Noi"
  },
  "defaultElectricityPrice": 3500,
  "waterBillingType": "METER",
  "defaultWaterPrice": 30000,
  "defaultServices": [
    {
      "name": "Wifi",
      "price": 100000,
      "billingType": "PER_ROOM"
    }
  ],
  "billingCycleDay": 1,
  "paymentDueDays": 5
}
```

### 4.3 Room

```http
GET  /api/v1/branches/:branchId/rooms?status=EMPTY
POST /api/v1/branches/:branchId/rooms
POST /api/v1/branches/:branchId/rooms/bulk
GET  /api/v1/rooms/:roomId
PUT  /api/v1/rooms/:roomId
DELETE /api/v1/rooms/:roomId
```

POST bulk body:

```json
{
  "fromFloor": 1,
  "toFloor": 4,
  "fromRoomNumber": 101,
  "toRoomNumber": 105,
  "prefix": "P."
}
```

### 4.4 Contract va Tenant

```http
GET  /api/v1/contracts?status=ACTIVE&branchId=<id>
POST /api/v1/contracts
GET  /api/v1/contracts/:contractId
POST /api/v1/contracts/:contractId/terminate
```

POST body:

```json
{
  "branchId": "branch_id",
  "roomId": "room_id",
  "tenant": {
    "name": "Nguyen Van A",
    "email": "tenant@example.com",
    "phoneNumber": "0912345678",
    "citizenId": "001234567890"
  },
  "startDate": "2026-10-01",
  "endDate": "2027-10-01",
  "rentalPrice": 3500000,
  "depositAmount": 3500000,
  "initialElectricIndex": 100,
  "initialWaterIndex": 20,
  "roommates": []
}
```

Contract creation must atomically create/link tenant, update room to `RENTED` and create contract.

### 4.5 Utility Reading

```http
GET  /api/v1/branches/:branchId/utility-readings?billingPeriod=2026-10
POST /api/v1/utility-readings
PUT  /api/v1/utility-readings/:readingId
```

POST body:

```json
{
  "branchId": "branch_id",
  "roomId": "room_id",
  "billingPeriod": "2026-10",
  "electricNewIndex": 145,
  "waterNewIndex": 24,
  "electricImage": "https://...",
  "waterImage": "https://..."
}
```

Rules:

- New index must be greater than or equal to old index.
- Reading already billed cannot be edited.
- Increase above 2.5 times average must return a warning requiring confirmation.

### 4.6 Invoice

```http
GET  /api/v1/invoices?status=UNPAID&branchId=<id>&billingPeriod=2026-10
POST /api/v1/invoices/generate
GET  /api/v1/invoices/:invoiceId
POST /api/v1/invoices/:invoiceId/issue
GET  /api/v1/invoices/public/:publicAccessToken
```

Generate body:

```json
{
  "branchId": "branch_id",
  "billingPeriod": "2026-10",
  "dueDate": "2026-10-05",
  "roomIds": ["room_id_1", "room_id_2"]
}
```

Invoice response phai co:

```json
{
  "id": "invoice_id",
  "invoiceCode": "HD2026100001",
  "billingPeriod": "2026-10",
  "tenantId": "tenant_id",
  "branchId": "branch_id",
  "roomId": "room_id",
  "totalAmount": 3850000,
  "paidAmount": 0,
  "remainingAmount": 3850000,
  "overpaidAmount": 0,
  "status": "ISSUED",
  "dueDate": "2026-10-05",
  "vietQrUrl": "https://img.vietqr.io/image/...",
  "paymentSyntax": "HD2026100001 P101"
}
```

### 4.7 Payment va thu tien mat

```http
POST /api/v1/payments/webhook
POST /api/v1/payments/cash
GET  /api/v1/payments?paymentMethod=CASH&branchId=<id>
GET  /api/v1/payments/:paymentId
GET  /api/v1/invoices/:invoiceId/payments
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

Payment cash response:

```json
{
  "success": true,
  "message": "Da xac nhan thu tien mat",
  "data": {
    "payment": {
      "id": "payment_id",
      "invoiceId": "invoice_id",
      "amount": 3850000,
      "paymentMethod": "CASH",
      "referenceCode": "CASH-20260930-0001",
      "status": "SUCCESS",
      "confirmedBy": "user_id"
    },
    "invoice": {
      "id": "invoice_id",
      "paidAmount": 3850000,
      "remainingAmount": 0,
      "overpaidAmount": 0,
      "status": "PAID"
    }
  }
}
```

Payment rules:

- `referenceCode`/`receiptNumber` unique va immutable.
- Khong thu invoice `CANCELLED`.
- Khong cho thu tiep invoice `PAID` trong MVP.
- Tao Payment, update Invoice va AuditLog trong cung transaction.
- Webhook trung reference phai tra HTTP 200 va khong tao giao dich thu hai.
- Cash payment bat buoc ghi `confirmedBy` va audit action `CONFIRM_CASH_PAYMENT`.

### 4.8 Dashboard landlord

```http
GET /api/v1/dashboard/stats?branchId=<id>&billingPeriod=2026-10
GET /api/v1/dashboard/debts?branchId=<id>
```

Response:

```json
{
  "success": true,
  "data": {
    "collection": {
      "expectedAmount": 10000000,
      "collectedAmount": 7500000,
      "collectionRate": 75
    },
    "debts": {
      "roomCount": 2,
      "totalAmount": 2500000,
      "items": []
    },
    "occupancy": {
      "totalRooms": 20,
      "rentedRooms": 16,
      "rate": 80
    }
  }
}
```

`PROPERTY_MANAGER` khong duoc goi dashboard doanh thu tong cua landlord.

### 4.9 Incident va Staff

```http
GET  /api/v1/incidents?branchId=<id>&status=PENDING
POST /api/v1/incidents
PUT  /api/v1/incidents/:incidentId/status
PUT  /api/v1/incidents/:incidentId/cost

GET  /api/v1/staff
POST /api/v1/staff
PUT  /api/v1/staff/:staffId
PUT  /api/v1/staff/:staffId/branches
```

Incident status:

```text
PENDING -> IN_PROGRESS -> SOLVED -> CLOSED
```

### 4.10 SaaS Admin

```http
GET    /api/v1/admin/plans
POST   /api/v1/admin/plans
PUT    /api/v1/admin/plans/:planId
DELETE /api/v1/admin/plans/:planId

GET /api/v1/admin/landlords
PUT /api/v1/admin/landlords/:landlordId/status
GET /api/v1/admin/subscriptions
PUT /api/v1/admin/subscriptions/:subscriptionId
GET /api/v1/admin/analytics
```

Chi role `SUPER_ADMIN` moi duoc goi cac API nay.

Quota error:

```json
{
  "success": false,
  "errorCode": "QUOTA_EXCEEDED",
  "message": "Vui long nang cap goi SaaS de them tai nguyen"
}
```

## 5. Response va error code

Thanh cong:

```json
{
  "success": true,
  "data": {},
  "message": ""
}
```

Loi:

```json
{
  "success": false,
  "errorCode": "INVOICE_ALREADY_PAID",
  "message": "Hoa don da duoc thanh toan day du"
}
```

Error code chuan:

```text
AUTH_REQUIRED
FORBIDDEN
RESOURCE_NOT_FOUND
INVALID_ID
VALIDATION_ERROR
QUOTA_EXCEEDED
BRANCH_SCOPE_FORBIDDEN
INVOICE_ALREADY_PAID
INVOICE_CANCELLED
PAYMENT_AMOUNT_INVALID
PAYMENT_REFERENCE_DUPLICATED
READING_LOWER_THAN_PREVIOUS
READING_ALREADY_BILLED
```

## 6. Realtime contract

Socket rooms:

```text
landlord:<landlordId>
branch:<branchId>
invoice:<invoiceId>
```

Event sau khi transaction thanh cong:

```text
invoice_paid
payment:success
```

Payload:

```json
{
  "invoiceId": "invoice_id",
  "paymentId": "payment_id",
  "paidAmount": 3850000,
  "remainingAmount": 0,
  "status": "PAID"
}
```

Khong emit event truoc khi MongoDB transaction commit.

## 7. Thu tu lam viec va phu thuoc

```text
DEV 1: Auth + scope + model + API convention
        |
        +--> DEV 2: Utility, Incident, Staff
        +--> DEV 3: Invoice, Payment, Cash collection
        +--> DEV 4: Admin va Dashboard theo contract

DEV 3 Payment API --> DEV 4 Realtime va Dashboard live update
DEV 1 Room/Contract --> DEV 3 Invoice generation
DEV 1 Plan/quota interface + DEV 4 SaaS Plan --> Quota integration
```

Mỗi dev được dùng mock/fixture khi dependency chưa merge.

## 8. Checklist truoc khi merge

- [ ] API dung `/api/v1`.
- [ ] Co landlord scope va branch scope.
- [ ] Co `isDeleted: false` trong query thong thuong.
- [ ] Tien la integer VND.
- [ ] Khong de logic nghiep vu trong controller.
- [ ] Co unit test cho service moi.
- [ ] Co error code thay vi message tuy y.
- [ ] Payment cash co receipt, confirmedBy va audit.
- [ ] Invoice update va Payment creation co transaction.
- [ ] Frontend co loading, error va empty state.
- [ ] Chay `npm run lint` va `npm run build` o FE.
- [ ] Chay integration test backend truoc khi merge.

## 9. Branch de nghi

```text
feature/dev1-property-core
feature/dev2-operations
feature/dev3-finance
feature/dev4-platform-dashboard
```
