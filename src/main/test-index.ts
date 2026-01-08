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

  // Session cookie management for Frappe
  ipcMain.handle('set-session-cookie', async (_event, cookieDetails) => {
    try {
      const { name, value, domain, httpOnly, secure } = cookieDetails

      await session.defaultSession.cookies.set({
        url: `https://${domain}`,
        name,
        value,
        httpOnly: httpOnly || true,
        secure: secure || true,
        sameSite: 'lax'
      })

      console.log(`Session cookie ${name} set for ${domain}`)
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
      await fs.writeFile(getPrefsPath(), JSON.stringify(preferences, null, 2))
      return true
    } catch (error) {
      console.error('Failed to store user preferences:', error)
      throw error
    }
  })

  ipcMain.handle('get-user-preferences', async () => {
    try {
      const data = await fs.readFile(getPrefsPath(), 'utf8')
      return JSON.parse(data)
    } catch {
      // File might not exist, return empty object
      return {}
    }
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