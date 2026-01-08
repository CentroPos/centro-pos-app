import api from '../services/api'
// Switch to Electron IPC proxy to mirror server.js behavior
import ElectronAuthStore from '@renderer/services/electron-auth-store'

// Frappe login credentials interface
interface LoginCredentials {
  username: string
  password: string
}

interface FrappeLoginResponse {
  message: string // "Logged In"
  home_page?: string
  full_name?: string
}

interface SessionResponse {
  message: string
  full_name: string
  user_id?: string
}

const authStore = ElectronAuthStore.getInstance()


export const authAPI = {
  login: async (credentials: LoginCredentials): Promise<FrappeLoginResponse> => {
    try {
      console.log('🔐 Starting login process (local server)...')

      // Proxy login through Electron main (captures Set-Cookie/CSRF)
      const response = await window.electronAPI?.proxy?.login({
        username: credentials.username,
        password: credentials.password
      })
      
      console.log('✅ Login Response:', response?.data)
      
      // Local server returns cookies and csrfToken in JSON
      const setCookieHeader = response?.cookies
      const csrfFromLocal = response?.csrfToken
      
      // Check all response headers for session info
      console.log('📋 All response headers:')
      // headers are not directly available from IPC result
      
      const data = response?.data

      // Store auth data
      await authStore.setFrappeAuth(data)
      console.log('💾 Auth data stored')
      
      // Extract CSRF token from response headers
      const csrfToken = csrfFromLocal
      if (csrfToken) {
        await authStore.setAuthData({ csrfToken })
        console.log('🔑 CSRF token stored:', csrfToken)
      } else {
        console.log('⚠️ No CSRF token found from local server')
      }
      
      // Check if we have session cookies
      if (typeof setCookieHeader === 'string') {
        // Try to extract sid value from the combined cookie string
        const match = /sid=([^;\s]+)/.exec(setCookieHeader)
        const sessionId = match?.[1]
        if (sessionId) {
          await authStore.setAuthData({ sessionId })
          console.log('🆔 Session ID extracted from local cookies:', sessionId)
        }
      }
      
      // Test session establishment
      try {
        console.log('🧪 Testing session establishment via proxy...')
        const testResponse = await window.electronAPI?.proxy?.session()
        console.log('✅ Session test (proxy) successful:', testResponse)
      } catch (e) {
        console.log('❌ Session test (proxy) failed:', e)
      }

      return data
    } catch (error) {
      console.error('❌ Login error:', error)
      throw error
    }
  },

  // ✅ Add this function
  getCurrentUser: async (): Promise<SessionResponse> => {
    try {
      // Use local session endpoint which already carries ERP cookies
      const response = await window.electronAPI?.proxy?.session()
      return response
    } catch (error) {
      console.error('Session validation error:', error)
      throw error
    }
  },

  // Alternative authentication using API key
  loginWithApiKey: async (credentials: LoginCredentials): Promise<FrappeLoginResponse> => {
    try {
      console.log('🔑 Trying API key authentication...')
      
      // First, try to get an API key
      const formData = new URLSearchParams()
      formData.append('usr', credentials.username)
      formData.append('pwd', credentials.password)
      
      const response = await api.post('method/frappe.auth.get_api_key', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest'
        }
      })
      
      if (response.data && response.data.message) {
        const apiKey = response.data.message
        console.log('✅ API key obtained:', apiKey)
        
        // Store user info along with apiKey nested under userData
        await authStore.setAuthData({ 
          userData: { 
            message: 'Logged In', 
            full_name: credentials.username,
            apiKey
          }
        })
        
        return { 
          message: 'Logged In', 
          full_name: credentials.username 
        }
      }
      
      throw new Error('No API key received')
    } catch (error) {
      console.error('API key login failed:', error)
      throw error
    }
  }
}

export type { LoginCredentials, FrappeLoginResponse }
