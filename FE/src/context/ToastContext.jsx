import React, { createContext, useContext, useState, useCallback } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message, type = "info", duration = 4000) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const toast = {
    success: (msg, duration) => addToast(msg, "success", duration),
    error: (msg, duration) => addToast(msg, "error", duration),
    warning: (msg, duration) => addToast(msg, "warning", duration),
    info: (msg, duration) => addToast(msg, "info", duration),
  };

  return (
    <ToastContext.Provider value={{ toast, addToast, removeToast }}>
      {children}
      {/* Toast Notification Container */}
      <div
        style={{
          position: "fixed",
          top: "20px",
          right: "20px",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          maxWidth: "420px",
          pointerEvents: "none",
        }}
      >
        {toasts.map((t) => {
          let bg = "#0f172a";
          let border = "#334155";
          let icon = "ℹ️";

          if (t.type === "success") {
            bg = "#064e3b";
            border = "#059669";
            icon = "✅";
          } else if (t.type === "error") {
            bg = "#7f1d1d";
            border = "#dc2626";
            icon = "❌";
          } else if (t.type === "warning") {
            bg = "#78350f";
            border = "#d97706";
            icon = "⚠️";
          }

          return (
            <div
              key={t.id}
              className="animate-slide-in"
              style={{
                pointerEvents: "auto",
                backgroundColor: bg,
                color: "#ffffff",
                border: `1px solid ${border}`,
                borderRadius: "8px",
                padding: "12px 16px",
                boxShadow: "0 10px 15px -3px rgba(0,0,0,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                fontSize: "0.93rem",
                lineHeight: "1.4",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "1.1rem" }}>{icon}</span>
                <span>{t.message}</span>
              </div>
              <button
                onClick={() => removeToast(t.id)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "rgba(255,255,255,0.7)",
                  cursor: "pointer",
                  fontSize: "1.1rem",
                  padding: "0 4px",
                  lineHeight: "1",
                }}
                title="Đóng"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
