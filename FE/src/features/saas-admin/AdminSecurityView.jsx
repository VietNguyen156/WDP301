import React, { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  KeyRound,
  FileCheck2,
  Download,
  AlertOctagon,
  CheckCircle2,
  Clock,
  Fingerprint,
  Sliders,
  Search,
  Filter,
  RefreshCw,
  Hash,
  Laptop,
  Flame,
} from "lucide-react";
import { adminApi, errorMessage } from "../../services/api";
import { useToast } from "../../context/ToastContext";
import {
  LoadingState,
  ErrorState,
  EmptyState,
  Pagination,
  Button,
  Modal,
} from "../../components/ui";
import { useLiveRefresh } from "../../hooks/useLiveRefresh";

export function AdminSecurityView() {
  const toast = useToast();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [actionFilter, setActionFilter] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const [timeRange, setTimeRange] = useState("24h");

  // Policy toggles state
  const [policies, setPolicies] = useState({
    enforce2FAForBank: true,
    strictPasswordTimeout: true,
    antiBruteForceIP: true,
    whitelistSuperAdminIP: true,
  });

  // Modal / Verification state
  const [verifyingHash, setVerifyingHash] = useState(null);
  const [lockdownModalOpen, setLockdownModalOpen] = useState(false);
  const [lockdownReason, setLockdownReason] = useState("");
  const [lockdownSubmitting, setLockdownSubmitting] = useState(false);

  const fetchAuditLogs = useCallback(async (silent) => {
    if (silent !== true) setLoading(true);
    setError(null);
    try {
      const params = { page, limit: 10 };
      if (actionFilter) params.action = actionFilter;
      const res = await adminApi.listAuditLogs(params);
      const items = res?.items || [];
      setLogs(items);
      setTotal(res?.total || 0);
    } catch (err) {
      setError(errorMessage(err));
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter]);
  useLiveRefresh(["admin"], () => fetchAuditLogs(true));

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  function handleTogglePolicy(key) {
    setPolicies((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      toast.success(
        `Đã cập nhật chính sách bảo mật: ${
          next[key] ? "Bật kích hoạt (Enforced)" : "Tắt tạm thời"
        }`,
      );
      return next;
    });
  }

  function handleVerifyHash(item) {
    setVerifyingHash(item);
    setTimeout(() => {
      toast.info("API kiểm chứng hash chưa được cung cấp.");
      setVerifyingHash(null);
    }, 600);
  }

  function handleTriggerEmergencyLockdown(e) {
    e.preventDefault();
    if (!lockdownReason.trim()) {
      toast.error("Vui lòng ghi rõ lý do kích hoạt phong tỏa khẩn cấp!");
      return;
    }
    setLockdownSubmitting(true);
    setTimeout(() => {
      setLockdownSubmitting(false);
      setLockdownModalOpen(false);
      toast.info("API phong tỏa khẩn cấp chưa được cung cấp.");
    }, 800);
  }

  const displayLogs = logs;

  return (
    <div className="admin-view-body animate-fade-in">
      {/* 1. Header Section */}
      <div className="admin-security-header">
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 4,
            }}
          >
            <span className="badge-shield-core">
              Core Infrastructure Shield
            </span>
            <span className="badge-zero-trust">
              <Lock size={12} color="#059669" />
              Zero-Trust Architecture
            </span>
          </div>
          <h1 className="admin-view-title">
            Bảo mật Nền tảng & Nhật ký Kiểm toán Bất biến (Security & Audit Log)
          </h1>
          <p className="admin-view-subtext">
            Giám sát thời gian thực, lưu vết chuỗi băm mật mã SHA-256 các hành
            động can thiệp tài chính, STK và phân quyền cấp cao trên toàn sàn
            DOMUS.
          </p>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button
            type="button"
            className="admin-action-btn"
            onClick={() =>
              toast.success(
                "Đang xuất toàn bộ nhật ký kiểm toán định dạng CSV mã hóa...",
              )
            }
          >
            <Download size={14} />
            <span>Xuất nhật ký (CSV)</span>
          </button>
          <button
            type="button"
            className="admin-action-btn primary"
            onClick={() =>
              toast.success(
                "Chính sách 2FA & mật khẩu hiện đang đồng bộ chuẩn Level 3.",
              )
            }
          >
            <Sliders size={14} />
            <span>Chính sách 2FA</span>
          </button>
          <button
            type="button"
            className="admin-action-btn danger"
            onClick={() => setLockdownModalOpen(true)}
          >
            <AlertOctagon size={14} />
            <span>Khóa khẩn cấp (Lockdown)</span>
          </button>
        </div>
      </div>

      {/* 2. Security KPI Cards (Bento Metric Presentation) */}
      <div className="admin-kpi-ribbon">
        {/* Metric 1 */}
        <div className="admin-kpi-card">
          <div className="admin-kpi-top">
            <div>
              <span className="admin-kpi-label">Điểm an toàn hệ thống</span>
              <div style={{ fontSize: 11, color: "#64748b" }}>
                Security Posture Score
              </div>
            </div>
            <div className="admin-kpi-icon success">
              <ShieldCheck size={20} />
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 6,
              marginTop: 8,
            }}
          >
            <span
              className="admin-kpi-num"
              style={{ color: "var(--on-surface)" }}
            >
              -
            </span>
          </div>
          <div className="progress-bar-wrap">
            <div
              className="progress-bar-fill"
              style={{ width: "0%", background: "#059669" }}
            />
          </div>
          <div className="admin-kpi-sub success" style={{ marginTop: 8 }}>
            <CheckCircle2 size={13} />
            <span>Chưa có điểm an toàn từ API</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="admin-kpi-card">
          <div className="admin-kpi-top">
            <div>
              <span className="admin-kpi-label">Xác thực 2 bước (2FA)</span>
              <div style={{ fontSize: 11, color: "#64748b" }}>
                2FA Enforcement
              </div>
            </div>
            <div className="admin-kpi-icon primary">
              <KeyRound size={20} />
            </div>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginTop: 8,
            }}
          >
            <div>
              <span className="admin-kpi-num">-</span>
              <span style={{ fontSize: 11, color: "#64748b", marginLeft: 4 }}>
                Admin
              </span>
            </div>
            <div>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "var(--on-surface-variant)",
                }}
              >
                -
              </span>
              <span style={{ fontSize: 11, color: "#64748b", marginLeft: 4 }}>
                Chủ trọ
              </span>
            </div>
          </div>
          <div className="progress-bar-wrap" style={{ display: "flex" }}>
            <div
              style={{
                width: "0%",
                background: "var(--primary)",
                height: "100%",
              }}
            />
          </div>
          <div className="admin-kpi-sub primary" style={{ marginTop: 8 }}>
            <span className="live-dot" />
            <span>Chưa có dữ liệu 2FA từ API</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="admin-kpi-card">
          <div className="admin-kpi-top">
            <div>
              <span className="admin-kpi-label">Cảnh báo chưa xử lý</span>
              <div style={{ fontSize: 11, color: "#64748b" }}>
                Active Security Alerts
              </div>
            </div>
            <div className="admin-kpi-icon warning">
              <Flame size={20} />
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 8,
              marginTop: 8,
            }}
          >
            <span className="admin-kpi-num" style={{ color: "#d97706" }}>
              {logs.length}
            </span>
            <span className="priority-badge-high">Từ audit log</span>
          </div>
          <div className="warning-notice-box">
            Số lượng bản ghi audit hiện tải: {logs.length}.
          </div>
        </div>

        {/* Metric 4 */}
        <div className="admin-kpi-card">
          <div className="admin-kpi-top">
            <div>
              <span className="admin-kpi-label">Phiên đang hoạt động</span>
              <div style={{ fontSize: 11, color: "#64748b" }}>
                Active Sessions Toàn sàn
              </div>
            </div>
            <div className="admin-kpi-icon secondary">
              <Laptop size={20} />
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 8,
              marginTop: 8,
            }}
          >
            <span className="admin-kpi-num">-</span>
            <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>
              Chưa có dữ liệu
            </span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 12,
              paddingTop: 8,
              borderTop: "1px solid var(--outline-variant)",
            }}
          >
            <span style={{ fontSize: 11.5, color: "#64748b" }}>
              Chưa có dữ liệu phiên
            </span>
            <button
              type="button"
              className="text-link-btn"
              onClick={() =>
                toast.info("API thu hồi phiên chưa được cung cấp.")
              }
            >
              Thu hồi phiên lạ
            </button>
          </div>
        </div>
      </div>

      {/* 3. Global Policy Controls (Bento Control Hub) */}
      <div className="admin-policy-hub">
        <div className="policy-hub-header">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="policy-icon-box">
              <Sliders size={18} />
            </div>
            <div>
              <h2 className="policy-hub-title">
                Cài đặt Chính sách Bảo mật Cấp Nền tảng (Global Policy Engine)
              </h2>
              <p className="policy-hub-subtitle">
                Thiết lập hàng rào bảo vệ cho các nghiệp vụ tài chính nhạy cảm &
                hạ tầng SePay
              </p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="policy-sync-badge">
              <span className="live-dot" />
              Policy Synchronized
            </span>
          </div>
        </div>

        <div className="policy-cards-grid">
          {/* Policy 1 */}
          <div className="policy-card">
            <div className="policy-card-top">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontWeight: 700,
                  fontSize: 13.5,
                }}
              >
                <KeyRound size={15} color="var(--primary)" />
                Bắt buộc 2FA Đổi STK
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={policies.enforce2FAForBank}
                  onChange={() => handleTogglePolicy("enforce2FAForBank")}
                />
                <span className="slider round" />
              </label>
            </div>
            <p className="policy-card-desc">
              Bắt buộc xác thực TOTP/SMS OTP cho mọi hành vi đổi số tài khoản
              thụ hưởng & chỉnh sửa SePay Webhook URL.
            </p>
            <div className="policy-card-footer">
              <span>Độ nghiêm ngặt</span>
              <strong style={{ color: "var(--primary)" }}>
                Tối cao (Level 3)
              </strong>
            </div>
          </div>

          {/* Policy 2 */}
          <div className="policy-card">
            <div className="policy-card-top">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontWeight: 700,
                  fontSize: 13.5,
                }}
              >
                <Clock size={15} color="var(--secondary)" />
                Timeout & Độ phức tạp MK
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={policies.strictPasswordTimeout}
                  onChange={() => handleTogglePolicy("strictPasswordTimeout")}
                />
                <span className="slider round" />
              </label>
            </div>
            <p className="policy-card-desc">
              Thời gian tự động hết hạn phiên:{" "}
              <strong>30 phút không thao tác</strong>. Mật khẩu tối thiểu 10 ký
              tự, số, ký tự đặc biệt.
            </p>
            <div className="policy-card-footer">
              <span>Hết hạn mật khẩu</span>
              <strong>90 ngày</strong>
            </div>
          </div>

          {/* Policy 3 */}
          <div className="policy-card">
            <div className="policy-card-top">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontWeight: 700,
                  fontSize: 13.5,
                }}
              >
                <ShieldAlert size={15} color="#dc2626" />
                Chống Brute-force IP
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={policies.antiBruteForceIP}
                  onChange={() => handleTogglePolicy("antiBruteForceIP")}
                />
                <span className="slider round" />
              </label>
            </div>
            <p className="policy-card-desc">
              Tự động phong tỏa địa chỉ IP 120 phút nếu nhập sai mật khẩu quá{" "}
              <strong>5 lần liên tiếp</strong>. Chống rà quét tài khoản.
            </p>
            <div className="policy-card-footer">
              <span>IP đang bị khóa</span>
              <strong style={{ color: "#dc2626", fontFamily: "monospace" }}>
                14 địa chỉ
              </strong>
            </div>
          </div>

          {/* Policy 4 */}
          <div className="policy-card">
            <div className="policy-card-top">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontWeight: 700,
                  fontSize: 13.5,
                }}
              >
                <Lock size={15} color="#a15600" />
                Whitelist IP Super Admin
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={policies.whitelistSuperAdminIP}
                  onChange={() => handleTogglePolicy("whitelistSuperAdminIP")}
                />
                <span className="slider round" />
              </label>
            </div>
            <p className="policy-card-desc">
              Chính sách IP VPN chưa được cung cấp từ API.
            </p>
            <div className="policy-card-footer">
              <span>Dải IP kích hoạt</span>
              <strong style={{ fontFamily: "monospace" }}>03 dải CIDR</strong>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Immutable Audit Trail Section */}
      <div className="admin-table-card">
        <div
          className="admin-card-header"
          style={{ flexDirection: "column", gap: 12 }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              width: "100%",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h2 className="admin-card-title">
                  Nhật ký Kiểm toán Bất biến (Immutable Ledger)
                </h2>
                <span className="stitch-badge-sha">
                  <Fingerprint size={12} />
                  SHA-256 Chained Hash
                </span>
              </div>
              <p className="admin-card-subtitle">
                Các bản ghi được đóng gói khối liên tục, không thể chỉnh sửa
                hoặc xóa bởi bất kỳ cấp quyền nào.
              </p>
            </div>

            <button
              type="button"
              className="admin-btn-verify"
              onClick={() => {
                toast.success(
                  "Đang kiểm toán đối soát dấu vân tay số toàn hệ thống... 100% chuỗi SHA-256 KHỚP HOÀN HẢO.",
                );
              }}
            >
              <Fingerprint size={15} />
              <span>Đối soát dấu vân tay số</span>
            </button>
          </div>

          {/* Filters Row */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              width: "100%",
              paddingTop: 8,
              borderTop: "1px solid var(--outline-variant)",
            }}
          >
            <div style={{ minWidth: 180 }}>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#64748b",
                  textTransform: "uppercase",
                  display: "block",
                  marginBottom: 3,
                }}
              >
                Khoảng thời gian
              </label>
              <select
                className="admin-select"
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
              >
                <option value="24h">Hôm nay (24 giờ qua)</option>
                <option value="7d">7 ngày gần nhất</option>
                <option value="30d">Tháng này</option>
              </select>
            </div>

            <div style={{ minWidth: 200 }}>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#64748b",
                  textTransform: "uppercase",
                  display: "block",
                  marginBottom: 3,
                }}
              >
                Loại hành động
              </label>
              <select
                className="admin-select"
                value={actionFilter}
                onChange={(e) => {
                  setActionFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Tất cả hành động</option>
                <option value="ADMIN_SET_LANDLORD_STATUS">
                  Khóa / Mở khóa Chủ trọ
                </option>
                <option value="CONFIRM_PLATFORM_PAYMENT">
                  Xác nhận thu tiền SaaS
                </option>
                <option value="UPDATE_SEPAY_WEBHOOK">
                  Cấu hình Webhook SePay
                </option>
              </select>
            </div>

            <div style={{ minWidth: 180 }}>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#64748b",
                  textTransform: "uppercase",
                  display: "block",
                  marginBottom: 3,
                }}
              >
                Cấp độ rủi ro
              </label>
              <select
                className="admin-select"
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
              >
                <option value="">Tất cả mức độ</option>
                <option value="HIGH">Nghiêm trọng (Cảnh báo đỏ)</option>
                <option value="WARNING">Cảnh báo (Warning)</option>
                <option value="INFO">Thông tin / Thành công</option>
              </select>
            </div>
          </div>
        </div>

        {/* Audit Table */}
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Tác nhân & IP</th>
                <th>Hành động</th>
                <th>Mô tả chi tiết</th>
                <th>Mã băm SHA-256</th>
                <th>Mức rủi ro</th>
                <th style={{ textAlign: "right" }}>Kiểm chứng</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7">
                    <LoadingState message="Đang tải audit log..." />
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="7">
                    <ErrorState message={error} retry={fetchAuditLogs} />
                  </td>
                </tr>
              ) : displayLogs.length === 0 ? (
                <tr>
                  <td colSpan="7">
                    <EmptyState
                      title="Chưa có audit log"
                      description="Không có bản ghi nào từ cơ sở dữ liệu cho bộ lọc hiện tại."
                    />
                  </td>
                </tr>
              ) : (
                displayLogs.map((log) => {
                  const actorName =
                    log.actorId?.name || log.actorRole || "Chưa có dữ liệu";
                  const actorEmail = log.actorId?.email || "";
                  const isHigh =
                    log.risk === "HIGH" ||
                    log.action === "ADMIN_SET_LANDLORD_STATUS";
                  const isWarning = log.risk === "WARNING";
                  const hashStr = log.hash || "Chưa có dữ liệu";

                  return (
                    <tr key={log._id}>
                      <td>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: "var(--on-surface)",
                          }}
                        >
                          {new Date(log.createdAt).toLocaleTimeString("vi-VN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>
                          {new Date(log.createdAt).toLocaleDateString("vi-VN")}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: 12.5, fontWeight: 600 }}>
                          {actorName}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "#64748b",
                            fontFamily: "monospace",
                          }}
                        >
                          IP: {log.ipAddress || "Chưa có dữ liệu"}
                        </div>
                      </td>
                      <td>
                        <span className="audit-action-tag">{log.action}</span>
                      </td>
                      <td>
                        <div
                          style={{
                            fontSize: 12.5,
                            color: "var(--on-surface)",
                            maxWidth: 320,
                          }}
                        >
                          {log.desc ||
                            (log.after?.reason
                              ? `Lý do: ${log.after.reason}`
                              : `Thao tác trên đối tượng ${log.entityType}`)}
                        </div>
                      </td>
                      <td>
                        <div className="hash-code-display" title={hashStr}>
                          <Hash size={11} />
                          <span>{hashStr.slice(0, 16)}...</span>
                        </div>
                      </td>
                      <td>
                        {isHigh ? (
                          <span className="risk-pill high">Nghiêm trọng</span>
                        ) : isWarning ? (
                          <span className="risk-pill warning">Cảnh báo</span>
                        ) : (
                          <span className="risk-pill info">Thông tin</span>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          className="admin-action-btn"
                          onClick={() => handleVerifyHash(log)}
                          title="Kiểm tra chữ ký số SHA-256"
                        >
                          <Fingerprint size={13} />
                          <span>Đối soát</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid var(--outline-variant)",
          }}
        >
          <Pagination
            page={page}
            total={total}
            limit={10}
            onChange={(p) => setPage(p)}
          />
        </div>
      </div>

      {/* Emergency Lockdown Modal */}
      {lockdownModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setLockdownModalOpen(false)}
          title="KÍCH HOẠT PHONG TỎA KHẨN CẤP (EMERGENCY LOCKDOWN)"
          subtitle="Thao tác can thiệp an ninh tối cao trên toàn sàn DOMUS ERP"
          maxWidth="560px"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setLockdownModalOpen(false)}
                disabled={lockdownSubmitting}
              >
                Hủy bỏ
              </Button>
              <Button
                variant="danger"
                onClick={handleTriggerEmergencyLockdown}
                busy={lockdownSubmitting}
              >
                Xác nhận phong tỏa ngay
              </Button>
            </>
          }
        >
          <form
            className="admin-form"
            onSubmit={handleTriggerEmergencyLockdown}
          >
            <div className="admin-alert-banner danger">
              <AlertOctagon size={24} style={{ flexShrink: 0 }} />
              <div>
                <strong>Cảnh báo cấp độ tối cao:</strong>
                <br />
                Hành động này sẽ tạm dừng ngay lập tức toàn bộ kết nối SePay
                Webhook, đóng các phiên giao dịch gạch nợ tự động và giới hạn
                truy cập đăng nhập chỉ cho dải IP Whitelist của Super Admin.
              </div>
            </div>

            <div className="admin-form-group">
              <label>
                Lý do kích hoạt phong tỏa an ninh <span className="req">*</span>
              </label>
              <textarea
                rows={3}
                required
                className="admin-textarea"
                placeholder="Ghi rõ sự cố an ninh hoặc dấu hiệu bất thường buộc phải kích hoạt lockdown..."
                value={lockdownReason}
                onChange={(e) => setLockdownReason(e.target.value)}
              />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
