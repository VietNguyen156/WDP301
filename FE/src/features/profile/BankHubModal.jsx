import React, { useState, useEffect } from "react";
import { Modal, Button, LoadingState } from "../../components/ui";
import { bankHubApi, errorMessage } from "../../services/api";
import { useToast } from "../../context/ToastContext";
import { ShieldCheck, AlertCircle, RefreshCw, ExternalLink } from "lucide-react";

export default function BankHubModal({ isOpen, onClose, purpose = "LINK", onSynced }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [linkData, setLinkData] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const isLink = purpose === "LINK";

  useEffect(() => {
    let active = true;
    if (isOpen) {
      setLoading(true);
      setError("");
      setLinkData(null);

      bankHubApi
        .createLinkToken({ purpose })
        .then((res) => {
          if (active && res) {
            setLinkData(res);
          }
        })
        .catch((err) => {
          if (active) {
            const msg = errorMessage(err);
            setError(msg);
            toast.error(msg);
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }

    return () => {
      active = false;
    };
  }, [isOpen, purpose]);

  // PostMessage listener for SePay Bank Hub iframe
  useEffect(() => {
    if (!isOpen || !linkData?.hostedLinkUrl) return;

    let allowedOrigin = "";
    try {
      allowedOrigin = new URL(linkData.hostedLinkUrl).origin;
    } catch {
      // Ignore URL parsing error
    }

    const onMessage = async (event) => {
      if (allowedOrigin && event.origin !== allowedOrigin) return;

      const eventType = event.data?.event;
      if (!eventType) return;

      switch (eventType) {
        case "FINISHED_BANK_ACCOUNT_LINK":
        case "FINISHED_BANK_ACCOUNT_UNLINK": {
          setSyncing(true);
          try {
            const syncRes = await bankHubApi.sync();
            toast.success(
              isLink
                ? "Liên kết tài khoản ngân hàng qua SePay Bank Hub thành công!"
                : "Đã hủy liên kết tài khoản ngân hàng."
            );
            if (syncRes?.refreshedInvoices) {
              toast.info(
                `Đã cập nhật mã VietQR cho ${syncRes.refreshedInvoices} hóa đơn chưa thanh toán.`
              );
            }
            if (onSynced) onSynced(syncRes);
            onClose();
          } catch (err) {
            toast.error(errorMessage(err));
          } finally {
            setSyncing(false);
          }
          break;
        }

        case "BANKHUB_TOKEN_EXPIRED":
        case "BANKHUB_SESSION_EXPIRED": {
          toast.warning("Phiên liên kết ngân hàng đã hết hạn. Vui lòng mở lại.");
          onClose();
          break;
        }

        case "BANKHUB_CLOSE_LINK": {
          onClose();
          break;
        }

        default:
          break;
      }
    };

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, [isOpen, linkData, isLink, onClose, onSynced]);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isLink ? "Liên kết tài khoản qua SePay Bank Hub" : "Hủy liên kết tài khoản SePay Bank Hub"}
      subtitle="Giao diện xác thực bảo mật trực tiếp được cung cấp bởi SePay Sandbox/Production"
      wide
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#64748b" }}>
            <ShieldCheck size={16} color="#005c55" />
            <span>Mã hóa bảo mật chuẩn ngân hàng SePay Bank Hub</span>
          </div>
          <Button type="button" variant="secondary" onClick={onClose} disabled={syncing}>
            Đóng cửa sổ
          </Button>
        </div>
      }
    >
      <div style={{ minHeight: "560px", display: "flex", flexDirection: "column" }}>
        {loading && (
          <div style={{ padding: "60px 20px", textAlign: "center" }}>
            <LoadingState message="Đang khởi tạo phiên kết nối an toàn với SePay Bank Hub..." />
          </div>
        )}

        {error && (
          <div
            style={{
              padding: "24px",
              margin: "20px",
              borderRadius: "10px",
              backgroundColor: "#fef2f2",
              border: "1px solid #fecaca",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#b91c1c" }}>
              <AlertCircle size={20} />
              <strong style={{ fontSize: "14px" }}>Không thể kết nối SePay Bank Hub</strong>
            </div>
            <p style={{ margin: 0, fontSize: "13px", color: "#991b1b", lineHeight: 1.5 }}>
              {error}
            </p>
            <p style={{ margin: 0, fontSize: "12px", color: "#7f1d1d" }}>
              * Lưu ý: Tính năng SePay Bank Hub yêu cầu tài khoản chủ trọ sử dụng gói có tính năng <strong>SEPAY_WEBHOOK</strong> (Gói Starter trở lên) và cấu hình khóa API trong hệ thống.
            </p>
            <div style={{ marginTop: "8px" }}>
              <Button type="button" variant="secondary" onClick={onClose}>
                Quay lại
              </Button>
            </div>
          </div>
        )}

        {syncing && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: "rgba(255, 255, 255, 0.9)",
              zIndex: 10,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
            }}
          >
            <RefreshCw size={28} className="animate-spin" color="#005c55" />
            <strong style={{ color: "#005c55" }}>Đang đồng bộ tài khoản và cập nhật mã VietQR...</strong>
          </div>
        )}

        {!loading && !error && linkData?.hostedLinkUrl && (
          <iframe
            src={linkData.hostedLinkUrl}
            title="SePay Bank Hub Hosted Link"
            allow="clipboard-write"
            style={{
              width: "100%",
              height: "580px",
              border: "none",
              borderRadius: "8px",
              backgroundColor: "#ffffff",
            }}
          />
        )}
      </div>
    </Modal>
  );
}
