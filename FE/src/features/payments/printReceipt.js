import {
  formatCurrency,
  formatDate,
  getPaymentMethodMeta,
  getPaymentStatusMeta,
  paymentHandlers,
  paymentPayer,
} from "../../utils/formatters";

const escape = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Printable receipt for one payment (deposit or invoice), opened in its own window so the
// app's layout never ends up on paper. Returns false when the browser blocked the popup.
export function printReceipt(p) {
  const isDeposit = p.purpose === "CONTRACT_DEPOSIT";
  const payer = paymentPayer(p);
  const rows = [
    ["Số biên nhận", p.receiptNumber || p.referenceCode],
    isDeposit ? ["Hợp đồng", p.contractCode] : ["Hóa đơn", p.invoiceCode],
    [
      "Khoản thu",
      isDeposit
        ? "Tiền đặt cọc hợp đồng thuê phòng"
        : p.invoiceId?.invoiceType === "INCIDENT"
          ? "Tiền sửa chữa sự cố (người thuê chịu phí)"
          : "Thanh toán hóa đơn",
    ],
    ["Hình thức", getPaymentMethodMeta(p.paymentMethod).label],
    ["Thời gian", formatDate(p.transactionDate || p.createdAt, true)],
    ["Người nộp", payer.onBehalfOf ? `${payer.name}, nộp thay cho ${payer.onBehalfOf}` : payer.name],
    payer.place ? ["Phòng", payer.place] : null,
    ...paymentHandlers(p).map((line) => [line.label, line.value]),
    ["Trạng thái", getPaymentStatusMeta(p.status).label],
    p.note ? ["Ghi chú", p.note] : null,
  ].filter(Boolean);
  const title = isDeposit ? "BIÊN NHẬN TIỀN CỌC" : "BIÊN NHẬN THANH TOÁN";
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${escape(title)} ${escape(p.referenceCode)}</title>
<style>
  body{font-family:"Segoe UI",Arial,sans-serif;color:#131b2e;max-width:640px;margin:32px auto;padding:0 24px}
  h1{font-size:20px;text-align:center;margin:0 0 4px;letter-spacing:.04em}
  .sub{text-align:center;color:#64748b;font-size:13px;margin-bottom:24px}
  .amount{text-align:center;font-size:28px;font-weight:700;margin:16px 0 24px}
  table{width:100%;border-collapse:collapse;font-size:14px}
  td{padding:9px 4px;border-bottom:1px solid #e2e8f0;vertical-align:top}
  td:first-child{color:#64748b;width:38%}
  .sign{display:flex;justify-content:space-between;margin-top:48px;text-align:center;font-size:13px}
  .sign div{width:45%}
  .sign i{display:block;color:#94a3b8;margin-top:4px}
  @media print{body{margin:0 auto}}
</style></head><body>
<h1>${escape(title)}</h1>
<div class="sub">Mã giao dịch: ${escape(p.referenceCode)}</div>
<div class="amount">${escape(formatCurrency(p.amount))}</div>
<table>${rows.map(([k, v]) => `<tr><td>${escape(k)}</td><td>${escape(v)}</td></tr>`).join("")}</table>
<div class="sign"><div><b>Người nộp tiền</b><i>(Ký, ghi rõ họ tên)</i></div><div><b>Người nhận tiền</b><i>(Ký, ghi rõ họ tên)</i></div></div>
<script>window.onload=function(){window.print()}</script>
</body></html>`;
  const win = window.open("", "_blank", "width=760,height=900");
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  return true;
}
