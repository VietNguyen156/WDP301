import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Printer,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FileCheck2,
  ShieldCheck,
  CreditCard,
  Phone,
  Mail,
  Home,
  Clock,
  Zap,
  Droplets,
  AlertTriangle,
  Receipt,
  FileText,
  BadgePercent,
  Copy,
  Check,
  MapPin,
  Calendar,
  Building2,
  User,
} from "lucide-react";
import { contractApi, errorMessage } from "../../services/api";
import { useResource } from "../../hooks/useResource";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import {
  Button,
  Field,
  Modal,
  FormError,
  LoadingState,
  ErrorState,
} from "../../components/ui";
import { date, money, labels } from "../../utils/format";
import "./Contracts.css";
import { ContractFurnishings } from "../../components/furnishings/FurnishingsTable";
import SettlementWorkflow from "./SettlementWorkflow";
import { TERMINATION_REASONS } from "../../utils/terminationReasons";
import { useLiveRefresh } from "../../hooks/useLiveRefresh";

// Clauses printed in every contract; numbers come from contract.contractTerms.
function contractArticles(c) {
  const terms = c.contractTerms || {};
  const dueDays = terms.paymentDueDays ?? 5;
  const penalty = terms.latePaymentPenaltyRate ?? 0.5;
  const notice = terms.terminationNoticeDays ?? 30;
  const address =
    c.branchId?.address?.fullAddress ||
    c.branchId?.name ||
    "nơi có nhà cho thuê";
  return [
    {
      title: "Quyền và nghĩa vụ của Bên cho thuê (Bên A)",
      groups: [
        {
          heading: "Quyền:",
          items: [
            "Nhận đủ tiền thuê, tiền điện, nước và phí dịch vụ đúng hạn theo hợp đồng.",
            "Yêu cầu Bên B bồi thường thiệt hại do lỗi của Bên B gây ra đối với phòng và tài sản.",
            "Kiểm tra tình trạng phòng sau khi báo trước cho Bên B, không làm ảnh hưởng đến sinh hoạt của Bên B.",
            "Đơn phương chấm dứt hợp đồng trong các trường hợp nêu tại Điều 6.",
          ],
        },
        {
          heading: "Nghĩa vụ:",
          items: [
            "Bàn giao phòng và trang thiết bị đúng tình trạng, chỉ số điện nước như đã ghi nhận khi ký.",
            "Bảo đảm cho Bên B sử dụng phòng ổn định trong suốt thời hạn thuê.",
            "Sửa chữa hư hỏng thuộc kết cấu và thiết bị không do lỗi của Bên B trong thời gian hợp lý.",
            "Hoàn trả tiền cọc khi thanh lý, sau khi trừ các khoản Bên B còn nợ hoặc phải bồi thường.",
            "Thực hiện đăng ký tạm trú cho Bên B theo quy định của pháp luật về cư trú.",
          ],
        },
      ],
    },
    {
      title: "Quyền và nghĩa vụ của Bên thuê (Bên B)",
      groups: [
        {
          heading: "Quyền:",
          items: [
            "Nhận phòng và trang thiết bị theo đúng thỏa thuận; sử dụng ổn định trong thời hạn thuê.",
            "Yêu cầu Bên A sửa chữa hư hỏng không do lỗi của mình.",
            "Được ưu tiên ký tiếp hợp đồng khi hết hạn nếu đã thực hiện đầy đủ nghĩa vụ.",
            "Đơn phương chấm dứt hợp đồng trong các trường hợp nêu tại Điều 6.",
          ],
        },
        {
          heading: "Nghĩa vụ:",
          items: [
            "Thanh toán tiền thuê và các chi phí phát sinh đầy đủ, đúng hạn.",
            "Sử dụng phòng đúng mục đích để ở; không dùng vào hoạt động trái pháp luật.",
            "Không tự ý sửa chữa, cải tạo, cho thuê lại hoặc chuyển nhượng hợp đồng khi chưa có đồng ý bằng văn bản của Bên A.",
            "Chấp hành nội quy khu trọ, quy định về phòng cháy chữa cháy, an ninh trật tự và vệ sinh chung.",
            "Trả lại phòng và trang thiết bị khi hết hạn hoặc khi chấm dứt hợp đồng.",
          ],
        },
      ],
    },
    {
      title: "Bảo quản tài sản và trang thiết bị",
      groups: [
        {
          items: [
            "Bên B có trách nhiệm giữ gìn phòng, trang thiết bị và tài sản chung.",
            c.furnishings?.length
              ? "Vật dụng bàn giao kèm phòng được liệt kê kèm đơn giá trong mục Tài sản & vật dụng bàn giao của hợp đồng này. Hư hỏng, mất mát do lỗi của Bên B thì Bên B sửa chữa hoặc bồi thường theo đơn giá đó (hoặc chi phí sửa chữa thực tế nếu thấp hơn); tài sản khác theo giá trị thực tế."
              : "Hư hỏng, mất mát do lỗi của Bên B thì Bên B sửa chữa hoặc bồi thường theo giá trị thực tế.",
            "Hao mòn tự nhiên trong quá trình sử dụng bình thường không thuộc trách nhiệm bồi thường của Bên B.",
            "Khi trả phòng, hai bên lập biên bản đối chiếu tình trạng tài sản và chốt chỉ số điện nước.",
          ],
        },
      ],
    },
    {
      title: "Giá thuê và phương thức thanh toán",
      groups: [
        {
          items: [
            `Giá thuê: ${money(c.rentalPrice)}/tháng; tiền đặt cọc: ${money(c.depositAmount)}.`,
            "Tiền điện, nước tính theo chỉ số công tơ thực tế và đơn giá của cơ sở; phí dịch vụ theo bảng giá đã thỏa thuận.",
            `Hạn thanh toán: trong vòng ${dueDays} ngày kể từ ngày Bên A phát hành hóa đơn hàng tháng.`,
            "Hình thức: chuyển khoản qua mã VietQR trên hóa đơn (ghi đúng nội dung mã hóa đơn) hoặc tiền mặt có biên lai.",
            `Chậm thanh toán: Bên B chịu phạt ${penalty}%/ngày trên số tiền chậm trả theo thỏa thuận của hai bên.`,
          ],
        },
      ],
    },
    {
      title: "Tiền đặt cọc",
      groups: [
        {
          items: [
            "Tiền cọc dùng để bảo đảm việc thực hiện hợp đồng (Điều 328 Bộ luật Dân sự 2015).",
            "Khi thanh lý, tiền cọc được cấn trừ tiền thuê, điện nước còn nợ và chi phí bồi thường (nếu có); phần còn lại hoàn trả cho Bên B.",
            "Bên B tự ý chấm dứt hợp đồng trái thỏa thuận thì không được hoàn lại tiền cọc, trừ khi hai bên có thỏa thuận khác.",
          ],
        },
      ],
    },
    {
      title: "Chấm dứt hợp đồng",
      groups: [
        {
          heading: "Hợp đồng chấm dứt khi:",
          items: [
            "Hết thời hạn thuê mà hai bên không gia hạn.",
            "Hai bên thỏa thuận chấm dứt trước thời hạn.",
            "Phòng cho thuê không còn hoặc phải phá dỡ theo quyết định của cơ quan có thẩm quyền.",
          ],
        },
        {
          heading: "Đơn phương chấm dứt:",
          items: [
            `Bên muốn đơn phương chấm dứt phải báo trước cho bên kia ít nhất ${notice} ngày, trừ khi hai bên có thỏa thuận khác.`,
            "Bên A được đơn phương chấm dứt khi Bên B không trả tiền thuê từ 03 tháng trở lên, sử dụng phòng sai mục đích, tự ý cải tạo hoặc cho thuê lại, hoặc vi phạm nghiêm trọng nội quy.",
            "Bên B được đơn phương chấm dứt khi Bên A không sửa chữa hư hỏng nghiêm trọng, tăng giá thuê trái thỏa thuận, hoặc quyền sử dụng phòng bị hạn chế do lợi ích của bên thứ ba.",
            "Bên vi phạm nghĩa vụ báo trước mà gây thiệt hại thì phải bồi thường cho bên kia.",
          ],
        },
        {
          heading: "Thanh lý:",
          items: [
            "Hai bên chốt chỉ số điện nước cuối kỳ, quyết toán công nợ, cấn trừ cọc và lập biên bản bàn giao phòng.",
          ],
        },
      ],
    },
    {
      title: "Giải quyết tranh chấp",
      groups: [
        {
          items: [
            "Tranh chấp phát sinh được ưu tiên giải quyết bằng thương lượng, hòa giải trên tinh thần thiện chí.",
            "Hai bên có thể đề nghị hòa giải tại cơ sở (tổ hòa giải, UBND cấp xã nơi có nhà cho thuê).",
            `Nếu không thống nhất, một trong hai bên có quyền khởi kiện tại Tòa án nhân dân có thẩm quyền nơi có nhà cho thuê (${address}) theo pháp luật Việt Nam.`,
          ],
        },
      ],
    },
    {
      title: "Điều khoản chung",
      groups: [
        {
          items: [
            "Hai bên cam kết thực hiện đúng các điều khoản; mọi sửa đổi, bổ sung phải lập thành văn bản hoặc phụ lục có xác nhận của hai bên.",
            `Hợp đồng được lập và xác nhận điện tử tại: ${c.contractSigningLocation || "Cổng cư dân điện tử"}; có hiệu lực khi cả hai bên đã xác nhận.`,
            "Những vấn đề chưa quy định trong hợp đồng thực hiện theo Bộ luật Dân sự 2015 và Luật Nhà ở 2023.",
          ],
        },
      ],
    },
  ];
}

export default function ContractDetail({ id, onClose, onSaved }) {
  const resource = useResource(() => contractApi.get(id), [id]);
  useLiveRefresh(["contracts","invoices","payments"], resource.refresh);
  const [settling, setSettling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [receivingDeposit, setReceivingDeposit] = useState(false);
  const [depositConfirmationOpen, setDepositConfirmationOpen] = useState(false);
  const [depositMethod, setDepositMethod] = useState("CASH");
  const [simulatingDeposit, setSimulatingDeposit] = useState(false);
  const { user } = useAuth();
  const toast = useToast();
  const c = resource.data;
  const isLandlord = user?.role === "LANDLORD";
  const isTenant = user?.role === "TENANT";

  const [cancellingDraft, setCancellingDraft] = useState(false);
  async function handleCancelDraft() {
    const reason = window.prompt(
      "Hủy hợp đồng nháp này? Phòng sẽ trở về trống" +
        (c?.depositStatus === "PAID" ? " và tiền cọc được ghi là đã hoàn trả" : "") +
        ".\nLý do (không bắt buộc):",
    );
    if (reason === null) return;
    setCancellingDraft(true);
    try {
      await contractApi.cancelDraft(id, reason.trim() ? { reason: reason.trim() } : {});
      toast.success("Đã hủy hợp đồng nháp");
      resource.reload();
      onSaved?.();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setCancellingDraft(false);
    }
  }

  async function handleConfirmContract() {
    setConfirming(true);
    try {
      let updated;
      if (isLandlord) {
        updated = await contractApi.confirmByLandlord(id);
        toast.success("Đã xác nhận hợp đồng bằng tư cách Chủ trọ");
      } else if (isTenant) {
        updated = await contractApi.confirmByTenant(id);
        toast.success("Đã xác nhận hợp đồng bằng tư cách Khách thuê");
      }
      if (c?.status === "DRAFT" && updated?.status && updated.status !== "DRAFT")
        toast.success("Cả hai bên đã ký: hợp đồng có hiệu lực và có thể lập hóa đơn.");
      resource.reload();
      onSaved?.();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setConfirming(false);
    }
  }

  async function handleDepositReceived() {
    setDepositConfirmationOpen(false);
    setReceivingDeposit(true);
    try {
      await contractApi.markDepositReceived(id, { paymentMethod: depositMethod });
      toast.success("Đã ghi nhận tiền cọc và lưu biên nhận vào Lịch sử thanh toán › Tiền cọc");
      resource.reload();
      onSaved?.();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setReceivingDeposit(false);
    }
  }

  // Deposit booked by Bank Hub: useLiveRefresh above reloads; the activity toast announces it.

  async function handleSimulateDeposit() {
    if (simulatingDeposit) return; // one simulated transfer at a time
    setSimulatingDeposit(true);
    try {
      const res = await contractApi.simulateDeposit(id);
      if (res?.received)
        toast.success("Giả lập thành công: tiền cọc đã được ghi nhận tự động");
      else if (res?.duplicate)
        toast.info("Giao dịch cọc giả lập này đã được ghi nhận trước đó.");
      else
        toast.error(res?.reason || "Giao dịch giả lập chưa khớp với hợp đồng");
      resource.reload();
      onSaved?.();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSimulatingDeposit(false);
    }
  }

  function handleCopyCode() {
    if (!c?.contractCode) return;
    navigator.clipboard.writeText(c.contractCode);
    setCopied(true);
    toast.success("Đã sao chép mã hợp đồng");
    setTimeout(() => setCopied(false), 2000);
  }

  const durationMonths = (() => {
    if (!c?.startDate || !c?.endDate) return "";
    const d1 = new Date(c.startDate);
    const d2 = new Date(c.endDate);
    const m =
      (d2.getFullYear() - d1.getFullYear()) * 12 +
      (d2.getMonth() - d1.getMonth());
    return m > 0 ? `${m} tháng` : "";
  })();

  const daysRemaining = (() => {
    if (!c?.endDate) return null;
    const now = new Date();
    const d2 = new Date(c.endDate);
    return Math.ceil((d2.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  })();

  const isDepositPaid =
    c?.depositStatus === "PAID" || c?.depositStatus === "RECEIVED";

  const modalFooter =
    !settling && c ? (
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
        }}
      >
        <Button variant="secondary" onClick={() => window.print()}>
          <Printer size={15} />
          <span>In bản Hợp đồng (PDF)</span>
        </Button>

        <div style={{ display: "flex", gap: 10 }}>
          {isLandlord &&
            ["ACTIVE", "EXPIRING_SOON", "EXPIRED"].includes(c.status) &&
            c.settlement?.state !== "PREPARED" && (
              <Button onClick={() => setRenewing(true)}>
                <RefreshCw size={15} />
                <span>Gia hạn hợp đồng</span>
              </Button>
            )}
          {isLandlord &&
            ["ACTIVE", "EXPIRING_SOON", "EXPIRED"].includes(c.status) && (
              <Button variant="danger" onClick={() => setSettling(true)}>
                <span>Quyết toán & Thanh lý</span>
              </Button>
            )}
          <Button variant="secondary" onClick={onClose}>
            Đóng
          </Button>
        </div>
      </div>
    ) : null;

  return (
    <>
      <Modal
        title={
          settling
            ? "Quyết toán & Thanh lý hợp đồng thuê phòng"
            : "Hồ sơ Hợp đồng Thuê phòng"
        }
        subtitle={
          c
            ? `${c.contractCode} · Phòng ${c.roomId?.roomNumber || ""} (${c.branchId?.name || ""})`
            : "Chi tiết hợp đồng"
        }
        onClose={onClose}
        busy={saving}
        maxWidth="880px"
        footer={modalFooter}
      >
        {resource.loading ? (
          <LoadingState message="Đang tải dữ liệu hồ sơ hợp đồng..." />
        ) : resource.error ? (
          <ErrorState message={resource.error} retry={resource.reload} />
        ) : settling ? (
          <SettlementWorkflow
            contract={c}
            onCancel={() => setSettling(false)}
            onSaved={onSaved}
            onBusyChange={setSaving}
          />
        ) : (
          <div className="contract-detail-container">
            {/* 1. Header Hero Banner */}
            <div className="contract-hero-banner">
              <div className="contract-hero-left">
                <div className="contract-hero-icon">
                  <FileCheck2 size={24} strokeWidth={2.2} />
                </div>
                <div>
                  <span className="contract-hero-badge">
                    Hợp đồng thuê phòng điện tử
                  </span>
                  <h2 className="contract-hero-title">
                    Phòng {c.roomId?.roomNumber || "—"} ·{" "}
                    {c.branchId?.name || "—"}
                  </h2>
                  <div className="contract-hero-meta">
                    <span>Mã HĐ:</span>
                    <div className="contract-code-badge">
                      <span>{c.contractCode}</span>
                      <button
                        type="button"
                        className="contract-copy-btn"
                        onClick={handleCopyCode}
                        title="Sao chép mã hợp đồng"
                      >
                        {copied ? (
                          <Check size={12} color="#16a34a" />
                        ) : (
                          <Copy size={12} />
                        )}
                      </button>
                    </div>
                    <span>·</span>
                    <span>
                      {c.displayStatus === "DRAFT" ? "Lập ngày" : "Ký ngày"}:{" "}
                      <strong>{date(c.activatedAt || c.createdAt || c.startDate)}</strong>
                    </span>
                  </div>
                </div>
              </div>

              <div>
                {c.displayStatus === "ACTIVE" ? (
                  <span className="status-pill-dual active">
                    <span className="dot" /> Hiệu lực
                  </span>
                ) : c.displayStatus === "EXPIRING_SOON" ? (
                  <span className="status-pill-dual expiring">
                    <span className="dot" /> Sắp hết hạn ({daysRemaining || 30}{" "}
                    ngày)
                  </span>
                ) : c.displayStatus === "EXPIRED" ? (
                  <span className="status-pill-dual expired">
                    <span className="dot" /> Quá hạn chưa tái ký
                  </span>
                ) : c.displayStatus === "DRAFT" ? (
                  <span className="status-pill-dual expiring">
                    <span className="dot" /> Nháp · chờ 2 bên ký
                  </span>
                ) : c.cancelledAt ? (
                  <span className="status-pill-dual terminated">
                    <span className="dot" /> Đã hủy (nháp)
                  </span>
                ) : (
                  <span className="status-pill-dual terminated">
                    <span className="dot" /> Đã thanh lý
                  </span>
                )}
              </div>
            </div>

            {c.displayStatus === "DRAFT" && (
              <div className="contract-draft-note">
                <AlertCircle size={16} />
                <div>
                  <strong>Hợp đồng nháp — chưa có hiệu lực.</strong> Hợp đồng chỉ được duyệt (có hiệu lực)
                  khi cả chủ trọ và khách thuê ký xác nhận bên dưới. Trước đó phòng được giữ chỗ, có thể
                  nhận cọc nhưng <strong>chưa thể chốt điện nước hay tạo hóa đơn</strong>.
                </div>
                {isLandlord && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancelDraft}
                    disabled={cancellingDraft}
                  >
                    {cancellingDraft ? "Đang hủy..." : "Hủy hợp đồng nháp"}
                  </Button>
                )}
              </div>
            )}

            {/* 2. Electronic Signing Banner (Xác nhận 2 chiều) */}
            <div
              className={`contract-signing-card ${c.confirmedByBothParties ? "verified" : "pending"}`}
            >
              <div className="contract-signing-header">
                <div className="contract-signing-title">
                  {c.confirmedByBothParties ? (
                    <>
                      <ShieldCheck size={17} color="#166534" />
                      <span>Xác nhận Hợp đồng Điện tử (2 chiều)</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={17} color="#b45309" />
                      <span>Hợp đồng đang chờ xác nhận 2 chiều</span>
                    </>
                  )}
                </div>
                <span
                  className={`contract-sign-status-pill ${c.confirmedByBothParties ? "verified" : "pending"}`}
                >
                  {c.confirmedByBothParties
                    ? "✓ Đã ký kết hợp lệ bởi 2 bên"
                    : "Chờ xác nhận"}
                </span>
              </div>

              <div className="contract-signing-grid">
                {/* Chủ trọ xác nhận */}
                <div
                  className={`contract-sign-party-box ${c.landlordConfirmedAt ? "signed" : "waiting"}`}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    {c.landlordConfirmedAt ? (
                      <CheckCircle2 size={18} color="#16a34a" />
                    ) : (
                      <AlertCircle size={18} color="#f59e0b" />
                    )}
                    <div>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 13,
                          color: c.landlordConfirmedAt ? "#166534" : "#92400e",
                        }}
                      >
                        {c.landlordConfirmedAt
                          ? "Chủ trọ đã xác nhận"
                          : "Chủ trọ chưa xác nhận"}
                      </div>
                      <div
                        style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}
                      >
                        {c.landlordConfirmedAt
                          ? date(c.landlordConfirmedAt)
                          : "Yêu cầu chữ ký điện tử"}
                      </div>
                    </div>
                  </div>

                  {/* Unsigned contracts are DRAFT; the server only refuses TERMINATED ones. */}
                  {isLandlord &&
                    !c.landlordConfirmedAt &&
                    c.status !== "TERMINATED" && (
                      <button
                        type="button"
                        className="contract-sign-action-btn"
                        onClick={handleConfirmContract}
                        disabled={confirming}
                      >
                        <ShieldCheck size={14} />
                        <span>
                          {confirming ? "Đang xử lý..." : "Ký xác nhận ngay"}
                        </span>
                      </button>
                    )}
                </div>

                {/* Khách thuê xác nhận */}
                <div
                  className={`contract-sign-party-box ${c.tenantConfirmedAt ? "signed" : "waiting"}`}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    {c.tenantConfirmedAt ? (
                      <CheckCircle2 size={18} color="#16a34a" />
                    ) : (
                      <AlertCircle size={18} color="#f59e0b" />
                    )}
                    <div>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 13,
                          color: c.tenantConfirmedAt ? "#166534" : "#92400e",
                        }}
                      >
                        {c.tenantConfirmedAt
                          ? "Khách thuê đã xác nhận"
                          : "Khách thuê chưa xác nhận"}
                      </div>
                      <div
                        style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}
                      >
                        {c.tenantConfirmedAt
                          ? date(c.tenantConfirmedAt)
                          : "Xác nhận qua Cổng cư dân"}
                      </div>
                    </div>
                  </div>

                  {isTenant &&
                    !c.tenantConfirmedAt &&
                    c.status !== "TERMINATED" && (
                      <button
                        type="button"
                        className="contract-sign-action-btn"
                        onClick={handleConfirmContract}
                        disabled={confirming}
                      >
                        <ShieldCheck size={14} />
                        <span>
                          {confirming ? "Đang xử lý..." : "Đồng ý ký hợp đồng"}
                        </span>
                      </button>
                    )}
                </div>
              </div>

              <div className="contract-signing-footer">
                <FileText size={13} color="#64748b" />
                <span>
                  Địa điểm ký:{" "}
                  <strong>
                    {c.contractSigningLocation || "Online qua Cổng cư dân"}
                  </strong>{" "}
                  · 01 bản điện tử có hiệu lực pháp lý tương đương bản giấy
                </span>
              </div>
            </div>

            {/* 3. Bento 3-Column: Chủ trọ - Khách thuê - Thời hạn */}
            <div className="contract-bento-grid">
              {/* Card 1: Bên cho thuê (Chủ trọ) */}
              <div className="contract-bento-card">
                <div>
                  <span className="contract-card-tag landlord">
                    Bên cho thuê (Bên A)
                  </span>
                  <div className="contract-party-header">
                    <div
                      className="contract-party-avatar"
                      style={{ background: "#0f766e" }}
                    >
                      {c.landlordId?.name
                        ? c.landlordId.name.slice(0, 2).toUpperCase()
                        : "CT"}
                    </div>
                    <div>
                      <div
                        className="contract-party-name"
                        title={c.landlordId?.name || c.landlordId?.email}
                      >
                        {c.landlordId?.name || "Chủ cơ sở"}
                      </div>
                      {c.landlordId?.email &&
                        c.landlordId?.name !== c.landlordId?.email && (
                          <div style={{ fontSize: 11.5, color: "#64748b" }}>
                            {c.landlordId.email}
                          </div>
                        )}
                    </div>
                  </div>

                  <div className="contract-party-meta">
                    <div className="contract-party-meta-row">
                      <CreditCard size={13} color="#64748b" />
                      <span>
                        CCCD:{" "}
                        <strong style={{ fontFamily: "monospace" }}>
                          {c.landlordId?.citizenId || "—"}
                        </strong>
                      </span>
                    </div>
                    <div className="contract-party-meta-row">
                      <Phone size={13} color="#64748b" />
                      <span>
                        SĐT:{" "}
                        {c.landlordId?.phoneNumber ? (
                          <a
                            href={`tel:${c.landlordId.phoneNumber}`}
                            style={{
                              color: "#0f766e",
                              fontWeight: 600,
                              textDecoration: "none",
                            }}
                          >
                            {c.landlordId.phoneNumber}
                          </a>
                        ) : (
                          "Chưa có SĐT"
                        )}
                      </span>
                    </div>
                    <div
                      className="contract-party-meta-row"
                      style={{ marginTop: 2, alignItems: "flex-start" }}
                    >
                      <MapPin
                        size={13}
                        color="#64748b"
                        style={{ flexShrink: 0, marginTop: 2 }}
                      />
                      <span style={{ fontSize: 11.5, color: "#475569" }}>
                        Địa chỉ:{" "}
                        <strong>
                          {c.landlordId?.hometown ||
                            "Chưa cập nhật (Hồ sơ cá nhân)"}
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Bên thuê (Khách đại diện) */}
              <div className="contract-bento-card">
                <div>
                  <span className="contract-card-tag tenant">
                    Khách thuê đại diện (Bên B)
                  </span>
                  <div className="contract-party-header">
                    <div
                      className="contract-party-avatar"
                      style={{ background: "#0284c7" }}
                    >
                      {c.tenantId?.name
                        ? c.tenantId.name.slice(0, 2).toUpperCase()
                        : "KT"}
                    </div>
                    <div>
                      <div className="contract-party-name">
                        {c.tenantId?.name || "Khách thuê"}
                      </div>
                      {c.tenantId?.email && (
                        <div style={{ fontSize: 11.5, color: "#64748b" }}>
                          {c.tenantId.email}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="contract-party-meta">
                    <div className="contract-party-meta-row">
                      <CreditCard size={13} color="#64748b" />
                      <span>
                        CCCD:{" "}
                        <strong style={{ fontFamily: "monospace" }}>
                          {c.tenantId?.citizenId || "—"}
                        </strong>
                      </span>
                    </div>
                    <div className="contract-party-meta-row">
                      <Phone size={13} color="#64748b" />
                      <span>
                        SĐT:{" "}
                        {c.tenantId?.phoneNumber ? (
                          <a
                            href={`tel:${c.tenantId.phoneNumber}`}
                            style={{
                              color: "#0284c7",
                              fontWeight: 600,
                              textDecoration: "none",
                            }}
                          >
                            {c.tenantId.phoneNumber}
                          </a>
                        ) : (
                          "Chưa có SĐT"
                        )}
                      </span>
                    </div>
                    {c.tenantId?.hometown && (
                      <div
                        className="contract-party-meta-row"
                        style={{ marginTop: 2, alignItems: "flex-start" }}
                      >
                        <MapPin
                          size={13}
                          color="#64748b"
                          style={{ flexShrink: 0, marginTop: 2 }}
                        />
                        <span style={{ fontSize: 11.5, color: "#475569" }}>
                          HK: <strong>{c.tenantId.hometown}</strong>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Card 3: Thời hạn hợp đồng */}
              <div className="contract-bento-card">
                <div>
                  <span className="contract-card-tag duration">
                    Thời hạn hợp đồng
                  </span>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 10,
                    }}
                  >
                    <Calendar size={18} color="#6d28d9" />
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#1e1b4b",
                      }}
                    >
                      {durationMonths
                        ? `Thời hạn: ${durationMonths}`
                        : "Thời hạn hợp đồng"}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 5,
                      fontSize: 12.5,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ color: "#64748b" }}>Bắt đầu:</span>
                      <strong>{date(c.startDate)}</strong>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ color: "#64748b" }}>Kết thúc:</span>
                      <strong>{date(c.endDate)}</strong>
                    </div>
                    {c.actualEndDate && (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          color: "#b45309",
                          marginTop: 4,
                        }}
                      >
                        <span>Trả phòng thực tế:</span>
                        <strong>{date(c.actualEndDate)}</strong>
                      </div>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 12,
                    paddingTop: 8,
                    borderTop: "1px dashed #e2e8f0",
                  }}
                >
                  {daysRemaining !== null && daysRemaining > 0 ? (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 12,
                        color: "#059669",
                        fontWeight: 600,
                      }}
                    >
                      <Clock size={13} />
                      <span>Còn {daysRemaining} ngày hiệu lực</span>
                    </div>
                  ) : daysRemaining !== null ? (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 12,
                        color: "#dc2626",
                        fontWeight: 600,
                      }}
                    >
                      <AlertTriangle size={13} />
                      <span>Hợp đồng đã hết hạn</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* 4. Financial Summary Cards (3-Column) */}
            <div className="contract-finance-grid">
              {/* Giá thuê */}
              <div className="contract-finance-card rent">
                <div className="contract-finance-label">
                  <span>Giá thuê thỏa thuận:</span>
                  <Home size={16} color="#0f766e" />
                </div>
                <div
                  className="contract-finance-val"
                  style={{ color: "#0f172a" }}
                >
                  {money(c.rentalPrice)}
                </div>
                <div className="contract-finance-sub">
                  Thu kỳ đầu tháng · Cố định
                </div>
              </div>

              {/* Tiền cọc */}
              <div
                className={`contract-finance-card ${isDepositPaid ? "deposit-paid" : "deposit-pending"}`}
              >
                <div className="contract-finance-label">
                  <span
                    style={{ color: isDepositPaid ? "#166534" : "#b45309" }}
                  >
                    Tiền cọc đảm bảo:
                  </span>
                  <ShieldCheck
                    size={16}
                    color={isDepositPaid ? "#16a34a" : "#f59e0b"}
                  />
                </div>
                <div
                  className="contract-finance-val"
                  style={{ color: isDepositPaid ? "#065f46" : "#92400e" }}
                >
                  {money(c.depositAmount)}
                </div>
                <div
                  className="contract-finance-sub"
                  style={{
                    color: isDepositPaid ? "#059669" : "#dc2626",
                    fontWeight: 600,
                  }}
                >
                  {isDepositPaid
                    ? `✓ Đã thu đủ cọc${c.depositReceivedAt ? ` · ${date(c.depositReceivedAt)}` : ""}`
                    : `⚠ ${labels[c.depositStatus] || "Chưa nhận cọc"}`}
                </div>
                {isDepositPaid && (
                  <Link
                    to="/payments?tab=deposits"
                    style={{ display: "inline-block", marginTop: 6, fontSize: "0.8rem", fontWeight: 600 }}
                  >
                    Xem biên nhận cọc →
                  </Link>
                )}
                {isLandlord && c.depositPayment && (
                  <Button
                    size="sm"
                    onClick={() => setDepositConfirmationOpen(true)}
                    disabled={receivingDeposit}
                    style={{ marginTop: 10 }}
                  >
                    <CheckCircle2 size={14} />
                    <span>
                      {receivingDeposit
                        ? "Đang ghi nhận..."
                        : "Xác nhận đã nhận cọc"}
                    </span>
                  </Button>
                )}
              </div>

              {/* Chỉ số bàn giao ban đầu */}
              <div className="contract-finance-card meters">
                <div className="contract-finance-label">
                  <span>Chỉ số bàn giao ban đầu:</span>
                  <div style={{ display: "flex", gap: 4 }}>
                    <Zap size={15} color="#eab308" />
                    <Droplets size={15} color="#0284c7" />
                  </div>
                </div>
                <div
                  className="contract-finance-val"
                  style={{ fontSize: 17, color: "#1e293b" }}
                >
                  ⚡ {c.initialElectricIndex ?? 0} kWh · 💧{" "}
                  {c.initialWaterIndex ?? 0} m³
                </div>
                <div className="contract-finance-sub">
                  Ghi nhận tại ngày bàn giao
                </div>
              </div>
            </div>

            {/* 4b. VietQR chuyển cọc (chỉ khi cọc chưa nhận) */}
            {c.depositPayment && (
              <div className="contract-deposit-qr">
                {c.depositPayment.bankConfigured ? (
                  <>
                    <img
                      src={c.depositPayment.vietQrUrl}
                      alt={`Mã VietQR chuyển cọc ${money(c.depositPayment.amount)}`}
                      width={168}
                      height={168}
                    />
                    <div className="contract-deposit-qr-info">
                      <h4>Quét mã VietQR để chuyển tiền cọc</h4>
                      <dl>
                        <dt>Số tiền</dt>
                        <dd>
                          <strong>{money(c.depositPayment.amount)}</strong>
                        </dd>
                        <dt>Ngân hàng</dt>
                        <dd>{c.depositPayment.bank.bankName}</dd>
                        <dt>Số tài khoản</dt>
                        <dd>
                          <strong>{c.depositPayment.bank.accountNumber}</strong>
                        </dd>
                        <dt>Chủ tài khoản</dt>
                        <dd>{c.depositPayment.bank.accountName}</dd>
                        <dt>Nội dung CK</dt>
                        <dd>
                          <strong>{c.depositPayment.paymentSyntax}</strong>
                        </dd>
                      </dl>
                      <p>
                        {c.depositPayment.autoConfirm
                          ? "Hệ thống tự ghi nhận cọc khi tiền về đúng số tiền và nội dung chuyển khoản."
                          : isLandlord
                            ? "Gói hiện tại chưa có đối soát tự động: khi tiền về tài khoản, bấm “Xác nhận đã nhận cọc”."
                            : "Vui lòng ghi đúng nội dung chuyển khoản. Chủ trọ sẽ xác nhận khi nhận được tiền."}
                      </p>
                      {c.depositPayment.simulator && (isLandlord || isTenant) && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={handleSimulateDeposit}
                          disabled={simulatingDeposit}
                          style={{ marginTop: 10 }}
                        >
                          {simulatingDeposit
                            ? "Đang giả lập..."
                            : "Giả lập chuyển cọc thành công (Sandbox)"}
                        </Button>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="contract-deposit-qr-missing">
                    {isLandlord
                      ? "Chưa thể tạo mã QR chuyển cọc: bạn chưa cấu hình tài khoản ngân hàng trong Hồ sơ cá nhân."
                      : "Chủ trọ chưa cấu hình tài khoản ngân hàng nhận cọc. Vui lòng liên hệ chủ trọ."}
                  </p>
                )}
              </div>
            )}

            {/* 5. Additional Services (Nếu có) */}
            {c.serviceQuantities &&
              Object.keys(c.serviceQuantities).length > 0 && (
                <div
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 12,
                    padding: "12px 16px",
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      color: "#475569",
                      display: "block",
                      marginBottom: 8,
                    }}
                  >
                    Dịch vụ theo số lượng đăng ký
                  </span>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {Object.entries(c.serviceQuantities).map(([k, v]) => (
                      <span
                        key={k}
                        style={{
                          background: "#f1f5f9",
                          padding: "5px 12px",
                          borderRadius: 8,
                          fontSize: 12.5,
                          border: "1px solid #e2e8f0",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span>{k}:</span>
                        <strong style={{ color: "#0f766e" }}>{v}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}

            {/* Tài sản & vật dụng bàn giao kèm phòng, đơn giá đền bù */}
            <ContractFurnishings contract={c} />

            {/* 6. Thành viên ở cùng (Nếu có) */}
            {c.roommates && c.roommates.length > 0 && (
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: "14px 16px",
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    color: "#475569",
                    display: "block",
                    marginBottom: 10,
                  }}
                >
                  Thành viên ở cùng ({c.roommates.length} người)
                </span>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                    gap: 10,
                  }}
                >
                  {c.roommates.map((r, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "8px 12px",
                        background: "#f8fafc",
                        borderRadius: 8,
                        fontSize: 12.5,
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      <div style={{ fontWeight: 700, color: "#1e293b" }}>
                        {r.fullName}
                      </div>
                      <div
                        style={{
                          fontSize: 11.5,
                          color: "#64748b",
                          marginTop: 2,
                        }}
                      >
                        CCCD: {r.citizenId || "—"} · SĐT: {r.phoneNumber || "—"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ghi chú */}
            {c.notes && (
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  padding: "10px 14px",
                  fontSize: 12.5,
                  color: "#475569",
                }}
              >
                <strong>Ghi chú:</strong> {c.notes}
              </div>
            )}

            {/* 6b. Renewal history (phụ lục gia hạn) */}
            {c.renewals?.length > 0 && (
              <div className="contract-renewals">
                <h4>Lịch sử gia hạn ({c.renewals.length} lần)</h4>
                <ol>
                  {c.renewals.map((r, index) => (
                    <li key={`${r.renewedAt}-${index}`}>
                      <strong>Phụ lục {index + 1}</strong> · ngày {date(r.renewedAt)}: gia hạn từ{" "}
                      {date(r.previousEndDate)} đến <strong>{date(r.endDate)}</strong>
                      {r.rentalPrice !== r.previousRentalPrice && (
                        <>
                          {" "}· giá thuê {money(r.previousRentalPrice)} → <strong>{money(r.rentalPrice)}</strong>
                        </>
                      )}
                      {r.notes && <span className="contract-renewal-note"> · {r.notes}</span>}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* 7. Legal terms: always shown (and printed) as part of the contract */}
            <div className="contract-terms-box">
              <div className="contract-terms-header">
                <FileText size={17} color="#0f766e" />
                <div>
                  <div
                    style={{ fontWeight: 700, fontSize: 13, color: "#1e293b" }}
                  >
                    Điều khoản Hợp đồng
                  </div>
                  <div style={{ fontSize: 11.5, color: "#64748b" }}>
                    Căn cứ Bộ luật Dân sự 2015 và Luật Nhà ở 2023
                  </div>
                </div>
              </div>
              <div className="contract-terms-content">
                {contractArticles(c).map((article, index) => (
                  <section key={article.title} className="contract-article">
                    <h4>
                      Điều {index + 1}. {article.title}
                    </h4>
                    {article.groups.map((group) => (
                      <div key={group.heading || article.title}>
                        {group.heading && <strong>{group.heading}</strong>}
                        <ul>
                          {group.items.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </section>
                ))}
              </div>
            </div>

            {/* Biên bản quyết toán nếu đã PREPARED hoặc TERMINATED */}
            {c.settlement?.state === "PREPARED" &&
              c.status !== "TERMINATED" && (
                <div
                  style={{
                    background: "#fffbeb",
                    border: "1px solid #fde68a",
                    borderRadius: 12,
                    padding: 14,
                  }}
                >
                  <h4 style={{ color: "#b45309", margin: "0 0 4px" }}>
                    Biên bản quyết toán đang được lập (Chưa hoàn tất thanh lý)
                  </h4>
                  <p
                    style={{
                      fontSize: 12.5,
                      color: "#92400e",
                      margin: "0 0 10px",
                    }}
                  >
                    Hợp đồng đã lập phiếu quyết toán và cấn trừ tiền cọc. Vui
                    lòng hoàn tất thu nợ hoặc hoàn tiền cọc để thanh lý phòng.
                  </p>
                  {isLandlord && (
                    <Button onClick={() => setSettling(true)}>
                      Tiếp tục Quyết toán & Thanh lý phòng
                    </Button>
                  )}
                </div>
              )}

            {/* Biên bản thanh lý (chỉ hợp đồng đã quyết toán; nháp bị hủy không có) */}
            {c.status === "TERMINATED" && c.settlement?.state === "COMPLETED" && (
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: 14,
                }}
              >
                <h4 style={{ color: "#334155", margin: "0 0 8px" }}>
                  Biên bản thanh lý · Trả phòng ngày {date(c.actualEndDate)}
                  {c.terminationReason && ` · ${TERMINATION_REASONS[c.terminationReason]?.label}`}
                </h4>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 8,
                    fontSize: 12.5,
                  }}
                >
                  <div>
                    Tiền cọc đã giữ: <strong>{money(c.settlement?.heldDeposit)}</strong>
                  </div>
                  <div>
                    Nợ hóa đơn cũ: <strong>{money(c.settlement?.outstandingDebt)}</strong>
                  </div>
                  <div>
                    Tiền phòng & dịch vụ ngày lẻ:{" "}
                    <strong>
                      {money((c.settlement?.roomAmount || 0) + (c.settlement?.serviceAmount || 0))}
                    </strong>
                  </div>
                  <div>
                    Điện / nước cuối kỳ:{" "}
                    <strong>
                      {money(c.settlement?.electricAmount)} / {money(c.settlement?.waterAmount)}
                    </strong>
                  </div>
                  <div>
                    Đền bù hư hỏng: <strong>{money(c.settlement?.deductionAmount)}</strong>
                  </div>
                  {c.settlement?.forfeitedDeposit > 0 && (
                    <div style={{ color: "#b91c1c" }}>
                      Cọc giữ lại do vi phạm: <strong>{money(c.settlement.forfeitedDeposit)}</strong>
                    </div>
                  )}
                  <div style={{ color: "#059669" }}>
                    Tiền cọc hoàn trả:{" "}
                    <strong>
                      {money(c.refundedDepositAmount || c.settlement?.refundedDepositAmount)}
                    </strong>
                    {c.settlement?.refundMethod &&
                      ` (${c.settlement.refundMethod === "CASH" ? "tiền mặt" : "chuyển khoản"}, ${date(c.settlement.refundedAt)})`}
                  </div>
                </div>
                {(c.deductions || []).length > 0 && (
                  <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 12.5, color: "#475569" }}>
                    {c.deductions.map((d, i) => (
                      <li key={i}>
                        {d.reason}
                        {d.quantity ? ` (x${d.quantity})` : ""}: <strong>{money(d.amount)}</strong>
                      </li>
                    ))}
                  </ul>
                )}
                {c.settlementNotes && (
                  <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "#64748b" }}>Ghi chú: {c.settlementNotes}</p>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
      {depositConfirmationOpen && (
        <Modal
          onClose={() => setDepositConfirmationOpen(false)}
          title="Xác nhận đã nhận tiền cọc"
          subtitle={`Hợp đồng ${c.contractCode}`}
          maxWidth="480px"
          closeOnBackdropClick={!receivingDeposit}
          footer={
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDepositConfirmationOpen(false)}
                disabled={receivingDeposit}
              >
                Hủy
              </Button>
              <Button
                type="button"
                onClick={handleDepositReceived}
                disabled={receivingDeposit}
              >
                <CheckCircle2 size={15} />
                {receivingDeposit ? "Đang ghi nhận..." : "Xác nhận đã nhận cọc"}
              </Button>
            </>
          }
        >
          <div className="modal-copy">
            <p style={{ margin: 0 }}>
              Bạn có chắc đã nhận đủ tiền cọc{" "}
              <strong>{money(c.depositAmount)}</strong> cho hợp đồng này không?
            </p>
            <label style={{ display: "block", marginTop: 14, fontSize: "0.85rem", fontWeight: 600 }}>
              Hình thức nhận cọc
              <select
                value={depositMethod}
                onChange={(e) => setDepositMethod(e.target.value)}
                disabled={receivingDeposit}
                style={{ display: "block", width: "100%", marginTop: 6 }}
              >
                <option value="CASH">Tiền mặt</option>
                <option value="BANK_TRANSFER">Chuyển khoản (đã thấy tiền vào tài khoản)</option>
              </select>
            </label>
            <p style={{ margin: "10px 0 0", fontSize: "0.8rem", color: "var(--neutral-500)" }}>
              Biên nhận cọc sẽ được lưu vào Lịch sử thanh toán › Tiền cọc và người thuê sẽ được thông báo.
            </p>
          </div>
        </Modal>
      )}

      {renewing && c && (
        <RenewContractModal
          contract={c}
          onClose={() => setRenewing(false)}
          onDone={() => {
            setRenewing(false);
            resource.reload();
            onSaved?.();
          }}
        />
      )}
    </>
  );
}

// Gia hạn: new end date (quick +6 / +12 months from the current end), optional new rent.
function RenewContractModal({ contract, onClose, onDone }) {
  const toast = useToast();
  const addMonths = (months) => {
    const d = new Date(contract.endDate);
    d.setMonth(d.getMonth() + months);
    return d.toISOString().slice(0, 10);
  };
  const [endDate, setEndDate] = useState(addMonths(6));
  const [rentalPrice, setRentalPrice] = useState(String(contract.rentalPrice ?? ""));
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e?.preventDefault();
    setError("");
    if (!endDate || new Date(endDate) <= new Date(contract.endDate))
      return setError("Ngày kết thúc mới phải sau ngày kết thúc hiện tại.");
    const price = Number(rentalPrice);
    if (!Number.isSafeInteger(price) || price < 0) return setError("Giá thuê không hợp lệ.");
    setBusy(true);
    try {
      await contractApi.renew(contract._id, {
        endDate,
        ...(price !== contract.rentalPrice && { rentalPrice: price }),
        ...(notes.trim() && { notes: notes.trim() }),
      });
      toast.success(`Đã gia hạn hợp đồng đến ${date(endDate)}`);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Gia hạn hợp đồng"
      subtitle={`${contract.contractCode} · Phòng ${contract.roomId?.roomNumber || ""} · đang hết hạn ${date(contract.endDate)}`}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Hủy
          </Button>
          <Button onClick={submit} busy={busy}>
            Xác nhận gia hạn
          </Button>
        </>
      }
    >
      <form className="contract-renew-form" onSubmit={submit}>
        <div className="contract-renew-presets" role="group" aria-label="Chọn nhanh thời hạn">
          {[3, 6, 12].map((m) => (
            <button
              key={m}
              type="button"
              className={endDate === addMonths(m) ? "is-active" : ""}
              onClick={() => setEndDate(addMonths(m))}
            >
              +{m} tháng
            </button>
          ))}
        </div>
        <Field
          label="Ngày kết thúc mới"
          type="date"
          required
          min={addMonths(0)}
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
        <Field
          label="Giá thuê từ kỳ tới (VNĐ/tháng)"
          type="number"
          min="0"
          step="1000"
          value={rentalPrice}
          onChange={(e) => setRentalPrice(e.target.value)}
          hint={`Hiện tại ${money(contract.rentalPrice)}. Giá mới áp dụng cho các hóa đơn tạo sau khi gia hạn.`}
        />
        <Field label="Ghi chú phụ lục (không bắt buộc)">
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="VD: Giữ nguyên các điều khoản khác" />
        </Field>
        <p className="contract-renew-note">
          Mã hợp đồng, tiền cọc và các điều khoản khác giữ nguyên. Nếu tài khoản khách đã bị tạm khóa do hết hạn, tài khoản sẽ
          được mở lại với mật khẩu cũ.
        </p>
        <FormError message={error} />
      </form>
    </Modal>
  );
}
