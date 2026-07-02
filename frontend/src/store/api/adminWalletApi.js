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
  }),
})

export const {
  useGetWalletSummaryQuery,
  useGetTransactionsQuery,
  useGetWithdrawalsQuery,
  useCreateWithdrawalMutation,
  useReviewWithdrawalMutation,
  useGetWalletReportsQuery,
} = adminWalletApi
