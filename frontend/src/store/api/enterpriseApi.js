import { baseApi } from './baseApi.js'
import { getSocket } from '../../services/socket.js'

export const enterpriseApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // ── Enterprise Panel Jobs ────────────────────────────────────────────────
    getEnterpriseJobs: builder.query({
      query: () => '/enterprise/jobs',
      providesTags: ['EnterpriseJobs'],
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

    getEnterpriseDashboardOverview: builder.query({
      query: () => '/enterprise/dashboard-overview',
      providesTags: ['EnterpriseJobs', 'EnterpriseApplications', 'EnterpriseWorkforce', 'EnterpriseInvoices', 'EnterpriseWallet'],
    }),
  }),
})

export const {
  useGetEnterpriseJobsQuery,
  useCreateEnterpriseJobMutation,
  useGetPublicEnterpriseJobsQuery,
  useGetPublicEnterpriseJobByIdQuery,
  useApplyToEnterpriseJobMutation,
  useGetMyEnterpriseApplicationsQuery,
  useRespondToOfferMutation,
  useGetLabourCurrentEmploymentQuery,
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
  useGetEnterpriseDashboardOverviewQuery,
} = enterpriseApi
