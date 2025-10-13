import { useState, useEffect, useCallback } from 'react'
import { Button } from '@renderer/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@renderer/components/ui/select'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@renderer/components/ui/alert-dialog'
import { usePOSTabStore } from '@renderer/store/usePOSTabStore'

// type Props = unknown

const ActionButtons: React.FC = () => {
  const [open, setOpen] = useState<false | 'confirm' | 'pay'>(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [orderAmount, setOrderAmount] = useState('0.00')
  const [prevOutstanding] = useState('0.00') // This will come from API
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [mode, setMode] = useState('Cash')
  const [amount, setAmount] = useState('')
  
  // Get current tab data
  const { getCurrentTabItems, getCurrentTab, updateTabOrderId } = usePOSTabStore()
  const items = getCurrentTabItems()
  const currentTab = getCurrentTab()
  
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

  const handleSave = () => {
    if (!currentTab) return
    // Generate a temporary order number to simulate save
    const orderNo = currentTab.orderId || `POS-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`
    updateTabOrderId(currentTab.id, orderNo)
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
            {/* {shouldShowSaveButton() && ( */}
            <Button
              className="px-2 py-2 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white font-medium rounded-xl hover:shadow-2xl transition-all duration-300 flex items-center gap-3  text-xs"
              disabled={!currentTab?.isEdited}
              onClick={handleSave}
            >
              <i className="fas fa-save text-lg"></i>
              Save <span className="text-xs opacity-80 bg-white/20 px-2 py-1 rounded-lg">Ctrl+S</span>
            </Button>
            {/* )} */}
            <Button
              className="px-2 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-medium rounded-xl hover:shadow-2xl transition-all duration-300 flex items-center gap-3  text-xs"
              onClick={() => setOpen('confirm')}
            >
              <i className="fas fa-check text-lg"></i>
              Confirm <span className="text-xs opacity-80 bg-white/20 px-2 py-1 rounded-lg">Ctrl+Enter</span>
            </Button>
            <Button className="px-2 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-xl hover:shadow-2xl transition-all duration-300 flex items-center gap-3  text-xs" onClick={() => setOpen('pay')}>
              <i className="fas fa-credit-card text-lg"></i>
              Pay <span className="text-xs opacity-80 bg-white/20 px-2 py-1 rounded-lg">Ctrl+P</span>
            </Button>
            <Button className="px-2 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-medium rounded-xl hover:shadow-2xl transition-all duration-300 flex items-center gap-3  text-xs">
              <i className="fas fa-undo text-lg"></i>
              Return <span className="text-xs opacity-80 bg-white/20 px-2 py-1 rounded-lg">Ctrl+R</span>
            </Button>
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
            <Button onClick={() => setConfirmOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 text-lg font-semibold">Confirm and Pay</Button>
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
          <AlertDialogFooter className="pt-6">
            <AlertDialogCancel className="px-6 py-3 text-lg font-semibold">No</AlertDialogCancel>
            <AlertDialogAction autoFocus className="px-6 py-3 text-lg font-semibold bg-blue-600 hover:bg-blue-700">Yes</AlertDialogAction>
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
