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
  getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
  onUpdateChecking: (callback: () => void) => {
    ipcRenderer.on('update-checking', callback)
  },
  onUpdateAvailable: (callback: (info: { version: string; releaseDate?: string; releaseNotes?: string }) => void) => {
    ipcRenderer.on('update-available', (_event, info) => callback(info))
  },
  onUpdateNotAvailable: (callback: () => void) => {
    ipcRenderer.on('update-not-available', callback)
  },
  onUpdateError: (callback: (error: { message: string }) => void) => {
    ipcRenderer.on('update-error', (_event, error) => callback(error))
  },
  onUpdateDownloadProgress: (callback: (progress: { percent: number; transferred: number; total: number }) => void) => {
    ipcRenderer.on('update-download-progress', (_event, progress) => callback(progress))
  },
  onUpdateDownloaded: (callback: (info: { version: string; releaseDate?: string; releaseNotes?: string }) => void) => {
    ipcRenderer.on('update-downloaded', (_event, info) => callback(info))
  },
  removeUpdateListeners: () => {
    ipcRenderer.removeAllListeners('update-checking')
    ipcRenderer.removeAllListeners('update-available')
    ipcRenderer.removeAllListeners('update-not-available')
    ipcRenderer.removeAllListeners('update-error')
    ipcRenderer.removeAllListeners('update-download-progress')
    ipcRenderer.removeAllListeners('update-downloaded')
  }
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

// Proxy API mirroring server.js
const proxyAPI = {
  login: (payload: { username: string; password: string }) => ipcRenderer.invoke('proxy-login', payload),
  request: (payload: { method?: string; url: string; params?: Record<string, any>; data?: any }) =>
    ipcRenderer.invoke('proxy-request', payload),
  session: () => ipcRenderer.invoke('proxy-session'),
  logout: () => ipcRenderer.invoke('proxy-logout'),
  setBaseUrl: (baseUrl: string) => ipcRenderer.invoke('set-api-base-url', baseUrl),
  getBaseUrl: () => ipcRenderer.invoke('get-api-base-url')
}

// Print API for Electron native printing
const printAPI = {
  printPDF: (pdfDataUrl: string) => ipcRenderer.invoke('print-pdf', pdfDataUrl),
  printPDFMain: (pdfDataUrl: string) => ipcRenderer.invoke('print-pdf-main', pdfDataUrl)
}

// Combined custom API
const customAPI = {
  auth: authAPI,
  app: appAPI,
  events: eventsAPI,
  log: logAPI,
  proxy: proxyAPI,
  print: printAPI
}

// Type definitions for our custom API
interface CustomElectronAPI {
  auth: typeof authAPI
  app: typeof appAPI
  events: typeof eventsAPI
  log: typeof logAPI
  proxy: typeof proxyAPI
  print: typeof printAPI
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
