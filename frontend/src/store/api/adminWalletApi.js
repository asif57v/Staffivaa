import { baseApi } from './baseApi.js'

export const adminWalletApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getWalletSummary: builder.query({
      query: () => '/admin/wallet/summary',
      providesTags: ['Wallet'],
    }),
    
    getTransactions: builder.query({
      query: (params) => ({
        url: '/admin/wallet/transactions',
        params,
      }),
      providesTags: ['WalletTransaction'],
    }),

    getWithdrawals: builder.query({
      query: (params) => ({
        url: '/admin/wallet/withdrawals',
        params,
      }),
      providesTags: ['Withdrawal'],
    }),

    createWithdrawal: builder.mutation({
      query: (body) => ({
        url: '/admin/wallet/withdraw',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Wallet', 'WalletTransaction', 'Withdrawal'],
    }),

    reviewWithdrawal: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/admin/wallet/withdrawals/${id}/review`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['Wallet', 'WalletTransaction', 'Withdrawal'],
    }),

    getWalletReports: builder.query({
      query: () => '/admin/wallet/reports',
      providesTags: ['WalletReport'],
    }),

    getRefundRequests: builder.query({
      query: (params) => ({
        url: '/admin/refunds',
        params,
      }),
      providesTags: ['RefundRequest'],
    }),

    approveRefundRequest: builder.mutation({
      query: (id) => ({
        url: `/admin/refunds/${id}/approve`,
        method: 'POST',
      }),
      invalidatesTags: ['RefundRequest', 'Wallet', 'WalletTransaction'],
    }),

    rejectRefundRequest: builder.mutation({
      query: ({ id, adminNote }) => ({
        url: `/admin/refunds/${id}/reject`,
        method: 'POST',
        body: { adminNote },
      }),
      invalidatesTags: ['RefundRequest', 'Wallet', 'WalletTransaction'],
    }),
  }),
})

export const {
  useGetWalletSummaryQuery,
  useGetTransactionsQuery,
  useGetWithdrawalsQuery,
  useCreateWithdrawalMutation,
  useReviewWithdrawalMutation,
  useGetWalletReportsQuery,
  useGetRefundRequestsQuery,
  useApproveRefundRequestMutation,
  useRejectRefundRequestMutation,
} = adminWalletApi
