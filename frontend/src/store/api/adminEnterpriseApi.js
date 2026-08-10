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
  }),
  overrideExisting: false,
})

export const {
  useGetAdminEnterpriseCompaniesQuery,
  useUpdateAdminEnterpriseCompanyStatusMutation,
  useGetAdminEnterpriseJobsQuery,
  useUpdateAdminEnterpriseJobStatusMutation,
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
} = adminEnterpriseApi
