import { create } from 'zustand'
import { Invoice, InvoiceItem, PickSlip, WarehouseOperation, Warehouse, ScheduleDetails, WarehouseDetails } from '@renderer/types/picking'
import { toast } from 'sonner'

interface InvoiceTab {
  invoice: Invoice
  items: InvoiceItem[]
  pickSlips: PickSlip[]
  operations: WarehouseOperation[]
  schedule?: ScheduleDetails
  warehouseDetails?: WarehouseDetails
}

interface PickingState {
  // Data Cache
  invoices: Invoice[] // Only fetched invoices
  warehouses: Warehouse[]
  
  // UI State
  tabs: InvoiceTab[]
  activeTabId: string | null
  
  // Operational State
  warehouseOperations: WarehouseOperation[]

  // Actions
  fetchInvoices: () => Promise<void>
  fetchGeneralInfo: () => Promise<void>
  
  // Tab Management
  openInvoiceTab: (invoice: Invoice, details?: Partial<Omit<InvoiceTab, 'invoice'>>) => void
  closeInvoiceTab: (invoiceId: string) => void
  setActiveTab: (invoiceId: string) => void
}

export const usePickingStore = create<PickingState>((set, get) => ({
  invoices: [], 
  warehouses: [],
  tabs: [],
  activeTabId: null,
  warehouseOperations: [],

  fetchInvoices: async () => {
    // TODO: Replace with real API call or integration
    // set({ invoices: res.data })
    console.log('Fetching invoices...')
    // Initially empty as per request to remove dummy data
    set({ invoices: [] }) 
  },

  fetchGeneralInfo: async () => {
    try {
        const res = await window.electronAPI?.proxy?.request({
            url: '/api/method/centro_pos_apis.api.picking.dynamic_pick_general_info',
            method: 'GET'
        });
        
        const rawWarehouses = res?.data?.data?.warehouses || [];
        
        const warehouses: Warehouse[] = rawWarehouses.map((w: any) => ({
            id: w.name, 
            name: w.name,
            code: w.name, // Added needed fields if any
            type: w.type,
            is_delivery_warehouse: w.is_delivery_warehouse,
            is_sales_warehouse: w.is_sales_warehouse,
            pickers: (w.pickers || []).map((p: any) => ({
                id: p.picker_no,
                name: p.name,
                picker_no: p.picker_no
            }))
        }));

        set({ warehouses });

    } catch (e) {
        console.error("Failed to fetch general info", e);
        toast.error("Failed to load warehouse data");
    }
  },

  openInvoiceTab: (invoice, details) => {
    const { tabs, setActiveTab } = get()
    
    // Check if already open
    const existingIndex = tabs.findIndex(t => t.invoice.id === invoice.id)
    if (existingIndex !== -1) {
      if (details) {
         set(state => ({
             tabs: state.tabs.map((t, i) => i === existingIndex ? { ...t, ...details } : t)
         }))
      }
      setActiveTab(invoice.id)
      return
    }

    if (tabs.length >= 6) {
      toast.error('Maximum 6 tabs allowed. Please close some tabs first.')
      return
    }

    const newTab: InvoiceTab = {
      invoice,
      items: details?.items || invoice.items || [],
      pickSlips: details?.pickSlips || [],
      operations: details?.operations || [],
      schedule: details?.schedule,
      warehouseDetails: details?.warehouseDetails
    }

    set(state => ({
      tabs: [...state.tabs, newTab],
      activeTabId: invoice.id
    }))
  },

  closeInvoiceTab: (invoiceId) => {
    set(state => {
      const newTabs = state.tabs.filter(t => t.invoice.id !== invoiceId)
      let newActiveId = state.activeTabId

      // If closing active tab, switch to the last one or null
      if (state.activeTabId === invoiceId) {
        newActiveId = newTabs.length > 0 ? newTabs[newTabs.length - 1].invoice.id : null
      }

      return {
        tabs: newTabs,
        activeTabId: newActiveId
      }
    })
  },

  setActiveTab: (invoiceId) => {
    set({ activeTabId: invoiceId })
  }
}))
