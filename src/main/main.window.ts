import { join } from 'node:path'
import { app, BrowserWindow } from 'electron'

const isDev = !app.isPackaged

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'

export async function createWindow() {
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    title: 'Centroerp',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, '../preload/index.js'),
      devTools: isDev
    },
    autoHideMenuBar: !isDev
  })

  const URL = isDev
    ? 'http://localhost:4000'
    : `file://${join(app.getAppPath(), 'dist/render/index.html')}`

  win.loadURL(URL)

  // Do not auto-open DevTools; keep menu hidden in production
  if (!isDev) win.removeMenu()

  win.on('closed', () => {
    win.destroy()
  })

  return win
}

export async function restoreOrCreateWindow() {
  let window = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed())

  if (window === undefined) window = await createWindow()

  if (window.isMinimized()) window.restore()

  window.focus()
}
