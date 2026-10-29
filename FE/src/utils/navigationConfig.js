import {
  Building2,
  DoorOpen,
  FileText,
  Receipt,
  CreditCard,
  Scale,
  Users,
  UserCheck,
  LayoutDashboard,
  Crown,
  Layers,
  Zap,
  AlertTriangle,
  Wrench,
  ArrowUpCircle,
} from "lucide-react";

export const ROLE_LABELS = {
  LANDLORD: "Chủ chuỗi cơ sở",
  PROPERTY_MANAGER: "Quản lý cơ sở",
  TENANT: "Khách thuê",
  SUPER_ADMIN: "Quản trị nền tảng",
};

export function getUserInitials(user) {
  if (!user?.name) return "U";
  const parts = user.name.trim().split(" ");
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function resolveCurrentPlanMeta(user, branches = []) {
  if (!user) {
    return {
      code: "FREE_TRIAL",
      name: "Gói Dùng Thử",
      expiryText: "30 ngày trải nghiệm",
      connectedText: "1 cơ sở · 5 phòng",
    };
  }
  if (user.role === "SUPER_ADMIN") {
    return {
      code: "ENTERPRISE",
      name: "Quản Trị Hệ Thống",
      expiryText: "Toàn quyền nền tảng (Root)",
      connectedText: "Toàn sàn DOMUS ERP",
    };
  }
  if (user.role === "PROPERTY_MANAGER") {
    return {
      code: "PROPERTY_MANAGER",
      name: "Quản Lý Cơ Sở",
      expiryText: "Theo phân quyền cơ sở",
      connectedText: `${branches.length} cơ sở phân công`,
    };
  }
  if (user.role === "TENANT") {
    return {
      code: "TENANT",
      name: "Tài Khoản Cư Dân",
      expiryText: "Khách thuê phòng",
      connectedText: "Đang thuê phòng",
    };
  }

  // LANDLORD
  const code = user.subscription?.plan?.code || user.subscriptionPlan || "";
  const name = user.subscription?.plan?.name || "Chưa có gói đang hiệu lực";
  const expiryText = user.subscription?.endDate
    ? `Hạn dùng: ${new Date(user.subscription.endDate).toLocaleDateString("vi-VN")}`
    : "Chọn gói để tiếp tục sử dụng";
  const connectedText =
    branches.length > 0
      ? `Đã kết nối ${branches.length} cơ sở`
      : "Hệ thống sẵn sàng";

  return { code, name, expiryText, connectedText };
}

export function resolveRoleAccess(user) {
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const isLandlord = user?.role === "LANDLORD";
  const isManager = user?.role === "PROPERTY_MANAGER";
  const isTenant = user?.role === "TENANT";

  const propertyAccess = !isSuperAdmin && (isLandlord || isManager);
  const contractAccess = !isSuperAdmin && (isLandlord || isTenant);
  const financeAccess = !isSuperAdmin && (isLandlord || isManager || isTenant);
  const tenantDirAccess = !isSuperAdmin && isLandlord;

  const home = isSuperAdmin
    ? "/admin"
    : propertyAccess
      ? "/dashboard"
      : "/contracts";

  return {
    isSuperAdmin,
    isLandlord,
    isManager,
    isTenant,
    propertyAccess,
    contractAccess,
    financeAccess,
    tenantDirAccess,
    home,
  };
}

export function buildNavigationItems(access, branchesCount = 0) {
  const {
    isSuperAdmin,
    isLandlord,
    isTenant,
    propertyAccess,
    contractAccess,
    financeAccess,
    tenantDirAccess,
  } = access;

  if (isSuperAdmin) {
    return [
      {
        path: "/admin?tab=analytics",
        label: "Tổng quan Hệ thống",
        icon: LayoutDashboard,
      },
      { path: "/admin?tab=landlords", label: "Quản lý Chủ trọ", icon: Users },
      { path: "/admin?tab=plans", label: "Gói dịch vụ SaaS", icon: Layers },
      {
        path: "/admin?tab=subscriptions",
        label: "Thuê bao & Hạn ngạch",
        icon: Crown,
      },
      {
        path: "/admin?tab=upgrade-requests",
        label: "Yêu cầu đổi gói",
        icon: ArrowUpCircle,
      },
      {
        path: "/admin?tab=invoices",
        label: "Hóa đơn & Thu tiền",
        icon: Receipt,
      },
    ];
  }

  return [
    ...(propertyAccess
      ? [
          {
            path: "/dashboard",
            label: "Tổng quan & Thống kê",
            icon: LayoutDashboard,
          },
          {
            path: "/branches",
            label: "Cơ sở / Tòa nhà",
            icon: Building2,
            count: branchesCount || undefined,
          },
          { path: "/rooms", label: "Phòng & Căn hộ", icon: DoorOpen },
          {
            path: "/utility-readings",
            label: "Chốt số điện nước",
            icon: Zap,
          },
          { path: "/incidents", label: "Sự cố & Bảo trì", icon: Wrench },
        ]
      : []),
    ...(isTenant
      ? [
          {
            path: "/incidents",
            label: "Báo sự cố phòng",
            icon: AlertTriangle,
          },
        ]
      : []),
    ...(contractAccess
      ? [
          {
            path: "/contracts",
            label: isTenant ? "Hợp đồng của tôi" : "Hợp đồng & Khách thuê",
            icon: FileText,
          },
        ]
      : []),
    ...(financeAccess
      ? [
          {
            path: "/invoices",
            label: isTenant ? "Hóa đơn của tôi" : "Hóa đơn & Thu nợ",
            icon: Receipt,
          },
          {
            path: "/payments",
            label: "Lịch sử thanh toán",
            icon: CreditCard,
          },
        ]
      : []),
    ...(isLandlord
      ? [{ path: "/staff", label: "Quản lý nhân sự", icon: Users }]
      : []),
    ...(tenantDirAccess
      ? [{ path: "/tenants", label: "Hồ sơ cư dân", icon: UserCheck }]
      : []),
    ...(isLandlord
      ? [
          {
            path: "/unmatched",
            label: "Đối soát SePay",
            icon: Scale,
          },
        ]
      : []),
  ];
}

