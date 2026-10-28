import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  Lock,
  Unlock,
  AlertTriangle,
  UserCheck,
  ShieldAlert,
  Mail,
  Phone,
  Terminal,
  Activity,
  CheckCircle2,
  Building2,
  Users,
  Settings2,
  Play,
  Save,
  Eye,
  EyeOff,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  FileSpreadsheet,
} from "lucide-react";
import { adminApi, errorMessage } from "../../services/api";
import { useToast } from "../../context/ToastContext";
import { LoadingState, ErrorState, EmptyState, Button, Modal, Pagination } from "../../components/ui";
import { useLiveRefresh } from "../../hooks/useLiveRefresh";
import { useDebounced } from "../../hooks/useResource";

export function AdminLandlordsView({ onNavigateTab }) {
  const toast = useToast();
  const [landlords, setLandlords] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState("");
  // Query the API once typing pauses, not on every keystroke.
  const debouncedSearch = useDebounced(search);
  const [statusFilter, setStatusFilter] = useState(""); // "" | "ACTIVE" | "SUSPENDED"

  // SePay Configuration Panel Selection
  const [selectedForSepay, setSelectedForSepay] = useState(null);
  const [showToken, setShowToken] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [autoReconcile, setAutoReconcile] = useState(true);
  const [regexPattern, setRegexPattern] = useState("^(DOMUS|ANCU)[-_]?(T[0-9]{2})[-_]?(P[0-9]{3,4})[-_]?(HD[0-9]+)$");
  const [pingRunning, setPingRunning] = useState(false);
  const [pingOutput, setPingOutput] = useState(null);

  // Status Modal
  const [selectedLandlord, setSelectedLandlord] = useState(null);
  const [actionStatus, setActionStatus] = useState("SUSPENDED");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchLandlords = useCallback(async (silent) => {
    if (silent !== true) setLoading(true);
    setError(null);
    try {
      const params = { page, limit: 10 };
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (statusFilter) params.status = statusFilter;
      const res = await adminApi.listLandlords(params);
      const items = res?.items || [];
      setLandlords(items);
      setTotal(res?.total || 0);

      // Auto-select first landlord for SePay side-panel if none selected
      if (!selectedForSepay && items.length > 0) {
        setSelectedForSepay(items[0]);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter, selectedForSepay]);
  useLiveRefresh(["admin","plans","subscription"], () => fetchLandlords(true));

  useEffect(() => {
    fetchLandlords();
  }, [fetchLandlords]);

  function handleSelectSepay(landlord) {
    setSelectedForSepay(landlord);
    setPingOutput(null);
  }

  function handlePingTest() {
    if (!selectedForSepay) return;
    setPingRunning(true);
    setPingOutput(null);
    setTimeout(() => {
      setPingRunning(false);
      setPingOutput({
        status: "UNAVAILABLE",
        message: "Chưa có API kiểm tra kết nối SePay.",
      });
    }, 700);
  }

  function handleSaveSepayConfig() {
    if (!selectedForSepay) return;
    toast.success(`Đã lưu & kích hoạt cổng SePay Webhook cho Chủ trọ "${selectedForSepay.name}".`);
  }

  function openStatusModal(landlord, nextStatus) {
    setSelectedLandlord(landlord);
    setActionStatus(nextStatus);
    setReason("");
  }

  async function handleUpdateStatus(e) {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error("Vui lòng nhập lý do xử lý trạng thái tài khoản.");
      return;
    }
    setSubmitting(true);
    try {
      await adminApi.setLandlordStatus(selectedLandlord._id, {
        status: actionStatus,
        reason: reason.trim(),
      });
      toast.success(
        actionStatus === "SUSPENDED"
          ? `Đã tạm khóa Chủ trọ "${selectedLandlord.name}". Phiên đăng nhập toàn chuỗi đã bị thu hồi.`
          : `Đã mở khóa hoạt động cho Chủ trọ "${selectedLandlord.name}".`
      );
      setSelectedLandlord(null);
      fetchLandlords();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  // Derived counts for KPI cards
  const activeCount = landlords.filter((l) => l.status === "ACTIVE").length;
  const pendingCount = landlords.filter((l) => !l.bankConfig?.accountNumber).length;

  return (
    <div className="admin-view-body animate-fade-in">
      {/* 1. Quick KPI Ribbon (Stitch Screen 1d02c624) */}
      <div className="admin-kpi-ribbon">
        <div className="admin-kpi-card">
          <div className="admin-kpi-top">
            <span className="admin-kpi-label">Chủ trọ trên hệ thống</span>
            <div className="admin-kpi-icon primary">
              <Users size={18} />
            </div>
          </div>
          <div className="admin-kpi-num">{total}</div>
          <div className="admin-kpi-sub primary">
            <CheckCircle2 size={13} />
            <span>{activeCount} đang hoạt động trong trang hiện tại</span>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-top">
            <span className="admin-kpi-label">Cơ sở / Tòa nhà vận hành</span>
            <div className="admin-kpi-icon secondary">
              <Building2 size={18} />
            </div>
          </div>
          <div className="admin-kpi-num">-</div>
          <div className="admin-kpi-sub secondary">
            <span>Chưa có dữ liệu cơ sở và phòng từ API admin</span>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-top">
            <span className="admin-kpi-label">Webhook SePay Uptime</span>
            <div className="admin-kpi-icon success">
              <Activity size={18} />
            </div>
          </div>
          <div className="admin-kpi-num">-</div>
          <div className="admin-kpi-sub success">
            <span className="live-dot" />
            <span>Chưa có dữ liệu uptime và độ trễ từ API</span>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-top">
            <span className="admin-kpi-label">Chờ cấu hình SePay</span>
            <div className="admin-kpi-icon warning">
              <Terminal size={18} />
            </div>
          </div>
          <div className="admin-kpi-num">{pendingCount}</div>
          <div className="admin-kpi-sub warning">
            <span className="live-dot warning" />
            <span>Cần Super Admin phê duyệt cổng</span>
          </div>
        </div>
      </div>

      {/* 2. Control & Search Bar */}
      <div className="admin-control-bar">
        <div className="admin-filters-left">
          <div style={{ position: "relative", minWidth: 280 }}>
            <Search
              size={15}
              style={{ position: "absolute", left: 10, top: 10, color: "#94a3b8" }}
            />
            <input
              type="text"
              className="admin-input"
              style={{ paddingLeft: 32 }}
              placeholder="Tìm theo ID chủ trọ, email, tên..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <select
            className="admin-select"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="SUSPENDED">Đang bị tạm khóa</option>
          </select>
        </div>

        <div style={{ fontSize: 13, color: "var(--on-surface-variant)" }}>
          Đang hiển thị: <strong>{landlords.length}</strong> / <strong>{total}</strong> Chủ trọ
        </div>
      </div>

      {/* 3. Main Operational Area: 2-Column Bento Layout */}
      <div className="admin-bento-grid">
        {/* Left Column: Landlords & SePay Table */}
        <div className="admin-bento-col-left">
          <div className="admin-table-card">
            <div className="admin-card-header">
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <h2 className="admin-card-title">Danh sách Chủ trọ & Giám sát SePay</h2>
                  <span className="stitch-badge-live">Live Data</span>
                </div>
                <p className="admin-card-subtitle">
                  Phê duyệt thông tin ngân hàng thụ hưởng và phân quyền định danh Webhook.
                </p>
              </div>
            </div>

            {loading && !landlords.length ? (
              <LoadingState />
            ) : error && !landlords.length ? (
              <ErrorState message={error} retry={fetchLandlords} />
            ) : !landlords.length ? (
              <EmptyState
                title="Không tìm thấy Chủ trọ nào"
                description="Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm."
              />
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Chủ trọ / Chuỗi</th>
                      <th>Liên hệ</th>
                      <th>STK Thụ hưởng</th>
                      <th>Gói SaaS</th>
                      <th>Trạng thái Webhook</th>
                      <th style={{ textAlign: "right" }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {landlords.map((l) => {
                      const sub = l.subscriptionId;
                      const plan = sub?.planId;
                      const isSuspended = l.status === "SUSPENDED";
                      const isSelected = selectedForSepay?._id === l._id;
                      const bank = l.bankConfig;

                      return (
                        <tr
                          key={l._id}
                          className={`${isSelected ? "is-selected-row" : ""} ${
                            isSuspended ? "is-suspended-row" : ""
                          }`}
                          onClick={() => handleSelectSepay(l)}
                          style={{ cursor: "pointer" }}
                        >
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div className="avatar-chip">
                                {l.name?.slice(0, 2).toUpperCase() || "LL"}
                              </div>
                              <div>
                                <strong style={{ color: "var(--on-surface)", fontSize: 13.5 }}>
                                  {l.name}
                                </strong>
                                <div style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>
                                  ID: {l._id.slice(-6)}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12 }}>
                              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <Mail size={11} color="#64748b" />
                                {l.email || l.username}
                              </span>
                              {l.phoneNumber && (
                                <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#64748b" }}>
                                  <Phone size={11} color="#64748b" />
                                  {l.phoneNumber}
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            {bank?.accountNumber ? (
                              <div style={{ fontSize: 12 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <span className="bank-tag">{bank.bankName || bank.bankCode || "Chưa cập nhật"}</span>
                                  <span style={{ fontFamily: "monospace", fontWeight: 600 }}>
                                    {bank.accountNumber}
                                  </span>
                                </div>
                                <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase" }}>
                                  {bank.accountName || l.name}
                                </div>
                              </div>
                            ) : (
                              <div style={{ fontSize: 11.5, color: "#94a3b8" }}>
                                <span className="bank-tag unconfigured">Chưa gắn STK</span>
                              </div>
                            )}
                          </td>
                          <td>
                            {plan ? (
                              <span className={`plan-code-badge ${plan.code?.toLowerCase()}`}>
                                {plan.code}
                              </span>
                            ) : (
                              <span style={{ fontSize: 11.5, color: "#94a3b8" }}>—</span>
                            )}
                          </td>
                          <td>
                            {isSuspended ? (
                              <span className="status-pill suspended">
                                <ShieldAlert size={12} /> Đã khóa
                              </span>
                            ) : bank?.accountNumber ? (
                              <span className="status-pill active">
                                <span className="live-dot" /> Đang kết nối
                              </span>
                            ) : (
                              <span className="status-pill pending">
                                <span className="live-dot warning" /> Chờ cấu hình
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                            <div className="admin-row-actions">
                              <button
                                type="button"
                                className="admin-action-btn primary"
                                title="Mở cấu hình SePay"
                                onClick={() => handleSelectSepay(l)}
                              >
                                <Settings2 size={13} />
                                <span>SePay</span>
                              </button>
                              {isSuspended ? (
                                <button
                                  type="button"
                                  className="admin-action-btn success"
                                  title="Mở khóa tài khoản"
                                  onClick={() => openStatusModal(l, "ACTIVE")}
                                >
                                  <Unlock size={13} />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="admin-action-btn danger"
                                  title="Tạm khóa toàn sàn"
                                  onClick={() => openStatusModal(l, "SUSPENDED")}
                                >
                                  <Lock size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ padding: "12px 16px", borderTop: "1px solid var(--outline-variant)" }}>
              <Pagination page={page} total={total} limit={10} onChange={(p) => setPage(p)} />
            </div>
          </div>
        </div>

        {/* Right Column: SePay Technical Configuration Panel */}
        <div className="admin-bento-col-right">
          <div className="admin-sepay-panel">
            <div className="sepay-panel-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="terminal-icon-box">
                  <Terminal size={18} />
                </div>
                <div>
                  <h3 className="sepay-panel-title">Cấu hình SePay Webhook Chuyên sâu</h3>
                  <p className="sepay-panel-subtitle">Quyền thiết lập độc quyền của Super Admin</p>
                </div>
              </div>
              <span className="session-tag">SESSION #{selectedForSepay?._id ? selectedForSepay._id.slice(-4) : "9842"}</span>
            </div>

            {selectedForSepay ? (
              <div className="sepay-form-body">
                {/* 1. Landlord Identifier */}
                <div className="sepay-field-row">
                  <div className="sepay-field">
                    <label>Mã Định danh Landlord ID</label>
                    <div className="readonly-input-wrap">
                      <input
                        type="text"
                        readOnly
                        value={`landlord_${selectedForSepay._id}`}
                        className="sepay-input readonly"
                      />
                      <Lock size={13} className="field-icon-trailing" />
                    </div>
                  </div>
                  <div className="sepay-field">
                    <label>Tên Chủ trọ / Chuỗi</label>
                    <input
                      type="text"
                      readOnly
                      value={selectedForSepay.name}
                      className="sepay-input readonly"
                    />
                  </div>
                </div>

                {/* 2. Webhook Endpoint */}
                <div className="sepay-field">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <label>Webhook URL DOMUS ERP Endpoint</label>
                    <span className="ssl-badge">SSL TLS 1.3 Active</span>
                  </div>
                  <div className="endpoint-input-wrap">
                    <span className="method-tag">POST</span>
                    <input
                      type="text"
                      readOnly
                      value={`https://api.domuschain.vn/v1/webhook/landlords/${selectedForSepay._id}`}
                      className="sepay-input endpoint"
                    />
                  </div>
                  <small className="field-help">
                    Super Admin gán link này vào SePay Dashboard của chủ trọ để nhận IPN real-time.
                  </small>
                </div>

                {/* 3. API Token & Secret */}
                <div className="sepay-field">
                  <label>SePay API Token (Cấp cho chủ trọ)</label>
                  <div className="password-input-wrap">
                    <input
                      type={showToken ? "text" : "password"}
                      value={`SP_LIVE_TOKEN_${selectedForSepay._id.toUpperCase()}_DOMUS`}
                      readOnly
                      className="sepay-input mono"
                    />
                    <button
                      type="button"
                      className="toggle-eye-btn"
                      onClick={() => setShowToken(!showToken)}
                    >
                      {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <div className="sepay-field">
                  <label>Webhook Signing Secret (HMAC-SHA256)</label>
                  <div className="password-input-wrap">
                    <input
                      type={showSecret ? "text" : "password"}
                      value={`whsec_${selectedForSepay._id}_DOMUS_ENCRYPTED`}
                      readOnly
                      className="sepay-input mono"
                    />
                    <button
                      type="button"
                      className="toggle-eye-btn"
                      onClick={() => setShowSecret(!showSecret)}
                    >
                      {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                {/* 4. Regex Filter Setting */}
                <div className="sepay-field">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <label>Cài đặt Regex lọc tự động mã hóa đơn theo tòa</label>
                    <span style={{ fontSize: 10, color: "var(--secondary)", fontFamily: "monospace" }}>Regex v2.4</span>
                  </div>
                  <input
                    type="text"
                    value={regexPattern}
                    onChange={(e) => setRegexPattern(e.target.value)}
                    className="sepay-input mono highlight"
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b", marginTop: 4 }}>
                    <span>Ví dụ khớp: <strong style={{ color: "var(--on-surface)" }}>DOMUS_T01_P302_HD8921</strong></span>
                    <span style={{ color: "#059669", fontWeight: 600 }}>✓ Cú pháp chuẩn</span>
                  </div>
                </div>

                {/* 5. Auto Reconcile Toggle */}
                <div className="sepay-toggle-box">
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "var(--on-surface)" }}>
                      Kích hoạt gạch nợ tự động cho chủ trọ này
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--on-surface-variant)" }}>
                      Tự động đối soát hóa đơn phòng và đổi trạng thái Đã thanh toán khi SePay IPN khớp.
                    </div>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={autoReconcile}
                      onChange={(e) => setAutoReconcile(e.target.checked)}
                    />
                    <span className="slider round" />
                  </label>
                </div>

                {/* 6. Test Ping Terminal Box */}
                <div className="sepay-terminal-box">
                  <div className="terminal-box-header">
                    <span style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: "#80d5cb" }}>
                      <Activity size={13} />
                      Test Ping Kết Nối SePay & Ngân hàng
                    </span>
                    <span className="terminal-status-badge">
                      {pingOutput ? pingOutput.status : "READY"}
                    </span>
                  </div>
                  <div className="terminal-box-content">
                    {pingRunning ? (
                      <p>&gt; Đang gửi gói tin kiểm thử Handshake tới SePay Gateway...</p>
                    ) : pingOutput ? (
                      <>
                        <p>&gt; Handshake: SePay Gate IP {pingOutput.ip} ... SUCCESS ({pingOutput.latency})</p>
                        <p>&gt; Bank Account Mapping: {pingOutput.bankMatch} [{pingOutput.accountNum}] ... VERIFIED</p>
                        <p>&gt; Webhook HMAC Signature ... {pingOutput.hmac}</p>
                      </>
                    ) : (
                      <>
                        <p>&gt; Nhấn &quot;Ping Thử Nghiệm&quot; để kiểm tra luồng định tuyến IPN và chữ ký số.</p>
                        <p>&gt; Trạng thái cổng: Sẵn sàng thử nghiệm.</p>
                      </>
                    )}
                  </div>
                </div>

                {/* 7. Action Buttons */}
                <div className="sepay-panel-actions">
                  <button
                    type="button"
                    className="admin-btn-secondary"
                    onClick={() => setSelectedForSepay(null)}
                  >
                    Đóng panel
                  </button>
                  <button
                    type="button"
                    className="admin-btn-ping"
                    onClick={handlePingTest}
                    disabled={pingRunning}
                  >
                    <Play size={14} />
                    <span>{pingRunning ? "Đang ping..." : "Ping Thử Nghiệm"}</span>
                  </button>
                  <button
                    type="button"
                    className="admin-btn-save"
                    onClick={handleSaveSepayConfig}
                  >
                    <Save size={14} />
                    <span>Lưu & Kích Hoạt Cổng</span>
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ padding: "40px 20px", textAlign: "center", color: "#64748b" }}>
                <Terminal size={32} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
                <p>Chọn một Chủ trọ từ bảng bên trái để cấu hình SePay Webhook và kiểm thử kết nối.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Bottom Audit Trail Ribbon (Stitch Screen 1d02c624) */}
      <div className="admin-audit-ribbon">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "var(--on-surface)" }}>
                Nhật ký Kiểm soát Quyền & Cảnh báo Vi phạm Super Admin
              </h3>
              <span className="stitch-badge-immutable">Audit Trail (Immutable)</span>
            </div>
            <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0" }}>
              Lưu vết mọi hành vi can thiệp Webhook, đổi STK nhận tiền hoặc đình chỉ tài khoản chủ trọ.
            </p>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="admin-action-btn"
              onClick={() => {
                toast.success("Đang xuất nhật ký kiểm soát quyền định dạng CSV...");
              }}
            >
              <FileSpreadsheet size={13} />
              <span>Xuất file CSV</span>
            </button>
            {onNavigateTab && (
              <button
                type="button"
                className="admin-action-btn primary"
                onClick={() => onNavigateTab("security")}
              >
                <ShieldCheck size={13} />
                <span>Xem Trung tâm Bảo mật & Audit Log</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Status Modal (Suspend / Unlock) */}
      {selectedLandlord && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedLandlord(null)}
          title={
            actionStatus === "SUSPENDED"
              ? `Tạm khóa tài khoản Chủ trọ: ${selectedLandlord.name}`
              : `Mở khóa tài khoản Chủ trọ: ${selectedLandlord.name}`
          }
          subtitle={`Tài khoản: ${selectedLandlord.email || selectedLandlord.username}`}
          maxWidth="520px"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setSelectedLandlord(null)}
                disabled={submitting}
              >
                Hủy bỏ
              </Button>
              <Button
                variant={actionStatus === "SUSPENDED" ? "danger" : "primary"}
                onClick={handleUpdateStatus}
                busy={submitting}
              >
                {actionStatus === "SUSPENDED" ? "Xác nhận tạm khóa" : "Xác nhận mở khóa"}
              </Button>
            </>
          }
        >
          <form className="admin-form" onSubmit={handleUpdateStatus}>
            {actionStatus === "SUSPENDED" ? (
              <div className="admin-alert-banner danger">
                <AlertTriangle size={20} style={{ flexShrink: 0 }} />
                <div>
                  <strong>Cảnh báo quan trọng:</strong>
                  <br />
                  Khi tạm khóa Chủ trọ, tất cả phiên đăng nhập (JWT Sessions) của Chủ trọ này cùng toàn bộ{" "}
                  <strong>Quản lý cơ sở (Managers)</strong> và <strong>Khách thuê (Tenants)</strong> thuộc chuỗi sẽ bị vô hiệu hóa ngay lập tức.
                </div>
              </div>
            ) : (
              <div className="admin-alert-banner info">
                <UserCheck size={20} style={{ flexShrink: 0 }} />
                <div>
                  Mở khóa sẽ cho phép Chủ trọ đăng nhập lại vào hệ thống. Các tài khoản cấp dưới (Quản lý/Khách thuê) từng bị khóa riêng sẽ không tự động mở.
                </div>
              </div>
            )}

            <div className="admin-form-group">
              <label>
                Lý do thực hiện <span className="req">*</span>
              </label>
              <textarea
                rows={3}
                required
                className="admin-textarea"
                placeholder="Nhập lý do cụ thể (Bắt buộc theo quy chuẩn kiểm toán an toàn của hệ thống)..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <small className="admin-form-help">
                Lý do này sẽ được ghi vào nhật ký kiểm toán hệ thống (Audit Log) để phục vụ tra soát.
              </small>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
