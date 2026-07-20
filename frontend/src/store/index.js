import { configureStore } from '@reduxjs/toolkit'
import { authReducer } from './slices/authSlice.js'
import { baseApi } from './api/baseApi.js'
import './api/workforceApi.js'
import './api/commissionApi.js'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    [baseApi.reducerPath]: baseApi.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
})
