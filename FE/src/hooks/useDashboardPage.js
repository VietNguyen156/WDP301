import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  branchApi,
  contractApi,
  dashboardApi,
  errorMessage,
} from "../services/api";
import { invoiceService } from "../services/invoiceService";
import { paymentService } from "../services/paymentService";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useResource } from "./useResource";
import { useLiveRefresh } from "./useLiveRefresh";
import { formatBillingPeriod } from "../utils/formatters";
import { money, date } from "../utils/format";
import { publicAppUrl, publicInvoiceUrl } from "../utils/publicLink";

const computeCurrentMonthStr = () =>
  new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 7);

const computePrevMonthStr = () => {
  const d = new Date(Date.now() + 7 * 3600000);
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 7);
};

export function useDashboardPage() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [currentMonthStr] = useState(computeCurrentMonthStr);
  const [prevMonthStr] = useState(computePrevMonthStr);

  // Selected filters
  const [filterBranchId, setFilterBranchId] = useState("");
  const [billingPeriod, setBillingPeriod] = useState(currentMonthStr);

  const isLandlord = user?.role === "LANDLORD";

  // Phase 1: Headline numbers (branches + server-side stats/debts + invoices)
  const headlineResource = useResource(
    async () => {
      try {
        const [branchRes, statsRes, debtsRes, invoiceRes] = await Promise.all([
          branchApi.list({ limit: 100 }),
          isLandlord
            ? dashboardApi
                .getStats({
                  branchId: filterBranchId || undefined,
                  billingPeriod: billingPeriod || undefined,
                })
                .catch(() => null)
            : Promise.resolve(null),
          isLandlord
            ? dashboardApi
                .getDebts({
                  branchId: filterBranchId || undefined,
                })
                .catch(() => null)
            : Promise.resolve(null),
          invoiceService.getInvoices({
            limit: 100,
            branchId: filterBranchId || undefined,
            billingPeriod: billingPeriod || undefined,
          }),
        ]);
        return {
          branches: branchRes?.items || [],
          dashboardStats: statsRes,
          dashboardDebts: debtsRes,
          invoices: Array.isArray(invoiceRes)
            ? invoiceRes
            : invoiceRes?.data || [],
        };
      } catch (err) {
        toast.error(errorMessage(err));
        throw err;
      }
    },
    [isLandlord, filterBranchId, billingPeriod, toast],
  );

  // Phase 2: Details lists (payments, expiring contracts, unmatched)
  const detailsResource = useResource(
    async () => {
      try {
        const [paymentRes, contractRes, unmatchedRes] = await Promise.all([
          paymentService.getPayments({
            limit: 20,
            branchId: filterBranchId || undefined,
          }),
          isLandlord
            ? contractApi.list({ status: "EXPIRING_SOON", limit: 50 })
            : Promise.resolve([]),
          isLandlord
            ? paymentService
                .listUnmatched({ status: "PENDING_REVIEW" })
                .catch(() => [])
            : Promise.resolve([]),
        ]);
        return {
          payments: Array.isArray(paymentRes)
            ? paymentRes
            : paymentRes?.data || [],
          contracts: contractRes?.items || [],
          unmatched: Array.isArray(unmatchedRes)
            ? unmatchedRes
            : unmatchedRes?.data || [],
        };
      } catch (err) {
        toast.error(errorMessage(err));
        throw err;
      }
    },
    [isLandlord, filterBranchId, billingPeriod, toast],
  );

  const loadDashboardData = useCallback(
    (isSilent = false) => {
      if (isSilent === true) {
        headlineResource.refresh();
        detailsResource.refresh();
      } else {
        headlineResource.reload();
        detailsResource.reload();
      }
    },
    [headlineResource, detailsResource],
  );

  useLiveRefresh(["dashboard"], () => loadDashboardData(true));

  const branches = useMemo(
    () => headlineResource.data?.branches || [],
    [headlineResource.data],
  );
  const dashboardStats = headlineResource.data?.dashboardStats || null;
  const dashboardDebts = headlineResource.data?.dashboardDebts || null;
  const invoices = useMemo(
    () => headlineResource.data?.invoices || [],
    [headlineResource.data],
  );

  const payments = useMemo(
    () => detailsResource.data?.payments || [],
    [detailsResource.data],
  );
  const contracts = useMemo(
    () => detailsResource.data?.contracts || [],
    [detailsResource.data],
  );
  const unmatched = useMemo(
    () => detailsResource.data?.unmatched || [],
    [detailsResource.data],
  );

  const loading = headlineResource.loading && !headlineResource.data;
  const detailsLoading = detailsResource.loading && !detailsResource.data;
  const refreshing = headlineResource.loading || detailsResource.loading;

  // Filtered dataset according to active branch filter
  const activeBranches = useMemo(() => {
    if (!filterBranchId) return branches;
    return branches.filter((b) => String(b._id) === String(filterBranchId));
  }, [branches, filterBranchId]);

  const activeInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const matchBranch =
        !filterBranchId ||
        String(inv.branchId?._id || inv.branchId) === String(filterBranchId);
      const matchPeriod = !billingPeriod || inv.billingPeriod === billingPeriod;
      return matchBranch && matchPeriod;
    });
  }, [invoices, filterBranchId, billingPeriod]);

  const activePayments = useMemo(() => {
    if (!filterBranchId) return payments;
    return payments.filter((payment) => {
      const paymentBranchId =
        payment.branchId?._id ||
        payment.branchId ||
        payment.invoiceId?.branchId?._id ||
        payment.invoiceId?.branchId;
      return String(paymentBranchId) === String(filterBranchId);
    });
  }, [payments, filterBranchId]);

  const activeContracts = useMemo(() => {
    if (!filterBranchId) return contracts;
    return contracts.filter(
      (c) => String(c.branchId) === String(filterBranchId),
    );
  }, [contracts, filterBranchId]);

  // Aggregate Room Occupancy Metrics
  const roomMetrics = useMemo(() => {
    if (dashboardStats?.occupancy) {
      const occ = dashboardStats.occupancy;
      const totalRooms = occ.totalRooms || 0;
      const rentedRooms = occ.rentedRooms || 0;
      const vacantRooms =
        occ.byStatus?.EMPTY ?? Math.max(0, totalRooms - rentedRooms);
      return {
        totalRooms,
        rentedRooms,
        vacantRooms,
        cleaningRooms: occ.byStatus?.CLEANING || 0,
        maintenanceRooms: occ.byStatus?.MAINTENANCE || 0,
        occupancyRate: occ.rate || 0,
      };
    }

    let totalRooms = 0;
    let rentedRooms = 0;
    let vacantRooms = 0;
    let cleaningRooms = 0;
    let maintenanceRooms = 0;

    activeBranches.forEach((b) => {
      const stats = b.roomStats || {};
      totalRooms += stats.total || 0;
      rentedRooms += stats.rented || 0;
      vacantRooms += Math.max(0, (stats.total || 0) - (stats.rented || 0));
    });

    const occupancyRate =
      totalRooms > 0 ? Math.round((rentedRooms / totalRooms) * 100) : 0;

    return {
      totalRooms,
      rentedRooms,
      vacantRooms,
      cleaningRooms,
      maintenanceRooms,
      occupancyRate,
    };
  }, [dashboardStats, activeBranches]);

  // Aggregate Financial Metrics
  const financialMetrics = useMemo(() => {
    if (dashboardStats?.collection) {
      const col = dashboardStats.collection;
      const debtData = dashboardDebts || dashboardStats.debts || {};
      const debtItems = debtData.items || [];

      const filteredDebtItems = filterBranchId
        ? debtItems.filter(
            (d) =>
              String(d.branch?.id || d.branch?._id || d.branchId) ===
              String(filterBranchId),
          )
        : debtItems;
      const debtTotalAmount = filterBranchId
        ? filteredDebtItems.reduce(
            (sum, d) => sum + (d.remainingAmount || 0),
            0,
          )
        : debtData.totalAmount || 0;

      return {
        expectedRevenue: col.expectedAmount || 0,
        actualRevenue: col.collectedAmount || 0,
        receivedAmount: col.receivedAmount || 0,
        receivedByMethod: col.receivedByMethod || {},
        debtAmount: debtTotalAmount,
        debtInvoices: filteredDebtItems,
        debtRoomsCount: filteredDebtItems.length,
        collectionRate: col.collectionRate || 0,
        isFromStatsApi: true,
      };
    }

    // Fallback client-side calculation for PROPERTY_MANAGER
    let expectedRevenue = 0;
    let actualRevenue = 0;
    let debtAmount = 0;
    const debtInvoices = [];

    activeInvoices.forEach((inv) => {
      if (inv.status !== "CANCELLED" && inv.status !== "DRAFT") {
        expectedRevenue += inv.totalAmount || 0;
        actualRevenue += inv.paidAmount || 0;

        const rem = Math.max(0, (inv.totalAmount || 0) - (inv.paidAmount || 0));
        if (rem > 0) {
          debtAmount += rem;
          debtInvoices.push(inv);
        }
      }
    });

    const collectionRate =
      expectedRevenue > 0
        ? Math.round((actualRevenue / expectedRevenue) * 100)
        : 0;

    debtInvoices.sort((a, b) => {
      const remA = (a.totalAmount || 0) - (a.paidAmount || 0);
      const remB = (b.totalAmount || 0) - (b.paidAmount || 0);
      return remB - remA;
    });

    return {
      expectedRevenue,
      actualRevenue,
      debtAmount,
      debtInvoices,
      debtRoomsCount: debtInvoices.length,
      collectionRate,
      isFromStatsApi: false,
    };
  }, [dashboardStats, dashboardDebts, activeInvoices, filterBranchId]);

  // Contracts Status & Expiring Watchlist
  const contractWatchlist = useMemo(() => {
    const totalActive = dashboardStats?.contracts
      ? dashboardStats.contracts.live
      : activeContracts.filter((c) => c.status === "ACTIVE").length;
    const now = new Date();
    const expiringSoon = [];

    activeContracts.forEach((c) => {
      if (c.status === "ACTIVE" && c.endDate) {
        const end = new Date(c.endDate);
        const diffDays = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
        if (diffDays <= 30 && diffDays >= 0) {
          expiringSoon.push({ ...c, diffDays });
        }
      }
    });

    expiringSoon.sort((a, b) => a.diffDays - b.diffDays);

    return {
      totalActive,
      expiringSoon,
      expired: dashboardStats?.contracts?.expired ?? 0,
    };
  }, [dashboardStats, activeContracts]);

  // Performance Per Branch (Comparison Bar Data)
  const branchPerformance = useMemo(() => {
    return activeBranches.map((branch) => {
      const branchInvs = invoices.filter((inv) => {
        const matchBranch =
          String(inv.branchId?._id || inv.branchId) === String(branch._id);
        const matchPeriod =
          !billingPeriod || inv.billingPeriod === billingPeriod;
        return matchBranch && matchPeriod;
      });
      const exp = branchInvs.reduce(
        (sum, i) =>
          i.status !== "CANCELLED" && i.status !== "DRAFT"
            ? sum + (i.totalAmount || 0)
            : sum,
        0,
      );
      const paid = branchInvs.reduce((sum, i) => sum + (i.paidAmount || 0), 0);
      const debt = Math.max(0, exp - paid);
      const rate = exp > 0 ? Math.round((paid / exp) * 100) : 0;
      const totalR = branch.roomStats?.total || 0;
      const rentedR = branch.roomStats?.rented || 0;
      const occRate = totalR > 0 ? Math.round((rentedR / totalR) * 100) : 0;

      return {
        _id: branch._id,
        name: branch.name,
        address: branch.address?.fullAddress || "Chưa có địa chỉ",
        totalRooms: totalR,
        rentedRooms: rentedR,
        occRate,
        expected: exp,
        paid,
        debt,
        rate,
        invoiceCount: branchInvs.length,
      };
    });
  }, [activeBranches, invoices, billingPeriod]);

  // Zalo Reminder Copy Handler
  const handleCopyZaloReminder = useCallback(
    (inv) => {
      if (inv.reminderMessage) {
        navigator.clipboard.writeText(inv.reminderMessage);
        const roomNum =
          inv.room?.roomNumber ||
          inv.roomId?.roomNumber ||
          inv.roomNumber ||
          "phòng trọ";
        toast.success(
          `Đã sao chép tin nhắn nhắc nợ gửi Zalo cho phòng ${roomNum}!`,
        );
        return;
      }

      const rem =
        inv.remainingAmount ??
        Math.max(0, (inv.totalAmount || 0) - (inv.paidAmount || 0));
      const branchName =
        inv.branch?.name ||
        inv.branchId?.name ||
        inv.branchName ||
        "Ban quản lý";
      const roomNum =
        inv.room?.roomNumber ||
        inv.roomId?.roomNumber ||
        inv.roomNumber ||
        "phòng trọ";
      const tenantName =
        inv.tenant?.name ||
        inv.contractId?.tenantName ||
        inv.tenantName ||
        "Quý khách";
      const publicUrl = inv.publicPath
        ? `${publicAppUrl()}${inv.publicPath}`
        : inv.publicAccessToken
          ? publicInvoiceUrl(inv.publicAccessToken)
          : `${publicAppUrl()}/invoices`;

      const message = `[DOMUS ERP - THÔNG BÁO TIỀN PHÒNG]
Kính gửi Quý khách ${tenantName} (${roomNum} - ${branchName}),
Ban quản lý xin gửi thông báo công nợ tiền thuê phòng & dịch vụ:
- Kỳ hóa đơn: ${formatBillingPeriod(inv.billingPeriod)}
- Số tiền còn phải nộp: ${money(rem)}
- Hạn thanh toán: ${date(inv.dueDate)}
👉 Xem chi tiết và quét mã VietQR tự động gạch nợ tại:
${publicUrl}
(Quý khách vui lòng thanh toán đúng hạn để tránh phát sinh gián đoạn dịch vụ. Trân trọng cảm ơn!)`;

      navigator.clipboard.writeText(message);
      toast.success(
        `Đã sao chép tin nhắn nhắc nợ gửi Zalo cho phòng ${roomNum}!`,
      );
    },
    [toast],
  );

  return {
    user,
    navigate,
    currentMonthStr,
    prevMonthStr,
    filterBranchId,
    setFilterBranchId,
    billingPeriod,
    setBillingPeriod,
    branches,
    unmatched,
    loading,
    refreshing,
    detailsLoading,
    loadDashboardData,
    activeBranches,
    activePayments,
    roomMetrics,
    financialMetrics,
    contractWatchlist,
    branchPerformance,
    handleCopyZaloReminder,
  };
}

