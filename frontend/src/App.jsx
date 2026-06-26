import React, { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthProvider.jsx'
import { ProtectedRoute } from './components/auth/ProtectedRoute.jsx'
import { GuestRoute } from './components/auth/GuestRoute.jsx'
import { AuthRootRoute } from './components/auth/AuthRootRoute.jsx'
import { appShellChildRoutes } from './routes/appRoutes.jsx'
import { corporateChildRoutes } from './routes/corporateRoutes.jsx'
import { vendorChildRoutes } from './routes/vendorRoutes.jsx'
import { APP_B2C_ROLES, CORPORATE_ROLES, VENDOR_ROLES } from './constants/panelRoles.js'
import { USER_ROLES } from './constants/userRoles.js'

// Layouts
const AppShell = lazy(() => import('./layouts/AppShell.jsx').then(m => ({ default: m.AppShell })))
const CorporateShell = lazy(() => import('./layouts/CorporateShell.jsx').then(m => ({ default: m.CorporateShell })))
const VendorShell = lazy(() => import('./layouts/VendorShell.jsx').then(m => ({ default: m.VendorShell })))
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
const AdminBillingPage = lazy(() => import('./pages/admin/AdminBillingPage.jsx').then(m => ({ default: m.AdminBillingPage })))
const AdminPricingPage = lazy(() => import('./pages/admin/AdminPricingPage.jsx').then(m => ({ default: m.AdminPricingPage })))
const AdminWalletDashboard = lazy(() => import('./pages/admin/wallet/AdminWalletDashboard.jsx').then(m => ({ default: m.AdminWalletDashboard })))
const AdminModulePlaceholder = lazy(() => import('./components/admin/AdminModulePlaceholder.jsx').then(m => ({ default: m.AdminModulePlaceholder })))

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-center" />
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
              <Route path="corporates" element={<AdminUsersPage fixedRole="corporate" customTitle="Corporate Clients" />} />
              <Route path="contractors" element={<AdminUsersPage fixedRole="contractor" customTitle="Contractors & Vendors" />} />
              <Route path="user/:id" element={<AdminUserDetailsPage />} />
              <Route path="labour" element={<AdminLabourPage />} />
              <Route path="business-verification" element={<AdminBusinessVerificationPage />} />
              <Route path="buildmart" element={<AdminBuildMartLeadsPage />} />
              <Route path="bookings" element={<AdminBookingsPage />} />
              <Route path="allocations" element={<AdminAllocationsPage />} />
              <Route path="attendance" element={<AdminAttendancePage />} />
              <Route path="billing" element={<AdminBillingPage />} />
              <Route path="pricing" element={<AdminPricingPage />} />
              <Route path="wallet" element={<AdminWalletDashboard />} />
              <Route
                path="reports"
                element={
                  <AdminModulePlaceholder
                    title="Reports & analytics"
                    subtitle="Active workforce, site usage, revenue, and dues."
                    bullets={['Dashboard KPIs', 'Payment ageing', 'Export datasets']}
                  />
                }
              />
              <Route
                path="settings"
                element={
                  <AdminModulePlaceholder
                    title="Settings"
                    subtitle="Platform configuration and integrations."
                    bullets={['OTP providers', 'Payment gateways', 'Feature flags']}
                  />
                }
              />
            </Route>

            <Route path="*" element={<Navigate to="/auth" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
