import React from "react";

export function Badge({
  children,
  variant = "neutral",
  dot = true,
  className = "",
  style = {},
}) {
  const variantClass = `badge-${variant}`;

  return (
    <span className={`badge ${variantClass} ${className}`} style={style}>
      {dot && <span className="badge-dot" />}
      {children}
    </span>
  );
}
