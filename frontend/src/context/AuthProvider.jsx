import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchMe } from '../api/authApi.js'
import { clearSession, setLoading, setUser } from '../store/slices/authSlice.js'

export function AuthProvider({ children }) {
  const dispatch = useDispatch()
  const token = useSelector((s) => s.auth.token)

  useEffect(() => {
    let cancelled = false

    if (!token) {
      queueMicrotask(() => {
        if (!cancelled) {
          dispatch(setUser(null))
          dispatch(setLoading(false))
        }
      })
      return () => {
        cancelled = true
      }
    }

    queueMicrotask(() => {
      if (!cancelled) dispatch(setLoading(true))
    })

    fetchMe()
      .then((res) => {
        if (!cancelled) dispatch(setUser(res.data?.user ?? null))
      })
      .catch(() => {
        if (!cancelled) dispatch(clearSession())
      })
      .finally(() => {
        if (!cancelled) dispatch(setLoading(false))
      })

    return () => {
      cancelled = true
    }
  }, [token, dispatch])

  return children
}
