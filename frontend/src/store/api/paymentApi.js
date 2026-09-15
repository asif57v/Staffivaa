import { baseApi } from './baseApi'

function unwrapPayment(response) {
  return response?.data ?? response
}

export const paymentApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPaymentStatus: builder.query({
      query: (orderId) => ({
        url: `/payments/status/${orderId}`,
      }),
      transformResponse: unwrapPayment,
      providesTags: ['Wallet', 'Requests', 'EnterpriseWallet'],
    }),
    reconcilePayment: builder.mutation({
      query: (orderId) => ({
        url: `/payments/reconcile/${orderId}`,
        method: 'POST',
      }),
      transformResponse: unwrapPayment,
      invalidatesTags: ['Wallet', 'Requests', 'EnterpriseWallet'],
    }),
  }),
})

export const {
  useGetPaymentStatusQuery,
  useLazyGetPaymentStatusQuery,
  useReconcilePaymentMutation,
} = paymentApi
