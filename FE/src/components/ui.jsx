import { useEffect, useId, useRef } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  LoaderCircle,
  Search,
  X,
} from "lucide-react";
import { labels } from "../utils/format";
export function Button({
  children,
  variant = "primary",
  busy = false,
  compact = false,
  className = "",
  ...props
}) {
  return (
    <button
      className={`button ${variant}${compact ? " compact" : ""} ${className}`}
      {...props}
      disabled={busy || props.disabled}
    >
      {busy && <LoaderCircle className="spin" size={17} />}
      {children}
    </button>
  );
}
export function Badge({ status }) {
  return (
    <span className={`badge badge-${status?.toLowerCase()}`}>
      <i />
      {labels[status] || status}
    </span>
  );
}
export function Field({ label, children, hint, ...props }) {
  const id = useId();
  return (
    <label className="field" htmlFor={children ? undefined : id}>
      <span>
        {label}
        {props.required && <b> *</b>}
      </span>
      {children || <input id={id} {...props} />}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function SelectField({ label, children, ...props }) {
  return (
    <label className="field">
      <span>
        {label}
        {props.required && <b> *</b>}
      </span>
      <select {...props}>{children}</select>
    </label>
  );
}
export function LoadingState() {
  return (
    <div className="loading-state" role="status">
      <LoaderCircle className="spin" size={26} />
      <span>Đang tải dữ liệu…</span>
      <div className="skeleton" />
      <div className="skeleton" />
    </div>
  );
}
export function ErrorState({ message, retry }) {
  return (
    <div className="empty-state error-state" role="alert">
      <AlertCircle size={32} />
      <h3>Chưa thể tải dữ liệu</h3>
      <p>{message}</p>
      <Button variant="secondary" onClick={retry}>
        Thử lại
      </Button>
    </div>
  );
}
export function EmptyState({ title = "Chưa có dữ liệu", description, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Building2 size={30} />
      </div>
      <h3>{title}</h3>
      <p>{description || "Dữ liệu phù hợp sẽ xuất hiện tại đây."}</p>
      {action}
    </div>
  );
}
export function SearchBox({ value, onChange, placeholder = "Tìm kiếm…" }) {
  return (
    <div className="search-box">
      <Search size={18} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button aria-label="Xóa tìm kiếm" onClick={() => onChange("")}>
          <X size={16} />
        </button>
      )}
    </div>
  );
}
export function Pagination({ page, limit = 20, total, onChange }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="pagination">
      <span>
        {total
          ? `${(page - 1) * limit + 1}–${Math.min(page * limit, total)}`
          : 0}{" "}
        / {total} kết quả
      </span>
      <div>
        <Button
          variant="secondary"
          aria-label="Trang trước"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ArrowLeft size={16} />
        </Button>
        <span>
          Trang {page} / {pages}
        </span>
        <Button
          variant="secondary"
          aria-label="Trang sau"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          <ArrowRight size={16} />
        </Button>
      </div>
    </div>
  );
}
export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
  busy = false,
  footer,
  maxWidth,
  closeOnBackdropClick = true,
  className = "",
}) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement;
    ref.current.showModal();
    return () => previous?.focus();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""} ${className}`}
      style={maxWidth ? { maxWidth } : undefined}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (closeOnBackdropClick && e.target === ref.current && !busy) onClose();
      }}
    >
      <div className="modal-inner">
        <header>
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            className="icon-button"
            aria-label="Đóng"
            disabled={busy}
            onClick={onClose}
          >
            <X size={22} />
          </button>
        </header>
        {children}
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </dialog>
  );
}
export function PageHeader({ title, description, action }) {
  return (
    <header className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="page-actions">{action}</div>
    </header>
  );
}
export function Metric({ icon: Icon, label, value, detail, tone = "teal" }) {
  return (
    <div className="metric">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
      <div className={`metric-icon ${tone}`}>
        <Icon size={21} />
      </div>
    </div>
  );
}
export function FormError({ error }) {
  return error ? (
    <div className="form-error" role="alert">
      <AlertCircle size={18} />
      {error}
    </div>
  ) : null;
}
export { PasswordField } from "./ui/PasswordField";
export { Input, Select } from "./ui/Input";
export { Card } from "./ui/Card";
export { AddressAutocomplete } from "./ui/AddressAutocomplete";
export { CredentialsModal } from "./ui/CredentialsModal";
export { ErrorBoundary } from "./ui/ErrorBoundary";
