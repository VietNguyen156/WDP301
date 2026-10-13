import { useState } from "react";
import { Plus, Printer, Trash2 } from "lucide-react";
import { contractApi, errorMessage } from "../../services/api";
import { useResource } from "../../hooks/useResource";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import {
  Badge,
  Button,
  Field,
  Modal,
  FormError,
  LoadingState,
  ErrorState,
} from "../../components/ui";
import { date, money, labels, today } from "../../utils/format";
export default function ContractDetail({ id, onClose, onSaved }) {
  const resource = useResource(() => contractApi.get(id), [id]);
  const [settling, setSettling] = useState(false);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const c = resource.data;
  return (
    <Modal
      title={settling ? "Thanh lý & quyết toán" : "Chi tiết hợp đồng"}
      subtitle={c?.contractCode}
      onClose={onClose}
      busy={saving}
      wide
    >
      {resource.loading ? (
        <LoadingState />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : settling ? (
        <SettlementForm
          contract={c}
          onCancel={() => setSettling(false)}
          onSaved={onSaved}
          onBusyChange={setSaving}
        />
      ) : (
        <>
          <div className="contract-document">
            <div className="document-title">
              <div>
                <span>HỢP ĐỒNG THUÊ PHÒNG</span>
                <h2>{c.roomId?.roomNumber || "Phòng đã lưu trữ"}</h2>
                <p>{c.branchId?.name || "Cơ sở đã lưu trữ"}</p>
              </div>
              <Badge status={c.displayStatus} />
            </div>
            <div className="detail-grid">
              <div>
                <h3>Người đại diện</h3>
                <strong>{c.tenantId?.name || "Khách đã lưu trữ"}</strong>
                <p>{c.tenantId?.email}</p>
                <p>{c.tenantId?.phoneNumber}</p>
                <p>CCCD: {c.tenantId?.citizenId || "—"}</p>
                <p>Quê quán: {c.tenantId?.hometown || "—"}</p>
              </div>
              <div>
                <h3>Thời hạn thuê</h3>
                <strong>
                  {date(c.startDate)} — {date(c.endDate)}
                </strong>
                <p>Mã hợp đồng: {c.contractCode}</p>
                <p>Ngày ký: {date(c.createdAt)}</p>
              </div>
            </div>
            <div className="detail-grid">
              <div>
                <h3>Giá thuê hàng tháng</h3>
                <strong className="large-number">{money(c.rentalPrice)}</strong>
              </div>
              <div>
                <h3>Tiền cọc</h3>
                <strong className="large-number">
                  {money(c.depositAmount)}
                </strong>
                <p>{labels[c.depositStatus]}</p>
              </div>
            </div>
            <div className="detail-grid">
              <div>
                <h3>Chỉ số điện ban đầu</h3>
                <strong>{c.initialElectricIndex} kWh</strong>
              </div>
              <div>
                <h3>Chỉ số nước ban đầu</h3>
                <strong>{c.initialWaterIndex} m³</strong>
              </div>
            </div>
            {c.roommates.length > 0 && (
              <div className="detail-section">
                <h3>Người ở cùng</h3>
                {c.roommates.map((r, i) => (
                  <p key={i}>
                    {r.fullName} · {r.phoneNumber || "Chưa có SĐT"} ·{" "}
                    {r.citizenId || "Chưa có CCCD"}
                  </p>
                ))}
              </div>
            )}
            {c.notes && (
              <div className="detail-section">
                <h3>Ghi chú</h3>
                <p>{c.notes}</p>
              </div>
            )}
            {c.status === "TERMINATED" && (
              <div className="settlement-summary">
                <h3>Biên bản quyết toán · {date(c.actualEndDate)}</h3>
                <p>
                  Tiền điện cuối kỳ{" "}
                  <strong>{money(c.settlement?.electricAmount)}</strong>
                </p>
                <p>
                  Tiền nước cuối kỳ{" "}
                  <strong>{money(c.settlement?.waterAmount)}</strong>
                </p>
                <p>
                  Khấu trừ vật tư{" "}
                  <strong>{money(c.settlement?.deductionAmount)}</strong>
                </p>
                <p>
                  Tiền cọc hoàn trả{" "}
                  <strong>{money(c.refundedDepositAmount)}</strong>
                </p>
                {c.deductions?.map((d, i) => (
                  <p key={i}>
                    {d.reason}: {money(d.amount)}{" "}
                    <a
                      className="text-link"
                      href={d.evidenceImage}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Ảnh nghiệm thu
                    </a>
                  </p>
                ))}
                <p>{c.settlementNotes}</p>
              </div>
            )}
          </div>
          <footer className="modal-footer">
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer size={16} />
              In hợp đồng
            </Button>
            {user.role === "LANDLORD" &&
              ["ACTIVE", "EXPIRING_SOON", "EXPIRED"].includes(c.status) && (
                <Button variant="danger" onClick={() => setSettling(true)}>
                  Thanh lý hợp đồng
                </Button>
              )}
          </footer>
        </>
      )}
    </Modal>
  );
}
function SettlementForm({ contract, onCancel, onSaved, onBusyChange }) {
  const toast = useToast();
  const [body, setBody] = useState({
    actualEndDate: today(),
    finalElectricIndex:
      contract.roomId?.currentElectricIndex || contract.initialElectricIndex,
    finalWaterIndex:
      contract.roomId?.currentWaterIndex || contract.initialWaterIndex,
    electricImage: "",
    waterImage: "",
    deductions: [],
    settlementNotes: "",
    confirmedByBothParties: false,
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const electricity =
    Math.max(
      0,
      body.finalElectricIndex -
        (contract.roomId?.currentElectricIndex ??
          contract.initialElectricIndex),
    ) * (contract.branchId?.defaultElectricityPrice || 0);
  const water =
    contract.branchId?.waterBillingType === "METER"
      ? Math.max(
          0,
          body.finalWaterIndex -
            (contract.roomId?.currentWaterIndex ?? contract.initialWaterIndex),
        ) * (contract.branchId?.defaultWaterPrice || 0)
      : 0;
  const damages = body.deductions.reduce((sum, item) => sum + item.amount, 0);
  const deposit =
    contract.depositStatus === "PAID" ? contract.depositAmount : 0;
  const balance = deposit - electricity - water - damages;
  const change = (key) => (e) =>
    setBody({
      ...body,
      [key]:
        e.target.type === "number" ? Number(e.target.value) : e.target.value,
    });
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    onBusyChange(true);
    setError("");
    try {
      await contractApi.terminate(contract._id, body);
      toast("Đã lưu biên bản thanh lý. Phòng chuyển sang cần dọn dẹp.");
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <fieldset disabled={busy}>
        <div className="info-panel">
          <strong>
            Cọc hợp đồng: {money(contract.depositAmount)} ·{" "}
            {labels[contract.depositStatus]}
          </strong>
          <p>
            Hãy quyết toán các hóa đơn còn mở trước khi thanh lý. Điện nước chưa
            chốt và hư hại được trừ vào cọc đã nhận. Phí nước khoán/đầu người
            cần chốt ở hóa đơn cuối kỳ.
          </p>
        </div>
        <div className="form-section form-grid">
          <Field
            label="Ngày trả phòng"
            type="date"
            min={contract.startDate.slice(0, 10)}
            max={today()}
            required
            value={body.actualEndDate}
            onChange={change("actualEndDate")}
          />
          <div />
          <Field
            label="Chỉ số điện cuối"
            type="number"
            min={contract.roomId?.currentElectricIndex || 0}
            required
            value={body.finalElectricIndex}
            onChange={change("finalElectricIndex")}
          />
          <Field
            label="Chỉ số nước cuối"
            type="number"
            min={contract.roomId?.currentWaterIndex || 0}
            required
            value={body.finalWaterIndex}
            onChange={change("finalWaterIndex")}
          />
          <Field
            label="Link ảnh đồng hồ điện"
            type="url"
            required
            placeholder="https://…"
            value={body.electricImage}
            onChange={change("electricImage")}
          />
          <Field
            label="Link ảnh đồng hồ nước"
            type="url"
            required
            placeholder="https://…"
            value={body.waterImage}
            onChange={change("waterImage")}
          />
        </div>
        <div className="form-section">
          <div className="section-heading">
            <h3>Khấu trừ hư hại vật tư</h3>
            <Button
              variant="text"
              type="button"
              onClick={() =>
                setBody({
                  ...body,
                  deductions: [
                    ...body.deductions,
                    { reason: "", amount: 0, evidenceImage: "" },
                  ],
                })
              }
            >
              <Plus size={16} />
              Thêm khoản
            </Button>
          </div>
          {body.deductions.map((d, index) => (
            <div className="service-row" key={index}>
              {[
                ["reason", "Lý do", "text"],
                ["amount", "Số tiền (₫)", "number"],
                ["evidenceImage", "Link ảnh", "url"],
              ].map(([key, label, type]) => (
                <Field
                  key={key}
                  label={label}
                  type={type}
                  required
                  min={type === "number" ? 0 : undefined}
                  value={d[key]}
                  onChange={(e) =>
                    setBody({
                      ...body,
                      deductions: body.deductions.map((item, i) =>
                        i === index
                          ? {
                              ...item,
                              [key]:
                                type === "number"
                                  ? Number(e.target.value)
                                  : e.target.value,
                            }
                          : item,
                      ),
                    })
                  }
                />
              ))}
              <button
                type="button"
                className="icon-button danger-text"
                aria-label="Xóa khoản khấu trừ"
                onClick={() =>
                  setBody({
                    ...body,
                    deductions: body.deductions.filter((_, i) => i !== index),
                  })
                }
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <Field label="Ghi chú nghiệm thu">
            <textarea
              value={body.settlementNotes}
              onChange={change("settlementNotes")}
              rows={3}
            />
          </Field>
          <div className="settlement-summary">
            <h3>Dự tính quyết toán</h3>
            <p>
              Cọc đã nhận <strong>{money(deposit)}</strong>
            </p>
            <p>
              Điện cuối kỳ <strong>{money(electricity)}</strong>
            </p>
            <p>
              Nước cuối kỳ <strong>{money(water)}</strong>
            </p>
            <p>
              Khấu trừ vật tư <strong>{money(damages)}</strong>
            </p>
            <p>
              {balance >= 0 ? "Dự kiến hoàn khách" : "Cần quyết toán thêm"}{" "}
              <strong>{money(Math.abs(balance))}</strong>
            </p>
            <small>
              Số tiền cuối cùng được máy chủ kiểm tra khi xác nhận. Hóa đơn còn
              mở phải được quyết toán trước.
            </small>
          </div>
          <label className="checkbox-field">
            <input
              type="checkbox"
              required
              checked={body.confirmedByBothParties}
              onChange={(e) =>
                setBody({ ...body, confirmedByBothParties: e.target.checked })
              }
            />
            Tôi xác nhận chủ nhà và người thuê đã kiểm tra, đồng ý biên bản và
            việc hoàn cọc.
          </label>
        </div>
      </fieldset>
      <FormError error={error} />
      <footer className="modal-footer">
        <Button
          variant="secondary"
          type="button"
          disabled={busy}
          onClick={onCancel}
        >
          Quay lại
        </Button>
        <Button variant="danger" busy={busy}>
          Xác nhận thanh lý
        </Button>
      </footer>
    </form>
  );
}
