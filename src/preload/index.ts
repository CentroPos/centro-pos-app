import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
// Custom Auth API
const authAPI = {
  storeAuthData: (data: any) => ipcRenderer.invoke('store-auth-data', data),
  getAuthData: () => ipcRenderer.invoke('get-auth-data'),
  clearAuthData: () => ipcRenderer.invoke('clear-auth-data'),
  setSessionCookie: (cookieDetails: any) => ipcRenderer.invoke('set-session-cookie', cookieDetails),
  clearSessionCookies: () => ipcRenderer.invoke('clear-session-cookies'),
  storeUserPreferences: (preferences: any) =>
    ipcRenderer.invoke('store-user-preferences', preferences),
  getUserPreferences: () => ipcRenderer.invoke('get-user-preferences'),
  clearUserPreferences: () => ipcRenderer.invoke('clear-user-preferences')
}

// App utility API
const appAPI = {
  getVersion: () => ipcRenderer.invoke('get-app-version'),
  getUserDataPath: () => ipcRenderer.invoke('get-user-data-path')
}

// Event listeners API
const eventsAPI = {
  onRedirectToLogin: (callback: () => void) => {
    ipcRenderer.on('redirect-to-login', callback)
  },
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel)
  },
  // Add more event listeners as needed
  onThemeChanged: (callback: (theme: string) => void) => {
    ipcRenderer.on('theme-changed', (_event, theme) => callback(theme))
  }
}

// Logger API
const logAPI = {
  logError: (payload: any) => ipcRenderer.send('renderer-log-error', payload)
}

// Combined custom API
const customAPI = {
  auth: authAPI,
  app: appAPI,
  events: eventsAPI,
  log: logAPI
}

// Type definitions for our custom API
interface CustomElectronAPI {
  auth: typeof authAPI
  app: typeof appAPI
  events: typeof eventsAPI
  log: typeof logAPI
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('electronAPI', customAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.electronAPI = customAPI
}

export type { CustomElectronAPI }
