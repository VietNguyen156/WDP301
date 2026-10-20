import { io } from "socket.io-client";

let socketInstance = null;

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (typeof window !== "undefined" && window.location.origin ? window.location.origin : "http://localhost:5000");

/**
 * Lấy hoặc khởi tạo kết nối Socket.io singleton
 * Tự động gắn token người dùng hoặc kết nối ẩn danh (dành cho trang hóa đơn công khai /i/:token)
 */
export function getSocket(token) {
  const effectiveToken = token !== undefined ? token : localStorage.getItem("token") || "";

  if (!socketInstance) {
    socketInstance = io(SOCKET_URL, {
      auth: { token: effectiveToken },
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketInstance.on("connect_error", (err) => {
      if (err?.message === "AUTH_REQUIRED") {
        const freshToken = localStorage.getItem("token");
        if (freshToken && freshToken !== socketInstance.auth.token) {
          socketInstance.auth.token = freshToken;
          socketInstance.connect();
        }
      }
    });
  } else if (token !== undefined && socketInstance.auth.token !== effectiveToken) {
    socketInstance.auth.token = effectiveToken;
    if (socketInstance.connected) {
      socketInstance.disconnect().connect();
    } else {
      socketInstance.connect();
    }
  }

  return socketInstance;
}

export function updateSocketAuthToken(token) {
  if (socketInstance) {
    socketInstance.auth.token = token || "";
    if (socketInstance.connected) {
      socketInstance.disconnect().connect();
    } else {
      socketInstance.connect();
    }
  }
}

export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}

/**
 * Đăng ký nhận sự kiện realtime của một hóa đơn cụ thể (yêu cầu đăng nhập)
 */
export function subscribeInvoice(invoiceId, onAck) {
  const socket = getSocket();
  socket.emit("invoice:subscribe", { invoiceId }, onAck);
  return () => {
    socket.emit("invoice:unsubscribe", { invoiceId });
  };
}

/**
 * Đăng ký nhận sự kiện realtime của hóa đơn qua token công khai (dành cho khách thuê xem /i/:token)
 */
export function subscribePublicInvoice(token, onAck) {
  const socket = getSocket();
  let subscribedInvoiceId = null;

  socket.emit("invoice:subscribe_public", { token }, (res) => {
    if (res?.ok && res.invoiceId) {
      subscribedInvoiceId = res.invoiceId;
    }
    if (typeof onAck === "function") onAck(res);
  });

  return () => {
    if (subscribedInvoiceId) {
      socket.emit("invoice:unsubscribe", { invoiceId: subscribedInvoiceId });
    }
  };
}
