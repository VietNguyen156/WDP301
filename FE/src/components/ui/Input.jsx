import React from "react";

export function Input({
  label,
  error,
  helperText,
  id,
  required = false,
  className = "",
  containerStyle = {},
  ...props
}) {
  const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, "-")}` : undefined);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px", ...containerStyle }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            fontSize: "0.85rem",
            fontWeight: "600",
            color: "var(--neutral-700)",
          }}
        >
          {label} {required && <span style={{ color: "var(--error)" }}>*</span>}
        </label>
      )}
      <input
        id={inputId}
        className={className}
        style={{
          borderColor: error ? "var(--error)" : undefined,
        }}
        {...props}
      />
      {error ? (
        <span style={{ fontSize: "0.78rem", color: "var(--error)" }}>{error}</span>
      ) : helperText ? (
        <span style={{ fontSize: "0.78rem", color: "var(--neutral-500)" }}>{helperText}</span>
      ) : null}
    </div>
  );
}

export function Select({
  label,
  error,
  helperText,
  id,
  required = false,
  options = [],
  children,
  className = "",
  containerStyle = {},
  ...props
}) {
  const selectId = id || (label ? `select-${label.toLowerCase().replace(/\s+/g, "-")}` : undefined);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px", ...containerStyle }}>
      {label && (
        <label
          htmlFor={selectId}
          style={{
            fontSize: "0.85rem",
            fontWeight: "600",
            color: "var(--neutral-700)",
          }}
        >
          {label} {required && <span style={{ color: "var(--error)" }}>*</span>}
        </label>
      )}
      <select
        id={selectId}
        className={className}
        style={{
          borderColor: error ? "var(--error)" : undefined,
        }}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
        {children}
      </select>
      {error ? (
        <span style={{ fontSize: "0.78rem", color: "var(--error)" }}>{error}</span>
      ) : helperText ? (
        <span style={{ fontSize: "0.78rem", color: "var(--neutral-500)" }}>{helperText}</span>
      ) : null}
    </div>
  );
}
