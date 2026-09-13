const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

let inMemoryToken = null;

export const setAccessToken = (token) => {
  inMemoryToken = token;
};

export const getAccessToken = () => inMemoryToken;

// Custom fetch wrapper hỗ trợ gửi credentials (Cookie) và tự động silent refresh token
export const authFetch = async (endpoint, options = {}) => {
  const url = endpoint.startsWith("http") ? endpoint : `${API_URL}${endpoint}`;

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (inMemoryToken && !headers.Authorization) {
    headers.Authorization = `Bearer ${inMemoryToken}`;
  }

  let response = await fetch(url, {
    ...options,
    headers,
    credentials: "include", // Bắt buộc để gửi và nhận HttpOnly Cookie
  });

  // Nếu token hết hạn (401), tự động gọi API refresh token ngầm
  if (response.status === 401 && !options._isRetry && !url.includes("/auth/refresh")) {
    try {
      const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        setAccessToken(refreshData.accessToken);

        // Thử lại request ban đầu với token mới
        headers.Authorization = `Bearer ${refreshData.accessToken}`;
        response = await fetch(url, {
          ...options,
          headers,
          credentials: "include",
          _isRetry: true,
        });
      } else {
        setAccessToken(null);
      }
    } catch (err) {
      setAccessToken(null);
    }
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || "Đã có lỗi xảy ra");
    error.status = response.status;
    error.code = data.code;
    error.data = data;
    throw error;
  }

  return data;
};

export const authApi = {
  register: (payload) =>
    authFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  login: (payload) =>
    authFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  verifyEmail: (token) =>
    authFetch(`/auth/verify-email?token=${token}`, {
      method: "GET",
    }),

  resendVerification: (email) =>
    authFetch("/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  refreshToken: () =>
    authFetch("/auth/refresh", {
      method: "POST",
    }),

  logout: () =>
    authFetch("/auth/logout", {
      method: "POST",
    }),

  getMe: () =>
    authFetch("/auth/me", {
      method: "GET",
    }),
};
