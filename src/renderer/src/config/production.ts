// Production configuration
export const PRODUCTION_CONFIG = {
  API_BASE_URL: 'http://172.104.140.136',
  TIMEOUT: 10000,
  RETRY_ATTEMPTS: 3
}

export const BASE_URL_STORAGE_KEY = 'centro-pos-api-base-url'

const sanitizeUrl = (url: string | null | undefined) => {
  if (!url) {
    return PRODUCTION_CONFIG.API_BASE_URL
  }

  let sanitized = url.trim()

  if (!sanitized) {
    return PRODUCTION_CONFIG.API_BASE_URL
  }

  if (!/^https?:\/\//i.test(sanitized)) {
    sanitized = `http://${sanitized}`
  }

  sanitized = sanitized.replace(/\s+/g, '')
  sanitized = sanitized.replace(/\/+$/, '')

  return sanitized
}

// Environment detection
export const isProduction = () => {
  return (
    process.env.NODE_ENV === 'production' ||
    import.meta.env.PROD ||
    !import.meta.env.DEV
  )
}

// Get API base URL based on environment, allowing persisted override
export const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const storedBaseUrl = window.localStorage.getItem(BASE_URL_STORAGE_KEY)
    if (storedBaseUrl) {
      return sanitizeUrl(storedBaseUrl)
    }
  }

  if (isProduction()) {
    return sanitizeUrl(PRODUCTION_CONFIG.API_BASE_URL)
  }

  // In development, use the proxy (same-origin)
  return '/api'
}

export const sanitizeBaseUrl = (url: string) => sanitizeUrl(url)


