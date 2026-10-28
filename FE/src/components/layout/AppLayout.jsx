import React from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

/**
 * AppLayout Component - DOMUS ERP
 * Shell layout orchestrating the Sidebar, TopBar, and main scrollable content canvas.
 */
export function AppLayout({
  children,
  nav = [],
  currentPlan,
  home = "/",
  isSuperAdmin = false,
  isLandlord = false,
  isManager = false,
  isTenant = false,
  propertyAccess = false,
  user,
  userInitials = "U",
  roles = {},
  mobileMenuOpen = false,
  setMobileMenuOpen,
  onQuickCreate,
  onOpenPlans,
  onSignOut,
}) {
  return (
    <div className="stitch-layout">
      {/* 1. Left Sidebar Navigation */}
      <Sidebar
        nav={nav}
        currentPlan={currentPlan}
        home={home}
        isSuperAdmin={isSuperAdmin}
        isLandlord={isLandlord}
        isManager={isManager}
        isTenant={isTenant}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        onQuickCreate={onQuickCreate}
        onOpenPlans={onOpenPlans}
      />

      {/* 2. Main Workspace Content Wrapper */}
      <div className="stitch-main-wrap">
        {/* Sticky Top Bar */}
        <TopBar
          user={user}
          userInitials={userInitials}
          roles={roles}
          propertyAccess={propertyAccess}
          isLandlord={isLandlord}
          onOpenQuickCreate={onQuickCreate}
          onOpenMobileMenu={() => setMobileMenuOpen && setMobileMenuOpen(true)}
          onSignOut={onSignOut}
        />

        {/* 3. Main Scrollable Content Canvas */}
        <main className="stitch-canvas">
          <div className="stitch-canvas-inner">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default AppLayout;
