import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  CheckCircle2,
  X,
  AlertCircle,
  AlertTriangle,
  Info,
} from "lucide-react";

const ToastContext = createContext(null);

function buildToastApi(addToast, removeToast) {
  const fn = (message, type = "success", duration) =>
    addToast(message, type, duration);
  fn.success = (msg, duration) => addToast(msg, "success", duration);
  fn.error = (msg, duration) => addToast(msg, "error", duration);
  fn.warning = (msg, duration) => addToast(msg, "warning", duration);
  fn.info = (msg, duration) => addToast(msg, "info", duration);
  fn.toast = fn;
  fn.addToast = addToast;
  fn.removeToast = removeToast;
  return fn;
}

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const stackRef = useRef(null);

  const promoteToTopLayer = useCallback(() => {
    const el = stackRef.current;
    if (!el || typeof el.showPopover !== "function") return;
    try {
      if (el.matches(":popover-open")) {
        el.hidePopover();
      }
      el.showPopover();
    } catch {
      // Ignore if browser does not support Popover API
    }
  }, []);

  // Keep toast-stack in the browser #top-layer above any open <dialog> modal & ::backdrop
  useEffect(() => {
    const el = stackRef.current;
    if (!el || typeof el.showPopover !== "function") return;
    if (items.length > 0) {
      promoteToTopLayer();
    } else {
      try {
        if (el.matches(":popover-open")) el.hidePopover();
      } catch {
        // Ignore
      }
    }
  }, [items, promoteToTopLayer]);

  // If a <dialog> modal opens while toasts are visible, re-promote toast-stack above it
  useEffect(() => {
    if (items.length === 0 || typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (
          m.type === "attributes" &&
          m.target?.nodeName === "DIALOG" &&
          m.target.hasAttribute("open")
        ) {
          promoteToTopLayer();
          break;
        }
      }
    });
    observer.observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ["open"],
    });
    return () => observer.disconnect();
  }, [items.length, promoteToTopLayer]);

  const removeToast = useCallback((id) => {
    setItems((current) => current.filter((x) => x.id !== id));
  }, []);

  const addToast = useCallback(
    (message, type = "success", duration = 5000) => {
      const id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : String(Date.now() + Math.random());
      setItems((current) => [...current, { id, message, type }]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
      return id;
    },
    [removeToast],
  );

  const toastFn = React.useMemo(
    () => buildToastApi(addToast, removeToast),
    [addToast, removeToast],
  );

  return (
    <ToastContext.Provider value={toastFn}>
      {children}
      <div
        ref={stackRef}
        popover="manual"
        className="toast-stack"
        aria-live="polite"
      >
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
              type="button"
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
