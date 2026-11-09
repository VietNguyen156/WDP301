import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Download,
  CheckCircle2,
  Search,
  RefreshCw,
  Eye,
  UserCheck,
  CreditCard,
  Layers,
  FileText,
  Clock,
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

const ACTION_META = {
  ADMIN_SET_LANDLORD_STATUS: {
    label: "Khóa / Mở khóa Chủ trọ",
    tone: "high",
    category: "USER",
  },
  CONFIRM_PLATFORM_PAYMENT: {
    label: "Xác nhận thu tiền SaaS",
    tone: "success",
    category: "FINANCE",
  },
  CREATE_PLATFORM_INVOICE: {
    label: "Phát hành Hóa đơn SaaS",
    tone: "info",
    category: "FINANCE",
  },
  CREATE_SUBSCRIPTION: {
    label: "Cấp mới Thuê bao SaaS",
    tone: "info",
    category: "SUBSCRIPTION",
  },
  UPDATE_SUBSCRIPTION: {
    label: "Cập nhật Thuê bao SaaS",
    tone: "warning",
    category: "SUBSCRIPTION",
  },
  CANCEL_SUBSCRIPTION: {
    label: "Hủy Thuê bao SaaS",
    tone: "high",
    category: "SUBSCRIPTION",
  },
  APPROVE_UPGRADE_REQUEST: {
    label: "Duyệt yêu cầu đổi gói",
    tone: "success",
    category: "SUBSCRIPTION",
  },
  REJECT_UPGRADE_REQUEST: {
    label: "Từ chối yêu cầu đổi gói",
    tone: "warning",
    category: "SUBSCRIPTION",
  },
  CREATE_SAAS_PLAN: {
    label: "Tạo Gói cước SaaS",
    tone: "info",
    category: "SUBSCRIPTION",
  },
  UPDATE_SAAS_PLAN: {
    label: "Cập nhật Gói cước SaaS",
    tone: "warning",
    category: "SUBSCRIPTION",
  },
  DELETE_SAAS_PLAN: {
    label: "Xóa Gói cước SaaS",
    tone: "high",
    category: "SUBSCRIPTION",
  },
};

const ENTITY_LABELS = {
  USER: "Tài khoản Chủ trọ",
  SUBSCRIPTION: "Thuê bao SaaS",
  PLATFORM_INVOICE: "Hóa đơn SaaS",
  SAAS_PLAN: "Gói cước SaaS",
  UPGRADE_REQUEST: "Yêu cầu đổi gói",
};

function summarizeAuditLog(log) {
  const after = log.after || {};
  const before = log.before || {};

  if (log.action === "ADMIN_SET_LANDLORD_STATUS") {
    const statusText =
      after.status === "SUSPENDED"
        ? "Tạm khóa tài khoản"
        : after.status === "ACTIVE"
          ? "Mở khóa hoạt động"
          : after.status || "Thay đổi trạng thái";
    return after.reason ? `${statusText} · Lý do: ${after.reason}` : statusText;
  }

  if (log.action === "CONFIRM_PLATFORM_PAYMENT") {
    const ref = after.paymentReference ? `Mã GD: ${after.paymentReference}` : "";
    const gw = after.paymentGateway ? `Cổng: ${after.paymentGateway}` : "";
    return [ref, gw].filter(Boolean).join(" · ") || "Xác nhận thanh toán hóa đơn SaaS";
  }

  if (after.reason) {
    return `Lý do: ${after.reason}`;
  }

  if (before.status && after.status && before.status !== after.status) {
    return `Trạng thái: ${before.status} → ${after.status}`;
  }

  if (after.code || after.name) {
    return `Đối tượng: ${after.name || ""} ${after.code ? `(${after.code})` : ""}`.trim();
  }

  if (after.status) {
    return `Trạng thái mới: ${after.status}`;
  }

  return `Thao tác kiểm toán trên ${ENTITY_LABELS[log.entityType] || log.entityType || "hệ thống"}`;
}

export function AdminSecurityView() {
  const toast = useToast();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters supported by backend + client-side search
  const [entityFilter, setEntityFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchAuditLogs = useCallback(
    async (silent) => {
      if (silent !== true) setLoading(true);
      setError(null);
      try {
        const params = { page, limit: 15 };
        if (actionFilter) params.action = actionFilter;
        if (entityFilter) params.entityType = entityFilter;
        const res = await adminApi.listAuditLogs(params);
        setLogs(res?.items || []);
        setTotal(res?.total || 0);
      } catch (err) {
        setError(errorMessage(err));
        setLogs([]);
      } finally {
        setLoading(false);
      }
    },
    [page, actionFilter, entityFilter],
  );

  useLiveRefresh(["admin"], () => fetchAuditLogs(true));

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((log) => {
      const actor = `${log.actorId?.name || ""} ${log.actorId?.email || ""}`.toLowerCase();
      const target = `${log.landlordId?.name || ""} ${log.landlordId?.email || ""}`.toLowerCase();
      const action = `${log.action || ""} ${ACTION_META[log.action]?.label || ""}`.toLowerCase();
      const summary = summarizeAuditLog(log).toLowerCase();
      return (
        actor.includes(q) ||
        target.includes(q) ||
        action.includes(q) ||
        summary.includes(q) ||
        String(log.entityId || "").toLowerCase().includes(q)
      );
    });
  }, [logs, searchQuery]);

  // Derived KPI counts from current dataset
  const stats = useMemo(() => {
    let userActions = 0;
    let financeActions = 0;
    let subPlanActions = 0;
    for (const log of logs) {
      const cat = ACTION_META[log.action]?.category;
      if (cat === "USER" || log.entityType === "USER") userActions += 1;
      else if (cat === "FINANCE" || log.entityType === "PLATFORM_INVOICE") financeActions += 1;
      else subPlanActions += 1;
    }
    return { userActions, financeActions, subPlanActions };
  }, [logs]);

  function handleExportCsv() {
    if (!filteredLogs.length) {
      toast.info("Không có bản ghi nhật ký nào để xuất CSV.");
      return;
    }
    const headers = [
      "ThoiGian",
      "TacNhan",
      "EmailTacNhan",
      "HanhDong",
      "LoaiDoiTuong",
      "ChuTroLienQuan",
      "MoTaTomTat",
    ];
    const rows = filteredLogs.map((log) => [
      new Date(log.createdAt).toISOString(),
      `"${(log.actorId?.name || log.actorRole || "SUPER_ADMIN").replace(/"/g, '""')}"`,
      `"${(log.actorId?.email || "").replace(/"/g, '""')}"`,
      `"${log.action || ""}"`,
      `"${log.entityType || ""}"`,
      `"${(log.landlordId?.name || log.landlordId?.email || "").replace(/"/g, '""')}"`,
      `"${summarizeAuditLog(log).replace(/"/g, '""')}"`,
    ]);
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `domus-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Đã xuất ${filteredLogs.length} bản ghi nhật ký kiểm toán ra file CSV.`);
  }

  return (
    <div className="admin-view-body animate-fade-in">
      {/* 1. Real Audit Telemetry KPI Ribbon */}
      <div className="admin-kpi-ribbon">
        <div className="admin-kpi-card">
          <div className="admin-kpi-top">
            <span className="admin-kpi-label">Tổng bản ghi Audit Log</span>
            <div className="admin-kpi-icon primary">
              <ShieldCheck size={18} />
            </div>
          </div>
          <div className="admin-kpi-num">{total}</div>
          <div className="admin-kpi-sub primary">
            <CheckCircle2 size={13} />
            <span>Lưu vết bất biến mọi thao tác cấp Super Admin</span>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-top">
            <span className="admin-kpi-label">Can thiệp Tài khoản Chủ trọ</span>
            <div className="admin-kpi-icon warning">
              <UserCheck size={18} />
            </div>
          </div>
          <div className="admin-kpi-num">{stats.userActions}</div>
          <div className="admin-kpi-sub warning">
            <Clock size={13} />
            <span>Khóa / mở khóa quyền truy cập trong trang hiện tại</span>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-top">
            <span className="admin-kpi-label">Đối soát & Hóa đơn SaaS</span>
            <div className="admin-kpi-icon success">
              <CreditCard size={18} />
            </div>
          </div>
          <div className="admin-kpi-num">{stats.financeActions}</div>
          <div className="admin-kpi-sub success">
            <CheckCircle2 size={13} />
            <span>Xác nhận thu tiền & phát hành hóa đơn nền tảng</span>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-top">
            <span className="admin-kpi-label">Thuê bao & Gói cước SaaS</span>
            <div className="admin-kpi-icon secondary">
              <Layers size={18} />
            </div>
          </div>
          <div className="admin-kpi-num">{stats.subPlanActions}</div>
          <div className="admin-kpi-sub secondary">
            <FileText size={13} />
            <span>Cấp gói, gia hạn, hủy thuê bao & cấu hình bảng giá</span>
          </div>
        </div>
      </div>

      {/* 2. Filter & Search Toolbar */}
      <div className="admin-surface-toolbar">
        <div className="admin-toolbar-left">
          <div className="plans-segmented" role="tablist" aria-label="Lọc theo phân hệ">
            {[
              { value: "", label: "Tất cả phân hệ" },
              { value: "USER", label: "Tài khoản" },
              { value: "SUBSCRIPTION", label: "Thuê bao" },
              { value: "PLATFORM_INVOICE", label: "Hóa đơn SaaS" },
              { value: "SAAS_PLAN", label: "Gói cước" },
            ].map((tab) => (
              <button
                key={tab.value || "ALL"}
                type="button"
                className={entityFilter === tab.value ? "is-active" : ""}
                onClick={() => {
                  setEntityFilter(tab.value);
                  setPage(1);
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <select
            className="admin-select"
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả loại hành động</option>
            {Object.entries(ACTION_META).map(([code, meta]) => (
              <option key={code} value={code}>
                {meta.label} ({code})
              </option>
            ))}
          </select>
        </div>

        <div className="admin-toolbar-right">
          <div style={{ position: "relative", minWidth: 240 }}>
            <Search
              size={14}
              style={{ position: "absolute", left: 10, top: 10, color: "#94a3b8" }}
            />
            <input
              type="text"
              className="admin-input"
              style={{ paddingLeft: 30, width: "100%" }}
              placeholder="Tìm tác nhân, chủ trọ, lý do..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <button
            type="button"
            className="stitch-btn-secondary"
            onClick={() => fetchAuditLogs()}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? "spin" : ""} />
            <span>Làm mới</span>
          </button>

          <button
            type="button"
            className="stitch-btn-primary"
            onClick={handleExportCsv}
            disabled={!filteredLogs.length}
          >
            <Download size={14} />
            <span>Xuất CSV</span>
          </button>
        </div>
      </div>

      {/* 3. Immutable Audit Log Table */}
      <div className="admin-table-card">
        <div className="admin-card-header">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h2 className="admin-card-title">
                Nhật ký Kiểm toán Hệ thống (Audit Trail)
              </h2>
              <span className="stitch-badge-live">Immutable Log</span>
            </div>
            <p className="admin-card-subtitle">
              Ghi nhận toàn bộ lịch sử thao tác quản trị kèm dữ liệu Trước / Sau (Before & After Snapshot) để phục vụ hậu kiểm.
            </p>
          </div>
          <div style={{ fontSize: 13, color: "#64748b" }}>
            Hiển thị <strong>{filteredLogs.length}</strong> / <strong>{total}</strong> bản ghi
          </div>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Người thực hiện (Actor)</th>
                <th>Hành động</th>
                <th>Đối tượng tác động</th>
                <th>Tóm tắt thay đổi</th>
                <th style={{ textAlign: "right" }}>Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6">
                    <LoadingState message="Đang tải nhật ký kiểm toán..." />
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="6">
                    <ErrorState message={error} retry={fetchAuditLogs} />
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="6">
                    <EmptyState
                      title="Chưa có bản ghi kiểm toán phù hợp"
                      description="Thử thay đổi bộ lọc phân hệ, loại hành động hoặc từ khóa tìm kiếm."
                    />
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const actorName =
                    log.actorId?.name || log.actorRole || "Super Admin";
                  const actorEmail = log.actorId?.email || "";
                  const meta = ACTION_META[log.action] || {
                    label: log.action,
                    tone: "info",
                  };
                  const entityLabel =
                    ENTITY_LABELS[log.entityType] || log.entityType || "Hệ thống";
                  const targetLandlord = log.landlordId;

                  return (
                    <tr key={log._id}>
                      <td>
                        <div
                          style={{
                            fontSize: 12.5,
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
                        <div style={{ fontSize: 11.5, color: "#64748b" }}>
                          {new Date(log.createdAt).toLocaleDateString("vi-VN")}
                        </div>
                      </td>

                      <td>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
                          {actorName}
                        </div>
                        <div style={{ fontSize: 11.5, color: "#64748b" }}>
                          {actorEmail || log.actorRole || "SUPER_ADMIN"}
                        </div>
                      </td>

                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <span
                            className={`risk-pill ${
                              meta.tone === "high"
                                ? "high"
                                : meta.tone === "warning"
                                  ? "warning"
                                  : "info"
                            }`}
                            style={{ width: "fit-content" }}
                          >
                            {meta.tone === "high" && <ShieldAlert size={11} />}
                            <span>{meta.label}</span>
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              color: "#64748b",
                              fontFamily: "monospace",
                            }}
                          >
                            {log.action}
                          </span>
                        </div>
                      </td>

                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: "#1e293b" }}>
                            {targetLandlord?.name || entityLabel}
                          </span>
                          <span style={{ fontSize: 11.5, color: "#64748b" }}>
                            {targetLandlord?.email
                              ? `${entityLabel} · ${targetLandlord.email}`
                              : log.entityId
                                ? `ID: ${String(log.entityId).slice(-8)}`
                                : entityLabel}
                          </span>
                        </div>
                      </td>

                      <td>
                        <div
                          style={{
                            fontSize: 12.5,
                            color: "#334155",
                            maxWidth: 340,
                            lineHeight: 1.45,
                          }}
                        >
                          {summarizeAuditLog(log)}
                        </div>
                      </td>

                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          className="admin-action-btn"
                          onClick={() => setSelectedLog(log)}
                        >
                          <Eye size={13} />
                          <span>Chi tiết</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--outline-variant)" }}>
          <Pagination
            page={page}
            total={total}
            limit={15}
            onChange={(p) => setPage(p)}
          />
        </div>
      </div>

      {/* Modal Xem chi tiết Bản ghi Kiểm toán (Before / After Snapshot) */}
      {selectedLog && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedLog(null)}
          title={`Chi tiết Kiểm toán: ${
            ACTION_META[selectedLog.action]?.label || selectedLog.action
          }`}
          subtitle={`Thời gian: ${new Date(selectedLog.createdAt).toLocaleString("vi-VN")} · Mã bản ghi: ${selectedLog._id}`}
          maxWidth="680px"
          footer={
            <Button variant="secondary" onClick={() => setSelectedLog(null)}>
              Đóng
            </Button>
          }
        >
          <div className="admin-form">
            <div className="admin-box" style={{ background: "#f8fafc" }}>
              <div className="admin-key-value-list">
                <div className="admin-kv-row">
                  <span className="admin-kv-label">Người thực hiện (Actor)</span>
                  <span className="admin-kv-val">
                    {selectedLog.actorId?.name || "Super Admin"}{" "}
                    {selectedLog.actorId?.email ? `(${selectedLog.actorId.email})` : ""}
                  </span>
                </div>
                <div className="admin-kv-row">
                  <span className="admin-kv-label">Mã nghiệp vụ (Action Code)</span>
                  <span className="admin-kv-val" style={{ fontFamily: "monospace" }}>
                    {selectedLog.action}
                  </span>
                </div>
                <div className="admin-kv-row">
                  <span className="admin-kv-label">Loại đối tượng (Entity Type)</span>
                  <span className="admin-kv-val">
                    {ENTITY_LABELS[selectedLog.entityType] || selectedLog.entityType} (
                    {String(selectedLog.entityId || "—")})
                  </span>
                </div>
                {selectedLog.landlordId && (
                  <div className="admin-kv-row">
                    <span className="admin-kv-label">Chủ trọ liên quan</span>
                    <span className="admin-kv-val">
                      {selectedLog.landlordId.name} ({selectedLog.landlordId.email})
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="audit-diff-grid">
              <div className="audit-diff-panel">
                <div className="audit-diff-title">Dữ liệu Trước thao tác (Before)</div>
                <pre className="audit-diff-pre">
                  {selectedLog.before
                    ? JSON.stringify(selectedLog.before, null, 2)
                    : "Không có dữ liệu trước (Tạo mới)"}
                </pre>
              </div>
              <div className="audit-diff-panel">
                <div className="audit-diff-title">Dữ liệu Sau thao tác (After)</div>
                <pre className="audit-diff-pre">
                  {selectedLog.after
                    ? JSON.stringify(selectedLog.after, null, 2)
                    : "Không có dữ liệu sau"}
                </pre>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
