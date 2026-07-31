import { Navigate, Route } from 'react-router-dom'
import { RoleRoute } from '../components/auth/RoleRoute.jsx'
import { AppHomePage } from '../pages/app/AppHomePage.jsx'
import { AppBookingsPage } from '../pages/app/AppBookingsPage.jsx'
import { AppJobsPage } from '../pages/app/AppJobsPage.jsx'
import { AppSupportPage } from '../pages/app/AppSupportPage.jsx'
import { AppProfilePage } from '../pages/app/AppProfilePage.jsx'
import { AppEarningsPage } from '../pages/app/AppEarningsPage.jsx'
import { AppAttendancePage } from '../pages/app/AppAttendancePage.jsx'
import { AppKycPage } from '../pages/app/AppKycPage.jsx'
import { LabourNotificationsPage } from '../pages/app/labour/LabourNotificationsPage.jsx'
import { IndividualBookingFlowPage } from '../pages/app/booking/IndividualBookingFlowPage.jsx'
import { BuildMartHomePage } from '../pages/app/buildmart/BuildMartHomePage.jsx'
import { BuildMartProductPage } from '../pages/app/buildmart/BuildMartProductPage.jsx'
import { LabourNavigationScreen } from '../pages/app/navigation/LabourNavigationScreen.jsx'
import { WalletPage } from '../pages/app/wallet/WalletPage.jsx'
import { LabourEnterpriseJobsPage } from '../pages/app/LabourEnterpriseJobsPage.jsx'
import { LabourEnterpriseJobDetailPage } from '../pages/app/enterprise/LabourEnterpriseJobDetailPage.jsx'
import { LabourMyApplicationsPage } from '../pages/app/enterprise/LabourMyApplicationsPage.jsx'
import { LabourInterviewDetailsPage } from '../pages/app/enterprise/LabourInterviewDetailsPage.jsx'
import { USER_ROLES } from '../constants/userRoles.js'

const BUILDMART_ROLES = [USER_ROLES.INDIVIDUAL, USER_ROLES.LABOUR]

export const appShellChildRoutes = (
  <>
    <Route index element={<AppHomePage />} />
    <Route path="discover/labours" element={<Navigate to="/app" replace />} />
    <Route
      path="booking/flow"
      element={
        <RoleRoute allow={[USER_ROLES.INDIVIDUAL]}>
          <IndividualBookingFlowPage />
        </RoleRoute>
      }
    />
    <Route
      path="bookings"
      element={
        <RoleRoute allow={[USER_ROLES.INDIVIDUAL]}>
          <AppBookingsPage />
        </RoleRoute>
      }
    />
    <Route
      path="buildmart"
      element={
        <RoleRoute allow={[]}>
          <BuildMartHomePage />
        </RoleRoute>
      }
    />
    <Route
      path="buildmart/product/:productId"
      element={
        <RoleRoute allow={[]}>
          <BuildMartProductPage />
        </RoleRoute>
      }
    />
    <Route
      path="jobs"
      element={
        <RoleRoute allow={[USER_ROLES.LABOUR]}>
          <AppJobsPage />
        </RoleRoute>
      }
    />
    <Route
      path="navigation/:bookingId"
      element={
        <RoleRoute allow={[USER_ROLES.LABOUR]}>
          <LabourNavigationScreen />
        </RoleRoute>
      }
    />
    <Route path="support" element={<AppSupportPage />} />
    <Route path="profile" element={<AppProfilePage />} />
    <Route
      path="wallet"
      element={
        <RoleRoute allow={[USER_ROLES.INDIVIDUAL, USER_ROLES.LABOUR]}>
          <WalletPage />
        </RoleRoute>
      }
    />
    <Route
      path="earnings"
      element={
        <RoleRoute allow={[USER_ROLES.LABOUR]}>
          <AppEarningsPage />
        </RoleRoute>
      }
    />
    <Route
      path="attendance"
      element={
        <RoleRoute allow={[USER_ROLES.LABOUR]}>
          <AppAttendancePage />
        </RoleRoute>
      }
    />
    <Route
      path="kyc"
      element={
        <RoleRoute allow={[USER_ROLES.LABOUR]}>
          <AppKycPage />
        </RoleRoute>
      }
    />
    <Route
      path="notifications"
      element={
        <RoleRoute allow={[USER_ROLES.LABOUR, USER_ROLES.INDIVIDUAL]}>
          <LabourNotificationsPage />
        </RoleRoute>
      }
    />
    <Route
      path="enterprise-jobs"
      element={
        <RoleRoute allow={[USER_ROLES.LABOUR]}>
          <LabourEnterpriseJobsPage />
        </RoleRoute>
      }
    />
    <Route
      path="enterprise-jobs/:jobId"
      element={
        <RoleRoute allow={[USER_ROLES.LABOUR]}>
          <LabourEnterpriseJobDetailPage />
        </RoleRoute>
      }
    />
    <Route
      path="my-applications"
      element={
        <RoleRoute allow={[USER_ROLES.LABOUR]}>
          <LabourMyApplicationsPage />
        </RoleRoute>
      }
    />
    <Route
      path="my-applications/:id/interview"
      element={
        <RoleRoute allow={[USER_ROLES.LABOUR]}>
          <LabourInterviewDetailsPage />
        </RoleRoute>
      }
    />
  </>
)
