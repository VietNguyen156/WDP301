import React from "react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error("DOMUS ERP Uncaught UI Error:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "var(--bg-app, #f8fafc)",
            padding: "24px",
            fontFamily: "var(--font-body, system-ui, sans-serif)",
          }}
        >
          <div
            style={{
              maxWidth: "600px",
              width: "100%",
              backgroundColor: "#ffffff",
              borderRadius: "16px",
              border: "1px solid #fee2e2",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
              padding: "32px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                backgroundColor: "#fef2f2",
                color: "#dc2626",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "20px",
                fontSize: "32px",
              }}
            >
              ⚠️
            </div>

            <h2
              style={{
                fontSize: "1.35rem",
                fontWeight: "700",
                color: "#0f172a",
                marginBottom: "8px",
              }}
            >
              Đã xảy ra sự cố hiển thị giao diện
            </h2>

            <p
              style={{
                fontSize: "0.9rem",
                color: "#64748b",
                lineHeight: "1.6",
                marginBottom: "20px",
              }}
            >
              Hệ thống gặp lỗi render không mong muốn:{" "}
              <strong style={{ color: "#b91c1c" }}>
                {this.state.error?.message || "Lỗi không xác định"}
              </strong>
            </p>

            {this.state.errorInfo && (
              <details
                style={{
                  textAlign: "left",
                  backgroundColor: "#f8fafc",
                  borderRadius: "8px",
                  padding: "12px 16px",
                  marginBottom: "24px",
                  fontSize: "0.78rem",
                  color: "#475569",
                  maxHeight: "180px",
                  overflowY: "auto",
                  border: "1px solid #e2e8f0",
                }}
              >
                <summary style={{ cursor: "pointer", fontWeight: "600", color: "#334155" }}>
                  Chi tiết kỹ thuật (Component Stack)
                </summary>
                <pre style={{ marginTop: "8px", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {this.state.error?.stack}
                  {"\n"}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div style={{ display: "flex", justifyContent: "center", gap: "12px" }}>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  padding: "10px 24px",
                  borderRadius: "8px",
                  backgroundColor: "#005c55",
                  color: "#ffffff",
                  fontWeight: "600",
                  fontSize: "0.9rem",
                  border: "none",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                🔄 Tải lại trang
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
