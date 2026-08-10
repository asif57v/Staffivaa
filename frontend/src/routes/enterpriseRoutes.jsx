import React, { lazy } from 'react'
import { Route } from 'react-router-dom'

const EnterpriseDashboardPage = lazy(() => import('../panels/enterprise/pages/EnterpriseDashboardPage.jsx').then(m => ({ default: m.EnterpriseDashboardPage })))
const EnterpriseJobsPage = lazy(() => import('../panels/enterprise/pages/EnterpriseJobsPage.jsx').then(m => ({ default: m.EnterpriseJobsPage })))
const EnterpriseJobNewPage = lazy(() => import('../panels/enterprise/pages/EnterpriseJobNewPage.jsx').then(m => ({ default: m.EnterpriseJobNewPage })))
const EnterpriseJobDetailPage = lazy(() => import('../panels/enterprise/pages/EnterpriseJobDetailPage.jsx').then(m => ({ default: m.EnterpriseJobDetailPage })))
const EnterpriseApplicationsPage = lazy(() => import('../panels/enterprise/pages/EnterpriseApplicationsPage.jsx').then(m => ({ default: m.EnterpriseApplicationsPage })))
const EnterpriseWorkforcePage = lazy(() => import('../panels/enterprise/pages/EnterpriseWorkforcePage.jsx').then(m => ({ default: m.EnterpriseWorkforcePage })))
const EnterpriseWalletPage = lazy(() => import('../panels/enterprise/pages/EnterpriseWalletPage.jsx').then(m => ({ default: m.EnterpriseWalletPage })))
const EnterprisePayrollPage = lazy(() => import('../panels/enterprise/pages/EnterprisePayrollPage.jsx').then(m => ({ default: m.EnterprisePayrollPage })))
const EnterpriseNotificationsPage = lazy(() => import('../panels/enterprise/pages/EnterpriseNotificationsPage.jsx').then(m => ({ default: m.EnterpriseNotificationsPage })))

export const enterpriseChildRoutes = (
  <>
    <Route index element={<EnterpriseDashboardPage />} />
    <Route path="jobs" element={<EnterpriseJobsPage />} />
    <Route path="jobs/new" element={<EnterpriseJobNewPage />} />
    <Route path="jobs/:jobId" element={<EnterpriseJobDetailPage />} />
    <Route path="applications" element={<EnterpriseApplicationsPage />} />
    <Route path="applicants" element={<EnterpriseApplicationsPage />} />
    <Route path="workforce" element={<EnterpriseWorkforcePage />} />
    <Route path="workers" element={<EnterpriseWorkforcePage />} />
    <Route path="wallet" element={<EnterpriseWalletPage />} />
    <Route path="payroll" element={<EnterprisePayrollPage />} />
    <Route path="notifications" element={<EnterpriseNotificationsPage />} />
  </>
)
