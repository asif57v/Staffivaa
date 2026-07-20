import { baseApi } from './baseApi'

export const commissionApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getVendorCommissions: builder.query({
      query: () => '/vendor/commission',
      providesTags: ['Commissions'],
    }),
    createCommissionOrder: builder.mutation({
      query: (id) => ({
        url: `/vendor/commission/${id}/pay/order`,
        method: 'POST',
      }),
    }),
    verifyCommissionPayment: builder.mutation({
      query: ({ id, data }) => ({
        url: `/vendor/commission/${id}/pay/verify`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Commissions'],
    }),
    getAdminCommissions: builder.query({
      query: (params) => ({
        url: '/admin/commission',
        params,
      }),
      providesTags: ['Commissions'],
    }),
    markCommissionPaidOffline: builder.mutation({
      query: ({ id, data }) => ({
        url: `/admin/commission/${id}/mark-paid`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Commissions'],
    }),
    waiveCommission: builder.mutation({
      query: ({ id, data }) => ({
        url: `/admin/commission/${id}/waive`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Commissions'],
    }),
  }),
})

export const {
  useGetVendorCommissionsQuery,
  useCreateCommissionOrderMutation,
  useVerifyCommissionPaymentMutation,
  useGetAdminCommissionsQuery,
  useMarkCommissionPaidOfflineMutation,
  useWaiveCommissionMutation,
} = commissionApi
