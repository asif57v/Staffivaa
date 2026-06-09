import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthProvider.jsx'
import { ProtectedRoute } from './components/auth/ProtectedRoute.jsx'
import { GuestRoute } from './components/auth/GuestRoute.jsx'
import { AuthRootRoute } from './components/auth/AuthRootRoute.jsx'
import { AppShell } from './layouts/AppShell.jsx'
import { CorporateShell } from './layouts/CorporateShell.jsx'
import { VendorShell } from './layouts/VendorShell.jsx'
import { AdminLayout } from './layouts/AdminLayout.jsx'
import { LandingPage } from './pages/LandingPage'
import { AuthEntryPage } from './pages/auth/AuthEntryPage.jsx'
import { LabourCategoriesPage } from './pages/app/LabourCategoriesPage.jsx'
import { appShellChildRoutes } from './routes/appRoutes.jsx'
import { corporateChildRoutes } from './routes/corporateRoutes.jsx'
import { vendorChildRoutes } from './routes/vendorRoutes.jsx'
import { AdminLabourCategoriesPage } from './pages/admin/AdminLabourCategoriesPage.jsx'
import { AdminLoginPage } from './pages/admin/AdminLoginPage.jsx'
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage.jsx'
import { AdminUsersPage } from './pages/admin/AdminUsersPage.jsx'
import { AdminLabourPage } from './pages/admin/AdminLabourPage.jsx'
import { AdminBusinessVerificationPage } from './pages/admin/AdminBusinessVerificationPage.jsx'
import { AdminUserDetailsPage } from './pages/admin/AdminUserDetailsPage.jsx'
import { AdminBuildMartLeadsPage } from './pages/admin/AdminBuildMartLeadsPage.jsx'
import { AdminBookingsPage } from './pages/admin/AdminBookingsPage.jsx'
import { AdminAllocationsPage } from './pages/admin/AdminAllocationsPage.jsx'
import { AdminAttendancePage } from './pages/admin/AdminAttendancePage.jsx'
import { AdminBillingPage } from './pages/admin/AdminBillingPage.jsx'
import { AdminPricingPage } from './pages/admin/AdminPricingPage.jsx'
import { AdminModulePlaceholder } from './components/admin/AdminModulePlaceholder.jsx'
import { APP_B2C_ROLES, CORPORATE_ROLES, VENDOR_ROLES } from './constants/panelRoles.js'
import { USER_ROLES } from './constants/userRoles.js'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
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
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
