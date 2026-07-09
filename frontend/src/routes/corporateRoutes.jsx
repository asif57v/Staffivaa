import { Route } from 'react-router-dom'
import { CorporateDashboardPage } from '../panels/corporate/pages/CorporateDashboardPage.jsx'
import { CorporateProjectsPage } from '../panels/corporate/pages/CorporateProjectsPage.jsx'
import { CorporateProjectNewPage } from '../panels/corporate/pages/CorporateProjectNewPage.jsx'
import { CorporateProjectDetailPage } from '../panels/corporate/pages/CorporateProjectDetailPage.jsx'
import { CorporateSiteDetailPage } from '../panels/corporate/pages/CorporateSiteDetailPage.jsx'
import { CorporateRequestsPage } from '../panels/corporate/pages/CorporateRequestsPage.jsx'
import { CorporateRequestNewPage } from '../panels/corporate/pages/CorporateRequestNewPage.jsx'
import { CorporateRequestDetailPage } from '../panels/corporate/pages/CorporateRequestDetailPage.jsx'
import { CorporatePaymentPage } from '../panels/corporate/pages/CorporatePaymentPage.jsx'
import { CorporateAttendancePage } from '../panels/corporate/pages/CorporateAttendancePage.jsx'
import { CorporateAttendanceWorkersPage } from '../panels/corporate/pages/CorporateAttendanceWorkersPage.jsx'
import { CorporateAttendanceWorkerPage } from '../panels/corporate/pages/CorporateAttendanceWorkerPage.jsx'
import { CorporateBillingPage } from '../panels/corporate/pages/CorporateBillingPage.jsx'
import { CorporateAnalyticsPage } from '../panels/corporate/pages/CorporateAnalyticsPage.jsx'
import { CorporateProfilePage } from '../panels/corporate/pages/CorporateProfilePage.jsx'
import { CorporateSupportPage } from '../panels/corporate/pages/CorporateSupportPage.jsx'
import { CorporateWalletPage } from '../panels/corporate/pages/CorporateWalletPage.jsx'

/** Nested `/corporate/*` routes — Fragment of `<Route>` nodes for React Router. */
export const corporateChildRoutes = (
  <>
    <Route index element={<CorporateDashboardPage />} />
    <Route path="projects" element={<CorporateProjectsPage />} />
    <Route path="projects/new" element={<CorporateProjectNewPage />} />
    <Route path="projects/:id" element={<CorporateProjectDetailPage />} />
    <Route path="projects/:projectId/sites/:siteId" element={<CorporateSiteDetailPage />} />
    <Route path="requests" element={<CorporateRequestsPage />} />
    <Route path="requests/new" element={<CorporateRequestNewPage />} />
    <Route path="requests/:id" element={<CorporateRequestDetailPage />} />
    <Route path="requests/:id/payment" element={<CorporatePaymentPage />} />
    <Route path="attendance" element={<CorporateAttendancePage />} />
    <Route path="attendance/:projectId" element={<CorporateAttendanceWorkersPage />} />
    <Route path="attendance/:projectId/worker/:workerId" element={<CorporateAttendanceWorkerPage />} />
    <Route path="billing" element={<CorporateBillingPage />} />
    <Route path="analytics" element={<CorporateAnalyticsPage />} />
    <Route path="profile" element={<CorporateProfilePage />} />
    <Route path="support" element={<CorporateSupportPage />} />
    <Route path="wallet" element={<CorporateWalletPage />} />
  </>
)
