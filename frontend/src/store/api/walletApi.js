import { baseApi } from './baseApi'

export const walletApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getWalletBalance: builder.query({
      query: () => '/wallet',
      providesTags: ['Wallet'],
    }),
    createRazorpayOrder: builder.mutation({
      query: (data) => ({
        url: '/wallet/razorpay/create-order',
        method: 'POST',
        body: data,
      }),
    }),
    verifyRazorpayPayment: builder.mutation({
      query: (data) => ({
        url: '/wallet/razorpay/verify',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Wallet'],
    }),
  }),
})

export const { 
  useGetWalletBalanceQuery, 
  useCreateRazorpayOrderMutation, 
  useVerifyRazorpayPaymentMutation 
} = walletApi
