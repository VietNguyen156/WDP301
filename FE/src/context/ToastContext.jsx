import { createContext, useContext, useEffect, useRef, useState } from "react";
import { CheckCircle2, X, AlertCircle } from "lucide-react";
const Context = createContext(null);
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const toast = (message, type = "success") => {
    const id = crypto.randomUUID();
    setItems((current) => [...current, { id, message, type }]);
    timers.current.push(
      setTimeout(
        () => setItems((current) => current.filter((x) => x.id !== id)),
        6000,
      ),
    );
  };
  return (
    <Context.Provider value={toast}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {items.map((item) => (
          <div
            key={item.id}
            className={`toast ${item.type}`}
            role={item.type === "error" ? "alert" : "status"}
          >
            {item.type === "error" ? (
              <AlertCircle2Fallback />
            ) : (
              <CheckCircle2 size={20} />
            )}
            <span>{item.message}</span>
            <button
              aria-label="Đóng thông báo"
              onClick={() =>
                setItems((current) => current.filter((x) => x.id !== item.id))
              }
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </Context.Provider>
  );
}
function AlertCircle2Fallback() {
  return <AlertCircle size={20} />;
}
// oxlint-disable-next-line react/only-export-components -- context hook shares provider
export const useToast = () => useContext(Context);
