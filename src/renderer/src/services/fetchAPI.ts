import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { toast } from 'sonner'
import ElectronAuthStore from './electron-auth-store'
import { getApiBaseUrl } from '@renderer/config/production'

let API_BASE_URL = getApiBaseUrl()

// Create axios instance
// Ensure baseURL includes /api if it doesn't already
const getBaseUrl = () => {
  const base = API_BASE_URL
  // If baseURL doesn't end with /api, add it
  if (!base.endsWith('/api') && !base.endsWith('/api/')) {
    return base.endsWith('/') ? `${base}api` : `${base}/api`
  }
  return base
}

const api: AxiosInstance = axios.create({
  baseURL: getBaseUrl(),
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true
})

export const setFetchApiBaseUrl = (baseUrl: string) => {
  API_BASE_URL = baseUrl
  // Ensure baseURL includes /api if it doesn't already
  const normalizedBaseUrl = (() => {
    if (!baseUrl.endsWith('/api') && !baseUrl.endsWith('/api/')) {
      return baseUrl.endsWith('/') ? `${baseUrl}api` : `${baseUrl}/api`
    }
    return baseUrl
  })()
  api.defaults.baseURL = normalizedBaseUrl
}

export const getFetchApiBaseUrl = () => API_BASE_URL

// FormData conversion utility
function jsonToFormData(
  json: any,
  formData: FormData = new FormData(),
  parentKey: string | null = null
): FormData {
  if (json && typeof json === 'object' && !(json instanceof File)) {
    Object.keys(json).forEach((key) => {
      const value = json[key]
      const newKey = parentKey ? `${parentKey}` : key
      jsonToFormData(value, formData, newKey)
    })
  } else {
    if (parentKey !== null) {
      formData.append(parentKey, json)
    }
  }
  return formData
}

// Request interceptor for dynamic content-type handling and session management
api.interceptors.request.use(async (config) => {
  // If data is FormData, remove Content-Type header to let browser set it with boundary
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
  
  // Add session ID and CSRF token if available
  try {
    const authStore = ElectronAuthStore.getInstance()
    const authData = await authStore.getAuthData()
    
    // Add CSRF token if available
    if (authData.csrfToken) {
      config.headers = config.headers || {}
      config.headers['X-Frappe-CSRF-Token'] = authData.csrfToken
    }
    
    // Note: Don't manually set Cookie header as it's blocked by browser security
    // Session will be handled by the backend through other means
    
    // Add X-Requested-With header for Frappe
    config.headers = config.headers || {}
    config.headers['X-Requested-With'] = 'XMLHttpRequest'
  } catch (e) {
    console.warn('Request interceptor error in fetchAPI:', e)
  }
  
  return config
})

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response
  },
  async (error) => {
    const authStore = ElectronAuthStore.getInstance()
    // Handle network errors
    if (!error.response) {
      console.error('Network request failed:', error)
      toast.error('Network error. Please check your connection.')
      return Promise.reject(error)
    }

    const { status, data } = error.response

    // Handle 401 unauthorized
    if (status === 401) {
      toast.error(data?.error || 'Unauthorized. Please login again.')
      // Use ElectronStorage instead of localStorage for consistency
      await authStore.clearAuthData()

      // Redirect to login or emit auth-required event
    }

    // Handle session expiry
    if (data?.error === 'Session expired. Please login again.') {
      toast.error('Session expired. Please login again.')
      setTimeout(() => authStore.clearAuthData(), 5000)
    }

    // Handle 404 and 403 errors gracefully - don't log as critical errors for get_pos_profile
    // This prevents React error boundary from catching and causing hook inconsistencies
    if (error?.response?.status === 404 || error?.response?.status === 403) {
      const url = error?.config?.url || ''
      if (url.includes('get_pos_profile')) {
        // Silently handle 404/403 for POS profile - it's optional
        const status = error?.response?.status === 403 ? '403 (Forbidden)' : '404 (Not Found)'
        console.warn(`⚠️ POS profile endpoint ${status}:`, url)
        // Return a resolved promise with empty data instead of rejecting
        // This prevents the error from propagating to React's error boundary
        return Promise.resolve({ data: { data: null }, success: false })
      }
    }

    console.error('API request failed:', error)
    return Promise.reject(error)
  }
)

// Extended request configuration interface
export interface IRequestConfig extends AxiosRequestConfig {
  QParams?: any
  next?: any
  isList?: boolean
}

// Wrapper function to maintain compatibility with your existing sendRequest API
export async function sendRequest(
  url: string,
  method: string,
  data: any,
  config?: IRequestConfig,
  isFormData?: boolean,
  baseUrl?: string
): Promise<any> {
  try {
    const requestConfig: AxiosRequestConfig = {
      ...config,
      method: method as any,
      url: baseUrl ? `${baseUrl}${url}` : url, // Allow baseUrl override
      headers: {
        Accept: 'application/json',
        ...(config?.headers || {})
      }
    }

    // Handle form data
    if (data) {
      if (isFormData) {
        requestConfig.data = jsonToFormData(data)
        // Remove Content-Type to let browser set multipart boundary

        if (requestConfig.headers) {
          delete requestConfig.headers['Content-Type']
        }
      } else {
        requestConfig.data = data
      }
    }

    const response: AxiosResponse = await api(requestConfig)
    return response.data
  } catch (error: any) {
    // Error is already handled by interceptor
    throw error.response?.data || error
  }
}

export default api
