import React from "react";

export function Card({ children, className = "", style = {}, onClick }) {
  return (
    <div
      className={`card ${className}`}
      style={{
        ...style,
        cursor: onClick ? "pointer" : "default",
      }}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
