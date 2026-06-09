import { createSlice } from '@reduxjs/toolkit'

export const AUTH_STORAGE_KEY = 'lc_access_token'

function readStoredToken() {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem(AUTH_STORAGE_KEY)
}

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    token: readStoredToken(),
    user: null,
    loading: Boolean(readStoredToken()),
  },
  reducers: {
    setCredentials(state, action) {
      const { accessToken, user } = action.payload
      if (accessToken) localStorage.setItem(AUTH_STORAGE_KEY, accessToken)
      else localStorage.removeItem(AUTH_STORAGE_KEY)
      state.token = accessToken ?? null
      state.user = user ?? null
    },
    setUser(state, action) {
      state.user = action.payload
    },
    setLoading(state, action) {
      state.loading = action.payload
    },
    clearSession(state) {
      localStorage.removeItem(AUTH_STORAGE_KEY)
      state.token = null
      state.user = null
      state.loading = false
    },
  },
})

export const { setCredentials, setUser, setLoading, clearSession } = authSlice.actions
export const authReducer = authSlice.reducer
