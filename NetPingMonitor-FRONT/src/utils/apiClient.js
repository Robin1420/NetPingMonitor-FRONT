const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1'
).replace(/\/$/, '')

const getAuthToken = () =>
  localStorage.getItem('access_token') ||
  sessionStorage.getItem('access_token') ||
  ''

const getRefreshToken = () =>
  localStorage.getItem('refresh_token') ||
  sessionStorage.getItem('refresh_token') ||
  ''

const getTokenStorage = () => {
  if (localStorage.getItem('refresh_token')) return localStorage
  if (sessionStorage.getItem('refresh_token')) return sessionStorage
  if (localStorage.getItem('access_token')) return localStorage
  if (sessionStorage.getItem('access_token')) return sessionStorage
  return null
}

const setAccessToken = (token) => {
  if (!token) return
  const storage = getTokenStorage()
  if (storage) {
    storage.setItem('access_token', token)
  }
}

const clearAuthTokens = () => {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  sessionStorage.removeItem('access_token')
  sessionStorage.removeItem('refresh_token')
}

let refreshPromise = null

const refreshAccessToken = async () => {
  if (refreshPromise) return refreshPromise
  const refreshToken = getRefreshToken()
  if (!refreshToken) return null

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh: refreshToken }),
      })
      if (!response.ok) return null
      const payload = await response.json().catch(() => ({}))
      if (!payload?.access) return null
      setAccessToken(payload.access)
      return payload.access
    } catch (err) {
      return null
    }
  })()

  try {
    return await refreshPromise
  } finally {
    refreshPromise = null
  }
}

const apiFetch = async (url, options = {}) => {
  const token = getAuthToken()
  const headers = new Headers(options.headers || {})
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  const response = await fetch(url, { ...options, headers })
  if (response.status !== 401) return response

  const newAccess = await refreshAccessToken()
  if (!newAccess) {
    clearAuthTokens()
    return response
  }

  const retryHeaders = new Headers(options.headers || {})
  retryHeaders.set('Authorization', `Bearer ${newAccess}`)
  return fetch(url, { ...options, headers: retryHeaders })
}

export { API_BASE_URL, apiFetch, clearAuthTokens, getAuthToken }
