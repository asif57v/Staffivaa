import { baseApi } from './baseApi.js'

export const enterpriseWalletApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // ── Enterprise Company Wallet Hooks ─────────────────────────────────────
    getEnterpriseWalletSummary: builder.query({
      query: () => '/enterprise/wallet/summary',
      providesTags: ['EnterpriseWallet'],
    }),

    createRechargeOrder: builder.mutation({
      query: (body) => ({
        url: '/enterprise/wallet/recharge/init',
        method: 'POST',
        body,
      }),
    }),

    verifyRechargePayment: builder.mutation({
      query: (body) => ({
        url: '/enterprise/wallet/recharge/verify',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['EnterpriseWallet', 'EnterpriseWalletTransactions'],
    }),

    getEnterpriseWalletTransactions: builder.query({
      query: (params) => ({
        url: '/enterprise/wallet/transactions',
        params,
      }),
      providesTags: ['EnterpriseWalletTransactions'],
    }),

    getTransactionDetails: builder.query({
      query: (id) => `/enterprise/wallet/transactions/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'EnterpriseWalletTransactions', id }],
    }),

    // ── Admin Enterprise Wallet Hooks ───────────────────────────────────────
    getAdminEnterpriseWallets: builder.query({
      query: () => '/admin/enterprise-wallets',
      providesTags: ['EnterpriseWallet'],
    }),

    toggleWalletFreezeStatus: builder.mutation({
      query: ({ enterpriseId, status }) => ({
        url: `/admin/enterprise-wallets/${enterpriseId}/status`,
        method: 'PATCH',
        body: { status },
      }),
      invalidatesTags: ['EnterpriseWallet'],
    }),

    adjustEnterpriseWalletBalance: builder.mutation({
      query: ({ enterpriseId, action, amount, reason }) => ({
        url: `/admin/enterprise-wallets/${enterpriseId}/adjust`,
        method: 'POST',
        body: { action, amount, reason },
      }),
      invalidatesTags: ['EnterpriseWallet', 'EnterpriseWalletTransactions'],
    }),

    getAdminEnterpriseWalletTransactions: builder.query({
      query: (params) => ({
        url: '/admin/enterprise-wallets/transactions',
        params,
      }),
      providesTags: ['EnterpriseWalletTransactions'],
    }),
  }),
})

export const {
  useGetEnterpriseWalletSummaryQuery,
  useCreateRechargeOrderMutation,
  useVerifyRechargePaymentMutation,
  useGetEnterpriseWalletTransactionsQuery,
  useGetTransactionDetailsQuery,
  useGetAdminEnterpriseWalletsQuery,
  useToggleWalletFreezeStatusMutation,
  useAdjustEnterpriseWalletBalanceMutation,
  useGetAdminEnterpriseWalletTransactionsQuery,
} = enterpriseWalletApi
