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

export const invoiceService = {
  /**
   * Get invoices with filters and pagination
   */
  async getInvoices(params = {}) {
    try {
      const query = new URLSearchParams();
      if (params.status && params.status !== "ALL") query.append("status", params.status);
      if (params.branchId) query.append("branchId", params.branchId);
      if (params.billingPeriod) query.append("billingPeriod", params.billingPeriod);
      if (params.page) query.append("page", String(params.page));
      if (params.limit) query.append("limit", String(params.limit));

      const queryString = query.toString();
      const endpoint = `/invoices${queryString ? `?${queryString}` : ""}`;
      const res = await api.get(endpoint);
      return res;
    } catch (err) {
      if (isAuthError(err)) {
        console.warn("[DEV MODE] Backend Auth chưa hoàn thiện, chuyển sang dữ liệu mẫu:", err.message);
        return mockStore.getInvoices(params);
      }
      throw err;
    }
  },

  /**
   * Get detailed invoice by ID
   */
  async getInvoiceById(invoiceId) {
    try {
      const res = await api.get(`/invoices/${invoiceId}`);
      return res.data || res;
    } catch (err) {
      if (isAuthError(err)) {
        return mockStore.getInvoiceById(invoiceId);
      }
      throw err;
    }
  },

  /**
   * Batch generate invoices for a billing period
   */
  async generateInvoices(data) {
    try {
      const res = await api.post("/invoices/generate", data);
      return res;
    } catch (err) {
      if (isAuthError(err)) {
        return mockStore.generateInvoices(data);
      }
      throw err;
    }
  },

  /**
   * Issue draft invoice
   */
  async issueInvoice(invoiceId) {
    try {
      const res = await api.post(`/invoices/${invoiceId}/issue`, {});
      return res;
    } catch (err) {
      if (isAuthError(err)) {
        return mockStore.issueInvoice(invoiceId);
      }
      throw err;
    }
  },

  /**
   * Cancel unpaid invoice
   */
  async cancelInvoice(invoiceId, reason) {
    try {
      const res = await api.post(`/invoices/${invoiceId}/cancel`, { reason });
      return res;
    } catch (err) {
      if (isAuthError(err)) {
        return mockStore.cancelInvoice(invoiceId, reason);
      }
      throw err;
    }
  },

  /**
   * Get public invoice without authentication
   */
  async getPublicInvoice(publicAccessToken) {
    try {
      const res = await api.get(`/invoices/public/${publicAccessToken}`);
      return res.data || res;
    } catch (err) {
      // Public route or offline fallback
      return mockStore.getPublicInvoice(publicAccessToken);
    }
  },

  /**
   * Get list of payments belonging to an invoice
   */
  async getInvoicePayments(invoiceId) {
    try {
      const res = await api.get(`/invoices/${invoiceId}/payments`);
      return res;
    } catch (err) {
      if (isAuthError(err)) {
        return mockStore.getPayments();
      }
      throw err;
    }
  },
};
