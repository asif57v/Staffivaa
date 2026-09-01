import { baseApi } from './baseApi'

function unwrapWallet(response) {
  return response?.data ?? response
}

export const walletApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getWalletBalance: builder.query({
      query: (params = {}) => ({
        url: '/wallet',
        params,
      }),
      transformResponse: unwrapWallet,
      providesTags: ['Wallet'],
    }),
    createWalletRechargeOrder: builder.mutation({
      query: (data) => ({
        url: '/wallet/razorpay/create-order',
        method: 'POST',
        body: data,
      }),
      transformResponse: unwrapWallet,
    }),
    verifyWalletRechargePayment: builder.mutation({
      query: (data) => ({
        url: '/wallet/razorpay/verify',
        method: 'POST',
        body: data,
      }),
      transformResponse: unwrapWallet,
      invalidatesTags: ['Wallet'],
    }),
    requestWithdrawal: builder.mutation({
      query: (data) => ({
        url: '/wallet/withdraw',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Wallet'],
    }),
    requestRefund: builder.mutation({
      query: (bookingId) => ({
        url: `/wallet/refunds/${bookingId}/request`,
        method: 'POST',
      }),
      invalidatesTags: ['Wallet'],
    }),
  }),
})

export const { 
  useGetWalletBalanceQuery, 
  useCreateWalletRechargeOrderMutation, 
  useVerifyWalletRechargePaymentMutation,
  useRequestWithdrawalMutation,
  useRequestRefundMutation
} = walletApi
