import { baseApi } from './baseApi.js'
import { getSocket } from '../../services/socket.js'

export const enterpriseApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // ── Enterprise Panel Jobs ────────────────────────────────────────────────
    getEnterpriseJobs: builder.query({
      query: () => '/enterprise/jobs',
      providesTags: ['EnterpriseJobs'],
      // Refresh when Admin accepts/rejects a daily/hourly request
      async onCacheEntryAdded(_arg, { dispatch, cacheDataLoaded, cacheEntryRemoved }) {
        const socket = getSocket()
        if (!socket) return
        try {
          await cacheDataLoaded
          const refresh = () => dispatch(enterpriseApi.util.invalidateTags(['EnterpriseJobs']))
          socket.on('enterprise_jobs_updated', refresh)
          await cacheEntryRemoved
          socket.off('enterprise_jobs_updated', refresh)
        } catch {
          /* no-op */
        }
      },
    }),
    createEnterpriseJob: builder.mutation({
      query: (body) => ({ url: '/enterprise/jobs', method: 'POST', body }),
      invalidatesTags: ['EnterpriseJobs'],
    }),

    // ── Labour Feed ─────────────────────────────────────────────────────────
    getPublicEnterpriseJobs: builder.query({
      query: (params) => ({ url: '/enterprise/public-jobs', params }),
      providesTags: ['EnterpriseJobs'],
      async onCacheEntryAdded(_arg, { dispatch, cacheDataLoaded, cacheEntryRemoved }) {
        const socket = getSocket()
        if (!socket) return
        try {
          await cacheDataLoaded
          const refresh = () => dispatch(enterpriseApi.util.invalidateTags(['EnterpriseJobs']))
          socket.on('enterprise_jobs_updated', refresh)
          await cacheEntryRemoved
          socket.off('enterprise_jobs_updated', refresh)
        } catch {
          /* no-op */
        }
      },
    }),

    getPublicEnterpriseJobById: builder.query({
      query: (id) => `/enterprise/public-jobs/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'EnterpriseJobs', id }],
    }),

    // ── Labour Application & Employment ─────────────────────────────────────
    applyToEnterpriseJob: builder.mutation({
      query: (body) => ({ url: '/enterprise/applications', method: 'POST', body }),
      invalidatesTags: ['EnterpriseApplications', 'EnterpriseJobs'],
    }),

    getMyEnterpriseApplications: builder.query({
      query: () => '/enterprise/my-applications',
      providesTags: ['EnterpriseApplications'],
      async onCacheEntryAdded(_arg, { dispatch, cacheDataLoaded, cacheEntryRemoved }) {
        const socket = getSocket()
        if (!socket) return
        try {
          await cacheDataLoaded
          const refresh = () => dispatch(enterpriseApi.util.invalidateTags(['EnterpriseApplications', 'LabourEmployment']))
          socket.on('enterprise_application_updated', refresh)
          await cacheEntryRemoved
          socket.off('enterprise_application_updated', refresh)
        } catch {
          /* no-op */
        }
      },
    }),

    respondToOffer: builder.mutation({
      query: ({ applicationId, action, reason }) => ({
        url: `/enterprise/applications/${applicationId}/respond-offer`,
        method: 'POST',
        body: { action, reason },
      }),
      invalidatesTags: ['EnterpriseApplications', 'EnterpriseWorkforce', 'LabourEmployment'],
    }),

    getLabourCurrentEmployment: builder.query({
      query: () => '/enterprise/my-employment',
      providesTags: ['LabourEmployment'],
    }),

    getLabourDirectAssignments: builder.query({
      query: () => '/enterprise/my-direct-assignments',
      providesTags: ['LabourEmployment'],
      // Refresh instantly when the enterprise generates a check-in OTP
      async onCacheEntryAdded(_arg, { dispatch, cacheDataLoaded, cacheEntryRemoved }) {
        const socket = getSocket()
        if (!socket) return
        try {
          await cacheDataLoaded
          const refresh = () => dispatch(enterpriseApi.util.invalidateTags(['LabourEmployment']))
          socket.on('enterprise_direct_assignment_updated', refresh)
          await cacheEntryRemoved
          socket.off('enterprise_direct_assignment_updated', refresh)
        } catch {
          /* no-op */
        }
      },
    }),
    verifyEnterpriseCheckInOtp: builder.mutation({
      query: ({ jobId, code }) => ({ url: `/enterprise/my-direct-assignments/${jobId}/verify-otp`, method: 'POST', body: { code } }),
      invalidatesTags: ['LabourEmployment'],
    }),
    requestEnterpriseCheckIn: builder.mutation({
      query: (jobId) => ({ url: `/enterprise/my-direct-assignments/${jobId}/request-checkin`, method: 'POST' }),
      invalidatesTags: ['LabourEmployment'],
    }),
    startEnterpriseDirectWork: builder.mutation({
      query: (jobId) => ({ url: `/enterprise/my-direct-assignments/${jobId}/start-work`, method: 'POST' }),
      invalidatesTags: ['LabourEmployment'],
    }),
    endEnterpriseDirectWork: builder.mutation({
      query: (jobId) => ({ url: `/enterprise/my-direct-assignments/${jobId}/end-work`, method: 'POST' }),
      invalidatesTags: ['LabourEmployment'],
    }),
    verifyEnterpriseCheckoutOtp: builder.mutation({
      query: ({ jobId, code }) => ({
        url: `/enterprise/my-direct-assignments/${jobId}/verify-checkout-otp`,
        method: 'POST',
        body: { code },
      }),
      invalidatesTags: ['LabourEmployment'],
    }),
    regenerateEnterpriseCheckoutOtp: builder.mutation({
      query: ({ jobId, entryId }) => ({
        url: `/enterprise/jobs/${jobId}/assigned-workers/${entryId}/checkout-otp`,
        method: 'POST',
      }),
      invalidatesTags: ['EnterpriseJobs'],
    }),
    generateEnterpriseCheckInOtp: builder.mutation({
      query: ({ jobId, entryId }) => ({
        url: `/enterprise/jobs/${jobId}/assigned-workers/${entryId}/checkin-otp`,
        method: 'POST',
      }),
      invalidatesTags: ['EnterpriseJobs'],
    }),

    getLabourEmploymentHistory: builder.query({
      query: () => '/enterprise/my-employment/history',
      providesTags: ['LabourEmployment', 'EnterprisePayrolls'],
    }),

    concludeEnterpriseJob: builder.mutation({
      query: ({ id, endDate }) => ({
        url: `/enterprise/jobs/${id}/conclude`,
        method: 'PATCH',
        body: { endDate },
      }),
      invalidatesTags: ['EnterpriseJobs', 'EnterpriseApplications', 'EnterpriseWorkforce', 'LabourEmployment'],
    }),

    // ── Daily/Hourly job payments (from enterprise wallet) ───────────────────
    getJobDirectPayments: builder.query({
      query: (id) => `/enterprise/jobs/${id}/direct-payments`,
      providesTags: ['DirectPayments'],
    }),
    payDirectJob: builder.mutation({
      query: ({ id, periodKey, hours }) => ({
        url: `/enterprise/jobs/${id}/direct-payments`,
        method: 'POST',
        body: { periodKey, hours },
      }),
      invalidatesTags: ['DirectPayments', 'EnterpriseJobs', 'EnterpriseWallet', 'EnterpriseWalletTransactions'],
    }),

    // ── Enterprise HR Hiring & Applications ──────────────────────────────────
    getEnterpriseCompanyApplications: builder.query({
      query: (params) => ({ url: '/enterprise/company-applications', params }),
      providesTags: ['EnterpriseApplications'],
      async onCacheEntryAdded(_arg, { dispatch, cacheDataLoaded, cacheEntryRemoved }) {
        const socket = getSocket()
        if (!socket) return
        try {
          await cacheDataLoaded
          const refresh = () => dispatch(enterpriseApi.util.invalidateTags(['EnterpriseApplications', 'EnterpriseWorkforce']))
          socket.on('enterprise_application_created', refresh)
          socket.on('enterprise_application_updated', refresh)
          await cacheEntryRemoved
          socket.off('enterprise_application_created', refresh)
          socket.off('enterprise_application_updated', refresh)
        } catch {
          /* no-op */
        }
      },
    }),

    updateApplicationStatus: builder.mutation({
      query: ({ applicationId, status, enterpriseNote }) => ({
        url: `/enterprise/applications/${applicationId}/status`,
        method: 'PATCH',
        body: { status, enterpriseNote },
      }),
      invalidatesTags: ['EnterpriseApplications'],
    }),

    scheduleInterview: builder.mutation({
      query: ({ applicationId, ...body }) => ({
        url: `/enterprise/applications/${applicationId}/schedule-interview`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['EnterpriseApplications'],
    }),

    cancelInterview: builder.mutation({
      query: ({ applicationId, cancellationReason }) => ({
        url: `/enterprise/applications/${applicationId}/cancel-interview`,
        method: 'PATCH',
        body: { cancellationReason },
      }),
      invalidatesTags: ['EnterpriseApplications'],
    }),

    getInterviewDetails: builder.query({
      query: (applicationId) => `/enterprise/applications/${applicationId}/interview`,
      providesTags: (_r, _e, id) => [{ type: 'EnterpriseApplications', id }],
    }),

    sendOfferLetter: builder.mutation({
      query: ({ applicationId, ...body }) => ({
        url: `/enterprise/applications/${applicationId}/send-offer`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['EnterpriseApplications'],
    }),

    // ── Enterprise Financial Invoices & Security Settings ─────────────────────
    getEnterpriseSecuritySettings: builder.query({
      query: () => '/enterprise/security-settings',
      providesTags: ['EnterpriseSecuritySettings', 'EnterpriseWallet'],
    }),

    getEnterpriseInvoices: builder.query({
      query: () => '/enterprise/joining-invoices',
      providesTags: ['EnterpriseInvoices', 'EnterpriseApplications'],
    }),

    payJoiningInvoice: builder.mutation({
      query: (invoiceId) => ({
        url: `/enterprise/joining-invoices/${invoiceId}/pay`,
        method: 'POST',
      }),
      invalidatesTags: ['EnterpriseInvoices', 'EnterpriseApplications', 'EnterpriseWallet'],
    }),

    verifyInvoicePayment: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/enterprise/joining-invoices/${id}/verify`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['EnterpriseInvoices', 'EnterpriseApplications', 'EnterpriseWallet'],
    }),

    // ── Enterprise Payroll & Salary Slip APIs ───────────────────────────────
    calculateEnterprisePayroll: builder.mutation({
      query: (body) => ({
        url: '/enterprise/payroll/calculate',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['EnterprisePayrolls'],
    }),

    getEnterprisePayrolls: builder.query({
      query: (params) => ({ url: '/enterprise/payroll', params }),
      providesTags: ['EnterprisePayrolls'],
    }),

    submitPayrollForReview: builder.mutation({
      query: (id) => ({
        url: `/enterprise/payroll/${id}/submit`,
        method: 'POST',
      }),
      invalidatesTags: ['EnterprisePayrolls'],
    }),

    getMyEnterprisePayrolls: builder.query({
      query: (params) => ({ url: '/enterprise/my-payrolls', params }),
      providesTags: ['LabourEnterprisePayrolls'],
    }),

    // ── Enterprise Workforce & Joinings ─────────────────────────────────────
    getUpcomingJoinings: builder.query({
      query: () => '/enterprise/upcoming-joinings',
      providesTags: ['EnterpriseWorkforce', 'EnterpriseApplications'],
    }),

    markWorkerJoined: builder.mutation({
      query: ({ applicationId, ...body }) => ({
        url: `/enterprise/applications/${applicationId}/mark-joined`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['EnterpriseWorkforce', 'EnterpriseApplications', 'LabourEmployment'],
    }),

    getActiveWorkforce: builder.query({
      query: () => '/enterprise/active-workforce',
      providesTags: ['EnterpriseWorkforce'],
    }),

    getEnterpriseWorkerAttendance: builder.query({
      query: (applicationId) => `/enterprise/applications/${applicationId}/attendance`,
      providesTags: ['EnterpriseWorkforce'],
    }),

    getEnterpriseDashboardOverview: builder.query({
      query: () => '/enterprise/dashboard-overview',
      providesTags: ['EnterpriseJobs', 'EnterpriseApplications', 'EnterpriseWorkforce', 'EnterpriseInvoices', 'EnterpriseWallet'],
    }),

    getJobWorkersAttendance: builder.query({
      query: (jobId) => `/enterprise/jobs/${jobId}/workers-attendance`,
      providesTags: ['EnterpriseWorkforce'],
    }),

    // ── Enterprise Salary Payment Invoices ───────────────────────────────────
    getEnterprisePayrollInvoices: builder.query({
      query: (params) => ({ url: '/enterprise/payroll-invoices', params }),
      providesTags: ['EnterprisePayrollInvoices'],
    }),
    payPayrollInvoice: builder.mutation({
      query: (invoiceId) => ({
        url: `/enterprise/payroll-invoices/${invoiceId}/pay`,
        method: 'POST',
      }),
      invalidatesTags: ['EnterprisePayrollInvoices', 'EnterprisePayrolls', 'EnterpriseWallet'],
    }),
    verifyPayrollInvoicePayment: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/enterprise/payroll-invoices/${id}/verify`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['EnterprisePayrollInvoices', 'EnterprisePayrolls', 'EnterpriseWallet'],
    }),
  }),
})

export const {
  useGetEnterpriseJobsQuery,
  useGetJobDirectPaymentsQuery,
  usePayDirectJobMutation,
  useCreateEnterpriseJobMutation,
  useGetPublicEnterpriseJobsQuery,
  useGetPublicEnterpriseJobByIdQuery,
  useApplyToEnterpriseJobMutation,
  useGetMyEnterpriseApplicationsQuery,
  useRespondToOfferMutation,
  useGetLabourCurrentEmploymentQuery,
  useGetLabourDirectAssignmentsQuery,
  useVerifyEnterpriseCheckInOtpMutation,
  useGenerateEnterpriseCheckInOtpMutation,
  useRequestEnterpriseCheckInMutation,
  useStartEnterpriseDirectWorkMutation,
  useEndEnterpriseDirectWorkMutation,
  useVerifyEnterpriseCheckoutOtpMutation,
  useRegenerateEnterpriseCheckoutOtpMutation,
  useGetLabourEmploymentHistoryQuery,
  useConcludeEnterpriseJobMutation,
  useGetEnterpriseCompanyApplicationsQuery,
  useUpdateApplicationStatusMutation,
  useScheduleInterviewMutation,
  useCancelInterviewMutation,
  useGetInterviewDetailsQuery,
  useSendOfferLetterMutation,
  useGetEnterpriseSecuritySettingsQuery,
  useGetEnterpriseInvoicesQuery,
  usePayJoiningInvoiceMutation,
  useVerifyInvoicePaymentMutation,
  useCalculateEnterprisePayrollMutation,
  useGetEnterprisePayrollsQuery,
  useSubmitPayrollForReviewMutation,
  useGetMyEnterprisePayrollsQuery,
  useGetUpcomingJoiningsQuery,
  useMarkWorkerJoinedMutation,
  useGetActiveWorkforceQuery,
  useGetEnterpriseWorkerAttendanceQuery,
  useGetEnterpriseDashboardOverviewQuery,
  useGetJobWorkersAttendanceQuery,
  useGetEnterprisePayrollInvoicesQuery,
  usePayPayrollInvoiceMutation,
  useVerifyPayrollInvoicePaymentMutation,
} = enterpriseApi

