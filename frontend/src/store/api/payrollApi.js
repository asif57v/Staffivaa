import { baseApi } from './baseApi.js'

export const payrollApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getVendorBatches: builder.query({
      query: () => '/payroll/batches',
      providesTags: ['PayoutBatches'],
    }),
    approveBatch: builder.mutation({
      query: (batchId) => ({
        url: `/payroll/batches/${batchId}/approve`,
        method: 'POST',
      }),
      invalidatesTags: ['PayoutBatches', 'Wallet'],
    }),
    getLabourEarnings: builder.query({
      query: (projectId) => `/payroll/earnings/${projectId}`,
      providesTags: ['Earnings'],
    }),
  }),
})

export const {
  useGetVendorBatchesQuery,
  useApproveBatchMutation,
  useGetLabourEarningsQuery,
} = payrollApi
