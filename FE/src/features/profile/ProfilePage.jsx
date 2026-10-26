import { useState, useMemo, useEffect } from "react";
import {
  User,
  CreditCard,
  Lock,
  Building,
  Phone,
  Mail,
  Home,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  RefreshCw,
  ExternalLink,
  Zap,
  Unlink,
} from "lucide-react";
import { profileApi, errorMessage } from "../../services/api";
import { useResource } from "../../hooks/useResource";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import BankHubModal from "./BankHubModal";
import {
  Badge,
  Button,
  PageHeader,
  LoadingState,
  ErrorState,
  Field,
  SelectField,
} from "../../components/ui";
import "./Profile.css";

const ROLE_NAMES = {
  LANDLORD: "Chủ chuỗi cơ sở (Landlord)",
  PROPERTY_MANAGER: "Quản lý cơ sở (Property Manager)",
  TENANT: "Cư dân / Khách thuê (Tenant)",
  SUPER_ADMIN: "Quản trị nền tảng (Platform Root)",
};

const VIETQR_BANKS = [
  { code: "MB", name: "MBBank (Ngân hàng Quân Đội)" },
  { code: "VCB", name: "Vietcombank (Ngoại thương Việt Nam)" },
  { code: "ICB", name: "VietinBank (Công thương Việt Nam)" },
  { code: "BIDV", name: "BIDV (Đầu tư và Phát triển)" },
  { code: "TCB", name: "Techcombank (Kỹ thương)" },
  { code: "ACB", name: "ACB (Á Châu)" },
  { code: "VPB", name: "VPBank (Việt Nam Thịnh Vượng)" },
  { code: "TPB", name: "TPBank (Tiên Phong)" },
  { code: "STB", name: "Sacombank (Sài Gòn Thương Tín)" },
  { code: "HDB", name: "HDBank (Phát triển TP.HCM)" },
  { code: "VIB", name: "VIB (Quốc Tế)" },
  { code: "SHB", name: "SHB (Sài Gòn - Hà Nội)" },
  { code: "MSB", name: "MSB (Hàng Hải)" },
  { code: "OCB", name: "OCB (Phương Đông)" },
  { code: "LPB", name: "LPBank (Lộc Phát Việt Nam)" },
  { code: "SEAB", name: "SeABank (Đông Nam Á)" },
  { code: "VAB", name: "VietABank (Việt Á)" },
  { code: "ABB", name: "An Bình (ABBANK)" },
  { code: "BAB", name: "Bac A Bank (Bắc Á)" },
  { code: "NAB", name: "Nam A Bank (Nam Á)" },
];

// Helper to normalize accountName to uppercase unaccented
function removeVietnameseTones(str) {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toUpperCase();
}

export default function ProfilePage() {
  const { user, changePassword, refreshProfile } = useAuth();
  const toast = useToast();
  const profileResource = useResource(profileApi.get);

  const profile = profileResource.data || user || {};
  const isLandlord = profile.role === "LANDLORD";
  const isManager = profile.role === "PROPERTY_MANAGER";
  const isTenant = profile.role === "TENANT";
  const isSuperAdmin = profile.role === "SUPER_ADMIN";

  const [activeTab, setActiveTab] = useState("info"); // "info" | "bank" | "security"

  // Form states for profile update
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [hometown, setHometown] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Form states for bank account (Landlord)
  const [bankCode, setBankCode] = useState("MB");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [bankPassword, setBankPassword] = useState("");
  const [savingBank, setSavingBank] = useState(false);
  const [bankHubModal, setBankHubModal] = useState({ isOpen: false, purpose: "LINK" });

  // Form states for security / change password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // Populate local form states from fetched profile
  useEffect(() => {
    if (profileResource.data) {
      const p = profileResource.data;
      setName(p.name || "");
      setPhoneNumber(p.phoneNumber || "");
      setEmail(p.email || "");
      setHometown(p.hometown || "");

      if (p.bankAccount) {
        setBankCode(p.bankAccount.bankCode || "MB");
        setAccountNumber(p.bankAccount.accountNumber || "");
        setAccountName(p.bankAccount.accountName || "");
      } else if (p.name) {
        setAccountName(removeVietnameseTones(p.name));
      }
    }
  }, [profileResource.data]);

  // Handle Save Profile
  async function handleSaveProfile(e) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Họ và tên không được để trống.");
      return;
    }

    setSavingProfile(true);
    const body = {};

    if (isLandlord) {
      body.name = name.trim();
      body.phoneNumber = phoneNumber.trim();
    } else if (isManager) {
      body.name = name.trim();
      body.email = email.trim();
    } else if (isTenant) {
      body.name = name.trim();
      body.phoneNumber = phoneNumber.trim();
      body.email = email.trim();
      body.hometown = hometown.trim();
    } else if (isSuperAdmin) {
      body.name = name.trim();
    }

    try {
      const updated = await profileApi.update(body);
      toast.success("Cập nhật thông tin hồ sơ thành công!");
      // Update localStorage cached user name
      if (updated?.name) {
        const stored = localStorage.getItem("user");
        if (stored) {
          const parsed = JSON.parse(stored);
          localStorage.setItem("user", JSON.stringify({ ...parsed, ...updated }));
        }
      }
      if (refreshProfile) await refreshProfile();
      profileResource.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSavingProfile(false);
    }
  }

  // Handle Save Bank Account (Landlord only)
  async function handleSaveBank(e) {
    e.preventDefault();
    const cleanAccNum = accountNumber.replace(/[\s.-]/g, "");

    if (!cleanAccNum || cleanAccNum.length < 6 || cleanAccNum.length > 19) {
      toast.error("Số tài khoản phải gồm từ 6 đến 19 chữ số.");
      return;
    }

    if (!accountName.trim()) {
      toast.error("Vui lòng nhập tên chủ tài khoản.");
      return;
    }

    if (!bankPassword) {
      toast.error("Vui lòng nhập mật khẩu hiện tại để xác thực tài chính.");
      return;
    }

    const selectedBankObj = VIETQR_BANKS.find((b) => b.code === bankCode);
    const bankName = selectedBankObj ? selectedBankObj.name.split(" (")[0] : bankCode;

    setSavingBank(true);
    try {
      const res = await profileApi.updateBankAccount({
        bankCode: bankCode.toUpperCase(),
        bankName,
        accountNumber: cleanAccNum,
        accountName: removeVietnameseTones(accountName),
        currentPassword: bankPassword,
      });

      const refreshMsg = res.refreshedInvoices
        ? ` Đã cập nhật mã QR cho ${res.refreshedInvoices} hóa đơn chưa thanh toán.`
        : "";
      toast.success(`Cập nhật tài khoản nhận tiền thành công!${refreshMsg}`);
      setBankPassword("");
      if (refreshProfile) await refreshProfile();
      profileResource.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSavingBank(false);
    }
  }

  // Handle Change Password
  async function handleChangePassword(e) {
    e.preventDefault();
    if (!currentPassword) {
      toast.error("Vui lòng nhập mật khẩu hiện tại.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Mật khẩu mới phải có ít nhất 6 ký tự.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Mật khẩu xác nhận không khớp.");
      return;
    }

    setSavingPassword(true);
    try {
      await changePassword({ currentPassword, newPassword });
      toast.success("Đổi mật khẩu thành công! Vui lòng đăng nhập lại.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSavingPassword(false);
    }
  }

  const selectedBankDisplay = useMemo(() => {
    return VIETQR_BANKS.find((b) => b.code === bankCode)?.name || bankCode;
  }, [bankCode]);

  return (
    <div className="profile-container animate-fade-in">
      <PageHeader
        title="Hồ sơ cá nhân & Cài đặt"
        description="Quản lý thông tin định danh, tài khoản thụ hưởng thanh toán VietQR và bảo mật tài khoản."
      />

      {profileResource.loading ? (
        <LoadingState />
      ) : profileResource.error ? (
        <ErrorState
          message={profileResource.error}
          retry={profileResource.reload}
        />
      ) : (
        <>
          {/* 1. Header Overview Banner */}
          <div className="profile-overview-card">
            <div className="profile-user-left">
              <div className="profile-avatar-large">
                {(profile.name || "U").slice(0, 1).toUpperCase()}
              </div>
              <div className="profile-user-info">
                <h2>
                  {profile.name}
                  <span className="profile-role-badge">
                    {ROLE_NAMES[profile.role] || profile.role}
                  </span>
                </h2>
                <div className="profile-user-meta">
                  <span>
                    <strong>Tên đăng nhập:</strong> {profile.username || profile.email}
                  </span>
                  {profile.phoneNumber && (
                    <span>
                      <strong>SĐT:</strong> {profile.phoneNumber}
                    </span>
                  )}
                  {profile.email && (
                    <span>
                      <strong>Email:</strong> {profile.email}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Account Status / Has Bank Badge */}
            <div>
              {isLandlord && (
                profile.hasBankAccount ? (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "12px",
                      fontWeight: 700,
                      padding: "6px 12px",
                      borderRadius: "9999px",
                      background: "#ecfdf5",
                      color: "#047857",
                      border: "1px solid #a7f3d0",
                    }}
                  >
                    <CheckCircle2 size={15} /> Đã cấu hình VietQR
                  </span>
                ) : (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "12px",
                      fontWeight: 700,
                      padding: "6px 12px",
                      borderRadius: "9999px",
                      background: "#fffbeb",
                      color: "#b45309",
                      border: "1px solid #fde68a",
                    }}
                  >
                    <AlertTriangle size={15} /> Chưa cấu hình tài khoản nhận tiền
                  </span>
                )
              )}
            </div>
          </div>

          {/* 2. Nav Tabs */}
          <div className="profile-tabs-bar">
            <button
              type="button"
              className={`profile-tab-btn ${activeTab === "info" ? "is-active" : ""}`}
              onClick={() => setActiveTab("info")}
            >
              <User size={16} />
              Thông tin cá nhân
            </button>

            {isLandlord && (
              <button
                type="button"
                className={`profile-tab-btn ${activeTab === "bank" ? "is-active" : ""}`}
                onClick={() => setActiveTab("bank")}
              >
                <CreditCard size={16} />
                Tài khoản nhận tiền (VietQR)
                {!profile.hasBankAccount && (
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#f59e0b",
                    }}
                  />
                )}
              </button>
            )}

            <button
              type="button"
              className={`profile-tab-btn ${activeTab === "security" ? "is-active" : ""}`}
              onClick={() => setActiveTab("security")}
            >
              <KeyRound size={16} />
              Bảo mật & Mật khẩu
            </button>
          </div>

          {/* 3. Tab Contents */}

          {/* TAB 1: THÔNG TIN CÁ NHÂN */}
          {activeTab === "info" && (
            <div className="profile-card">
              <h3 className="profile-section-title">
                <User size={18} color="var(--prof-primary-container)" />
                Thông tin hồ sơ định danh
              </h3>
              <p className="profile-section-sub">
                Các thông tin dùng để hiển thị trên hợp đồng, hóa đơn và thông báo
                hệ thống.
              </p>

              <form onSubmit={handleSaveProfile}>
                <div className="form-section form-grid">
                  {/* Read-only Username Field */}
                  <div className="span-2">
                    <Field
                      label={`Tên đăng nhập (${
                        isLandlord
                          ? "Email"
                          : isManager
                          ? "Số điện thoại"
                          : isTenant
                          ? "Số CCCD định danh"
                          : "Tài khoản Root"
                      })`}
                      value={profile.username || profile.email || ""}
                      disabled
                      hint="Tên đăng nhập là trường cố định, không thể thay đổi tại đây."
                    />
                  </div>

                  {/* Full Name - All roles */}
                  <Field
                    label="Họ và tên *"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="VD: Nguyễn Văn Đức"
                  />

                  {/* Phone Number - Landlord & Tenant */}
                  {(isLandlord || isTenant) && (
                    <Field
                      label="Số điện thoại liên lạc"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="0901234567"
                      hint="Chuẩn hóa theo đầu số di động Việt Nam"
                    />
                  )}

                  {/* Email - Manager & Tenant */}
                  {(isManager || isTenant) && (
                    <Field
                      label="Địa chỉ Email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="user@example.com"
                    />
                  )}

                  {/* Hometown - Tenant */}
                  {isTenant && (
                    <div className="span-2">
                      <Field
                        label="Quê quán / Địa chỉ thường trú"
                        value={hometown}
                        onChange={(e) => setHometown(e.target.value)}
                        placeholder="VD: Xã Yên Hòa, Huyện Cẩm Xuyên, Tỉnh Hà Tĩnh"
                      />
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    marginTop: "24px",
                    paddingTop: "16px",
                    borderTop: "1px solid var(--prof-border)",
                  }}
                >
                  <Button busy={savingProfile}>
                    <CheckCircle2 size={16} /> Lưu thay đổi hồ sơ
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: TÀI KHOẢN NGÂN HÀNG VIETQR (LANDLORD ONLY) */}
          {activeTab === "bank" && isLandlord && (
            <div className="profile-card">
              <h3 className="profile-section-title">
                <CreditCard size={18} color="var(--prof-primary-container)" />
                Tài khoản nhận tiền thanh toán (SePay & VietQR)
              </h3>
              <p className="profile-section-sub">
                Tài khoản này được dùng để sinh mã VietQR tự động trên tất cả hóa
                đơn gửi cho khách thuê.
              </p>

              {/* Bank Hub Integration Status Banner */}
              {profile.bankHubLinked ? (
                <div
                  style={{
                    padding: "16px 20px",
                    borderRadius: "12px",
                    backgroundColor: "#f0fdf4",
                    border: "1.5px solid #86efac",
                    marginBottom: "20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "16px",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div
                      style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "10px",
                        backgroundColor: "#dcfce7",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#16a34a",
                        flexShrink: 0,
                      }}
                    >
                      <ShieldCheck size={22} />
                    </div>
                    <div>
                      <strong style={{ fontSize: "14px", color: "#15803d", display: "block" }}>
                        Đang liên kết tự động qua SePay Bank Hub
                      </strong>
                      <span style={{ fontSize: "12px", color: "#166534" }}>
                        Tài khoản ngân hàng được đồng bộ và gạch nợ tự động trực tiếp từ SePay.
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    style={{
                      borderColor: "#fca5a5",
                      color: "#b91c1c",
                      backgroundColor: "#ffffff",
                      fontSize: "12px",
                      padding: "6px 14px",
                    }}
                    onClick={() => setBankHubModal({ isOpen: true, purpose: "UNLINK" })}
                  >
                    <Unlink size={14} />
                    <span>Hủy liên kết Bank Hub</span>
                  </Button>
                </div>
              ) : (
                <div
                  style={{
                    padding: "18px 20px",
                    borderRadius: "12px",
                    background: "linear-gradient(135deg, #f0fdfa 0%, #e6fffa 100%)",
                    border: "1.5px solid #99f6e4",
                    marginBottom: "20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "16px",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <div
                      style={{
                        width: "44px",
                        height: "44px",
                        borderRadius: "10px",
                        backgroundColor: "#ccfbf1",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#0f766e",
                        flexShrink: 0,
                      }}
                    >
                      <Zap size={24} />
                    </div>
                    <div>
                      <strong style={{ fontSize: "14px", color: "#0f766e", display: "block" }}>
                        Liên kết tài khoản tự động qua SePay Bank Hub (Khuyên dùng)
                      </strong>
                      <p style={{ margin: "2px 0 0 0", fontSize: "12.5px", color: "#334155" }}>
                        Kết nối trực tiếp tài khoản ngân hàng của bạn bằng iframe an toàn SePay. Tự động đối soát và gạch nợ tức thì 24/7.
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    style={{
                      backgroundColor: "#0f766e",
                      color: "#ffffff",
                      fontSize: "13px",
                      padding: "8px 16px",
                      boxShadow: "0 2px 8px rgba(15, 118, 110, 0.25)",
                    }}
                    onClick={() => setBankHubModal({ isOpen: true, purpose: "LINK" })}
                  >
                    <Zap size={15} />
                    <span>Bắt đầu liên kết Bank Hub</span>
                  </Button>
                </div>
              )}

              {/* Warning if not configured */}
              {!profile.hasBankAccount ? (
                <div className="profile-bank-alert">
                  <AlertTriangle size={20} className="profile-bank-alert-icon" />
                  <div>
                    <strong style={{ fontSize: "14px", color: "#92400e" }}>
                      Chưa cấu hình tài khoản nhận tiền!
                    </strong>
                    <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#78350f", lineHeight: 1.5 }}>
                      Bạn bắt buộc phải cấu hình tài khoản ngân hàng thụ hưởng. Nếu
                      chưa cài đặt, hệ thống sẽ chặn không cho phát hành hóa đơn (
                      <code>BANK_NOT_CONFIGURED</code>) vì khách thuê không có thông
                      tin chuyển khoản.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="profile-bank-alert success">
                  <CheckCircle2 size={20} className="profile-bank-alert-icon" />
                  <div>
                    <strong style={{ fontSize: "14px", color: "#166534" }}>
                      Tài khoản nhận tiền đang hoạt động
                    </strong>
                    <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#14532d", lineHeight: 1.5 }}>
                      Khi bạn cập nhật tài khoản mới, hệ thống sẽ tự động cập nhật
                      lại mã VietQR của tất cả các hóa đơn đang phát hành còn nợ.
                    </p>
                  </div>
                </div>
              )}

              {/* Virtual Bank Card Preview */}
              <div className="profile-bank-card-preview">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div className="profile-bank-chip" />
                  <span className="profile-bank-name-badge">
                    {profile.bankAccount?.bankName || selectedBankDisplay.split(" (")[0]}
                  </span>
                </div>

                <div className="profile-bank-acc-num">
                  {accountNumber
                    ? accountNumber.replace(/(\d{4})/g, "$1 ").trim()
                    : "•••• •••• •••• ••••"}
                </div>

                <div className="profile-bank-footer">
                  <div>
                    <div className="profile-bank-holder-label">CHỦ TÀI KHOẢN</div>
                    <div className="profile-bank-holder-name">
                      {accountName || (user?.name ? removeVietnameseTones(user.name).toUpperCase() : "CHỦ TÀI KHOẢN")}
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: "11px",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      background: "rgba(255,255,255,0.2)",
                      fontWeight: 600,
                    }}
                  >
                    VIETQR
                  </span>
                </div>
              </div>

              {/* Bank Update Form */}
              <form onSubmit={handleSaveBank}>
                <div className="form-section form-grid">
                  {/* Select Bank */}
                  <SelectField
                    label="Ngân hàng thụ hưởng (VietQR) *"
                    required
                    value={bankCode}
                    onChange={(e) => setBankCode(e.target.value)}
                  >
                    {VIETQR_BANKS.map((b) => (
                      <option key={b.code} value={b.code}>
                        {b.name}
                      </option>
                    ))}
                  </SelectField>

                  {/* Account Number */}
                  <Field
                    label="Số tài khoản ngân hàng *"
                    required
                    value={accountNumber}
                    onChange={(e) =>
                      setAccountNumber(e.target.value.replace(/[\s.-]/g, ""))
                    }
                    placeholder="VD: 0123456789"
                    hint="Từ 6 đến 19 chữ số, không chứa ký tự đặc biệt"
                  />

                  {/* Account Name */}
                  <Field
                    label="Tên chủ tài khoản (Chữ in hoa không dấu) *"
                    required
                    value={accountName}
                    onChange={(e) =>
                      setAccountName(removeVietnameseTones(e.target.value))
                    }
                    placeholder={`VD: ${user?.name ? removeVietnameseTones(user.name).toUpperCase() : "NGUYEN VAN A"}`}
                    hint="Hệ thống tự động chuyển sang chữ hoa không dấu"
                  />

                  {/* Current Password Validation */}
                  <Field
                    label="Mật khẩu tài khoản hiện tại *"
                    type="password"
                    required
                    value={bankPassword}
                    onChange={(e) => setBankPassword(e.target.value)}
                    placeholder="Nhập mật khẩu của bạn..."
                    hint="Bắt buộc xác thực mật khẩu để đảm bảo an toàn tài chính"
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    marginTop: "24px",
                    paddingTop: "16px",
                    borderTop: "1px solid var(--prof-border)",
                  }}
                >
                  <Button busy={savingBank}>
                    <Lock size={16} /> Xác nhận & Cập nhật tài khoản ngân hàng
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: BẢO MẬT & ĐỔI MẬT KHẨU */}
          {activeTab === "security" && (
            <div className="profile-card">
              <h3 className="profile-section-title">
                <KeyRound size={18} color="var(--prof-primary-container)" />
                Đổi mật khẩu tài khoản
              </h3>
              <p className="profile-section-sub">
                Để bảo vệ an toàn cho dữ liệu quản trị cơ sở, hãy sử dụng mật khẩu
                mạnh kết hợp chữ hoa, chữ thường và số.
              </p>

              <form onSubmit={handleChangePassword}>
                <div className="form-section form-grid" style={{ maxWidth: "600px" }}>
                  <div className="span-2">
                    <Field
                      label="Mật khẩu hiện tại *"
                      type="password"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Nhập mật khẩu hiện tại..."
                    />
                  </div>

                  <div className="span-2">
                    <Field
                      label="Mật khẩu mới *"
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Ít nhất 6 ký tự..."
                    />
                  </div>

                  <div className="span-2">
                    <Field
                      label="Xác nhận mật khẩu mới *"
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Nhập lại mật khẩu mới..."
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-start",
                    marginTop: "24px",
                    paddingTop: "16px",
                    borderTop: "1px solid var(--prof-border)",
                  }}
                >
                  <Button busy={savingPassword}>
                    <KeyRound size={16} /> Cập nhật mật khẩu mới
                  </Button>
                </div>
              </form>
            </div>
          )}
        </>
      )}

      {bankHubModal.isOpen && (
        <BankHubModal
          isOpen={bankHubModal.isOpen}
          purpose={bankHubModal.purpose}
          onClose={() => setBankHubModal({ isOpen: false, purpose: "LINK" })}
          onSynced={async () => {
            if (refreshProfile) await refreshProfile();
            profileResource.reload();
          }}
        />
      )}
    </div>
  );
}
