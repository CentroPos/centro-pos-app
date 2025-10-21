/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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
}

interface POSTabStore {
  tabs: Tab[]
  activeTabId: string | null

  openTab: (orderId: string, orderData?: any) => void
  createNewTab: () => void
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  setTabStatus: (tabId: string, status: Tab['status']) => void
  setTabPrivilege: (tabId: string, privilege: Tab['privilege']) => void

  // Tab data methods
  addItemToTab: (tabId: string, item: any) => void
  removeItemFromTab: (tabId: string, itemCode: string) => void
  updateItemInTab: (tabId: string, itemCode: string, updates: any) => void
  updateTabOrderId: (tabId: string, orderId: string) => void
  updateTabTaxAmount: (tabId: string, taxAmount: number) => void
  setTabEdited: (tabId: string, isEdited: boolean) => void
  updateTabInvoiceData: (tabId: string, invoiceData: any) => void
  
  // Customer management methods
  updateTabCustomer: (tabId: string, customer: { name: string; gst: string; customer_id?: string }) => void
  
  // Helper methods
  getCurrentTab: () => Tab | undefined
  getCurrentTabItems: () => any[]
  getCurrentTabCustomer: () => { name: string; gst: string; customer_id?: string }
  itemExistsInTab: (tabId: string, itemCode: string) => boolean
}

export const usePOSTabStore = create<POSTabStore>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,

      // Tab management methods
      openTab: (orderId: string, orderData?: any) => {
        const newTab: Tab = {
          id: `tab-${Date.now()}`,
          orderId,
          orderData,
          type: 'existing',
          displayName: `#${orderId}`,
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
      },

      createNewTab: () => {
        const state = get()
        const newCount = state.tabs.filter(t => t.type === 'new' && !t.orderId).length + 1
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
          tabs: state.tabs.map((tab) =>
            tab.id === tabId 
              ? { 
                  ...tab, 
                  items: tab.items.map(item => 
                    item.item_code === itemCode ? { ...item, ...updates } : item
                  ),
                  isEdited: true 
                } 
              : tab
          )
        }))
      },

      // Other tab data methods
      updateTabOrderId: (tabId: string, orderId: string) => {
        set((state) => ({
          tabs: state.tabs.map((tab) => (tab.id === tabId ? { ...tab, orderId, type: 'existing', displayName: `#${orderId}`, isEdited: false } : tab))
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
      }
    }),
    {
      name: 'pos-tab-store',
      partialize: (state) => ({ tabs: state.tabs, activeTabId: state.activeTabId })
    }
  )
)