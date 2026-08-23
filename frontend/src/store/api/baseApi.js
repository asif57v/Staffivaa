import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import toast from 'react-hot-toast'
import { clearSession } from '../slices/authSlice.js'
import { clearPushSyncState } from '../../lib/pushSync.js'

const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: async (args, api, extraOptions) => {
    const result = await fetchBaseQuery({
      baseUrl,
      prepareHeaders: (headers, { getState }) => {
        const token = getState().auth.token
        if (token) headers.set('Authorization', `Bearer ${token}`)
        headers.set('Accept', 'application/json')
        return headers
      },
    })(args, api, extraOptions)

    if (result.error?.status === 401) {
      const errorData = result.error.data
      const isSessionTerminated = errorData?.code === 'SESSION_TERMINATED'
      const message = errorData?.message || 'Your session has ended. Please log in again.'

      if (typeof window !== 'undefined') {
        clearPushSyncState()
        if (isSessionTerminated) {
          sessionStorage.setItem('staffivaa_logout_reason', message)
          toast.error(message, {
            id: 'staffivaa-session-terminated-toast',
            duration: 8000,
          })
        }
      }

      const token = api.getState().auth.token
      if (token) api.dispatch(clearSession())
    }
    return result
  },
  tagTypes: [
    'CorporateProfile',
    'CorporateDashboard',
    'Projects',
    'Requests',
    'Invoices',
    'VendorProfile',
    'VendorDashboard',
    'Crew',
    'VendorJobs',
    'Assignments',
    'Attendance',
    'AdminRequests',
    'AdminPricing',
    'SystemPricing',
    'BusinessVerification',
    'Quotation',
    'AdminDashboard',
    'Notifications',
    'AuditLogs',
    'Tickets',
    'SystemSettings',
    'Wallet',
    'PayoutBatches',
    'Earnings',
    'Commissions',
    'EnterpriseJobs',
    'EnterpriseApplications',
    'EnterpriseWorkforce',
    'LabourEmployment',
    'EnterpriseWallet',
    'EnterpriseWalletTransactions',
    'LegalPages',
  ],
  endpoints: () => ({}),
})

