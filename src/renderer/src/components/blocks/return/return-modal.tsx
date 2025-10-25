import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { Checkbox } from '@renderer/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@renderer/components/ui/table'
import { toast } from 'sonner'

interface InvoiceItem {
  item_code: string
  item_name: string
  qty: number
  rate: number
  amount: number
  uom: string
}

interface InvoiceData {
  name: string
  customer_name: string
  posting_date: string
  grand_total: number
  items: InvoiceItem[]
}

interface ReturnModalProps {
  isOpen: boolean
  onClose: () => void
  onReturnSuccess?: () => void
}

const ReturnModal: React.FC<ReturnModalProps> = ({ isOpen, onClose, onReturnSuccess }) => {
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null)
  const [loading, setLoading] = useState(false)
  const [returnLoading, setReturnLoading] = useState(false)
  const [selectedItems, setSelectedItems] = useState<{ [key: string]: { selected: boolean; qty: number } }>({})

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setInvoiceNumber('')
      setInvoiceData(null)
      setSelectedItems({})
    }
  }, [isOpen])

  // Fetch invoice details when invoice number is entered
  const fetchInvoiceDetails = async (invoiceId: string) => {
    if (!invoiceId.trim()) return

    setLoading(true)
    try {
      console.log('🔍 Fetching invoice details for:', invoiceId)
      
      const response = await window.electronAPI?.proxy?.request({
        method: 'GET',
        url: `/api/resource/Sales Invoice/${invoiceId}`
      })

      console.log('📄 Invoice API Response:', response)
      console.log('📄 Response data structure:', response?.data)
      console.log('📄 Invoice name:', response?.data?.name)

      if (response?.data) {
        const invoice = response.data
        
        // Debug the invoice object structure
        console.log('📄 Invoice object keys:', Object.keys(invoice))
        console.log('📄 Invoice name value:', invoice.name)
        console.log('📄 Invoice name type:', typeof invoice.name)
        
        // Check if the data structure is different - maybe the invoice data is nested
        let actualInvoice = invoice
        if (invoice.data && typeof invoice.data === 'object') {
          console.log('📄 Found nested data structure, using invoice.data')
          actualInvoice = invoice.data
        }
        
        console.log('📄 Actual invoice object keys:', Object.keys(actualInvoice))
        console.log('📄 Actual invoice name:', actualInvoice.name)
        
        // Validate required fields - check if name exists and is not empty
        if (!actualInvoice.name || actualInvoice.name === '') {
          console.log('❌ Validation failed: actualInvoice.name is missing or empty')
          console.log('❌ Available keys:', Object.keys(actualInvoice))
          toast.error('Invalid invoice data received. Please check the invoice number.', { duration: 5000 })
          return
        }

        // Safely extract data with fallbacks using actualInvoice
        const invoiceData = {
          name: actualInvoice.name || 'N/A',
          customer_name: actualInvoice.customer_name || 'N/A',
          posting_date: actualInvoice.posting_date || 'N/A',
          grand_total: typeof actualInvoice.grand_total === 'number' ? actualInvoice.grand_total : 0,
          items: Array.isArray(actualInvoice.items) ? actualInvoice.items : []
        }

        console.log('📄 Processed invoice data:', invoiceData)
        setInvoiceData(invoiceData)

        // Initialize selected items with checkboxes unchecked and original quantities
        const initialSelectedItems: { [key: string]: { selected: boolean; qty: number } } = {}
        invoiceData.items.forEach((item: InvoiceItem) => {
          if (item.item_code) {
            initialSelectedItems[item.item_code] = {
              selected: false,
              qty: 0 // Start with 0 for return quantity, not original quantity
            }
          }
        })
        setSelectedItems(initialSelectedItems)

        toast.success('Invoice details loaded successfully!', { duration: 2000 })
      } else {
        toast.error('Invoice not found. Please check the invoice number.', { duration: 5000 })
      }
    } catch (error) {
      console.error('❌ Error fetching invoice details:', error)
      toast.error('Failed to fetch invoice details. Please try again.', { duration: 5000 })
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
    setSelectedItems(prev => ({
      ...prev,
      [itemCode]: {
        ...prev[itemCode],
        selected
      }
    }))
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
      .filter(([_, itemData]) => itemData.selected && itemData.qty > 0)
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

      if (response?.data) {
        toast.success('Return order processed successfully!', { duration: 2000 })
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
      <DialogContent className="max-w-3xl h-[600px] bg-white border-2 border-gray-200 shadow-2xl flex flex-col">
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
                    <span className="ml-2 text-gray-800 font-medium">SAR {(invoiceData.grand_total || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="flex-1 flex flex-col space-y-2 overflow-hidden">
                <h3 className="text-lg font-medium text-gray-800 font-sans">Select Items to Return</h3>
                <div className="flex-1 border-2 border-gray-200 rounded-lg overflow-hidden bg-white">
                  <div className="h-full overflow-y-auto">
                    <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-100 border-b-2 border-gray-200">
                        <TableHead className="w-12 font-sans font-semibold text-gray-700">Select</TableHead>
                        <TableHead className="font-sans font-semibold text-gray-700">Item Code</TableHead>
                        <TableHead className="font-sans font-semibold text-gray-700">Item Name</TableHead>
                        <TableHead className="text-right font-sans font-semibold text-gray-700">Original Qty</TableHead>
                        <TableHead className="text-right font-sans font-semibold text-gray-700">Return Qty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoiceData.items.map((item, index) => {
                        // Safely extract item data with fallbacks
                        const itemCode = item.item_code || `item-${index}`
                        const itemName = item.item_name || 'Unknown Item'
                        const itemQty = typeof item.qty === 'number' ? item.qty : 0
                        const itemRate = typeof item.rate === 'number' ? item.rate : 0
                        
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
                            <TableCell className="font-sans text-gray-700">{itemName}</TableCell>
                            <TableCell className="text-right font-sans text-gray-700">{itemQty}</TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                min="0"
                                max={itemQty}
                                value={selectedItems[itemCode]?.qty?.toString() || '0'}
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
                                  handleQuantityChange(itemCode, value)
                                }}
                                disabled={!selectedItems[itemCode]?.selected}
                                className="w-20 text-right font-sans border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-gray-100 disabled:text-gray-500"
                                placeholder="0"
                              />
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                    </Table>
                  </div>
                </div>
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
                  className="bg-orange-500 hover:bg-orange-600 text-white font-sans font-medium px-6 py-2"
                >
                  {returnLoading ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                      Processing Return...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-undo mr-2"></i>
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
