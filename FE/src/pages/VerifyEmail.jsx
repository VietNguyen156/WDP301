import React, { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { CheckCircle2, XCircle, Building2, ArrowRight } from "lucide-react";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const { verifyEmail } = useAuth();
  const navigate = useNavigate();

  const [status, setStatus] = useState("loading"); // loading | success | error
  const [message, setMessage] = useState("");
  const verifiedRef = useRef(false);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Không tìm thấy mã token xác thực trong liên kết.");
      return;
    }

    if (verifiedRef.current) return;
    verifiedRef.current = true;

    const executeVerify = async () => {
      try {
        const res = await verifyEmail(token);
        setStatus("success");
        setMessage(res.message || "Tài khoản của bạn đã được kích hoạt thành công!");
      } catch (err) {
        setStatus("error");
        setMessage(err.message || "Liên kết xác thực không hợp lệ hoặc đã hết hạn.");
      }
    };

    executeVerify();
  }, [token, verifyEmail]);

  return (
    <div className="auth-page-container">
      <div className="auth-card" style={{ textAlign: "center" }}>
        <div className="auth-header">
          <div className="brand-badge">
            <Building2 size={16} />
            WDP301 SaaS
          </div>
          <h1 className="auth-title">Xác Thực Tài Khoản</h1>
        </div>

        {status === "loading" && (
          <div className="loader-container" style={{ margin: "30px 0" }}>
            <div className="spinner dark" style={{ width: 36, height: 36 }} />
            <p className="loading-text">Đang kiểm tra và kích hoạt tài khoản của bạn...</p>
          </div>
        )}

        {status === "success" && (
          <div>
            <div style={{ display: "inline-flex", padding: 16, background: "var(--color-success-bg)", borderRadius: "50%", marginBottom: 16 }}>
              <CheckCircle2 size={44} color="var(--color-success)" />
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: "var(--color-secondary)", marginBottom: 8 }}>
              Kích Hoạt Thành Công!
            </h3>
            <p style={{ fontSize: 14, color: "var(--color-text-muted)", marginBottom: 24 }}>
              {message}
            </p>

            <button
              onClick={() => navigate("/dashboard", { replace: true })}
              className="btn-primary"
            >
              Vào Bảng Điều Khiển Ngay <ArrowRight size={16} />
            </button>
          </div>
        )}

        {status === "error" && (
          <div>
            <div style={{ display: "inline-flex", padding: 16, background: "var(--color-danger-bg)", borderRadius: "50%", marginBottom: 16 }}>
              <XCircle size={44} color="var(--color-danger)" />
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: "#b91c1c", marginBottom: 8 }}>
              Xác Thực Không Thành Công
            </h3>
            <p style={{ fontSize: 14, color: "var(--color-text-muted)", marginBottom: 24 }}>
              {message}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Link to="/login" className="btn-primary" style={{ textDecoration: "none" }}>
                Đến trang Đăng nhập
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
