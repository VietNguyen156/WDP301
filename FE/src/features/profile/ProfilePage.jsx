import { User, CreditCard, KeyRound } from "lucide-react";
import { useProfilePage } from "../../hooks/useProfilePage";
import BankHubModal from "./BankHubModal";
import { PageHeader, LoadingState, ErrorState } from "../../components/ui";
import {
  ProfileOverviewBanner,
  ProfilePersonalInfoTab,
  ProfileBankTab,
  ProfileSecurityTab,
} from "../../components/profile";
import "./Profile.css";

export default function ProfilePage() {
  const {
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
  } = useProfilePage();

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
          <ProfileOverviewBanner profile={profile} isLandlord={isLandlord} />

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
              Bảo mật &amp; Mật khẩu
            </button>
          </div>

          {/* 3. Tab Contents */}
          {activeTab === "info" && (
            <ProfilePersonalInfoTab
              profile={profile}
              isLandlord={isLandlord}
              isManager={isManager}
              isTenant={isTenant}
              name={name}
              setName={setName}
              phoneNumber={phoneNumber}
              setPhoneNumber={setPhoneNumber}
              email={email}
              setEmail={setEmail}
              hometown={hometown}
              setHometown={setHometown}
              savingProfile={savingProfile}
              onSubmit={handleSaveProfile}
            />
          )}

          {activeTab === "bank" && isLandlord && (
            <ProfileBankTab
              user={user}
              profile={profile}
              bankCode={bankCode}
              setBankCode={setBankCode}
              accountNumber={accountNumber}
              setAccountNumber={setAccountNumber}
              accountName={accountName}
              setAccountName={setAccountName}
              bankPassword={bankPassword}
              setBankPassword={setBankPassword}
              savingBank={savingBank}
              selectedBankDisplay={selectedBankDisplay}
              onOpenBankHub={(purpose) =>
                setBankHubModal({ isOpen: true, purpose })
              }
              onSubmit={handleSaveBank}
            />
          )}

          {activeTab === "security" && (
            <ProfileSecurityTab
              currentPassword={currentPassword}
              setCurrentPassword={setCurrentPassword}
              newPassword={newPassword}
              setNewPassword={setNewPassword}
              confirmPassword={confirmPassword}
              setConfirmPassword={setConfirmPassword}
              savingPassword={savingPassword}
              onSubmit={handleChangePassword}
            />
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
