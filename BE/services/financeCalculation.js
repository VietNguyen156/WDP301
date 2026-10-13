const AppError = require("../utils/AppError");
const { money } = require("../utils/financeValidation");

function consumption(oldIndex, newIndex, label) {
  if (
    !Number.isFinite(oldIndex) ||
    !Number.isFinite(newIndex) ||
    oldIndex < 0 ||
    newIndex < oldIndex
  ) {
    throw new AppError(
      400,
      "READING_LOWER_THAN_PREVIOUS",
      `Chỉ số ${label} không hợp lệ`,
    );
  }
  return newIndex - oldIndex;
}

function calculateInvoice({ branch, room, contract, reading, snapshot }) {
  const headCount = 1 + (contract.roommates || []).length;
  const electricConsumed = consumption(
    reading.oldElectricIndex,
    reading.newElectricIndex,
    "điện",
  );
  const waterType =
    snapshot?.waterDetail.billingType ||
    room.waterBillingType ||
    branch.waterBillingType;
  const waterConsumed =
    waterType === "METER"
      ? consumption(reading.oldWaterIndex, reading.newWaterIndex, "nước")
      : 0;
  const electricPrice = money(
    snapshot?.electricDetail.unitPrice ??
      room.electricityPrice ??
      branch.defaultElectricityPrice,
    "Đơn giá điện",
  );
  const waterPrice = money(
    snapshot?.waterDetail.unitPrice ??
      room.waterPrice ??
      branch.defaultWaterPrice,
    "Đơn giá nước",
  );
  if (!["METER", "PER_PERSON", "FIXED"].includes(waterType)) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Hình thức tính nước không hợp lệ",
    );
  }
  const services = snapshot
    ? snapshot.servicesDetail.map((service) => ({
        name: service.serviceName,
        price: service.unitPrice,
        billingType: service.billingType,
        quantity: service.quantity,
      }))
    : room.services || branch.defaultServices || [];
  const servicesDetail = services.map((service) => {
    let quantity = 1;
    if (service.billingType === "PER_PERSON") quantity = headCount;
    if (service.billingType === "PER_UNIT") {
      quantity =
        contract.serviceQuantities?.get?.(service.name) ??
        contract.serviceQuantities?.[service.name];
      if (!Number.isSafeInteger(quantity) || quantity < 0) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          `Thiếu số lượng dịch vụ ${service.name} trong hợp đồng`,
        );
      }
    }
    // Older invoices do not have billingType; keep their recorded quantities.
    if (snapshot && !service.billingType) quantity = service.quantity;
    const unitPrice = money(service.price, "Đơn giá dịch vụ");
    return {
      serviceName: service.name,
      billingType: service.billingType,
      unitPrice,
      quantity,
      amount: money(unitPrice * quantity, "Tiền dịch vụ"),
    };
  });
  const roomAmount = money(
    snapshot?.roomAmount ?? contract.rentalPrice,
    "Tiền phòng",
  );
  const electricDetail = {
    oldIndex: reading.oldElectricIndex,
    newIndex: reading.newElectricIndex,
    consumed: electricConsumed,
    unitPrice: electricPrice,
    amount: money(Math.round(electricConsumed * electricPrice), "Tiền điện"),
  };
  const waterQuantity =
    waterType === "METER"
      ? waterConsumed
      : waterType === "PER_PERSON"
        ? headCount
        : 1;
  const waterDetail = {
    billingType: waterType,
    oldIndex: reading.oldWaterIndex,
    newIndex: reading.newWaterIndex,
    consumed: waterConsumed,
    headCount,
    unitPrice: waterPrice,
    amount: money(Math.round(waterQuantity * waterPrice), "Tiền nước"),
  };
  const additionalFees = snapshot?.additionalFees || [];
  const discount = snapshot?.discount || { reason: "", amount: 0 };
  const subtotal = money(
    roomAmount +
      electricDetail.amount +
      waterDetail.amount +
      servicesDetail.reduce((sum, item) => sum + item.amount, 0) +
      additionalFees.reduce(
        (sum, item) => sum + money(item.amount, "Phí phát sinh"),
        0,
      ),
    "Tổng trước giảm giá",
  );
  const totalAmount = money(
    subtotal - money(discount.amount, "Giảm giá"),
    "Tổng hóa đơn",
  );
  return {
    roomAmount,
    electricDetail,
    waterDetail,
    servicesDetail,
    additionalFees,
    discount,
    totalAmount,
    remainingAmount: totalAmount,
  };
}

function paymentBalance(invoice, amount) {
  money(invoice.totalAmount, "Tổng hóa đơn");
  money(invoice.paidAmount, "Tiền đã thu");
  money(amount, "Số tiền thanh toán", true);
  const paidAmount = money(invoice.paidAmount + amount, "Tổng tiền đã thu");
  const remainingAmount = Math.max(invoice.totalAmount - paidAmount, 0);
  const overpaidAmount = Math.max(paidAmount - invoice.totalAmount, 0);
  return {
    paidAmount,
    remainingAmount,
    overpaidAmount,
    status:
      overpaidAmount > 0
        ? "OVERPAID"
        : remainingAmount === 0
          ? "PAID"
          : "PARTIALLY_PAID",
  };
}

function makeVietQr(bank, amount, syntax) {
  if (!bank?.bankCode || !bank.accountNumber || !bank.accountName) {
    throw new AppError(
      400,
      "BANK_NOT_CONFIGURED",
      "Chủ trọ chưa cấu hình đầy đủ tài khoản ngân hàng",
    );
  }
  money(amount, "Số tiền QR");
  const query = new URLSearchParams({
    amount: String(amount),
    addInfo: syntax,
    accountName: bank.accountName,
  });
  return `https://img.vietqr.io/image/${encodeURIComponent(bank.bankCode)}-${encodeURIComponent(bank.accountNumber)}-compact2.png?${query}`;
}

module.exports = { calculateInvoice, paymentBalance, makeVietQr };
