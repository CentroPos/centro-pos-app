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
  createPickSlip: (warehouseId: string, pickerId: string | null, startTime: Date | null, endTime: Date | null) => Promise<PickSlip | null>
  updatePickSlip: (pickSlipId: string, pickerId: string | null, startTime: Date | null, endTime: Date | null) => Promise<PickSlip | null>
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

  createPickSlip: async (warehouseId, pickerId, startTime, endTime) => {
    const { activeTabId, tabs } = get()
    if (!activeTabId) return null

    try {
        const activeTab = tabs.find(t => t.invoice.id === activeTabId)
        if (!activeTab) return null

        // Format dates for API (YYYY-MM-DD HH:mm:ss)
        const formatDate = (d: Date) => {
            const pad = (n: number) => n.toString().padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
        };

        const payload = {
            invoice_no: activeTab.invoice.invoiceNo,
            warehouse: warehouseId,
            assigned_to: pickerId || '',
            start_time: startTime ? formatDate(startTime) : null,
            end_time: endTime ? formatDate(endTime) : null
        }

        const res = await window.electronAPI?.proxy?.request({
            url: '/api/method/centro_pos_apis.api.picking.assign_pick_slip',
            method: 'POST',
            data: payload
        });

        const data = res?.data?.data;
        if (data) {
            toast.success("Pick slip assigned successfully");
            
            // Construct returned PickSlip object from response + inputs
            // Response has: pick_list_id, message, picking_slip_url
            // We need to fetch details again to get full slip object actually,
            // or construct it manually. For UI update immediately, we can construct:
            const warehouseName = get().warehouses.find(w => w.id === warehouseId)?.name || warehouseId;
            const pickerName = get().warehouses.find(w => w.id === warehouseId)?.pickers.find(p => p.id === pickerId)?.name || 'Unassigned';

            const newSlip: PickSlip = {
                id: data.pick_list_id,
                slipNo: data.pick_list_id,
                invoiceId: activeTabId!,
                warehouseId: warehouseId,
                warehouseName: warehouseName,
                pickerId: pickerId || '',
                pickerName: pickerId ? pickerName : 'Unassigned',
                assignedBy: 'Me', // System doesn't return this yet
                assignedOn: new Date(),
                status: endTime ? 'picked' : (startTime ? 'in-progress' : 'not-started'),
                startTime: startTime || undefined,
                endTime: endTime || undefined,
                items: [], // Details fetch will populate this properly
                print_url: data.picking_slip_url
            };

            // Option 1: Optimistically add to tab (Simplified)
            // Option 2: Re-fetch details (Better for consistency)
            // We'll return the slip so the modal can use it.
            // Caller (dynamic_picking) should refresh details.
            
            return newSlip;
        }

    } catch (e: any) {
        console.error("Failed to create pick slip", e);
        toast.error(e.response?.data?.message || "Failed to create pick slip");
    }
    return null;
  },

  updatePickSlip: async (pickSlipId, pickerId, startTime, endTime) => {
    try {
        // Format dates for API (YYYY-MM-DD HH:mm:ss)
        const formatDate = (d: Date) => {
            const pad = (n: number) => n.toString().padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
        };

        const payload = {
            pick_list_id: pickSlipId,
            assigned_to: pickerId || '',
            start_time: startTime ? formatDate(startTime) : null,
            end_time: endTime ? formatDate(endTime) : null
        }

        const res = await window.electronAPI?.proxy?.request({
            url: '/api/method/centro_pos_apis.api.picking.update_assign_pick_slip',
            method: 'POST',
            data: payload
        });

        const data = res?.data?.data;
        if (data) {
            toast.success(data.message || "Pick slip updated successfully");
            
            // Construct a partial slip update to return
            const updatedSlip: Partial<PickSlip> = {
                id: data.pick_list_id,
                print_url: data.picking_slip_url,
                // Status is inferred from times, API returns human readable updates but we need state
                status: endTime ? 'picked' : (startTime ? 'in-progress' : 'not-started')
            };
            
            return updatedSlip as PickSlip;
        }

    } catch (e: any) {
        console.error("Failed to update pick slip", e);
        toast.error(e.response?.data?.message || "Failed to update pick slip");
    }
    return null;
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
