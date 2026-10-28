import { useState, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { invoiceService } from "../services/invoiceService";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { publicInvoiceUrl, canSharePublicInvoice } from "../utils/publicLink";
import { invoicePermissions } from "../utils/invoicePermissions";
import { useResource } from "./useResource";
import { useLiveRefresh } from "./useLiveRefresh";

export const INVOICE_HEADER = {
  LANDLORD: {
    title: "Quản lý Hóa đơn & Thu nợ Tự động",
    subtitle:
      "Theo dõi công nợ, phát hành hóa đơn và đối soát các khoản thu trong một quy trình.",
  },
  PROPERTY_MANAGER: {
    title: "Hóa đơn & Thu tiền tại Cơ sở",
    subtitle:
      "Xem hóa đơn của các cơ sở được phân công, gửi link cho khách và báo cáo khoản thu tiền mặt để chủ trọ duyệt.",
  },
  TENANT: {
    title: "Hóa đơn của tôi",
    subtitle:
      "Xem chi tiết tiền phòng, điện nước hàng tháng và thanh toán nhanh qua VietQR.",
  },
};

export function useInvoiceList(externalSearchTerm = "") {
  const { user } = useAuth();
  const { toast } = useToast();

  // Filters & Pagination
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [branchFilter] = useState("");
  const [billingPeriodFilter, setBillingPeriodFilter] = useState("");
  const [page, setPage] = useState(1);

  // Modals & Selected row for Stitch Flyout Drawer
  const [selectedInvoiceState, setSelectedInvoice] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [isCashPaymentOpen, setIsCashPaymentOpen] = useState(false);
  const [cashInvoiceTarget, setCashInvoiceTarget] = useState(null);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancelInvoiceTarget, setCancelInvoiceTarget] = useState(null);

  const [params] = useSearchParams();
  const activeSearch = externalSearchTerm || params.get("search") || "";
  const perms = invoicePermissions(user?.role);
  const canGenerateInvoices = perms.canGenerate;
  const header = INVOICE_HEADER[user?.role] || INVOICE_HEADER.LANDLORD;

  const invoiceResource = useResource(
    async () => {
      try {
        return await invoiceService.getInvoices({
          status: statusFilter,
          branchId: branchFilter,
          billingPeriod: billingPeriodFilter,
          page,
          limit: 20,
        });
      } catch (err) {
        toast.error(
          err.message || "Không thể tải danh sách hóa đơn từ máy chủ",
        );
        throw err;
      }
    },
    [statusFilter, branchFilter, billingPeriodFilter, page, toast],
  );

  useLiveRefresh(["invoices"], invoiceResource.refresh);

  const invoices = useMemo(() => {
    const res = invoiceResource.data;
    if (!res) return [];
    return Array.isArray(res) ? res : res?.data || [];
  }, [invoiceResource.data]);

  const pagination = useMemo(
    () =>
      invoiceResource.data?.pagination || {
        page: 1,
        limit: 20,
        total: 0,
      },
    [invoiceResource.data],
  );

  const loading = invoiceResource.loading;

  const loadInvoices = useCallback(
    (silent) => {
      if (silent === true) {
        invoiceResource.refresh();
      } else {
        invoiceResource.reload();
      }
    },
    [invoiceResource],
  );

  const statusTabs = useMemo(
    () => [
      { id: "ALL", label: `Tất cả (${invoices.length})` },
      { id: "ISSUED", label: "Chờ thanh toán" },
      { id: "PARTIALLY_PAID", label: "Thu một phần" },
      { id: "PAID", label: "Đã thanh toán" },
      ...(perms.canSeeDraftsAndCancelled
        ? [
            { id: "DRAFT", label: "Bản nháp" },
            { id: "CANCELLED", label: "Đã hủy" },
          ]
        : []),
    ],
    [invoices.length, perms.canSeeDraftsAndCancelled],
  );

  // Tenants pay on the public invoice page (VietQR + transfer syntax).
  const openPaymentPage = useCallback((inv, e) => {
    e?.stopPropagation();
    window.open(
      publicInvoiceUrl(inv.publicAccessToken),
      "_blank",
      "noopener",
    );
  }, []);

  const selectedInvoice = useMemo(() => {
    if (selectedInvoiceState) {
      const targetId = selectedInvoiceState._id || selectedInvoiceState.id;
      return (
        invoices.find((inv) => (inv._id || inv.id) === targetId) ||
        selectedInvoiceState
      );
    }
    return invoices[0] || null;
  }, [invoices, selectedInvoiceState]);

  const filteredInvoices = useMemo(() => {
    if (!activeSearch.trim()) return invoices;
    const term = activeSearch.toLowerCase();
    return invoices.filter(
      (inv) =>
        inv.invoiceCode?.toLowerCase().includes(term) ||
        inv.tenantId?.name?.toLowerCase().includes(term) ||
        inv.roomId?.roomNumber?.toLowerCase().includes(term) ||
        inv.roomId?.name?.toLowerCase().includes(term) ||
        (typeof inv.tenantId === "string" &&
          inv.tenantId.toLowerCase().includes(term)),
    );
  }, [invoices, activeSearch]);

  // KPI Calculations
  const stats = useMemo(() => {
    let totalBilled = 0;
    let totalCollected = 0;
    let totalRemaining = 0;
    let overdueCount = 0;

    invoices.forEach((inv) => {
      if (inv.status !== "CANCELLED") {
        totalBilled += inv.totalAmount || 0;
        totalCollected += inv.paidAmount || 0;
        totalRemaining += inv.remainingAmount || 0;
        if (
          inv.isOverdue ||
          (inv.dueDate &&
            new Date() > new Date(inv.dueDate) &&
            inv.status !== "PAID")
        ) {
          overdueCount++;
        }
      }
    });

    const paidRate =
      totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;
    const debtRate =
      totalBilled > 0 ? Math.round((totalRemaining / totalBilled) * 100) : 0;

    return {
      totalBilled,
      totalCollected,
      totalRemaining,
      overdueCount,
      count: invoices.length,
      paidRate,
      debtRate,
    };
  }, [invoices]);

  const copyPublicLink = useCallback(
    (inv, e) => {
      e?.stopPropagation();
      if (!canSharePublicInvoice(inv.status)) {
        toast.info(
          "Chỉ hóa đơn đã phát hành mới có link cho khách thuê. Hãy phát hành hóa đơn trước.",
        );
        return;
      }
      const link = publicInvoiceUrl(inv.publicAccessToken);
      navigator.clipboard.writeText(link);
      toast.success(`Đã sao chép link xem của hóa đơn ${inv.invoiceCode}!`);
    },
    [toast],
  );

  return {
    user,
    invoices,
    loading,
    statusFilter,
    setStatusFilter,
    branchFilter,
    billingPeriodFilter,
    setBillingPeriodFilter,
    page,
    setPage,
    pagination,
    selectedInvoice,
    setSelectedInvoice,
    isDetailOpen,
    setIsDetailOpen,
    isGenerateOpen,
    setIsGenerateOpen,
    isCashPaymentOpen,
    setIsCashPaymentOpen,
    cashInvoiceTarget,
    setCashInvoiceTarget,
    isCancelOpen,
    setIsCancelOpen,
    cancelInvoiceTarget,
    setCancelInvoiceTarget,
    perms,
    canGenerateInvoices,
    header,
    statusTabs,
    openPaymentPage,
    loadInvoices,
    filteredInvoices,
    stats,
    copyPublicLink,
  };
}

