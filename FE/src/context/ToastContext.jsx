import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { CheckCircle2, X, AlertCircle, AlertTriangle, Info } from "lucide-react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const removeToast = useCallback((id) => {
    setItems((current) => current.filter((x) => x.id !== id));
  }, []);

  const addToast = useCallback((message, type = "success", duration = 5000) => {
    const id = (typeof crypto !== "undefined" && crypto.randomUUID)
      ? crypto.randomUUID()
      : String(Date.now() + Math.random());
    setItems((current) => [...current, { id, message, type }]);

    if (duration > 0) {
      const timer = setTimeout(() => {
        removeToast(id);
      }, duration);
      timers.current.push(timer);
    }
    return id;
  }, [removeToast]);

  const toastFn = useCallback((message, type = "success", duration) => {
    return addToast(message, type, duration);
  }, [addToast]);

  toastFn.success = (msg, duration) => addToast(msg, "success", duration);
  toastFn.error = (msg, duration) => addToast(msg, "error", duration);
  toastFn.warning = (msg, duration) => addToast(msg, "warning", duration);
  toastFn.info = (msg, duration) => addToast(msg, "info", duration);
  toastFn.toast = toastFn;
  toastFn.addToast = addToast;
  toastFn.removeToast = removeToast;

  return (
    <ToastContext.Provider value={toastFn}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {items.map((item) => (
          <div
            key={item.id}
            className={`toast ${item.type} animate-slide-in`}
            role={item.type === "error" ? "alert" : "status"}
          >
            {item.type === "error" && <AlertCircle size={20} />}
            {item.type === "warning" && <AlertTriangle size={20} />}
            {item.type === "info" && <Info size={20} />}
            {item.type === "success" && <CheckCircle2 size={20} />}
            <span style={{ flex: 1 }}>{item.message}</span>
            <button
              aria-label="Đóng thông báo"
              onClick={() => removeToast(item.id)}
              style={{
                background: "transparent",
                border: "none",
                color: "inherit",
                cursor: "pointer",
                padding: "2px",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// oxlint-disable-next-line react/only-export-components -- context hook shares provider
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
