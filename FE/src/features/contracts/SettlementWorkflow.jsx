import { useEffect, useState } from "react";
import {
  ArrowRight,
  Banknote,
  CheckCircle2,
  Droplets,
  Plus,
  RefreshCw,
  Sofa,
  Trash2,
  Zap,
} from "lucide-react";
import { contractApi, paymentApi, errorMessage } from "../../services/api";
import { useToast } from "../../context/ToastContext";
import { Button, Field, FormError, SelectField } from "../../components/ui";
import { date, money, today } from "../../utils/format";
import { TERMINATION_REASONS } from "../../utils/terminationReasons";

const REFUND_METHODS = { CASH: "Tiền mặt", BANK_TRANSFER: "Chuyển khoản" };

export default function SettlementWorkflow({ contract, onCancel, onSaved, onBusyChange }) {
  const toast = useToast();
  // Contract end date as a Vietnam calendar day (YYYY-MM-DD), like the backend compares it.
  const endKey = contract.endDate
    ? new Date(contract.endDate).toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" })
    : "";
  const furnishings = contract.furnishings || [];
  const noticeDays = contract.contractTerms?.terminationNoticeDays ?? 30;
  const heldDeposit = contract.depositStatus === "PAID" ? contract.depositAmount || 0 : 0;

  const [body, setBody] = useState(() => ({
    terminationReason: today() >= endKey ? "EXPIRED" : "TENANT_EARLY",
    forfeitDeposit: false,
    actualEndDate: today(),
    finalElectricIndex: contract.roomId?.currentElectricIndex ?? contract.initialElectricIndex ?? 0,
    finalWaterIndex: contract.roomId?.currentWaterIndex ?? contract.initialWaterIndex ?? 0,
    electricImage: "",
    waterImage: "",
    deductions: [],
    settlementNotes: "",
    // Must be ticked on purpose: it is the record that both sides checked the room together.
    confirmedByBothParties: false,
  }));

  const [busy, setBusyState] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null); // { settlement, invoices, reason }
  const [payingInvoiceId, setPayingInvoiceId] = useState(null);
  const [refundMethod, setRefundMethod] = useState("");
  const [refundNote, setRefundNote] = useState("");

  const setBusy = (value) => {
    setBusyState(value);
    onBusyChange?.(value);
  };

  async function load(payload, successMessage) {
    setBusy(true);
    setError("");
    try {
      const res = await contractApi.settlement(contract._id, payload);
      if (res?.settlement) {
        setResult({
          settlement: res.settlement,
          invoices: res.settlementInvoices || [],
          reason: res.terminationReason,
        });
        if (successMessage) toast.success(successMessage);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (contract.settlement?.state === "PREPARED") load({});
    // Only when the dialog opens for this contract.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contract._id]);

  const set = (key, value) => setBody((current) => ({ ...current, [key]: value }));
  const change = (key) => (e) =>
    set(key, e.target.type === "number" ? Number(e.target.value) : e.target.value);

  // ---- Damage / compensation lines ----
  function addFurnishingDeduction(name) {
    const item = furnishings.find((f) => f.name === name);
    if (!item) return;
    set("deductions", [
      ...body.deductions,
      {
        furnishingName: item.name,
        quantity: 1,
        amount: item.price,
        reason: `Đền bù hư hỏng/mất: ${item.name}`,
        evidenceImage: "",
      },
    ]);
  }
  const addOtherDeduction = () =>
    set("deductions", [...body.deductions, { reason: "", amount: 0, evidenceImage: "" }]);
  const updateDeduction = (index, key, value) =>
    set(
      "deductions",
      body.deductions.map((d, i) =>
        i === index ? { ...d, [key]: key === "amount" || key === "quantity" ? Number(value) : value } : d,
      ),
    );
  const removeDeduction = (index) =>
    set("deductions", body.deductions.filter((_, i) => i !== index));

  // ---- Checks shown before sending (the server applies the same rules) ----
  const baseElectric = Math.max(contract.initialElectricIndex ?? 0, contract.roomId?.currentElectricIndex ?? 0);
  const baseWater = Math.max(contract.initialWaterIndex ?? 0, contract.roomId?.currentWaterIndex ?? 0);
  const elecDelta = Number(body.finalElectricIndex) - baseElectric;
  const waterDelta = Number(body.finalWaterIndex) - baseWater;
  const early = body.actualEndDate < endKey;
  const reasonDateProblem =
    body.terminationReason === "EXPIRED" && early
      ? `Hợp đồng còn hạn đến ${date(contract.endDate)}. Trả phòng trước ngày này hãy chọn lý do khác.`
      : ["TENANT_EARLY", "TENANT_BREACH", "LANDLORD_EARLY"].includes(body.terminationReason) && !early
        ? `Ngày trả phòng không trước ngày kết thúc hợp đồng (${date(contract.endDate)}): chọn "Hết hạn hợp đồng".`
        : "";
  const deductionProblem = (() => {
    const used = {};
    for (const d of body.deductions) {
      if (!d.furnishingName) continue;
      const item = furnishings.find((f) => f.name === d.furnishingName);
      used[d.furnishingName] = (used[d.furnishingName] || 0) + (d.quantity || 0);
      if (item && used[d.furnishingName] > item.quantity)
        return `Số lượng "${item.name}" vượt số đã bàn giao (${item.quantity}).`;
      if (item && d.amount > item.price * d.quantity)
        return `Tiền đền bù "${item.name}" vượt đơn giá đã thỏa thuận (${money(item.price * d.quantity)}).`;
    }
    return "";
  })();
  const totalDeduction = body.deductions.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  const canSubmit =
    body.confirmedByBothParties && elecDelta >= 0 && waterDelta >= 0 && !reasonDateProblem && !deductionProblem;

  async function submit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    const payload = {
      ...body,
      forfeitDeposit: body.terminationReason === "TENANT_BREACH" ? body.forfeitDeposit : false,
      deductions: body.deductions.map((d) => ({
        reason: d.reason.trim(),
        amount: d.amount,
        ...(d.evidenceImage ? { evidenceImage: d.evidenceImage } : {}),
        ...(d.furnishingName ? { furnishingName: d.furnishingName, quantity: d.quantity } : {}),
      })),
    };
    for (const key of ["electricImage", "waterImage"]) if (!payload[key]) delete payload[key];
    await load(payload, "Đã lập biên bản quyết toán và cấn trừ tiền cọc.");
  }

  async function payCash(invoiceId, amount) {
    setPayingInvoiceId(invoiceId);
    setError("");
    try {
      await paymentApi.payCash({
        invoiceId,
        amount,
        paidAt: today(),
        notes: `Thu tiền mặt quyết toán thanh lý hợp đồng ${contract.contractCode}`,
      });
      toast.success("Đã ghi nhận thu tiền mặt.");
      await load({});
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPayingInvoiceId(null);
    }
  }

  async function finish() {
    setBusy(true);
    setError("");
    try {
      await contractApi.terminate(contract._id, {
        ...(refund > 0 ? { refundMethod, ...(refundNote.trim() ? { refundNote: refundNote.trim() } : {}) } : {}),
      });
      toast.success(`Đã thanh lý hợp đồng ${contract.contractCode}. Phòng chuyển sang Cần dọn dẹp.`);
      onSaved?.();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const s = result?.settlement;
  const remainingDue = s?.remainingDue || 0;
  const refund = s?.refundedDepositAmount || 0;
  const reasonKey = result?.reason || contract.terminationReason;

  return (
    <div className="settlement-workflow">
      <FormError error={error} />

      <div className="settlement-summary-banner">
        <div className="settlement-summary-top">
          <span className="settlement-summary-pill">
            Tiền cọc đang giữ: <strong>{money(heldDeposit)}</strong>
            {contract.depositStatus !== "PAID" && contract.depositAmount > 0 && " (chưa thu cọc)"}
          </span>
          <span className="settlement-summary-pill">
            Hạn hợp đồng: <strong>{date(contract.endDate)}</strong> · báo trước {noticeDays} ngày
          </span>
          <span className="settlement-summary-pill">
            Công tơ trước: <strong>{baseElectric} kWh</strong> · <strong>{baseWater} m³</strong>
          </span>
        </div>
        <div className="settlement-formula-line">
          Hoàn cọc = Cọc đang giữ − (Nợ hóa đơn cũ + Tiền phòng, điện, nước, dịch vụ chưa tính + Đền bù
          {" "}+ Phần cọc giữ lại do vi phạm)
        </div>
        <p className="settlement-formula-note">
          Bước 1 lập biên bản và cấn cọc vào các hóa đơn. Bước 2 thu phần khách còn thiếu, hoặc hoàn cọc cho
          khách. Bước 3 thanh lý: hợp đồng kết thúc, phòng chuyển sang <strong>Cần dọn dẹp</strong>.
        </p>
      </div>

      {!s ? (
        <form onSubmit={submit} className="settlement-form">
          {/* 1. Lý do chấm dứt & ngày trả phòng */}
          <div className="settlement-section">
            <div className="settlement-section-head">
              <div>
                <h4 className="settlement-section-title">1. Lý do chấm dứt & ngày trả phòng</h4>
                <p className="settlement-section-sub">{TERMINATION_REASONS[body.terminationReason].hint}</p>
              </div>
            </div>
            <div className="form-grid-2col">
              <SelectField label="Lý do chấm dứt" value={body.terminationReason} onChange={change("terminationReason")}>
                {Object.entries(TERMINATION_REASONS).map(([key, r]) => (
                  <option key={key} value={key}>
                    {r.label}
                  </option>
                ))}
              </SelectField>
              <Field
                label="Ngày trả phòng thực tế"
                type="date"
                max={today()}
                value={body.actualEndDate}
                onChange={change("actualEndDate")}
                required
              />
            </div>
            {reasonDateProblem && <p className="settlement-inline-error">{reasonDateProblem}</p>}
            {body.terminationReason === "TENANT_BREACH" && (
              <label className={`settlement-confirm-box ${body.forfeitDeposit ? "is-checked" : ""}`}>
                <input
                  type="checkbox"
                  className="settlement-confirm-checkbox"
                  checked={body.forfeitDeposit}
                  onChange={(e) => set("forfeitDeposit", e.target.checked)}
                />
                <span className="settlement-confirm-text">
                  Giữ lại phần tiền cọc còn lại sau khi trừ nợ (phạt vi phạm theo điều khoản tiền cọc). Không chọn
                  thì vẫn hoàn phần cọc còn lại cho khách.
                </span>
              </label>
            )}
          </div>

          {/* 2. Chỉ số công tơ cuối */}
          <div className="settlement-section">
            <div className="settlement-section-head">
              <div>
                <h4 className="settlement-section-title">2. Chỉ số công tơ khi trả phòng</h4>
                <p className="settlement-section-sub">
                  Chốt cùng khách tại thời điểm bàn giao. Tiền phòng, nước khoán và dịch vụ của những ngày chưa có
                  hóa đơn được tính theo số ngày ở thực tế.
                </p>
              </div>
              <div className="settlement-delta-row">
                <span className={`settlement-delta-chip ${elecDelta < 0 ? "is-invalid" : ""}`}>
                  <Zap size={12} />
                  {elecDelta >= 0 ? `Điện +${elecDelta} kWh` : `Điện nhỏ hơn số trước (${elecDelta})`}
                </span>
                <span className={`settlement-delta-chip ${waterDelta < 0 ? "is-invalid" : ""}`}>
                  <Droplets size={12} />
                  {waterDelta >= 0 ? `Nước +${waterDelta} m³` : `Nước nhỏ hơn số trước (${waterDelta})`}
                </span>
              </div>
            </div>
            <div className="form-grid-2col">
              <Field
                label={`Điện cuối (≥ ${baseElectric})`}
                type="number"
                min={baseElectric}
                value={body.finalElectricIndex}
                onChange={change("finalElectricIndex")}
                required
              />
              <Field
                label={`Nước cuối (≥ ${baseWater})`}
                type="number"
                min={baseWater}
                value={body.finalWaterIndex}
                onChange={change("finalWaterIndex")}
                required
              />
            </div>
            <div className="settlement-proof-grid">
              <Field
                label="Link ảnh công tơ điện (không bắt buộc)"
                type="url"
                placeholder="https://..."
                value={body.electricImage}
                onChange={change("electricImage")}
              />
              <Field
                label="Link ảnh công tơ nước (không bắt buộc)"
                type="url"
                placeholder="https://..."
                value={body.waterImage}
                onChange={change("waterImage")}
              />
            </div>
          </div>

          {/* 3. Đền bù & khấu trừ */}
          <div className="settlement-section">
            <div className="settlement-section-head">
              <div>
                <h4 className="settlement-section-title">
                  3. Đền bù hư hỏng & khấu trừ ({body.deductions.length} mục
                  {totalDeduction > 0 ? ` · ${money(totalDeduction)}` : ""})
                </h4>
                <p className="settlement-section-sub">
                  Đối chiếu danh mục vật dụng đã bàn giao. Đồ trong danh mục chỉ được đền bù tối đa theo đơn giá đã
                  ghi trong hợp đồng; hao mòn tự nhiên không tính.
                </p>
              </div>
              <div className="settlement-deduction-actions">
                {furnishings.length > 0 && (
                  <select
                    className="settlement-furnishing-picker"
                    value=""
                    onChange={(e) => addFurnishingDeduction(e.target.value)}
                    aria-label="Chọn vật dụng hư hỏng"
                  >
                    <option value="">+ Đền bù vật dụng…</option>
                    {furnishings.map((f) => (
                      <option key={f.name} value={f.name}>
                        {f.name} ({money(f.price)} x {f.quantity})
                      </option>
                    ))}
                  </select>
                )}
                <button type="button" className="contracts-btn-outline" onClick={addOtherDeduction}>
                  <Plus size={14} />
                  <span>Khoản khác</span>
                </button>
              </div>
            </div>

            {furnishings.length === 0 && (
              <p className="settlement-section-sub" style={{ margin: 0 }}>
                Hợp đồng không có danh mục vật dụng bàn giao: chỉ nhập được khoản khấu trừ tự do.
              </p>
            )}

            {body.deductions.length === 0 ? (
              <div className="settlement-deduction-empty">
                Không có khoản đền bù nào. Phòng và vật dụng bàn giao đầy đủ, nguyên trạng.
              </div>
            ) : (
              <div className="settlement-deduction-list">
                {body.deductions.map((d, i) => {
                  const item = d.furnishingName && furnishings.find((f) => f.name === d.furnishingName);
                  return (
                    <div key={i} className={`settlement-deduction-row ${item ? "is-furnishing" : ""}`}>
                      {item ? (
                        <span className="settlement-deduction-item">
                          <Sofa size={13} />
                          {item.name}
                        </span>
                      ) : (
                        <input
                          type="text"
                          placeholder="Lý do (Vd: vệ sinh phòng, mất chìa khóa...)"
                          value={d.reason}
                          onChange={(e) => updateDeduction(i, "reason", e.target.value)}
                          required
                        />
                      )}
                      {item && (
                        <input
                          type="number"
                          min="1"
                          max={item.quantity}
                          value={d.quantity}
                          title="Số lượng hư hỏng/mất"
                          aria-label="Số lượng"
                          onChange={(e) => updateDeduction(i, "quantity", e.target.value)}
                          required
                        />
                      )}
                      <input
                        type="number"
                        min="0"
                        max={item ? item.price * d.quantity : undefined}
                        placeholder="Số tiền (đ)"
                        title={item ? `Tối đa ${money(item.price * d.quantity)} theo đơn giá hợp đồng` : undefined}
                        value={d.amount}
                        onChange={(e) => updateDeduction(i, "amount", e.target.value)}
                        required
                      />
                      <input
                        type="url"
                        placeholder="Link ảnh (không bắt buộc)"
                        value={d.evidenceImage}
                        onChange={(e) => updateDeduction(i, "evidenceImage", e.target.value)}
                      />
                      <button
                        type="button"
                        className="settlement-deduction-remove"
                        onClick={() => removeDeduction(i)}
                        title="Xóa mục"
                        aria-label="Xóa mục khấu trừ"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {deductionProblem && <p className="settlement-inline-error">{deductionProblem}</p>}
          </div>

          {/* 4. Ghi chú & xác nhận */}
          <div className="settlement-section">
            <Field
              label="Ghi chú biên bản trả phòng"
              as="textarea"
              rows={2}
              placeholder="Tình trạng phòng, chìa khóa đã nhận lại, thỏa thuận khác..."
              value={body.settlementNotes}
              onChange={change("settlementNotes")}
            />
            <label className={`settlement-confirm-box ${body.confirmedByBothParties ? "is-checked" : ""}`}>
              <input
                type="checkbox"
                className="settlement-confirm-checkbox"
                checked={body.confirmedByBothParties}
                onChange={(e) => set("confirmedByBothParties", e.target.checked)}
              />
              <span className="settlement-confirm-text">
                Chủ trọ và khách thuê đã cùng kiểm tra phòng, vật dụng, chốt chỉ số công tơ và đồng ý các khoản
                trên.
              </span>
            </label>
          </div>

          <div className="settlement-footer">
            <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
              Quay lại
            </Button>
            <Button
              type="submit"
              busy={busy}
              disabled={!canSubmit}
              title={!body.confirmedByBothParties ? "Cần xác nhận biên bản của hai bên" : undefined}
            >
              <span>Lập biên bản quyết toán & cấn cọc</span>
              <ArrowRight size={15} />
            </Button>
          </div>
        </form>
      ) : (
        <div className="settlement-form">
          <div className="settlement-card-box">
            <span className="settlement-result-title">
              Biên bản quyết toán · {TERMINATION_REASONS[reasonKey]?.label || "Chấm dứt hợp đồng"}
            </span>
            <Row label="Tiền cọc đang giữ" value={s.heldDeposit} sign="+" good />
            <Row label="Nợ hóa đơn cũ chưa thanh toán" value={s.outstandingDebt} />
            <Row label="Tiền phòng những ngày chưa có hóa đơn" value={s.roomAmount} />
            <Row label="Tiền điện cuối kỳ" value={s.electricAmount} />
            <Row label="Tiền nước cuối kỳ" value={s.waterAmount} />
            <Row label="Phí dịch vụ những ngày chưa có hóa đơn" value={s.serviceAmount} />
            <Row label="Đền bù hư hỏng & khấu trừ" value={s.deductionAmount} />
            <Row label="Giữ lại tiền cọc do vi phạm hợp đồng" value={s.forfeitedDeposit} />
            <div className="settlement-calc-row is-total">
              <span>Tổng phải thanh toán</span>
              <strong>{money(s.totalCharges)}</strong>
            </div>
            <div className="settlement-calc-row">
              <span>Đã cấn từ tiền cọc</span>
              <strong>{money(s.depositAppliedAmount)}</strong>
            </div>

            {remainingDue > 0 ? (
              <div className="settlement-final-highlight debt">
                <span>Khách còn phải trả thêm</span>
                <span style={{ fontSize: 18 }}>{money(remainingDue)}</span>
              </div>
            ) : refund > 0 ? (
              <div className="settlement-final-highlight refund">
                <span>Chủ trọ hoàn lại tiền cọc cho khách</span>
                <span style={{ fontSize: 18 }}>{money(refund)}</span>
              </div>
            ) : (
              <div className="settlement-final-highlight refund">
                <span>Đã cân bằng: không ai phải trả thêm</span>
                <span>{money(0)}</span>
              </div>
            )}
          </div>

          {remainingDue > 0 && (
            <div className="settlement-due-box">
              <strong>Thu phần còn thiếu trước khi thanh lý</strong>
              <p>
                Khách chuyển khoản theo mã VietQR trên hóa đơn (hệ thống tự gạch nợ), hoặc thu tiền mặt tại đây. Sau
                đó bấm Cập nhật số dư.
              </p>
              {result.invoices
                .filter((inv) => inv.remainingAmount > 0)
                .map((inv) => (
                  <div key={inv._id} className="settlement-due-row">
                    <span>
                      {inv.invoiceType === "SETTLEMENT" ? "Hóa đơn quyết toán" : `Hóa đơn kỳ ${inv.billingPeriod}`}{" "}
                      <strong>{inv.invoiceCode}</strong> · còn thiếu{" "}
                      <strong style={{ color: "#b91c1c" }}>{money(inv.remainingAmount)}</strong>
                    </span>
                    <button
                      type="button"
                      className="contracts-btn-primary"
                      style={{ padding: "4px 10px", fontSize: 12 }}
                      onClick={() => payCash(inv._id, inv.remainingAmount)}
                      disabled={payingInvoiceId === inv._id || busy}
                    >
                      <Banknote size={13} />
                      <span>Thu tiền mặt</span>
                    </button>
                  </div>
                ))}
            </div>
          )}

          {remainingDue === 0 && refund > 0 && (
            <div className="settlement-section">
              <h4 className="settlement-section-title">Ghi nhận hoàn cọc cho khách</h4>
              <p className="settlement-section-sub">
                Hoàn {money(refund)} cho khách rồi ghi lại hình thức đã hoàn. Thông tin này lưu vào biên bản thanh
                lý.
              </p>
              <div className="form-grid-2col">
                <SelectField
                  label="Hình thức đã hoàn"
                  value={refundMethod}
                  onChange={(e) => setRefundMethod(e.target.value)}
                  required
                >
                  <option value="">-- Chọn --</option>
                  {Object.entries(REFUND_METHODS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </SelectField>
                <Field
                  label="Ghi chú (mã giao dịch, người nhận...)"
                  value={refundNote}
                  onChange={(e) => setRefundNote(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="settlement-footer">
            <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
              Đóng
            </Button>
            <div className="settlement-footer-actions">
              <Button type="button" variant="secondary" onClick={() => load({})} disabled={busy}>
                <RefreshCw size={14} />
                <span>Cập nhật số dư</span>
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={finish}
                disabled={remainingDue > 0 || (refund > 0 && !refundMethod)}
                title={
                  remainingDue > 0
                    ? "Thu đủ phần khách còn thiếu trước"
                    : refund > 0 && !refundMethod
                      ? "Chọn hình thức đã hoàn cọc"
                      : undefined
                }
                busy={busy}
              >
                <CheckCircle2 size={16} />
                <span>Thanh lý hợp đồng & nhận lại phòng</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// One line of the settlement breakdown; zero lines are hidden except the deposit.
function Row({ label, value = 0, sign = "-", good = false }) {
  if (!value && !good) return null;
  return (
    <div className="settlement-calc-row">
      <span>{label}</span>
      <strong style={{ color: good ? "#065f46" : "#b91c1c" }}>
        {sign} {money(value)}
      </strong>
    </div>
  );
}
