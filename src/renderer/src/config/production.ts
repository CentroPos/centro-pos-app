// Production configuration
export const PRODUCTION_CONFIG = {
  API_BASE_URL: 'http://172.104.140.136',
  TIMEOUT: 10000,
  RETRY_ATTEMPTS: 3
}

// Environment detection
export const isProduction = () => {
  return process.env.NODE_ENV === 'production' || 
         import.meta.env.PROD ||
         !import.meta.env.DEV
}

// Get API base URL based on environment
export const getApiBaseUrl = () => {
  if (isProduction()) {
    return PRODUCTION_CONFIG.API_BASE_URL
  }
  // In development, use the proxy (same-origin)
  return '/api'
}


