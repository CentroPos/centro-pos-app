
import { create } from 'zustand'
import { authAPI, LoginCredentials, FrappeLoginResponse } from '../api/auth'

interface User {
  id: string | null
  name: string
  email: string
  role: string
}

interface AuthStore {
  // State
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  // Actions
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => void
  clearError: () => void
  setLoading: (loading: boolean) => void
  validateSession: () => Promise<boolean> // ✅ Add this
}

export const useAuthStore = create<AuthStore>()(
  // Remove persist wrapper completely - no persistence at all
  (set) => {
    // Initialize from localStorage if available
    const initializeFromStorage = () => {
      try {
        const storedUserData = localStorage.getItem('userData')
        if (storedUserData) {
          const userData = JSON.parse(storedUserData)
          console.log('Initializing auth store from localStorage:', userData)
          return {
            user: userData,
            token: null,
            isAuthenticated: true,
            isLoading: false,
            error: null
          }
        }
      } catch (error) {
        console.error('Error initializing from localStorage:', error)
      }
      return {
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null
      }
    }

    return {
      ...initializeFromStorage(),

      validateSession: async () => {
        try {
          // First check if we have stored user data
          const storedUserData = localStorage.getItem('userData')
          if (storedUserData) {
            console.log('Found stored user data, session is valid')
            const userData = JSON.parse(storedUserData)
            set({
              user: userData,
              isAuthenticated: true,
              error: null
            })
            return true
          }

          // If no stored data, try to validate with server
          const response = await authAPI.getCurrentUser()

          if (response && response.message === 'Logged In') {
            // Session is valid, update user data
            const userData = {
              id: 'administrator',
              name: response.full_name || 'Administrator',
              email: 'administrator',
              role: 'Administrator'
            }

            // Store the user data for future use
            localStorage.setItem('userData', JSON.stringify(userData))

            set({
              user: userData,
              isAuthenticated: true,
              error: null
            })

            return true
          } else {
            // Session invalid
            console.log('Session validation failed - invalid response')
            return false
          }
        } catch (error) {
          // Session expired or invalid
          console.log('Session validation failed:', error)
          return false
        }
      },

      login: async (credentials: LoginCredentials) => {
        console.log('=== useAuthStore.login() called ===')
        set({ isLoading: true, error: null })

        try {
          console.log('1. Calling authAPI.login...')
          const response: FrappeLoginResponse = await authAPI.login(credentials)
          console.log('2. AuthAPI response:', response)

          if (response.message === 'Logged In') {
            const userData = {
              id: 'administrator',
              name: response.full_name || 'Administrator',
              email: 'administrator',
              role: 'Administrator'
            }

            console.log('3. Setting userData:', userData)
            localStorage.setItem('userData', JSON.stringify(userData))

            set({
              user: userData,
              token: null,
              isAuthenticated: true,
              isLoading: false,
              error: null
            })
            console.log('4. Store updated, isAuthenticated set to true')
          } else {
            console.log('5. Login failed - invalid response')
            throw new Error('Login failed')
          }
        } catch (error: any) {
          let errorMessage = 'Login failed. Please try again.'

          if (error.response?.data?.exc_type === 'AuthenticationError') {
            errorMessage = 'Invalid username or password'
          } else if (error.response?.data?.message) {
            errorMessage = error.response.data.message
          } else if (error.message === 'Network Error') {
            errorMessage = 'Network error. Please check your connection.'
          }

          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: errorMessage
          })
          throw error
        }
      },

      // Logout action
      logout: () => {
        console.log('=== useAuthStore.logout() called ===')
        // Clear stored data
        localStorage.removeItem('userData')
        console.log('localStorage cleared')

        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          error: null
        })
        console.log('Store state cleared, isAuthenticated set to false')
      },

      // Clear error
      clearError: () => set({ error: null }),

      // Set loading state
      setLoading: (loading: boolean) => set({ isLoading: loading })
    }
  }
)

export default useAuthStore
