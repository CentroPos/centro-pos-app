/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { toast } from 'sonner'

const abbreviateOrderId = (orderId: string) => {
  if (!orderId) return orderId
  const last5Digits = orderId.slice(-5)
  return `#${last5Digits}`
}

interface PurchaseTab {
  id: string
  // Keep both names so cloned Sales UI can work unchanged
  purchaseOrderId: string | null
  orderId?: string | null
  orderData: any | null
  type: 'new' | 'existing'
  displayName?: string
  status: 'draft' | 'confirmed' | 'paid'
  supplier: {
    name?: string
    supplier_id?: string
    mobile_no?: string
    email?: string
    tax_id?: string
  } | null
  // Keep Sales fields so UI can be identical
  customer?: any | null
  items: any[]
  isEdited?: boolean
  posting_date?: string | null
  po_no?: string | null
  po_date?: string | null
  internal_note?: string | null
  is_reserved?: number
  buying_price_list?: string | null
  globalDiscountPercent?: number
  globalDiscountAmount?: number
  globalDiscountType?: 'Percentage' | 'Amount'
  poNo?: string | null
  poDate?: string | null
  isRoundingEnabled?: boolean
  instantPrintUrl?: string | null
  purchaseOrderPrintUrl?: string | null
  purchaseInvoicePrintUrl?: string | null
  returnInvoicePrintUrl?: string | null
  invoiceNumber?: string | null
}

interface PurchaseTabStore {
  tabs: PurchaseTab[]
  activeTabId: string | null

  openTab: (purchaseOrderId: string, orderData?: any, status?: 'draft' | 'confirmed') => void
  createNewTab: () => boolean
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void

  updateTabPurchaseOrderId: (tabId: string, purchaseOrderId: string) => void
  updateTabOrderData: (tabId: string, orderData: any) => void
  setTabEdited: (tabId: string, isEdited: boolean) => void

  updateTabSupplier: (tabId: string, supplier: PurchaseTab['supplier']) => void
  updateTabCustomer: (tabId: string, customer: any) => void
  updateTabMeta: (tabId: string, updates: Partial<Pick<PurchaseTab, 'posting_date' | 'internal_note' | 'buying_price_list'>>) => void
  addItemToTab: (tabId: string, item: any) => void
  addItemsToTab: (tabId: string, items: any[]) => void
  removeItemFromTab: (tabId: string, itemCode: string) => void
  removeItemFromTabByIndex: (tabId: string, index: number) => void
  updateItemInTab: (tabId: string, itemCode: string, updates: any) => void
  updateItemInTabByIndex: (tabId: string, index: number, updates: any) => void

  getCurrentTab: () => PurchaseTab | undefined
  getCurrentTabItems: () => any[]
  getCurrentTabCustomer: () => any | null
  getCurrentTabSupplier: () => PurchaseTab['supplier']
  // Sales-compatible helpers used by cloned UI
  updateTabOtherDetails: (tabId: string, details: { po_no?: string | null; po_date?: string | null; internal_note?: string | null }) => void
  updateTabPostingDate: (tabId: string, postingDate: string | null) => void
  getCurrentTabPostingDate: () => string | null
  updateTabReservation: (tabId: string, is_reserved: number) => void
  getCurrentTabReservation: () => number

  // Global discount methods
  updateTabGlobalDiscount: (tabId: string, globalDiscountPercent: number, globalDiscountAmount?: number, globalDiscountType?: 'Percentage' | 'Amount') => void
  getCurrentTabGlobalDiscount: () => { percent: number, amount: number, type: 'Percentage' | 'Amount' }

  // Rounding methods
  updateTabRoundingEnabled: (tabId: string, enabled: boolean) => void
  getCurrentTabRoundingEnabled: () => boolean

  // Instant Print methods
  updateTabInstantPrintUrl: (tabId: string, url: string | null) => void
  setPurchaseOrderPrintUrl: (tabId: string, url: string | null) => void
  setPurchaseInvoicePrintUrl: (tabId: string, url: string | null) => void
  setReturnInvoicePrintUrl: (tabId: string, url: string | null) => void

  // Duplicate tab method
  duplicateCurrentTab: () => boolean
  updateTabStatus: (tabId: string, status: PurchaseTab['status']) => void
}

export const usePurchaseTabStore = create<PurchaseTabStore>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,

      createNewTab: () => {
        const state = get()
        if (state.tabs.length >= 6) {
          toast.error('You can keep only up to 6 purchase orders open at a time')
          return false
        }

        const existingNewCount = state.tabs.filter(t => t.type === 'new' && !t.purchaseOrderId).length
        if (existingNewCount >= 4) {
          toast.error('You can open only up to 4 New purchase orders')
          return false
        }

        const existingNumbers = state.tabs
          .filter(t => t.type === 'new' && t.displayName?.startsWith('New '))
          .map(t => parseInt(t.displayName!.replace('New ', ''), 10))
          .filter(n => !isNaN(n))
        const maxNum = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0
        const newCount = maxNum + 1

        const getCurrentDate = () => {
          const now = new Date()
          const year = now.getFullYear()
          const month = String(now.getMonth() + 1).padStart(2, '0')
          const day = String(now.getDate()).padStart(2, '0')
          return `${year}-${month}-${day}`
        }

        const newTab: PurchaseTab = {
          id: `purchase-tab-${Date.now()}`,
          purchaseOrderId: null,
          orderId: null,
          orderData: null,
          type: 'new',
          displayName: `New ${newCount}`,
          status: 'draft',
          supplier: null,
          customer: null,
          items: [],
          isEdited: false,
          posting_date: getCurrentDate(),
          po_no: null,
          po_date: getCurrentDate(),
          internal_note: null,
          is_reserved: 1,
          buying_price_list: 'Standard Buying'
        }

        set((s) => ({
          tabs: [...s.tabs, newTab],
          activeTabId: newTab.id
        }))
        return true
      },

      closeTab: (tabId: string) => {
        set((state) => {
          const newTabs = state.tabs.filter((tab) => tab.id !== tabId)
          const newActiveTabId = newTabs.length > 0 ? newTabs[0].id : null
          return { tabs: newTabs, activeTabId: newActiveTabId }
        })
      },

      setActiveTab: (tabId: string) => {
        set({ activeTabId: tabId })
      },

      openTab: (purchaseOrderId: string, orderData?: any, status?: 'draft' | 'confirmed') => {
        const state = get()

        // Enforce total tab limit (max 6)
        if (state.tabs.length >= 6) {
          toast.error('You can keep only up to 6 purchase orders open at a time')
          return
        }

        // Check if already open
        const existing = state.tabs.find(t => t.purchaseOrderId === purchaseOrderId || t.orderId === purchaseOrderId)
        if (existing) {
          // Even if existing, update with fresh orderData if provided
          if (orderData) {
            const pdfUrl = orderData?.pdf_download_url || orderData?.data?.pdf_download_url
            const docstatus = Number(orderData.docstatus)

            set((s) => ({
              tabs: s.tabs.map(t => t.id === existing.id ? {
                ...t,
                orderData,
                purchaseOrderPrintUrl: (docstatus === 0 && pdfUrl) ? pdfUrl : t.purchaseOrderPrintUrl,
                purchaseInvoicePrintUrl: (docstatus === 1 && pdfUrl) ? pdfUrl : t.purchaseInvoicePrintUrl
              } : t),
              activeTabId: existing.id
            }))
          } else {
            set({ activeTabId: existing.id })
          }
          return
        }

        // Map API order items (if provided) to cart item structure
        const mappedItems = Array.isArray(orderData?.items)
          ? orderData.items.map((it: any) => ({
            item_code: it.item_code,
            item_name: it.item_name,
            item_part_no: it.item_part_no,
            item_description: it.description || it.item_name,
            quantity: Number(it.qty || it.quantity || 0),
            uom: it.uom || it.stock_uom || 'Nos',
            discount_percentage: Number(it.discount_percentage || 0),
            discount_amount: Number(it.discount_amount || 0),
            discount_type: it.discount_type || 'Percentage',
            standard_rate: Number(it.rate || it.price_list_rate || 0)
          }))
          : []

        // Determine status
        let tabStatus: 'draft' | 'confirmed' = status || 'draft'
        if (!status && orderData) {
          const docstatus = Number(orderData.docstatus)
          if (docstatus === 1) {
            tabStatus = 'confirmed'
          }
        }

        const getCurrentDate = () => {
          const now = new Date()
          const year = now.getFullYear()
          const month = String(now.getMonth() + 1).padStart(2, '0')
          const day = String(now.getDate()).padStart(2, '0')
          return `${year}-${month}-${day}`
        }

        const newTab: PurchaseTab = {
          id: `purchase-tab-${Date.now()}`,
          purchaseOrderId,
          orderId: purchaseOrderId,
          orderData: orderData || null,
          type: 'existing',
          displayName: abbreviateOrderId(purchaseOrderId),
          status: tabStatus,
          supplier: orderData?.supplier_name
            ? {
              name: orderData.supplier_name,
              supplier_id: orderData.supplier || orderData.supplier_id,
              mobile_no: orderData.mobile_no,
              email: orderData.email,
              tax_id: orderData.tax_id
            }
            : null,
          items: mappedItems,
          isEdited: false,
          posting_date: orderData?.posting_date || getCurrentDate(),
          po_no: orderData?.po_no || null,
          po_date: orderData?.po_date || null,
          internal_note: orderData?.custom_internal_note || orderData?.internal_note || null,
          buying_price_list: orderData?.buying_price_list || 'Standard Buying',
          is_reserved: orderData?.is_reserved !== undefined ? Number(orderData.is_reserved) : 1,
          instantPrintUrl: orderData?.pdf_download_url || orderData?.data?.pdf_download_url || null,
          purchaseOrderPrintUrl: (tabStatus === 'draft' && (orderData?.pdf_download_url || orderData?.data?.pdf_download_url)) || null,
          purchaseInvoicePrintUrl: (tabStatus === 'confirmed' && (orderData?.pdf_download_url || orderData?.data?.pdf_download_url)) || null,
          invoiceNumber: (() => {
            const linkedInvoices = orderData?.linked_invoices
            if (linkedInvoices) {
              if (Array.isArray(linkedInvoices) && linkedInvoices.length > 0) {
                return linkedInvoices[0]?.name || null
              } else if (typeof linkedInvoices === 'object' && !Array.isArray(linkedInvoices)) {
                return (linkedInvoices as any).name || null
              }
            }
            return orderData?.purchase_invoice_no || null
          })()
        }

        set((s) => ({
          tabs: [...s.tabs, newTab],
          activeTabId: newTab.id
        }))
      },

      updateTabPurchaseOrderId: (tabId: string, purchaseOrderId: string) => {
        set((state) => ({
          tabs: state.tabs.map((tab) =>
            tab.id === tabId
              ? {
                ...tab,
                purchaseOrderId,
                orderId: purchaseOrderId,
                type: 'existing',
                displayName: abbreviateOrderId(purchaseOrderId),
                isEdited: false
              }
              : tab
          )
        }))
      },

      updateTabOrderData: (tabId: string, orderData: any) => {
        set((state) => ({
          tabs: state.tabs.map((tab) => {
            if (tab.id !== tabId) return tab
            const docstatus = Number(orderData.docstatus)
            const pdfUrl = orderData?.pdf_download_url || orderData?.data?.pdf_download_url
            return {
              ...tab,
              orderData,
              instantPrintUrl: pdfUrl || tab.instantPrintUrl,
              purchaseOrderPrintUrl: (docstatus === 0 && pdfUrl) ? pdfUrl : tab.purchaseOrderPrintUrl,
              purchaseInvoicePrintUrl: (docstatus === 1 && pdfUrl) ? pdfUrl : tab.purchaseInvoicePrintUrl,
              invoiceNumber: (() => {
                const linkedInvoices = orderData?.linked_invoices
                if (linkedInvoices) {
                  if (Array.isArray(linkedInvoices) && linkedInvoices.length > 0) {
                    return linkedInvoices[0]?.name || null
                  } else if (typeof linkedInvoices === 'object' && !Array.isArray(linkedInvoices)) {
                    return (linkedInvoices as any).name || null
                  }
                }
                return orderData?.purchase_invoice_no || null
              })()
            }
          })
        }))
      },

      setTabEdited: (tabId: string, isEdited: boolean) => {
        set((state) => ({
          tabs: state.tabs.map((tab) => (tab.id === tabId ? { ...tab, isEdited } : tab))
        }))
      },

      updateTabSupplier: (tabId: string, supplier: PurchaseTab['supplier']) => {
        set((state) => ({
          tabs: state.tabs.map((tab) => (tab.id === tabId ? { ...tab, supplier, isEdited: true } : tab))
        }))
      },

      updateTabCustomer: (tabId: string, customer: any) => {
        set((state) => ({
          tabs: state.tabs.map((tab) => (tab.id === tabId ? { ...tab, customer, isEdited: true } : tab))
        }))
      },

      updateTabMeta: (tabId: string, updates) => {
        set((state) => ({
          tabs: state.tabs.map((tab) => (tab.id === tabId ? { ...tab, ...updates, isEdited: true } : tab))
        }))
      },

      addItemToTab: (tabId: string, item: any) => {
        set((state) => ({
          tabs: state.tabs.map((tab) =>
            tab.id === tabId ? { ...tab, items: [...tab.items, item], isEdited: true } : tab
          )
        }))
      },
      addItemsToTab: (tabId: string, items: any[]) => {
        set((state) => ({
          tabs: state.tabs.map((tab) =>
            tab.id === tabId ? { ...tab, items: [...tab.items, ...items], isEdited: true } : tab
          )
        }))
      },

      removeItemFromTab: (tabId: string, itemCode: string) => {
        set((state) => ({
          tabs: state.tabs.map((tab) =>
            tab.id === tabId
              ? { ...tab, items: tab.items.filter((item) => item.item_code !== itemCode), isEdited: true }
              : tab
          )
        }))
      },

      removeItemFromTabByIndex: (tabId: string, index: number) => {
        set((state) => ({
          tabs: state.tabs.map((tab) =>
            tab.id === tabId
              ? { ...tab, items: tab.items.filter((_, i) => i !== index), isEdited: true }
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

      getCurrentTab: () => {
        const state = get()
        return state.tabs.find((tab) => tab.id === state.activeTabId)
      },

      getCurrentTabItems: () => {
        const tab = get().getCurrentTab()
        return tab?.items || []
      },

      getCurrentTabCustomer: () => {
        const tab = get().getCurrentTab()
        return tab?.customer || null
      },

      getCurrentTabSupplier: () => {
        const tab = get().getCurrentTab()
        return tab?.supplier || null
      },

      updateTabOtherDetails: (tabId: string, details) => {
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
            tab.id === tabId ? { ...tab, posting_date: postingDate, isEdited: true } : tab
          )
        }))
      },

      getCurrentTabPostingDate: () => {
        const tab = get().getCurrentTab()
        return tab?.posting_date || null
      },

      updateTabReservation: (tabId: string, is_reserved: number) => {
        set((state) => ({
          tabs: state.tabs.map((tab) =>
            tab.id === tabId ? { ...tab, is_reserved, isEdited: true } : tab
          )
        }))
      },

      getCurrentTabReservation: () => {
        const tab = get().getCurrentTab()
        return tab?.is_reserved !== undefined ? Number(tab.is_reserved) : 1
      },

      // Global discount methods
      updateTabGlobalDiscount: (tabId: string, globalDiscountPercent: number, globalDiscountAmount: number = 0, globalDiscountType: 'Percentage' | 'Amount' = 'Percentage') => {
        set((state) => ({
          tabs: state.tabs.map((tab) => (tab.id === tabId ? { ...tab, globalDiscountPercent, globalDiscountAmount, globalDiscountType, isEdited: true } : tab))
        }))
      },

      getCurrentTabGlobalDiscount: () => {
        const state = get()
        const currentTab = state.tabs.find(tab => tab.id === state.activeTabId)
        return {
          percent: currentTab?.globalDiscountPercent || 0,
          amount: currentTab?.globalDiscountAmount || 0,
          type: currentTab?.globalDiscountType || 'Percentage'
        }
      },

      // Rounding methods
      updateTabRoundingEnabled: (tabId: string, enabled: boolean) => {
        set((state) => ({
          tabs: state.tabs.map((tab) => (tab.id === tabId ? { ...tab, isRoundingEnabled: enabled, isEdited: true } : tab))
        }))
      },

      getCurrentTabRoundingEnabled: () => {
        const state = get()
        const currentTab = state.tabs.find(tab => tab.id === state.activeTabId)
        return currentTab?.isRoundingEnabled ?? true
      },

      // Instant Print methods
      updateTabInstantPrintUrl: (tabId: string, url: string | null) => {
        set((state) => ({
          tabs: state.tabs.map((tab) => (tab.id === tabId ? { ...tab, instantPrintUrl: url } : tab))
        }))
      },

      setPurchaseOrderPrintUrl: (tabId: string, url: string | null) => {
        set((state) => ({
          tabs: state.tabs.map((tab) => (tab.id === tabId ? { ...tab, purchaseOrderPrintUrl: url } : tab))
        }))
      },

      setPurchaseInvoicePrintUrl: (tabId: string, url: string | null) => {
        set((state) => ({
          tabs: state.tabs.map((tab) => (tab.id === tabId ? { ...tab, purchaseInvoicePrintUrl: url } : tab))
        }))
      },

      setReturnInvoicePrintUrl: (tabId: string, url: string | null) => {
        set((state) => ({
          tabs: state.tabs.map((tab) => (tab.id === tabId ? { ...tab, returnInvoicePrintUrl: url } : tab))
        }))
      },

      // Duplicate current tab
      duplicateCurrentTab: () => {
        const state = get()
        const currentTab = state.tabs.find(tab => tab.id === state.activeTabId)
        if (!currentTab) {
          toast.error('No active tab to duplicate')
          return false
        }

        if (state.tabs.length >= 6) {
          toast.error('You can keep only up to 6 purchase orders open at a time')
          return false
        }

        const existingNewCount = state.tabs.filter(t => t.type === 'new' && !t.purchaseOrderId).length
        if (existingNewCount >= 4) {
          toast.error('You can open only up to 4 New purchase orders')
          return false
        }

        const existingNumbers = state.tabs
          .filter(t => t.type === 'new' && t.displayName?.startsWith('New '))
          .map(t => parseInt(t.displayName!.replace('New ', ''), 10))
          .filter(n => !isNaN(n))
        const maxNum = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0
        const newCount = maxNum + 1

        const getCurrentDate = () => {
          const now = new Date()
          const year = now.getFullYear()
          const month = String(now.getMonth() + 1).padStart(2, '0')
          const day = String(now.getDate()).padStart(2, '0')
          return `${year}-${month}-${day}`
        }

        const duplicatedTab: PurchaseTab = {
          ...currentTab,
          id: `purchase-tab-${Date.now()}`,
          purchaseOrderId: null,
          orderId: null,
          orderData: null,
          type: 'new',
          displayName: `New ${newCount}`,
          status: 'draft',
          isEdited: false,
          posting_date: getCurrentDate(),
          po_no: null,
          po_date: getCurrentDate()
        }

        set((s) => ({
          tabs: [...s.tabs, duplicatedTab],
          activeTabId: duplicatedTab.id
        }))
        return true
      },
      updateTabStatus: (tabId: string, status: PurchaseTab['status']) => {
        set((state) => ({
          tabs: state.tabs.map((tab) => (tab.id === tabId ? { ...tab, status } : tab))
        }))
      }
    }),
    {
      name: 'purchase-tab-store',
      partialize: (state) => ({
        tabs: state.tabs,
        activeTabId: state.activeTabId
      }),
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


