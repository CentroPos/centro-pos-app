import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { Checkbox } from '@renderer/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@renderer/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import { toast } from 'sonner'
import { usePOSTabStore } from '@renderer/store/usePOSTabStore'
import { usePOSProfileStore } from '@renderer/store/usePOSProfileStore'

interface InvoiceItem {
  original_sales_invoice_item?: string
  item_code: string
  item_name: string
  qty?: number
  rate?: number
  amount?: number
  uom: string
  original_qty?: number
  already_returned_qty?: number
  returnable_qty: number
}

interface InvoiceData {
  name: string
  customer_name: string
  posting_date: string
  grand_total: number
  total_order_qty?: number
  total_unique_items?: number
  items: InvoiceItem[]
}

interface ReturnModalProps {
  isOpen: boolean
  onClose: () => void
  onReturnSuccess?: () => void
}

const ReturnModal: React.FC<ReturnModalProps> = ({ isOpen, onClose, onReturnSuccess }) => {
  const { getCurrentTab, updateTabInstantPrintUrl, getCurrentTabInvoiceNumber, updateTabOrderData, updateTabInvoiceNumber, activeTabId } = usePOSTabStore()
  const { profile } = usePOSProfileStore()
  const currentTab = getCurrentTab()
  const storedInvoiceNumber = getCurrentTabInvoiceNumber()
  const currencySymbol = profile?.custom_currency_symbol || profile?.currency_symbol || profile?.currency || 'SAR'
  const [invoiceNumber, setInvoiceNumber] = useState('')
  
  // Log invoice number state
  console.log('📋 [ReturnModal] Invoice number state:', {
    storedInvoiceNumber,
    localInvoiceNumber: invoiceNumber,
    currentTabId: currentTab?.id,
    currentTabOrderId: currentTab?.orderId,
    currentTabInvoiceNumber: currentTab?.invoiceNumber,
    hasOrderData: !!currentTab?.orderData,
    orderDataKeys: currentTab?.orderData ? Object.keys(currentTab.orderData) : [],
    orderDataLinkedInvoices: currentTab?.orderData?.linked_invoices,
    orderDataLinkedInvoicesFull: JSON.stringify(currentTab?.orderData?.linked_invoices, null, 2)
  })
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null)
  const [loading, setLoading] = useState(false)
  const [returnLoading, setReturnLoading] = useState(false)
  const [selectedItems, setSelectedItems] = useState<{ [key: string]: { selected: boolean; qty: number; originalQty: number } }>({})
  
  // Calculate selected items count
  const selectedItemsCount = Object.values(selectedItems).filter(item => item.selected).length

  // Reset state when modal opens/closes and set invoice number from store
  useEffect(() => {
    console.log('📋 [ReturnModal] useEffect triggered:', {
      isOpen,
      storedInvoiceNumber,
      currentTabInvoiceNumber: currentTab?.invoiceNumber,
      orderDataLinkedInvoices: currentTab?.orderData?.linked_invoices
    })
    
    if (!isOpen) {
      console.log('📋 [ReturnModal] Modal closing, clearing invoice number')
      setInvoiceNumber('')
      setInvoiceData(null)
      setSelectedItems({})
    } else {
      console.log('📋 [ReturnModal] Modal opening, checking for invoice number...')
      // When modal opens, pre-fill invoice number from store if available
      if (storedInvoiceNumber) {
        console.log('📋 [ReturnModal] ✅ Pre-filling invoice number from store:', storedInvoiceNumber)
        setInvoiceNumber(storedInvoiceNumber)
      } else {
        console.log('📋 [ReturnModal] No invoice number in store, using first linked invoice if available...')
        const linkedInvoices = currentTab?.orderData?.linked_invoices
        const firstInvoice =
          Array.isArray(linkedInvoices) && linkedInvoices.length > 0
            ? linkedInvoices[0]
            : typeof linkedInvoices === 'object' && linkedInvoices
        const invoiceNum = firstInvoice?.name || null
        if (invoiceNum) {
          console.log('📋 [ReturnModal] ✅ Pre-filling invoice number from first linked invoice:', invoiceNum)
          setInvoiceNumber(invoiceNum)
        } else {
          console.log('📋 [ReturnModal] ⚠️ No linked invoices available to pre-fill number')
        }
      }
    }
  }, [isOpen, storedInvoiceNumber, currentTab?.orderData?.linked_invoices])
  
  // Also watch for invoice number updates while modal is open
  useEffect(() => {
    if (isOpen) {
      // Check store first
      if (storedInvoiceNumber && storedInvoiceNumber !== invoiceNumber) {
        console.log('📋 Invoice number updated from store while modal is open, setting it:', storedInvoiceNumber)
        setInvoiceNumber(storedInvoiceNumber)
      } else if (!invoiceNumber) {
        const linkedInvoices = currentTab?.orderData?.linked_invoices
        const firstInvoice =
          Array.isArray(linkedInvoices) && linkedInvoices.length > 0
            ? linkedInvoices[0]
            : typeof linkedInvoices === 'object' && linkedInvoices
        const invoiceNum = firstInvoice?.name || null
        if (invoiceNum && invoiceNum !== invoiceNumber) {
          console.log('📋 Invoice number found in orderData while modal is open, setting it:', invoiceNum)
          setInvoiceNumber(invoiceNum)
        }
      }
    }
  }, [isOpen, storedInvoiceNumber, currentTab?.orderData?.linked_invoices, invoiceNumber])

  // Fetch invoice details when invoice number is entered
  const fetchInvoiceDetails = async (invoiceId: string) => {
    if (!invoiceId.trim()) return

    setLoading(true)
    try {
      console.log('🔍 Fetching return availability for invoice:', invoiceId)
      
      // Get order_id - first try from current tab, then fetch from invoice if needed
      let orderId = currentTab?.orderId
      
      if (!orderId) {
        // Fetch invoice to get the order reference
        try {
          const invoiceResponse = await window.electronAPI?.proxy?.request({
            method: 'GET',
            url: `/api/resource/Sales Invoice/${invoiceId}`
          })
          
          if (invoiceResponse?.data) {
            const invoice = invoiceResponse.data
            let actualInvoice = invoice
            if (invoice.data && typeof invoice.data === 'object') {
              actualInvoice = invoice.data
            }
            // Get order_id from invoice (could be in items or as a reference)
            orderId = actualInvoice?.items?.[0]?.against_sales_order || 
                     actualInvoice?.items?.[0]?.sales_order || 
                     actualInvoice?.against_sales_order ||
                     actualInvoice?.sales_order ||
                     invoiceId // Fallback to invoiceId if no order reference found
            console.log('🔍 Fetched order_id from invoice:', orderId)
          } else {
            orderId = invoiceId // Fallback to invoiceId
          }
        } catch (invoiceError) {
          console.warn('⚠️ Could not fetch invoice to get order_id, using invoiceId:', invoiceError)
          orderId = invoiceId // Fallback to invoiceId
        }
      }
      
      console.log('🔍 Using order_id for return availability:', orderId)
      
      const response = await window.electronAPI?.proxy?.request({
        method: 'GET',
        url: '/api/method/centro_pos_apis.api.order.get_return_availability',
        params: {
          order_id: orderId
        }
      })

      console.log('📄 Return Availability API Response:', response)
      console.log('📄 Response data:', response?.data)

      if (response?.data?.data && Array.isArray(response.data.data)) {
        const items = response.data.data
        
        // Fetch order details to get linked_invoices and customer name
        let invoiceDetails = {
          name: invoiceId,
          customer_name: 'N/A',
          posting_date: 'N/A',
          grand_total: 0,
          total_order_qty: undefined as number | undefined,
          total_unique_items: undefined as number | undefined
        }
        
        try {
          const orderDetailsResponse = await window.electronAPI?.proxy?.request({
            method: 'GET',
            url: '/api/method/centro_pos_apis.api.order.get_sales_order_details',
            params: {
              sales_order_id: orderId
            }
          })
          
          if (orderDetailsResponse?.data?.data) {
            const orderData = orderDetailsResponse.data.data
            console.log('📋 Order details fetched for invoice info:', orderData)
            console.log('📋 Linked invoices:', orderData.linked_invoices)
            
            // Get customer name from order data
            const customerName = orderData.customer_name || 'N/A'
            
            // Extract invoice details from linked_invoices
            const linkedInvoices = orderData.linked_invoices
            const firstInvoice =
              Array.isArray(linkedInvoices) && linkedInvoices.length > 0
                ? linkedInvoices[0]
                : typeof linkedInvoices === 'object'
                  ? linkedInvoices
                  : null
            if (firstInvoice) {
              invoiceDetails = {
                name: firstInvoice.name || invoiceId,
                customer_name: customerName,
                posting_date: firstInvoice.posting_date || 'N/A',
                grand_total: typeof firstInvoice.grand_total === 'number' ? firstInvoice.grand_total : 0,
                total_order_qty: typeof orderData.total_order_qty === 'number' ? orderData.total_order_qty : undefined,
                total_unique_items: typeof orderData.total_unique_items === 'number' ? orderData.total_unique_items : undefined
              }
              console.log('📋 Invoice details extracted from first linked invoice:', invoiceDetails)
            } else {
              invoiceDetails.customer_name = customerName
            }
          }
        } catch (orderError) {
          console.warn('⚠️ Could not fetch order details, using defaults:', orderError)
        }

        const invoiceData = {
          ...invoiceDetails,
          items: items
        }

        console.log('📄 Processed invoice data:', invoiceData)
        setInvoiceData(invoiceData)

        // Initialize selected items with checkboxes unchecked and returnable quantities
        const initialSelectedItems: { [key: string]: { selected: boolean; qty: number; originalQty: number } } = {}
        items.forEach((item: InvoiceItem) => {
          if (item.item_code) {
            const returnableQty = typeof item.returnable_qty === 'number' ? item.returnable_qty : 0
            initialSelectedItems[item.item_code] = {
              selected: false,
              qty: returnableQty, // Pre-fill with returnable quantity
              originalQty: returnableQty
            }
          }
        })
        setSelectedItems(initialSelectedItems)

        toast.success('Return availability loaded successfully!', { duration: 2000 })
      } else {
        toast.error('No returnable items found for this invoice.', { duration: 5000 })
        setInvoiceData(null)
        setSelectedItems({})
      }
    } catch (error) {
      console.error('❌ Error fetching return availability:', error)
      toast.error('Failed to fetch return availability. Please try again.', { duration: 5000 })
      setInvoiceData(null)
      setSelectedItems({})
    } finally {
      setLoading(false)
    }
  }

  // Handle invoice number input with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (invoiceNumber.trim()) {
        fetchInvoiceDetails(invoiceNumber.trim())
      }
    }, 500) // 500ms debounce

    return () => clearTimeout(timeoutId)
  }, [invoiceNumber])

  // Handle item selection checkbox
  const handleItemSelect = (itemCode: string, selected: boolean) => {
    // If trying to select, check if returnable_qty is 0
    if (selected) {
      const item = invoiceData?.items?.find((it: InvoiceItem) => it.item_code === itemCode)
      const returnableQty = typeof item?.returnable_qty === 'number' ? item.returnable_qty : 0
      
      if (returnableQty === 0) {
        // Show error message and prevent selection
        toast.error('Cannot select item with zero returnable quantity', {
          position: 'bottom-right'
        })
        return
      }
    }
    
    setSelectedItems(prev => {
      const currentItem = prev[itemCode]
      // Get returnable_qty from the item in invoiceData
      const item = invoiceData?.items?.find((it: InvoiceItem) => it.item_code === itemCode)
      const returnableQty = typeof item?.returnable_qty === 'number' ? item.returnable_qty : (currentItem?.originalQty ?? 0)
      return {
      ...prev,
      [itemCode]: {
        ...prev[itemCode],
          selected,
          originalQty: returnableQty,
          // When selected, always auto-fill with returnable qty
          // When deselected, keep the current qty (or returnableQty if not set)
          qty: selected ? returnableQty : (currentItem?.qty ?? returnableQty)
        }
      }
    })
  }

  // Handle select all checkbox
  const handleSelectAll = (checked: boolean) => {
    if (!invoiceData) return
    
    // If trying to select all, check if any items have returnable_qty = 0
    if (checked) {
      const itemsWithZeroQty = invoiceData.items.filter((item: InvoiceItem) => {
        const returnableQty = typeof item.returnable_qty === 'number' ? item.returnable_qty : 0
        return returnableQty === 0
      })
      
      if (itemsWithZeroQty.length > 0) {
        toast.error(`Cannot select ${itemsWithZeroQty.length} item(s) with zero returnable quantity`, {
          position: 'bottom-right'
        })
      }
    }
    
    setSelectedItems(prev => {
      const updated: { [key: string]: { selected: boolean; qty: number; originalQty: number } } = { ...prev }
      invoiceData.items.forEach((item: InvoiceItem) => {
        if (item.item_code) {
          const returnableQty = typeof item.returnable_qty === 'number' ? item.returnable_qty : 0
          // Only select items with returnable_qty > 0
          const shouldSelect = checked && returnableQty > 0
          updated[item.item_code] = {
            selected: shouldSelect,
            qty: shouldSelect ? returnableQty : (updated[item.item_code]?.qty ?? returnableQty),
            originalQty: returnableQty
          }
        }
      })
      return updated
    })
  }

  // Check if all items are selected
  const areAllItemsSelected = () => {
    if (!invoiceData || invoiceData.items.length === 0) return false
    return invoiceData.items.every((item: InvoiceItem) => {
      if (!item.item_code) return true
      return selectedItems[item.item_code]?.selected === true
    })
  }

  // Handle quantity change for selected items
  const handleQuantityChange = (itemCode: string, qty: number) => {
    // Convert to number and ensure it's not negative
    const numericQty = parseFloat(qty.toString()) || 0
    const validQty = Math.max(0, numericQty)
    
    setSelectedItems(prev => ({
      ...prev,
      [itemCode]: {
        ...prev[itemCode],
        qty: validQty
      }
    }))
  }

  // Process return order
  const handleReturnOrder = async () => {
    if (!invoiceData) {
      toast.error('No invoice data available.', { duration: 5000 })
      return
    }

    // Get selected items with quantities
    const itemsToReturn = Object.entries(selectedItems)
      .filter(([, itemData]) => itemData.selected && itemData.qty > 0)
      .map(([itemCode, itemData]) => ({
        item_code: itemCode,
        qty: typeof itemData.qty === 'number' ? itemData.qty : 0
      }))

    if (itemsToReturn.length === 0) {
      toast.error('Please select at least one item to return.', { duration: 5000 })
      return
    }

    setReturnLoading(true)
    try {
      console.log('🔄 Processing return order for invoice:', invoiceData.name)
      console.log('📦 Items to return:', itemsToReturn)

      const response = await window.electronAPI?.proxy?.request({
        method: 'POST',
        url: '/api/method/centro_pos_apis.api.order.return_order',
        data: {
          original_invoice: invoiceData.name,
          items: itemsToReturn
        }
      })

      console.log('✅ Return order API response:', response)

      if (response?.data || response?.success) {
        // Extract pdf_download_url from response
        const pdfUrl = response.data?.data?.pdf_download_url || response.data?.pdf_download_url || response?.data?.pdf_download_url
        if (pdfUrl && currentTab) {
          updateTabInstantPrintUrl(currentTab.id, pdfUrl)
        }
        
        // Clear cached customer insights to trigger refresh in right panel
        // Don't update _lastKnownStatus yet - let the right panel detect the change
        if (currentTab?.orderData?._relatedData && currentTab?.id) {
          const updatedOrderData = {
            ...currentTab.orderData,
            _relatedData: {
              ...currentTab.orderData._relatedData,
              customerInsights: null,
              customerDetails: null
            }
            // Keep _lastKnownStatus as is so right panel can detect the change
          }
          updateTabOrderData(currentTab.id, updatedOrderData)
          console.log('🔄 Cleared cached customer insights after return to trigger refresh')
        }
        
        toast.success('Return order processed successfully!', { duration: 2000 })
        // After successful return, fetch latest order details to refresh status immediately
        try {
          // Get the latest tab reference using activeTabId to ensure we have the current tab
          const store = usePOSTabStore.getState()
          const latestTab = activeTabId ? store.tabs.find(t => t.id === activeTabId) : (currentTab || store.getCurrentTab())
          const latestOrderId = latestTab?.orderId
          const tabId = latestTab?.id || activeTabId
          
          if (latestOrderId && tabId) {
            console.log('🔄 Fetching order details after return for order:', latestOrderId, 'tabId:', tabId)
            const res = await window.electronAPI?.proxy?.request({
              url: '/api/method/centro_pos_apis.api.order.get_sales_order_details',
              params: { sales_order_id: latestOrderId },
              method: 'GET'
            })
            const orderData = res?.data?.data
            if (orderData) {
              console.log('📋 Order details fetched after return:', {
                order_status: orderData.order_status,
                linked_invoices: orderData.linked_invoices
              })
              console.log('🎨 Order details after return - Status colors:', {
                status_color: orderData.status_color,
                zatca_color: orderData.zatca_color,
                main_status: orderData.main_status,
                zatca_status: orderData.zatca_status
              })
              
              // Update order data
              updateTabOrderData(tabId, orderData)
              
              // Extract and update invoice-related fields from linked_invoices
              const linkedInvoices = orderData.linked_invoices
              let invoiceNumber: string | null = null
              let invoiceStatus: string | null = null
              let invoiceCustomReverseStatus: string | null = null
              
              if (linkedInvoices) {
                if (Array.isArray(linkedInvoices) && linkedInvoices.length > 0) {
                  const firstInvoice = linkedInvoices[0]
                  invoiceNumber = firstInvoice?.name || null
                  invoiceStatus = firstInvoice?.status || null
                  invoiceCustomReverseStatus = firstInvoice?.custom_reverse_status || null
                } else if (linkedInvoices && typeof linkedInvoices === 'object' && !Array.isArray(linkedInvoices)) {
                  invoiceNumber = linkedInvoices.name || null
                  invoiceStatus = linkedInvoices.status || null
                  invoiceCustomReverseStatus = linkedInvoices.custom_reverse_status || null
                }
              }
              
              // Update invoice fields if we have invoice data
              if (invoiceNumber) {
                console.log('📋 Updating invoice fields after return:', {
                  invoiceNumber,
                  invoiceStatus,
                  invoiceCustomReverseStatus
                })
                updateTabInvoiceNumber(tabId, invoiceNumber, invoiceStatus, invoiceCustomReverseStatus)
              } else {
                // Even if no invoice number, update with null to clear any stale data
                console.log('📋 No invoice number found, clearing invoice fields')
                updateTabInvoiceNumber(tabId, null, null, null)
              }
              
              console.log('✅ Order details and invoice fields updated after return')
            } else {
              console.warn('⚠️ No order data received from API after return')
            }
          } else {
            console.warn('⚠️ Cannot refresh order details: missing orderId or tabId', {
              latestOrderId,
              tabId,
              activeTabId
            })
          }
        } catch (e) {
          console.error('⚠️ Failed to refresh order after return:', e)
        }
        onReturnSuccess?.()
        onClose()
      } else {
        toast.error('Failed to process return order. Please try again.', { duration: 5000 })
      }
    } catch (error) {
      console.error('❌ Error processing return order:', error)
      toast.error('Failed to process return order. Please try again.', { duration: 5000 })
    } finally {
      setReturnLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="!max-w-[2625px] sm:!max-w-[800px] w-[98vw] h-[85vh] max-h-[900px] bg-white border-2 border-gray-200 shadow-2xl flex flex-col">
        <DialogHeader className="pb-4 border-b border-gray-200">
          <DialogTitle className="text-xl font-semibold text-gray-800 font-sans">
            Process Return Order
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
          {/* Invoice Number Input */}
          <div className="space-y-2">
            <Label htmlFor="invoice-number" className="text-sm font-medium text-gray-700 font-sans">
              Invoice Number
            </Label>
            <Input
              id="invoice-number"
              type="text"
              placeholder="Enter invoice number (e.g., ACC-SINV-2025-00009)"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="w-full font-sans border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-8 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <i className="fas fa-spinner fa-spin text-lg text-blue-500"></i>
                <span className="text-gray-600 font-sans">Loading invoice details...</span>
              </div>
            </div>
          )}

          {/* Invoice Details */}
          {invoiceData && !loading && (
            <div className="flex-1 flex flex-col space-y-3 overflow-hidden">
              {/* Invoice Summary */}
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <div className="grid grid-cols-2 gap-3 text-sm font-sans">
                  <div>
                    <span className="font-medium text-gray-600">Invoice:</span>
                    <span className="ml-2 text-gray-800 font-medium">{invoiceData.name}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Customer:</span>
                    <span className="ml-2 text-gray-800 font-medium">{invoiceData.customer_name}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Date:</span>
                    <span className="ml-2 text-gray-800 font-medium">{invoiceData.posting_date}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Total:</span>
                    <span className="ml-2 text-gray-800 font-medium">{currencySymbol} {(invoiceData.grand_total || 0).toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Total Qty:</span>
                    <span className="ml-2 text-gray-800 font-medium">{invoiceData.total_order_qty ?? '—'}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Total Items:</span>
                    <span className="ml-2 text-gray-800 font-medium">{invoiceData.total_unique_items ?? '—'}</span>
                  </div>
                </div>
              </div>

              {/* Items Table with Tabs */}
              <div className="flex-1 flex flex-col space-y-2 overflow-hidden min-h-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-gray-800 font-sans">Select Items to Return</h3>
                  {(() => {
                    // Calculate total amount for selected items
                    const totalAmount = invoiceData.items
                      .filter((item) => {
                        const itemCode = item.item_code || ''
                        return selectedItems[itemCode]?.selected === true
                      })
                      .reduce((sum, item) => {
                        const itemCode = item.item_code || ''
                        const rate = typeof item.rate === 'number' ? item.rate : 0
                        const qty = selectedItems[itemCode]?.qty ?? 0
                        return sum + (rate * qty)
                      }, 0)
                    return (
                      <span className="text-base font-bold text-gray-800 font-sans">
                        Total Selected Amount: {currencySymbol} {totalAmount.toFixed(2)}
                      </span>
                    )
                  })()}
                </div>
                <Tabs defaultValue="items" className="flex-1 flex flex-col overflow-hidden min-h-0 relative">
                  <TabsList className="grid w-full grid-cols-2 bg-gray-100 p-1 rounded-lg flex-shrink-0">
                    <TabsTrigger 
                      value="items"
                      className="data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm font-sans"
                    >
                      Items
                    </TabsTrigger>
                    <TabsTrigger 
                      value="selected"
                      className="data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm font-sans relative"
                    >
                      Selected Items
                      {selectedItemsCount > 0 && (
                        <span className="ml-2 min-w-[18px] h-[18px] px-1.5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                          {selectedItemsCount}
                        </span>
                      )}
                    </TabsTrigger>
                  </TabsList>
                  
                  {/* Items Tab */}
                  <TabsContent value="items" className="mt-2 flex-1 flex flex-col overflow-hidden min-h-0 data-[state=inactive]:hidden !relative">
                    <div className="border-2 border-gray-200 rounded-lg overflow-hidden bg-white flex-1 flex flex-col min-h-0">
                      <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0">
                        <Table className="w-full">
                    <TableHeader className="sticky top-0 bg-gray-100 z-10">
                      <TableRow className="bg-gray-100 border-b-2 border-gray-200">
                              <TableHead className="w-16 font-sans font-semibold text-gray-700">
                                <Checkbox
                                  checked={areAllItemsSelected()}
                                  onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                                />
                              </TableHead>
                              <TableHead className="font-sans font-semibold text-gray-700 w-[180px]">Item Code</TableHead>
                        <TableHead className="font-sans font-semibold text-gray-700 min-w-[300px]">Item Name</TableHead>
                        <TableHead className="font-sans font-semibold text-gray-700 w-[100px]">UOM</TableHead>
                        <TableHead className="text-right font-sans font-semibold text-gray-700 w-[130px]">Rate</TableHead>
                        <TableHead className="text-right font-sans font-semibold text-gray-700 w-[150px]">Returnable Qty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoiceData.items.map((item, index) => {
                        // Safely extract item data with fallbacks
                        const itemCode = item.item_code || `item-${index}`
                        const itemName = item.item_name || 'Unknown Item'
                        const uom = item.uom || 'Nos'
                        const rate = typeof item.rate === 'number' ? item.rate : 0
                        const returnableQty = typeof item.returnable_qty === 'number' ? item.returnable_qty : 0
                        
                        return (
                          <TableRow key={index} className="hover:bg-gray-50 border-b border-gray-100">
                            <TableCell className="py-3">
                              <Checkbox
                                checked={selectedItems[itemCode]?.selected || false}
                                onCheckedChange={(checked) => 
                                  handleItemSelect(itemCode, checked as boolean)
                                }
                              />
                            </TableCell>
                            <TableCell className="font-medium font-sans text-gray-800">{itemCode}</TableCell>
                                  <TableCell className="font-sans text-gray-700" title={itemName}>
                                    {itemName}
                                  </TableCell>
                                  <TableCell className="font-sans text-gray-700 text-left">{uom}</TableCell>
                                  <TableCell className="text-right font-sans text-gray-700">{rate.toFixed(2)}</TableCell>
                                  <TableCell className="text-right font-sans text-gray-700">{returnableQty}</TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </TabsContent>
                  
                  {/* Selected Items Tab */}
                  <TabsContent value="selected" className="mt-2 flex-1 flex flex-col overflow-hidden min-h-0 data-[state=inactive]:hidden !relative">
                    <div className="border-2 border-gray-200 rounded-lg overflow-hidden bg-white flex-1 flex flex-col min-h-0">
                      <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0">
                        <Table className="w-full">
                          <TableHeader className="sticky top-0 bg-gray-100 z-10">
                            <TableRow className="bg-gray-100 border-b-2 border-gray-200">
                              <TableHead className="font-sans font-semibold text-gray-700 w-[180px]">Item Code</TableHead>
                              <TableHead className="font-sans font-semibold text-gray-700 min-w-[300px]">Item Name</TableHead>
                              <TableHead className="font-sans font-semibold text-gray-700 w-[100px]">UOM</TableHead>
                              <TableHead className="text-right font-sans font-semibold text-gray-700 w-[130px]">Rate</TableHead>
                              <TableHead className="text-right font-sans font-semibold text-gray-700 w-[150px]">Returnable Qty</TableHead>
                              <TableHead className="text-right font-sans font-semibold text-gray-700 w-[150px]">Qty</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {invoiceData.items
                              .filter((item) => {
                                const itemCode = item.item_code || ''
                                return selectedItems[itemCode]?.selected === true
                              })
                              .map((item, index) => {
                                // Safely extract item data with fallbacks
                                const itemCode = item.item_code || `item-${index}`
                                const itemName = item.item_name || 'Unknown Item'
                                const uom = item.uom || 'Nos'
                                const rate = typeof item.rate === 'number' ? item.rate : 0
                                const returnableQty = typeof item.returnable_qty === 'number' ? item.returnable_qty : (selectedItems[itemCode]?.originalQty ?? 0)
                                const returnQty = selectedItems[itemCode]?.qty ?? returnableQty
                                
                                return (
                                  <TableRow key={index} className="hover:bg-gray-50 border-b border-gray-100">
                                    <TableCell className="font-medium font-sans text-gray-800">{itemCode}</TableCell>
                                    <TableCell className="font-sans text-gray-700" title={itemName}>
                                      {itemName}
                                    </TableCell>
                                    <TableCell className="font-sans text-gray-700 text-left">{uom}</TableCell>
                                    <TableCell className="text-right font-sans text-gray-700">{rate.toFixed(2)}</TableCell>
                                    <TableCell className="text-right font-sans text-gray-700">{returnableQty}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end">
                                <Input
                                  type="number"
                                  min="0"
                                          max={returnableQty}
                                          value={returnQty.toString()}
                                  onChange={(e) => {
                                    const inputValue = e.target.value
                                    // Allow empty string for clearing, or parse as number
                                    if (inputValue === '') {
                                      handleQuantityChange(itemCode, 0)
                                    } else {
                                      const numericValue = parseFloat(inputValue)
                                      if (!isNaN(numericValue)) {
                                        handleQuantityChange(itemCode, numericValue)
                                      }
                                    }
                                  }}
                                  onBlur={(e) => {
                                    // Ensure we have a valid number on blur
                                    const value = parseFloat(e.target.value) || 0
                                            // Ensure value doesn't exceed returnable qty
                                            const validValue = Math.min(value, returnableQty)
                                            handleQuantityChange(itemCode, validValue)
                                  }}
                                          className="w-20 text-right font-sans border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                  placeholder="0"
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                            {invoiceData.items.filter((item) => {
                              const itemCode = item.item_code || ''
                              return selectedItems[itemCode]?.selected === true
                            }).length === 0 && (
                              <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-gray-500 font-sans">
                                  No items selected. Please select items from the &quot;Items&quot; tab.
                                </TableCell>
                              </TableRow>
                            )}
                    </TableBody>
                    </Table>
                  </div>
                </div>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 flex-shrink-0">
                <Button
                  variant="outline"
                  onClick={onClose}
                  disabled={returnLoading}
                  className="font-sans border-2 border-gray-300 hover:bg-gray-50"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleReturnOrder}
                  disabled={returnLoading || Object.values(selectedItems).every(item => !item.selected)}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-sans font-medium px-6 py-2 flex items-center gap-2"
                >
                  {returnLoading ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i>
                      Processing Return...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="arrow-rotate-left" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor">
                        <path d="M125.7 160H176c17.7 0 32 14.3 32 32s-14.3 32-32 32H48c-17.7 0-32-14.3-32-32V64c0-17.7 14.3-32 32-32s32 14.3 32 32v51.2L97.6 97.6c87.5-87.5 229.3-87.5 316.8 0s87.5 229.3 0 316.8s-229.3 87.5-316.8 0c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0c62.5 62.5 163.8 62.5 226.3 0s62.5-163.8 0-226.3s-163.8-62.5-226.3 0L125.7 160z"></path>
                      </svg>
                      Process Return
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ReturnModal
