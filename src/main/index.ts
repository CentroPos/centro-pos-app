import { app, shell, BrowserWindow, ipcMain, session, safeStorage } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import * as fs from 'fs/promises'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import icon from '../../resources/icon.png?asset'

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Auth storage paths
const AUTH_FILE_NAME = 'auth.encrypted'
const PREFS_FILE_NAME = 'user-prefs.json'

const getStoragePath = () => {
  return path.join(app.getPath('userData'), AUTH_FILE_NAME)
}

const getPrefsPath = () => {
  return path.join(app.getPath('userData'), PREFS_FILE_NAME)
}

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      devTools: true,
      sandbox: false,
      webSecurity: false,
      nodeIntegration: false,
      contextIsolation: true,
      allowRunningInsecureContent: true
    }
  })

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    console.log('Response Headers:', details.responseHeaders)
    callback({ cancel: false, responseHeaders: details.responseHeaders })
  })

  // Keep DevTools enabled via shortcuts in development, but do not auto-open

  // Completely disable CSP
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders }
    delete responseHeaders['content-security-policy']
    delete responseHeaders['Content-Security-Policy']
    callback({
      responseHeaders
    })
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Store reference to main window for auth handlers
  global.mainWindow = mainWindow
}

// Auth IPC Handlers
function setupAuthHandlers(): void {
  // In-memory session data (mirrors server.js behavior)
  let proxySessionData: { cookies: string; csrfToken: string; isLoggedIn: boolean } = {
    cookies: '',
    csrfToken: '',
    isLoggedIn: false
  }

  const DEFAULT_API_BASE_URL = 'http://172.104.140.136'
  let apiBaseUrl = DEFAULT_API_BASE_URL

  const sanitizeBaseUrl = (url: string | null | undefined) => {
    if (!url) {
      return DEFAULT_API_BASE_URL
    }

    let sanitized = url.trim()

    if (!sanitized) {
      return DEFAULT_API_BASE_URL
    }

    if (!/^https?:\/\//i.test(sanitized)) {
      sanitized = `http://${sanitized}`
    }

    sanitized = sanitized.replace(/\s+/g, '')
    sanitized = sanitized.replace(/\/+$/, '')

    return sanitized
  }

  const readPreferences = async (): Promise<Record<string, any>> => {
    try {
      const data = await fs.readFile(getPrefsPath(), 'utf8')
      return JSON.parse(data)
    } catch {
      return {}
    }
  }

  const writePreferences = async (preferences: Record<string, any>) => {
    await fs.writeFile(getPrefsPath(), JSON.stringify(preferences, null, 2))
  }

  const setAndPersistBaseUrl = async (nextBaseUrl: string) => {
    apiBaseUrl = sanitizeBaseUrl(nextBaseUrl)
    const prefs = await readPreferences()
    await writePreferences({ ...prefs, apiBaseUrl })
  }

  ;(async () => {
    const prefs = await readPreferences()
    if (prefs.apiBaseUrl) {
      apiBaseUrl = sanitizeBaseUrl(prefs.apiBaseUrl)
    }
  })().catch((error) => {
    console.warn('Failed to load persisted base URL, using default', error)
  })

  // Store auth data securely
  ipcMain.handle('store-auth-data', async (_event, authData) => {
    try {
      if (!safeStorage.isEncryptionAvailable()) {
        console.warn('Encryption not available, storing in plain text')
        // Fallback to regular file storage
        await fs.writeFile(getStoragePath(), JSON.stringify(authData))
        return true
      }

      const dataString = JSON.stringify(authData)
      const encryptedData = safeStorage.encryptString(dataString)

      await fs.writeFile(getStoragePath(), encryptedData)
      console.log('Auth data stored securely')
      return true
    } catch (error) {
      console.error('Failed to store auth data:', error)
      throw error
    }
  })

  // Retrieve auth data
  ipcMain.handle('get-auth-data', async () => {
    try {
      const filePath = getStoragePath()

      // Check if file exists
      try {
        await fs.access(filePath)
      } catch {
        return null // File doesn't exist
      }

      const data = await fs.readFile(filePath)

      if (!safeStorage.isEncryptionAvailable()) {
        // Plain text fallback
        return JSON.parse(data.toString())
      }

      const decryptedString = safeStorage.decryptString(data)
      return JSON.parse(decryptedString)
    } catch (error) {
      console.error('Failed to retrieve auth data:', error)
      return null
    }
  })

  // Clear auth data
  ipcMain.handle('clear-auth-data', async () => {
    try {
      const filePath = getStoragePath()

      try {
        await fs.unlink(filePath)
        console.log('Auth data cleared')
      } catch (error) {
        console.log('Auth file already deleted or does not exist', error)
      }

      return true
    } catch (error) {
      console.error('Failed to clear auth data:', error)
      throw error
    }
  })

  ipcMain.handle('set-api-base-url', async (_event, baseUrl: string) => {
    await setAndPersistBaseUrl(baseUrl)
    return { success: true, baseUrl: apiBaseUrl }
  })

  ipcMain.handle('get-api-base-url', async () => {
    return apiBaseUrl
  })

  // Proxy: login via ERP, capture cookies and CSRF header
  ipcMain.handle('proxy-login', async (_event, payload: { username: string; password: string }) => {
    try {
      const loginUrl = `${apiBaseUrl}/api/method/login`
      const body = new URLSearchParams()
      body.append('usr', payload.username)
      body.append('pwd', payload.password)

      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body
      } as any)

      // Collect set-cookie headers (multiple)
      let rawSetCookie: string[] | undefined
      const headersAny = response.headers as any
      if (typeof headersAny.raw === 'function') {
        rawSetCookie = headersAny.raw()['set-cookie']
      } else {
        const single = response.headers.get('set-cookie')
        rawSetCookie = single ? [single] : []
      }

      if (rawSetCookie && rawSetCookie.length > 0) {
        proxySessionData.cookies = rawSetCookie.join('; ')
      }

      const csrfToken = response.headers.get('x-frappe-csrf-token') || ''
      if (csrfToken) proxySessionData.csrfToken = csrfToken

      const data = await response.json()
      proxySessionData.isLoggedIn = response.ok

      return {
        success: response.ok,
        status: response.status,
        data,
        cookies: proxySessionData.cookies,
        csrfToken: proxySessionData.csrfToken
      }
    } catch (error: any) {
      return { success: false, status: 500, error: error?.message }
    }
  })

  // Proxy: generic request using stored cookies/CSRF
  ipcMain.handle(
    'proxy-request',
    async (
      _event,
      payload: { method?: string; url: string; params?: Record<string, any>; data?: any }
    ) => {
      try {
        const url = new URL(`${apiBaseUrl}${payload.url.startsWith('/') ? '' : '/'}${payload.url}`)
        if (payload.params) {
          Object.entries(payload.params).forEach(([k, v]) => url.searchParams.append(k, String(v)))
        }

        const isForm = typeof payload.data === 'object' && payload.data && payload.data.__form === true
        const headers: Record<string, string> = {
          'X-Requested-With': 'XMLHttpRequest'
        }
        if (proxySessionData.cookies) headers['Cookie'] = proxySessionData.cookies
        if (proxySessionData.csrfToken) headers['X-Frappe-CSRF-Token'] = proxySessionData.csrfToken
        if (!isForm) headers['Content-Type'] = 'application/json'

        const response = await fetch(url.toString(), {
          method: (payload.method || 'GET') as any,
          headers,
          body:
            payload.data && !isForm
              ? JSON.stringify(payload.data)
              : undefined
        } as any)

        // Update cookies and CSRF if present
        const headersAny = response.headers as any
        let rawSetCookie: string[] | undefined
        if (typeof headersAny.raw === 'function') {
          rawSetCookie = headersAny.raw()['set-cookie']
        } else {
          const single = response.headers.get('set-cookie')
          rawSetCookie = single ? [single] : []
        }
        if (rawSetCookie && rawSetCookie.length > 0) {
          proxySessionData.cookies = rawSetCookie.join('; ')
        }
        const csrfToken = response.headers.get('x-frappe-csrf-token') || ''
        if (csrfToken) proxySessionData.csrfToken = csrfToken

        // Check if response is PDF or binary content
        const contentType = response.headers.get('content-type') || ''
        const isPdf = contentType.includes('application/pdf') || 
                     payload.url.includes('create_order') ||
                     contentType.includes('application/octet-stream') ||
                     contentType === ''
        
        let data = {}
        let pdfData: string | null = null
        
        if (isPdf) {
          // Handle PDF response
          try {
            const arrayBuffer = await response.arrayBuffer()
            const uint8Array = new Uint8Array(arrayBuffer)
            
            // Check if it's actually a PDF by looking for PDF header
            const isActualPdf = uint8Array.length > 4 && 
                               uint8Array[0] === 0x25 && // %
                               uint8Array[1] === 0x50 && // P
                               uint8Array[2] === 0x44 && // D
                               uint8Array[3] === 0x46    // F
            
            if (isActualPdf) {
              const base64 = Buffer.from(arrayBuffer).toString('base64')
              pdfData = `data:application/pdf;base64,${base64}`
              data = { pdf_data: base64, pdf_url: pdfData }
              console.log('📄 PDF response detected, converted to base64, size:', arrayBuffer.byteLength)
            } else {
              console.log('📄 Response detected as potential PDF but not valid PDF format')
              // Try to parse as JSON anyway
              const text = new TextDecoder().decode(arrayBuffer)
              try {
                data = JSON.parse(text)
                console.log('📄 Response parsed as JSON instead')
              } catch {
                data = { error: 'Response is not PDF or JSON' }
              }
            }
          } catch (error) {
            console.error('Error processing PDF response:', error)
            data = { error: 'Failed to process PDF response' }
          }
        } else {
          // Handle JSON response
          data = await response.json().catch(() => ({}))
        }
        
        return { success: response.ok, status: response.status, data, pdfData: pdfData || undefined }
      } catch (error: any) {
        return { success: false, status: 500, error: error?.message }
      }
    }
  )

  // Proxy: session state
  ipcMain.handle('proxy-session', async () => {
    return { success: true, sessionData: proxySessionData }
  })

  ipcMain.handle('proxy-logout', async () => {
    proxySessionData = { cookies: '', csrfToken: '', isLoggedIn: false }
    return { success: true }
  })

  // Electron native printing handlers
  ipcMain.handle('print-pdf', async (_event, pdfDataUrl: string) => {
    try {
      console.log('🖨️ Printing PDF from data URL')
      
      // Create a new window for printing
      const printWindow = new BrowserWindow({
        show: true,
        width: 800,
        height: 600,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      })

      // Load the PDF data URL directly
      await printWindow.loadURL(pdfDataUrl)
      console.log('📄 PDF loaded in print window')
      
      // Wait for PDF to fully render
      await new Promise(resolve => setTimeout(resolve, 1000))

      console.log('🖨️ Opening print dialog...')
      
      // Use the correct print approach with callback
      printWindow.webContents.print({
        silent: false,            // false = show dialog
        printBackground: true,    // include background colors/images
        deviceName: ''            // leave blank to let user choose
      }, (success, errorType) => {
        if (!success) {
          console.log('❌ Print failed:', errorType)
        } else {
          console.log('✅ Print job started')
        }
      })
      
      // Close the print window after a delay
      setTimeout(() => {
        if (!printWindow.isDestroyed()) {
          printWindow.close()
        }
      }, 3000)
      
      // Return success immediately - the print dialog should open
      return { success: true }
    } catch (error: any) {
      console.error('❌ Error printing PDF:', error)
      return { success: false, error: error.message }
    }
  })

  // Alternative print method using main window
  ipcMain.handle('print-pdf-main', async (_event, pdfDataUrl: string) => {
    try {
      console.log('🖨️ Printing PDF using main window')
      
      const mainWindow = global.mainWindow
      if (!mainWindow || mainWindow.isDestroyed()) {
        throw new Error('Main window not available')
      }

      // Load the PDF in the main window
      await mainWindow.loadURL(pdfDataUrl)
      
      // Wait for the PDF to load
      await new Promise<void>((resolve) => {
        mainWindow.webContents.once('did-finish-load', () => {
          console.log('📄 PDF loaded in main window')
          resolve()
        })
      })

      // Wait for PDF to fully render
      await new Promise(resolve => setTimeout(resolve, 1000))

      console.log('🖨️ Opening print dialog from main window...')
      
      // Print with dialog using main window
      mainWindow.webContents.print({
        silent: false,            // false = show dialog
        printBackground: true,    // include background colors/images
        deviceName: ''            // leave blank to let user choose
      }, (success, errorType) => {
        if (!success) {
          console.log('❌ Print failed:', errorType)
        } else {
          console.log('✅ Print job started from main window')
        }
      })
      
      return { success: true }
    } catch (error: any) {
      console.error('❌ Error printing PDF from main window:', error)
      return { success: false, error: error.message }
    }
  })

  // Session cookie management for Frappe
  ipcMain.handle('set-session-cookie', async (_event, cookieDetails) => {
    try {
      const { name, value, domain, httpOnly, secure } = cookieDetails

      // Set for both http and https to cover dev servers without TLS
      const urls = [`http://${domain}`, `https://${domain}`]
      for (const url of urls) {
        try {
          await session.defaultSession.cookies.set({
            url,
            name,
            value,
            httpOnly: httpOnly ?? true,
            secure: secure ?? (url.startsWith('https://')),
            sameSite: 'lax'
          })
          console.log(`Cookie ${name} set for ${url}`)
        } catch (err) {
          console.warn('Failed to set cookie for', url, err)
        }
      }

      // Also set for the current window URL if available
      const mainWindow = global.mainWindow
      if (mainWindow && !mainWindow.isDestroyed()) {
        const currentUrl = mainWindow.webContents.getURL()
        if (currentUrl && currentUrl.includes('localhost')) {
          try {
            await session.defaultSession.cookies.set({
              url: 'http://localhost:5173', // Vite dev server
              name,
              value,
              httpOnly: httpOnly ?? true,
              secure: false,
              sameSite: 'lax'
            })
            console.log(`Cookie ${name} also set for localhost:5173`)
          } catch (err) {
            console.warn('Failed to set cookie for localhost:', err)
          }
        }
      }

      console.log(`Session cookie ${name} set for ${domain} (http/https)`) 
      return true
    } catch (error) {
      console.error('Failed to set session cookie:', error)
      throw error
    }
  })

  // Clear session cookies
  ipcMain.handle('clear-session-cookies', async () => {
    try {
      // Get API URL from environment or use default
      const apiUrl = process.env.VITE_API_URL || process.env.ELECTRON_RENDERER_URL || ''

      if (apiUrl) {
        const domain = new URL(apiUrl).hostname

        // Common Frappe cookie names
        const cookiesToClear = ['sid', 'system_user', 'full_name', 'user_id', 'user_image']

        for (const cookieName of cookiesToClear) {
          try {
            await session.defaultSession.cookies.remove(`https://${domain}`, cookieName)
            await session.defaultSession.cookies.remove(`http://${domain}`, cookieName)
          } catch (error) {
            // Cookie might not exist, continue
            console.log(`Cookie ${cookieName} not found or already cleared`, error)
          }
        }
      }

      console.log('Session cookies cleared')
      return true
    } catch (error) {
      console.error('Failed to clear session cookies:', error)
      throw error
    }
  })

  // User preferences storage (non-sensitive data)
  ipcMain.handle('store-user-preferences', async (_event, preferences) => {
    try {
      const existingPreferences = await readPreferences()
      await writePreferences({ ...existingPreferences, ...preferences })
      return true
    } catch (error) {
      console.error('Failed to store user preferences:', error)
      throw error
    }
  })

  ipcMain.handle('get-user-preferences', async () => {
    const preferences = await readPreferences()
    return preferences
  })

  ipcMain.handle('clear-user-preferences', async () => {
    try {
      await fs.unlink(getPrefsPath())
      return true
    } catch {
      // File might not exist, that's okay
      return true
    }
  })

  // Handle auth required event (redirect to login)
  ipcMain.on('auth-required', () => {
    // Emit to all windows or specific window
    const mainWindow = global.mainWindow
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('redirect-to-login')
    }
  })

  // Renderer error logging
  ipcMain.on('renderer-log-error', (_event, payload) => {
    try {
      console.error('Renderer Error:', typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2))
    } catch (error) {
      console.error('Renderer Error:', payload)
    }
  })

  // Additional utility handlers
  ipcMain.handle('get-app-version', () => {
    return app.getVersion()
  })

  ipcMain.handle('get-user-data-path', () => {
    return app.getPath('userData')
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Setup auth handlers before creating window
  setupAuthHandlers()

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test (keep your existing handler)
  ipcMain.on('ping', () => console.log('pong'))

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Clean up on app quit
app.on('before-quit', async () => {
  console.log('App is quitting, cleaning up...')
  // You can add any cleanup logic here if needed
})

// Global declaration for TypeScript
declare global {
  var mainWindow: BrowserWindow | undefined
}