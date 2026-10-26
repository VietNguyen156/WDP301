import { useEffect } from "react";
import { getSocket } from "../services/socket";

/**
 * Hook lắng nghe sự kiện realtime từ Socket.io
 * @param {string} event Tên sự kiện ('payment:success', 'invoice_paid', 'incident:created', 'incident:updated')
 * @param {Function} handler Hàm callback xử lý payload
 */
export function useSocketEvent(event, handler) {
  useEffect(() => {
    if (!event || typeof handler !== "function") return;
    const socket = getSocket();

    socket.on(event, handler);

    return () => {
      socket.off(event, handler);
    };
  }, [event, handler]);
}
