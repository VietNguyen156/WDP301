import { useState } from "react";
import { Headphones, Shield } from "lucide-react";
import { useLoginForm, useRegisterForm } from "../../hooks/useAuthForms";
import { AuthHeroPanel, LoginForm, RegisterForm, AccountChooser } from "../../components/auth";
import { useToast } from "../../context/ToastContext";
import "./Auth.css";

export default function LoginPage() {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const toast = useToast();

  const loginForm = useLoginForm();
  const registerForm = useRegisterForm();

  function switchMode(nextMode) {
    setMode(nextMode);
    loginForm.setError("");
    registerForm.setError("");
  }

  function handleSupportClick(e) {
    e.preventDefault();
    toast.info(
      "Tổng đài hỗ trợ kỹ thuật DOMUS ERP 24/7: support@domus.vn • Hotline: 1900 6868.",
    );
  }

  return (
    <main className="domus-portal-layout">
      {/* LEFT PANEL: Enterprise Branding, Showcase & Architecture Trust */}
      <AuthHeroPanel />

      {/* RIGHT PANEL: Multi-Role Authentication Form */}
      <section className="domus-portal-right">
        {/* Top Action Navigation */}
        <div className="domus-right-topbar">
          <div className="domus-portal-tag-wrap">
            <span className="domus-portal-tag">
              {mode === "login"
                ? "CỔNG ĐĂNG NHẬP CHÍNH THỨC"
                : "CỔNG ĐĂNG KÝ CHỦ CHUỖI (LANDLORD)"}
            </span>
          </div>

          <div className="domus-support-wrap">
            <a
              href="#support"
              onClick={handleSupportClick}
              className="domus-support-link"
            >
              <Headphones size={16} />
              <span>Hỗ trợ kỹ thuật 24/7</span>
            </a>
          </div>
        </div>

        {/* Main Form Container */}
        <div className="domus-right-center">
          {mode === "login" ? (
            loginForm.choices ? (
              <AccountChooser form={loginForm} />
            ) : (
              <LoginForm
                form={loginForm}
                onSwitchToRegister={() => switchMode("register")}
              />
            )
          ) : (
            <RegisterForm
              form={registerForm}
              onSwitchToLogin={() => switchMode("login")}
            />
          )}
        </div>

        {/* Footer Policy Links */}
        <footer className="domus-right-footer">
          <div className="domus-policy-links">
            <a href="#terms" onClick={(e) => e.preventDefault()}>
              Điều khoản dịch vụ
            </a>
            <span>•</span>
            <a href="#privacy" onClick={(e) => e.preventDefault()}>
              Chính sách bảo mật RBAC v3.4
            </a>
            <span>•</span>
            <a href="#sepay" onClick={(e) => e.preventDefault()}>
              Hỗ trợ SePay Webhook
            </a>
          </div>

          <div className="domus-shield-badge">
            <Shield size={14} />
            <span>Bảo vệ phiên bởi DOMUS Shield™</span>
          </div>
        </footer>
      </section>
    </main>
  );
}
