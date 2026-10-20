import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  Zap,
  Layers,
  QrCode,
  Plus,
  Trash2,
  Save,
  Check,
  ShieldCheck,
  Sparkles,
  Info,
  Calendar,
  CreditCard,
  AlertTriangle,
} from "lucide-react";
import { branchApi, profileApi, errorMessage } from "../../services/api";
import {
  Button,
  Field,
  SelectField,
  Modal,
  FormError,
} from "../../components/ui";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";

const initial = {
  name: "",
  totalFloors: 1,
  address: "",
  defaultElectricityPrice: 3500,
  waterBillingType: "METER",
  defaultWaterPrice: 30000,
  defaultServices: [
    { name: "Internet & Wifi cáp quang", price: 100000, billingType: "PER_ROOM" },
    { name: "Vệ sinh & Thu gom rác", price: 50000, billingType: "PER_PERSON" },
  ],
  billingCycleDay: 1,
  paymentDueDays: 5,
  status: "ACTIVE",
};

export default function BranchForm({ branch, onClose, onSaved }) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState("info"); // 'info' | 'pricing' | 'services' | 'vietqr'

  const [freshProfile, setFreshProfile] = useState(profile);
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    let active = true;
    if (user?.role === "LANDLORD") {
      setLoadingProfile(true);
      profileApi
        .get()
        .then((p) => {
          if (active && p) {
            setFreshProfile(p);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (active) setLoadingProfile(false);
        });
    }
    return () => {
      active = false;
    };
  }, [user?.role]);

  const [form, setForm] = useState(
    branch
      ? {
          ...initial,
          ...branch,
          address: branch.address?.fullAddress || "",
          defaultServices: (branch.defaultServices || []).map(
            ({ name, price, billingType }) => ({ name, price, billingType }),
          ),
        }
      : initial,
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const change = (key) => (e) =>
    setForm({
      ...form,
      [key]:
        e.target.type === "number" ? Number(e.target.value) : e.target.value,
    });

  // Quick Preset Adders for Services
  function handleAddPresetService(name, price, billingType) {
    const exists = form.defaultServices.some((s) => s.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      toast(`Dịch vụ "${name}" đã tồn tại trong danh sách`, "info");
      return;
    }
    setForm({
      ...form,
      defaultServices: [...form.defaultServices, { name, price, billingType }],
    });
    toast(`Đã thêm nhanh dịch vụ "${name}"`);
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");

    const body = Object.fromEntries(
      Object.keys(initial).map((key) => [key, form[key]]),
    );
    body.address = { fullAddress: form.address };

    try {
      if (branch) {
        await branchApi.update(branch._id, body);
        toast("Đã cập nhật cấu hình cơ sở thành công");
      } else {
        await branchApi.create(body);
        toast("Đã tạo cơ sở mới thành công vào hệ thống");
      }
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const hasBankAccount = Boolean(
    freshProfile?.hasBankAccount && freshProfile?.bankAccount?.accountNumber,
  );
  const bankAccount = freshProfile?.bankAccount;

  return (
    <Modal
      title={branch ? "Cấu hình Chi nhánh & Tòa nhà" : "Thêm Cơ sở / Tòa nhà mới"}
      subtitle={
        branch
          ? `Đang chỉnh sửa: ${branch.name}`
          : "Thiết lập thông số tòa nhà, biểu giá điện nước và thông tin thanh toán VietQR tự động."
      }
      onClose={onClose}
      busy={busy}
      wide
      closeOnBackdropClick={false}
    >
      {/* Stitch Tab Bar */}
      <nav className="stitch-form-tabs" aria-label="Cấu hình cơ sở">
        <button
          type="button"
          className={`stitch-form-tab ${activeTab === "info" ? "active" : ""}`}
          onClick={() => setActiveTab("info")}
        >
          <Building2 size={16} />
          <span>01. Thông tin Tòa nhà</span>
        </button>

        <button
          type="button"
          className={`stitch-form-tab ${activeTab === "pricing" ? "active" : ""}`}
          onClick={() => setActiveTab("pricing")}
        >
          <Zap size={16} />
          <span>02. Biểu giá &amp; Chu kỳ</span>
        </button>

        <button
          type="button"
          className={`stitch-form-tab ${activeTab === "services" ? "active" : ""}`}
          onClick={() => setActiveTab("services")}
        >
          <Layers size={16} />
          <span>03. Dịch vụ cố định ({form.defaultServices.length})</span>
        </button>

        <button
          type="button"
          className={`stitch-form-tab ${activeTab === "vietqr" ? "active" : ""}`}
          onClick={() => setActiveTab("vietqr")}
        >
          <QrCode size={16} />
          <span>04. VietQR &amp; SePay</span>
        </button>
      </nav>

      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <div style={{ overflowY: "auto", flex: 1, maxHeight: "calc(88vh - 165px)" }}>
          <fieldset disabled={busy} style={{ border: "none", padding: 0, margin: 0 }}>
            {/* ============================================================= */}
            {/* TAB 1: THÔNG TIN TÒA NHÀ                                     */}
            {/* ============================================================= */}
            {activeTab === "info" && (
              <div className="form-section">
                <h3>
                  <Building2 size={18} />
                  01. Thông tin Tòa nhà &amp; Cơ sở
                </h3>
                <div className="form-grid">
                  <div className="span-2">
                    <Field
                      label="Tên cơ sở / Tòa nhà"
                      required
                      value={form.name}
                      onChange={change("name")}
                      placeholder="Ví dụ: Tòa A1 - Domus Cầu Giấy"
                      hint="Đặt tên ngắn gọn, dễ phân biệt giữa các tòa nhà trong chuỗi."
                    />
                  </div>

                  <Field
                    label="Tổng số tầng"
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={form.totalFloors}
                    onChange={change("totalFloors")}
                    hint="Số tầng dùng để tự động phân nhóm sơ đồ phòng."
                  />

                  {branch ? (
                    <SelectField
                      label="Trạng thái vận hành"
                      value={form.status}
                      onChange={change("status")}
                    >
                      <option value="ACTIVE">Đang hoạt động (Kinh doanh)</option>
                      <option value="INACTIVE">Ngừng hoạt động (Tạm đóng)</option>
                    </SelectField>
                  ) : (
                    <div className="field">
                      <span>Phạm vi vận hành</span>
                      <div
                        style={{
                          height: "42px",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "0 12px",
                          borderRadius: "8px",
                          backgroundColor: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          fontSize: "13px",
                          color: "#475569",
                        }}
                      >
                        <ShieldCheck size={16} color="var(--primary, #005c55)" />
                        <span>Kích hoạt ngay khi tạo (Mặc định: ACTIVE)</span>
                      </div>
                    </div>
                  )}

                  <div className="span-2">
                    <Field
                      label="Địa chỉ chi tiết"
                      required
                      value={form.address}
                      onChange={change("address")}
                      placeholder="Ví dụ: Số 18 Ngõ 233 Xuân Thủy, Phường Dịch Vọng Hậu, Quận Cầu Giấy, Hà Nội"
                      hint="Địa chỉ in tự động trên bản hợp đồng thuê và hóa đơn gửi cho khách."
                    />
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "16px",
                    padding: "12px 14px",
                    borderRadius: "8px",
                    backgroundColor: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    fontSize: "13px",
                    color: "#166534",
                  }}
                >
                  <Sparkles size={18} color="#15803d" />
                  <span>
                    Sau khi lưu cơ sở, bạn có thể chuyển sang màn hình <strong>Phòng &amp; Căn hộ</strong> để sinh phòng tự động theo số tầng.
                  </span>
                </div>
              </div>
            )}

            {/* ============================================================= */}
            {/* TAB 2: BIỂU GIÁ ĐIỆN NƯỚC & KỲ THU HÓA ĐƠN                  */}
            {/* ============================================================= */}
            {activeTab === "pricing" && (
              <div className="form-section">
                <h3>
                  <Zap size={18} />
                  02. Biểu giá Điện Nước &amp; Chu kỳ thanh toán
                </h3>
                <div className="form-grid">
                  <div className="span-2">
                    <h4 style={{ margin: 0, fontSize: "13px", color: "#334155" }}>
                      Đơn giá và cách tính dịch vụ cơ bản
                    </h4>
                  </div>

                  <div className="span-2">
                    <Field
                      label="Giá điện (₫ / kWh)"
                      type="number"
                      min="0"
                      required
                      value={form.defaultElectricityPrice}
                      onChange={change("defaultElectricityPrice")}
                      hint="Đơn giá áp dụng khi chốt công tơ điện hàng tháng."
                    />
                  </div>

                  <SelectField
                    label="Hình thức tính tiền nước"
                    value={form.waterBillingType}
                    onChange={change("waterBillingType")}
                  >
                    <option value="METER">Theo đồng hồ nước (m³)</option>
                    <option value="PER_PERSON">Theo đầu người (/ người / tháng)</option>
                    <option value="FIXED">Khoán trọn gói (/ phòng / tháng)</option>
                  </SelectField>

                  <Field
                    label={
                      form.waterBillingType === "METER"
                        ? "Đơn giá nước (₫ / m³)"
                        : form.waterBillingType === "PER_PERSON"
                          ? "Đơn giá nước (₫ / người)"
                          : "Đơn giá nước khoán (₫ / phòng)"
                    }
                    type="number"
                    min="0"
                    required
                    value={form.defaultWaterPrice}
                    onChange={change("defaultWaterPrice")}
                  />

                  <div className="span-2">
                    <h4 style={{ margin: "8px 0 0", fontSize: "13px", color: "#334155" }}>
                      Chu kỳ chốt số và thanh toán
                    </h4>
                  </div>

                  <Field
                    label="Ngày chốt số hàng tháng"
                    type="number"
                    min="1"
                    max="28"
                    required
                    value={form.billingCycleDay}
                    onChange={change("billingCycleDay")}
                    hint="Ngày hệ thống nhắc chốt điện nước (từ ngày 1 đến 28)."
                  />

                  <div className="span-2">
                    <Field
                      label="Thời hạn thanh toán sau khi xuất hóa đơn (ngày)"
                      type="number"
                      min="1"
                      max="30"
                      required
                      value={form.paymentDueDays}
                      onChange={change("paymentDueDays")}
                      hint="Sau số ngày này, hóa đơn sẽ tự động chuyển trạng thái QUÁ HẠN và gửi cảnh báo."
                    />
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "16px",
                    padding: "12px 14px",
                    borderRadius: "8px",
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    fontSize: "12px",
                    color: "#64748b",
                    lineHeight: 1.5,
                  }}
                >
                  <Info size={16} color="var(--primary, #005c55)" style={{ flexShrink: 0, marginTop: "2px" }} />
                  <span>
                    Quy tắc tài chính: Biểu giá mới chỉ có hiệu lực với các hóa đơn lập sau thời điểm thay đổi.
                    Các hóa đơn đã phát hành trước đó hoàn toàn được bảo toàn dữ liệu.
                  </span>
                </div>
              </div>
            )}

            {/* ============================================================= */}
            {/* TAB 3: DỊCH VỤ CỐ ĐỊNH                                        */}
            {/* ============================================================= */}
            {activeTab === "services" && (
              <div className="form-section">
                <div className="section-heading">
                  <div>
                    <h3>
                      <Layers size={18} />
                      03. Dịch vụ cố định tòa nhà
                    </h3>
                    <p style={{ fontSize: "12px", color: "#64748b", margin: "2px 0 0" }}>
                      Các dịch vụ này sẽ tự động được cộng vào hóa đơn hàng tháng của từng phòng.
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      setForm({
                        ...form,
                        defaultServices: [
                          ...form.defaultServices,
                          { name: "", price: 0, billingType: "PER_ROOM" },
                        ],
                      })
                    }
                  >
                    <Plus size={16} />
                    <span>Thêm dịch vụ</span>
                  </Button>
                </div>

                {/* Quick Add Suggestions */}
                <div style={{ marginBottom: "12px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>
                    Gợi ý thêm nhanh dịch vụ phổ biến:
                  </span>
                  <div className="stitch-quick-service-chips">
                    <button
                      type="button"
                      className="stitch-service-chip"
                      onClick={() => handleAddPresetService("Internet cáp quang", 100000, "PER_ROOM")}
                    >
                      <Plus size={13} />
                      Internet (100.000₫/phòng)
                    </button>
                    <button
                      type="button"
                      className="stitch-service-chip"
                      onClick={() => handleAddPresetService("Vệ sinh môi trường", 40000, "PER_PERSON")}
                    >
                      <Plus size={13} />
                      Vệ sinh (40.000₫/người)
                    </button>
                    <button
                      type="button"
                      className="stitch-service-chip"
                      onClick={() => handleAddPresetService("Gửi xe máy", 100000, "PER_UNIT")}
                    >
                      <Plus size={13} />
                      Gửi xe máy (100.000₫/xe)
                    </button>
                    <button
                      type="button"
                      className="stitch-service-chip"
                      onClick={() => handleAddPresetService("Phí bảo trì thang máy", 50000, "PER_ROOM")}
                    >
                      <Plus size={13} />
                      Thang máy (50.000₫/phòng)
                    </button>
                  </div>
                </div>

                {form.defaultServices.length === 0 ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "24px 16px",
                      borderRadius: "8px",
                      border: "1px dashed #cbd5e1",
                      backgroundColor: "#f8fafc",
                      color: "#64748b",
                      fontSize: "13px",
                    }}
                  >
                    Chưa có dịch vụ cố định nào. Bấm &quot;Thêm dịch vụ&quot; hoặc chọn gợi ý bên trên để bổ sung.
                  </div>
                ) : (
                  form.defaultServices.map((service, index) => (
                    <div className="service-row" key={index}>
                      <Field
                        label="Tên dịch vụ"
                        required
                        value={service.name}
                        placeholder="Ví dụ: Giữ xe máy"
                        onChange={(e) =>
                          setForm({
                            ...form,
                            defaultServices: form.defaultServices.map((s, i) =>
                              i === index ? { ...s, name: e.target.value } : s,
                            ),
                          })
                        }
                      />

                      <Field
                        label="Đơn giá (₫)"
                        type="number"
                        min="0"
                        required
                        value={service.price}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            defaultServices: form.defaultServices.map((s, i) =>
                              i === index
                                ? { ...s, price: Number(e.target.value) }
                                : s,
                            ),
                          })
                        }
                      />

                      <SelectField
                        label="Cách tính"
                        value={service.billingType}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            defaultServices: form.defaultServices.map((s, i) =>
                              i === index
                                ? { ...s, billingType: e.target.value }
                                : s,
                            ),
                          })
                        }
                      >
                        <option value="PER_ROOM">/ phòng / tháng</option>
                        <option value="PER_PERSON">/ người / tháng</option>
                        <option value="PER_UNIT">/ đơn vị / tháng</option>
                      </SelectField>

                      <button
                        className="icon-button"
                        type="button"
                        title="Xóa dịch vụ này"
                        aria-label="Xóa dịch vụ"
                        onClick={() =>
                          setForm({
                            ...form,
                            defaultServices: form.defaultServices.filter(
                              (_, i) => i !== index,
                            ),
                          })
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ============================================================= */}
            {/* TAB 4: VIETQR & SEPAY INTEGRATION PREVIEW                     */}
            {/* ============================================================= */}
            {activeTab === "vietqr" && (
              <div className="form-section">
                <h3>
                  <QrCode size={18} />
                  04. Tích hợp Thanh toán VietQR &amp; SePay
                </h3>

                <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "16px", lineHeight: 1.5 }}>
                  Khi xuất hóa đơn cho khách thuê tại cơ sở này, mã VietQR động sẽ tự động sinh dựa trên
                  tài khoản ngân hàng của bạn và cú pháp đối soát tự động SePay.
                </p>

                {hasBankAccount ? (
                  <>
                    {/* Dynamic VietQR Preview Card with REAL data */}
                    <div className="stitch-vietqr-card">
                      <div className="stitch-vietqr-card-info">
                        <div className="stitch-vietqr-bank">
                          <CreditCard size={15} />
                          <span>{bankAccount.bankName || bankAccount.bankCode}</span>
                        </div>
                        <div className="stitch-vietqr-account">
                          {bankAccount.accountNumber}
                        </div>
                        <div className="stitch-vietqr-holder">
                          {bankAccount.accountName}
                        </div>
                      </div>

                      <div className="stitch-vietqr-code-box">
                        <QrCode size={36} />
                      </div>
                    </div>

                    <div style={{ marginTop: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "12px", color: "#005c55", fontWeight: 600, display: "flex", alignItems: "center", gap: "5px" }}>
                        <Check size={14} /> Tài khoản nhận tiền đã liên kết (áp dụng toàn chuỗi)
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          navigate("/profile");
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--primary, #005c55)",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer",
                          textDecoration: "underline",
                        }}
                      >
                        Đổi tài khoản nhận tiền →
                      </button>
                    </div>
                  </>
                ) : (
                  <div
                    style={{
                      padding: "20px",
                      borderRadius: "12px",
                      backgroundColor: "#fffbeb",
                      border: "1px solid #fde68a",
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                      marginBottom: "16px",
                    }}
                  >
                    <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                      <AlertTriangle size={24} color="#d97706" style={{ flexShrink: 0, marginTop: "2px" }} />
                      <div>
                        <strong style={{ color: "#92400e", fontSize: "14px" }}>
                          Chưa cấu hình tài khoản ngân hàng nhận tiền!
                        </strong>
                        <p style={{ margin: "4px 0 0", color: "#b45309", fontSize: "13px", lineHeight: 1.5 }}>
                          Chủ trọ chưa thiết lập tài khoản ngân hàng VietQR. Bạn sẽ không thể phát hành hóa đơn thu tiền tại cơ sở này nếu chưa cài đặt tài khoản (hệ thống sẽ báo lỗi <code>BANK_NOT_CONFIGURED</code>).
                        </p>
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          navigate("/profile");
                        }}
                        style={{
                          padding: "8px 14px",
                          borderRadius: "8px",
                          backgroundColor: "#005c55",
                          color: "#ffffff",
                          border: "none",
                          fontWeight: 600,
                          fontSize: "13px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <CreditCard size={15} /> Thiết lập tài khoản ngân hàng ngay
                      </button>
                    </div>
                  </div>
                )}

                {/* SePay Automation Rules */}
                <div className="stitch-sepay-notice" style={{ marginTop: "16px" }}>
                  <ShieldCheck size={20} color="var(--secondary, #4b41e1)" style={{ flexShrink: 0, marginTop: "2px" }} />
                  <div>
                    <strong style={{ color: "var(--secondary, #4b41e1)" }}>Cú pháp SePay gạch nợ tự động:</strong>
                    <p style={{ margin: "4px 0 0", color: "#475569" }}>
                      Mã QR được gắn nội dung chuyển khoản chuẩn Napas:{" "}
                      <code style={{ padding: "2px 6px", borderRadius: "4px", backgroundColor: "#e2e8f0", fontWeight: 700, color: "var(--primary, #005c55)" }}>
                        HD[MaHoaDon] P[SoPhong]
                      </code>
                      . Khi khách chuyển khoản, Webhook SePay sẽ đối soát và cập nhật trạng thái &quot;ĐÃ THANH TOÁN&quot; ngay trong 2 giây.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </fieldset>

          <FormError error={error} />
        </div>

        {/* Modal Footer with Actions */}
        <footer className="modal-footer">
          <div style={{ marginRight: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
            {activeTab !== "info" && (
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  if (activeTab === "vietqr") setActiveTab("services");
                  else if (activeTab === "services") setActiveTab("pricing");
                  else if (activeTab === "pricing") setActiveTab("info");
                }}
              >
                ← Bước trước
              </Button>
            )}

            {activeTab !== "vietqr" && (
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  if (activeTab === "info") setActiveTab("pricing");
                  else if (activeTab === "pricing") setActiveTab("services");
                  else if (activeTab === "services") setActiveTab("vietqr");
                }}
              >
                Bước tiếp →
              </Button>
            )}
          </div>

          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={onClose}
          >
            Hủy
          </Button>

          <Button busy={busy}>
            <Save size={16} />
            <span>{branch ? "Lưu thay đổi" : "Lưu cơ sở & Áp dụng"}</span>
          </Button>
        </footer>
      </form>
    </Modal>
  );
}
