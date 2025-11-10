import { ElectronAPI } from '@electron-toolkit/preload'

interface CustomElectronAPI {
  auth: {
    storeAuthData: (data: any) => Promise<boolean>
    getAuthData: () => Promise<any>
    clearAuthData: () => Promise<boolean>
    setSessionCookie: (cookieDetails: {
      name: string
      value: string
      domain: string
      httpOnly?: boolean
      secure?: boolean
    }) => Promise<boolean>
    clearSessionCookies: () => Promise<boolean>
    storeUserPreferences: (preferences: any) => Promise<boolean>
    getUserPreferences: () => Promise<any>
    clearUserPreferences: () => Promise<boolean>
  }
  proxy: {
    login: (payload: { username: string; password: string }) => Promise<any>
    request: (payload: { method?: string; url: string; params?: Record<string, any>; data?: any }) => Promise<any>
    session: () => Promise<any>
    logout: () => Promise<any>
    setBaseUrl: (baseUrl: string) => Promise<any>
    getBaseUrl: () => Promise<string>
  }
  app: {
    getVersion: () => Promise<string>
    getUserDataPath: () => Promise<string>
  }
  events: {
    onRedirectToLogin: (callback: () => void) => void
    removeAllListeners: (channel: string) => void
    onThemeChanged: (callback: (theme: string) => void) => void
  }
  print: {
    printPDF: (pdfDataUrl: string) => Promise<{ success: boolean; error?: string }>
    printPDFMain: (pdfDataUrl: string) => Promise<{ success: boolean; error?: string }>
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    electronAPI?: CustomElectronAPI // Your custom API

  }
}
