import { useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { errorMessage } from "../services/api";
import {
  detectRoleFormat,
  evaluatePasswordStrength,
  validateRegisterInput,
  validateForcePasswordInput,
} from "../utils/authValidators";

export function useLoginForm() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Accounts to choose from when the same login + password exists with several landlords.
  const [choices, setChoices] = useState(null);

  const roleDetection = useMemo(() => detectRoleFormat(username), [username]);

  function resolveDestination(authenticatedUser) {
    if (authenticatedUser?.mustChangePassword) {
      return "/force-change-password";
    }
    if (authenticatedUser?.role === "SUPER_ADMIN") {
      return "/admin/saas";
    }
    if (authenticatedUser?.role === "TENANT") {
      return "/contracts";
    }
    return location.state?.from?.pathname || "/dashboard";
  }

  async function signIn(accountId) {
    setBusy(true);
    setError("");
    try {
      const authenticatedUser = await login({
        username: username.trim(),
        password,
        ...(accountId && { accountId }),
      });
      if (authenticatedUser?.selectionRequired) {
        setChoices(authenticatedUser.accounts || []);
        return;
      }
      setChoices(null);

      if (authenticatedUser?.mustChangePassword) {
        toast.info(
          "Vui lòng cập nhật mật khẩu mới trong lần đăng nhập đầu tiên.",
        );
      } else {
        toast.success("Đăng nhập thành công!");
      }

      navigate(resolveDestination(authenticatedUser), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    signIn();
  }

  function chooseAccount(accountId) {
    signIn(accountId);
  }

  function cancelChoice() {
    setChoices(null);
    setError("");
  }

  function handleForgotPassword(event) {
    event.preventDefault();
    toast.info(
      "Quản lý cơ sở & Cư dân vui lòng liên hệ Chủ chuỗi để cấp lại mật khẩu tạm. Chủ chuỗi vui lòng liên hệ Quản trị viên nền tảng.",
    );
  }

  return {
    username,
    setUsername,
    password,
    setPassword,
    rememberMe,
    setRememberMe,
    roleDetection,
    busy,
    error,
    setError,
    handleSubmit,
    handleForgotPassword,
    choices,
    chooseAccount,
    cancelChoice,
  };
}

export function useRegisterForm() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const passwordStrength = useMemo(
    () => evaluatePasswordStrength(password),
    [password],
  );

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const validationError = validateRegisterInput({ name, email, password });
    if (validationError) {
      setError(validationError);
      return;
    }

    setBusy(true);
    try {
      await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phoneNumber: phoneNumber.trim() || undefined,
        password,
      });
      toast.success(
        "Chào mừng bạn đến với DOMUS! Bạn được tặng 30 ngày dùng thử gói Khởi đầu.",
      );
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return {
    name,
    setName,
    email,
    setEmail,
    phoneNumber,
    setPhoneNumber,
    password,
    setPassword,
    passwordStrength,
    busy,
    error,
    setError,
    handleSubmit,
  };
}

export function useForceChangePasswordForm() {
  const { user, changePassword, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const passwordStrength = useMemo(
    () => evaluatePasswordStrength(newPassword),
    [newPassword],
  );

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const validationError = validateForcePasswordInput({
      currentPassword,
      newPassword,
      confirmPassword,
    });
    if (validationError) {
      setError(validationError);
      return;
    }

    setBusy(true);
    try {
      await changePassword({ currentPassword, newPassword });
      toast.success(
        "Đổi mật khẩu thành công! Vui lòng đăng nhập lại bằng mật khẩu mới.",
      );
      navigate("/login", { replace: true });
    } catch (err) {
      const msg = errorMessage(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return {
    user,
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    passwordStrength,
    busy,
    error,
    handleSubmit,
    handleLogout,
  };
}
