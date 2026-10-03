import React from "react";

export function Button({
  children,
  variant = "primary",
  size = "md",
  type = "button",
  disabled = false,
  loading = false,
  onClick,
  style = {},
  className = "",
  ...props
}) {
  const baseStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    fontWeight: "600",
    borderRadius: "var(--radius-md)",
    transition: "all 0.15s ease",
    cursor: disabled || loading ? "not-allowed" : "pointer",
    opacity: disabled || loading ? 0.6 : 1,
    whiteSpace: "nowrap",
    textDecoration: "none",
  };

  const sizeStyles = {
    sm: { padding: "5px 10px", fontSize: "0.85rem", height: "30px" },
    md: { padding: "8px 14px", fontSize: "0.92rem", height: "36px" },
    lg: { padding: "10px 18px", fontSize: "1rem", height: "42px" },
  };

  const variantStyles = {
    primary: {
      backgroundColor: "var(--primary)",
      color: "#ffffff",
      border: "1px solid var(--primary)",
    },
    secondary: {
      backgroundColor: "var(--secondary-subtle)",
      color: "var(--secondary)",
      border: "1px solid var(--secondary-border)",
    },
    outline: {
      backgroundColor: "var(--white)",
      color: "var(--neutral-700)",
      border: "1px solid var(--border-color)",
    },
    destructive: {
      backgroundColor: "var(--error-bg)",
      color: "var(--error-text)",
      border: "1px solid var(--error-border)",
    },
    ghost: {
      backgroundColor: "transparent",
      color: "var(--neutral-600)",
      border: "1px solid transparent",
    },
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      style={{
        ...baseStyle,
        ...sizeStyles[size],
        ...variantStyles[variant],
        ...style,
      }}
      className={className}
      {...props}
    >
      {loading && (
        <span
          style={{
            width: "12px",
            height: "12px",
            border: "2px solid currentColor",
            borderRightColor: "transparent",
            borderRadius: "50%",
            animation: "spin 0.75s linear infinite",
            display: "inline-block",
          }}
        />
      )}
      {children}
    </button>
  );
}
