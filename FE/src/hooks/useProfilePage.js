import { useState, useMemo } from "react";
import { profileApi, errorMessage } from "../services/api";
import { useResource } from "./useResource";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

export const ROLE_NAMES = {
  LANDLORD: "Chủ chuỗi cơ sở (Landlord)",
  PROPERTY_MANAGER: "Quản lý cơ sở (Property Manager)",
  TENANT: "Cư dân / Khách thuê (Tenant)",
  SUPER_ADMIN: "Quản trị nền tảng (Platform Root)",
};

export const VIETQR_BANKS = [
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

export function removeVietnameseTones(str) {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toUpperCase();
}

export function useProfilePage() {
  const { user, changePassword, refreshProfile } = useAuth();
  const toast = useToast();
  const profileResource = useResource(profileApi.get);

  const profile = profileResource.data || user || {};
  const isLandlord = profile.role === "LANDLORD";
  const isManager = profile.role === "PROPERTY_MANAGER";
  const isTenant = profile.role === "TENANT";
  const isSuperAdmin = profile.role === "SUPER_ADMIN";

  const [activeTab, setActiveTab] = useState("info"); // "info" | "bank" | "security"
  const [draft, setDraft] = useState({});

  const name = draft.name !== undefined ? draft.name : profile.name || "";
  const phoneNumber =
    draft.phoneNumber !== undefined
      ? draft.phoneNumber
      : profile.phoneNumber || "";
  const email = draft.email !== undefined ? draft.email : profile.email || "";
  const hometown =
    draft.hometown !== undefined ? draft.hometown : profile.hometown || "";

  const bankCode =
    draft.bankCode !== undefined
      ? draft.bankCode
      : profile.bankAccount?.bankCode || "MB";
  const accountNumber =
    draft.accountNumber !== undefined
      ? draft.accountNumber
      : profile.bankAccount?.accountNumber || "";
  const accountName =
    draft.accountName !== undefined
      ? draft.accountName
      : profile.bankAccount?.accountName ||
        (profile.name ? removeVietnameseTones(profile.name) : "");

  const setName = (val) => setDraft((prev) => ({ ...prev, name: val }));
  const setPhoneNumber = (val) =>
    setDraft((prev) => ({ ...prev, phoneNumber: val }));
  const setEmail = (val) => setDraft((prev) => ({ ...prev, email: val }));
  const setHometown = (val) => setDraft((prev) => ({ ...prev, hometown: val }));
  const setBankCode = (val) => setDraft((prev) => ({ ...prev, bankCode: val }));
  const setAccountNumber = (val) =>
    setDraft((prev) => ({ ...prev, accountNumber: val }));
  const setAccountName = (val) =>
    setDraft((prev) => ({ ...prev, accountName: val }));

  const [savingProfile, setSavingProfile] = useState(false);

  // Bank Account security & modal states
  const [bankPassword, setBankPassword] = useState("");
  const [savingBank, setSavingBank] = useState(false);
  const [bankHubModal, setBankHubModal] = useState({
    isOpen: false,
    purpose: "LINK",
  });

  // Security / change password states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

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
      body.hometown = hometown.trim();
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
      if (updated?.name) {
        const stored = localStorage.getItem("user");
        if (stored) {
          const parsed = JSON.parse(stored);
          localStorage.setItem(
            "user",
            JSON.stringify({ ...parsed, ...updated }),
          );
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
    const bankName = selectedBankObj
      ? selectedBankObj.name.split(" (")[0]
      : bankCode;

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

  return {
    user,
    refreshProfile,
    profileResource,
    profile,
    isLandlord,
    isManager,
    isTenant,
    activeTab,
    setActiveTab,
    name,
    setName,
    phoneNumber,
    setPhoneNumber,
    email,
    setEmail,
    hometown,
    setHometown,
    savingProfile,
    handleSaveProfile,
    bankCode,
    setBankCode,
    accountNumber,
    setAccountNumber,
    accountName,
    setAccountName,
    bankPassword,
    setBankPassword,
    savingBank,
    handleSaveBank,
    selectedBankDisplay,
    bankHubModal,
    setBankHubModal,
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    savingPassword,
    handleChangePassword,
  };
}

