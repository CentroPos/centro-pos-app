import { API_Endpoints } from '@renderer/config/endpoints'
import api from '../services/api'
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
      const response = await api.post(API_Endpoints.LOGIN, {
        usr: credentials.username,
        pwd: credentials.password
      })

      // Try to persist Frappe session cookie (sid) in Electron explicitly when available
      try {
        const setCookie = (response as any)?.headers?.['set-cookie'] as string[] | undefined
        console.log('Set-Cookie headers:', setCookie)
        
        const sidCookie = Array.isArray(setCookie)
          ? setCookie.find((c) => c.startsWith('sid='))
          : typeof setCookie === 'string'
          ? setCookie
          : undefined
          
        if (sidCookie) {
          const sidMatch = /sid=([^;]+)/.exec(sidCookie)
          const sid = sidMatch?.[1]
          console.log('Extracted SID:', sid)
          
          if (sid && window.electronAPI?.auth?.setSessionCookie) {
            await window.electronAPI.auth.setSessionCookie({
              name: 'sid',
              value: sid,
              domain: '172.104.140.136',
              httpOnly: true,
              secure: false
            })
            console.log('Session cookie set successfully')
            
            // Also try setting without domain for localhost compatibility
            try {
              await window.electronAPI.auth.setSessionCookie({
                name: 'sid',
                value: sid,
                domain: 'localhost',
                httpOnly: true,
                secure: false
              })
              console.log('Session cookie also set for localhost')
            } catch (e) {
              console.warn('Could not set cookie for localhost:', e)
            }
          }
        } else {
          console.warn('No SID cookie found in response headers')
        }
      } catch (e) {
        // Non-fatal; continue
        console.warn('Could not persist session cookie explicitly:', e)
      }

      // Capture CSRF token header (Frappe sends X-Frappe-CSRF-Token)
      try {
        const csrfToken = (response as any)?.headers?.['x-frappe-csrf-token']
        if (csrfToken) {
          await authStore.setAuthData({ csrfToken })
        }
      } catch (e) {
        console.warn('Could not persist CSRF token:', e)
      }

      // Response example:
      // { message: 'Logged In', home_page: '/app/home', full_name: 'Test User' }
      await authStore.setFrappeAuth(response.data)

      // ✅ Add this logging to see the response
      console.log('Login Response:', response.data)
      console.log('Session ID:', response.data.session_id)

      // Store the session ID for manual cookie setting
      if (response.data.session_id) {
        await authStore.setAuthData({ sessionId: response.data.session_id })
      }

      return response.data
    } catch (error) {
      console.error('Login error:', error)
      throw error
    }
  },

  // ✅ Add this function
  getCurrentUser: async (): Promise<SessionResponse> => {
    try {
      const response = await api.get('/frappe.auth.get_logged_user')
      return response.data
    } catch (error) {
      console.error('Session validation error:', error)
      throw error
    }
  }
}

export type { LoginCredentials, FrappeLoginResponse }
