import { baseApi } from './baseApi.js'

export const adminEnterpriseApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAdminEnterpriseCompanies: builder.query({
      query: () => '/admin/enterprise/companies',
      providesTags: ['AdminEnterpriseCompany'],
    }),
    updateAdminEnterpriseCompanyStatus: builder.mutation({
      query: ({ id, status, reviewNote }) => ({
        url: `/admin/enterprise/companies/${id}/status`,
        method: 'PUT',
        body: { status, reviewNote },
      }),
      invalidatesTags: ['AdminEnterpriseCompany', 'User'],
    }),
    getAdminEnterpriseJobs: builder.query({
      query: () => '/admin/enterprise/jobs',
      providesTags: ['AdminEnterpriseJob'],
    }),
    updateAdminEnterpriseJobStatus: builder.mutation({
      query: ({ id, status, adminReviewNote, isLive }) => ({
        url: `/admin/enterprise/jobs/${id}/status`,
        method: 'PUT',
        body: { status, adminReviewNote, isLive },
      }),
      invalidatesTags: ['AdminEnterpriseJob'],
    }),

    // ── Daily/Hourly Requests routed to Admin ────────────────────────────────
    getAdminEnterpriseDirectRequests: builder.query({
      query: (params) => ({ url: '/admin/enterprise/direct-requests', params }),
      providesTags: ['AdminEnterpriseDirectRequests'],
    }),
    respondAdminEnterpriseDirectRequest: builder.mutation({
      query: ({ id, action, note }) => ({
        url: `/admin/enterprise/direct-requests/${id}/respond`,
        method: 'PATCH',
        body: { action, note },
      }),
      invalidatesTags: ['AdminEnterpriseDirectRequests', 'AdminEnterpriseJob', 'EnterpriseJobs'],
    }),
    getDirectRequestMatchingWorkers: builder.query({
      query: ({ id, search, showAll }) => ({
        url: `/admin/enterprise/direct-requests/${id}/matching-workers`,
        params: { search: search || undefined, showAll: showAll ? 'true' : undefined },
      }),
      providesTags: ['AdminEnterpriseDirectRequests'],
    }),
    assignDirectRequestWorkers: builder.mutation({
      query: ({ id, workerIds, externalWorkers }) => ({
        url: `/admin/enterprise/direct-requests/${id}/assign-workers`,
        method: 'POST',
        body: { workerIds, externalWorkers },
      }),
      invalidatesTags: ['AdminEnterpriseDirectRequests', 'EnterpriseJobs'],
    }),
    removeDirectRequestWorker: builder.mutation({
      query: ({ id, entryId }) => ({
        url: `/admin/enterprise/direct-requests/${id}/assigned-workers/${entryId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['AdminEnterpriseDirectRequests', 'EnterpriseJobs'],
    }),
    sendDirectRequestReminder: builder.mutation({
      query: ({ id, hoursBefore, note }) => ({
        url: `/admin/enterprise/direct-requests/${id}/send-reminder`,
        method: 'POST',
        body: { hoursBefore, note },
      }),
      invalidatesTags: ['AdminEnterpriseDirectRequests'],
    }),
    payoutDirectRequestWorker: builder.mutation({
      query: ({ id, entryId, ...body }) => ({
        url: `/admin/enterprise/direct-requests/${id}/assigned-workers/${entryId}/payout`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['AdminEnterpriseDirectRequests', 'EnterpriseJobs'],
    }),
    getAdminDirectPayments: builder.query({
      query: (params) => ({ url: '/admin/enterprise/direct-payments', params }),
      providesTags: ['DirectPayments'],
    }),

    // ── Admin Joining Payments & Escrow Management ───────────────────────────
    getAdminJoiningPayments: builder.query({
      query: (params) => ({ url: '/admin/enterprise/joining-payments', params }),
      providesTags: ['AdminJoiningPayments', 'EnterpriseInvoices', 'EnterpriseApplications'],
    }),
    verifyApproveJoining: builder.mutation({
      query: ({ id, adminNotes }) => ({
        url: `/admin/enterprise/joining-payments/${id}/verify-approve`,
        method: 'POST',
        body: { adminNotes },
      }),
      invalidatesTags: ['AdminJoiningPayments', 'EnterpriseInvoices', 'EnterpriseApplications', 'EnterpriseWorkforce'],
    }),
    refundJoiningPayment: builder.mutation({
      query: ({ id, refundReason, partialAmount }) => ({
        url: `/admin/enterprise/joining-payments/${id}/refund`,
        method: 'POST',
        body: { refundReason, partialAmount },
      }),
      invalidatesTags: ['AdminJoiningPayments', 'EnterpriseInvoices', 'EnterpriseApplications', 'EnterpriseWallet'],
    }),
    sendPaymentReminder: builder.mutation({
      query: (id) => ({
        url: `/admin/enterprise/joining-payments/${id}/remind`,
        method: 'POST',
      }),
      invalidatesTags: ['AdminJoiningPayments'],
    }),
    extendInvoiceDueDate: builder.mutation({
      query: ({ id, extensionDays, newDueDate, adminNotes }) => ({
        url: `/admin/enterprise/joining-payments/${id}/extend-due-date`,
        method: 'POST',
        body: { extensionDays, newDueDate, adminNotes },
      }),
      invalidatesTags: ['AdminJoiningPayments', 'EnterpriseInvoices'],
    }),
    markInvoicePaidOffline: builder.mutation({
      query: ({ id, paymentReference, adminNotes }) => ({
        url: `/admin/enterprise/joining-payments/${id}/mark-paid-offline`,
        method: 'POST',
        body: { paymentReference, adminNotes },
      }),
      invalidatesTags: ['AdminJoiningPayments', 'EnterpriseInvoices', 'EnterpriseApplications', 'EnterpriseWorkforce'],
    }),
    cancelInvoice: builder.mutation({
      query: ({ id, cancellationReason }) => ({
        url: `/admin/enterprise/joining-payments/${id}/cancel-invoice`,
        method: 'POST',
        body: { cancellationReason },
      }),
      invalidatesTags: ['AdminJoiningPayments', 'EnterpriseInvoices'],
    }),

    // ── Admin Enterprise Payrolls ────────────────────────────────────────────
    getAdminEnterprisePayrolls: builder.query({
      query: (params) => ({ url: '/admin/enterprise/payrolls', params }),
      providesTags: ['AdminEnterprisePayrolls'],
    }),
    reviewEnterprisePayroll: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/admin/enterprise/payrolls/${id}/review`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['AdminEnterprisePayrolls'],
    }),
    releaseEnterpriseSalary: builder.mutation({
      query: (arg) => {
        let id = ''
        let body = {}
        if (typeof arg === 'string') {
          id = arg
        } else if (arg && typeof arg === 'object') {
          id = typeof arg.id === 'object' ? (arg.id?._id || arg.id?.toString()) : String(arg.id || '')
          const { id: _idVal, ...rest } = arg
          body = rest
        }
        return {
          url: `/admin/enterprise/payrolls/${id}/release`,
          method: 'POST',
          body,
        }
      },
      invalidatesTags: ['AdminEnterprisePayrolls', 'AdminJoiningPayments'],
    }),

    // ── Admin: Send Payment Request to Enterprise ────────────────────────────
    sendPayrollPaymentRequest: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/admin/enterprise/payrolls/${id}/send-payment-request`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['AdminEnterprisePayrolls'],
    }),

    // ── Admin: Live Enterprise Attendance Monitoring ─────────────────────────
    getAdminEnterpriseAttendance: builder.query({
      query: (params) => ({ url: '/admin/enterprise/attendance', params }),
      providesTags: ['AdminEnterpriseAttendance'],
    }),
    getAdminWorkerAttendanceDetail: builder.query({
      query: ({ workerId, ...params }) => ({ url: `/admin/enterprise/attendance/${workerId}`, params }),
      providesTags: ['AdminEnterpriseAttendance'],
    }),
  }),
  overrideExisting: false,
})

export const {
  useGetAdminEnterpriseCompaniesQuery,
  useUpdateAdminEnterpriseCompanyStatusMutation,
  useGetAdminEnterpriseJobsQuery,
  useUpdateAdminEnterpriseJobStatusMutation,
  useGetAdminEnterpriseDirectRequestsQuery,
  useRespondAdminEnterpriseDirectRequestMutation,
  useGetDirectRequestMatchingWorkersQuery,
  useAssignDirectRequestWorkersMutation,
  useRemoveDirectRequestWorkerMutation,
  useSendDirectRequestReminderMutation,
  usePayoutDirectRequestWorkerMutation,
  useGetAdminDirectPaymentsQuery,
  useGetAdminJoiningPaymentsQuery,
  useVerifyApproveJoiningMutation,
  useRefundJoiningPaymentMutation,
  useSendPaymentReminderMutation,
  useExtendInvoiceDueDateMutation,
  useMarkInvoicePaidOfflineMutation,
  useCancelInvoiceMutation,
  useGetAdminEnterprisePayrollsQuery,
  useReviewEnterprisePayrollMutation,
  useReleaseEnterpriseSalaryMutation,
  useSendPayrollPaymentRequestMutation,
  useGetAdminEnterpriseAttendanceQuery,
  useGetAdminWorkerAttendanceDetailQuery,
} = adminEnterpriseApi

