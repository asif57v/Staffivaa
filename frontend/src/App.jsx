import React, { useEffect, Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import toast, { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthProvider.jsx'
import { GlobalScrollManager } from './components/navigation/GlobalScrollManager.jsx'
import { SmoothScrollProvider } from './components/navigation/SmoothScrollProvider.jsx'
import { ProtectedRoute } from './components/auth/ProtectedRoute.jsx'
import { GuestRoute } from './components/auth/GuestRoute.jsx'
import { AuthRootRoute } from './components/auth/AuthRootRoute.jsx'
import { appShellChildRoutes } from './routes/appRoutes.jsx'
import { corporateChildRoutes } from './routes/corporateRoutes.jsx'
import { vendorChildRoutes } from './routes/vendorRoutes.jsx'
import { enterpriseChildRoutes } from './routes/enterpriseRoutes.jsx'
import { APP_B2C_ROLES, CORPORATE_ROLES, VENDOR_ROLES, ENTERPRISE_ROLES } from './constants/panelRoles.js'
import { USER_ROLES } from './constants/userRoles.js'

// Layouts
const AppShell = lazy(() => import('./layouts/AppShell.jsx').then(m => ({ default: m.AppShell })))
const CorporateShell = lazy(() => import('./layouts/CorporateShell.jsx').then(m => ({ default: m.CorporateShell })))
const VendorShell = lazy(() => import('./layouts/VendorShell.jsx').then(m => ({ default: m.VendorShell })))
const EnterpriseShell = lazy(() => import('./layouts/EnterpriseShell.jsx').then(m => ({ default: m.EnterpriseShell })))
const AdminLayout = lazy(() => import('./layouts/AdminLayout.jsx').then(m => ({ default: m.AdminLayout })))

// Pages
const LandingPage = lazy(() => import('./pages/LandingPage.jsx').then(m => ({ default: m.LandingPage })))
const AuthEntryPage = lazy(() => import('./pages/auth/AuthEntryPage.jsx').then(m => ({ default: m.AuthEntryPage })))
const LabourCategoriesPage = lazy(() => import('./pages/app/LabourCategoriesPage.jsx').then(m => ({ default: m.LabourCategoriesPage })))
const AdminLabourCategoriesPage = lazy(() => import('./pages/admin/AdminLabourCategoriesPage.jsx').then(m => ({ default: m.AdminLabourCategoriesPage })))
const AdminLoginPage = lazy(() => import('./pages/admin/AdminLoginPage.jsx').then(m => ({ default: m.AdminLoginPage })))
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage.jsx').then(m => ({ default: m.AdminDashboardPage })))
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage.jsx').then(m => ({ default: m.AdminUsersPage })))
const AdminLabourPage = lazy(() => import('./pages/admin/AdminLabourPage.jsx').then(m => ({ default: m.AdminLabourPage })))
const AdminBusinessVerificationPage = lazy(() => import('./pages/admin/AdminBusinessVerificationPage.jsx').then(m => ({ default: m.AdminBusinessVerificationPage })))
const AdminUserDetailsPage = lazy(() => import('./pages/admin/AdminUserDetailsPage.jsx').then(m => ({ default: m.AdminUserDetailsPage })))
const AdminBuildMartLeadsPage = lazy(() => import('./pages/admin/AdminBuildMartLeadsPage.jsx').then(m => ({ default: m.AdminBuildMartLeadsPage })))
const AdminBookingsPage = lazy(() => import('./pages/admin/AdminBookingsPage.jsx').then(m => ({ default: m.AdminBookingsPage })))
const AdminAllocationsPage = lazy(() => import('./pages/admin/AdminAllocationsPage.jsx').then(m => ({ default: m.AdminAllocationsPage })))
const AdminAttendancePage = lazy(() => import('./pages/admin/AdminAttendancePage.jsx').then(m => ({ default: m.AdminAttendancePage })))
const AdminPaymentDetailPage = lazy(() => import('./pages/admin/AdminPaymentDetailPage.jsx').then(m => ({ default: m.AdminPaymentDetailPage })))
const AdminPricingPage = lazy(() => import('./pages/admin/AdminPricingPage.jsx').then(m => ({ default: m.AdminPricingPage })))
const AdminWalletDashboard = lazy(() => import('./pages/admin/wallet/AdminWalletDashboard.jsx').then(m => ({ default: m.AdminWalletDashboard })))
const AdminRefundsPage = lazy(() => import('./pages/admin/wallet/AdminRefundsPage.jsx').then(m => ({ default: m.AdminRefundsPage })))
const AdminModulePlaceholder = lazy(() => import('./components/admin/AdminModulePlaceholder.jsx').then(m => ({ default: m.AdminModulePlaceholder })))
const AdminReportsPage = lazy(() => import('./pages/admin/AdminReportsPage.jsx').then(m => ({ default: m.AdminReportsPage })))
const AdminSettingsPage = lazy(() => import('./pages/admin/AdminSettingsPage.jsx').then(m => ({ default: m.AdminSettingsPage })))

const AdminPromotionsOffersPage = lazy(() => import('./pages/admin/marketing/AdminPromotionsOffersPage.jsx').then(m => ({ default: m.AdminPromotionsOffersPage })))
const AdminSponsoredAdsPage = lazy(() => import('./pages/admin/marketing/AdminSponsoredAdsPage.jsx').then(m => ({ default: m.AdminSponsoredAdsPage })))
const AdminBannerManagementPage = lazy(() => import('./pages/admin/marketing/AdminBannerManagementPage.jsx').then(m => ({ default: m.AdminBannerManagementPage })))
const AdminCampaignAnalyticsPage = lazy(() => import('./pages/admin/marketing/AdminCampaignAnalyticsPage.jsx').then(m => ({ default: m.AdminCampaignAnalyticsPage })))
const AdminCommissionPage = lazy(() => import('./panels/admin/pages/AdminCommissionPage.jsx').then(m => ({ default: m.default })))
const AdminEnterpriseVerificationPage = lazy(() => import('./pages/admin/AdminEnterpriseVerificationPage.jsx').then(m => ({ default: m.AdminEnterpriseVerificationPage })))
const AdminEnterpriseJobsPage = lazy(() => import('./pages/admin/AdminEnterpriseJobsPage.jsx').then(m => ({ default: m.AdminEnterpriseJobsPage })))
const AdminEnterpriseWalletsPage = lazy(() => import('./pages/admin/AdminEnterpriseWalletsPage.jsx').then(m => ({ default: m.AdminEnterpriseWalletsPage })))
const AdminJoiningPaymentsPage = lazy(() => import('./pages/admin/AdminJoiningPaymentsPage.jsx').then(m => ({ default: m.AdminJoiningPaymentsPage })))
const AdminEnterprisePayrollsPage = lazy(() => import('./pages/admin/AdminEnterprisePayrollsPage.jsx').then(m => ({ default: m.AdminEnterprisePayrollsPage })))
const AdminWithdrawalRequestsPage = lazy(() => import('./pages/admin/AdminWithdrawalRequestsPage.jsx').then(m => ({ default: m.AdminWithdrawalRequestsPage })))
const AdminLegalContentPage = lazy(() => import('./pages/admin/AdminLegalContentPage.jsx').then(m => ({ default: m.AdminLegalContentPage })))
const PublicLegalPage = lazy(() => import('./pages/PublicLegalPage.jsx').then(m => ({ default: m.PublicLegalPage })))

function RouteChangeListener() {
  const location = useLocation()
  useEffect(() => {
    toast.dismiss()
  }, [location.pathname])
  return null
}

function App() {
  return (
    <BrowserRouter>
      <SmoothScrollProvider>
      <GlobalScrollManager />
      <RouteChangeListener />
      <Toaster 
        position="top-center"
        containerStyle={{ top: 12, zIndex: 99999 }}
        toastOptions={{
          style: {
            margin: 0,
            zIndex: 99999,
          }
        }}
      />
      <AuthProvider>
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50"><div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-500"></div></div>}>
          <Routes>
            {/* Public Landing Page at root */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/home" element={<Navigate to="/" replace />} />

            {/* Public auth pages — redirects away if already logged in */}
            <Route
              path="/auth"
              element={
                <GuestRoute>
                  <AuthEntryPage />
                </GuestRoute>
              }
            />

            <Route
              path="/app"
              element={
                <ProtectedRoute roles={APP_B2C_ROLES}>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              {appShellChildRoutes}
            </Route>
            <Route
              path="/app/work-categories"
              element={
                <ProtectedRoute roles={[USER_ROLES.LABOUR]}>
                  <LabourCategoriesPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/corporate"
              element={
                <ProtectedRoute roles={CORPORATE_ROLES}>
                  <CorporateShell />
                </ProtectedRoute>
              }
            >
              {corporateChildRoutes}
            </Route>

            <Route
              path="/vendor"
              element={
                <ProtectedRoute roles={VENDOR_ROLES}>
                  <VendorShell />
                </ProtectedRoute>
              }
            >
              {vendorChildRoutes}
            </Route>

            <Route
              path="/enterprise"
              element={
                <ProtectedRoute roles={ENTERPRISE_ROLES}>
                  <EnterpriseShell />
                </ProtectedRoute>
              }
            >
              {enterpriseChildRoutes}
            </Route>

            <Route path="/admin/login" element={<AdminLoginPage />} />

            <Route
              path="/admin"
              element={
                <ProtectedRoute roles={[USER_ROLES.ADMIN]}>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminDashboardPage />} />
              <Route path="categories" element={<AdminLabourCategoriesPage />} />
              <Route path="users" element={<AdminUsersPage />} />
              <Route path="individuals" element={<AdminUsersPage fixedRole="individual" customTitle="Individual Users" />} />
              <Route path="enterprises" element={<AdminUsersPage fixedRole="enterprise" customTitle="Enterprise Clients" />} />
              <Route path="corporates" element={<AdminUsersPage fixedRole="corporate" customTitle="Corporate Clients" />} />
              <Route path="contractors" element={<AdminUsersPage fixedRole="contractor" customTitle="Contractors & Vendors" />} />
              <Route path="user/:id" element={<AdminUserDetailsPage />} />
              <Route path="labour" element={<AdminLabourPage />} />
              <Route path="business-verification" element={<AdminBusinessVerificationPage />} />
              <Route path="enterprise-verification" element={<AdminEnterpriseVerificationPage />} />
              <Route path="enterprise-jobs" element={<AdminEnterpriseJobsPage />} />
              <Route path="enterprise-wallets" element={<AdminEnterpriseWalletsPage />} />
              <Route path="enterprise-payments" element={<AdminJoiningPaymentsPage />} />
              <Route path="enterprise-payrolls" element={<AdminEnterprisePayrollsPage />} />
              <Route path="enterprise-withdrawals" element={<AdminWithdrawalRequestsPage />} />
              <Route path="buildmart" element={<AdminBuildMartLeadsPage />} />
              <Route path="bookings" element={<AdminBookingsPage />} />
              <Route path="allocations" element={<AdminAllocationsPage />} />
              <Route path="attendance" element={<AdminAttendancePage />} />
              <Route path="payments/:id" element={<AdminPaymentDetailPage />} />
              <Route path="pricing" element={<AdminPricingPage />} />
              <Route path="wallet" element={<AdminWalletDashboard />} />
              <Route path="refunds" element={<AdminRefundsPage />} />
              <Route path="commission" element={<AdminCommissionPage />} />
              <Route path="reports" element={<AdminReportsPage />} />
              <Route path="settings" element={<AdminSettingsPage />} />
              <Route path="marketing/promotions" element={<AdminPromotionsOffersPage />} />
              <Route path="marketing/ads" element={<AdminSponsoredAdsPage />} />
              <Route path="marketing/banners" element={<AdminBannerManagementPage />} />
              <Route path="marketing/analytics" element={<AdminCampaignAnalyticsPage />} />
              <Route path="legal-content" element={<AdminLegalContentPage />} />
            </Route>

            <Route path="/legal/:slug" element={<PublicLegalPage />} />

            <Route path="*" element={<Navigate to="/auth" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
      </SmoothScrollProvider>
    </BrowserRouter>
  )
}

export default App
