import React, { useState, useEffect } from "react";
import {
  CheckCircle2,
  Check,
  Crown,
  Sparkles,
  Zap,
  Building2,
  DoorOpen,
  Users,
  Headphones,
  ArrowRight,
  Clock,
  AlertTriangle,
  Loader2,
  X,
  CreditCard,
  ExternalLink,
} from "lucide-react";
import { Modal, Button } from "../../components/ui";
import { money } from "../../utils/format";
import { useToast } from "../../context/ToastContext";
import { planApi, errorMessage } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

const FALLBACK_PLANS = [
  {
    code: "FREE_TRIAL",
    name: "Gói Dùng Thử",
    price: 0,
    trialDays: 30,
    maxBranches: 1,
    maxRooms: 5,
    maxManagers: 1,
    features: [
      "Quản lý 1 cơ sở, tối đa 5 phòng",
      "1 Quản lý cơ sở phân quyền",
      "Chốt số điện nước Mobile-first",
      "Xuất hóa đơn & sinh mã VietQR",
      "Gửi link hóa đơn No-App cho khách",
    ],
    selectable: false,
  },
  {
    code: "STARTER",
    name: "Gói Starter (Chuỗi nhỏ)",
    price: 199000,
    billingCycle: "MONTHLY",
    maxBranches: 1,
    maxRooms: 20,
    maxManagers: 2,
    features: [
      "Quản lý 1 cơ sở, tối đa 20 phòng",
      "2 Quản lý cơ sở phân quyền",
      "Tự động hóa tính toán tiền phòng",
      "Mã VietQR động gạch nợ tức thì",
      "Đối soát ngân hàng SePay Webhook",
      "Báo cáo công nợ & nhắc nợ Zalo",
    ],
    selectable: true,
  },
  {
    code: "PRO",
    name: "Gói Chuyên Nghiệp (Pro)",
    price: 499000,
    billingCycle: "MONTHLY",
    maxBranches: 5,
    maxRooms: 100,
    maxManagers: 5,
    features: [
      "Quản lý tới 5 cơ sở, 100 phòng",
      "5 Quản lý cơ sở phân quyền",
      "Tất cả tính năng của gói Starter",
      "Quản lý sự cố & bảo trì hiện trường",
      "3-Second Dashboard dòng tiền realtime",
      "Phân quyền RBAC & Quản lý nhân sự",
      "Bảo toàn dữ liệu tài chính & Xóa mềm",
    ],
    selectable: true,
  },
  {
    code: "ENTERPRISE",
    name: "Gói Doanh Nghiệp",
    price: 999000,
    billingCycle: "MONTHLY",
    maxBranches: 999,
    maxRooms: 9999,
    maxManagers: 99,
    features: [
      "Không giới hạn số cơ sở & số phòng",
      "Không giới hạn tài khoản nhân viên",
      "Tất cả tính năng của gói Pro",
      "Hỗ trợ kỹ thuật ưu tiên 24/7 (SLA 99.9%)",
      "Tích hợp đồng hồ thông minh IoT",
      "Xuất báo cáo thuế & kế toán chuyên sâu",
    ],
    selectable: true,
  },
];

export function SaaSPlansModal({
  isOpen,
  onClose,
  currentPlan,
  branchesCount = 0,
  user,
}) {
  const toast = useToast();
  const { refreshUser } = useAuth();
  const [verifying, setVerifying] = useState(false);
  const [plansData, setPlansData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submittingId, setSubmittingId] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [pendingInvoice, setPendingInvoice] = useState(null);
  const [selectedPlanCode, setSelectedPlanCode] = useState(
    currentPlan?.code || "PRO"
  );

  const fetchPlans = async () => {
    try {
      const res = await planApi.getPlans();
      if (res) {
        setPlansData(res);
        if (res.current?.plan?.code) {
          setSelectedPlanCode(res.current.plan.code);
        }
      }
      const invRes = await planApi.listInvoices({ status: "PENDING", limit: 5 });
      const payableInvoice = invRes?.items?.find(
        (i) => i.status === "PENDING" || (i.status === "OVERDUE" && i.payable)
      );
      setPendingInvoice(payableInvoice || null);
    } catch {
      // Fallback silently if non-landlord role
    }
  };

  useEffect(() => {
    let active = true;
    if (isOpen) {
      setLoading(true);
      fetchPlans().finally(() => {
        if (active) setLoading(false);
      });

      // Back from SePay (/plans?payment=...&invoice=...): the redirect alone proves nothing,
      // so ask the backend to confirm with SePay before announcing success.
      const params = new URLSearchParams(window.location.search);
      const paymentStatus = params.get("payment");
      const invoiceCode = params.get("invoice");
      if (paymentStatus) window.history.replaceState(null, "", window.location.pathname);
      if (paymentStatus === "success") {
        verifyReturn(invoiceCode);
      } else if (paymentStatus === "error" || paymentStatus === "cancel") {
        toast.warning("Giao dịch thanh toán qua cổng SePay chưa hoàn tất hoặc đã bị hủy.");
      }
    }
    return () => {
      active = false;
    };
  }, [isOpen]);

  // SePay may need a few seconds after the redirect, so retry a little before giving up.
  async function verifyPayment(invoiceId, attempts = 1) {
    setVerifying(true);
    try {
      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        const res = await planApi.verifyPayment(invoiceId);
        if (res?.status === "PAID") {
          await Promise.all([refreshUser(), fetchPlans()]);
          toast.success("Thanh toán đã được SePay xác nhận. Gói mới đã được kích hoạt!");
          if (res.duplicateOrders > 0)
            toast.warning("Phát hiện hóa đơn bị thanh toán nhiều lần. Quản trị viên sẽ liên hệ để hoàn tiền khoản trùng.");
          return true;
        }
        if (res?.status === "UNAPPLIED") {
          toast.error("SePay đã nhận tiền nhưng không thể kích hoạt gói. Vui lòng liên hệ quản trị viên.");
          return false;
        }
        if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 3000));
      }
      toast.info("SePay chưa xác nhận thanh toán. Vui lòng bấm \"Kiểm tra thanh toán\" sau ít phút.");
      return false;
    } catch (err) {
      toast.error(errorMessage(err));
      return false;
    } finally {
      setVerifying(false);
    }
  }

  async function verifyReturn(invoiceCode) {
    try {
      const res = await planApi.listInvoices({ limit: 20 });
      const invoice = (res?.items || []).find((item) => item.invoiceCode === invoiceCode);
      if (!invoice) return;
      if (invoice.status === "PAID") {
        await refreshUser();
        toast.success(`Hóa đơn ${invoiceCode} đã được thanh toán.`);
        return;
      }
      await verifyPayment(invoice.id || invoice._id, 4);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function handleCheckout(invoiceId) {
    if (!invoiceId) return;
    setCheckingOut(true);
    try {
      const res = await planApi.checkoutInvoice(invoiceId, { paymentMethod: "BANK_TRANSFER" });
      if (res?.checkoutUrl && res?.fields) {
        toast.info("Đang chuyển hướng tới cổng thanh toán an toàn SePay...");
        const form = document.createElement("form");
        form.method = res.method || "POST";
        form.action = res.checkoutUrl;
        for (const [name, value] of Object.entries(res.fields)) {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = name;
          input.value = value;
          form.appendChild(input);
        }
        document.body.appendChild(form);
        form.submit();
      }
    } catch (err) {
      toast.error(errorMessage(err));
      // The invoice turned out to be paid already (lost IPN): show the activated plan.
      if (err?.response?.data?.errorCode === "PLATFORM_INVOICE_ALREADY_PAID")
        await Promise.all([refreshUser(), fetchPlans()]);
      setCheckingOut(false);
    }
  }

  if (!isOpen) return null;

  const currentSub = plansData?.current;
  const pendingSub = plansData?.pending;
  const upgradeRequest = plansData?.upgradeRequest;
  const usage = plansData?.usage;
  const rawItems = plansData?.items?.length ? plansData.items : FALLBACK_PLANS;

  // Enhance items with flags
  const items = rawItems.map((item) => {
    const isCurrent =
      item.isCurrent ?? (item.code === (currentSub?.plan?.code || currentPlan?.code));
    const isPending = Boolean(item.isPending);
    const isRequested = Boolean(
      item.isRequested ||
        (upgradeRequest &&
          String(upgradeRequest.planId?._id || upgradeRequest.planId?.id || upgradeRequest.planId) ===
            String(item.id || item._id))
    );
    const blockedBy = item.blockedBy || [];
    const isSelectable =
      item.selectable !== undefined
        ? item.selectable
        : item.code !== "FREE_TRIAL" && blockedBy.length === 0;

    return {
      ...item,
      isCurrent,
      isPending,
      isRequested,
      blockedBy,
      selectable: isSelectable,
    };
  });

  const activePlan =
    items.find((p) => p.isCurrent) ||
    items.find((p) => p.code === currentPlan?.code) ||
    items[0];

  async function handleUpgradeRequest(plan) {
    if (plan.isPending) {
      toast.info(`Gói ${plan.name} đang trong trạng thái chờ duyệt thanh toán.`);
      return;
    }
    if (plan.isRequested) {
      toast.info(`Bạn đã gửi yêu cầu cho gói ${plan.name} rồi.`);
      return;
    }
    if (!plan.selectable && plan.blockedBy?.length > 0) {
      toast.error(
        `Không thể chọn ${plan.name} do vượt quá dung lượng đang dùng.`
      );
      return;
    }

    if (!plan.id) {
      toast.info("Đã ghi nhận yêu cầu tư vấn gói dịch vụ.");
      return;
    }

    setSubmittingId(plan.id);
    try {
      await planApi.requestUpgrade({
        planId: plan.id,
        note: plan.isCurrent ? "Yêu cầu gia hạn gói đang dùng" : "Yêu cầu đổi gói dịch vụ",
      });
      toast.success(
        `Đã gửi yêu cầu ${plan.isCurrent ? "gia hạn" : "đổi sang"} gói ${plan.name} tới quản trị viên!`
      );
      await fetchPlans();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSubmittingId(null);
    }
  }

  async function handleCancelRequest(requestId) {
    if (!requestId) return;
    setCancellingId(requestId);
    try {
      await planApi.cancelUpgradeRequest(requestId);
      toast.success("Đã hủy yêu cầu đổi gói thành công.");
      await fetchPlans();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setCancellingId(null);
    }
  }

  // Quota formatting
  const roomsUsed = usage?.rooms?.used ?? 0;
  const roomsLimit = usage?.rooms?.limit ?? activePlan?.maxRooms ?? 5;
  const isRoomsUnlimited = roomsLimit >= 9999;
  const roomsPercent = isRoomsUnlimited
    ? 20
    : Math.min(100, Math.round((roomsUsed / Math.max(1, roomsLimit)) * 100));
  const isRoomsNearLimit = !isRoomsUnlimited && roomsLimit - roomsUsed <= 1;

  const branchesUsed = usage?.branches?.used ?? branchesCount ?? 0;
  const branchesLimit = usage?.branches?.limit ?? activePlan?.maxBranches ?? 1;
  const isBranchesUnlimited = branchesLimit >= 999;
  const branchesPercent = isBranchesUnlimited
    ? 20
    : Math.min(100, Math.round((branchesUsed / Math.max(1, branchesLimit)) * 100));

  const formatQuota = (val, suffix, infiniteThreshold = 999) => {
    if (val >= infiniteThreshold) return "Không giới hạn";
    return `${val} ${suffix}`;
  };

  const getCycleText = (plan) => {
    if (plan.code === "FREE_TRIAL") {
      return `${plan.trialDays || 30} ngày trải nghiệm`;
    }
    if (plan.billingCycle === "YEARLY") return "/ năm";
    return "/ tháng";
  };

  const getBadgeTag = (plan) => {
    if (plan.code === "FREE_TRIAL") return "Khởi đầu";
    if (plan.code === "STARTER") return "Chuỗi nhỏ";
    if (plan.code === "PRO") return "Khuyên dùng";
    if (plan.code === "ENTERPRISE") return "Không giới hạn";
    return "Tiêu chuẩn";
  };

  const getBlockedText = (blockedBy) => {
    if (!blockedBy || !blockedBy.length) return "";
    const labels = blockedBy.map((k) => {
      if (k === "maxRooms") return "số phòng";
      if (k === "maxBranches") return "số cơ sở";
      if (k === "maxManagers") return "số quản lý";
      return k;
    });
    return `Đang dùng vượt quá ${labels.join(", ")}`;
  };

  const selectedPlan = items.find((p) => p.code === selectedPlanCode);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Gói dịch vụ & Hạn ngạch tài nguyên"
      subtitle="Bảng giá giải pháp SaaS Quản lý & Tự động hóa Vận hành Chuỗi phòng trọ DOMUS ERP"
      wide
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Đóng
          </Button>
          {selectedPlan && (
            <Button
              type="button"
              disabled={
                submittingId === selectedPlan.id ||
                selectedPlan.isRequested ||
                selectedPlan.isPending ||
                (!selectedPlan.selectable && !selectedPlan.isCurrent)
              }
              onClick={() => handleUpgradeRequest(selectedPlan)}
            >
              <Zap size={16} />
              <span>
                {selectedPlan.isCurrent
                  ? "Yêu cầu gia hạn gói này"
                  : selectedPlan.isRequested
                  ? "Đã gửi yêu cầu đổi gói"
                  : selectedPlan.isPending
                  ? "Chờ duyệt hóa đơn"
                  : "Gửi yêu cầu kích hoạt gói đã chọn"}
              </span>
            </Button>
          )}
        </>
      }
    >
      <div className="modal-body plans-modal-body">
        {loading && (
          <div
            style={{
              padding: "10px 14px",
              backgroundColor: "#f0fdfa",
              borderRadius: "8px",
              border: "1px solid #ccfbf1",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "12px",
              color: "#0f766e",
            }}
          >
            <Loader2 size={16} className="animate-spin" />
            <span>Đang đồng bộ gói dịch vụ và mức tiêu thụ tài nguyên thực tế...</span>
          </div>
        )}

        {/* Banner tài khoản hiện tại & Tiến độ sử dụng */}
        <div className="current-sub-banner">
          <div className="sub-banner-left">
            <div className="sub-badge-icon">
              <Crown size={22} color="#0f766e" />
            </div>
            <div>
              <div className="sub-tag-line">
                <span className="sub-tag">GÓI TÀI KHOẢN ĐANG DÙNG</span>
                <span className="sub-status-pill">
                  <CheckCircle2 size={13} />
                  <span>{currentSub?.status === "ACTIVE" ? "Đang hoạt động" : "Hoạt động"}</span>
                </span>
                {isRoomsNearLimit && (
                  <span
                    style={{
                      fontSize: "11px",
                      color: "#b45309",
                      backgroundColor: "#fef3c7",
                      padding: "2px 8px",
                      borderRadius: "9999px",
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <AlertTriangle size={12} /> Sắp hết chỗ
                  </span>
                )}
              </div>
              <h3 className="sub-current-name">
                {currentSub?.plan?.name || currentPlan?.name || "Gói Dùng Thử"}
              </h3>
              <p className="sub-current-desc">
                {currentSub?.endDate
                  ? `Thời hạn gói áp dụng đến: ${new Date(currentSub.endDate).toLocaleDateString("vi-VN")}`
                  : currentPlan?.expiryText || "Thuê bao trực tiếp nền tảng"}
              </p>
            </div>
          </div>

          <div
            className="sub-banner-usage"
            style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}
          >
            {/* Rooms Progress */}
            <div style={{ minWidth: "160px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span className="usage-title" style={{ margin: 0 }}>Số phòng sử dụng</span>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#005c55" }}>
                  {roomsUsed} / {isRoomsUnlimited ? "∞" : roomsLimit}
                </span>
              </div>
              <div className="usage-meter-wrap">
                <div className="usage-meter-bar">
                  <div
                    className="usage-meter-fill"
                    style={{
                      width: `${roomsPercent}%`,
                      backgroundColor: isRoomsNearLimit ? "#f59e0b" : undefined,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Branches Progress */}
            <div style={{ minWidth: "160px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span className="usage-title" style={{ margin: 0 }}>Số cơ sở</span>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#005c55" }}>
                  {branchesUsed} / {isBranchesUnlimited ? "∞" : branchesLimit}
                </span>
              </div>
              <div className="usage-meter-wrap">
                <div className="usage-meter-bar">
                  <div
                    className="usage-meter-fill"
                    style={{ width: `${branchesPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Pending Upgrade Request Banner */}
        {upgradeRequest && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "10px",
              backgroundColor: "#eff6ff",
              border: "1px solid #bfdbfe",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Clock size={18} color="#2563eb" />
              <div style={{ fontSize: "13px", color: "#1e40af" }}>
                Đang có yêu cầu đổi sang gói <strong>{upgradeRequest.planId?.name || "dịch vụ"}</strong> chờ quản trị viên phê duyệt.
                {upgradeRequest.note && <span style={{ color: "#64748b" }}> ({upgradeRequest.note})</span>}
              </div>
            </div>
            <button
              type="button"
              disabled={cancellingId === upgradeRequest._id}
              onClick={() => handleCancelRequest(upgradeRequest._id)}
              style={{
                padding: "4px 10px",
                borderRadius: "6px",
                border: "1px solid #93c5fd",
                backgroundColor: "#ffffff",
                color: "#1d4ed8",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              {cancellingId === upgradeRequest._id ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
              <span>Hủy yêu cầu</span>
            </button>
          </div>
        )}

        {/* Pending Subscription Invoice Banner with Checkout Button */}
        {((pendingSub && pendingSub.status === "PENDING_PAYMENT") || (pendingInvoice && (pendingInvoice.status === "PENDING" || pendingInvoice.payable))) && (
          <div
            style={{
              padding: "16px 20px",
              borderRadius: "12px",
              backgroundColor: "#fffbeb",
              border: "1.5px solid #fde68a",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  backgroundColor: "#fef3c7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#d97706",
                  flexShrink: 0,
                }}
              >
                <CreditCard size={22} />
              </div>
              <div>
                <strong style={{ fontSize: "14px", color: "#92400e", display: "block" }}>
                  Hóa đơn gói {pendingSub?.plan?.name || pendingInvoice?.plan?.name || "SaaS"} đang chờ thanh toán
                </strong>
                <span style={{ fontSize: "12.5px", color: "#78350f" }}>
                  Mã hóa đơn: <strong>{pendingInvoice?.invoiceCode || "Chờ lập"}</strong> · Số tiền: <strong>{pendingInvoice ? money(pendingInvoice.amount) : "Theo gói"}</strong>. Gói mới sẽ tự động kích hoạt ngay khi thanh toán thành công!
                </span>
              </div>
            </div>

            {pendingInvoice && (
              <Button
                type="button"
                style={{
                  backgroundColor: "#d97706",
                  color: "#ffffff",
                  fontSize: "13px",
                  padding: "8px 16px",
                  fontWeight: 700,
                  boxShadow: "0 2px 8px rgba(217, 119, 6, 0.25)",
                }}
                disabled={checkingOut}
                onClick={() => handleCheckout(pendingInvoice.id || pendingInvoice._id)}
              >
                {checkingOut ? <Loader2 size={15} className="animate-spin" /> : <ExternalLink size={15} />}
                <span>Thanh toán ngay qua SePay</span>
              </Button>
            )}
            {pendingInvoice && (
              <Button
                type="button"
                variant="secondary"
                style={{ fontSize: "13px", padding: "8px 16px", fontWeight: 600 }}
                disabled={verifying}
                onClick={() => verifyPayment(pendingInvoice.id || pendingInvoice._id)}
                title="Hỏi SePay xem hóa đơn đã được thanh toán chưa"
              >
                {verifying ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                <span>Kiểm tra thanh toán</span>
              </Button>
            )}
          </div>
        )}

        {/* Lưới danh sách gói cước theo thời gian thực */}
        <div className="plans-cards-grid">
          {items.map((plan) => {
            const isCurrent = plan.isCurrent;
            const isPending = plan.isPending;
            const isRequested = plan.isRequested;
            const isSelected = plan.code === selectedPlanCode;
            const isBlocked = plan.blockedBy && plan.blockedBy.length > 0;
            const isPro = plan.code === "PRO";
            const isSubmitting = submittingId === plan.id;

            return (
              <div
                key={plan.id || plan._id || plan.code}
                className={`plan-card ${isCurrent ? "is-current" : ""} ${
                  isPro ? "is-popular" : ""
                } ${isSelected ? "is-selected" : ""}`}
                onClick={() => setSelectedPlanCode(plan.code)}
              >
                {/* Status Badges */}
                {isCurrent ? (
                  <div className="plan-pill current-pill">
                    <Check size={12} />
                    <span>Đang sử dụng</span>
                  </div>
                ) : isPending ? (
                  <div className="plan-pill pending-pill">
                    <Clock size={12} />
                    <span>Chờ thanh toán</span>
                  </div>
                ) : isRequested ? (
                  <div className="plan-pill requested-pill">
                    <Clock size={12} />
                    <span>Đã gửi yêu cầu</span>
                  </div>
                ) : isPro ? (
                  <div className="plan-pill popular-pill">
                    <Sparkles size={12} />
                    <span>Phổ biến nhất</span>
                  </div>
                ) : null}

                <div className="plan-card-header">
                  <span className="plan-badge-tag">{getBadgeTag(plan)}</span>
                  <h4 className="plan-name">{plan.name}</h4>
                  <p className="plan-desc">
                    {plan.description ||
                      (plan.price === 0
                        ? "Trải nghiệm đầy đủ tính năng cốt lõi cho chủ trọ mới gia nhập."
                        : `Vận hành tối ưu chuỗi phòng với biểu phí ${getCycleText(plan)}.`)}
                  </p>
                </div>

                <div className="plan-pricing">
                  <span className="plan-price">
                    {plan.price === 0 ? "0 ₫" : money(plan.price)}
                  </span>
                  <span className="plan-cycle">{getCycleText(plan)}</span>
                </div>

                <div className="plan-quotas-box">
                  <div className="quota-row">
                    <Building2 size={15} className="quota-icon" />
                    <span>
                      Tối đa <strong>{formatQuota(plan.maxBranches, "cơ sở", 999)}</strong>
                    </span>
                  </div>
                  <div className="quota-row">
                    <DoorOpen size={15} className="quota-icon" />
                    <span>
                      Tối đa <strong>{formatQuota(plan.maxRooms, "phòng", 9999)}</strong>
                    </span>
                  </div>
                  <div className="quota-row">
                    <Users size={15} className="quota-icon" />
                    <span>
                      Tối đa <strong>{formatQuota(plan.maxManagers, "quản lý", 99)}</strong>
                    </span>
                  </div>
                </div>

                {/* Quota Blocked Notice if usage exceeds this plan */}
                {isBlocked && (
                  <div className="blocked-notice">
                    <AlertTriangle size={12} style={{ display: "inline", marginRight: "4px" }} />
                    {getBlockedText(plan.blockedBy)}
                  </div>
                )}

                <div className="plan-features-list">
                  <span className="features-title">Tính năng bao gồm:</span>
                  {(plan.features || []).map((feat, idx) => (
                    <div key={idx} className="feat-item">
                      <CheckCircle2 size={14} className="feat-check" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>

                <div className="plan-action-wrap">
                  {isCurrent ? (
                    <button
                      type="button"
                      className="plan-btn current-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpgradeRequest(plan);
                      }}
                      title="Bấm để yêu cầu gia hạn gói đang dùng"
                    >
                      <Check size={16} />
                      <span>Đang dùng · Bấm gia hạn</span>
                    </button>
                  ) : isPending ? (
                    <button
                      type="button"
                      className="plan-btn disabled-btn"
                      disabled
                    >
                      <Clock size={16} />
                      <span>Chờ thanh toán</span>
                    </button>
                  ) : isRequested ? (
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        type="button"
                        className="plan-btn disabled-btn"
                        disabled
                        style={{ flex: 1 }}
                      >
                        <Clock size={14} />
                        <span>Đã gửi yêu cầu</span>
                      </button>
                      {upgradeRequest && (
                        <button
                          type="button"
                          disabled={cancellingId === upgradeRequest._id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelRequest(upgradeRequest._id);
                          }}
                          style={{
                            padding: "6px 10px",
                            borderRadius: "8px",
                            border: "1px solid #fca5a5",
                            backgroundColor: "#fff5f5",
                            color: "#dc2626",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                          title="Hủy yêu cầu này"
                        >
                          Hủy
                        </button>
                      )}
                    </div>
                  ) : isBlocked ? (
                    <button
                      type="button"
                      className="plan-btn disabled-btn"
                      disabled
                      title={getBlockedText(plan.blockedBy)}
                    >
                      <span>Vượt hạn ngạch</span>
                    </button>
                  ) : !plan.selectable ? (
                    <button
                      type="button"
                      className="plan-btn disabled-btn"
                      disabled
                    >
                      <span>Gói dùng thử</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isSubmitting}
                      className={`plan-btn ${isPro ? "upgrade-btn" : "select-btn"}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpgradeRequest(plan);
                      }}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          <span>Đang gửi...</span>
                        </>
                      ) : (
                        <>
                          <span>Chọn nâng cấp</span>
                          <ArrowRight size={15} />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Hotline & Support Guidance Box */}
        <div className="plans-hotline-box">
          <div className="hotline-left">
            <Headphones size={24} color="#0f766e" />
            <div>
              <strong>Cần tư vấn gói cước chuyên sâu hoặc xuất hóa đơn VAT công ty?</strong>
              <p>Đội ngũ chuyên viên DOMUS ERP sẵn sàng hỗ trợ trực tiếp 24/7 qua Hotline hoặc Zalo OA Doanh Nghiệp.</p>
            </div>
          </div>
          <button
            type="button"
            className="hotline-btn"
            onClick={() => {
              navigator.clipboard?.writeText("19008888");
              toast.info("Đã sao chép Hotline: 1900.8888. Hỗ trợ kích hoạt gói nhanh trong 5 phút!");
            }}
          >
            <span>Hotline: 1900.8888</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
