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
        
        // Initialize selected items
        const initialSelectedItems: { [key: string]: { selected: boolean; qty: number; originalQty: number; itemCode: string; originalPurchaseInvoiceItem: string } } = {}
        invoiceData.items.forEach((item) => {
          if (item.returnable_qty > 0) {
            initialSelectedItems[item.item_code] = {
              selected: false,
              qty: item.returnable_qty,
              originalQty: item.returnable_qty,
              itemCode: item.item_code,
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

  // Handle item selection
  const handleItemToggle = (itemCode: string) => {
    setSelectedItems((prev) => {
      const current = prev[itemCode]
      if (!current) return prev
      return {
        ...prev,
        [itemCode]: {
          ...current,
          selected: !current.selected,
          qty: !current.selected ? current.originalQty : 0
        }
      }
    })
  }

  // Handle quantity change
  const handleQtyChange = (itemCode: string, newQty: number) => {
    setSelectedItems((prev) => {
      const current = prev[itemCode]
      if (!current) return prev
      const maxQty = current.originalQty
      const qty = Math.max(0, Math.min(newQty, maxQty))
      return {
        ...prev,
        [itemCode]: {
          ...current,
          qty,
          selected: qty > 0
        }
      }
    })
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
      .map(([, itemData]) => ({
        original_purchase_invoice_item: itemData.originalPurchaseInvoiceItem || '',
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

  // Filter items based on search query
  const filteredItems = invoiceData?.items.filter((item) =>
    item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.item_code.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []

  // Get selected items for display
  const selectedItemsList = Object.entries(selectedItems)
    .filter(([, itemData]) => itemData.selected && itemData.qty > 0)
    .map(([itemCode, itemData]) => {
      const item = invoiceData?.items.find((i) => i.item_code === itemCode)
      return item ? { ...item, selectedQty: itemData.qty } : null
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] bg-white border-2 shadow-2xl flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-xl font-bold text-gray-800">Return Purchase Order</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Invoice Number Input */}
          <div className="flex-shrink-0">
            <Label htmlFor="invoice-number" className="text-sm font-medium text-gray-700">
              Purchase Invoice Number
            </Label>
            <Input
              id="invoice-number"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="Enter purchase invoice number"
              className="mt-1"
              disabled={loading || returnLoading}
            />
          </div>

          {loading && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <i className="fas fa-spinner fa-spin text-2xl text-gray-400 mb-2"></i>
                <p className="text-sm text-gray-500">Loading return availability...</p>
              </div>
            </div>
          )}

          {!loading && invoiceData && (
            <div className="flex-1 overflow-hidden flex flex-col gap-4">
              {/* Invoice Summary */}
              <div className="flex-shrink-0 grid grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-xs text-gray-500">Supplier</p>
                  <p className="text-sm font-semibold">{invoiceData.supplier_name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Invoice #</p>
                  <p className="text-sm font-semibold">{invoiceData.name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Date</p>
                  <p className="text-sm font-semibold">{invoiceData.posting_date}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Grand Total</p>
                  <p className="text-sm font-semibold">
                    {currencySymbol} {invoiceData.grand_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              <Tabs defaultValue="items" className="flex-1 overflow-hidden flex flex-col">
                <TabsList className="flex-shrink-0">
                  <TabsTrigger value="items">Items ({filteredItems.length})</TabsTrigger>
                  <TabsTrigger value="selected">
                    Selected ({selectedItemsCount})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="items" className="flex-1 overflow-hidden flex flex-col mt-4">
                  {/* Search */}
                  <div className="flex-shrink-0 mb-4">
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search items..."
                      className="w-full"
                    />
                  </div>

                  {/* Items Table */}
                  <div className="flex-1 overflow-auto border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">Select</TableHead>
                          <TableHead>Item Code</TableHead>
                          <TableHead>Item Name</TableHead>
                          <TableHead>UOM</TableHead>
                          <TableHead className="text-right">Original Qty</TableHead>
                          <TableHead className="text-right">Already Returned</TableHead>
                          <TableHead className="text-right">Returnable Qty</TableHead>
                          <TableHead className="text-right">Return Qty</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredItems.map((item) => {
                          const itemData = selectedItems[item.item_code]
                          const isSelected = itemData?.selected || false
                          const returnQty = itemData?.qty || 0

                          return (
                            <TableRow key={item.item_code} className={isSelected ? 'bg-blue-50' : ''}>
                              <TableCell>
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => handleItemToggle(item.item_code)}
                                  disabled={item.returnable_qty === 0}
                                />
                              </TableCell>
                              <TableCell className="font-medium">{item.item_code}</TableCell>
                              <TableCell className="max-w-[300px] break-words overflow-wrap-break-word line-clamp-2">
                                {item.item_name}
                              </TableCell>
                              <TableCell className="whitespace-nowrap">{item.uom}</TableCell>
                              <TableCell className="text-right whitespace-nowrap">{item.original_qty || 0}</TableCell>
                              <TableCell className="text-right whitespace-nowrap">{item.already_returned_qty || 0}</TableCell>
                              <TableCell className="text-right whitespace-nowrap font-semibold text-green-600">
                                {item.returnable_qty}
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="0"
                                  max={item.returnable_qty}
                                  value={returnQty}
                                  onChange={(e) => handleQtyChange(item.item_code, Number(e.target.value))}
                                  disabled={!isSelected || item.returnable_qty === 0}
                                  className="w-20 text-right"
                                />
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="selected" className="flex-1 overflow-hidden flex flex-col mt-4">
                  <div className="flex-1 overflow-auto border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item Code</TableHead>
                          <TableHead>Item Name</TableHead>
                          <TableHead>UOM</TableHead>
                          <TableHead className="text-right">Return Qty</TableHead>
                          <TableHead className="text-right">Rate</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedItemsList.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                              No items selected for return
                            </TableCell>
                          </TableRow>
                        ) : (
                          selectedItemsList.map((item) => (
                            <TableRow key={item.item_code}>
                              <TableCell className="font-medium">{item.item_code}</TableCell>
                              <TableCell className="max-w-[300px] break-words overflow-wrap-break-word line-clamp-2">
                                {item.item_name}
                              </TableCell>
                              <TableCell className="whitespace-nowrap">{item.uom}</TableCell>
                              <TableCell className="text-right whitespace-nowrap">{item.selectedQty}</TableCell>
                              <TableCell className="text-right whitespace-nowrap">
                                {currencySymbol} {Number(item.rate || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell className="text-right whitespace-nowrap font-semibold">
                                {currencySymbol} {(Number(item.rate || 0) * item.selectedQty).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              </Tabs>

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

          {!loading && !invoiceData && invoiceNumber && (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-gray-500">Enter a purchase invoice number to view returnable items</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default PurchaseReturnModal

