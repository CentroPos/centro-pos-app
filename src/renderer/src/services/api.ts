import axios, { AxiosInstance } from 'axios'
import { getApiBaseUrl } from '@renderer/config/production'

const API_BASE_URL = getApiBaseUrl()

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'
  },
  withCredentials: true
})

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    if (error.response?.status === 401) {
      // Clear auth data on unauthorized
      localStorage.removeItem('userData')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Request interceptor: attach CSRF token and session ID if available
api.interceptors.request.use(async (config) => {
  try {
    // Skip interceptor for login to avoid issues
    if (config.url?.includes('/login')) {
      console.log('API Request (login):', {
        url: config.url,
        method: config.method,
        headers: config.headers,
        withCredentials: config.withCredentials
      })
      return config
    }
    
    // Lazy import to avoid circular
    const ElectronAuthStore = (await import('@renderer/services/electron-auth-store')).default
    const store = ElectronAuthStore.getInstance()
    const authData = await store.getAuthData()
    
    // Add CSRF token if available
    if (authData.csrfToken) {
      config.headers = config.headers || {}
      config.headers['X-Frappe-CSRF-Token'] = authData.csrfToken
    }
    
    // Note: Don't manually set Cookie header as it's blocked by browser security
    // Session will be handled by the backend through other means
    
    // Debug: log request details
    console.log('API Request:', {
      url: config.url,
      method: config.method,
      headers: config.headers,
      withCredentials: config.withCredentials,
      sessionId: authData.sessionId ? 'present' : 'missing'
    })
  } catch (e) {
    console.warn('Request interceptor error:', e)
  }
  return config
})

export default api
