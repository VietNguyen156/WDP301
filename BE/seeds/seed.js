require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const {
  User,
  SaaSPlan,
  Subscription,
  Branch,
  Room,
  Contract,
  UtilityReading,
  Invoice,
  Payment,
  Incident,
} = require("../models");

const seedDatabase = async () => {
  try {
    console.log("---------------------------------------------");
    console.log("🌱 BẮT ĐẦU SEED DỮ LIỆU MẪU CHO DỰ ÁN WDP301");
    console.log("---------------------------------------------");

    await connectDB();

    // 1. Dọn dẹp dữ liệu cũ (Xóa trắng các collection)
    console.log("🧹 Đang dọn dẹp dữ liệu cũ...");
    await Promise.all([
      User.deleteMany({}),
      SaaSPlan.deleteMany({}),
      Subscription.deleteMany({}),
      Branch.deleteMany({}),
      Room.deleteMany({}),
      Contract.deleteMany({}),
      UtilityReading.deleteMany({}),
      Invoice.deleteMany({}),
      Payment.deleteMany({}),
      Incident.deleteMany({}),
    ]);
    console.log("✅ Đã dọn dẹp sạch dữ liệu cũ!");

    // 2. Tạo các Gói Dịch vụ SaaS (SaaS Plans)
    console.log("📦 Đang tạo các gói SaaS...");
    const plans = await SaaSPlan.create([
      {
        name: "Gói Dùng Thử",
        code: "FREE_TRIAL",
        price: 0,
        maxBranches: 1,
        maxRooms: 5,
        maxManagers: 1,
        features: ["Quản lý cơ bản", "Chốt số điện nước", "Hóa đơn VietQR"],
      },
      {
        name: "Gói Starter (Chuỗi nhỏ)",
        code: "STARTER",
        price: 199000,
        maxBranches: 1,
        maxRooms: 20,
        maxManagers: 2,
        features: ["Tự động hóa hóa đơn", "VietQR động", "Webhook ngân hàng", "Báo cáo công nợ"],
      },
      {
        name: "Gói Pro (Chuỗi chuyên nghiệp)",
        code: "PRO",
        price: 499000,
        maxBranches: 5,
        maxRooms: 100,
        maxManagers: 5,
        features: [
          "Tất cả tính năng Starter",
          "Quản lý sự cố & bảo trì",
          "Thông báo Zalo/Email tự động",
          "Báo cáo dòng tiền realtime",
        ],
      },
      {
        name: "Gói Doanh Nghiệp",
        code: "ENTERPRISE",
        price: 999000,
        maxBranches: 999,
        maxRooms: 9999,
        maxManagers: 99,
        features: ["Không giới hạn", "Hỗ trợ 24/7", "Tích hợp Smart Meter IoT"],
      },
    ]);
    const proPlan = plans.find((p) => p.code === "PRO");

    // 3. Tạo Tài khoản Người dùng (Users: Admin, Landlord, Manager, Tenants)
    console.log("👥 Đang tạo tài khoản người dùng mẫu...");

    // 3.1 Platform Admin
    const admin = await User.create({
      name: "Nguyễn Quản Trị (Admin)",
      email: "admin@wdp301.com",
      password: "password123",
      phoneNumber: "0901000001",
      role: "ADMIN",
      status: "ACTIVE",
    });

    // 3.2 Chủ chuỗi trọ (Landlord) có cấu hình ngân hàng VietQR
    const landlord = await User.create({
      name: "Trần Văn Chủ Trọ",
      email: "landlord@wdp301.com",
      password: "password123",
      phoneNumber: "0988888888",
      role: "LANDLORD",
      status: "ACTIVE",
      bankConfig: {
        bankCode: "MB", // Ngân hàng Quân Đội
        bankName: "MBBank",
        accountNumber: "0988888888",
        accountName: "TRAN VAN CHU TRO",
      },
    });

    // Tạo thuê bao Pro cho Landlord
    const subscription = await Subscription.create({
      landlordId: landlord._id,
      planId: proPlan._id,
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 năm
      pricePaid: 499000 * 12,
      status: "ACTIVE",
    });
    landlord.subscriptionId = subscription._id;
    await landlord.save();

    // 3.3 Quản lý cơ sở (Property Manager)
    const manager = await User.create({
      name: "Lê Quản Lý",
      email: "manager@wdp301.com",
      password: "password123",
      phoneNumber: "0977777777",
      role: "PROPERTY_MANAGER",
      landlordId: landlord._id,
      status: "ACTIVE",
    });

    // 3.4 Khách thuê trọ (Tenants)
    const tenant1 = await User.create({
      name: "Nguyễn Văn Thuê (P.101)",
      email: "tenant1@wdp301.com",
      password: "password123",
      phoneNumber: "0912111111",
      role: "TENANT",
      landlordId: landlord._id,
      citizenId: "001201001234",
      hometown: "Nam Định",
      temporaryResidenceRegistered: true,
    });

    const tenant2 = await User.create({
      name: "Hoàng Thị Mai (P.102)",
      email: "tenant2@wdp301.com",
      password: "password123",
      phoneNumber: "0912222222",
      role: "TENANT",
      landlordId: landlord._id,
      citizenId: "001202002345",
      hometown: "Thanh Hóa",
      temporaryResidenceRegistered: true,
    });

    const tenant3 = await User.create({
      name: "Phạm Quốc Bảo (P.201)",
      email: "tenant3@wdp301.com",
      password: "password123",
      phoneNumber: "0912333333",
      role: "TENANT",
      landlordId: landlord._id,
      citizenId: "001203003456",
      hometown: "Hải Phòng",
      temporaryResidenceRegistered: false,
    });

    // 4. Tạo Cơ sở / Tòa nhà trọ (Branch)
    console.log("🏢 Đang tạo cơ sở / tòa nhà trọ...");
    const branch = await Branch.create({
      landlordId: landlord._id,
      name: "Tòa Nhà Trọ Xanh Cầu Giấy",
      address: {
        street: "Số 18 Ngõ 233 Xuân Thủy",
        ward: "Dịch Vọng Hậu",
        district: "Cầu Giấy",
        city: "Hà Nội",
        fullAddress: "Số 18 Ngõ 233 Xuân Thủy, Dịch Vọng Hậu, Cầu Giấy, Hà Nội",
      },
      defaultElectricityPrice: 3800, // 3.800đ/kWh
      waterBillingType: "METER",
      defaultWaterPrice: 30000, // 30.000đ/m3
      defaultServices: [
        { name: "Rác & Vệ sinh", price: 30000, billingType: "PER_ROOM" },
        { name: "Internet Cáp quang", price: 50000, billingType: "PER_ROOM" },
        { name: "Gửi xe máy", price: 100000, billingType: "PER_UNIT" },
      ],
      billingCycleDay: 1, // Chốt số ngày 1 hàng tháng
      paymentDueDays: 5, // Hạn đóng tiền 5 ngày
      managerIds: [manager._id],
    });

    // Cập nhật phân quyền phụ trách cơ sở cho Quản lý
    manager.assignedBranches = [branch._id];
    await manager.save();

    // 5. Tạo Danh sách Phòng (Rooms)
    console.log("🚪 Đang tạo danh sách phòng trọ...");
    const room101 = await Room.create({
      landlordId: landlord._id,
      branchId: branch._id,
      roomNumber: "P.101",
      floor: 1,
      basePrice: 3500000,
      maxOccupants: 2,
      status: "RENTED",
      currentElectricIndex: 195,
      currentWaterIndex: 52,
      amenities: ["Điều hòa", "Nóng lạnh", "Gác xép", "Tủ quần áo"],
    });

    const room102 = await Room.create({
      landlordId: landlord._id,
      branchId: branch._id,
      roomNumber: "P.102",
      floor: 1,
      basePrice: 3200000,
      maxOccupants: 2,
      status: "RENTED",
      currentElectricIndex: 140,
      currentWaterIndex: 35,
      amenities: ["Điều hòa", "Nóng lạnh"],
    });

    const room201 = await Room.create({
      landlordId: landlord._id,
      branchId: branch._id,
      roomNumber: "P.201",
      floor: 2,
      basePrice: 4000000,
      maxOccupants: 3,
      status: "RENTED",
      currentElectricIndex: 305,
      currentWaterIndex: 68,
      amenities: ["Điều hòa Inverter", "Nóng lạnh", "Tủ lạnh mini", "Ban công thoáng"],
    });

    const room202 = await Room.create({
      landlordId: landlord._id,
      branchId: branch._id,
      roomNumber: "P.202",
      floor: 2,
      basePrice: 3800000,
      maxOccupants: 2,
      status: "EMPTY", // Phòng trống để test chức năng thêm khách
      currentElectricIndex: 50,
      currentWaterIndex: 10,
      amenities: ["Điều hòa", "Nóng lạnh", "Ban công"],
    });

    const room301 = await Room.create({
      landlordId: landlord._id,
      branchId: branch._id,
      roomNumber: "P.301",
      floor: 3,
      basePrice: 3000000,
      maxOccupants: 2,
      status: "MAINTENANCE", // Phòng đang bảo trì để test trạng thái
      currentElectricIndex: 10,
      currentWaterIndex: 5,
      amenities: ["Quạt trần", "Nóng lạnh"],
    });

    // 6. Tạo Hợp đồng thuê phòng (Contracts)
    console.log("📝 Đang tạo hợp đồng thuê phòng...");
    const contract1 = await Contract.create({
      landlordId: landlord._id,
      branchId: branch._id,
      roomId: room101._id,
      tenantId: tenant1._id,
      contractCode: "HDT-2026-P101",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2027-01-01"),
      rentalPrice: 3500000,
      depositAmount: 3500000,
      depositStatus: "PAID",
      initialElectricIndex: 100,
      initialWaterIndex: 20,
      roommates: [{ fullName: "Nguyễn Văn Em", citizenId: "001201009999", phoneNumber: "0912111999" }],
      status: "ACTIVE",
    });
    room101.currentContractId = contract1._id;
    await room101.save();

    const contract2 = await Contract.create({
      landlordId: landlord._id,
      branchId: branch._id,
      roomId: room102._id,
      tenantId: tenant2._id,
      contractCode: "HDT-2026-P102",
      startDate: new Date("2026-03-01"),
      endDate: new Date("2026-09-01"),
      rentalPrice: 3200000,
      depositAmount: 3200000,
      depositStatus: "PAID",
      initialElectricIndex: 50,
      initialWaterIndex: 15,
      status: "ACTIVE",
    });
    room102.currentContractId = contract2._id;
    await room102.save();

    const contract3 = await Contract.create({
      landlordId: landlord._id,
      branchId: branch._id,
      roomId: room201._id,
      tenantId: tenant3._id,
      contractCode: "HDT-2026-P201",
      startDate: new Date("2026-02-15"),
      endDate: new Date("2027-02-15"),
      rentalPrice: 4000000,
      depositAmount: 4000000,
      depositStatus: "PAID",
      initialElectricIndex: 120,
      initialWaterIndex: 30,
      status: "ACTIVE",
    });
    room201.currentContractId = contract3._id;
    await room201.save();

    // 7. Tạo Bản ghi Chốt số Điện Nước (Utility Readings Tháng 9/2026)
    console.log("⚡ Đang tạo bản ghi chốt số điện nước...");
    await UtilityReading.create([
      {
        landlordId: landlord._id,
        branchId: branch._id,
        roomId: room101._id,
        recordedBy: manager._id,
        month: 9,
        year: 2026,
        oldElectricIndex: 120,
        newElectricIndex: 195,
        consumedElectric: 75, // 75 kWh
        oldWaterIndex: 45,
        newWaterIndex: 52,
        consumedWater: 7, // 7 m3
        isBilled: true,
      },
      {
        landlordId: landlord._id,
        branchId: branch._id,
        roomId: room102._id,
        recordedBy: manager._id,
        month: 9,
        year: 2026,
        oldElectricIndex: 85,
        newElectricIndex: 140,
        consumedElectric: 55, // 55 kWh
        oldWaterIndex: 30,
        newWaterIndex: 35,
        consumedWater: 5, // 5 m3
        isBilled: true,
      },
      {
        landlordId: landlord._id,
        branchId: branch._id,
        roomId: room201._id,
        recordedBy: manager._id,
        month: 9,
        year: 2026,
        oldElectricIndex: 210,
        newElectricIndex: 305,
        consumedElectric: 95, // 95 kWh
        oldWaterIndex: 60,
        newWaterIndex: 68,
        consumedWater: 8, // 8 m3
        isBilled: true,
      },
    ]);

    // 8. Tạo Hóa đơn Hàng tháng (Invoices với 3 kịch bản: PAID, UNPAID, OVERDUE)
    console.log("🧾 Đang tạo hóa đơn và mã VietQR...");

    // Hàm sinh QuickLink VietQR chuẩn NAPAS 247
    const makeVietQrUrl = (amount, addInfo) => {
      const bank = landlord.bankConfig.bankCode;
      const acc = landlord.bankConfig.accountNumber;
      const name = encodeURIComponent(landlord.bankConfig.accountName);
      const info = encodeURIComponent(addInfo);
      return `https://img.vietqr.io/image/${bank}-${acc}-compact2.png?amount=${amount}&addInfo=${info}&accountName=${name}`;
    };

    // Hóa đơn 1 (P.101): ĐÃ THANH TOÁN (PAID)
    const inv1Total = 3500000 + 75 * 3800 + 7 * 30000 + 30000 + 50000; // = 4.075.000đ
    const inv1Syntax = "HD1001 P101";
    const invoice1 = await Invoice.create({
      landlordId: landlord._id,
      branchId: branch._id,
      roomId: room101._id,
      contractId: contract1._id,
      tenantId: tenant1._id,
      invoiceCode: "HD1001",
      month: 9,
      year: 2026,
      dueDate: new Date("2026-09-05"),
      roomAmount: 3500000,
      electricDetail: { oldIndex: 120, newIndex: 195, consumed: 75, unitPrice: 3800, amount: 75 * 3800 },
      waterDetail: { billingType: "METER", oldIndex: 45, newIndex: 52, consumed: 7, unitPrice: 30000, amount: 7 * 30000 },
      servicesDetail: [
        { serviceName: "Rác & Vệ sinh", unitPrice: 30000, quantity: 1, amount: 30000 },
        { serviceName: "Internet Cáp quang", unitPrice: 50000, quantity: 1, amount: 50000 },
      ],
      totalAmount: inv1Total,
      paidAmount: inv1Total,
      remainingAmount: 0,
      vietQrUrl: makeVietQrUrl(inv1Total, inv1Syntax),
      paymentSyntax: inv1Syntax,
      status: "PAID",
    });

    // Hóa đơn 2 (P.102): ĐANG CHỜ THANH TOÁN (UNPAID) - Để test quét VietQR
    const inv2Total = 3200000 + 55 * 3800 + 5 * 30000 + 30000 + 50000; // = 3.639.000đ
    const inv2Syntax = "HD1002 P102";
    const invoice2 = await Invoice.create({
      landlordId: landlord._id,
      branchId: branch._id,
      roomId: room102._id,
      contractId: contract2._id,
      tenantId: tenant2._id,
      invoiceCode: "HD1002",
      month: 9,
      year: 2026,
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // Còn 3 ngày nữa hết hạn
      roomAmount: 3200000,
      electricDetail: { oldIndex: 85, newIndex: 140, consumed: 55, unitPrice: 3800, amount: 55 * 3800 },
      waterDetail: { billingType: "METER", oldIndex: 30, newIndex: 35, consumed: 5, unitPrice: 30000, amount: 5 * 30000 },
      servicesDetail: [
        { serviceName: "Rác & Vệ sinh", unitPrice: 30000, quantity: 1, amount: 30000 },
        { serviceName: "Internet Cáp quang", unitPrice: 50000, quantity: 1, amount: 50000 },
      ],
      totalAmount: inv2Total,
      paidAmount: 0,
      remainingAmount: inv2Total,
      vietQrUrl: makeVietQrUrl(inv2Total, inv2Syntax),
      paymentSyntax: inv2Syntax,
      status: "UNPAID",
    });

    // Hóa đơn 3 (P.201): QUÁ HẠN THANH TOÁN (OVERDUE) - Để test cảnh báo công nợ
    const inv3Total = 4000000 + 95 * 3800 + 8 * 30000 + 30000 + 50000 + 100000; // Kèm xe máy = 4.781.000đ
    const inv3Syntax = "HD1003 P201";
    const invoice3 = await Invoice.create({
      landlordId: landlord._id,
      branchId: branch._id,
      roomId: room201._id,
      contractId: contract3._id,
      tenantId: tenant3._id,
      invoiceCode: "HD1003",
      month: 9,
      year: 2026,
      dueDate: new Date("2026-09-05"), // Đã quá hạn
      roomAmount: 4000000,
      electricDetail: { oldIndex: 210, newIndex: 305, consumed: 95, unitPrice: 3800, amount: 95 * 3800 },
      waterDetail: { billingType: "METER", oldIndex: 60, newIndex: 68, consumed: 8, unitPrice: 30000, amount: 8 * 30000 },
      servicesDetail: [
        { serviceName: "Rác & Vệ sinh", unitPrice: 30000, quantity: 1, amount: 30000 },
        { serviceName: "Internet Cáp quang", unitPrice: 50000, quantity: 1, amount: 50000 },
        { serviceName: "Gửi xe máy", unitPrice: 100000, quantity: 1, amount: 100000 },
      ],
      totalAmount: inv3Total,
      paidAmount: 0,
      remainingAmount: inv3Total,
      vietQrUrl: makeVietQrUrl(inv3Total, inv3Syntax),
      paymentSyntax: inv3Syntax,
      status: "OVERDUE",
    });

    // 9. Tạo Giao dịch thanh toán mẫu (Payment record cho Hóa đơn 1)
    console.log("💳 Đang tạo lịch sử giao dịch thanh toán...");
    await Payment.create({
      landlordId: landlord._id,
      invoiceId: invoice1._id,
      invoiceCode: invoice1.invoiceCode,
      amount: inv1Total,
      paymentMethod: "VIETQR",
      referenceCode: "FT26253198716",
      gateway: "MBBank",
      transactionDate: new Date("2026-09-03 10:15:30"),
      content: "HD1001 P101 chuyen tien phong thang 9",
      senderAccountNumber: "0123456789",
      senderBank: "VCB",
      status: "SUCCESS",
    });

    // 10. Tạo Sự cố bảo trì mẫu (Incident)
    console.log("🔧 Đang tạo sự cố bảo trì mẫu...");
    await Incident.create({
      landlordId: landlord._id,
      branchId: branch._id,
      roomId: room102._id,
      reportedBy: tenant2._id,
      title: "Rò rỉ vòi xịt vệ sinh",
      description: "Vòi xịt bồn cầu bị rỉ nước liên tục làm ướt sàn nhà tắm.",
      priority: "MEDIUM",
      status: "IN_PROGRESS",
      repairCost: 150000,
      costPayer: "LANDLORD",
      assignedTo: manager._id,
      notes: "Đã liên hệ thợ điện nước hẹn 9h sáng mai qua thay dây mới.",
    });

    console.log("---------------------------------------------");
    console.log("🎉 SEED DỮ LIỆU THÀNH CÔNG RỰC RỠ!");
    console.log("---------------------------------------------");
    console.log("🔑 DANH SÁCH TÀI KHOẢN ĐĂNG NHẬP MẪU (Password chung: password123):");
    console.log("1. Admin:            admin@wdp301.com");
    console.log("2. Chủ trọ:          landlord@wdp301.com (Gói PRO, STK: 0988888888 MBBank)");
    console.log("3. Quản lý cơ sở:    manager@wdp301.com  (Phụ trách Tòa Nhà Trọ Xanh)");
    console.log("4. Khách thuê P.101: tenant1@wdp301.com  (Hóa đơn HD1001: Đã thanh toán)");
    console.log("5. Khách thuê P.102: tenant2@wdp301.com  (Hóa đơn HD1002: Chờ quét VietQR)");
    console.log("6. Khách thuê P.201: tenant3@wdp301.com  (Hóa đơn HD1003: Quá hạn thanh toán)");
    console.log("---------------------------------------------");
    console.log("🌐 LINK XEM HÓA ĐƠN NO-APP (KHÁCH THUÊ P.102):");
    console.log(`http://localhost:5000/api/invoices/public/${invoice2.publicAccessToken}`);
    console.log("---------------------------------------------");

    process.exit(0);
  } catch (error) {
    console.error("❌ Lỗi khi seed dữ liệu:", error);
    process.exit(1);
  }
};

seedDatabase();
