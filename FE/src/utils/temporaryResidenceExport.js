import { date, labels, today } from "./formatters.js";

const CSV_HEADERS = [
  "STT",
  "Cơ sở / Tòa nhà",
  "Địa chỉ tạm trú",
  "Phòng",
  "Tầng",
  "Mã hợp đồng",
  "Họ và tên",
  "Vai trò cư trú",
  "Số CCCD / CMND",
  "Số điện thoại",
  "Quê quán",
  "Ngày bắt đầu cư trú",
  "Ngày kết thúc dự kiến",
  "Trạng thái hợp đồng",
  "Trạng thái tạm trú",
];

/**
 * Sanitize and RFC-4180 quote a CSV cell, guarding spreadsheet formula prefixes.
 */
function toCsvCell(rawValue) {
  let str = rawValue === null || rawValue === undefined ? "" : String(rawValue).trim();
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Flatten active contracts and their roommates into resident rows for police declaration CSV.
 */
export function buildTemporaryResidenceRows(contracts = []) {
  const rows = [];
  let stt = 1;

  for (const contract of contracts) {
    const branchName = contract.branchId?.name || "";
    const branchAddress = contract.branchId?.address?.fullAddress || "";
    const roomNumber = contract.roomId?.roomNumber || "";
    const floor = contract.roomId?.floor ?? "";
    const contractCode = contract.contractCode || "";
    const start = contract.startDate ? date(contract.startDate) : "";
    const end = contract.endDate ? date(contract.endDate) : "";
    const contractStatus =
      labels[contract.displayStatus || contract.status] ||
      contract.displayStatus ||
      contract.status ||
      "";

    const tenant = contract.tenantId;
    if (tenant && typeof tenant === "object") {
      rows.push([
        stt++,
        branchName,
        branchAddress,
        roomNumber,
        floor,
        contractCode,
        tenant.name || "",
        "Chủ hợp đồng",
        tenant.citizenId || "",
        tenant.phoneNumber || "",
        tenant.hometown || "",
        start,
        end,
        contractStatus,
        tenant.temporaryResidenceRegistered ? "Đã đăng ký" : "Chưa đăng ký",
      ]);
    }

    for (const roommate of contract.roommates || []) {
      rows.push([
        stt++,
        branchName,
        branchAddress,
        roomNumber,
        floor,
        contractCode,
        roommate.fullName || "",
        "Người ở cùng",
        roommate.citizenId || "",
        roommate.phoneNumber || "",
        "",
        start,
        end,
        contractStatus,
        "Theo chủ hợp đồng",
      ]);
    }
  }

  return rows;
}

/**
 * Generate a UTF-8 BOM CSV file of residents and trigger browser download.
 */
export function downloadTemporaryResidenceCsv(contracts = [], fileDate = today()) {
  const rows = buildTemporaryResidenceRows(contracts);
  const lines = [
    CSV_HEADERS.map(toCsvCell).join(","),
    ...rows.map((row) => row.map(toCsvCell).join(",")),
  ];
  const csvContent = `\uFEFF${lines.join("\r\n")}`;
  const filename = `khai-bao-tam-tru-${fileDate}.csv`;

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);

  return {
    filename,
    residentCount: rows.length,
    contractCount: contracts.length,
  };
}
