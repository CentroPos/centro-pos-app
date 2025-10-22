import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@renderer/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@renderer/components/ui/select'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@renderer/components/ui/alert-dialog'
import { usePOSTabStore } from '@renderer/store/usePOSTabStore'
import { usePOSProfileStore } from '@renderer/store/usePOSProfileStore'

type Props = {
  onNavigateToPrints?: () => void
  selectedPriceList?: string
}

const ActionButtons: React.FC<Props> = ({ onNavigateToPrints, selectedPriceList = 'Standard Selling' }) => {
  const [open, setOpen] = useState<false | 'confirm' | 'pay'>(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [orderAmount, setOrderAmount] = useState('0.00')
  const [prevOutstanding] = useState('0.00') // This will come from API
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [mode, setMode] = useState('Cash')
  const [amount, setAmount] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  
  // Get current tab data
  const { getCurrentTabItems, getCurrentTab, updateTabOrderId, setTabStatus, getCurrentTabCustomer } = usePOSTabStore()
  const { currentUserPrivileges } = usePOSProfileStore()
  const items = getCurrentTabItems()
  const currentTab = getCurrentTab()

  // Debug logging (commented out since working)
  // React.useEffect(() => {
  //   console.log('🔍 ActionButtons Debug:', {
  //     currentUserPrivileges,
  //     profile,
  //     hasSales: currentUserPrivileges?.sales,
  //     hasBilling: currentUserPrivileges?.billing,
  //     hasReturn: currentUserPrivileges?.return
  //   })
  // }, [currentUserPrivileges, profile])
  
  // Calculate order total from items
  const calculateOrderTotal = useCallback(() => {
    return items.reduce((total, item) => {
      const quantity = parseFloat(item.quantity || '0') || 0
      const rate = parseFloat(item.standard_rate || '0') || 0
      const discount = parseFloat(item.discount_percentage || '0') || 0
      const itemTotal = quantity * rate
      const discountAmount = (itemTotal * discount) / 100
      return total + (itemTotal - discountAmount)
    }, 0).toFixed(2)
  }, [items])
  
  // Update order amount when items change
  useEffect(() => {
    const total = calculateOrderTotal()
    setOrderAmount(total)
  }, [calculateOrderTotal])

  // Keyboard shortcuts for Confirm and Pay
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey) {
        if (e.key === 'Enter') {
          e.preventDefault()
          console.log('⌨️ Ctrl+Enter pressed - opening confirm dialog')
          handleConfirm()
        } else if (e.key === 'p' || e.key === 'P') {
          e.preventDefault()
          console.log('⌨️ Ctrl+P pressed - opening pay dialog')
          handlePay()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])
  
  const totalPending = (() => {
    const a = parseFloat(orderAmount || '0') || 0
    const b = parseFloat(prevOutstanding || '0') || 0
    return (a + b).toFixed(2)
  })()
  
  // Calculate payment status based on amount entered
  const getPaymentStatus = () => {
    const enteredAmount = parseFloat(amount || '0') || 0
    const total = parseFloat(totalPending || '0') || 0
    
    if (enteredAmount === 0) {
      return { text: 'Credit Sale', color: 'bg-orange-100 text-orange-800' }
    } else if (enteredAmount >= total) {
      return { text: 'Fully Paid', color: 'bg-green-100 text-green-800' }
    } else {
      return { text: 'Partially Paid', color: 'bg-yellow-100 text-yellow-800' }
    }
  }
  
  const paymentStatus = getPaymentStatus()
  // const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);

  // Get current tab and its items from Zustand (replaces useCartStore)
  // const { tabs, activeTabId, updateTabOrderId, updateTabTaxAmount, setTabEdited, updateTabInvoiceData }: POSTabStore = usePOSTabStore();
  // const currentTab: Tab | undefined = tabs.find(tab => tab.id === activeTabId);
  // const cartItems: CartItem[] = currentTab?.items || [];

  // Get customer from cart store
  // const { setActiveRightPanelTab, setOrderActionTrigger }: CartStore = useCartStore();

  // Determine if Save button should be shown
  // const shouldShowSaveButton = (): boolean => {
  //   // Show Save button if:
  //   // 1. New order (no orderId) - to create draft
  //   // 2. Draft order that has been edited
  //   return !currentTab?.orderId || currentTab?.isEdited;
  // };

  // const transactionDate: string = new Date().toISOString().slice(0, 10);
  // const { addSuccess, addError }: AlertStore = useAlertStore();
  // const deliveryDate: string = transactionDate;
  // const triggerRefresh: () => void = useOrderRefreshStore((state: OrderRefreshStore) => state.triggerRefresh);

  // const customerName: string = currentTab?.customer?.name || 'Walking Customer';

  // const handleCreateInvoice = async (): Promise<void> => {
  //   // Check if there are items to save
  //   if (!cartItems || cartItems.length === 0) {
  //     addError('Please add items to the order before saving.');
  //     return;
  //   }

  //   const invoiceData: InvoiceData = {
  //     customer: customerName,
  //     transaction_date: transactionDate,
  //     delivery_date: deliveryDate,
  //     items: cartItems.map(item => ({
  //       item_code: item.code,
  //       qty: item.quantity || 1,
  //       rate: item.price,
  //       warehouse: item.warehouse || 'Stores - CIPL',
  //     })),
  //     // Remove payment_amount and total_amount
  //   };

  //   try {
  //     let savedInvoice: any;

  //     if (currentTab?.orderId) {
  //       // UPDATE existing draft
  //       const updateData = prepareInvoiceUpdateData(invoiceData, getCurrentBackend());
  //       savedInvoice = await ordersAPI.update(currentTab.orderId, updateData);

  //       const normalizedInvoice = normalizeInvoice(savedInvoice.data, getCurrentBackend());
  //       updateTabInvoiceData(currentTab.id, normalizedInvoice);
  //       setTabEdited(currentTab.id, false);
  //       addSuccess('Order updated!');
  //     } else {
  //       // CREATE new draft
  //       const createData = prepareInvoiceData(invoiceData, getCurrentBackend());
  //       savedInvoice = await ordersAPI.createSaleInvoice(createData);

  //       if (currentTab && savedInvoice.id) {
  //         updateTabOrderId(currentTab.id, savedInvoice.id);
  //         updateTabTaxAmount(currentTab.id, savedInvoice.taxAmount || 0);
  //         updateTabInvoiceData(currentTab.id, savedInvoice);
  //       }

  //       addSuccess('Order saved as draft!');
  //     }

  //     setOrderActionTrigger('order_saved');
  //     setActiveRightPanelTab('orders');
  //     triggerRefresh();
  //   } catch (error: any) {
  //     console.error('Failed to save order:', error);
  //     addError(error?.message || 'Failed to save order!');
  //   }
  // };

  const handleSave = async () => {
    if (!currentTab || isSaving) return
    
    setIsSaving(true)
    
    try {
      // Get current customer
      const selectedCustomer = getCurrentTabCustomer()
      console.log('🔍 Selected customer for order creation:', selectedCustomer)
      
      // Resolve customer_id by calling customer list API if not available
      let customerId = selectedCustomer?.customer_id
      
      if (!customerId && selectedCustomer?.name && selectedCustomer.name !== 'Walking Customer') {
        console.log('🔍 Customer ID not found, fetching from customer list API...')
        
        try {
          const customerListResponse = await window.electronAPI?.proxy?.request({
            url: '/api/method/centro_pos_apis.api.customer.customer_list',
            params: {
              search_term: '',
              limit_start: 1,
              limit_page_length: 50
            }
          })
          
          console.log('🔍 Customer list API response:', customerListResponse)
          
          const customers = customerListResponse?.data?.data || []
          const matchingCustomer = customers.find((c: any) => c.customer_name === selectedCustomer.name)
          
          if (matchingCustomer) {
            customerId = matchingCustomer.name // This is the actual customer_id
            console.log('✅ Found customer ID:', customerId, 'for customer name:', selectedCustomer.name)
          } else {
            console.log('❌ No matching customer found for name:', selectedCustomer.name)
            throw new Error(`Customer "${selectedCustomer.name}" not found in system`)
          }
        } catch (lookupError) {
          console.error('❌ Error looking up customer ID:', lookupError)
          throw new Error(`Failed to find customer "${selectedCustomer.name}" in system`)
        }
      }
      
      // Use resolved customer_id or fallback to name or "Walking Customer"
      const finalCustomerId = customerId || selectedCustomer?.name || "Walking Customer"
      console.log('🔍 Final customer ID for order:', finalCustomerId)
      
      // Map items for API - let backend handle calculations
      const mappedItems = items.map(item => {
        const qty = parseFloat(item.quantity || '0') || 1
        const rate = parseFloat(item.standard_rate || '0') || 0
        const discount = parseFloat(item.discount_percentage || '0') || 0
        
        console.log('📊 Sending item data to API:', {
          item_code: item.item_code || item.code,
          qty,
          rate,
          discount: `${discount}%`,
          rawQuantity: item.quantity,
          rawRate: item.standard_rate,
          rawDiscount: item.discount_percentage
        })
        
        return {
          item_code: item.item_code || item.code,
          qty,
          uom: item.uom || "Nos",
          rate,
          discount_percentage: discount,
          warehouse: item.warehouse || "Stores - NAB"
        }
      })
      
      console.log('📊 UI Total (for reference):', orderAmount)
      console.log('📊 Items count:', items.length)
      
      // Prepare order data
      const orderData = {
        customer: finalCustomerId,
        posting_date: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD format
        selling_price_list: selectedPriceList,
        taxes_and_charges: "VAT 15% - NAB", // Default tax, can be made configurable
        items: mappedItems
      }
      
      console.log('📦 Creating order with data:', orderData)
      console.log('📦 Selected Price List:', selectedPriceList)
      console.log('📦 Detailed items data:', JSON.stringify(orderData.items, null, 2))
      
      // Call create order API
      const response = await window.electronAPI?.proxy?.request({
        method: 'POST',
        url: '/api/method/centro_pos_apis.api.order.create_order',
        data: orderData
      })
      
      console.log('📦 Create order response:', response)
      console.log('📦 Response data structure:', JSON.stringify(response.data, null, 2))
      console.log('📦 Response keys:', Object.keys(response.data || {}))
      
      if (response?.success) {
        // Update tab with order ID
        const orderId = response.data?.name || response.data?.order_id
        if (orderId) {
          updateTabOrderId(currentTab.id, orderId)
        }
        
        // Show success message with relevant information
        console.log('✅ Order created successfully!')
        console.log('📦 API Response:', response)
        
        // Extract relevant information from response
        const displayOrderId = response.data?.name || response.data?.order_id || 'Unknown'
        const orderName = response.data?.order_name || response.data?.name || displayOrderId
        const grandTotal = response.data?.grand_total || response.data?.total || 'N/A'
        const status = response.data?.status || 'Created'
        
        // Show clean success message
        alert(`Order created successfully!\n\nOrder ID: ${displayOrderId}\nOrder Name: ${orderName}\nTotal Amount: ${grandTotal}\nStatus: ${status}`)
        
        // Handle PDF download (temporary)
        console.log('🔍 Checking for PDF in response data:', response.data)
        console.log('🔍 Full response structure:', response)
        console.log('🔍 PDF data from proxy:', response.pdfData)
        
        let pdfUrl: string | null = null
        
        // Check for PDF data from the updated proxy response
        if (response.pdfData) {
          pdfUrl = response.pdfData
          console.log('📄 Found PDF data from proxy:', pdfUrl)
        } else if (response.data?.pdf_url) {
          pdfUrl = response.data.pdf_url
          console.log('📄 Found PDF URL:', pdfUrl)
        } else if (response.data?.pdf_data) {
          pdfUrl = `data:application/pdf;base64,${response.data.pdf_data}`
          console.log('📄 Created PDF data URL from base64')
        } else if (response.data?.pdf) {
          // Handle if PDF is directly in response.data.pdf
          if (typeof response.data.pdf === 'string') {
            if (response.data.pdf.startsWith('data:')) {
              pdfUrl = response.data.pdf
            } else {
              pdfUrl = `data:application/pdf;base64,${response.data.pdf}`
            }
          }
          console.log('📄 Found PDF in response.data.pdf:', pdfUrl)
        } else if (response.data?.file_url) {
          pdfUrl = response.data.file_url
          console.log('📄 Found file URL:', pdfUrl)
        } else if (response.data?.download_url) {
          pdfUrl = response.data.download_url
          console.log('📄 Found download URL:', pdfUrl)
        } else if (response.data?.url) {
          pdfUrl = response.data.url
          console.log('📄 Found URL:', pdfUrl)
        } else if (response.data?.message && typeof response.data.message === 'string' && response.data.message.includes('pdf')) {
          // Check if message contains PDF data
          pdfUrl = response.data.message
          console.log('📄 Found PDF in message:', pdfUrl)
        } else if (response?.pdf_url) {
          // Check if PDF is at root level
          pdfUrl = response.pdf_url
          console.log('📄 Found PDF URL at root level:', pdfUrl)
        } else if (response?.pdf_data) {
          // Check if PDF data is at root level
          pdfUrl = `data:application/pdf;base64,${response.pdf_data}`
          console.log('📄 Found PDF data at root level')
        } else if (response?.data && typeof response.data === 'string' && response.data.includes('pdf')) {
          // Check if entire data is PDF
          pdfUrl = response.data
          console.log('📄 Found PDF in entire data field')
        }
        
        if (pdfUrl) {
          console.log('📄 Opening PDF for printing:', pdfUrl)
          
          try {
            // Method 1: Try to open in new window first
            const printWindow = window.open(pdfUrl, '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes')
            
            if (printWindow) {
              printWindow.onload = () => {
                console.log('📄 PDF loaded, triggering print dialog')
                printWindow.print()
              }
              
              // Fallback: if onload doesn't work, try after a short delay
              setTimeout(() => {
                if (printWindow && !printWindow.closed) {
                  console.log('📄 Fallback: triggering print dialog after delay')
                  printWindow.print()
                }
              }, 1000)
            } else {
              // Method 2: If popup blocked, create a temporary link and click it
              console.log('📄 Popup blocked, trying download method')
              const link = document.createElement('a')
              link.href = pdfUrl
              link.target = '_blank'
              link.download = `order-${displayOrderId || 'receipt'}.pdf`
              document.body.appendChild(link)
              link.click()
              document.body.removeChild(link)
              
              // Method 3: Create an iframe for printing
              setTimeout(() => {
                const iframe = document.createElement('iframe')
                iframe.style.display = 'none'
                iframe.src = pdfUrl
                document.body.appendChild(iframe)
                
                iframe.onload = () => {
                  try {
                    iframe.contentWindow?.print()
                    setTimeout(() => {
                      document.body.removeChild(iframe)
                    }, 1000)
                  } catch {
                    console.log('📄 Iframe print failed, PDF will open in new tab')
                    document.body.removeChild(iframe)
                  }
                }
              }, 500)
              
              alert('Order created successfully! PDF is being downloaded/opened.')
            }
          } catch (error) {
            console.error('❌ Error opening PDF:', error)
            alert('Order created successfully! PDF generated but could not be opened automatically.')
          }
        } else {
          console.log('📄 No PDF found in response, showing success message')
        }
        
        // Navigate to prints tab
        onNavigateToPrints?.()
      } else {
        // Parse server error message from _server_messages
        let errorMessage = 'Failed to create order'
        if (response?.data?._server_messages) {
          try {
            const serverMessages = JSON.parse(response.data._server_messages)
            if (Array.isArray(serverMessages) && serverMessages.length > 0) {
              const firstMessage = JSON.parse(serverMessages[0])
              errorMessage = firstMessage.message || errorMessage
            }
          } catch (parseError) {
            console.error('Error parsing server messages:', parseError)
          }
        }
        throw new Error(errorMessage)
      }
      
    } catch (error) {
      console.error('❌ Error creating order:', error)
      alert(`Failed to create order: ${(error as any)?.message || 'Please try again.'}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleConfirm = () => {
    if (!currentTab) return
    console.log('🔘 Confirm button clicked - opening payment dialog')
    setOpen('confirm')
  }

  const handlePay = () => {
    if (!currentTab) return
    console.log('💳 Pay button clicked - opening payment dialog')
    setOpen('pay')
  }

  // const handlePaymentSubmit = async (paymentAmount: number): Promise<void> => {
  //   try {
  //     // Step 1: Update payment
  //     const paymentResponse = await ordersAPI.updatePayment(currentTab!.orderId!, paymentAmount);

  //     // Step 2: Submit order
  //     const submitResponse = await ordersAPI.submitInvoice(currentTab!.orderId!);

  //     // Success - both operations completed
  //     addSuccess('Payment successfully completed');
  //     setShowPaymentModal(false);
  //     setOrderActionTrigger('payment_processed');
  //     setActiveRightPanelTab('orders');
  //     triggerRefresh();

  //   } catch (error: any) {
  //     console.error(' Payment submission failed:', error);

  //     // Check if it's a submit error (payment might have succeeded)
  //     if (error.message && error.message.includes('submit')) {
  //       addError('Payment recorded but order submission failed. Please try submitting again.');
  //       // Keep modal open for retry
  //     } else {
  //       addError('Payment failed. Please try again.');
  //       // Keep modal open for retry
  //     }
  //   }
  // };

  // // COMPLETE: Handle order submission
  // const handleSubmitOrder = async (): Promise<void> => {
  //   console.log('🔍 Submit button clicked!');
  //   console.log('Current tab:', currentTab);
  //   console.log('Order ID:', currentTab?.orderId);

  //   // Check if we have a saved invoice to submit
  //   if (!currentTab?.orderId) {
  //     addError('Please save the order first before submitting.');
  //     return;
  //   }

  //   // Check if we have invoice data
  //   if (!currentTab?.invoiceData) {
  //     addError('Invoice data not found. Please save the order first.');
  //     return;
  //   }

  //   console.log('🔍 Current tab invoice data:', currentTab?.invoiceData);
  //   console.log('🔍 Grand total:', currentTab?.invoiceData?.grand_total);

  //   setShowPaymentModal(true);
  // };

  return (
    <>
      <div className="p-3 bg-white/40 backdrop-blur border-b border-white/20">
        <div className="flex justify-between items-center">
          <div className="flex gap-4">
            {/* Save Button - Show if user has sales privilege */}
            {currentUserPrivileges?.sales && (
            <Button
              className="px-2 py-2 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white font-medium rounded-xl hover:shadow-2xl transition-all duration-300 flex items-center gap-3  text-xs"
              disabled={!currentTab?.isEdited || isSaving}
              onClick={handleSave}
            >
              {isSaving ? (
                <>
                  <i className="fas fa-spinner fa-spin text-lg"></i>
                  Creating Order...
                </>
              ) : (
                <>
              <i className="fas fa-save text-lg"></i>
              Save <span className="text-xs opacity-80 bg-white/20 px-2 py-1 rounded-lg">Ctrl+S</span>
                </>
              )}
            </Button>
            )}
            
            {/* Confirm and Pay Buttons - Show if user has billing privilege */}
            {currentUserPrivileges?.billing && (
              <Button
                className="px-2 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-medium rounded-xl hover:shadow-2xl transition-all duration-300 flex items-center gap-3  text-xs"
                onClick={handleConfirm}
              >
                <i className="fas fa-check text-lg"></i>
                Confirm <span className="text-xs opacity-80 bg-white/20 px-2 py-1 rounded-lg">Ctrl+Enter</span>
              </Button>
            )}
            {currentUserPrivileges?.billing && (
              <Button className="px-2 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-xl hover:shadow-2xl transition-all duration-300 flex items-center gap-3  text-xs" onClick={handlePay}>
                <i className="fas fa-credit-card text-lg"></i>
                Pay <span className="text-xs opacity-80 bg-white/20 px-2 py-1 rounded-lg">Ctrl+P</span>
              </Button>
            )}
            
            {/* Return Button - Show if user has return privilege */}
            {currentUserPrivileges?.return && (
            <Button className="px-2 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-medium rounded-xl hover:shadow-2xl transition-all duration-300 flex items-center gap-3  text-xs">
              <i className="fas fa-undo text-lg"></i>
              Return <span className="text-xs opacity-80 bg-white/20 px-2 py-1 rounded-lg">Ctrl+R</span>
            </Button>
            )}
          </div>
          <div className="text-sm font-semibold text-gray-700">
            {/* Order #: {currentTab?.orderId || 'New Order'} | Items: {cartItems.length} */}
          </div>
        </div>
      </div>

      {/* Payment / Confirm Dialog */}
      <Dialog open={!!open} onOpenChange={(v) => setOpen(v ? (open || 'confirm') : false)}>
        <DialogContent className="max-w-4xl w-[90vw] bg-white border-2 shadow-2xl">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-xl font-bold text-gray-800">{open === 'pay' ? 'Payment' : 'Confirm and Pay'}</DialogTitle>
          </DialogHeader>

          {/* Row: amounts */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="p-4 rounded-lg bg-gray-50 border-2">
              <div className="text-sm font-medium text-gray-700 mb-2 truncate">Order Amount</div>
              <Input type="number" value={orderAmount} readOnly className="text-lg font-semibold bg-gray-100" />
            </div>
            <div className="p-4 rounded-lg bg-gray-50 border-2">
              <div className="text-sm font-medium text-gray-700 mb-2 truncate">Outstanding</div>
              <Input type="number" value={prevOutstanding} readOnly className="text-lg font-semibold bg-gray-100" />
            </div>
            <div className="p-4 rounded-lg bg-gray-50 border-2">
              <div className="text-sm font-medium text-gray-700 mb-2 truncate">Total Pending</div>
              <Input value={totalPending} readOnly className="text-lg font-semibold bg-gray-100" />
            </div>
          </div>

          {/* Date, Mode, Amount */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">Date</div>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="text-lg py-3" />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">Payment Mode</div>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger className="w-full text-lg py-3">
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Card">Card</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                  <SelectItem value="Bank">Bank</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">Amount</div>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="text-lg py-3" />
            </div>
          </div>

          {/* Payment Status - Real-time calculation */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border-2">
            <span className="text-sm font-medium text-gray-700 mr-3">Payment Status:</span>
            <span className={`px-3 py-2 ${paymentStatus.color} text-sm font-medium rounded-lg`}>
              {paymentStatus.text}
            </span>
          </div>

          <DialogFooter className="pt-6">
            <Button 
              onClick={() => {
                console.log('💳 Confirm and Pay clicked in dialog')
                setConfirmOpen(true)
              }} 
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 text-lg font-semibold"
            >
              Confirm and Pay
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)} className="px-8 py-3 text-lg font-semibold">Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Final confirm */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-md bg-white border-2 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-gray-800">Confirm Payment</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="py-4">
            <p className="text-gray-600 mb-2">Payment Details:</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Amount:</span>
                <span className="font-semibold">${amount || '0.00'}</span>
              </div>
              <div className="flex justify-between">
                <span>Mode:</span>
                <span className="font-semibold">{mode}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span className="font-semibold">{date}</span>
              </div>
            </div>
          </div>
          <AlertDialogFooter className="pt-6">
            <AlertDialogCancel className="px-6 py-3 text-lg font-semibold">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              autoFocus 
              className="px-6 py-3 text-lg font-semibold bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                console.log('✅ Final payment confirmation - processing payment')
                // Process the payment here
                if (currentTab) {
                  setTabStatus(currentTab.id, 'paid')
                  setOpen(false)
                  setConfirmOpen(false)
                  // Reset form
                  setAmount('')
                  setMode('Cash')
                  setDate(new Date().toISOString().slice(0, 10))
                }
              }}
            >
              Confirm Payment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* <PaymentSubmissionModal
        open={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onPaymentSubmit={handlePaymentSubmit}
        grandTotal={currentTab?.invoiceData?.total}
        outstandingAmount={currentTab?.invoiceData?.outstandingAmount} 
      /> */}
    </>
  );
};

export default ActionButtons
