import axios from 'axios'
import toast from 'react-hot-toast'
import { clearSession } from '../store/slices/authSlice.js'
import { store } from '../store/index.js'
import { clearPushSyncState } from '../lib/pushSync.js'

let baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'

console.log('API base URL:', baseUrl);

if (typeof window !== 'undefined' && !import.meta.env.VITE_API_URL) {
  if (window.location.hostname !== 'localhost') {
    baseUrl = `http://${window.location.hostname}:5000/api/v1`
  }
}

export class ApiError extends Error {
  constructor(message, { status, code, errors } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.errors = errors
  }
}

export const apiClient = axios.create({
  baseURL: baseUrl,
  headers: {
    Accept: 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  if (!config.skipAuth) {
    const token = store.getState().auth.token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  if (
    config.data !== undefined &&
    config.headers['Content-Type'] === undefined &&
    !(typeof FormData !== 'undefined' && config.data instanceof FormData)
  ) {
    config.headers['Content-Type'] = 'application/json'
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status
      const data = error.response?.data
      const cfg = error.config
      if (status === 401 && cfg && !cfg.skipAuth) {
        const token = store.getState().auth.token
        const isSessionTerminated = data?.code === 'SESSION_TERMINATED'
        const message = data?.message || 'Your session has ended. Please log in again.'

        if (typeof window !== 'undefined') {
          clearPushSyncState()
          if (isSessionTerminated) {
            sessionStorage.setItem('staffivaa_logout_reason', message)
            toast.error(message, {
              id: 'staffivaa-session-terminated-toast',
              duration: 8000,
            })
          }
        }

        if (token) {
          store.dispatch(clearSession())
        }
      }
    }
    return Promise.reject(error)
  },
)

/**
 * Shared HTTP client — same envelope as backend (`success`, `message`, `data`, `errors`).
 * @param {string} path
 * @param {{ method?: string, body?: unknown, headers?: Record<string, string>, skipAuth?: boolean }} [options]
 */
export async function apiRequest(path, { method = 'GET', body, headers = {}, skipAuth = false } = {}) {
  try {
    const res = await apiClient.request({
      url: path,
      method,
      data: body,
      headers: { ...headers },
      skipAuth,
    })
    return res.data
  } catch (e) {
    if (axios.isAxiosError(e)) {
      const json = e.response?.data ?? {}
      const message = typeof json.message === 'string' ? json.message : e.message || 'Request failed'
      throw new ApiError(message, {
        status: e.response?.status,
        code: json.code,
        errors: json.errors,
      })
    }
    throw e
  }
}

