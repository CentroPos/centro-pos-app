// hooks/useAuth.ts
import { useState, useEffect, useCallback } from 'react'
import ElectronAuthStore from '@renderer/services/electron-auth-store'
import type { AuthData } from '@renderer/types/electron'
import { useRouter } from '@tanstack/react-router'

interface UseAuthReturn {
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  authData: AuthData | null
  login: (userData: any) => Promise<void>
  logout: () => Promise<void>
  refreshAuth: () => Promise<void>
}

export function useAuth(): UseAuthReturn {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [authData, setAuthData] = useState<AuthData | null>(null)

  const authStore = ElectronAuthStore.getInstance()

  const checkAuth = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const authenticated = await authStore.isAuthenticated()
      const data = authenticated ? await authStore.getAuthData() : null

      setIsAuthenticated(authenticated)
      setAuthData(data)
    } catch (err) {
      console.error('Auth check failed:', err)
      setError(err instanceof Error ? err.message : 'Authentication check failed')
      setIsAuthenticated(false)
      setAuthData(null)
    } finally {
      setIsLoading(false)
    }
  }, [authStore])

  const login = useCallback(
    async (userData: any) => {
      try {
        setIsLoading(true)
        setError(null)

        await authStore.setFrappeAuth(userData)
        await checkAuth() // Refresh auth state
        router.navigate({ to: '/pos', replace: true }) // Redirect to POS page
      } catch (err) {
        console.error('Login failed:', err)
        setError(err instanceof Error ? err.message : 'Login failed')
        throw err
      }
    },
    [authStore, checkAuth, router]
  )

  const logout = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      await authStore.clearAuthData()
      setIsAuthenticated(false)
      setAuthData(null)
      router.navigate({ to: '/', replace: true }) // Redirect to login page
    } catch (err) {
      console.error('Logout failed:', err)
      setError(err instanceof Error ? err.message : 'Logout failed')
    } finally {
      setIsLoading(false)
    }
  }, [authStore, router])

  const refreshAuth = useCallback(async () => {
    await checkAuth()
  }, [checkAuth])

  // Initialize auth on mount
  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  // Listen for auth changes from main process (if using Electron events)
  useEffect(() => {
    if (!authStore.isElectron()) return

    const handleAuthRequired = () => {
      setIsAuthenticated(false)
      setAuthData(null)
    }

    // Assuming you have an event listener setup
    // This would depend on your specific implementation
    if (window.electronAPI?.events?.onRedirectToLogin) {
      window.electronAPI.events.onRedirectToLogin(handleAuthRequired)
    }

    return () => {
      if (window.electronAPI?.events?.removeAllListeners) {
        window.electronAPI.events.removeAllListeners('redirect-to-login')
      }
    }
  }, [authStore])

  return {
    isAuthenticated,
    isLoading,
    error,
    authData,
    login,
    logout,
    refreshAuth
  }
}

// Alternative: Simplified version for just authentication check
export function useAuthCheck() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authStore = ElectronAuthStore.getInstance()
        const authenticated = await authStore.isAuthenticated()
        setIsAuthenticated(authenticated)
      } catch (error) {
        console.error('Auth check failed:', error)
        setIsAuthenticated(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [])

  return { isAuthenticated, isLoading }
}
