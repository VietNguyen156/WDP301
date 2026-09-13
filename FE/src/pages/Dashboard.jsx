import React from "react";
import { useAuth } from "../context/AuthContext";
import {
  Building2,
  LogOut,
  User,
  ShieldCheck,
  CreditCard,
  Home,
  CheckCircle,
  Clock,
  Layers,
} from "lucide-react";

export default function Dashboard() {
  const { user, logout } = useAuth();

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case "LANDLORD":
        return "badge-landlord";
      case "ADMIN":
        return "badge-admin";
      case "PROPERTY_MANAGER":
        return "badge-manager";
      default:
        return "badge-tenant";
    }
  };

  return (
    <div className="dashboard-layout">
      {/* Top Navigation */}
      <header className="dashboard-nav">
        <div className="nav-brand">
          <Building2 size={24} color="var(--color-primary)" />
          <span>WDP301 SaaS Trọ</span>
        </div>

        <div className="nav-user">
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{user?.name}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end", marginTop: 2 }}>
              <span className={`user-badge ${getRoleBadgeClass(user?.role)}`}>
                {user?.role}
              </span>
              {user?.isEmailVerified && (
                <span title="Email đã xác thực" style={{ display: "inline-flex", color: "var(--color-success)" }}>
                  <CheckCircle size={14} />
                </span>
              )}
            </div>
          </div>

          <button
            onClick={logout}
            className="btn-secondary"
            title="Đăng xuất khỏi hệ thống"
          >
            <LogOut size={16} /> Đăng xuất
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="dashboard-content">
        {/* Welcome Card */}
        <div
          style={{
            background: "linear-gradient(135deg, #1e3a8a, #2563eb)",
            color: "#ffffff",
            padding: "28px 32px",
            borderRadius: "var(--radius-lg)",
            marginBottom: "28px",
            boxShadow: "var(--shadow-md)",
          }}
        >
          <div style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 1, opacity: 0.8, fontWeight: 700 }}>
            Hệ thống Multi-tenancy SaaS
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, marginTop: 4, marginBottom: 8 }}>
            Chào mừng trở lại, {user?.name}!
          </h2>
          <p style={{ opacity: 0.9, fontSize: 14, maxWidth: 650 }}>
            Tài khoản của bạn đã được xác thực email thành công. Dữ liệu của bạn được cô lập an toàn với Tenant ID:{" "}
            <code style={{ background: "rgba(255,255,255,0.2)", padding: "2px 8px", borderRadius: 4, fontFamily: "monospace" }}>
              {user?.landlordId}
            </code>
          </p>
        </div>

        {/* 3-Second Dashboard Cards theo PROJECT_RULES */}
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-secondary)", marginBottom: 12 }}>
          Tổng Quan Doanh Thu & Phòng (3-Second Dashboard)
        </h3>

        <div className="stats-grid">
          <div className="stat-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="stat-title">Doanh Thu Tháng Này</span>
              <CreditCard size={18} color="var(--color-primary)" />
            </div>
            <div className="stat-value">0 đ</div>
            <div className="stat-note">Thực thu so với 0 đ dự thu</div>
          </div>

          <div className="stat-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="stat-title">Phòng Chưa Đóng Tiền</span>
              <Clock size={18} color="var(--color-warning)" />
            </div>
            <div className="stat-value">0 phòng</div>
            <div className="stat-note">0 quá hạn cần gửi tin nhắc</div>
          </div>

          <div className="stat-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="stat-title">Tỷ Lệ Lấp Đầy</span>
              <Home size={18} color="var(--color-success)" />
            </div>
            <div className="stat-value">100%</div>
            <div className="stat-note">0 phòng trống sẵn sàng đón khách</div>
          </div>
        </div>

        {/* Thông tin tài khoản & Multi-tenant Profile */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-lg)",
            padding: "24px",
            marginTop: "28px",
          }}
        >
          <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <Layers size={18} color="var(--color-primary)" />
            Thông Tin Phiên Xác Thực (Option B - HttpOnly Cookie)
          </h4>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, fontSize: 13 }}>
            <div>
              <span style={{ color: "var(--color-text-muted)" }}>Địa chỉ Email:</span>
              <div style={{ fontWeight: 600, marginTop: 2 }}>{user?.email}</div>
            </div>
            <div>
              <span style={{ color: "var(--color-text-muted)" }}>Số điện thoại:</span>
              <div style={{ fontWeight: 600, marginTop: 2 }}>{user?.phoneNumber || "Chưa cập nhật"}</div>
            </div>
            <div>
              <span style={{ color: "var(--color-text-muted)" }}>Trạng thái xác thực Email:</span>
              <div style={{ fontWeight: 600, color: "var(--color-success)", marginTop: 2 }}>
                ✓ Đã xác thực qua Nodemailer
              </div>
            </div>
            <div>
              <span style={{ color: "var(--color-text-muted)" }}>Cơ chế bảo mật Token:</span>
              <div style={{ fontWeight: 600, color: "var(--color-primary)", marginTop: 2 }}>
                Access Token (In-memory) + Refresh Token (HttpOnly Cookie)
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
