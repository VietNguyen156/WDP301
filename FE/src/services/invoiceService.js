import { api } from "./api";

export const invoiceService = {
  /**
   * Get invoices with filters and pagination from real MongoDB
   */
  async getInvoices(params = {}) {
    const query = new URLSearchParams();
    if (params.status && params.status !== "ALL")
      query.append("status", params.status);
    if (params.branchId) query.append("branchId", params.branchId);
    if (params.billingPeriod)
      query.append("billingPeriod", params.billingPeriod);
    if (params.page) query.append("page", String(params.page));
    if (params.limit) query.append("limit", String(params.limit));

    const queryString = query.toString();
    const endpoint = `/invoices${queryString ? `?${queryString}` : ""}`;
    const res = await api.get(endpoint);
    return res;
  },

  /**
   * Get detailed invoice by ID from real MongoDB
   */
  async getInvoiceById(invoiceId) {
    const res = await api.get(`/invoices/${invoiceId}`);
    return res.data || res;
  },

  /**
   * Batch generate invoices for a billing period
   */
  async generateInvoices(data) {
    const res = await api.post("/invoices/generate", data);
    return res;
  },

  /**
   * Issue draft invoice
   */
  async issueInvoice(invoiceId) {
    const res = await api.post(`/invoices/${invoiceId}/issue`, {});
    return res;
  },

  /**
   * Cancel unpaid invoice
   */
  async cancelInvoice(invoiceId, reason) {
    const res = await api.post(`/invoices/${invoiceId}/cancel`, { reason });
    return res;
  },

  /**
   * Get public invoice without authentication (/i/:token)
   */
  async getPublicInvoice(publicAccessToken) {
    const res = await api.get(`/invoices/public/${publicAccessToken}`);
    return res.data || res;
  },

  /**
   * Sandbox only: pretend the tenant transferred the remaining amount (no real bank needed)
   */
  async simulatePublicPayment(publicAccessToken) {
    const res = await api.post(`/invoices/public/${publicAccessToken}/simulate-payment`);
    return res.data || res;
  },

  /**
   * Get list of payments belonging to an invoice
   */
  async getInvoicePayments(invoiceId) {
    const res = await api.get(`/invoices/${invoiceId}/payments`);
    return res;
  },
};
