/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from 'zustand'
import { toast } from 'sonner'
import { persist } from 'zustand/middleware'

// Helper function to abbreviate order ID to last 5 digits
const abbreviateOrderId = (orderId: string) => {
  if (!orderId) return orderId
  // Extract last 5 digits from order ID
  const last5Digits = orderId.slice(-5)
  return `#${last5Digits}`
}

interface Tab {
  id: string
  orderId: string | null
  orderData: any | null
  type: 'new' | 'existing'
  displayName?: string
  status: 'draft' | 'confirmed' | 'paid'
  privilege: 'return' | 'billing' | 'sales'
  customer: {
    name: string
    gst: string
    customer_id?: string
  }
  items: any[]  // Add items to each tab
  isEdited?: boolean
  taxAmount?: number
  invoiceData?: any
  globalDiscountPercent?: number
}

interface POSTabStore {
  tabs: Tab[]
  activeTabId: string | null

  openTab: (orderId: string, orderData?: any) => void
  createNewTab: () => boolean
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  setTabStatus: (tabId: string, status: Tab['status']) => void
  setTabPrivilege: (tabId: string, privilege: Tab['privilege']) => void
  duplicateCurrentTab: () => boolean

  // Tab data methods
  addItemToTab: (tabId: string, item: any) => void
  removeItemFromTab: (tabId: string, itemCode: string) => void
  updateItemInTab: (tabId: string, itemCode: string, updates: any) => void
  updateTabOrderId: (tabId: string, orderId: string) => void
  updateTabTaxAmount: (tabId: string, taxAmount: number) => void
  setTabEdited: (tabId: string, isEdited: boolean) => void
  updateTabInvoiceData: (tabId: string, invoiceData: any) => void
  
  // Global discount methods
  updateTabGlobalDiscount: (tabId: string, globalDiscountPercent: number) => void
  getCurrentTabGlobalDiscount: () => number
  
  // Customer management methods
  updateTabCustomer: (tabId: string, customer: { name: string; gst: string; customer_id?: string }) => void
  
  // Helper methods
  getCurrentTab: () => Tab | undefined
  getCurrentTabItems: () => any[]
  getCurrentTabCustomer: () => { name: string; gst: string; customer_id?: string }
  
  // Clear all tabs (use with caution)
  clearAllTabs: () => void
  itemExistsInTab: (tabId: string, itemCode: string) => boolean
}

export const usePOSTabStore = create<POSTabStore>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,

      // Tab management methods
      openTab: (orderId: string, orderData?: any) => {
        const state = get()
        // Enforce total tab limit (max 6)
        if (state.tabs.length >= 6) {
          toast.error('You can keep only up to 6 orders open at a time')
          return
        }
        // Map API order items (if provided) to cart item structure used by POS
        const mappedItems = Array.isArray(orderData?.items)
          ? orderData.items.map((it: any) => ({
              item_code: it.item_code,
              item_name: it.item_name,
              label: it.description || it.item_name,
              quantity: Number(it.qty || it.quantity || 0),
              uom: it.uom || it.stock_uom,
              discount_percentage: Number(it.discount_percentage || 0),
              standard_rate: Number(it.rate || it.price_list_rate || 0)
            }))
          : []

        const newTab: Tab = {
          id: `tab-${Date.now()}`,
          orderId,
          orderData: orderData || null,
          type: 'existing',
          displayName: abbreviateOrderId(orderId),
          status: 'draft',
          privilege: 'billing',
          customer: {
            name: orderData?.customer_name || 'Walking Customer',
            gst: orderData?.tax_id || 'Not Applicable'
          },
          items: mappedItems,
          isEdited: false,
          taxAmount: 0,
          invoiceData: null
        }

        set((state) => ({
          tabs: [...state.tabs, newTab],
          activeTabId: newTab.id
        }))
      },

      createNewTab: () => {
        const state = get()
        // Enforce limits: max 6 total, max 4 new tabs
        if (state.tabs.length >= 6) {
          toast.error('You can keep only up to 6 orders open at a time')
          return false
        }
        const existingNewCount = state.tabs.filter(t => t.type === 'new' && !t.orderId).length
        if (existingNewCount >= 4) {
          toast.error('You can open only up to 4 New orders')
          return false
        }
        const newCount = existingNewCount + 1
        const newTab: Tab = {
          id: `tab-${Date.now()}`,
          orderId: null,
          orderData: null,
          type: 'new',
          displayName: `New ${newCount}`,
          status: 'draft',
          privilege: 'billing',
          customer: { name: 'Walking Customer', gst: 'Not Applicable' },
          items: [],
          isEdited: false,
          taxAmount: 0,
          invoiceData: null
        }

        set((state) => ({
          tabs: [...state.tabs, newTab],
          activeTabId: newTab.id
        }))
        return true
      },

      closeTab: (tabId: string) => {
        set((state) => {
          const newTabs = state.tabs.filter((tab) => tab.id !== tabId)
          const newActiveTabId = newTabs.length > 0 ? newTabs[0].id : null

          return {
            tabs: newTabs,
            activeTabId: newActiveTabId
          }
        })
      },

      setActiveTab: (tabId: string) => {
        set({ activeTabId: tabId })
      },

      setTabStatus: (tabId: string, status: Tab['status']) => {
        set((state) => ({
          tabs: state.tabs.map((tab) => (tab.id === tabId ? { ...tab, status } : tab))
        }))
      },

      setTabPrivilege: (tabId: string, privilege: Tab['privilege']) => {
        set((state) => ({
          tabs: state.tabs.map((tab) => (tab.id === tabId ? { ...tab, privilege } : tab))
        }))
      },

      // Duplicate current tab into a new 'new' tab (respecting limits)
      duplicateCurrentTab: () => {
        const state = get()
        if (state.tabs.length >= 6) {
          toast.error('You can keep only up to 6 orders open at a time')
          return false
        }
        const existingNewCount = state.tabs.filter(t => t.type === 'new' && !t.orderId).length
        if (existingNewCount >= 4) {
          toast.error('You can open only up to 4 New orders')
          return false
        }
        const source = state.tabs.find(t => t.id === state.activeTabId)
        if (!source) return false
        const newCount = existingNewCount + 1
        const clone: Tab = {
          id: `tab-${Date.now()}`,
          orderId: null,
          orderData: null,
          type: 'new',
          displayName: `New ${newCount}`,
          status: 'draft',
          privilege: source.privilege,
          customer: { ...source.customer },
          items: source.items.map((it) => ({ ...it })),
          isEdited: true,
          taxAmount: source.taxAmount || 0,
          invoiceData: null,
          globalDiscountPercent: source.globalDiscountPercent || 0
        }
        set((s) => ({ tabs: [...s.tabs, clone], activeTabId: clone.id }))
        return true
      },

      // Tab item management methods
      addItemToTab: (tabId: string, item: any) => {
        set((state) => ({
          tabs: state.tabs.map((tab) =>
            tab.id === tabId 
              ? { ...tab, items: [...tab.items, item], isEdited: true } 
              : tab
          )
        }))
      },

      removeItemFromTab: (tabId: string, itemCode: string) => {
        set((state) => ({
          tabs: state.tabs.map((tab) =>
            tab.id === tabId 
              ? { 
                  ...tab, 
                  items: tab.items.filter(item => item.item_code !== itemCode),
                  isEdited: true 
                } 
              : tab
          )
        }))
      },

      updateItemInTab: (tabId: string, itemCode: string, updates: any) => {
        set((state) => ({
          tabs: state.tabs.map((tab) => {
            if (tab.id !== tabId) return tab
            let updatedOnce = false
            const newItems = tab.items.map((item) => {
              if (!updatedOnce && item.item_code === itemCode) {
                updatedOnce = true
                return { ...item, ...updates }
              }
              return item
            })
            return { ...tab, items: newItems, isEdited: true }
          })
        }))
      },

      // Update by absolute item index within the tab (supports duplicate item codes)
      updateItemInTabByIndex: (tabId: string, index: number, updates: any) => {
        set((state) => ({
          tabs: state.tabs.map((tab) => {
            if (tab.id !== tabId) return tab
            if (index < 0 || index >= tab.items.length) return tab
            const newItems = tab.items.slice()
            newItems[index] = { ...newItems[index], ...updates }
            return { ...tab, items: newItems, isEdited: true }
          })
        }))
      },

      // Other tab data methods
      updateTabOrderId: (tabId: string, orderId: string) => {
        set((state) => ({
          tabs: state.tabs.map((tab) => (tab.id === tabId ? { ...tab, orderId, type: 'existing', displayName: abbreviateOrderId(orderId), isEdited: false } : tab))
        }))
      },

      updateTabTaxAmount: (tabId: string, taxAmount: number) => {
        set((state) => ({
          tabs: state.tabs.map((tab) => (tab.id === tabId ? { ...tab, taxAmount } : tab))
        }))
      },

      setTabEdited: (tabId: string, isEdited: boolean) => {
        set((state) => ({
          tabs: state.tabs.map((tab) => (tab.id === tabId ? { ...tab, isEdited } : tab))
        }))
      },

      updateTabInvoiceData: (tabId: string, invoiceData: any) => {
        set((state) => ({
          tabs: state.tabs.map((tab) => (tab.id === tabId ? { ...tab, invoiceData } : tab))
        }))
      },

      // Global discount methods
      updateTabGlobalDiscount: (tabId: string, globalDiscountPercent: number) => {
        set((state) => ({
          tabs: state.tabs.map((tab) => (tab.id === tabId ? { ...tab, globalDiscountPercent, isEdited: true } : tab))
        }))
      },

      getCurrentTabGlobalDiscount: () => {
        const state = get()
        const currentTab = state.tabs.find(tab => tab.id === state.activeTabId)
        return currentTab?.globalDiscountPercent || 0
      },

      // Customer management methods
      updateTabCustomer: (tabId: string, customer: { name: string; gst: string; customer_id?: string }) => {
        set((state) => ({
          tabs: state.tabs.map((tab) => (tab.id === tabId ? { ...tab, customer } : tab))
        }))
      },

      // Helper methods
      getCurrentTab: () => {
        const state = get()
        return state.tabs.find(tab => tab.id === state.activeTabId)
      },

      getCurrentTabItems: () => {
        const state = get()
        const currentTab = state.tabs.find(tab => tab.id === state.activeTabId)
        return currentTab?.items || []
      },

      getCurrentTabCustomer: () => {
        const state = get()
        const currentTab = state.tabs.find(tab => tab.id === state.activeTabId)
        return currentTab?.customer || { name: 'Walking Customer', gst: 'Not Applicable' }
      },

      itemExistsInTab: (tabId: string, itemCode: string) => {
        const state = get()
        const tab = state.tabs.find(tab => tab.id === tabId)
        return tab ? tab.items.some(item => item.item_code === itemCode) : false
      },

      // Clear all tabs (use with caution - only for explicit clearing)
      clearAllTabs: () => {
        console.log('🗑️ Clearing all POS tabs')
        set({ tabs: [], activeTabId: null })
      }
    }),
    {
      name: 'pos-tab-store',
      partialize: (state) => ({ 
        tabs: state.tabs, 
        activeTabId: state.activeTabId 
      }),
      // Ensure the store persists across browser sessions
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name)
          return str ? JSON.parse(str) : null
        },
        setItem: (name, value) => {
          localStorage.setItem(name, JSON.stringify(value))
        },
        removeItem: (name) => {
          localStorage.removeItem(name)
        }
      }
    }
  )
)