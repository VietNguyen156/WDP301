import axios from "axios";

let accessToken = null;
let refreshRequest = null;
let onSessionExpired = () => {};
export const setAccessToken = (value) => {
  accessToken = value;
};
export const setSessionExpiredHandler = (handler) => {
  onSessionExpired = handler;
};
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api/v1",
  withCredentials: true,
  timeout: 20000,
});
api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});
export async function restoreSession() {
  if (!refreshRequest)
    refreshRequest = api
      .post("/auth/refresh")
      .then(({ data }) => {
        setAccessToken(data.data.token);
        return data.data;
      })
      .finally(() => {
        refreshRequest = null;
      });
  return refreshRequest;
}
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    if (
      error.response?.status === 401 &&
      config &&
      !config._retry &&
      !config.url.startsWith("/auth/")
    ) {
      config._retry = true;
      try {
        await restoreSession();
        return api(config);
      } catch {
        setAccessToken(null);
        onSessionExpired();
      }
    }
    return Promise.reject(error);
  },
);
const payload = (response) => response.data.data;
export const authApi = {
  requestOtp: (body) => api.post("/auth/otp/request", body).then(payload),
  verifyOtp: (body) => api.post("/auth/otp/verify", body).then(payload),
  login: (body) => api.post("/auth/login", body).then(payload),
  logout: () => api.post("/auth/logout"),
};
export const branchApi = {
  list: (params) => api.get("/branches", { params }).then(payload),
  get: (id) => api.get(`/branches/${id}`).then(payload),
  create: (body) => api.post("/branches", body).then(payload),
  update: (id, body) => api.put(`/branches/${id}`, body).then(payload),
  remove: (id) => api.delete(`/branches/${id}`).then(payload),
  options: async () => {
    let page = 1,
      items = [],
      result;
    do {
      result = await branchApi.list({ page, limit: 100 });
      items.push(...result.items);
      page++;
    } while (items.length < result.total);
    return items;
  },
};
export const roomApi = {
  list: (branchId, params) =>
    api.get(`/branches/${branchId}/rooms`, { params }).then(payload),
  get: (id) => api.get(`/rooms/${id}`).then(payload),
  create: (branchId, body) =>
    api.post(`/branches/${branchId}/rooms`, body).then(payload),
  bulk: (branchId, body) =>
    api.post(`/branches/${branchId}/rooms/bulk`, body).then(payload),
  update: (id, body) => api.put(`/rooms/${id}`, body).then(payload),
  remove: (id) => api.delete(`/rooms/${id}`).then(payload),
  available: async (branchId) => {
    let page = 1,
      items = [],
      result;
    do {
      result = await roomApi.list(branchId, {
        status: "EMPTY",
        page,
        limit: 100,
      });
      items.push(...result.items);
      page++;
    } while (items.length < result.total);
    return items;
  },
};
export const contractApi = {
  list: (params) => api.get("/contracts", { params }).then(payload),
  get: (id) => api.get(`/contracts/${id}`).then(payload),
  create: (body) => api.post("/contracts", body).then(payload),
  terminate: (id, body) =>
    api.post(`/contracts/${id}/terminate`, body).then(payload),
};
export const errorMessage = (error) =>
  error.response?.data?.message ||
  (error.code === "ECONNABORTED"
    ? "Yêu cầu quá thời gian chờ. Vui lòng thử lại."
    : "Không thể kết nối máy chủ. Kiểm tra BE rồi thử lại.");
