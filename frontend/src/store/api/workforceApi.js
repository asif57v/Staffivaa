import { baseApi } from './baseApi.js'

function unwrap(response) {
  return response?.data ?? response
}

export const workforceApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getCorporateDashboard: build.query({
      query: () => '/corporate/dashboard',
      transformResponse: unwrap,
      providesTags: ['CorporateDashboard'],
    }),
    getCorporateProjects: build.query({
      query: () => '/corporate/projects',
      transformResponse: unwrap,
      providesTags: ['Projects'],
    }),
    createCorporateProject: build.mutation({
      query: (body) => ({ url: '/corporate/projects', method: 'POST', body }),
      transformResponse: unwrap,
      invalidatesTags: ['Projects', 'CorporateDashboard'],
    }),
    getCorporateProject: build.query({
      query: (id) => `/corporate/projects/${id}`,
      transformResponse: unwrap,
      providesTags: (_r, _e, id) => [{ type: 'Projects', id }],
    }),
    addCorporateSite: build.mutation({
      query: ({ projectId, ...body }) => ({
        url: `/corporate/projects/${projectId}/sites`,
        method: 'POST',
        body,
      }),
      transformResponse: unwrap,
      invalidatesTags: ['Projects'],
    }),
    getMyRequests: build.query({
      query: (params) => ({ url: '/workforce/requests', params }),
      transformResponse: unwrap,
      providesTags: ['Requests'],
    }),
    getRequest: build.query({
      query: (id) => `/workforce/requests/${id}`,
      transformResponse: unwrap,
      providesTags: (_r, _e, id) => [{ type: 'Requests', id }],
    }),
    createRequest: build.mutation({
      query: (body) => ({ url: '/workforce/requests', method: 'POST', body }),
      transformResponse: unwrap,
      invalidatesTags: ['Requests', 'CorporateDashboard', 'AdminRequests'],
    }),
    createRazorpayOrder: build.mutation({
      query: (id) => ({ url: `/workforce/requests/${id}/payment/order`, method: 'POST' }),
      transformResponse: unwrap,
    }),
    verifyRazorpayPayment: build.mutation({
      query: ({ id, ...body }) => ({
        url: `/workforce/requests/${id}/payment/verify`,
        method: 'POST',
        body,
      }),
      transformResponse: unwrap,
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Requests', id }],
    }),
    createExtraWork: build.mutation({
      query: ({ id, ...body }) => ({ url: `/workforce/requests/${id}/extra-work`, method: 'POST', body }),
      transformResponse: unwrap,
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Requests', id }],
    }),
    getExtraWork: build.query({
      query: (id) => `/workforce/requests/${id}/extra-work`,
      transformResponse: unwrap,
    }),
    updateExtraWorkStatus: build.mutation({
      query: ({ extraWorkId, ...body }) => ({
        url: `/workforce/extra-work/${extraWorkId}/status`,
        method: 'PATCH',
        body,
      }),
      transformResponse: unwrap,
      invalidatesTags: ['Requests'],
    }),
    getCorporateInvoices: build.query({
      query: () => '/corporate/invoices',
      transformResponse: unwrap,
      providesTags: ['Invoices'],
    }),
    patchCorporateMe: build.mutation({
      query: (body) => ({ url: '/corporate/me', method: 'PATCH', body }),
      transformResponse: unwrap,
    }),
    addCorporateDocument: build.mutation({
      query: (body) => ({ url: '/corporate/documents', method: 'POST', body }),
      transformResponse: unwrap,
      invalidatesTags: ['CorporateProfile'],
    }),
    removeCorporateDocument: build.mutation({
      query: (docId) => ({ url: `/corporate/documents/${docId}`, method: 'DELETE' }),
      transformResponse: unwrap,
    }),
    submitCorporateVerification: build.mutation({
      query: () => ({ url: '/corporate/verification/submit', method: 'POST' }),
      transformResponse: unwrap,
      invalidatesTags: ['CorporateProfile', 'BusinessVerification'],
    }),
    getVendorDashboard: build.query({
      query: () => '/vendor/dashboard',
      transformResponse: unwrap,
      providesTags: ['VendorDashboard'],
    }),
    getVendorCrew: build.query({
      query: () => '/vendor/crew',
      transformResponse: unwrap,
      providesTags: ['Crew'],
    }),
    linkVendorCrew: build.mutation({
      query: (body) => ({ url: '/vendor/crew/link', method: 'POST', body }),
      transformResponse: unwrap,
      invalidatesTags: ['Crew', 'VendorDashboard'],
    }),
    getVendorJobs: build.query({
      query: () => '/vendor/jobs',
      transformResponse: unwrap,
      providesTags: ['VendorJobs'],
    }),
    acceptVendorJob: build.mutation({
      query: (id) => ({ url: `/vendor/jobs/${id}/accept`, method: 'POST' }),
      transformResponse: unwrap,
      invalidatesTags: ['VendorJobs', 'VendorDashboard', 'Requests'],
    }),
    assignWorkforce: build.mutation({
      query: ({ id, assignments }) => ({
        url: `/vendor/jobs/${id}/assign`,
        method: 'POST',
        body: { assignments },
      }),
      transformResponse: unwrap,
      invalidatesTags: ['VendorJobs', 'VendorDashboard', 'Requests'],
    }),
    getVendorSettlements: build.query({
      query: () => '/vendor/settlements',
      transformResponse: unwrap,
      providesTags: ['Invoices'],
    }),
    getVendorMarketplaceRequests: build.query({
      query: () => '/vendor/requests',
      transformResponse: unwrap,
      providesTags: ['VendorJobs', 'Requests'],
    }),
    acceptMarketplaceRequest: build.mutation({
      query: (id) => ({ url: `/vendor/requests/${id}/accept`, method: 'POST' }),
      transformResponse: unwrap,
      invalidatesTags: ['VendorJobs', 'Requests', 'VendorDashboard'],
    }),
    patchVendorMe: build.mutation({
      query: (body) => ({ url: '/vendor/me', method: 'PATCH', body }),
      transformResponse: unwrap,
      invalidatesTags: ['VendorProfile'],
    }),
    addVendorDocument: build.mutation({
      query: (body) => ({ url: '/vendor/documents', method: 'POST', body }),
      transformResponse: unwrap,
      invalidatesTags: ['VendorProfile'],
    }),
    removeVendorDocument: build.mutation({
      query: (docId) => ({ url: `/vendor/documents/${docId}`, method: 'DELETE' }),
      transformResponse: unwrap,
    }),
    submitVendorVerification: build.mutation({
      query: () => ({ url: '/vendor/verification/submit', method: 'POST' }),
      transformResponse: unwrap,
      invalidatesTags: ['VendorProfile', 'BusinessVerification'],
    }),
    getLabourAssignments: build.query({
      query: (params) => ({ url: '/workforce/assignments', params }),
      transformResponse: unwrap,
      providesTags: ['Assignments'],
    }),
    respondAssignment: build.mutation({
      query: ({ id, action, labourLat, labourLng }) => ({
        url: `/workforce/assignments/${id}/respond`,
        method: 'PATCH',
        body: { action, labourLat, labourLng },
      }),
      transformResponse: unwrap,
      invalidatesTags: ['Assignments'],
    }),
    checkIn: build.mutation({
      query: (body) => ({ url: '/workforce/attendance/check-in', method: 'POST', body }),
      transformResponse: unwrap,
      invalidatesTags: ['Attendance', 'Assignments'],
    }),
    startWork: build.mutation({
      query: (body) => ({ url: '/workforce/attendance/start-work', method: 'POST', body }),
      transformResponse: unwrap,
      invalidatesTags: ['Attendance', 'Assignments'],
    }),
    checkOut: build.mutation({
      query: (body) => ({ url: '/workforce/attendance/check-out', method: 'POST', body }),
      transformResponse: unwrap,
      invalidatesTags: ['Attendance', 'Assignments'],
    }),
    getAttendance: build.query({
      query: (params) => ({ url: '/workforce/attendance', params }),
      transformResponse: unwrap,
      providesTags: ['Attendance'],
    }),
    getAttendanceMonitor: build.query({
      query: (params) => ({ url: '/workforce/attendance/monitor', params }),
      transformResponse: unwrap,
      providesTags: ['Attendance'],
    }),
    getAdminRequests: build.query({
      query: (params) => ({ url: '/admin/workforce/requests', params }),
      transformResponse: unwrap,
      providesTags: ['AdminRequests'],
    }),
    patchRequestStatus: build.mutation({
      query: ({ id, ...body }) => ({
        url: `/admin/workforce/requests/${id}/status`,
        method: 'PATCH',
        body,
      }),
      transformResponse: unwrap,
      invalidatesTags: ['AdminRequests', 'Requests'],
    }),
    createAllocation: build.mutation({
      query: (body) => ({ url: '/admin/workforce/allocations', method: 'POST', body }),
      transformResponse: unwrap,
      invalidatesTags: ['AdminRequests', 'Assignments', 'VendorJobs'],
    }),
    listCorporateVerifications: build.query({
      query: (params) => ({ url: '/admin/workforce/corporates', params }),
      transformResponse: unwrap,
      providesTags: ['BusinessVerification'],
    }),
    listVendorVerifications: build.query({
      query: (params) => ({ url: '/admin/workforce/vendors', params }),
      transformResponse: unwrap,
      providesTags: ['BusinessVerification'],
    }),
    getCorporateVerificationDetail: build.query({
      query: (id) => `/admin/workforce/corporates/${id}`,
      transformResponse: unwrap,
    }),
    getVendorVerificationDetail: build.query({
      query: (id) => `/admin/workforce/vendors/${id}`,
      transformResponse: unwrap,
    }),
    reviewCorporate: build.mutation({
      query: ({ id, ...body }) => ({
        url: `/admin/workforce/corporates/${id}/review`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['CorporateProfile', 'BusinessVerification'],
    }),
    reviewVendor: build.mutation({
      query: ({ id, ...body }) => ({
        url: `/admin/workforce/vendors/${id}/review`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['VendorProfile', 'BusinessVerification'],
    }),
    generateInvoice: build.mutation({
      query: (body) => ({ url: '/admin/workforce/invoices/generate', method: 'POST', body }),
      transformResponse: unwrap,
      invalidatesTags: ['Invoices', 'AdminRequests'],
    }),
    getAdminPricing: build.query({
      query: () => '/admin/workforce/pricing',
      transformResponse: unwrap,
      providesTags: ['AdminPricing'],
    }),
    upsertPricing: build.mutation({
      query: (body) => ({ url: '/admin/workforce/pricing', method: 'POST', body }),
      transformResponse: unwrap,
      invalidatesTags: ['AdminPricing'],
    }),
    verifyAttendance: build.mutation({
      query: ({ id, ...body }) => ({
        url: `/admin/workforce/attendance/${id}/verify`,
        method: 'PATCH',
        body,
      }),
      transformResponse: unwrap,
      invalidatesTags: ['Attendance'],
    }),
  }),
})

export const {
  useGetCorporateDashboardQuery,
  useGetCorporateProjectsQuery,
  useCreateCorporateProjectMutation,
  useGetCorporateProjectQuery,
  useAddCorporateSiteMutation,
  useGetMyRequestsQuery,
  useGetRequestQuery,
  useCreateRequestMutation,
  useCreateRazorpayOrderMutation,
  useVerifyRazorpayPaymentMutation,
  useCreateExtraWorkMutation,
  useGetExtraWorkQuery,
  useUpdateExtraWorkStatusMutation,
  useGetCorporateInvoicesQuery,
  usePatchCorporateMeMutation,
  useAddCorporateDocumentMutation,
  useRemoveCorporateDocumentMutation,
  useSubmitCorporateVerificationMutation,
  useGetVendorDashboardQuery,
  useGetVendorCrewQuery,
  useLinkVendorCrewMutation,
  useGetVendorJobsQuery,
  useAcceptVendorJobMutation,
  useGetVendorSettlementsQuery,
  useGetVendorMarketplaceRequestsQuery,
  useAcceptMarketplaceRequestMutation,
  useAssignWorkforceMutation,
  usePatchVendorMeMutation,
  useAddVendorDocumentMutation,
  useRemoveVendorDocumentMutation,
  useSubmitVendorVerificationMutation,
  useListCorporateVerificationsQuery,
  useListVendorVerificationsQuery,
  useLazyGetCorporateVerificationDetailQuery,
  useLazyGetVendorVerificationDetailQuery,
  useGetLabourAssignmentsQuery,
  useRespondAssignmentMutation,
  useCheckInMutation,
  useStartWorkMutation,
  useCheckOutMutation,
  useGetAttendanceQuery,
  useGetAttendanceMonitorQuery,
  useGetAdminRequestsQuery,
  usePatchRequestStatusMutation,
  useCreateAllocationMutation,
  useReviewCorporateMutation,
  useReviewVendorMutation,
  useGenerateInvoiceMutation,
  useGetAdminPricingQuery,
  useUpsertPricingMutation,
  useVerifyAttendanceMutation,
} = workforceApi
