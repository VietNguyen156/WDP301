import { useState, useEffect } from "react";
import {
  Printer,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Banknote,
  FileCheck2,
  ShieldCheck,
  CreditCard,
  Phone,
  Mail,
  Home,
  Clock,
  Zap,
  Droplets,
  AlertTriangle,
  Receipt,
  FileText,
  BadgePercent,
  Plus,
} from "lucide-react";
import { contractApi, paymentApi, errorMessage } from "../../services/api";
import { useResource } from "../../hooks/useResource";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import {
  Button,
  Field,
  Modal,
  FormError,
  LoadingState,
  ErrorState,
} from "../../components/ui";
import { date, money, labels, today } from "../../utils/format";
import "./Contracts.css";

export default function ContractDetail({ id, onClose, onSaved }) {
  const resource = useResource(() => contractApi.get(id), [id]);
  const [settling, setSettling] = useState(false);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const c = resource.data;
  const isLandlord = user?.role === "LANDLORD";

  return (
    <Modal
      title={settling ? "Quyết toán & Thanh lý hợp đồng thuê phòng" : "Hồ sơ Hợp đồng Thuê phòng"}
      subtitle={c ? `${c.contractCode} · Phòng ${c.roomId?.roomNumber || ""} (${c.branchId?.name || ""})` : "Chi tiết hợp đồng"}
      onClose={onClose}
      busy={saving}
      maxWidth="840px"
    >
      {resource.loading ? (
        <LoadingState message="Đang tải dữ liệu hồ sơ hợp đồng..." />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : settling ? (
        <SettlementWorkflow
          contract={c}
          onCancel={() => setSettling(false)}
          onSaved={onSaved}
          onBusyChange={setSaving}
        />
      ) : (
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Header Summary Banner */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--contracts-primary)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                HỢP ĐỒNG THUÊ PHÒNG NỘI BỘ
              </span>
              <h2 style={{ fontFamily: "var(--font-heading, 'Plus Jakarta Sans')", fontSize: 20, fontWeight: 700, margin: "2px 0 4px", color: "var(--contracts-on-surface)" }}>
                Phòng {c.roomId?.roomNumber || "—"} · {c.branchId?.name || "—"}
              </h2>
              <span style={{ fontSize: 12, color: "#64748b", fontFamily: "monospace" }}>
                Mã HĐ: <strong>{c.contractCode}</strong> · Ký ngày: {date(c.createdAt)}
              </span>
            </div>

            <div>
              {c.displayStatus === "ACTIVE" ? (
                <span className="status-pill-dual active">
                  <span className="dot" /> Hiệu lực
                </span>
              ) : c.displayStatus === "EXPIRING_SOON" ? (
                <span className="status-pill-dual expiring">
                  <span className="dot" /> Sắp hết hạn (30 ngày)
                </span>
              ) : c.displayStatus === "EXPIRED" ? (
                <span className="status-pill-dual expired">
                  <span className="dot" /> Quá hạn chưa ký lại
                </span>
              ) : (
                <span className="status-pill-dual terminated">
                  <span className="dot" /> Đã thanh lý
                </span>
              )}
            </div>
          </div>

          {/* Section 1: Đại diện thuê & Thời hạn (Bento 2-Col) */}
          <div className="form-grid-2col">
            {/* Đại diện thuê */}
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#475569", display: "block", marginBottom: 8 }}>
                Khách thuê đại diện
              </span>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div className="tenant-avatar-chip" style={{ width: 44, height: 44, fontSize: 15 }}>
                  {c.tenantId?.name?.slice(0, 2).toUpperCase() || "KT"}
                </div>
                <div>
                  <strong style={{ fontSize: 15, color: "var(--contracts-on-surface)" }}>
                    {c.tenantId?.name || "Khách thuê"}
                  </strong>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                    CCCD: <strong style={{ fontFamily: "monospace" }}>{c.tenantId?.citizenId || "—"}</strong>
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    SĐT: {c.tenantId?.phoneNumber || "Chưa có SĐT"}
                  </div>
                </div>
              </div>
              {c.tenantId?.hometown && (
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 8, paddingTop: 6, borderTop: "1px dashed #f1f5f9" }}>
                  Quê quán / HK: <strong>{c.tenantId.hometown}</strong>
                </div>
              )}
            </div>

            {/* Thời hạn thuê */}
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#475569", display: "block", marginBottom: 8 }}>
                Thời hạn hợp đồng
              </span>
              <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                <div>
                  Bắt đầu: <strong>{date(c.startDate)}</strong>
                </div>
                <div>
                  Kết thúc: <strong>{date(c.endDate)}</strong>
                </div>
                {c.actualEndDate && (
                  <div style={{ color: "#b45309" }}>
                    Ngày trả phòng thực tế: <strong>{date(c.actualEndDate)}</strong>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Tài chính & Tiền cọc */}
          <div className="form-grid-3col">
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 }}>
              <span style={{ fontSize: 11.5, color: "#64748b", display: "block" }}>Giá thuê thỏa thuận:</span>
              <div style={{ fontFamily: "var(--font-heading)", fontSize: 18, fontWeight: 700, color: "var(--contracts-on-surface)", marginTop: 4 }}>
                {money(c.rentalPrice)}
              </div>
              <span style={{ fontSize: 11, color: "#64748b" }}>Thu kỳ đầu tháng</span>
            </div>

            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: 12 }}>
              <span style={{ fontSize: 11.5, color: "#166534", display: "block" }}>Tiền cọc đảm bảo:</span>
              <div style={{ fontFamily: "var(--font-heading)", fontSize: 18, fontWeight: 700, color: "#065f46", marginTop: 4 }}>
                {money(c.depositAmount)}
              </div>
              <span style={{ fontSize: 11, color: "#059669" }}>
                {labels[c.depositStatus] || "Đã thu đủ"}
              </span>
            </div>

            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 }}>
              <span style={{ fontSize: 11.5, color: "#64748b", display: "block" }}>Chỉ số bàn giao ban đầu:</span>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--contracts-on-surface)", marginTop: 4 }}>
                ⚡ {c.initialElectricIndex} kWh · 💧 {c.initialWaterIndex} m³
              </div>
              <span style={{ fontSize: 11, color: "#64748b" }}>Được ghi nhận tại ngày ký</span>
            </div>
          </div>

          {/* Section 3: Dịch vụ số lượng & Thành viên ở cùng */}
          {c.serviceQuantities && Object.keys(c.serviceQuantities).length > 0 && (
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#475569", display: "block", marginBottom: 6 }}>
                Dịch vụ theo số lượng (PER_UNIT)
              </span>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {Object.entries(c.serviceQuantities).map(([k, v]) => (
                  <span
                    key={k}
                    style={{
                      background: "#f1f5f9",
                      padding: "4px 10px",
                      borderRadius: 6,
                      fontSize: 12,
                      fontFamily: "monospace",
                      border: "1px solid #cbd5e1",
                    }}
                  >
                    {k}: <strong>{v}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Người ở cùng */}
          {c.roommates && c.roommates.length > 0 && (
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#475569", display: "block", marginBottom: 8 }}>
                Thành viên ở cùng ({c.roommates.length} người)
              </span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {c.roommates.map((r, i) => (
                  <div key={i} style={{ padding: "6px 10px", background: "#f8fafc", borderRadius: 6, fontSize: 12, border: "1px solid #f1f5f9" }}>
                    <strong>{r.fullName}</strong>
                    <div style={{ fontSize: 11, color: "#64748b" }}>
                      CCCD: {r.citizenId || "—"} · SĐT: {r.phoneNumber || "—"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ghi chú */}
          {c.notes && (
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 12, fontSize: 12.5, color: "#475569" }}>
              <strong>Ghi chú:</strong> {c.notes}
            </div>
          )}

          {/* Biên bản quyết toán nếu đã PREPARED hoặc TERMINATED */}
          {c.settlement?.state === "PREPARED" && c.status !== "TERMINATED" && (
            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: 14 }}>
              <h4 style={{ color: "#b45309", margin: "0 0 4px" }}>
                Biên bản quyết toán đang được lập (Chưa hoàn tất thanh lý)
              </h4>
              <p style={{ fontSize: 12.5, color: "#92400e", margin: "0 0 10px" }}>
                Hợp đồng đã lập phiếu quyết toán và cấn trừ tiền cọc. Vui lòng hoàn tất thu nợ hoặc hoàn tiền cọc để thanh lý phòng.
              </p>
              {isLandlord && (
                <Button onClick={() => setSettling(true)}>
                  Tiếp tục Quyết toán & Thanh lý phòng
                </Button>
              )}
            </div>
          )}

          {c.status === "TERMINATED" && (
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
              <h4 style={{ color: "#334155", margin: "0 0 8px" }}>
                Biên bản Quyết toán Hoàn tất · Ngày {date(c.actualEndDate)}
              </h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12.5 }}>
                <div>Tiền điện cuối kỳ: <strong>{money(c.settlement?.electricAmount)}</strong></div>
                <div>Tiền nước cuối kỳ: <strong>{money(c.settlement?.waterAmount)}</strong></div>
                <div>Khấu trừ vật tư hư hại: <strong>{money(c.settlement?.deductionAmount)}</strong></div>
                <div style={{ color: "#059669" }}>
                  Tiền cọc hoàn trả: <strong>{money(c.refundedDepositAmount || c.settlement?.refundedDepositAmount)}</strong>
                </div>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 14, borderTop: "1px solid #e2e8f0" }}>
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer size={15} />
              <span>In bản Hợp đồng (PDF)</span>
            </Button>

            <div style={{ display: "flex", gap: 8 }}>
              {isLandlord && ["ACTIVE", "EXPIRING_SOON", "EXPIRED"].includes(c.status) && (
                <Button variant="danger" onClick={() => setSettling(true)}>
                  <span>Quyết toán & Thanh lý Hợp đồng</span>
                </Button>
              )}
              <Button variant="secondary" onClick={onClose}>
                Đóng
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function SettlementWorkflow({ contract, onCancel, onSaved, onBusyChange }) {
  const toast = useToast();

  const [body, setBody] = useState({
    actualEndDate: today(),
    finalElectricIndex: contract.roomId?.currentElectricIndex || contract.initialElectricIndex,
    finalWaterIndex: contract.roomId?.currentWaterIndex || contract.initialWaterIndex,
    electricImage: "",
    waterImage: "",
    deductions: [],
    settlementNotes: "Biên bản trả phòng và nghiệm thu vật tư đã được hai bên kiểm tra và xác nhận.",
    confirmedByBothParties: true,
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [settlementData, setSettlementData] = useState(null);
  const [settlementInvoices, setSettlementInvoices] = useState([]);
  const [payingInvoiceId, setPayingInvoiceId] = useState(null);

  useEffect(() => {
    if (contract.settlement?.state === "PREPARED") {
      fetchExistingSettlement();
    }
  }, [contract._id]);

  async function fetchExistingSettlement() {
    setBusy(true);
    onBusyChange(true);
    try {
      const res = await contractApi.settlement(contract._id, {});
      if (res?.settlement) {
        setSettlementData(res.settlement);
        setSettlementInvoices(res.settlementInvoices || []);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  }

  const change = (key) => (e) =>
    setBody({
      ...body,
      [key]: e.target.type === "number" ? Number(e.target.value) : e.target.value,
    });

  async function handleCreateSettlement(e) {
    e.preventDefault();
    setBusy(true);
    onBusyChange(true);
    setError("");

    if (!body.confirmedByBothParties) {
      setError("Vui lòng xác nhận biên bản trả phòng giữa hai bên.");
      setBusy(false);
      onBusyChange(false);
      return;
    }

    try {
      const res = await contractApi.settlement(contract._id, body);
      toast.success("Đã lập phiếu quyết toán và cấn trừ tiền cọc!");
      setSettlementData(res.settlement);
      setSettlementInvoices(res.settlementInvoices || []);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  }

  async function handleRefreshBalance() {
    setBusy(true);
    onBusyChange(true);
    setError("");
    try {
      const res = await contractApi.settlement(contract._id, {});
      if (res?.settlement) {
        setSettlementData(res.settlement);
        setSettlementInvoices(res.settlementInvoices || []);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  }

  async function handlePayCash(invoiceId, amount) {
    setPayingInvoiceId(invoiceId);
    setError("");
    try {
      await paymentApi.payCash({
        invoiceId,
        amount,
        paidAt: today(),
        notes: `Thu tiền mặt quyết toán thanh lý hợp đồng ${contract.contractCode}`,
      });
      toast.success("Đã ghi nhận thanh toán tiền mặt thành công!");
      await handleRefreshBalance();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPayingInvoiceId(null);
    }
  }

  async function handleFinalTerminate() {
    setBusy(true);
    onBusyChange(true);
    setError("");
    try {
      await contractApi.terminate(contract._id, {});
      toast.success(
        `Đã hoàn tất thanh lý hợp đồng ${contract.contractCode}. Phòng chuyển sang Dọn dẹp (CLEANING).`
      );
      onSaved?.();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  }

  function addDeduction() {
    setBody({
      ...body,
      deductions: [...body.deductions, { reason: "", amount: 0, evidenceImage: "" }],
    });
  }

  function updateDeduction(index, key, val) {
    const list = [...body.deductions];
    list[index][key] = key === "amount" ? Number(val) : val;
    setBody({ ...body, deductions: list });
  }

  function removeDeduction(index) {
    const list = body.deductions.filter((_, i) => i !== index);
    setBody({ ...body, deductions: list });
  }

  return (
    <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
      {error && <FormError message={error} />}

      {/* Settlement Formula Banner (PROJECT_RULES Section 11) */}
      <div style={{ padding: "12px 14px", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 12.5, color: "#334155" }}>
        <strong>Công thức quyết toán tiền cọc minh bạch:</strong>
        <div style={{ fontFamily: "monospace", margin: "4px 0", color: "var(--contracts-primary)", fontWeight: 700 }}>
          Tiền cọc hoàn trả = Tiền cọc - (Nợ cũ + Điện nước cuối kỳ + Phí hư hại vật tư)
        </div>
        Phòng sẽ tự động chuyển trạng thái Cần dọn dẹp (<code>CLEANING</code>) sau khi thanh lý.
      </div>

      {!settlementData ? (
        <form onSubmit={handleCreateSettlement} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Ngày trả phòng & Chỉ số cuối */}
          <div className="form-grid-3col">
            <Field
              label="Ngày trả phòng thực tế"
              type="date"
              value={body.actualEndDate}
              onChange={change("actualEndDate")}
              required
            />
            <Field
              label={`Điện cuối kỳ (>= ${contract.initialElectricIndex})`}
              type="number"
              value={body.finalElectricIndex}
              onChange={change("finalElectricIndex")}
              required
            />
            <Field
              label={`Nước cuối kỳ (>= ${contract.initialWaterIndex})`}
              type="number"
              value={body.finalWaterIndex}
              onChange={change("finalWaterIndex")}
              required
            />
          </div>

          {/* Nghiệm thu vật tư / Hư hại */}
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div>
                <strong style={{ fontSize: 13, color: "var(--contracts-on-surface)" }}>
                  Khấu trừ Hư hại Vật tư / Bồi thường ({body.deductions.length} mục)
                </strong>
                <span style={{ fontSize: 11, color: "#64748b", display: "block" }}>
                  Ghi nhận các hư hại thiết bị phát sinh trong quá trình ở
                </span>
              </div>
              <button type="button" className="contracts-btn-outline" onClick={addDeduction}>
                <Plus size={13} />
                <span>+ Thêm mục trừ</span>
              </button>
            </div>

            {body.deductions.map((d, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 28px", gap: 8, alignItems: "center", marginTop: 6 }}>
                <input
                  type="text"
                  className="contracts-search-input"
                  style={{ paddingLeft: 10, fontSize: 12 }}
                  placeholder="Lý do (Vd: Vỡ gương phòng tắm, mất thẻ từ...)"
                  value={d.reason}
                  onChange={(e) => updateDeduction(i, "reason", e.target.value)}
                  required
                />
                <input
                  type="number"
                  min="0"
                  className="contracts-search-input"
                  style={{ paddingLeft: 10, fontSize: 12 }}
                  placeholder="Số tiền (đ)"
                  value={d.amount}
                  onChange={(e) => updateDeduction(i, "amount", e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="contracts-action-btn"
                  onClick={() => removeDeduction(i)}
                  title="Xóa mục"
                >
                  <Trash2 size={13} color="#dc2626" />
                </button>
              </div>
            ))}
          </div>

          {/* Ghi chú & Xác nhận */}
          <Field
            label="Ghi chú biên bản bàn giao & nghiệm thu"
            as="textarea"
            rows={2}
            value={body.settlementNotes}
            onChange={change("settlementNotes")}
          />

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={body.confirmedByBothParties}
              onChange={(e) => setBody({ ...body, confirmedByBothParties: e.target.checked })}
            />
            <span>Hai bên (Chủ trọ và Khách thuê) đã cùng kiểm tra hiện trường và đồng thuận các chỉ số trên.</span>
          </label>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTop: "1px solid #e2e8f0" }}>
            <Button variant="secondary" onClick={onCancel} disabled={busy}>
              Quay lại
            </Button>
            <Button type="submit" busy={busy}>
              <span>Lập Phiếu Quyết toán & Cấn Trừ Cọc</span>
              <ArrowRight size={15} />
            </Button>
          </div>
        </form>
      ) : (
        /* Kết quả Quyết toán & Các bước thanh lý */
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="settlement-card-box">
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--contracts-on-surface)", display: "block", marginBottom: 8 }}>
              Chi tiết Cấn trừ Tài chính (Settlement Balance)
            </span>

            <div className="settlement-calc-row">
              <span>Tiền cọc hợp đồng ban đầu:</span>
              <strong style={{ color: "#065f46" }}>+ {money(settlementData.initialDeposit || contract.depositAmount)}</strong>
            </div>

            <div className="settlement-calc-row">
              <span>Tiền điện cuối kỳ:</span>
              <strong style={{ color: "#b91c1c" }}>- {money(settlementData.electricAmount)}</strong>
            </div>

            <div className="settlement-calc-row">
              <span>Tiền nước cuối kỳ:</span>
              <strong style={{ color: "#b91c1c" }}>- {money(settlementData.waterAmount)}</strong>
            </div>

            {settlementData.deductionAmount > 0 && (
              <div className="settlement-calc-row">
                <span>Khấu trừ hư hại thiết bị:</span>
                <strong style={{ color: "#b91c1c" }}>- {money(settlementData.deductionAmount)}</strong>
              </div>
            )}

            {settlementData.unpaidInvoicesTotal > 0 && (
              <div className="settlement-calc-row">
                <span>Nợ hóa đơn cũ chưa đóng:</span>
                <strong style={{ color: "#b91c1c" }}>- {money(settlementData.unpaidInvoicesTotal)}</strong>
              </div>
            )}

            {/* Final Outcome */}
            {settlementData.refundedDepositAmount > 0 ? (
              <div className="settlement-final-highlight refund">
                <span>Chủ trọ hoàn trả lại tiền cọc thừa cho khách:</span>
                <span style={{ fontSize: 18 }}>{money(settlementData.refundedDepositAmount)}</span>
              </div>
            ) : settlementData.remainingDebtAmount > 0 ? (
              <div className="settlement-final-highlight debt">
                <span>Khách thuê còn thiếu (Cần thanh toán thêm):</span>
                <span style={{ fontSize: 18 }}>{money(settlementData.remainingDebtAmount)}</span>
              </div>
            ) : (
              <div className="settlement-final-highlight refund">
                <span>Số dư quyết toán đã cân bằng (0 đ)</span>
                <span>0 đ</span>
              </div>
            )}
          </div>

          {/* Hóa đơn phát sinh cần thanh toán nếu có nợ */}
          {settlementInvoices.length > 0 && settlementData.remainingDebtAmount > 0 && (
            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: 12 }}>
              <strong style={{ fontSize: 13, color: "#b45309", display: "block", marginBottom: 6 }}>
                Hóa đơn quyết toán cần thu trước khi thanh lý:
              </strong>
              {settlementInvoices.map((inv) => (
                <div key={inv._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px dashed #fef3c7", fontSize: 12.5 }}>
                  <div>
                    <span>Mã: <strong>{inv.invoiceCode}</strong> · Còn thiếu: <strong style={{ color: "#b91c1c" }}>{money(inv.remainingAmount)}</strong></span>
                  </div>
                  <button
                    type="button"
                    className="contracts-btn-primary"
                    style={{ padding: "4px 10px", fontSize: 12 }}
                    onClick={() => handlePayCash(inv._id, inv.remainingAmount)}
                    disabled={payingInvoiceId === inv._id}
                  >
                    <Banknote size={13} />
                    <span>Thu tiền mặt</span>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Bottom Actions */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTop: "1px solid #e2e8f0" }}>
            <Button variant="secondary" onClick={onCancel} disabled={busy}>
              Đóng
            </Button>

            <div style={{ display: "flex", gap: 10 }}>
              <Button variant="secondary" onClick={handleRefreshBalance} disabled={busy}>
                <RefreshCw size={14} />
                <span>Cập nhật số dư</span>
              </Button>

              <Button
                variant="danger"
                onClick={handleFinalTerminate}
                disabled={settlementData.remainingDebtAmount > 0}
                busy={busy}
              >
                <CheckCircle2 size={16} />
                <span>Xác nhận Thanh lý Hợp đồng & Bàn giao Phòng</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
