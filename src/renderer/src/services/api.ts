import axios, { AxiosInstance } from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://172.104.140.136'

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

// Request interceptor: attach CSRF token if available (helps avoid 417)
api.interceptors.request.use(async (config) => {
  try {
    // Lazy import to avoid circular
    const ElectronAuthStore = (await import('@renderer/services/electron-auth-store')).default
    const store = ElectronAuthStore.getInstance()
    const csrf = store.getCsrfToken?.()
    if (csrf) {
      config.headers = config.headers || {}
      config.headers['X-Frappe-CSRF-Token'] = csrf
    }
    
    // Debug: log request details
    console.log('API Request:', {
      url: config.url,
      method: config.method,
      headers: config.headers,
      withCredentials: config.withCredentials
    })
  } catch (e) {
    console.warn('Request interceptor error:', e)
  }
  return config
})

export default api
