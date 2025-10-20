import { AuthData } from '@renderer/types/electron'

class ElectronAuthStore {
  private static instance: ElectronAuthStore
  private authData: AuthData = { isAuthenticated: false }

  private constructor() {
    this.initializeAuth()
    this.setupEventListeners()
  }

  static getInstance(): ElectronAuthStore {
    if (!ElectronAuthStore.instance) {
      ElectronAuthStore.instance = new ElectronAuthStore()
    }
    return ElectronAuthStore.instance
  }

  private async initializeAuth(): Promise<void> {
    try {
      // Check if we're in Electron environment
      if (!this.isElectron()) {
        console.warn('Not running in Electron environment')
        return
      }

      // Load auth data from secure storage on app start
      const storedAuth = await this.getStoredAuth()
      if (storedAuth) {
        this.authData = storedAuth
      }
    } catch (error) {
      console.error('Failed to initialize auth:', error)
    }
  }

  private setupEventListeners(): void {
    if (!this.isElectron() || !window.electronAPI?.events) {
      return
    }

    // Listen for auth required events from main process
    window.electronAPI.events.onRedirectToLogin(() => {
      this.handleAuthRequired()
    })

    // Listen for theme changes (example of using electron-toolkit features)
    window.electronAPI.events.onThemeChanged((theme) => {
      console.log('Theme changed to:', theme)
      // Handle theme change if needed
    })
  }

  private handleAuthRequired(): void {
    // Clear auth data and redirect to login
    this.clearAuthData()
    console.log('Authentication required - redirecting to login')
    // You can dispatch events or call callbacks to handle the redirect
  }

  // Store auth data securely
  async setAuthData(data: Partial<AuthData>): Promise<void> {
    try {
      if (!this.isElectron()) {
        throw new Error('Electron API not available')
      }

      this.authData = { ...this.authData, ...data }

      // Store in Electron's secure storage (main process)
      await window.electronAPI!.auth.storeAuthData(this.authData)

      // Also store session cookies if available
      if (data.sessionId) {
        await this.storeSessionCookie(data.sessionId)
      }
    } catch (error) {
      console.error('Failed to store auth data:', error)
      throw error
    }
  }

  async getAuthData(): Promise<AuthData> {
    try {
      if (!this.isElectron()) {
        return { isAuthenticated: false }
      }

      // Always get fresh data from secure storage
      const storedAuth = await this.getStoredAuth()
      if (storedAuth) {
        this.authData = storedAuth
      }
      return this.authData
    } catch (error) {
      console.error('Failed to get auth data:', error)
      return { isAuthenticated: false }
    }
  }

  private async getStoredAuth(): Promise<AuthData | null> {
    try {
      if (!this.isElectron()) {
        return null
      }
      return await window.electronAPI!.auth.getAuthData()
    } catch (error) {
      console.error('Failed to retrieve stored auth:', error)
      return null
    }
  }

  async clearAuthData(): Promise<void> {
    try {
      this.authData = { isAuthenticated: false }

      if (!this.isElectron()) {
        return
      }

      // Clear from secure storage
      await window.electronAPI!.auth.clearAuthData()

      // Clear session cookies
      await this.clearSessionCookies()

      // Clear any other stored data
      await this.clearUserPreferences()
    } catch (error) {
      console.error('Failed to clear auth data:', error)
    }
  }

  // Frappe-specific methods
  async setFrappeAuth(userData: any): Promise<void> {
    await this.setAuthData({
      user: userData.full_name || userData.user || userData.name,
      userData: userData,
      isAuthenticated: userData?.message === 'Logged In' || true
    })
  }

  async getFrappeUser(): Promise<any> {
    const authData = await this.getAuthData()
    return authData.userData
  }

  async isAuthenticated(): Promise<boolean> {
    const authData = await this.getAuthData()
    return authData.isAuthenticated
  }

  // Session cookie management for Frappe
  private async storeSessionCookie(sessionId: string): Promise<void> {
    try {
      if (!this.isElectron()) {
        return
      }

      // Get the API URL from environment or use fallback
      const apiUrl = import.meta.env?.VITE_API_URL || ''
      let domain = 'localhost' // fallback domain

      if (apiUrl) {
        try {
          domain = new URL(apiUrl).hostname
        } catch {
          console.warn('Invalid API URL, using localhost as domain')
        }
      }

      // Store session cookie in Electron's session
      await window.electronAPI!.auth.setSessionCookie({
        name: 'sid',
        value: sessionId,
        domain: domain,
        httpOnly: true,
        secure: apiUrl.startsWith('https')
      })
    } catch (error) {
      console.error('Failed to store session cookie:', error)
    }
  }

  private async clearSessionCookies(): Promise<void> {
    try {
      if (!this.isElectron()) {
        return
      }
      await window.electronAPI!.auth.clearSessionCookies()
    } catch (error) {
      console.error('Failed to clear session cookies:', error)
    }
  }

  private async clearUserPreferences(): Promise<void> {
    try {
      if (!this.isElectron()) {
        return
      }
      await window.electronAPI!.auth.clearUserPreferences()
    } catch (error) {
      console.error('Failed to clear user preferences:', error)
    }
  }

  // User preferences methods
  async setUserPreferences(preferences: any): Promise<void> {
    try {
      if (!this.isElectron()) {
        return
      }
      await window.electronAPI!.auth.storeUserPreferences(preferences)
    } catch (error) {
      console.error('Failed to store user preferences:', error)
      throw error
    }
  }

  async getUserPreferences(): Promise<any> {
    try {
      if (!this.isElectron()) {
        return {}
      }
      return await window.electronAPI!.auth.getUserPreferences()
    } catch (error) {
      console.error('Failed to get user preferences:', error)
      return {}
    }
  }

  // Utility methods
  getUsername(): string | undefined {
    return this.authData.user
  }

  getCsrfToken(): string | undefined {
    return this.authData.csrfToken
  }

  async refreshAuthData(): Promise<void> {
    await this.initializeAuth()
  }

  // Check if running in Electron
  isElectron(): boolean {
    return !!window.electronAPI
  }

  // Get app info
  async getAppVersion(): Promise<string> {
    try {
      if (!this.isElectron()) {
        return 'Unknown'
      }
      return await window.electronAPI!.app.getVersion()
    } catch (error) {
      console.error('Failed to get app version:', error)
      return 'Unknown'
    }
  }

  async getUserDataPath(): Promise<string> {
    try {
      if (!this.isElectron()) {
        return ''
      }
      return await window.electronAPI!.app.getUserDataPath()
    } catch (error) {
      console.error('Failed to get user data path:', error)
      return ''
    }
  }

  // Cleanup method
  destroy(): void {
    if (this.isElectron() && window.electronAPI?.events) {
      window.electronAPI.events.removeAllListeners('redirect-to-login')
      window.electronAPI.events.removeAllListeners('theme-changed')
    }
  }
}

export default ElectronAuthStore
