/* eslint-disable @typescript-eslint/no-explicit-any */
import centro from './centro'

type AnyFn = (...args: any[]) => Promise<any>

function safeStringify(obj: any) {
  try {
    return JSON.stringify(obj)
  } catch {
    return String(obj)
  }
}

export const apiDebug = {
  // Generic executor by name
  async run(name: keyof typeof centro, ...args: any[]): Promise<any> {
    try {
      const fn = (centro[name] as unknown) as AnyFn
      if (typeof fn !== 'function') throw new Error(`Unknown API: ${String(name)}`)
      const res = await fn(...args)
      try { window.electronAPI?.log?.logError({ debug: 'apiDebug:success', name, args, data: res?.data ?? res }) } catch {}
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
      try { window.electronAPI?.log?.logError(payload) } catch {}
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


