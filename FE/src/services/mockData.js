/**
 * DOMUS ERP - Demo Mock Data & Offline In-Memory Store
 * Used when backend Auth is not yet configured or delivered by the auth module dev.
 * Provides 100% interactive fidelity for Invoice, Payment, Cash, and Public Invoice.
 */

export const mockBranches = [
  {
    _id: "branch-caugiay",
    name: "Tòa Nhà Trọ Xanh Cầu Giấy",
    address: {
      street: "Số 18 Ngõ 233 Xuân Thủy",
      district: "Cầu Giấy",
      city: "Hà Nội",
      fullAddress: "Số 18 Ngõ 233 Xuân Thủy, Dịch Vọng Hậu, Cầu Giấy, Hà Nội",
    },
    totalRooms: 12,
  },
  {
    _id: "branch-hadong",
    name: "Cơ sở 2 - Ký túc xá Hà Đông",
    address: {
      street: "Số 45 Trần Phú",
      district: "Hà Đông",
      city: "Hà Nội",
      fullAddress: "Số 45 Trần Phú, Mộ Lao, Hà Đông, Hà Nội",
    },
    totalRooms: 20,
  },
];

let inMemoryInvoices = [
  {
    _id: "inv-1001",
    invoiceCode: "HD1001",
    billingPeriod: "2026-09",
    month: 9,
    year: 2026,
    branchId: "branch-caugiay",
    roomId: {
      _id: "room-101",
      roomNumber: "P.101",
      name: "Phòng 101 (Tầng 1)",
    },
    tenantId: {
      _id: "tenant-101",
      name: "Nguyễn Văn Thuê",
      phoneNumber: "0912111111",
      email: "tenant1@wdp301.com",
    },
    dueDate: "2026-09-05",
    roomAmount: 3500000,
    electricDetail: {
      oldIndex: 120,
      newIndex: 195,
      consumed: 75,
      unitPrice: 3800,
      amount: 285000,
    },
    waterDetail: {
      billingType: "METER",
      oldIndex: 45,
      newIndex: 52,
      consumed: 7,
      unitPrice: 30000,
      amount: 210000,
    },
    servicesDetail: [
      { serviceName: "Rác & Vệ sinh", unitPrice: 30000, quantity: 1, amount: 30000 },
      { serviceName: "Internet Cáp quang", unitPrice: 50000, quantity: 1, amount: 50000 },
    ],
    totalAmount: 4075000,
    paidAmount: 4075000,
    remainingAmount: 0,
    vietQrUrl:
      "https://img.vietqr.io/image/MB-0988888888-compact2.png?amount=4075000&addInfo=HD1001%20P101&accountName=TRAN%20VAN%20CHU%20TRO",
    paymentSyntax: "HD1001 P101",
    publicAccessToken: "tok-pub-1001-demo-access",
    status: "PAID",
    createdAt: "2026-09-01T08:00:00.000Z",
  },
  {
    _id: "inv-1002",
    invoiceCode: "HD1002",
    billingPeriod: "2026-09",
    month: 9,
    year: 2026,
    branchId: "branch-caugiay",
    roomId: {
      _id: "room-102",
      roomNumber: "P.102",
      name: "Phòng 102 (Tầng 1)",
    },
    tenantId: {
      _id: "tenant-102",
      name: "Hoàng Thị Mai",
      phoneNumber: "0912222222",
      email: "tenant2@wdp301.com",
    },
    dueDate: "2026-09-10",
    roomAmount: 3200000,
    electricDetail: {
      oldIndex: 85,
      newIndex: 140,
      consumed: 55,
      unitPrice: 3800,
      amount: 209000,
    },
    waterDetail: {
      billingType: "METER",
      oldIndex: 30,
      newIndex: 35,
      consumed: 5,
      unitPrice: 30000,
      amount: 150000,
    },
    servicesDetail: [
      { serviceName: "Rác & Vệ sinh", unitPrice: 30000, quantity: 1, amount: 30000 },
      { serviceName: "Internet Cáp quang", unitPrice: 50000, quantity: 1, amount: 50000 },
    ],
    totalAmount: 3639000,
    paidAmount: 0,
    remainingAmount: 3639000,
    vietQrUrl:
      "https://img.vietqr.io/image/MB-0988888888-compact2.png?amount=3639000&addInfo=HD1002%20P102&accountName=TRAN%20VAN%20CHU%20TRO",
    paymentSyntax: "HD1002 P102",
    publicAccessToken: "tok-pub-1002-demo-access",
    status: "ISSUED",
    createdAt: "2026-09-01T08:00:00.000Z",
  },
  {
    _id: "inv-1003",
    invoiceCode: "HD1003",
    billingPeriod: "2026-09",
    month: 9,
    year: 2026,
    branchId: "branch-caugiay",
    roomId: {
      _id: "room-201",
      roomNumber: "P.201",
      name: "Phòng 201 (Tầng 2 Ban Công)",
    },
    tenantId: {
      _id: "tenant-201",
      name: "Phạm Quốc Bảo",
      phoneNumber: "0912333333",
      email: "tenant3@wdp301.com",
    },
    dueDate: "2026-09-03", // Overdue
    roomAmount: 4200000,
    electricDetail: {
      oldIndex: 210,
      newIndex: 305,
      consumed: 95,
      unitPrice: 3800,
      amount: 361000,
    },
    waterDetail: {
      billingType: "METER",
      oldIndex: 60,
      newIndex: 68,
      consumed: 8,
      unitPrice: 30000,
      amount: 240000,
    },
    servicesDetail: [
      { serviceName: "Rác & Vệ sinh", unitPrice: 30000, quantity: 1, amount: 30000 },
      { serviceName: "Internet Cáp quang", unitPrice: 50000, quantity: 1, amount: 50000 },
      { serviceName: "Gửi xe máy", unitPrice: 100000, quantity: 2, amount: 200000 },
    ],
    totalAmount: 5051000,
    paidAmount: 2000000,
    remainingAmount: 3051000,
    vietQrUrl:
      "https://img.vietqr.io/image/MB-0988888888-compact2.png?amount=3051000&addInfo=HD1003%20P201&accountName=TRAN%20VAN%20CHU%20TRO",
    paymentSyntax: "HD1003 P201",
    publicAccessToken: "tok-pub-1003-demo-access",
    status: "PARTIALLY_PAID",
    createdAt: "2026-09-01T08:00:00.000Z",
  },
  {
    _id: "inv-1004",
    invoiceCode: "HD1004",
    billingPeriod: "2026-10",
    month: 10,
    year: 2026,
    branchId: "branch-caugiay",
    roomId: {
      _id: "room-202",
      roomNumber: "P.202",
      name: "Phòng 202 (Tầng 2)",
    },
    tenantId: {
      _id: "tenant-202",
      name: "Vũ Đình Trọng",
      phoneNumber: "0912444444",
      email: "tenant4@wdp301.com",
    },
    dueDate: "2026-10-15",
    roomAmount: 3800000,
    electricDetail: {
      oldIndex: 100,
      newIndex: 160,
      consumed: 60,
      unitPrice: 3800,
      amount: 228000,
    },
    waterDetail: {
      billingType: "METER",
      oldIndex: 25,
      newIndex: 30,
      consumed: 5,
      unitPrice: 30000,
      amount: 150000,
    },
    servicesDetail: [
      { serviceName: "Rác & Vệ sinh", unitPrice: 30000, quantity: 1, amount: 30000 },
      { serviceName: "Internet Cáp quang", unitPrice: 50000, quantity: 1, amount: 50000 },
    ],
    totalAmount: 4208000,
    paidAmount: 0,
    remainingAmount: 4208000,
    vietQrUrl:
      "https://img.vietqr.io/image/MB-0988888888-compact2.png?amount=4208000&addInfo=HD1004%20P202&accountName=TRAN%20VAN%20CHU%20TRO",
    paymentSyntax: "HD1004 P202",
    publicAccessToken: "tok-pub-1004-demo-access",
    status: "DRAFT",
    createdAt: "2026-10-01T08:00:00.000Z",
  },
  {
    _id: "inv-1005",
    invoiceCode: "HD1005",
    billingPeriod: "2026-08",
    month: 8,
    year: 2026,
    branchId: "branch-caugiay",
    roomId: {
      _id: "room-103",
      roomNumber: "P.103",
      name: "Phòng 103 (Tầng 1)",
    },
    tenantId: {
      _id: "tenant-103",
      name: "Lê Minh Tuấn",
      phoneNumber: "0912555555",
      email: "tenant5@wdp301.com",
    },
    dueDate: "2026-08-05",
    roomAmount: 3500000,
    electricDetail: { oldIndex: 50, newIndex: 50, consumed: 0, unitPrice: 3800, amount: 0 },
    waterDetail: {
      billingType: "METER",
      oldIndex: 20,
      newIndex: 20,
      consumed: 0,
      unitPrice: 30000,
      amount: 0,
    },
    servicesDetail: [],
    totalAmount: 3500000,
    paidAmount: 0,
    remainingAmount: 3500000,
    cancellationReason:
      "Khách trả phòng đột xuất cuối tháng 8 theo thỏa thuận thanh lý hợp đồng",
    status: "CANCELLED",
    createdAt: "2026-08-01T08:00:00.000Z",
  },
];

let inMemoryPayments = [
  {
    _id: "pay-001",
    invoiceId: {
      _id: "inv-1001",
      invoiceCode: "HD1001",
    },
    tenantId: {
      _id: "tenant-101",
      name: "Nguyễn Văn Thuê (P.101)",
    },
    amount: 4075000,
    paymentMethod: "SEPAY_AUTO",
    paymentDate: "2026-09-02T14:32:00.000Z",
    status: "SUCCESS",
    receiptCode: "SEPAY-20260902-8821",
    notes: "Khớp tự động qua SePay Webhook - Nội dung: HD1001 P101",
  },
  {
    _id: "pay-002",
    invoiceId: {
      _id: "inv-1003",
      invoiceCode: "HD1003",
    },
    tenantId: {
      _id: "tenant-201",
      name: "Phạm Quốc Bảo (P.201)",
    },
    amount: 2000000,
    paymentMethod: "CASH",
    paymentDate: "2026-09-04T10:15:00.000Z",
    status: "SUCCESS",
    receiptCode: "CASH-20260904-0012",
    receiptNumber: "CASH-20260904-0012",
    notes: "Thu tiền mặt đợt 1 tại phòng quản lý",
  },
];

let inMemoryUnmatched = [
  {
    _id: "unmatched-001",
    sePayTransactionId: "sepay_tx_998124",
    gateway: "MBBank",
    accountNumber: "0988888888",
    amountIn: 3639000,
    transactionDate: "2026-09-03T11:20:00.000Z",
    transactionContent: "Chuyen khoan tien phong thang 9 - Mai",
    reason: "SYNTAX_NOT_MATCHED",
    status: "PENDING_REVIEW",
  },
  {
    _id: "unmatched-002",
    sePayTransactionId: "sepay_tx_998125",
    gateway: "MBBank",
    accountNumber: "0988888888",
    amountIn: 500000,
    transactionDate: "2026-09-04T16:45:00.000Z",
    transactionContent: "Tien dat coc giu phong",
    reason: "NO_INVOICE_FOUND",
    status: "PENDING_REVIEW",
  },
];

export const mockStore = {
  getBranches: () => [...mockBranches],

  getInvoices: (params = {}) => {
    let result = [...inMemoryInvoices];
    if (params.status && params.status !== "ALL") {
      result = result.filter((inv) => {
        if (params.status === "UNPAID") {
          return inv.status === "ISSUED" || inv.status === "PARTIALLY_PAID";
        }
        return inv.status === params.status;
      });
    }
    if (params.billingPeriod) {
      result = result.filter((inv) => inv.billingPeriod === params.billingPeriod);
    }
    return {
      data: result,
      pagination: {
        page: params.page || 1,
        limit: params.limit || 20,
        total: result.length,
        totalPages: 1,
      },
    };
  },

  getInvoiceById: (id) => {
    return inMemoryInvoices.find((i) => i._id === id || i.invoiceCode === id) || null;
  },

  getPublicInvoice: (token) => {
    const found = inMemoryInvoices.find(
      (i) => i.publicAccessToken === token || i.invoiceCode === token || token === "demo"
    );
    if (found) return found;
    // Default demo invoice if token is new or arbitrary
    return inMemoryInvoices[1];
  },

  generateInvoices: ({ billingPeriod, dueDate, branchId }) => {
    const newInv = {
      _id: `inv-${Date.now()}`,
      invoiceCode: `HD${Math.floor(1000 + Math.random() * 9000)}`,
      billingPeriod: billingPeriod || "2026-10",
      month: parseInt((billingPeriod || "2026-10").split("-")[1], 10),
      year: parseInt((billingPeriod || "2026-10").split("-")[0], 10),
      branchId: branchId || "branch-caugiay",
      roomId: {
        _id: `room-${Date.now()}`,
        roomNumber: "P.301",
        name: "Phòng 301 (Tầng 3)",
      },
      tenantId: {
        _id: `tenant-${Date.now()}`,
        name: "Đỗ Hải Nam",
        phoneNumber: "0934567890",
        email: "nam.do@wdp301.com",
      },
      dueDate: dueDate || "2026-10-10",
      roomAmount: 3600000,
      electricDetail: { oldIndex: 120, newIndex: 180, consumed: 60, unitPrice: 3800, amount: 228000 },
      waterDetail: { billingType: "METER", oldIndex: 40, newIndex: 45, consumed: 5, unitPrice: 30000, amount: 150000 },
      servicesDetail: [
        { serviceName: "Rác & Vệ sinh", unitPrice: 30000, quantity: 1, amount: 30000 },
        { serviceName: "Internet Cáp quang", unitPrice: 50000, quantity: 1, amount: 50000 },
      ],
      totalAmount: 4058000,
      paidAmount: 0,
      remainingAmount: 4058000,
      vietQrUrl: `https://img.vietqr.io/image/MB-0988888888-compact2.png?amount=4058000&addInfo=HD301&accountName=TRAN%20VAN%20CHU%20TRO`,
      paymentSyntax: `HD301 P301`,
      publicAccessToken: `tok-pub-${Date.now()}`,
      status: "ISSUED",
      createdAt: new Date().toISOString(),
    };

    inMemoryInvoices = [newInv, ...inMemoryInvoices];
    return {
      message: `Đã sinh thành công hóa đơn chu kỳ ${billingPeriod}!`,
      createdCount: 1,
      invoices: [newInv],
    };
  },

  issueInvoice: (invoiceId) => {
    inMemoryInvoices = inMemoryInvoices.map((inv) =>
      inv._id === invoiceId ? { ...inv, status: "ISSUED" } : inv
    );
    return { message: "Phát hành hóa đơn thành công" };
  },

  cancelInvoice: (invoiceId, reason) => {
    inMemoryInvoices = inMemoryInvoices.map((inv) =>
      inv._id === invoiceId
        ? { ...inv, status: "CANCELLED", cancellationReason: reason }
        : inv
    );
    return { message: "Đã hủy hóa đơn thành công" };
  },

  recordCashPayment: ({ invoiceId, amount, notes }) => {
    const inv = inMemoryInvoices.find((i) => i._id === invoiceId);
    const numAmount = Number(amount);
    const newPaid = (inv?.paidAmount || 0) + numAmount;
    const remaining = Math.max(0, (inv?.totalAmount || 0) - newPaid);
    const newStatus = remaining === 0 ? "PAID" : "PARTIALLY_PAID";

    if (inv) {
      inv.paidAmount = newPaid;
      inv.remainingAmount = remaining;
      inv.status = newStatus;
    }

    const receiptNumber = `CASH-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newPayment = {
      _id: `pay-${Date.now()}`,
      invoiceId: inv ? { _id: inv._id, invoiceCode: inv.invoiceCode } : invoiceId,
      tenantId: inv?.tenantId || { name: "Khách thuê tiền mặt" },
      amount: numAmount,
      paymentMethod: "CASH",
      paymentDate: new Date().toISOString(),
      status: "SUCCESS",
      receiptCode: receiptNumber,
      receiptNumber,
      notes: notes || "Thu tiền mặt trực tiếp",
    };

    inMemoryPayments = [newPayment, ...inMemoryPayments];

    return {
      message: "Ghi nhận thu tiền mặt thành công",
      data: {
        payment: newPayment,
        invoice: inv,
        receiptNumber,
      },
    };
  },

  getPayments: (params = {}) => {
    let result = [...inMemoryPayments];
    if (params.paymentMethod && params.paymentMethod !== "ALL") {
      result = result.filter((p) => p.paymentMethod === params.paymentMethod);
    }
    return { data: result };
  },

  listUnmatched: (params = {}) => {
    let result = [...inMemoryUnmatched];
    if (params.status) {
      result = result.filter((u) => u.status === params.status);
    }
    return { data: result };
  },

  resolveUnmatched: (unmatchedId, invoiceId, notes) => {
    inMemoryUnmatched = inMemoryUnmatched.map((u) =>
      u._id === unmatchedId
        ? { ...u, status: "RESOLVED", resolvedInvoiceId: invoiceId, resolveNotes: notes }
        : u
    );
    return { message: "Khớp đối soát giao dịch thành công" };
  },
};
