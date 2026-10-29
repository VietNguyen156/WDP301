import React, { useState, useEffect } from "react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { invoiceService } from "../../services/invoiceService";
import { branchService } from "../../services/branchService";
import { roomApi } from "../../services/api";
import { useToast } from "../../context/ToastContext";
import { Zap, Search, Lightbulb } from "lucide-react";

export function InvoiceGenerateModal({ isOpen, onClose, onGenerated, defaultBranchId }) {
  const { toast } = useToast();
  const [branches, setBranches] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Default next month or current month
  const now = new Date();
  const currentMonthPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Default dueDate is 5th of that month
  const defaultDueDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-05`;

  const [formData, setFormData] = useState({
    branchId: defaultBranchId || "",
    billingPeriod: currentMonthPeriod,
    dueDate: defaultDueDate,
    targetMode: "ALL", // "ALL" or "CUSTOM"
  });
  // Rented rooms of the chosen branch (only those can be billed) and the ticked ones.
  const [rooms, setRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [selectedRoomIds, setSelectedRoomIds] = useState([]);
  const [roomSearch, setRoomSearch] = useState("");

  useEffect(() => {
    if (!isOpen || formData.targetMode !== "CUSTOM" || !formData.branchId) return undefined;
    let active = true;
    setLoadingRooms(true);
    setSelectedRoomIds([]);
    (async () => {
      try {
        const all = [];
        // The API pages at most 100 rooms; keep reading until every rented room is loaded.
        for (let page = 1; ; page += 1) {
          const res = await roomApi.list(formData.branchId, { status: "RENTED", limit: 100, page });
          const items = res?.items || [];
          all.push(...items);
          if (!items.length || all.length >= (res?.total || 0)) break;
        }
        if (active) setRooms(all);
      } catch (err) {
        if (active) {
          setRooms([]);
          toast.error(err.message || "Không tải được danh sách phòng của cơ sở");
        }
      } finally {
        if (active) setLoadingRooms(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [isOpen, formData.targetMode, formData.branchId, toast]);

  const allSelected = rooms.length > 0 && selectedRoomIds.length === rooms.length;
  const toggleRoom = (id) =>
    setSelectedRoomIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    );
  const toggleAll = () => setSelectedRoomIds(allSelected ? [] : rooms.map((r) => r._id));

  const filteredRooms = rooms.filter((r) => {
    if (!roomSearch.trim()) return true;
    const term = roomSearch.trim().toLowerCase();
    return (
      (r.roomNumber || "").toLowerCase().includes(term) ||
      (r.currentTenantName || "").toLowerCase().includes(term)
    );
  });

  useEffect(() => {
    if (isOpen) {
      branchService.getBranches().then((data) => {
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.items)
          ? data.items
          : [];
        setBranches(list);
        setFormData((prev) => {
          const currentId = defaultBranchId || prev.branchId;
          const matched = list.find(
            (b) => String(b._id || b.id) === String(currentId)
          );
          if (matched) {
            return { ...prev, branchId: matched._id || matched.id };
          }
          if (list.length > 0 && !prev.branchId) {
            return { ...prev, branchId: list[0]._id || list[0].id };
          }
          return prev;
        });
      });
    }
  }, [isOpen, defaultBranchId]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.branchId) {
      toast.warning("Vui lòng chọn cơ sở cần tạo hóa đơn!");
      return;
    }
    if (!formData.billingPeriod) {
      toast.warning("Vui lòng chọn kỳ hóa đơn (YYYY-MM)!");
      return;
    }
    if (!formData.dueDate) {
      toast.warning("Vui lòng chọn hạn chót nộp tiền!");
      return;
    }

    const payload = {
      branchId: formData.branchId,
      billingPeriod: formData.billingPeriod,
      dueDate: formData.dueDate,
    };

    if (formData.targetMode === "CUSTOM") {
      if (!selectedRoomIds.length) {
        toast.warning("Vui lòng tích chọn ít nhất một phòng!");
        return;
      }
      payload.roomIds = selectedRoomIds;
    }

    try {
      setSubmitting(true);
      const res = await invoiceService.generateInvoices(payload);
      toast.success(
        res?.message || `Đã sinh thành công hóa đơn cho kỳ ${formData.billingPeriod}!`
      );
      onGenerated?.();
      onClose();
    } catch (err) {
      toast.error(err.message || "Tạo hóa đơn thất bại. Vui lòng kiểm tra lại dữ liệu chốt số.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Tạo đợt Hóa đơn Hàng tháng"
      subtitle="Hệ thống tự động gom số điện nước đã chốt, tiền phòng và dịch vụ để tính hóa đơn"
      maxWidth="620px"
      footer={
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", width: "100%" }}>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Hủy bỏ
          </Button>
          <Button variant="primary" loading={submitting} onClick={handleSubmit}>
            <Zap size={16} />
            <span>Bắt đầu tạo hóa đơn</span>
          </Button>
        </div>
      }
    >
      <form className="invoice-modal-form" onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <Select
          label="Cơ sở / Tòa nhà áp dụng"
          required
          value={formData.branchId}
          onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
        >
          <option value="">-- Chọn cơ sở --</option>
          {branches.map((b) => (
            <option key={b._id || b.id} value={b._id || b.id}>
              {b.name || b.branchName || `Cơ sở ${b._id || b.id}`}
            </option>
          ))}
        </Select>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
          <Input
            label="Kỳ tính tiền (Tháng/Năm)"
            type="month"
            required
            value={formData.billingPeriod}
            onChange={(e) => setFormData({ ...formData, billingPeriod: e.target.value })}
            helperText="Định dạng chuẩn YYYY-MM"
          />

          <Input
            label="Hạn thanh toán"
            type="date"
            required
            value={formData.dueDate}
            onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
            helperText="Sau ngày này sẽ cảnh báo Quá hạn"
          />
        </div>

        <Select
          label="Phạm vi phòng áp dụng"
          value={formData.targetMode}
          onChange={(e) => setFormData({ ...formData, targetMode: e.target.value })}
        >
          <option value="ALL">Toàn bộ phòng đang thuê trong cơ sở</option>
          <option value="CUSTOM">Chỉ tạo cho các phòng được chọn</option>
        </Select>

        {formData.targetMode === "CUSTOM" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              padding: "12px",
              backgroundColor: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "10px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b" }}>
                Chọn phòng đang thuê ({selectedRoomIds.length}/{rooms.length})
              </span>
              {rooms.length > 0 && (
                <button
                  type="button"
                  onClick={toggleAll}
                  style={{
                    border: "none",
                    background: "none",
                    color: "var(--primary, #005c55)",
                    fontWeight: 600,
                    fontSize: "12.5px",
                    cursor: "pointer",
                    padding: "2px 6px",
                    borderRadius: "4px",
                  }}
                >
                  {allSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                </button>
              )}
            </div>

            {rooms.length > 4 && (
              <div style={{ position: "relative" }}>
                <Search size={14} color="#94a3b8" style={{ position: "absolute", left: "9px", top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type="text"
                  value={roomSearch}
                  onChange={(e) => setRoomSearch(e.target.value)}
                  placeholder="Tìm nhanh theo số phòng hoặc tên khách thuê..."
                  style={{
                    width: "100%",
                    padding: "6px 10px 6px 28px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    fontSize: "12px",
                    backgroundColor: "#ffffff",
                    outline: "none",
                  }}
                />
              </div>
            )}

            <div
              style={{
                maxHeight: "220px",
                overflowY: "auto",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                gap: "8px",
                paddingRight: "2px",
              }}
            >
              {loadingRooms ? (
                <span style={{ fontSize: "12.5px", color: "#64748b", padding: "12px", textAlign: "center", gridColumn: "1 / -1" }}>
                  Đang tải danh sách phòng…
                </span>
              ) : rooms.length === 0 ? (
                <span style={{ fontSize: "12.5px", color: "#64748b", padding: "12px", textAlign: "center", gridColumn: "1 / -1" }}>
                  Cơ sở này hiện chưa có phòng đang cho thuê.
                </span>
              ) : filteredRooms.length === 0 ? (
                <span style={{ fontSize: "12.5px", color: "#64748b", padding: "12px", textAlign: "center", gridColumn: "1 / -1" }}>
                  Không tìm thấy phòng phù hợp từ khóa tìm kiếm.
                </span>
              ) : (
                filteredRooms.map((room) => {
                  const checked = selectedRoomIds.includes(room._id);
                  return (
                    <label
                      key={room._id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        cursor: "pointer",
                        border: checked ? "1.5px solid var(--primary, #005c55)" : "1px solid #e2e8f0",
                        backgroundColor: checked ? "#f0fdfa" : "#ffffff",
                        transition: "all 0.15s ease",
                        userSelect: "none",
                        boxShadow: checked ? "0 1px 3px rgba(0, 92, 85, 0.08)" : "none",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRoom(room._id)}
                        style={{
                          accentColor: "var(--primary, #005c55)",
                          width: "16px",
                          height: "16px",
                          cursor: "pointer",
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "4px" }}>
                          <strong style={{ fontSize: "13px", color: checked ? "var(--primary, #005c55)" : "#0f172a", fontWeight: 700 }}>
                            Phòng {room.roomNumber}
                          </strong>
                          <span
                            style={{
                              fontSize: "11px",
                              color: checked ? "#0f766e" : "#64748b",
                              backgroundColor: checked ? "#ccfbf1" : "#f1f5f9",
                              padding: "1px 5px",
                              borderRadius: "4px",
                              fontWeight: 600,
                            }}
                          >
                            T.{room.floor || 1}
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: "12px",
                            color: checked ? "#0f766e" : "#64748b",
                            marginTop: "2px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={room.currentTenantName || `Tầng ${room.floor || 1}`}
                        >
                          {room.currentTenantName || "Đang thuê"}
                        </span>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        )}

        <div
          style={{
            padding: "12px 14px",
            backgroundColor: "#f0fdfa",
            border: "1px solid #ccfbf1",
            borderRadius: "10px",
            fontSize: "13px",
            color: "#0f766e",
            lineHeight: 1.5,
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
          }}
        >
          <Lightbulb size={18} style={{ flexShrink: 0, marginTop: "2px", color: "var(--primary)" }} />
          <div>
            <strong style={{ color: "#005c55" }}>Quy trình phát hành:</strong>{" "}
            Hóa đơn mới tạo sẽ ở trạng thái <strong>Bản nháp</strong> để bạn rà soát lại số điện nước và tiền phòng. Sau khi kiểm tra, bấm <strong>Phát hành</strong> để kích hoạt mã VietQR và gửi link thanh toán cho khách thuê.
          </div>
        </div>
      </form>
    </Modal>
  );
}
