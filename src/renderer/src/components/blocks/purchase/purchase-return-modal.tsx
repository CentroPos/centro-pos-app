import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { Checkbox } from '@renderer/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@renderer/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import { toast } from 'sonner'
import { usePurchaseTabStore } from '@renderer/store/usePurchaseTabStore'
import { usePOSProfileStore } from '@renderer/store/usePOSProfileStore'

interface InvoiceItem {
  original_purchase_invoice_item?: string
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
  supplier_name: string
  posting_date: string
  grand_total: number
  items: InvoiceItem[]
  total_order_qty?: number
  total_unique_items?: number
}

interface PurchaseReturnModalProps {
  isOpen: boolean
  onClose: () => void
  onReturnSuccess?: () => void
}

const PurchaseReturnModal: React.FC<PurchaseReturnModalProps> = ({ isOpen, onClose, onReturnSuccess }) => {
  const { getCurrentTab, updateTabOrderData, activeTabId } = usePurchaseTabStore()
  const { profile } = usePOSProfileStore()
  const currentTab = getCurrentTab()
  const currencySymbol = profile?.custom_currency_symbol || profile?.currency_symbol || profile?.currency || 'SAR'
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null)
  const [loading, setLoading] = useState(false)
  const [returnLoading, setReturnLoading] = useState(false)
  const [selectedItems, setSelectedItems] = useState<{ [key: string]: { selected: boolean; qty: number; originalQty: number; itemCode: string; originalPurchaseInvoiceItem: string } }>({})
  const [searchQuery, setSearchQuery] = useState('')
  
  // Calculate selected items count
  const selectedItemsCount = Object.values(selectedItems).filter(item => item.selected).length

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setInvoiceData(null)
      setSelectedItems({})
      setSearchQuery('')
      setLoading(false)
      setReturnLoading(false)
      
      // Try to get purchase invoice from order data
      if (currentTab?.orderData?.linked_invoices) {
        const linkedInvoices = currentTab.orderData.linked_invoices
        if (Array.isArray(linkedInvoices) && linkedInvoices.length > 0) {
          const firstInvoice = linkedInvoices[0]
          const invoiceNum = firstInvoice?.purchase_invoice_no || firstInvoice?.name || firstInvoice?.invoice_no
          if (invoiceNum) {
            console.log('📋 Auto-filling purchase invoice number from order data:', invoiceNum)
            setInvoiceNumber(invoiceNum)
          }
        }
      }
    }
  }, [isOpen, currentTab?.orderData?.linked_invoices])

  // Fetch purchase invoice details when invoice number is entered
  const fetchInvoiceDetails = async (invoiceId: string) => {
    if (!invoiceId.trim()) return

    setLoading(true)
    try {
      console.log('🔍 Fetching purchase return availability for purchase order:', currentTab?.purchaseOrderId)
      
      const purchaseOrderId = currentTab?.purchaseOrderId
      if (!purchaseOrderId) {
        toast.error('Purchase order ID not found')
        return
      }
      
      const response = await window.electronAPI?.proxy?.request({
        method: 'GET',
        url: '/api/method/centro_pos_apis.api.purchase.get_purchase_return_availability',
        params: {
          purchase_order_id: purchaseOrderId
        }
      })

      console.log('📄 Purchase Return Availability API Response:', response)

      if (response?.data?.data && Array.isArray(response.data.data)) {
        const items = response.data.data
        
        // Fetch purchase order details to get supplier name and invoice info
        let invoiceDetails = {
          name: invoiceId,
          supplier_name: 'N/A',
          posting_date: 'N/A',
          grand_total: 0,
          total_order_qty: undefined as number | undefined,
          total_unique_items: undefined as number | undefined
        }
        
        try {
          const orderDetailsResponse = await window.electronAPI?.proxy?.request({
            method: 'GET',
            url: '/api/method/centro_pos_apis.api.purchase.get_purchase_order_details',
            params: {
              purchase_order_id: purchaseOrderId
            }
          })
          
          if (orderDetailsResponse?.data?.data) {
            const orderData = orderDetailsResponse.data.data
            console.log('📋 Purchase order details fetched for invoice info:', orderData)
            
            // Get supplier name from order data
            const supplierName = orderData.supplier_name || 'N/A'
            
            // Extract invoice details from linked_invoices
            const linkedInvoices = orderData.linked_invoices
            const firstInvoice =
              Array.isArray(linkedInvoices) && linkedInvoices.length > 0
                ? linkedInvoices[0]
                : null

            if (firstInvoice) {
              invoiceDetails = {
                name: firstInvoice.purchase_invoice_no || firstInvoice.name || invoiceId,
                supplier_name: supplierName,
                posting_date: firstInvoice.posting_date || orderData.posting_date || 'N/A',
                grand_total: Number(firstInvoice.grand_total || firstInvoice.outstanding_amount || 0),
                total_order_qty: orderData.total_order_qty,
                total_unique_items: orderData.total_unique_items
              }
            } else {
              invoiceDetails = {
                name: invoiceId,
                supplier_name: supplierName,
                posting_date: orderData.posting_date || 'N/A',
                grand_total: Number(orderData.grand_total || 0),
                total_order_qty: orderData.total_order_qty,
                total_unique_items: orderData.total_unique_items
              }
            }
          }
        } catch (orderError) {
          console.warn('⚠️ Could not fetch purchase order details:', orderError)
        }
        
        const invoiceData: InvoiceData = {
          ...invoiceDetails,
          items: items.map((item: any) => ({
            original_purchase_invoice_item: item.original_purchase_invoice_item || item.name || '',
            item_code: item.item_code || '',
            item_name: item.item_name || '',
            qty: Number(item.qty || 0),
            rate: Number(item.rate || 0),
            amount: Number(item.amount || 0),
            uom: item.uom || '',
            original_qty: Number(item.original_qty || item.qty || 0),
            already_returned_qty: Number(item.already_returned_qty || 0),
            returnable_qty: Number(item.returnable_qty || 0)
          }))
        }
        
        setInvoiceData(invoiceData)
        
        // Initialize selected items with checkboxes unchecked and returnable quantities
        // Use original_purchase_invoice_item as key to avoid multi-select issues with duplicate item codes
        const initialSelectedItems: { [key: string]: { selected: boolean; qty: number; originalQty: number; itemCode: string; originalPurchaseInvoiceItem: string } } = {}
        invoiceData.items.forEach((item: InvoiceItem) => {
          // Use original_purchase_invoice_item as the key, fallback to item_code if not available
          const key = item.original_purchase_invoice_item || item.item_code
          if (key) {
            const returnableQty = typeof item.returnable_qty === 'number' ? item.returnable_qty : 0
            initialSelectedItems[key] = {
              selected: false,
              qty: returnableQty, // Pre-fill with returnable quantity
              originalQty: returnableQty,
              itemCode: item.item_code || '',
              originalPurchaseInvoiceItem: item.original_purchase_invoice_item || ''
            }
          }
        })
        setSelectedItems(initialSelectedItems)
        
        console.log('✅ Purchase invoice data loaded:', invoiceData)
      } else {
        toast.error('No returnable items found for this purchase invoice.', { duration: 5000 })
        setInvoiceData(null)
      }
    } catch (error: any) {
      console.error('❌ Error fetching purchase return availability:', error)
      toast.error(error?.response?.data?.message || error?.message || 'Failed to fetch purchase return availability', { duration: 5000 })
      setInvoiceData(null)
    } finally {
      setLoading(false)
    }
  }

  // Handle invoice number input and fetch
  useEffect(() => {
    if (invoiceNumber.trim() && isOpen) {
      const timeoutId = setTimeout(() => {
        fetchInvoiceDetails(invoiceNumber.trim())
      }, 500)
      return () => clearTimeout(timeoutId)
    }
  }, [invoiceNumber, isOpen])

  // Handle item selection checkbox
  // key is original_purchase_invoice_item (or item_code as fallback)
  const handleItemSelect = (key: string, selected: boolean) => {
    // Find the item by original_purchase_invoice_item or item_code
    const item = invoiceData?.items?.find((it: InvoiceItem) => 
      (it.original_purchase_invoice_item && it.original_purchase_invoice_item === key) ||
      (!it.original_purchase_invoice_item && it.item_code === key)
    )
    
    // If trying to select, check if returnable_qty is 0
    if (selected) {
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
      const currentItem = prev[key]
      // Get returnable_qty from the item in invoiceData
      const returnableQty = typeof item?.returnable_qty === 'number' ? item.returnable_qty : (currentItem?.originalQty ?? 0)
      return {
        ...prev,
        [key]: {
          ...prev[key],
          selected,
          originalQty: returnableQty,
          itemCode: item?.item_code || currentItem?.itemCode || '',
          originalPurchaseInvoiceItem: item?.original_purchase_invoice_item || currentItem?.originalPurchaseInvoiceItem || key,
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
      const updated: { [key: string]: { selected: boolean; qty: number; originalQty: number; itemCode: string; originalPurchaseInvoiceItem: string } } = { ...prev }
      invoiceData.items.forEach((item: InvoiceItem) => {
        // Use original_purchase_invoice_item as key, fallback to item_code
        const key = item.original_purchase_invoice_item || item.item_code
        if (key) {
          const returnableQty = typeof item.returnable_qty === 'number' ? item.returnable_qty : 0
          // Only select items with returnable_qty > 0
          const shouldSelect = checked && returnableQty > 0
          updated[key] = {
            selected: shouldSelect,
            qty: shouldSelect ? returnableQty : (updated[key]?.qty ?? returnableQty),
            originalQty: returnableQty,
            itemCode: item.item_code || '',
            originalPurchaseInvoiceItem: item.original_purchase_invoice_item || ''
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
      const key = item.original_purchase_invoice_item || item.item_code
      if (!key) return true
      return selectedItems[key]?.selected === true
    })
  }

  // Handle quantity change for selected items
  // key is original_purchase_invoice_item (or item_code as fallback)
  const handleQuantityChange = (key: string, qty: number) => {
    // Convert to number and ensure it's not negative
    const numericQty = parseFloat(qty.toString()) || 0
    const validQty = Math.max(0, numericQty)
    
    setSelectedItems(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
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
    // Include original_purchase_invoice_item in the API call
    const itemsToReturn = Object.entries(selectedItems)
      .filter(([, itemData]) => itemData.selected && itemData.qty > 0)
      .map(([, itemData]) => ({
        original_purchase_invoice_item: itemData.originalPurchaseInvoiceItem || '',
        item_code: itemData.itemCode,
        qty: typeof itemData.qty === 'number' ? itemData.qty : 0
      }))

    if (itemsToReturn.length === 0) {
      toast.error('Please select at least one item to return.', { duration: 5000 })
      return
    }

    setReturnLoading(true)
    try {
      console.log('🔄 Processing purchase return for invoice:', invoiceData.name)
      console.log('📦 Items to return:', itemsToReturn)

      const response = await window.electronAPI?.proxy?.request({
        method: 'POST',
        url: '/api/method/centro_pos_apis.api.purchase.return_purchase_order',
        data: {
          original_invoice_id: invoiceData.name,
          items: itemsToReturn
        }
      })

      console.log('✅ Purchase return API response:', response)

      if (response?.data || response?.success) {
        toast.success('Purchase return processed successfully!', { duration: 2000 })
        
        // Refresh purchase order data after return
        if (activeTabId && currentTab?.purchaseOrderId) {
          try {
            const res = await window.electronAPI?.proxy?.request({
              url: '/api/method/centro_pos_apis.api.purchase.get_purchase_order_details',
              params: {
                purchase_order_id: currentTab.purchaseOrderId
              }
            })
            if (res?.data?.data) {
              updateTabOrderData(activeTabId, res.data.data)
            }
          } catch (refreshError) {
            console.error('❌ Failed to refresh purchase order data:', refreshError)
          }
        }
        
        onReturnSuccess?.()
        onClose()
      } else {
        toast.error('Failed to process purchase return.', { duration: 5000 })
      }
    } catch (error: any) {
      console.error('❌ Error processing purchase return:', error)
      toast.error(error?.response?.data?.message || error?.message || 'Failed to process purchase return', { duration: 5000 })
    } finally {
      setReturnLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="!max-w-[2625px] sm:!max-w-[800px] w-[98vw] h-[85vh] max-h-[900px] bg-white border-2 border-gray-200 shadow-2xl flex flex-col">
        <DialogHeader className="pb-4 border-b border-gray-200">
          <DialogTitle className="text-xl font-semibold text-gray-800 font-sans">
            Process Return Purchase Order
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
          {/* Invoice Number Input - Hidden but functional for auto-population */}
          <div className="hidden">
            <Label htmlFor="invoice-number" className="text-sm font-medium text-gray-700 font-sans">
              Purchase Invoice Number
            </Label>
            <Input
              id="invoice-number"
              type="text"
              placeholder="Enter purchase invoice number"
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
                    <span className="font-medium text-gray-600">Supplier:</span>
                    <span className="ml-2 text-gray-800 font-medium">{invoiceData.supplier_name}</span>
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
                        const selectionKey = item.original_purchase_invoice_item || item.item_code || ''
                        return selectedItems[selectionKey]?.selected === true
                      })
                      .reduce((sum, item) => {
                        const selectionKey = item.original_purchase_invoice_item || item.item_code || ''
                        const rate = typeof item.rate === 'number' ? item.rate : 0
                        const qty = selectedItems[selectionKey]?.qty ?? 0
                        return sum + (rate * qty)
                      }, 0)
                    return (
                      <span className="text-base font-bold text-gray-800 font-sans">
                        Total Selected Amount: {currencySymbol} {totalAmount.toFixed(2)}
                      </span>
                    )
                  })()}
                </div>
                
                {/* Search Box */}
                <div className="space-y-2">
                  <Input
                    type="text"
                    placeholder="🔍 Search items by code or name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-1/2 font-sans border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
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
                              <TableHead className="font-sans font-semibold text-gray-700">Item Code</TableHead>
                              <TableHead className="font-sans font-semibold text-gray-700">Item Name</TableHead>
                              <TableHead className="font-sans font-semibold text-gray-700">UOM</TableHead>
                              <TableHead className="text-right font-sans font-semibold text-gray-700">Rate</TableHead>
                              <TableHead className="text-right font-sans font-semibold text-gray-700">Returnable Qty</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {invoiceData.items
                              .filter((item) => {
                                if (!searchQuery.trim()) return true
                                const searchLower = searchQuery.toLowerCase().trim()
                                const itemCode = (item.item_code || '').toLowerCase()
                                const itemName = (item.item_name || '').toLowerCase()
                                return itemCode.includes(searchLower) || itemName.includes(searchLower)
                              })
                              .map((item, index) => {
                                // Safely extract item data with fallbacks
                                const itemCode = item.item_code || `item-${index}`
                                const itemName = item.item_name || 'Unknown Item'
                                const uom = item.uom || 'Nos'
                                const rate = typeof item.rate === 'number' ? item.rate : 0
                                const returnableQty = typeof item.returnable_qty === 'number' ? item.returnable_qty : 0
                                // Use original_purchase_invoice_item as key for selection, fallback to item_code
                                const selectionKey = item.original_purchase_invoice_item || itemCode
                                
                                return (
                                  <TableRow key={index} className="hover:bg-gray-50 border-b border-gray-100">
                                    <TableCell className="py-3">
                                      <Checkbox
                                        checked={selectedItems[selectionKey]?.selected || false}
                                        onCheckedChange={(checked) => 
                                          handleItemSelect(selectionKey, checked as boolean)
                                        }
                                      />
                                    </TableCell>
                                    <TableCell className="font-medium font-sans text-gray-800 text-xs whitespace-nowrap" style={{ fontSize: '0.75rem' }}>{itemCode}</TableCell>
                                    <TableCell className="font-sans text-gray-700 text-xs max-w-[300px]" style={{ fontSize: '0.75rem', wordBreak: 'break-word', overflowWrap: 'break-word', lineHeight: '1.4' }} title={itemName}>
                                      <div className="line-clamp-2">{itemName}</div>
                                    </TableCell>
                                    <TableCell className="font-sans text-gray-700 text-left whitespace-nowrap">{uom}</TableCell>
                                    <TableCell className="text-right font-sans text-gray-700 whitespace-nowrap">{rate.toFixed(2)}</TableCell>
                                    <TableCell className="text-right font-sans text-gray-700 whitespace-nowrap">{returnableQty}</TableCell>
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
                              <TableHead className="font-sans font-semibold text-gray-700">Item Code</TableHead>
                              <TableHead className="font-sans font-semibold text-gray-700">Item Name</TableHead>
                              <TableHead className="font-sans font-semibold text-gray-700">UOM</TableHead>
                              <TableHead className="text-right font-sans font-semibold text-gray-700">Rate</TableHead>
                              <TableHead className="text-right font-sans font-semibold text-gray-700">Returnable Qty</TableHead>
                              <TableHead className="text-right font-sans font-semibold text-gray-700">Qty</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {invoiceData.items
                              .filter((item) => {
                                const selectionKey = item.original_purchase_invoice_item || item.item_code || ''
                                const isSelected = selectedItems[selectionKey]?.selected === true
                                if (!isSelected) return false
                                
                                // Apply search filter
                                if (!searchQuery.trim()) return true
                                const searchLower = searchQuery.toLowerCase().trim()
                                const itemCode = (item.item_code || '').toLowerCase()
                                const itemName = (item.item_name || '').toLowerCase()
                                return itemCode.includes(searchLower) || itemName.includes(searchLower)
                              })
                              .map((item, index) => {
                                // Safely extract item data with fallbacks
                                const itemCode = item.item_code || `item-${index}`
                                const itemName = item.item_name || 'Unknown Item'
                                const uom = item.uom || 'Nos'
                                const rate = typeof item.rate === 'number' ? item.rate : 0
                                // Use original_purchase_invoice_item as key for selection, fallback to item_code
                                const selectionKey = item.original_purchase_invoice_item || itemCode
                                const returnableQty = typeof item.returnable_qty === 'number' ? item.returnable_qty : (selectedItems[selectionKey]?.originalQty ?? 0)
                                const returnQty = selectedItems[selectionKey]?.qty ?? returnableQty
                                
                                return (
                                  <TableRow key={index} className="hover:bg-gray-50 border-b border-gray-100">
                                    <TableCell className="font-medium font-sans text-gray-800 text-xs whitespace-nowrap" style={{ fontSize: '0.75rem' }}>{itemCode}</TableCell>
                                    <TableCell className="font-sans text-gray-700 text-xs max-w-[300px]" style={{ fontSize: '0.75rem', wordBreak: 'break-word', overflowWrap: 'break-word', lineHeight: '1.4' }} title={itemName}>
                                      <div className="line-clamp-2">{itemName}</div>
                                    </TableCell>
                                    <TableCell className="font-sans text-gray-700 text-left whitespace-nowrap">{uom}</TableCell>
                                    <TableCell className="text-right font-sans text-gray-700 whitespace-nowrap">{rate.toFixed(2)}</TableCell>
                                    <TableCell className="text-right font-sans text-gray-700 whitespace-nowrap">{returnableQty}</TableCell>
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
                                              handleQuantityChange(selectionKey, 0)
                                            } else {
                                              const numericValue = parseFloat(inputValue)
                                              if (!isNaN(numericValue)) {
                                                handleQuantityChange(selectionKey, numericValue)
                                              }
                                            }
                                          }}
                                          onBlur={(e) => {
                                            // Ensure we have a valid number on blur
                                            const value = parseFloat(e.target.value) || 0
                                            // Ensure value doesn't exceed returnable qty
                                            const validValue = Math.min(value, returnableQty)
                                            handleQuantityChange(selectionKey, validValue)
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
                              const selectionKey = item.original_purchase_invoice_item || item.item_code || ''
                              const isSelected = selectedItems[selectionKey]?.selected === true
                              if (!isSelected) return false
                              
                              // Apply search filter
                              if (!searchQuery.trim()) return true
                              const searchLower = searchQuery.toLowerCase().trim()
                              const itemCode = (item.item_code || '').toLowerCase()
                              const itemName = (item.item_name || '').toLowerCase()
                              return itemCode.includes(searchLower) || itemName.includes(searchLower)
                            }).length === 0 && (
                              <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-gray-500 font-sans">
                                  {searchQuery.trim() 
                                    ? 'No selected items match your search.'
                                    : 'No items selected. Please select items from the "Items" tab.'}
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

export default PurchaseReturnModal



