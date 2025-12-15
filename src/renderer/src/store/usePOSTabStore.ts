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
    name?: string
    gst?: string
    customer_id?: string
    mobile_no?: string
    email?: string
    tax_id?: string
  } | null
  items: any[]  // Add items to each tab
  isEdited?: boolean
  taxAmount?: number
  invoiceData?: any
  globalDiscountPercent?: number
  po_no?: string | null
  po_date?: string | null
  internal_note?: string | null
  posting_date?: string | null
  instantPrintUrl?: string | null
  isRoundingEnabled?: boolean
  invoiceNumber?: string | null
  invoiceStatus?: string | null
  invoiceCustomReverseStatus?: string | null
  is_reserved?: number
}

interface POSTabStore {
  tabs: Tab[]
  activeTabId: string | null
  lastAction?: 'duplicated' | 'opened' | null

  openTab: (orderId: string, orderData?: any, status?: 'draft' | 'confirmed' | 'paid') => void
  createNewTab: () => boolean
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  setLastAction: (action: 'duplicated' | 'opened' | null) => void
  setTabStatus: (tabId: string, status: Tab['status']) => void
  setTabPrivilege: (tabId: string, privilege: Tab['privilege']) => void
  duplicateCurrentTab: () => boolean

  // Tab data methods
  addItemToTab: (tabId: string, item: any) => void
  removeItemFromTab: (tabId: string, itemCode: string) => void
  removeItemFromTabByIndex: (tabId: string, index: number) => void
  updateItemInTab: (tabId: string, itemCode: string, updates: any) => void
  updateItemInTabByIndex: (tabId: string, index: number, updates: any) => void
  updateTabOrderId: (tabId: string, orderId: string) => void
  updateTabOrderData: (tabId: string, orderData: any) => void
  updateTabTaxAmount: (tabId: string, taxAmount: number) => void
  setTabEdited: (tabId: string, isEdited: boolean) => void
  updateTabInvoiceData: (tabId: string, invoiceData: any) => void
  
  // Global discount methods
  updateTabGlobalDiscount: (tabId: string, globalDiscountPercent: number) => void
  getCurrentTabGlobalDiscount: () => number
  
  // Customer management methods
  updateTabCustomer: (tabId: string, customer: { name: string; gst: string; customer_id?: string; mobile_no?: string; email?: string; tax_id?: string }) => void
  
  // Other Details methods
  updateTabOtherDetails: (tabId: string, details: { po_no?: string | null; po_date?: string | null; internal_note?: string | null }) => void
  
  // Posting Date methods
  updateTabPostingDate: (tabId: string, postingDate: string | null) => void
  getCurrentTabPostingDate: () => string | null
  
  // Instant Print methods
  updateTabInstantPrintUrl: (tabId: string, url: string | null) => void
  
  // Rounding methods
  updateTabRoundingEnabled: (tabId: string, enabled: boolean) => void
  getCurrentTabRoundingEnabled: () => boolean
  
  // Invoice number methods
  updateTabInvoiceNumber: (tabId: string, invoiceNumber: string | null, invoiceStatus?: string | null, invoiceCustomReverseStatus?: string | null) => void
  getCurrentTabInvoiceNumber: () => string | null
  getCurrentTabInvoiceStatus: () => string | null
  getCurrentTabInvoiceCustomReverseStatus: () => string | null
  
  // Reservation methods
  updateTabReservation: (tabId: string, is_reserved: number) => void
  getCurrentTabReservation: () => number
  
  // Helper methods
  getCurrentTab: () => Tab | undefined
  getCurrentTabItems: () => any[]
  getCurrentTabCustomer: () => { name?: string; gst?: string; customer_id?: string; mobile_no?: string; email?: string; tax_id?: string } | null
  
  // Clear all tabs (use with caution)
  clearAllTabs: () => void
  itemExistsInTab: (tabId: string, itemCode: string) => boolean
}

export const usePOSTabStore = create<POSTabStore>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,
      lastAction: null,

      // Tab management methods
      openTab: (orderId: string, orderData?: any, status?: 'draft' | 'confirmed' | 'paid') => {
        const state = get()
        
        console.log('📋 [openTab] ===== OPENING TAB =====')
        console.log('📋 [openTab] Order ID:', orderId)
        console.log('📋 [openTab] Order Data received:', orderData ? 'Present' : 'Missing')
        console.log('📋 [openTab] Order Data full:', JSON.stringify(orderData, null, 2))
        console.log('📋 [openTab] Linked invoices in orderData:', JSON.stringify(orderData?.linked_invoices, null, 2))
        
        // Enforce total tab limit (max 6)
        if (state.tabs.length >= 6) {
          toast.error('You can keep only up to 6 orders open at a time')
          return
        }
        // Map API order items (if provided) to cart item structure used by POS
        // Also convert custom_stock_adjustment_sources to warehouseAllocations format
        const customStockAdjustmentSources = orderData?.custom_stock_adjustment_sources || []
        
        // Group custom_stock_adjustment_sources by item_code
        const allocationsByItem: Record<string, Array<{ name: string; allocated: number; available?: number; selected: boolean }>> = {}
        if (Array.isArray(customStockAdjustmentSources)) {
          customStockAdjustmentSources.forEach((source: any) => {
            if (source.item_code && source.source_warehouse && source.qty > 0) {
              if (!allocationsByItem[source.item_code]) {
                allocationsByItem[source.item_code] = []
              }
              allocationsByItem[source.item_code].push({
                name: source.source_warehouse,
                allocated: Number(source.qty || 0),
                available: source.available || undefined,
                selected: true
              })
            }
          })
        }
        
        const mappedItems = Array.isArray(orderData?.items)
          ? orderData.items.map((it: any) => {
              const itemCode = it.item_code
              const baseItem = {
                item_code: itemCode,
                item_name: it.item_name,
                label: it.description || it.item_name,
                quantity: Number(it.qty || it.quantity || 0),
                uom: it.uom || it.stock_uom,
                discount_percentage: Number(it.discount_percentage || 0),
                standard_rate: Number(it.rate || it.price_list_rate || 0)
              }
              
              // Preserve warehouseAllocations if present, or convert from custom_stock_adjustment_sources
              if (it.warehouseAllocations && Array.isArray(it.warehouseAllocations) && it.warehouseAllocations.length > 0) {
                // Use existing warehouseAllocations from item
                return {
                  ...baseItem,
                  warehouseAllocations: it.warehouseAllocations
                }
              } else if (allocationsByItem[itemCode] && allocationsByItem[itemCode].length > 0) {
                // Convert from custom_stock_adjustment_sources
                return {
                  ...baseItem,
                  warehouseAllocations: allocationsByItem[itemCode]
                }
              }
              
              return baseItem
            })
          : []

        // Determine status: use provided status, or check docstatus, or default to draft
        let tabStatus: 'draft' | 'confirmed' | 'paid' = status || 'draft'
        if (!status && orderData) {
          const docstatus = Number(orderData.docstatus)
          if (docstatus === 1) {
            tabStatus = 'confirmed'
          }
        }

        const newTab: Tab = {
          id: `tab-${Date.now()}`,
          orderId,
          orderData: orderData || null,
          type: 'existing',
          displayName: abbreviateOrderId(orderId),
          status: tabStatus,
          privilege: 'billing',
          customer: orderData?.customer_name
            ? { name: orderData.customer_name, gst: orderData?.tax_id || undefined }
            : null,
          items: mappedItems,
          isEdited: false,
          taxAmount: 0,
          invoiceData: null,
          po_no: orderData?.po_no || null,
          po_date: orderData?.po_date || null,
          internal_note: orderData?.custom_internal_note || orderData?.internal_note || null,
          posting_date: orderData?.posting_date || null,
          instantPrintUrl: null,
          isRoundingEnabled: true,
          invoiceNumber: (() => {
            // Extract invoice number from linked_invoices if available
            console.log('📋 [openTab] Extracting invoice number from linked_invoices...')
            const linkedInvoices = orderData?.linked_invoices
            console.log('📋 [openTab] linked_invoices raw:', JSON.stringify(linkedInvoices, null, 2))
            console.log('📋 [openTab] linked_invoices type:', typeof linkedInvoices)
            console.log('📋 [openTab] Is array:', Array.isArray(linkedInvoices))
            
            if (linkedInvoices) {
              if (Array.isArray(linkedInvoices) && linkedInvoices.length > 0) {
                const firstInvoice = linkedInvoices[0]
                const invNum = firstInvoice?.name || null
                console.log('📋 [openTab] ✅ Invoice number extracted from array:', invNum)
                console.log('📋 [openTab] First invoice object:', JSON.stringify(firstInvoice, null, 2))
                return invNum
              } else if (linkedInvoices && typeof linkedInvoices === 'object' && !Array.isArray(linkedInvoices)) {
                const invNum = linkedInvoices.name || null
                console.log('📋 [openTab] ✅ Invoice number extracted from object:', invNum)
                return invNum
              }
            }
            console.log('📋 [openTab] ⚠️ No invoice number found, returning null')
            return null
          })(),
          invoiceStatus: (() => {
            const linkedInvoices = orderData?.linked_invoices
            if (Array.isArray(linkedInvoices) && linkedInvoices.length > 0) {
              return linkedInvoices[0]?.status || null
            } else if (linkedInvoices && typeof linkedInvoices === 'object' && !Array.isArray(linkedInvoices)) {
              return linkedInvoices.status || null
            }
            return null
          })(),
          invoiceCustomReverseStatus: (() => {
            const linkedInvoices = orderData?.linked_invoices
            if (Array.isArray(linkedInvoices) && linkedInvoices.length > 0) {
              return linkedInvoices[0]?.custom_reverse_status || null
            } else if (linkedInvoices && typeof linkedInvoices === 'object' && !Array.isArray(linkedInvoices)) {
              return linkedInvoices.custom_reverse_status || null
            }
            return null
          })(),
          is_reserved: orderData?.is_reserved !== undefined ? Number(orderData.is_reserved) : 1
        }

        console.log('📋 [openTab] New tab created:', {
          tabId: newTab.id,
          orderId: newTab.orderId,
          invoiceNumber: newTab.invoiceNumber,
          invoiceStatus: newTab.invoiceStatus,
          invoiceCustomReverseStatus: newTab.invoiceCustomReverseStatus,
          hasOrderData: !!newTab.orderData,
          orderDataLinkedInvoices: newTab.orderData?.linked_invoices ? 'Present' : 'Missing'
        })
        console.log('📋 [openTab] OrderData in new tab:', JSON.stringify(newTab.orderData?.linked_invoices, null, 2))

        set((state) => {
          const updatedState = {
            tabs: [...state.tabs, newTab],
            activeTabId: newTab.id,
            lastAction: 'opened' as const
          }
          console.log('📋 [openTab] Tab stored in state. Total tabs:', updatedState.tabs.length)
          console.log('📋 [openTab] Active tab ID:', updatedState.activeTabId)
          const storedTab = updatedState.tabs.find(t => t.id === newTab.id)
          console.log('📋 [openTab] Stored tab verification:', {
            tabId: storedTab?.id,
            orderId: storedTab?.orderId,
            invoiceNumber: storedTab?.invoiceNumber,
            hasOrderData: !!storedTab?.orderData,
            orderDataLinkedInvoices: storedTab?.orderData?.linked_invoices ? 'Present' : 'Missing'
          })
          return updatedState
        })
        
        console.log('📋 [openTab] ===== TAB OPENED =====')
      },

      createNewTab: () => {
        
        const state = get()
        // Helper to find and close a safe-to-close tab when limit is reached
        const autoCloseSafeOrderTab = (): boolean => {
           const currentState = get()
           // Check FIFO (first found match starting from index 0)
           const tabToClose = currentState.tabs.find(t => {
             // 1. Status is NOT 'draft' (e.g. confirmed/paid) => Safe to close
             if (t.status !== 'draft') return true
             
             // 2. OR isEdited is false => Safe to close
             if (t.isEdited === false) return true
             
             return false
           })

           if (tabToClose) {
             console.log('📋 [autoClose] Closing safe tab:', tabToClose.id, tabToClose.orderId)
             // Use the stores closeTab action
             get().closeTab(tabToClose.id)
             return true
           }
           return false
        }

        // Enforce limits: max 6 total
        if (state.tabs.length >= 6) {
          // Attempt to auto-close a safe tab
          const closed = autoCloseSafeOrderTab()
          
          if (!closed) {
             // If we couldn't close any tab, then we strictly enforce the limit
             toast.error('You can keep only up to 6 orders open at a time')
             return false
          }
          // If closed is true, one tab was removed, so length is now 5. Proceed.
        }
        
        // Re-fetch state after potential close operation to ensure accurate counts
        const updatedState = get()
        const existingNewCount = updatedState.tabs.filter(t => t.type === 'new' && !t.orderId).length

        console.log('📋 [SHD] ==> existingNewCount:', existingNewCount)
        if (existingNewCount >= 4) {
          toast.error('You can open only up to 4 New orders')
          return false
        }
        const newCount = existingNewCount + 1
        // Get current date in YYYY-MM-DD format
        const getCurrentDate = () => {
          const now = new Date()
          const year = now.getFullYear()
          const month = String(now.getMonth() + 1).padStart(2, '0')
          const day = String(now.getDate()).padStart(2, '0')
          return `${year}-${month}-${day}`
        }

        const newTab: Tab = {
          id: `tab-${Date.now()}`,
          orderId: null,
          orderData: null,
          type: 'new',
          displayName: `New ${newCount}`,
          status: 'draft',
          privilege: 'billing',
          customer: null,
          items: [],
          isEdited: false,
          taxAmount: 0,
          invoiceData: null,
          po_no: null,
          po_date: getCurrentDate(), // Default to current date
          internal_note: null,
          posting_date: null,
          instantPrintUrl: null,
          isRoundingEnabled: true,
          invoiceNumber: null,
          is_reserved: 1
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
      
      // Track last high-level action to allow UI reactions
      setLastAction: (action: 'duplicated' | 'opened' | null) => {
        set({ lastAction: action })
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
        set((s) => ({ tabs: [...s.tabs, clone], activeTabId: clone.id, lastAction: 'duplicated' as const }))
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

      removeItemFromTabByIndex: (tabId: string, index: number) => {
        set((state) => ({
          tabs: state.tabs.map((tab) =>
            tab.id === tabId 
              ? { 
                  ...tab, 
                  items: tab.items.filter((_, i) => i !== index),
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

      updateTabOrderData: (tabId: string, orderData: any) => {
        set((state) => ({
          tabs: state.tabs.map((tab) => {
            if (tab.id === tabId) {
              return {
                ...tab,
                orderData,
                // Update Other Details fields from orderData if present
                po_no: orderData?.po_no !== undefined ? orderData.po_no : tab.po_no,
                po_date: orderData?.po_date !== undefined ? orderData.po_date : tab.po_date,
                internal_note: orderData?.custom_internal_note !== undefined ? orderData.custom_internal_note : (orderData?.internal_note !== undefined ? orderData.internal_note : tab.internal_note)
              }
            }
            return tab
          })
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
      updateTabCustomer: (tabId: string, customer: { name: string; gst: string; customer_id?: string; mobile_no?: string; email?: string; tax_id?: string }) => {
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
        return currentTab?.customer || null
      },

      updateTabOtherDetails: (tabId: string, details: { po_no?: string | null; po_date?: string | null; internal_note?: string | null }) => {
        set((state) => ({
          tabs: state.tabs.map((tab) =>
            tab.id === tabId
              ? {
                  ...tab,
                  po_no: details.po_no !== undefined ? details.po_no : tab.po_no,
                  po_date: details.po_date !== undefined ? details.po_date : tab.po_date,
                  internal_note: details.internal_note !== undefined ? details.internal_note : tab.internal_note,
                  isEdited: true
                }
              : tab
          )
        }))
      },

      updateTabPostingDate: (tabId: string, postingDate: string | null) => {
        set((state) => ({
          tabs: state.tabs.map((tab) =>
            tab.id === tabId
              ? {
                  ...tab,
                  posting_date: postingDate,
                  isEdited: true
                }
              : tab
          )
        }))
      },

      getCurrentTabPostingDate: () => {
        const state = get()
        const currentTab = state.tabs.find(tab => tab.id === state.activeTabId)
        return currentTab?.posting_date || null
      },

      updateTabInstantPrintUrl: (tabId: string, url: string | null) => {
        set((state) => ({
          tabs: state.tabs.map((tab) =>
            tab.id === tabId
              ? {
                  ...tab,
                  instantPrintUrl: url
                }
              : tab
          )
        }))
      },

      updateTabRoundingEnabled: (tabId: string, enabled: boolean) => {
        set((state) => ({
          tabs: state.tabs.map((tab) =>
            tab.id === tabId
              ? {
                  ...tab,
                  isRoundingEnabled: enabled
                }
              : tab
          )
        }))
      },

      getCurrentTabRoundingEnabled: () => {
        const state = get()
        const currentTab = state.tabs.find(tab => tab.id === state.activeTabId)
        return currentTab?.isRoundingEnabled ?? true
      },

      updateTabInvoiceNumber: (tabId: string, invoiceNumber: string | null, invoiceStatus?: string | null, invoiceCustomReverseStatus?: string | null) => {
        console.log('📋 [updateTabInvoiceNumber] Called with:', { 
          tabId, 
          invoiceNumber, 
          invoiceStatus, 
          invoiceCustomReverseStatus 
        })
        set((state) => {
          const updatedTabs = state.tabs.map((tab) =>
            tab.id === tabId
              ? {
                  ...tab,
                  invoiceNumber: invoiceNumber,
                  invoiceStatus: invoiceStatus !== undefined ? invoiceStatus : tab.invoiceStatus,
                  invoiceCustomReverseStatus: invoiceCustomReverseStatus !== undefined ? invoiceCustomReverseStatus : tab.invoiceCustomReverseStatus
                }
              : tab
          )
          const updatedTab = updatedTabs.find(tab => tab.id === tabId)
          console.log('📋 [updateTabInvoiceNumber] Tab updated:', {
            tabId,
            oldInvoiceNumber: state.tabs.find(t => t.id === tabId)?.invoiceNumber,
            newInvoiceNumber: updatedTab?.invoiceNumber,
            newInvoiceStatus: updatedTab?.invoiceStatus,
            newInvoiceCustomReverseStatus: updatedTab?.invoiceCustomReverseStatus
          })
          return { tabs: updatedTabs }
        })
      },

      getCurrentTabInvoiceNumber: () => {
        const state = get()
        const currentTab = state.tabs.find(tab => tab.id === state.activeTabId)
        const invoiceNumber = currentTab?.invoiceNumber || null
        console.log('📋 [getCurrentTabInvoiceNumber] Retrieved:', {
          activeTabId: state.activeTabId,
          currentTabId: currentTab?.id,
          invoiceNumber: invoiceNumber,
          invoiceStatus: currentTab?.invoiceStatus,
          invoiceCustomReverseStatus: currentTab?.invoiceCustomReverseStatus,
          fullTab: currentTab ? { 
            id: currentTab.id, 
            orderId: currentTab.orderId, 
            invoiceNumber: currentTab.invoiceNumber,
            invoiceStatus: currentTab.invoiceStatus,
            invoiceCustomReverseStatus: currentTab.invoiceCustomReverseStatus
          } : null
        })
        return invoiceNumber
      },

      getCurrentTabInvoiceStatus: () => {
        const state = get()
        const currentTab = state.tabs.find(tab => tab.id === state.activeTabId)
        return currentTab?.invoiceStatus || null
      },

      getCurrentTabInvoiceCustomReverseStatus: () => {
        const state = get()
        const currentTab = state.tabs.find(tab => tab.id === state.activeTabId)
        return currentTab?.invoiceCustomReverseStatus || null
      },

      updateTabReservation: (tabId: string, is_reserved: number) => {
        set((state) => ({
          tabs: state.tabs.map((tab) =>
            tab.id === tabId
              ? {
                  ...tab,
                  is_reserved: is_reserved,
                  isEdited: true
                }
              : tab
          )
        }))
      },

      getCurrentTabReservation: () => {
        const state = get()
        const currentTab = state.tabs.find(tab => tab.id === state.activeTabId)
        return currentTab?.is_reserved !== undefined ? currentTab.is_reserved : 1
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