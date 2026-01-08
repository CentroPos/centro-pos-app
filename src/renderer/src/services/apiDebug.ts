/* eslint-disable @typescript-eslint/no-explicit-any */
import centro from './centro'
import ElectronAuthStore from './electron-auth-store'

type AnyFn = (...args: any[]) => Promise<any>

function safeStringify(obj: any) {
  try {
    return JSON.stringify(obj)
  } catch {
    return String(obj)
  }
}

export const apiDebug = {
  // Check current auth status
  async checkAuth(): Promise<void> {
    try {
      const authStore = ElectronAuthStore.getInstance()
      const authData = await authStore.getAuthData()
      console.log('🔐 Current Auth Status:', {
        isAuthenticated: authData.isAuthenticated,
        user: authData.user,
        sessionId: authData.sessionId ? 'present' : 'missing',
        csrfToken: authData.csrfToken ? 'present' : 'missing',
        // apiKey: authData.apiKey ? 'present' : 'missing' // Not in AuthData interface
      })
      
      // Log to terminal
      try { 
        // window.electronAPI?.log?.logError({ 
        //   debug: 'apiDebug:authCheck', 
        //   authData 
        // }) 
        console.log('apiDebug:authCheck', authData)
      } catch {}
    } catch (error) {
      console.error('❌ Auth check failed:', error)
    }
  },

  // Test login with detailed debugging
  async testLogin(credentials: { usr: string; pwd: string }): Promise<void> {
    try {
      console.log('🧪 Testing login with detailed debugging...')
      
      // Test regular login
      console.log('1️⃣ Testing regular login...')
      try {
        const result = await apiDebug.run('login', credentials)
        console.log('✅ Regular login result:', result)
      } catch (e) {
        console.log('❌ Regular login failed:', e)
      }
      
      // Test API key login
      console.log('2️⃣ Testing API key login...')
      try {
        const { authAPI } = await import('../api/auth')
        const result = await authAPI.loginWithApiKey({
          username: credentials.usr,
          password: credentials.pwd
        })
        console.log('✅ API key login result:', result)
      } catch (e) {
        console.log('❌ API key login failed:', e)
      }
      
      // Check final auth status
      console.log('3️⃣ Final auth status:')
      await apiDebug.checkAuth()
      
    } catch (error) {
      console.error('❌ Login test failed:', error)
    }
  },

  // Generic executor by name
  async run(name: keyof typeof centro, ...args: any[]): Promise<any> {
    try {
      // Check auth status first (except for login)
      if (name !== 'login') {
        await apiDebug.checkAuth()
      }
      
      const fn = (centro[name] as unknown) as AnyFn
      if (typeof fn !== 'function') throw new Error(`Unknown API: ${String(name)}`)
      const res = await fn(...args)
      try { console.log('apiDebug:success', { name, args, data: res?.data ?? res }) } catch {}
      return res?.data ?? res
    } catch (error: any) {
      const payload = {
        debug: 'apiDebug:error',
        name,
        args,
        message: error?.message,
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        data: error?.response?.data
      }
      // Log to Electron terminal
      try { console.error('apiDebug:error', payload) } catch {}
      // Also log to browser console for quick view
      // eslint-disable-next-line no-console
      console.error('API Debug Error:', safeStringify(payload))
      throw error
    }
  }
}

// Attach to window for console use
// Example usage in DevTools:
//   await window.apiDebug.run('productListMethod', { price_list: 'Standard Selling', search_text: '', limit_start: 1, limit_page_length: 4 })
//   await window.apiDebug.run('itemWarehouseList', { item_code: 'ITEM-00001', search_text: 'Stores - NAB', limit_start: 0, limit_page_length: 5 })
//   await window.apiDebug.run('customerList', { search_term: '', limit_start: 1, limit_page_length: 4 })
//   await window.apiDebug.run('customerDetails', 'CUS-00001')
//   await window.apiDebug.run('createOrder', { ...payload... })
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.apiDebug = apiDebug
}

declare global {
  interface Window {
    apiDebug?: typeof apiDebug
  }
}

export default apiDebug


