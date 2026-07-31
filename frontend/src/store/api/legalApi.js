import { baseApi } from './baseApi.js'

export const legalApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // ── Public Legal Endpoints ──────────────────────────────────────────────
    getPublicLegalPages: builder.query({
      query: () => '/legal/public',
      providesTags: ['LegalPages'],
    }),

    getPublicLegalPageBySlug: builder.query({
      query: (slug) => `/legal/public/${slug}`,
      providesTags: (_res, _err, slug) => [{ type: 'LegalPages', id: slug }],
    }),

    // ── Admin Legal Endpoints ───────────────────────────────────────────────
    getAdminLegalPages: builder.query({
      query: () => '/legal/admin',
      providesTags: ['LegalPages'],
    }),

    getAdminLegalPageById: builder.query({
      query: (id) => `/legal/admin/${id}`,
      providesTags: (_res, _err, id) => [{ type: 'LegalPages', id }],
    }),

    createLegalPage: builder.mutation({
      query: (body) => ({
        url: '/legal/admin',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['LegalPages'],
    }),

    updateLegalPage: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/legal/admin/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['LegalPages'],
    }),

    toggleLegalPageStatus: builder.mutation({
      query: ({ id, status }) => ({
        url: `/legal/admin/${id}/status`,
        method: 'PATCH',
        body: { status },
      }),
      invalidatesTags: ['LegalPages'],
    }),

    deleteLegalPage: builder.mutation({
      query: (id) => ({
        url: `/legal/admin/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['LegalPages'],
    }),
  }),
})

export const {
  useGetPublicLegalPagesQuery,
  useGetPublicLegalPageBySlugQuery,
  useGetAdminLegalPagesQuery,
  useGetAdminLegalPageByIdQuery,
  useCreateLegalPageMutation,
  useUpdateLegalPageMutation,
  useToggleLegalPageStatusMutation,
  useDeleteLegalPageMutation,
} = legalApi
