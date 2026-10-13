import { api } from "./api";
import { mockStore } from "./mockData";

const isAuthError = (err) => {
  const msg = (err?.message || "").toLowerCase();
  return (
    err?.status === 401 ||
    err?.status === 503 ||
    msg.includes("đăng nhập") ||
    msg.includes("xác thực") ||
    msg.includes("token") ||
    msg.includes("auth")
  );
};

export const paymentService = {
  /**
   * Record cash payment
   */
  async recordCashPayment(data) {
    try {
      const res = await api.post("/payments/cash", data);
      return res;
    } catch (err) {
      if (isAuthError(err)) {
        return mockStore.recordCashPayment(data);
      }
      throw err;
    }
  },

  /**
   * Get payments list with filters and pagination
   */
  async getPayments(params = {}) {
    try {
      const query = new URLSearchParams();
      if (params.paymentMethod && params.paymentMethod !== "ALL") {
        query.append("paymentMethod", params.paymentMethod);
      }
      if (params.branchId) query.append("branchId", params.branchId);
      if (params.page) query.append("page", String(params.page));
      if (params.limit) query.append("limit", String(params.limit));

      const queryString = query.toString();
      const endpoint = `/payments${queryString ? `?${queryString}` : ""}`;
      const res = await api.get(endpoint);
      return res;
    } catch (err) {
      if (isAuthError(err)) {
        return mockStore.getPayments(params);
      }
      throw err;
    }
  },

  /**
   * Get single payment by ID
   */
  async getPaymentById(paymentId) {
    try {
      const res = await api.get(`/payments/${paymentId}`);
      return res.data || res;
    } catch (err) {
      if (isAuthError(err)) {
        const payments = mockStore.getPayments()?.data || [];
        return payments.find((p) => p._id === paymentId) || null;
      }
      throw err;
    }
  },

  /**
   * Get list of unmatched SePay payments
   */
  async listUnmatched(params = {}) {
    try {
      const query = new URLSearchParams();
      if (params.status) query.append("status", params.status);
      if (params.page) query.append("page", String(params.page));
      if (params.limit) query.append("limit", String(params.limit));

      const queryString = query.toString();
      const endpoint = `/payments/unmatched${queryString ? `?${queryString}` : ""}`;
      const res = await api.get(endpoint);
      return res;
    } catch (err) {
      if (isAuthError(err)) {
        return mockStore.listUnmatched(params);
      }
      throw err;
    }
  },

  /**
   * Resolve an unmatched payment by binding to an invoice
   */
  async resolveUnmatched(unmatchedPaymentId, invoiceId) {
    try {
      const res = await api.post(`/payments/unmatched/${unmatchedPaymentId}/resolve`, {
        invoiceId,
      });
      return res;
    } catch (err) {
      if (isAuthError(err)) {
        return mockStore.resolveUnmatched(unmatchedPaymentId, invoiceId, "Khớp thủ công");
      }
      throw err;
    }
  },
};
