import axios from "axios";

let accessToken = (typeof localStorage !== "undefined" && localStorage.getItem("token")) || null;
let refreshRequest = null;
let onSessionExpired = () => {};

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

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api/v1",
  withCredentials: true,
  timeout: 20000,
});

axiosInstance.interceptors.request.use((config) => {
  const token = accessToken || (typeof localStorage !== "undefined" && localStorage.getItem("token"));
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
  requestOtp: (body) => axiosInstance.post("/auth/otp/request", body).then(payload),
  verifyOtp: (body) => axiosInstance.post("/auth/otp/verify", body).then(payload),
  login: (body) => axiosInstance.post("/auth/login", body).then(payload),
  logout: () => axiosInstance.post("/auth/logout"),
};

export const branchApi = {
  list: (params) => axiosInstance.get("/branches", { params }).then(payload),
  get: (id) => axiosInstance.get(`/branches/${id}`).then(payload),
  create: (body) => axiosInstance.post("/branches", body).then(payload),
  update: (id, body) => axiosInstance.put(`/branches/${id}`, body).then(payload),
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
  terminate: (id, body) =>
    axiosInstance.post(`/contracts/${id}/terminate`, body).then(payload),
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
    data: options.body ? (typeof options.body === "string" ? JSON.parse(options.body) : options.body) : undefined,
    headers: options.headers,
    ...options,
  });
  return res.data;
}
