import axios from "axios";

let accessToken =
  (typeof localStorage !== "undefined" && localStorage.getItem("token")) ||
  null;
let refreshRequest = null;
let onSessionExpired = () => {};
let onPasswordChangeRequired = () => {};

export const setAccessToken = (value) => {
  accessToken = value;
  if (typeof localStorage !== "undefined") {
    if (value) {
      localStorage.setItem("token", value);
    } else {
      localStorage.removeItem("token");
    }
  }
};

export const setSessionExpiredHandler = (handler) => {
  onSessionExpired = handler;
};

export const setPasswordChangeRequiredHandler = (handler) => {
  onPasswordChangeRequired = handler;
};

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api/v1",
  withCredentials: true,
  timeout: 20000,
});

axiosInstance.interceptors.request.use((config) => {
  const token =
    accessToken ||
    (typeof localStorage !== "undefined" && localStorage.getItem("token"));
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export async function restoreSession() {
  if (!refreshRequest) {
    refreshRequest = axiosInstance
      .post("/auth/refresh")
      .then(({ data }) => {
        setAccessToken(data.data.token);
        return data.data;
      })
      .finally(() => {
        refreshRequest = null;
      });
  }
  return refreshRequest;
}

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;

    // Check for required password change (403 PASSWORD_CHANGE_REQUIRED)
    if (
      error.response?.status === 403 &&
      (error.response?.data?.errorCode === "PASSWORD_CHANGE_REQUIRED" ||
        error.response?.data?.message?.includes("đổi mật khẩu"))
    ) {
      onPasswordChangeRequired();
      return Promise.reject(error);
    }

    if (
      error.response?.status === 401 &&
      config &&
      !config._retry &&
      !config.url?.startsWith("/auth/")
    ) {
      config._retry = true;
      try {
        await restoreSession();
        return axiosInstance(config);
      } catch {
        setAccessToken(null);
        onSessionExpired();
      }
    }
    return Promise.reject(error);
  },
);

const payload = (response) => response.data?.data;

export const authApi = {
  login: (body) => axiosInstance.post("/auth/login", body).then(payload),
  register: (body) => axiosInstance.post("/auth/register", body).then(payload),
  changePassword: (body) =>
    axiosInstance.post("/auth/change-password", body).then(payload),
  me: () => axiosInstance.get("/auth/me").then(payload),
  logout: () => axiosInstance.post("/auth/logout"),
};

export const staffApi = {
  list: (params) => axiosInstance.get("/staff", { params }).then(payload),
  create: (body) => axiosInstance.post("/staff", body).then(payload),
  resetPassword: (staffId) =>
    axiosInstance.post(`/staff/${staffId}/reset-password`, {}).then(payload),
};

export const tenantApi = {
  list: (params) => axiosInstance.get("/tenants", { params }).then(payload),
  create: (body) => axiosInstance.post("/tenants", body).then(payload),
  resetPassword: (tenantId) =>
    axiosInstance.post(`/tenants/${tenantId}/reset-password`, {}).then(payload),
};

export const branchApi = {
  list: (params) => axiosInstance.get("/branches", { params }).then(payload),
  get: (id) => axiosInstance.get(`/branches/${id}`).then(payload),
  create: (body) => axiosInstance.post("/branches", body).then(payload),
  update: (id, body) =>
    axiosInstance.put(`/branches/${id}`, body).then(payload),
  remove: (id) => axiosInstance.delete(`/branches/${id}`).then(payload),
  options: async () => {
    let page = 1;
    const items = [];
    let result;
    do {
      result = await branchApi.list({ page, limit: 100 });
      items.push(...(result?.items || []));
      page++;
    } while (items.length < (result?.total || 0));
    return items;
  },
};

export const roomApi = {
  list: (branchId, params) =>
    axiosInstance.get(`/branches/${branchId}/rooms`, { params }).then(payload),
  get: (id) => axiosInstance.get(`/rooms/${id}`).then(payload),
  create: (branchId, body) =>
    axiosInstance.post(`/branches/${branchId}/rooms`, body).then(payload),
  bulk: (branchId, body) =>
    axiosInstance.post(`/branches/${branchId}/rooms/bulk`, body).then(payload),
  update: (id, body) => axiosInstance.put(`/rooms/${id}`, body).then(payload),
  remove: (id) => axiosInstance.delete(`/rooms/${id}`).then(payload),
  available: async (branchId) => {
    let page = 1;
    const items = [];
    let result;
    do {
      result = await roomApi.list(branchId, {
        status: "EMPTY",
        page,
        limit: 100,
      });
      items.push(...(result?.items || []));
      page++;
    } while (items.length < (result?.total || 0));
    return items;
  },
};

export const contractApi = {
  list: (params) => axiosInstance.get("/contracts", { params }).then(payload),
  get: (id) => axiosInstance.get(`/contracts/${id}`).then(payload),
  create: (body) => axiosInstance.post("/contracts", body).then(payload),
  settlement: (id, body = {}) =>
    axiosInstance.post(`/contracts/${id}/settlement`, body).then(payload),
  terminate: (id, body = {}) =>
    axiosInstance.post(`/contracts/${id}/terminate`, body).then(payload),
};

export const paymentApi = {
  payCash: (body) => axiosInstance.post("/payments/cash", body).then(payload),
  list: (params) => axiosInstance.get("/payments", { params }).then(payload),
};

export const utilityReadingApi = {
  list: (branchId, params) =>
    axiosInstance
      .get(`/branches/${branchId}/utility-readings`, { params })
      .then(payload),
  get: (id) => axiosInstance.get(`/utility-readings/${id}`).then(payload),
  create: (body) => axiosInstance.post("/utility-readings", body).then(payload),
  update: (id, body) =>
    axiosInstance.put(`/utility-readings/${id}`, body).then(payload),
};

export const incidentApi = {
  list: (params) => axiosInstance.get("/incidents", { params }).then(payload),
  get: (id) => axiosInstance.get(`/incidents/${id}`).then(payload),
  create: (body) => axiosInstance.post("/incidents", body).then(payload),
  updateStatus: (id, body) =>
    axiosInstance.put(`/incidents/${id}/status`, body).then(payload),
  updateCost: (id, body) =>
    axiosInstance.put(`/incidents/${id}/cost`, body).then(payload),
};

export const profileApi = {
  get: () => axiosInstance.get("/profile").then(payload),
  update: (body) => axiosInstance.put("/profile", body).then(payload),
  updateBankAccount: (body) =>
    axiosInstance.put("/profile/bank-account", body).then(payload),
};

export const planApi = {
  getPlans: () => axiosInstance.get("/plans").then(payload),
  requestUpgrade: (body) =>
    axiosInstance.post("/plans/upgrade-requests", body).then(payload),
  listUpgradeRequests: () =>
    axiosInstance.get("/plans/upgrade-requests").then(payload),
  cancelUpgradeRequest: (requestId) =>
    axiosInstance
      .post(`/plans/upgrade-requests/${requestId}/cancel`)
      .then(payload),
  listInvoices: (params) =>
    axiosInstance.get("/plans/invoices", { params }).then(payload),
  checkoutInvoice: (invoiceId, body = { paymentMethod: "BANK_TRANSFER" }) =>
    axiosInstance
      .post(`/plans/invoices/${invoiceId}/checkout`, body)
      .then(payload),
  // Asks SePay directly whether the invoice was paid (works without IPN, e.g. on localhost).
  verifyPayment: (invoiceId) =>
    axiosInstance.post(`/plans/invoices/${invoiceId}/verify-payment`).then(payload),
};

export const bankHubApi = {
  getStatus: () => axiosInstance.get("/bank-hub").then(payload),
  createLinkToken: (body = { purpose: "LINK" }) =>
    axiosInstance.post("/bank-hub/link-token", body).then(payload),
  sync: () => axiosInstance.post("/bank-hub/sync").then(payload),
};

export const dashboardApi = {
  getStats: (params) =>
    axiosInstance.get("/dashboard/stats", { params }).then(payload),
  getDebts: (params) =>
    axiosInstance.get("/dashboard/debts", { params }).then(payload),
};

export const adminApi = {
  // Upgrade Requests
  listUpgradeRequests: (params) =>
    axiosInstance.get("/admin/upgrade-requests", { params }).then(payload),
  approveUpgradeRequest: (requestId, body) =>
    axiosInstance
      .post(`/admin/upgrade-requests/${requestId}/approve`, body)
      .then(payload),
  rejectUpgradeRequest: (requestId, body) =>
    axiosInstance
      .post(`/admin/upgrade-requests/${requestId}/reject`, body)
      .then(payload),

  // Analytics
  getAnalytics: (params) =>
    axiosInstance.get("/admin/analytics", { params }).then(payload),

  // Plans
  listPlans: (params) =>
    axiosInstance.get("/admin/plans", { params }).then(payload),
  createPlan: (body) => axiosInstance.post("/admin/plans", body).then(payload),
  updatePlan: (id, body) =>
    axiosInstance.put(`/admin/plans/${id}`, body).then(payload),
  deletePlan: (id) => axiosInstance.delete(`/admin/plans/${id}`).then(payload),

  // Landlords
  listLandlords: (params) =>
    axiosInstance.get("/admin/landlords", { params }).then(payload),
  setLandlordStatus: (id, body) =>
    axiosInstance.put(`/admin/landlords/${id}/status`, body).then(payload),

  // Subscriptions
  listSubscriptions: (params) =>
    axiosInstance.get("/admin/subscriptions", { params }).then(payload),
  createSubscription: (body) =>
    axiosInstance.post("/admin/subscriptions", body).then(payload),
  updateSubscription: (id, body) =>
    axiosInstance.put(`/admin/subscriptions/${id}`, body).then(payload),

  // Invoices
  listInvoices: (params) =>
    axiosInstance.get("/admin/invoices", { params }).then(payload),
  confirmInvoice: (id, body) =>
    axiosInstance.post(`/admin/invoices/${id}/paid`, body).then(payload),

  // Audit Logs
  listAuditLogs: (params) =>
    axiosInstance.get("/admin/audit-logs", { params }).then(payload),
};

export const errorMessage = (error) =>
  error.response?.data?.message ||
  error.message ||
  (error.code === "ECONNABORTED"
    ? "Yêu cầu quá thời gian chờ. Vui lòng thử lại."
    : "Không thể kết nối máy chủ. Kiểm tra BE rồi thử lại.");

/**
 * Universal API adapter providing methods for Finance module services
 */
export const api = {
  get: async (endpoint, options = {}) => {
    const res = await axiosInstance.get(endpoint, options);
    return res.data;
  },
  post: async (endpoint, body, options = {}) => {
    const res = await axiosInstance.post(endpoint, body, options);
    return res.data;
  },
  put: async (endpoint, body, options = {}) => {
    const res = await axiosInstance.put(endpoint, body, options);
    return res.data;
  },
  patch: async (endpoint, body, options = {}) => {
    const res = await axiosInstance.patch(endpoint, body, options);
    return res.data;
  },
  delete: async (endpoint, options = {}) => {
    const res = await axiosInstance.delete(endpoint, options);
    return res.data;
  },
  axios: axiosInstance,
  interceptors: axiosInstance.interceptors,
};

export async function request(endpoint, options = {}) {
  const method = (options.method || "GET").toLowerCase();
  const res = await axiosInstance.request({
    url: endpoint,
    method,
    data: options.body
      ? typeof options.body === "string"
        ? JSON.parse(options.body)
        : options.body
      : undefined,
    headers: options.headers,
    ...options,
  });
  return res.data;
}
