import { Route } from 'react-router-dom'
import { VendorDashboardPage } from '../panels/vendor/pages/VendorDashboardPage.jsx'
import { VendorCrewPage } from '../panels/vendor/pages/VendorCrewPage.jsx'
import { VendorCrewNewPage } from '../panels/vendor/pages/VendorCrewNewPage.jsx'
import { VendorJobsPage } from '../panels/vendor/pages/VendorJobsPage.jsx'
import { VendorJobDetailPage } from '../panels/vendor/pages/VendorJobDetailPage.jsx'
import { VendorPaymentPage } from '../panels/vendor/pages/VendorPaymentPage.jsx'
import { VendorJobAssignPage } from '../panels/vendor/pages/VendorJobAssignPage.jsx'
import { VendorRequestsPage } from '../panels/vendor/pages/VendorRequestsPage.jsx'
import { VendorAttendancePage } from '../panels/vendor/pages/VendorAttendancePage.jsx'
import { VendorAttendanceWorkersPage } from '../panels/vendor/pages/VendorAttendanceWorkersPage.jsx'
import { VendorAttendanceWorkerPage } from '../panels/vendor/pages/VendorAttendanceWorkerPage.jsx'
import { VendorEarningsPage } from '../panels/vendor/pages/VendorEarningsPage.jsx'
import { VendorProfilePage } from '../panels/vendor/pages/VendorProfilePage.jsx'
import { VendorSupportPage } from '../panels/vendor/pages/VendorSupportPage.jsx'
import { VendorPayrollPage } from '../panels/vendor/pages/VendorPayrollPage.jsx'
import { VendorNotificationsPage } from '../panels/vendor/pages/VendorNotificationsPage.jsx'
import { VendorRadiusSettingsPage } from '../panels/vendor/pages/VendorRadiusSettingsPage.jsx'
import VendorCommissionPage from '../panels/vendor/pages/VendorCommissionPage.jsx'

/** Nested `/vendor/*` routes — Fragment of `<Route>` nodes for React Router. */
export const vendorChildRoutes = (
  <>
    <Route index element={<VendorDashboardPage />} />
    <Route path="notifications" element={<VendorNotificationsPage />} />
    <Route path="crew" element={<VendorCrewPage />} />
    <Route path="crew/new" element={<VendorCrewNewPage />} />
    <Route path="jobs" element={<VendorJobsPage />} />
    <Route path="jobs/:id" element={<VendorJobDetailPage />} />
    <Route path="jobs/:id/payment" element={<VendorPaymentPage />} />
    <Route path="jobs/:id/assign" element={<VendorJobAssignPage />} />
    <Route path="requests" element={<VendorRequestsPage />} />
    <Route path="attendance" element={<VendorAttendancePage />} />
    <Route path="attendance/:projectId" element={<VendorAttendanceWorkersPage />} />
    <Route path="attendance/:projectId/worker/:workerId" element={<VendorAttendanceWorkerPage />} />
    <Route path="earnings" element={<VendorEarningsPage />} />
    <Route path="payroll" element={<VendorPayrollPage />} />
    <Route path="commission" element={<VendorCommissionPage />} />
    <Route path="profile" element={<VendorProfilePage />} />
    <Route path="settings" element={<VendorRadiusSettingsPage />} />
    <Route path="support" element={<VendorSupportPage />} />
  </>
)
