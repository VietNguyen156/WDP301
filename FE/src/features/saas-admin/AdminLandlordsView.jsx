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
  CheckCircle2,
  Users,
  Landmark,
  Link2,
  Link2Off,
  Info,
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
  const debouncedSearch = useDebounced(search);
  const [statusFilter, setStatusFilter] = useState(""); // "" | "ACTIVE" | "SUSPENDED"

  // Landlord shown in the banking side panel.
  const [selectedForSepay, setSelectedForSepay] = useState(null);
  const [bankingSummary, setBankingSummary] = useState(null);

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
      setBankingSummary(res?.bankingSummary || null);

      setSelectedForSepay((current) =>
        (current && items.find((l) => l._id === current._id)) || items[0] || null,
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter]);
  useLiveRefresh(["admin", "plans", "subscription"], () => fetchLandlords(true));

  useEffect(() => {
    fetchLandlords();
  }, [fetchLandlords]);

  function handleSelectSepay(landlord) {
    setSelectedForSepay(landlord);
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
          : `Đã mở khóa hoạt động cho Chủ trọ "${selectedLandlord.name}".`,
      );
      setSelectedLandlord(null);
      fetchLandlords();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  function handleExportLandlordsCsv() {
    if (!landlords.length) {
      toast.info("Không có dữ liệu Chủ trọ để xuất CSV.");
      return;
    }
    const headers = ["ID", "HoTen", "Email", "SoDienThoai", "TrangThai", "GoiSaaS", "NganHang", "SoTaiKhoan", "NguonLienKet"];
    const rows = landlords.map((l) => [
      l._id,
      `"${(l.name || "").replace(/"/g, '""')}"`,
      `"${(l.email || l.username || "").replace(/"/g, '""')}"`,
      `"${(l.phoneNumber || "").replace(/"/g, '""')}"`,
      l.status || "",
      l.subscriptionId?.planId?.code || "NONE",
      `"${(l.bankConfig?.bankName || l.bankConfig?.bankCode || "").replace(/"/g, '""')}"`,
      `"${(l.bankConfig?.accountNumber || "").replace(/"/g, '""')}"`,
      l.banking?.source || "NONE",
    ]);
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `domus-landlords-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Đã xuất danh sách ${landlords.length} Chủ trọ ra file CSV.`);
  }

  const activeCount = landlords.filter((l) => l.status === "ACTIVE").length;
  const unmatchedOnPage = landlords.reduce((sum, l) => sum + (l.banking?.pendingUnmatched || 0), 0);

  return (
    <div className="admin-view-body animate-fade-in">
      {/* 1. Quick KPI Ribbon */}
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
            <span className="admin-kpi-label">Đã liên kết Bank Hub</span>
            <div className="admin-kpi-icon success">
              <Link2 size={18} />
            </div>
          </div>
          <div className="admin-kpi-num">{bankingSummary?.linked ?? "-"}</div>
          <div className="admin-kpi-sub success">
            <span className="live-dot" />
            <span>Chủ trọ tự liên kết, nhận đối soát tự động</span>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-top">
            <span className="admin-kpi-label">Chưa liên kết ngân hàng</span>
            <div className="admin-kpi-icon warning">
              <Link2Off size={18} />
            </div>
          </div>
          <div className="admin-kpi-num">
            {bankingSummary ? bankingSummary.none + bankingSummary.manual : "-"}
          </div>
          <div className="admin-kpi-sub warning">
            <span className="live-dot warning" />
            <span>
              {bankingSummary?.manual
                ? `${bankingSummary.manual} chỉ nhập STK tay (chỉ có VietQR)`
                : "Chủ trọ liên kết trong Hồ sơ › Ngân hàng"}
            </span>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-top">
            <span className="admin-kpi-label">Giao dịch chưa khớp</span>
            <div className="admin-kpi-icon secondary">
              <Landmark size={18} />
            </div>
          </div>
          <div className="admin-kpi-num">{unmatchedOnPage}</div>
          <div className="admin-kpi-sub secondary">
            <span>Chờ chủ trọ gán hóa đơn (trang hiện tại)</span>
          </div>
        </div>
      </div>

      {/* 2. Control & Search Toolbar */}
      <div className="admin-surface-toolbar">
        <div className="admin-toolbar-left">
          <div className="plans-segmented" role="tablist" aria-label="Trạng thái tài khoản">
            {[
              { value: "", label: "Tất cả trạng thái" },
              { value: "ACTIVE", label: "Đang hoạt động" },
              { value: "SUSPENDED", label: "Đang bị tạm khóa" },
            ].map((item) => (
              <button
                key={item.value || "ALL"}
                type="button"
                className={statusFilter === item.value ? "is-active" : ""}
                onClick={() => {
                  setStatusFilter(item.value);
                  setPage(1);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div style={{ position: "relative", minWidth: 280 }}>
            <Search
              size={15}
              style={{ position: "absolute", left: 10, top: 10, color: "#94a3b8" }}
            />
            <input
              type="text"
              className="admin-input"
              style={{ paddingLeft: 32, width: "100%" }}
              placeholder="Tìm theo tên chủ trọ, email, số điện thoại..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        <div className="admin-toolbar-right">
          <span style={{ fontSize: 13, color: "var(--on-surface-variant)" }}>
            Hiển thị <strong>{landlords.length}</strong> / <strong>{total}</strong> Chủ trọ
          </span>
          <button
            type="button"
            className="stitch-btn-secondary"
            onClick={handleExportLandlordsCsv}
          >
            <FileSpreadsheet size={14} />
            <span>Xuất CSV</span>
          </button>
          {onNavigateTab && (
            <button
              type="button"
              className="stitch-btn-secondary"
              onClick={() => onNavigateTab("security")}
            >
              <ShieldCheck size={14} />
              <span>Nhật ký Kiểm toán</span>
            </button>
          )}
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
                  <h2 className="admin-card-title">Danh sách Chủ trọ & Tài khoản nhận tiền</h2>
                  <span className="stitch-badge-live">Live Data</span>
                </div>
                <p className="admin-card-subtitle">
                  Nhấn vào một dòng Chủ trọ để tra cứu chi tiết tài khoản ngân hàng thụ hưởng và trạng thái đối soát SePay bên phải.
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
                      <th>Đối soát tự động</th>
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
                                  <span className="bank-tag">{bank.bankName || bank.bankCode || "Ngân hàng"}</span>
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
                                <span className="bank-tag unconfigured">Chưa liên kết</span>
                              </div>
                            )}
                            {l.banking?.source && (
                              <div style={{ fontSize: 10.5, color: "#64748b", marginTop: 2 }}>
                                {l.banking.source === "BANK_HUB" ? "Qua Bank Hub" : "Nhập tay trong hồ sơ"}
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
                            ) : l.banking?.autoReconcile ? (
                              <span className="status-pill active">
                                <span className="live-dot" /> Đang bật
                              </span>
                            ) : l.banking?.source === "BANK_HUB" ? (
                              <span className="status-pill pending" title="Đã liên kết nhưng gói dịch vụ không còn hiệu lực">
                                <span className="live-dot warning" /> Tạm dừng (gói)
                              </span>
                            ) : (
                              <span className="status-pill pending">
                                <span className="live-dot warning" /> Chưa liên kết
                              </span>
                            )}
                            {l.banking?.pendingUnmatched > 0 && (
                              <div style={{ fontSize: 10.5, color: "#b45309", marginTop: 2 }}>
                                {l.banking.pendingUnmatched} giao dịch chưa khớp
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                            <div className="admin-row-actions">
                              <button
                                type="button"
                                className="admin-action-btn primary"
                                title="Xem tài khoản nhận tiền và đối soát"
                                onClick={() => handleSelectSepay(l)}
                              >
                                <Landmark size={13} />
                                <span>Ngân hàng</span>
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

        {/* Right Column: receiving bank account & reconciliation (read-only monitoring) */}
        <div className="admin-bento-col-right">
          <div className="admin-sepay-panel">
            <div className="sepay-panel-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="terminal-icon-box">
                  <Landmark size={18} />
                </div>
                <div>
                  <h3 className="sepay-panel-title">Tài khoản nhận tiền & Đối soát</h3>
                  <p className="sepay-panel-subtitle">Chủ trọ tự liên kết qua SePay Bank Hub · chỉ xem</p>
                </div>
              </div>
            </div>

            {selectedForSepay ? (
              (() => {
                const l = selectedForSepay;
                const bank = l.bankConfig;
                const banking = l.banking || {};
                const sub = l.subscriptionId;
                const fmt = (d) => (d ? new Date(d).toLocaleString("vi-VN") : "—");
                return (
                  <div className="sepay-form-body">
                    <dl className="admin-bank-grid">
                      <dt>Chủ trọ</dt>
                      <dd>
                        <strong>{l.name}</strong>
                      </dd>
                      <dt>Liên kết</dt>
                      <dd>
                        {banking.source === "BANK_HUB" ? (
                          <span className="status-pill active">
                            <Link2 size={12} /> Bank Hub · {fmt(banking.linkedAt)}
                          </span>
                        ) : banking.source === "MANUAL" ? (
                          <span className="status-pill pending">Nhập STK tay (chỉ VietQR)</span>
                        ) : (
                          <span className="status-pill pending">
                            <Link2Off size={12} /> Chưa liên kết
                          </span>
                        )}
                      </dd>
                      <dt>Ngân hàng</dt>
                      <dd>{bank?.bankName || bank?.bankCode || "—"}</dd>
                      <dt>Số tài khoản</dt>
                      <dd style={{ fontFamily: "monospace", fontWeight: 600 }}>{bank?.accountNumber || "—"}</dd>
                      <dt>Chủ tài khoản</dt>
                      <dd style={{ textTransform: "uppercase" }}>{bank?.accountName || "—"}</dd>
                      <dt>Gói dịch vụ</dt>
                      <dd>
                        {sub?.planId?.name || "Không có"}
                        {sub && ` · ${sub.displayStatus === "ACTIVE" ? "đang hiệu lực" : "hết hiệu lực"}`}
                      </dd>
                      <dt>Đối soát tự động</dt>
                      <dd>
                        {banking.autoReconcile ? (
                          <span className="status-pill active">
                            <span className="live-dot" /> Đang bật
                          </span>
                        ) : (
                          <span className="status-pill pending">
                            <span className="live-dot warning" /> Không hoạt động
                          </span>
                        )}
                      </dd>
                      <dt>Chuyển khoản gần nhất</dt>
                      <dd>{fmt(banking.lastTransferAt)}</dd>
                      <dt>Giao dịch chưa khớp</dt>
                      <dd style={{ color: banking.pendingUnmatched ? "#b45309" : undefined, fontWeight: 600 }}>
                        {banking.pendingUnmatched || 0}
                      </dd>
                    </dl>

                    <div className="admin-bank-note">
                      <Info size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                      <div>
                        {banking.autoReconcile
                          ? "Tiền chuyển vào tài khoản này được SePay báo về và tự gạch nợ hóa đơn / tiền cọc theo nội dung chuyển khoản."
                          : l.status !== "ACTIVE"
                            ? "Tài khoản chủ trọ đang bị khóa: tiền vào vẫn được giữ ở “Giao dịch chưa khớp”, đối soát sau khi mở khóa."
                            : banking.source === "BANK_HUB"
                              ? "Đã liên kết nhưng gói dịch vụ không còn hiệu lực: giao dịch vào “Giao dịch chưa khớp” để chủ trọ gán tay."
                              : "Chủ trọ cần vào Hồ sơ › Ngân hàng để liên kết tài khoản qua SePay Bank Hub. Quản trị không nhập thay số tài khoản hay khóa API."}
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div style={{ padding: "40px 20px", textAlign: "center", color: "#64748b" }}>
                <Landmark size={32} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
                <p>Chọn một chủ trọ ở bảng bên trái để xem tài khoản nhận tiền và trạng thái đối soát.</p>
              </div>
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
