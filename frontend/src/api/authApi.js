import { apiRequest } from './http.js'

export function requestRegisterOtp(payload) {
  return apiRequest('/auth/register/request-otp', { method: 'POST', body: payload, skipAuth: true })
}

export function verifyRegister(payload) {
  return apiRequest('/auth/register/verify', { method: 'POST', body: payload, skipAuth: true })
}

export function requestLoginOtp(payload) {
  return apiRequest('/auth/login/request-otp', { method: 'POST', body: payload, skipAuth: true })
}

export function verifyLogin(payload) {
  return apiRequest('/auth/login/verify', { method: 'POST', body: payload, skipAuth: true })
}

export function adminEmailLogin(payload) {
  return apiRequest('/auth/admin/login', { method: 'POST', body: payload, skipAuth: true })
}

export function fetchMe() {
  return apiRequest('/auth/me')
}
