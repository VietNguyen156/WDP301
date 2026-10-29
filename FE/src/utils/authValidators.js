export const AUTH_HERO_SHOWCASE_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBdS9jcShludSmvU458p7BdLw5F2rVHhkNE7fCaolPVro-GcMzTKfPs9kkrZk2GZX6q0S6wKI1Sp-fESDAPE-jGPFsVdytW66naS5d6n-fCKpQ1j-ge5_9ldjTsjNrWrH9bDPebD4Vsiv6pv6Eon2hZHuJFbrAPJz0TaGX_t2XzDVbY8QiRsyZoFFlQjkpSWztYVeO-WYHVU6hJ1qls1vseB9MntaMb9HlrfSg7HVM";

export const RBAC_ROLE_SPECS = [
  {
    code: "LANDLORD",
    badgeTone: "landlord",
    label: "Chủ chuỗi",
    description: "Đăng ký qua Email, cấp quyền tức thì kèm ",
    highlight: "dùng thử 30 ngày",
    suffix: " (1 cơ sở, 5 phòng, 1 QL).",
  },
  {
    code: "MANAGER",
    badgeTone: "manager",
    label: "Quản lý cơ sở",
    description:
      "Cấp qua SĐT 10 số (0...), mật khẩu tạm hệ thống sinh ngẫu nhiên, ",
    highlight: "buộc đổi lần đầu",
    suffix: ".",
  },
  {
    code: "TENANT",
    badgeTone: "tenant",
    label: "Cư dân thuê",
    description: "Cấp tự động theo ",
    highlight: "CCCD 12 số",
    suffix:
      " khi kích hoạt Hợp đồng phòng, mật khẩu bảo mật bàn giao trực tiếp.",
  },
  {
    code: "SUPER_ADMIN",
    badgeTone: "admin",
    label: "Hạ tầng",
    description: "Đăng nhập quản trị viên tối cao đa cụm phân tán qua bí danh ",
    highlight: "admin",
    suffix: " & bảo mật 2 lớp.",
  },
];

export function detectRoleFormat(val = "") {
  const trimmed = val.trim();

  if (!trimmed) {
    return {
      status: "idle",
      tone: "neutral",
      badgeText: "Đang chờ nhập định danh",
      iconType: "badge",
      isValid: false,
      hintText:
        "Chấp nhận: Email (Landlord), SĐT 10 số (Quản lý), CCCD 12 số (Khách thuê), admin.",
    };
  }

  if (trimmed.toLowerCase() === "admin") {
    return {
      status: "matched",
      tone: "admin",
      badgeText: "SUPER_ADMIN",
      iconType: "admin",
      isValid: true,
      hintText: "Xác nhận vai trò: Quản trị viên tối cao đa cụm DOMUS.",
    };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (emailRegex.test(trimmed)) {
    return {
      status: "matched",
      tone: "landlord",
      badgeText: "Chủ chuỗi căn hộ",
      iconType: "landlord",
      isValid: true,
      hintText:
        "Định dạng Email hợp lệ: Kích hoạt toàn quyền tài chính & phân quyền cơ sở.",
    };
  }

  const cccdRegex = /^\d{12}$/;
  if (cccdRegex.test(trimmed)) {
    return {
      status: "matched",
      tone: "tenant",
      badgeText: "Cư dân thuê - CCCD",
      iconType: "tenant",
      isValid: true,
      hintText:
        "Định dạng CCCD 12 số: Đã liên kết hợp đồng thuê phòng và mã khách hàng.",
    };
  }

  const phoneRegex = /^0\d{9}$/;
  if (phoneRegex.test(trimmed)) {
    return {
      status: "matched",
      tone: "manager",
      badgeText: "Quản lý cơ sở",
      iconType: "manager",
      isValid: true,
      hintText:
        "SĐT chuẩn hóa 10 số: Quyền chốt điện nước, quản lý phòng & thu tiền mặt.",
    };
  }

  return {
    status: "typing",
    tone: "typing",
    badgeText: "Đang nhận diện định dạng...",
    iconType: "badge",
    isValid: false,
    hintText:
      "Vui lòng nhập Email, SĐT VN (0...), CCCD (12 chữ số), hoặc 'admin'.",
  };
}

export function evaluatePasswordStrength(password = "") {
  if (!password) {
    return {
      score: 0,
      label: "",
      tone: "neutral",
    };
  }

  const minLength = password.length >= 8;
  const hasLetterAndNumber = /[a-zA-Z]/.test(password) && /\d/.test(password);
  const hasUpperOrSymbol =
    (/[a-z]/.test(password) && /[A-Z]/.test(password)) ||
    /[^a-zA-Z0-9]/.test(password);
  const isLong = password.length >= 12;

  let score = 0;
  if (minLength) score += 1;
  if (hasLetterAndNumber) score += 1;
  if (hasUpperOrSymbol) score += 1;
  if (minLength && isLong && hasLetterAndNumber) score += 1;

  const metaByScore = {
    0: { label: "Chưa đủ 8 ký tự", tone: "danger" },
    1: { label: "Mức cơ bản", tone: "warning" },
    2: { label: "Khá an toàn", tone: "info" },
    3: { label: "Mật khẩu mạnh", tone: "success" },
    4: { label: "Rất mạnh", tone: "success" },
  };

  const currentMeta = metaByScore[score] || metaByScore[0];

  return {
    score,
    label: currentMeta.label,
    tone: currentMeta.tone,
  };
}

export function validateRegisterInput({ name, email, password }) {
  if (!name?.trim()) {
    return "Vui lòng nhập họ và tên Chủ trọ.";
  }
  if (!email?.trim()) {
    return "Vui lòng nhập địa chỉ Email hợp lệ.";
  }
  if (!password || password.length < 8) {
    return "Mật khẩu phải chứa tối thiểu 8 ký tự.";
  }
  return "";
}

export function validateForcePasswordInput({
  currentPassword,
  newPassword,
  confirmPassword,
}) {
  if (!currentPassword) {
    return "Vui lòng nhập mật khẩu tạm hiện tại.";
  }
  if (!newPassword || newPassword.length < 8) {
    return "Mật khẩu mới phải có tối thiểu 8 ký tự.";
  }
  if (newPassword === currentPassword) {
    return "Mật khẩu mới phải khác với mật khẩu tạm hiện tại.";
  }
  if (newPassword !== confirmPassword) {
    return "Xác nhận mật khẩu mới không khớp.";
  }
  return "";
}
