import { api } from "./api";

export const paymentService = {
  /**
   * Record cash payment to real MongoDB
   */
  async recordCashPayment(data) {
    const res = await api.post("/payments/cash", data);
    return res;
  },
  async confirmCashPayment(paymentId) {
    const res = await api.post(`/payments/cash/${paymentId}/confirm`, {});
    return res;
  },
  async rejectCashPayment(paymentId, reason) {
    const res = await api.post(`/payments/cash/${paymentId}/reject`, {
      reason,
    });
    return res;
  },

  /**
   * Get payments list with filters and pagination from real MongoDB
   */
  async getPayments(params = {}) {
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
  },

  /**
   * Get single payment by ID from real MongoDB
   */
  async getPaymentById(paymentId) {
    const res = await api.get(`/payments/${paymentId}`);
    return res.data || res;
  },

  /**
   * Get list of unmatched SePay payments from real MongoDB
   */
  async listUnmatched(params = {}) {
    const query = new URLSearchParams();
    if (params.status) query.append("status", params.status);
    if (params.page) query.append("page", String(params.page));
    if (params.limit) query.append("limit", String(params.limit));

    const queryString = query.toString();
    const endpoint = `/payments/unmatched${queryString ? `?${queryString}` : ""}`;
    const res = await api.get(endpoint);
    return res;
  },

  /**
   * Resolve an unmatched payment by binding to an invoice in real MongoDB
   */
  async resolveUnmatched(unmatchedPaymentId, invoiceId) {
    const res = await api.post(
      `/payments/unmatched/${unmatchedPaymentId}/resolve`,
      {
        invoiceId,
      },
    );
    return res;
  },
};
