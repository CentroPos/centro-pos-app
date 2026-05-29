import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { usePOSTabStore } from '@renderer/store/usePOSTabStore'
import { usePOSProfileStore } from '@renderer/store/usePOSProfileStore'
import { toast } from 'sonner'
import { PlusCircle, Trash } from 'lucide-react'
import ReturnModal from '../return/return-modal'
import { handleError } from '@renderer/lib/error-handler'

type Payment = {
  mode: string
  amount: string
  reference_no: string
  reference_date: string
  id: string
}

type Props = {
  onNavigateToPrints?: () => void
  onSaveCompleted?: () => void
  isItemTableEditing?: boolean
  onInsufficientStockErrors?: (
    errors: Array<{ message: string; title: string; indicator: string; itemCode: string; idx?: number }>
  ) => void
  onFocusItem?: (itemCode: string, idx?: number) => void
  onZatcaResponses?: (
    responses: Array<{
      invoice_no?: string
      status?: string
      status_code?: string
      response?: {
        type?: string
        code?: string
        category?: string
        message?: string
        status?: string
        [key: string]: any
      }
      [key: string]: any
    }>
  ) => void
}


// Helper function to parse server messages and extract insufficient stock errors
const parseInsufficientStockErrors = (
  serverMessages: any
): Array<{ message: string; title: string; indicator: string; itemCode: string }> => {
  const errors: Array<{ message: string; title: string; indicator: string; itemCode: string }> = []

  try {
    let messages = serverMessages
    if (typeof serverMessages === 'string') {
      messages = JSON.parse(serverMessages)
    }

    if (Array.isArray(messages)) {
      messages.forEach((msg: any) => {
        let messageObj = msg
        if (typeof msg === 'string') {
          try {
            messageObj = JSON.parse(msg)
          } catch {
            return // Skip invalid messages
          }
        }

        // Check if it's an insufficient stock error
        if (
          messageObj.message &&
          (messageObj.message.toLowerCase().includes('insufficient stock') ||
            messageObj.message.toLowerCase().includes('stock unavailable') ||
            messageObj.title?.toLowerCase().includes('stock'))
        ) {
          // First clean the HTML content
          const cleanMessage = messageObj.message
            .replace(/<br\s*\/?>/gi, '\n') // Convert <br> to newlines
            .replace(/<[^>]*>/g, '') // Remove all HTML tags
            .trim()

          // Split the message by "Item:" to separate individual item errors
          const parts = cleanMessage.split(/Item:\s*/)

          // Filter out empty parts and parts that only contain "Insufficient Stock:"
          const itemErrors = parts.filter((part: string) => {
            const trimmed = part.trim()
            // Must have content and not be just "Insufficient Stock:" or empty
            return (
              trimmed &&
              trimmed !== 'Insufficient Stock:' &&
              !trimmed.match(/^Insufficient Stock:\s*$/i) &&
              trimmed.length > 10 // Reduced threshold since we removed HTML
            )
          })

          if (itemErrors.length > 1) {
            // Multiple items in one message - split them
            itemErrors.forEach((itemError: string) => {
              const cleanError = itemError.trim()
              // Remove "Insufficient Stock:" prefix if present
              const messageWithoutPrefix = cleanError.replace(/^Insufficient Stock:\s*/i, '')

              // Extract item code from the error message
              const itemCodeMatch = messageWithoutPrefix.match(/^([A-Z0-9-]+)/)
              const itemCode = itemCodeMatch ? itemCodeMatch[1] : ''

              errors.push({
                message: `Not enough stock for Item: ${itemCode}`,
                title: messageObj.title || 'Stock Unavailable',
                indicator: messageObj.indicator || 'red',
                itemCode: itemCode
              })
            })
          } else if (itemErrors.length === 1) {
            // Single item error - remove "Insufficient Stock:" prefix if present
            const messageWithoutPrefix = itemErrors[0].replace(/^Insufficient Stock:\s*/i, '')

            // Extract item code from the error message
            const itemCodeMatch = messageWithoutPrefix.match(/^([A-Z0-9-]+)/)
            const itemCode = itemCodeMatch ? itemCodeMatch[1] : ''

            errors.push({
              message: `Not enough stock for Item: ${itemCode}`,
              title: messageObj.title || 'Stock Error',
              indicator: messageObj.indicator || 'red',
              itemCode: itemCode
            })
          } else {
            // Fallback: treat the whole message as one error
            const messageWithoutPrefix = cleanMessage.replace(/^Insufficient Stock:\s*/i, '')

            // Try to extract item code from the fallback message
            const itemCodeMatch = messageWithoutPrefix.match(/Item:\s*([A-Z0-9-]+)/)
            const itemCode = itemCodeMatch ? itemCodeMatch[1] : ''

            errors.push({
              message: 'Not enough stock available for this item.',
              title: messageObj.title || 'Stock Error',
              indicator: messageObj.indicator || 'red',
              itemCode: itemCode
            })
          }
        }
      })
    }
  } catch (error) {
    console.error('Error parsing server messages:', error)
  }

  return errors
}

const ActionButtons: React.FC<Props> = ({
  onNavigateToPrints,
  onSaveCompleted,
  isItemTableEditing = false,
  onInsufficientStockErrors,
  onFocusItem: _onFocusItem,
  onZatcaResponses
}) => {
  // Get current date in local timezone (YYYY-MM-DD format)
  const getCurrentDate = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const [open, setOpen] = useState<false | 'confirm' | 'pay'>(false)
  const [orderAmount, setOrderAmount] = useState('0.00')
  const [amountDue, setAmountDue] = useState('0.00')
  const [date, setDate] = useState(() => getCurrentDate())
  const [payments, setPayments] = useState<Payment[]>([
    {
      mode: 'Cash',
      amount: '0',
      reference_no: '',
      reference_date: getCurrentDate(),
      id: crypto.randomUUID()
    }
  ])
  const [isSaving, setIsSaving] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false)
  const [showValidationErrors, setShowValidationErrors] = useState(false)
  const [paymentModes, setPaymentModes] = useState<string[]>(['Cash', 'Card', 'UPI', 'Bank'])
  const amountInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({})
  const modeInputRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({})
  const refNoInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({})
  const refDateInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({})
  const prevPaymentsLengthRef = useRef(payments.length)

  // Get current tab data
  const {
    getCurrentTabItems,
    getCurrentTab,
    updateTabOrderId,
    setTabStatus,
    getCurrentTabCustomer,
    getCurrentTabGlobalDiscount,
    getCurrentTabReservation,
    setTabEdited,
    updateTabInstantPrintUrl,
    getCurrentTabRoundingEnabled,
    updateTabInvoiceNumber,
    getCurrentTabInvoiceNumber,
    updateTabOrderData,
    getCurrentTabPostingDate
  } = usePOSTabStore()
  const { currentUserPrivileges, profile } = usePOSProfileStore()
  const items = getCurrentTabItems()
  const currentTab = getCurrentTab()
  const globalDiscount = getCurrentTabGlobalDiscount()

  console.log('SHD ===> Current Tab Items:', items)

  // Derive selectedPriceList from the current tab's order data
  // Fallback to 'Standard Selling' if not set
  const selectedPriceList = currentTab?.orderData?.price_list || 'Standard Selling'

  // Fetch order details when tab is opened/selected (for previously opened orders)
  useEffect(() => {
    const fetchOrderDetails = async () => {
      if (!currentTab?.orderId || !currentTab?.id) return

      try {
        console.log('📋 Fetching order details for tab:', currentTab.id, 'Order ID:', currentTab.orderId)
        const res = await window.electronAPI?.proxy?.request({
          url: '/api/method/centro_pos_apis.api.order.get_sales_order_details',
          params: {
            sales_order_id: currentTab.orderId
          },
          method: 'GET'
        })

        if (res?.data?.data && currentTab.id) {
          const orderData = res.data.data
          const docstatus = Number(orderData.docstatus) || null

          console.log('📋 Order details fetched for tab:', {
            tabId: currentTab.id,
            orderId: currentTab.orderId,
            docstatus: docstatus,
            isConfirmed: docstatus === 1
          })

          // Update orderData to refresh status
          updateTabOrderData(currentTab.id, orderData)

          // Update tab status based on docstatus
          if (docstatus === 1) {
            setTabStatus(currentTab.id, 'confirmed')
          }
        }
      } catch (e) {
        console.error('Failed to fetch order details for tab:', e)
      }
    }

    // Fetch when orderId exists (order is created)
    if (currentTab?.orderId) {
      fetchOrderDetails()
    }
  }, [currentTab?.orderId, currentTab?.id])

  // Load Amount Due from customer insights API
  // If docstatus = 1, calculate as: Amount Due = (fetched Amount Due) - Order Amount
  // Otherwise, use fetched Amount Due as is
  useEffect(() => {
    let cancelled = false
    const fetchAmountDue = async () => {
      try {
        // Always fetch from customer insights API
        // Determine customer id
        let customerId = currentTab?.customer?.customer_id
        if (!customerId && currentTab?.customer?.name) {
          const listRes = await window.electronAPI?.proxy?.request({
            url: '/api/method/centro_pos_apis.api.customer.customer_list',
            params: { search_term: '', limit_start: 1, limit_page_length: 50 }
          })
          const list = listRes?.data?.data || []
          const match = list.find((c: any) => c.customer_name === currentTab?.customer?.name)
          customerId = match?.name
        }
        if (!customerId) {
          if (!cancelled) setAmountDue('0.00')
          return
        }

        const insightsRes = await window.electronAPI?.proxy?.request({
          url: '/api/method/centro_pos_apis.api.customer.customer_amount_insights',
          params: { customer_id: customerId }
        })
        const fetchedAmountDue = Number(insightsRes?.data?.data?.amount_due ?? 0)

        // Check if order is confirmed (docstatus = 1)
        const docstatus = currentTab?.orderData ? Number(currentTab.orderData.docstatus) : null
        const isConfirmed = docstatus === 1

        if (isConfirmed) {
          // For confirmed orders: Amount Due = (fetched Amount Due) - Order Amount
          const orderAmt = parseFloat(orderAmount || '0') || 0
          const calculatedAmountDue = Math.max(0, fetchedAmountDue - orderAmt)

          console.log('📋 Confirmed order - Fetched Amount Due from API:', fetchedAmountDue)
          console.log('📋 Confirmed order - Order Amount:', orderAmt)
          console.log('📋 Confirmed order - Calculated Amount Due (fetched - order):', calculatedAmountDue)

          if (!cancelled) setAmountDue(calculatedAmountDue.toFixed(2))
        } else {
          // For draft orders: Use fetched Amount Due as is
          console.log('📋 Draft order - Amount Due from API:', fetchedAmountDue)
          if (!cancelled) setAmountDue(fetchedAmountDue.toFixed(2))
        }
      } catch (err) {
        console.error('Failed to load amount due:', err)
        if (!cancelled) setAmountDue('0.00')
      }
    }
    if (open) fetchAmountDue()
    return () => { cancelled = true }
  }, [open, currentTab?.customer?.customer_id, currentTab?.customer?.name, currentTab?.orderId, currentTab?.orderData?.docstatus, orderAmount])

  // Load POS profile data
  const loadPOSProfile = async () => {
    try {
      console.log('📋 Loading POS profile in ActionButtons...')
      const response = await window.electronAPI?.proxy?.request({
        url: '/api/method/centro_pos_apis.api.profile.get_pos_profile'
      })

      console.log('📋 POS profile API response in ActionButtons:', response)
      console.log('📋 Full response structure in ActionButtons:', JSON.stringify(response, null, 2))

      // Handle 404 gracefully - don't throw, just use defaults
      if (!response?.data?.data) {
        console.warn('⚠️ POS profile not found (404) - using default payment modes')
        return // Use default payment modes already set in useState
      }

      const profileData = response.data.data
      console.log('📋 Profile data in ActionButtons:', profileData)
      console.log('📋 Payments array in ActionButtons:', profileData.payments)

      // Extract payment modes from payments array
      if (profileData.payments && Array.isArray(profileData.payments)) {
        console.log(
          '📋 Processing payments array with length in ActionButtons:',
          profileData.payments.length
        )
        const modes = profileData.payments.map((payment: any) => {
          console.log('📋 Processing payment in ActionButtons:', payment)
          return payment.mode_of_payment
        }) as string[]
        // Remove duplicates and filter out any undefined/null values
        const uniqueModes = [...new Set(modes.filter((mode) => mode && mode.trim() !== ''))]
        console.log('💳 Payment modes from profile in ActionButtons:', modes)
        console.log('💳 Unique payment modes in ActionButtons:', uniqueModes)
        console.log(
          '💳 Number of payment methods found in ActionButtons:',
          profileData.payments.length
        )
        setPaymentModes(uniqueModes)
      } else {
        console.log('📋 No payments array found or not an array in ActionButtons')
      }

      console.log('✅ Successfully loaded POS profile data in ActionButtons')
    } catch (error: any) {
      // Handle 404 errors gracefully - don't let them propagate to React error boundary
      if (error?.response?.status === 404 || error?.response?.statusCode === 404) {
        console.warn('⚠️ POS profile endpoint not found (404) - using default payment modes')
        return // Use default payment modes already set in useState
      }
      console.error('📋 Error loading POS profile in ActionButtons:', error)
      // Don't throw - just log and use defaults
    }
  }

  // Load POS profile on component mount
  useEffect(() => {
    loadPOSProfile()
  }, [])

  // Focus new payment mode when row is added
  useEffect(() => {
    if (payments.length > prevPaymentsLengthRef.current) {
      // Row added
      const lastPayment = payments[payments.length - 1]
      // Use setTimeout to allow render to complete
      setTimeout(() => {
        const modeTrigger = modeInputRefs.current[lastPayment.id]
        if (modeTrigger) {
          modeTrigger.focus()
        }
      }, 50)
    }
    prevPaymentsLengthRef.current = payments.length
  }, [payments.length])

  const paymentsRef = useRef(payments)
  useEffect(() => {
    paymentsRef.current = payments
  }, [payments])

  // Auto-focus first payment amount input when dialog opens
  useEffect(() => {
    if (open) {
      // Focus function
      const focusFirstPayment = () => {
        const currentPayments = paymentsRef.current
        const firstPaymentId = currentPayments[0]?.id
        if (firstPaymentId && modeInputRefs.current[firstPaymentId]) {
          const btn = modeInputRefs.current[firstPaymentId]
          btn?.focus()
        }
      }

      // Try multiple times with increasing delays to ensure focus
      const timer1 = setTimeout(() => {
        focusFirstPayment()
      }, 100)

      const timer2 = setTimeout(() => {
        focusFirstPayment()
      }, 250)

      const timer3 = setTimeout(() => {
        focusFirstPayment()
      }, 500)

      return () => {
        clearTimeout(timer1)
        clearTimeout(timer2)
        clearTimeout(timer3)
      }
    }
    return undefined
  }, [open])

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

  // Get VAT percentage from profile (same as DiscountSection)
  // Load VAT percentage from profile
  const vatPercentage = useMemo(() => {
    const isExempt = currentTab?.custom_is_exempt === 1
    if (isExempt) {
      const exemptRate = (profile as any)?.custom_exempt_tax_rate
      return exemptRate !== undefined && exemptRate !== null ? Number(exemptRate) : 0
    } else {
      const normalRate = (profile as any)?.custom_tax_rate
      return normalRate !== undefined && normalRate !== null ? Number(normalRate) : 15
    }
  }, [currentTab?.custom_is_exempt, (profile as any)?.custom_tax_rate, (profile as any)?.custom_exempt_tax_rate])

  // Helper function to round to nearest (same as DiscountSection)
  const roundToNearest = (value: number, step = 0.05) => {
    const rounded = Math.round(value / step) * step
    return Number(rounded.toFixed(2))
  }

  // Calculate order total
  // For confirmed orders (docstatus = 1), always use outstanding_amount from linked_invoices[0]
  // For draft orders (docstatus != 1), use calculated total from discount section
  const calculateOrderTotal = useCallback(() => {
    const isRoundingEnabled = getCurrentTabRoundingEnabled()
    const normalize = (value: any) => {
      const num = Number(value)
      return Number.isFinite(num) ? Number(num.toFixed(2)) : null
    }

    const hasSavedOrder = Boolean(currentTab?.orderId)
    const docstatus = currentTab?.orderData ? Number(currentTab.orderData.docstatus) : null
    const isConfirmed = docstatus === 1
    const isEdited = currentTab?.isEdited ?? false

    // If order is confirmed (docstatus = 1), use outstanding_amount from linked_invoices[0]
    if (isConfirmed && hasSavedOrder) {
      const linkedInvoices = currentTab?.orderData?.linked_invoices
      let outstandingAmount: number | null = null

      if (linkedInvoices) {
        if (Array.isArray(linkedInvoices) && linkedInvoices.length > 0) {
          outstandingAmount = normalize(linkedInvoices[0]?.outstanding_amount)
        } else if (typeof linkedInvoices === 'object' && !Array.isArray(linkedInvoices)) {
          outstandingAmount = normalize((linkedInvoices as any)?.outstanding_amount)
        }
      }

      if (outstandingAmount !== null) {
        console.log('📋 Using outstanding_amount for confirmed order:', outstandingAmount)
        return outstandingAmount.toFixed(2)
      }
    }

    // For draft orders, use calculated total from discount section
    const roundedTotal = normalize(currentTab?.orderData?.final_total)
    const docGrandTotal = normalize(currentTab?.orderData?.grand_total)

    let linkedGrandTotal: number | null = null
    const linkedInvoices = currentTab?.orderData?.linked_invoices
    if (linkedInvoices) {
      if (Array.isArray(linkedInvoices) && linkedInvoices.length > 0) {
        linkedGrandTotal = normalize(linkedInvoices[0]?.grand_total)
      } else if (typeof linkedInvoices === 'object') {
        linkedGrandTotal = normalize((linkedInvoices as any)?.grand_total)
      }
    }

    const serverTotal = roundedTotal ?? linkedGrandTotal ?? docGrandTotal
    // Use API value if order is saved and not edited (just saved/updated)
    if (hasSavedOrder && serverTotal !== null && !isEdited) {
      console.log('📋 Using server-provided rounded total:', serverTotal, '(not edited)')
      return serverTotal.toFixed(2)
    }

    console.log('📋 Using calculated total from discount section')
    const untaxedSum = items.reduce((sum: number, it: any) => {
      const qty = Number(it.quantity || 0)
      const rate = Number(it.standard_rate || 0)
      return sum + qty * rate
    }, 0)

    const individualDiscountSum = items.reduce((sum: number, it: any) => {
      const qty = Number(it.quantity || 0)
      const rate = Number(it.standard_rate || 0)
      if (it.discount_type === 'Amount') {
        const discAmt = Number(it.discount_amount || 0)
        return sum + (discAmt * qty)
      } else {
        const discPct = Number(it.discount_percentage || 0)
        return sum + (qty * rate * discPct) / 100
      }
    }, 0)

    const netAfterIndividualDiscount = untaxedSum - individualDiscountSum
    const globalDiscountAmount = globalDiscount.type === 'Amount'
      ? globalDiscount.amount
      : (netAfterIndividualDiscount * globalDiscount.percent) / 100
    const netAfterGlobalDiscount = netAfterIndividualDiscount - globalDiscountAmount
    const vatCalc = netAfterGlobalDiscount * (vatPercentage / 100)
    const totalRaw = netAfterGlobalDiscount + vatCalc
    const totalRoundedCandidate = roundToNearest(totalRaw, 0.05)

     const useRounding = isRoundingEnabled
     const totalFinal = useRounding ? totalRoundedCandidate : Number(totalRaw.toFixed(2))
 
     return totalFinal.toFixed(2)
   }, [
     items,
     globalDiscount,
     vatPercentage,
     getCurrentTabRoundingEnabled,
     currentTab?.orderData,
     currentTab?.orderId,
     currentTab?.isEdited
   ])

  // Update order amount when items, discount, or VAT changes
  useEffect(() => {
    const total = calculateOrderTotal()
    setOrderAmount(total)
  }, [calculateOrderTotal])

  const totalPending = (() => {
    const a = parseFloat(orderAmount || '0') || 0
    const b = parseFloat(amountDue || '0') || 0
    return (a + b).toFixed(2)
  })()

  // Calculate payment status based on amount entered (compared to order amount only)
  const getPaymentStatus = useCallback(() => {
    const totalPayments = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
    const orderAmt = parseFloat(orderAmount || '0') || 0

    if (totalPayments === 0) {
      return { text: 'Credit Sale', color: 'bg-orange-100 text-orange-800' }
    } else if (totalPayments >= orderAmt) {
      return { text: 'Fully Paid', color: 'bg-green-100 text-green-800' }
    } else {
      return { text: 'Partially Paid', color: 'bg-yellow-100 text-yellow-800' }
    }
  }, [payments, orderAmount])

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

    const zeroQtyItem = items.find((it: any) => Number(it.quantity || 0) <= 0)
    if (zeroQtyItem) {
      toast.error(`Item ${zeroQtyItem.item_code} has 0 quantity. Please set a valid quantity.`)
      return
    }

    setIsSaving(true)

    try {
      // Get current customer
      const selectedCustomer = getCurrentTabCustomer()
      console.log('🔍 Selected customer for order:', selectedCustomer)

      // Use customer_id from stored customer object
      let customerId = selectedCustomer?.customer_id

      console.log('🔍 Customer data for order:', {
        selectedCustomer,
        customer_id: selectedCustomer?.customer_id,
        name: selectedCustomer?.name
      })

      // If customer_id is already stored, use it directly
      if (customerId) {
        console.log('✅ Using stored customer ID:', customerId)
      } else if (selectedCustomer?.name) {
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
          console.log(
            '🔍 Available customers for lookup:',
            customers.map((c) => ({
              customer_name: c.customer_name,
              name: c.name,
              id: c.id
            }))
          )
          const matchingCustomer = customers.find(
            (c: any) => c.customer_name === selectedCustomer.name
          )

          if (matchingCustomer) {
            customerId = matchingCustomer.name // This is the actual customer_id (CUS-XXXXX)
            console.log(
              '✅ Found customer ID:',
              customerId,
              'for customer name:',
              selectedCustomer.name
            )
          } else {
            console.log('❌ No matching customer found for name:', selectedCustomer.name)
            throw new Error(`Customer "${selectedCustomer.name}" not found in system`)
          }
        } catch (lookupError) {
          console.error('❌ Error looking up customer ID:', lookupError)
          throw new Error(`Failed to find customer "${selectedCustomer.name}" in system`)
        }
      }

      // Use resolved customer_id or fallback to name.
      // If still missing, block and ask user to select a customer.
      const finalCustomerId = customerId || selectedCustomer?.name
      if (!finalCustomerId) {
        throw new Error('Please select a customer before proceeding')
      }
      console.log('🔍 Final customer ID for order:', finalCustomerId)

      // Map items for API - let backend handle calculations
      const mappedItems = items.map((item) => {
        const qty = parseFloat(item.quantity || '0') || 1
        const rate = parseFloat(item.standard_rate || '0') || 0
        const discount = parseFloat(item.discount_percentage || '0') || 0
        const isOfferApplied = item.is_offer_applied === 1 ? 1 : 0

        console.log('📊 Sending item data to API:', {
          item_code: item.item_code || item.code,
          qty,
          rate,
          discount: `${discount}%`,
          is_offer_applied: isOfferApplied,
          rawQuantity: item.quantity,
          rawRate: item.standard_rate,
          rawDiscount: item.discount_percentage
        })

        console.log('SHD ==>[item]', item)

        // IMPORTANT:
        // Do NOT hardcode warehouses like "Main WH - NB". That can fail on other deployments and causes:
        // "Could not find Row #1: Delivery Warehouse: <warehouse>"
        // Prefer item-provided warehouse, then POS profile warehouse, otherwise omit and let backend default.
        const resolvedWarehouse =
          item.default_warehouse ||
          (profile as any)?.warehouse ||
          (profile as any)?.default_warehouse ||
          null

        return {
          item_code: item.item_code || item.code,
          qty,
          uom: item.uom || 'Nos',
          rate,
          discount_percentage: item.discount_type === 'Percentage' ? discount : 0,
          discount_amount: item.discount_type === 'Amount' ? (item.discount_amount || 0) : 0,
          is_offer_applied: isOfferApplied,
          ...(resolvedWarehouse ? { warehouse: resolvedWarehouse } : {})
        }
      })

      // Check if any offer is applied with edge case condition (requires security pin):
      // Edge case: available < max AND quantity > available AND quantity <= max
      // Only add security_pin if this specific edge case condition is met
      const requiresSecurityPin = items.some((item) => {
        if (item.is_offer_applied !== 1) return false

        const qty = parseFloat(item.quantity || '0') || 0
        const maxQty = parseFloat(item.offer_max_qty || '0') || 0
        const availableQty = parseFloat(item.offer_available_qty || '0') || 0

        // Edge case condition: available < max AND quantity > available AND quantity <= max
        const isEdgeCase = availableQty > 0 &&
          availableQty < maxQty &&
          qty > availableQty &&
          qty <= maxQty

        return isEdgeCase
      })

      console.log('📊 UI Total (for reference):', orderAmount)
      console.log('📊 Items count:', items.length)
      console.log('📊 Global discount:', globalDiscount)

      // Prepare custom stock adjustment sources from multi-warehouse allocations
      const customStockAdjustmentSources: Array<{
        item_code: string
        source_warehouse: string
        qty: number
        uom: string
      }> = []

      // Process each item to check for multi-warehouse allocations
      for (const item of items) {
        console.log(`🔍 Processing item ${item.item_code || item.code}:`, {
          hasWarehouseAllocations: !!(
            item.warehouseAllocations &&
            Array.isArray(item.warehouseAllocations) &&
            item.warehouseAllocations.length > 0
          ),
          warehouseAllocations: item.warehouseAllocations
        })

        if (
          item.warehouseAllocations &&
          Array.isArray(item.warehouseAllocations) &&
          item.warehouseAllocations.length > 0
        ) {
          // Item has multi-warehouse allocations
          console.log(
            `📦 Item ${item.item_code || item.code} has warehouse allocations:`,
            item.warehouseAllocations
          )
          for (const allocation of item.warehouseAllocations) {
            if (allocation.allocated > 0) {
              customStockAdjustmentSources.push({
                item_code: item.item_code || item.code,
                source_warehouse: allocation.name,
                qty: allocation.allocated,
                uom: item.uom || 'Nos'
              })
            }
          }
        } else {
          // Item has no multi-warehouse allocations - add empty entry
          console.log(
            `📦 Item ${item.item_code || item.code} has no warehouse allocations - adding empty entry`
          )
          customStockAdjustmentSources.push({
            item_code: '',
            source_warehouse: '',
            qty: 0,
            uom: ''
          })
        }
      }

      // If no items have multi-warehouse allocations, add one empty entry
      if (customStockAdjustmentSources.length === 0) {
        customStockAdjustmentSources.push({
          item_code: '',
          source_warehouse: '',
          qty: 0,
          uom: ''
        })
      }

      // Get Other Details from current tab (use the already defined currentTab variable)
      const po_no = currentTab?.po_no?.trim() || null
      const po_date = currentTab?.po_date?.trim() || null
      const internal_note = currentTab?.internal_note?.trim() || null

      // Get posting date from store (selected date from order details)
      const selectedPostingDate = getCurrentTabPostingDate()
      const postingDate = selectedPostingDate || getCurrentDate() // Use selected date or fallback to system date
      console.log('📅 Using posting date:', postingDate, 'from store:', selectedPostingDate)

      // Get reservation status
      const isReserved = getCurrentTabReservation()

      // Get rounding enabled status
      const isRoundingEnabled = getCurrentTabRoundingEnabled()
      // If round box is checked, disable_rounded_total = 0, else 1
      const disable_rounded_total = isRoundingEnabled ? 0 : 1

      // Prepare order data
      const orderData: any = {
        customer: finalCustomerId,
        posting_date: postingDate, // Use the date selected in the order details box
        selling_price_list: selectedPriceList,
        taxes_and_charges: currentTab?.custom_is_exempt === 1 ? profile?.custom_exempt_taxes_and_charges : profile?.taxes_and_charges,
        custom_is_exempt: currentTab?.custom_is_exempt || 0,
        additional_discount_percentage: globalDiscount.type === 'Percentage' ? globalDiscount.percent : 0,
        additional_discount_amount: globalDiscount.type === 'Amount' ? globalDiscount.amount : 0,
        items: mappedItems,
        custom_stock_adjustment_sources: customStockAdjustmentSources,
        is_reserved: isReserved,
        disable_rounded_total: disable_rounded_total
      }

      // Add security_pin only if edge case condition is met (for bypass)
      // Edge case: available < max AND quantity > available AND quantity <= max
      if (requiresSecurityPin) {
        orderData.security_pin = '123456'
        console.log('🔓 Security pin added for edge case offer bypass')
      }

      console.log('SHD ==>[orderData]', orderData)

      // Add Other Details fields if present
      if (po_no) {
        orderData.po_no = po_no
      }
      if (po_date) {
        orderData.po_date = po_date // Already in YYYY-MM-DD format from date input
      }
      if (internal_note) {
        orderData.internal_note = internal_note
      }

      console.log('📦 Order data:', orderData)
      console.log('📦 Selected Price List:', selectedPriceList)
      console.log('📦 Detailed items data:', JSON.stringify(orderData.items, null, 2))
      console.log(
        '📦 Custom Stock Adjustment Sources:',
        JSON.stringify(customStockAdjustmentSources, null, 2)
      )

      let response: any

      // Check if this is an existing order (has orderId) or new order
      if (currentTab.orderId) {
        // Edit existing order
        console.log('📝 Editing existing order:', currentTab.orderId)

        const editData = {
          sales_order_id: currentTab.orderId,
          ...orderData
        }

        console.log('📝 Edit order data:', editData)
        console.log('📝 ===== UPDATE ORDER API CALL =====')
        console.log('📝 API URL: /api/method/centro_pos_apis.api.order.edit_order')
        console.log('📝 Request Method: POST')
        console.log('📝 Request Body:', JSON.stringify(editData, null, 2))
        console.log('📝 Full Request Body Structure:', editData)

        response = await window.electronAPI?.proxy?.request({
          method: 'POST',
          url: '/api/method/centro_pos_apis.api.order.edit_order',
          data: editData
        })

        console.log('📝 ===== UPDATE ORDER API RESPONSE =====')
        console.log('📝 Full Response:', response)
        console.log('📝 Response Data:', JSON.stringify(response.data, null, 2))
        console.log('📝 Response Success:', response?.success)
        console.log('📝 ===== END UPDATE ORDER API RESPONSE =====')

        if (response?.success) {
          console.log('✅ Order updated successfully!')
          // Extract pdf_download_url from response
          const pdfUrl = response.data?.data?.pdf_download_url || response.data?.pdf_download_url
          if (pdfUrl) {
            updateTabInstantPrintUrl(currentTab.id, pdfUrl)
          }
          // Mark tab as not edited after successful save
          setTabEdited(currentTab.id, false)
          // Trigger save completed callback
          onSaveCompleted?.()
          // Navigate to prints tab
          onNavigateToPrints?.()
          toast.success(`Order updated successfully! Order ID: ${currentTab.orderId}`, {
            duration: 2000
          })

          // Fetch order details to refresh status ribbons
          try {
            if (currentTab.orderId) {
              const res = await window.electronAPI?.proxy?.request({
                url: '/api/method/centro_pos_apis.api.order.get_sales_order_details',
                params: {
                  sales_order_id: currentTab.orderId
                },
                method: 'GET'
              })
              if (res?.data?.data && currentTab.id) {
                const orderData = res.data.data
                console.log('🎨 Order details after edit - Status colors:', {
                  status_color: orderData.status_color,
                  zatca_color: orderData.zatca_color,
                  main_status: orderData.main_status,
                  zatca_status: orderData.zatca_status
                })
                updateTabOrderData(currentTab.id, orderData)
                console.log('📋 Order details refreshed after edit. Order status:', orderData?.order_status, 'Return status:', orderData?.linked_invoices?.[0]?.custom_reverse_status)
              }
            }
          } catch (e) {
            console.error('Failed to refresh order details after edit:', e)
          }
        } else {
          // Parse item_error array if present
          const itemErrors: Array<{ message: string; title: string; indicator: string; itemCode: string; idx?: number }> = []
          if (response?.data?.item_error && Array.isArray(response.data.item_error)) {
            response.data.item_error.forEach((itemErr: any) => {
              if (itemErr.item_code && itemErr.error) {
                itemErrors.push({
                  message: itemErr.error,
                  title: 'Item Validation Error',
                  indicator: 'red',
                  itemCode: itemErr.item_code,
                  idx: itemErr.idx !== undefined ? Number(itemErr.idx) : undefined
                })
              }
            })
            console.log('📦 Found item errors:', itemErrors)
          }

          // Check for insufficient stock errors in server messages
          if (response?.data?._server_messages) {
            try {
              const serverMessages = JSON.parse(response.data._server_messages)
              const stockErrors = parseInsufficientStockErrors(serverMessages)
              if (stockErrors.length > 0) {
                console.log('📝 Found insufficient stock errors:', stockErrors)
                // Combine item errors with stock errors
                const allErrors = [...itemErrors, ...stockErrors]
                if (allErrors.length > 0) {
                  onInsufficientStockErrors?.(allErrors)
                }
                return
              }
            } catch (parseError) {
              console.error('Error parsing server messages for stock errors:', parseError)
            }
          }

          // If we have item errors, show them in bottom error box
          if (itemErrors.length > 0) {
            onInsufficientStockErrors?.(itemErrors)
          }

          // Handle server error messages in toast popup (only if present)
          if (response?.data?._server_messages) {
            handleError(response.data._server_messages)
            return
          }
        }
      } else {
        // Create new order
        console.log('📦 Creating new order')
        console.log('📦 ===== CREATE ORDER API CALL =====')
        console.log('📦 API URL: /api/method/centro_pos_apis.api.order.create_order')
        console.log('📦 Request Method: POST')
        console.log('📦 Request Body:', JSON.stringify(orderData, null, 2))
        console.log('📦 Full Request Body Structure:', orderData)
        console.log('📦 Items Count:', orderData.items?.length || 0)
        console.log('📦 Custom Stock Adjustment Sources Count:', orderData.custom_stock_adjustment_sources?.length || 0)

        response = await window.electronAPI?.proxy?.request({
          method: 'POST',
          url: '/api/method/centro_pos_apis.api.order.create_order',
          data: orderData
        })

        console.log('📦 ===== CREATE ORDER API RESPONSE =====')
        console.log('📦 Full Response:', response)
        console.log('📦 Response Data:', JSON.stringify(response.data, null, 2))
        console.log('📦 Response Success:', response?.success)
        console.log('📦 Response Keys:', Object.keys(response.data || {}))
        console.log('📦 ===== END CREATE ORDER API RESPONSE =====')

        if (response?.success) {
          // Update tab with order ID
          const orderId =
            response.data?.data?.sales_order_id ||
            response.data?.data?.name ||
            response.data?.data?.order_id ||
            response.data?.sales_order_id ||
            response.data?.name ||
            response.data?.order_id

          console.log('🔍 Extracted order ID:', orderId)
          console.log('🔍 Response data structure:', response.data)

          if (orderId) {
            updateTabOrderId(currentTab.id, orderId)
            // Extract pdf_download_url from response
            const pdfUrl = response.data?.data?.pdf_download_url || response.data?.pdf_download_url
            if (pdfUrl) {
              updateTabInstantPrintUrl(currentTab.id, pdfUrl)
            }
            // Mark tab as not edited after successful save
            setTabEdited(currentTab.id, false)
            // Trigger save completed callback
            onSaveCompleted?.()
            // Navigate to prints tab
            onNavigateToPrints?.()

            // Fetch order details to refresh status ribbons
            try {
              const res = await window.electronAPI?.proxy?.request({
                url: '/api/method/centro_pos_apis.api.order.get_sales_order_details',
                params: {
                  sales_order_id: orderId
                },
                method: 'GET'
              })
              if (res?.data?.data && currentTab.id) {
                const orderData = res.data.data
                console.log('🎨 Order details after create - Status colors:', {
                  status_color: orderData.status_color,
                  zatca_color: orderData.zatca_color,
                  main_status: orderData.main_status,
                  zatca_status: orderData.zatca_status
                })
                updateTabOrderData(currentTab.id, orderData)
                console.log('📋 Order details refreshed after create. Order status:', orderData?.order_status, 'Return status:', orderData?.linked_invoices?.[0]?.custom_reverse_status)
              }
            } catch (e) {
              console.error('Failed to refresh order details after create:', e)
            }
          }

          // Show success message with relevant information
          console.log('✅ Order created successfully!')
          console.log('📦 API Response:', response)

          // Extract relevant information from response
          const displayOrderId = orderId || 'Unknown'

          // Show clean success message
          toast.success(`Order created successfully! Order ID: ${displayOrderId}`, {
            duration: 2000
          })

          // Navigate to prints tab
          onNavigateToPrints?.()
        } else {
          // Parse item_error array if present
          const itemErrors: Array<{ message: string; title: string; indicator: string; itemCode: string; idx?: number }> = []
          if (response?.data?.item_error && Array.isArray(response.data.item_error)) {
            response.data.item_error.forEach((itemErr: any) => {
              if (itemErr.item_code && itemErr.error) {
                itemErrors.push({
                  message: itemErr.error,
                  title: 'Item Validation Error',
                  indicator: 'red',
                  itemCode: itemErr.item_code,
                  idx: itemErr.idx !== undefined ? Number(itemErr.idx) : undefined
                })
              }
            })
            console.log('📦 Found item errors:', itemErrors)
          }

          // Check for insufficient stock errors in server messages
          if (response?.data?._server_messages) {
            try {
              const serverMessages = JSON.parse(response.data._server_messages)
              const stockErrors = parseInsufficientStockErrors(serverMessages)
              if (stockErrors.length > 0) {
                console.log('📦 Found insufficient stock errors:', stockErrors)
                // Combine item errors with stock errors
                const allErrors = [...itemErrors, ...stockErrors]
                if (allErrors.length > 0) {
                  onInsufficientStockErrors?.(allErrors)
                }
                return
              }
            } catch (parseError) {
              console.error('Error parsing server messages for stock errors:', parseError)
            }
          }

          // If we have item errors, show them in bottom error box
          if (itemErrors.length > 0) {
            onInsufficientStockErrors?.(itemErrors)
          }

          // Handle server error messages in toast popup (only if present)
          if (response?.data?._server_messages) {
            handleError(response.data._server_messages)
            return
          }
        }
      }
    } catch (error) {
      console.error('❌ Error saving order:', error)

      handleError(error, 'Failed to save order. Please try again.')
    } finally {
      setIsSaving(false)
      // Refresh order details so status badges and linked invoice info update immediately
      try {
        const latestOrderId = currentTab?.orderId
        if (currentTab?.id && latestOrderId) {
          const res = await window.electronAPI?.proxy?.request({
            url: '/api/method/centro_pos_apis.api.order.get_sales_order_details',
            params: { sales_order_id: latestOrderId },
            method: 'GET'
          })
          const orderData = res?.data?.data
          if (orderData) {
            console.log('🎨 Order details after save - Status colors:', {
              status_color: orderData.status_color,
              zatca_color: orderData.zatca_color,
              main_status: orderData.main_status,
              zatca_status: orderData.zatca_status
            })
            updateTabOrderData(currentTab.id, orderData)
            // Also persist invoice number/status/reverse status if available
            const linked = orderData.linked_invoices
            let invNo: string | null = null
            let invStatus: string | null = null
            let invReverse: string | null = null
            if (Array.isArray(linked) && linked.length > 0) {
              invNo = linked[0]?.name || null
              invStatus = linked[0]?.status || null
              invReverse = linked[0]?.custom_reverse_status || null
            } else if (linked && typeof linked === 'object') {
              invNo = linked.name || null
              invStatus = linked.status || null
              invReverse = linked.custom_reverse_status || null
            }
            if (invNo) {
              updateTabInvoiceNumber(currentTab.id, invNo, invStatus, invReverse)
            }
          }
        }
      } catch (e) {
        console.warn('⚠️ Failed to refresh order details after save:', e)
      }
    }
  }

  // Order confirmation API function
  const handleOrderConfirmation = async (paymentsArray: Payment[] = [], isConfirmingMode: boolean = false) => {
    // Calculate total payment amount for internal logic/status updates
    const paymentAmount = paymentsArray.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
    // Set processing state at the very beginning to ensure consistent hook calls
    const zeroQtyItem = items.find((it: any) => Number(it.quantity || 0) <= 0)
    if (zeroQtyItem) {
      toast.error(`Item ${zeroQtyItem.item_code} has 0 quantity. Please set a valid quantity.`)
      setIsProcessingPayment(false)
      return
    }

    setIsProcessingPayment(true)

    try {
      if (!currentTab || !currentTab.orderId) {
        toast.error('No order found. Please save the order first.', {
          duration: 5000
        })
        return
      }

      if (!profile?.name) {
        toast.error('POS profile not found. Please check your profile settings.', {
          duration: 5000
        })
        return
      }

      // Check if order is already confirmed (docstatus = 1) - check BEFORE any API call
      let isAlreadyConfirmed = false
      try {
        const orderDetailsCheck = await window.electronAPI?.proxy?.request({
          url: '/api/method/centro_pos_apis.api.order.get_sales_order_details',
          params: {
            sales_order_id: currentTab.orderId
          },
          method: 'GET'
        })
        if (orderDetailsCheck?.data?.data) {
          isAlreadyConfirmed = Number(orderDetailsCheck.data.data.docstatus) === 1
          console.log('📋 Order docstatus checked BEFORE API call:', orderDetailsCheck.data.data.docstatus, 'isConfirmed:', isAlreadyConfirmed)
        }
      } catch (checkError) {
        console.warn('⚠️ Failed to check order docstatus before API call, using cached value:', checkError)
        // Fallback to cached value if API check fails
        isAlreadyConfirmed = currentTab?.orderData && Number(currentTab.orderData.docstatus) === 1
      }

      // If in Payment window (isConfirmingMode = false) and order is already confirmed and total payment amount > 0, directly call payment entry API
      // Skip this if in Confirm window mode
      if (!isConfirmingMode && isAlreadyConfirmed && paymentAmount > 0) {
        try {
          console.log('💳 ===== ORDER ALREADY CONFIRMED, CALLING PAYMENT ENTRY DIRECTLY =====')
          console.log('💳 Payment Amount:', paymentAmount)
          console.log('💳 Order ID:', currentTab.orderId)

          // Get invoice number from current tab or orderData
          let invoiceNumber = getCurrentTabInvoiceNumber()
          console.log('💳 Invoice Number Retrieved:', invoiceNumber)
          if (!invoiceNumber && currentTab?.orderData?.linked_invoices) {
            const linkedInvoices = currentTab.orderData.linked_invoices
            if (Array.isArray(linkedInvoices) && linkedInvoices.length > 0) {
              invoiceNumber = linkedInvoices[0]?.name || null
            } else if (linkedInvoices && typeof linkedInvoices === 'object') {
              invoiceNumber = linkedInvoices.name || null
            }
          }

          if (!invoiceNumber) {
            console.log('⚠️ No invoice number found, fetching order details...')
            // Fetch order details to get invoice number
            const orderDetailsResponse = await window.electronAPI?.proxy?.request({
              url: '/api/method/centro_pos_apis.api.order.get_sales_order_details',
              params: {
                sales_order_id: currentTab.orderId
              }
            })

            if (orderDetailsResponse?.data?.data) {
              const orderData = orderDetailsResponse.data.data
              const linkedInvoices = orderData.linked_invoices
              if (linkedInvoices) {
                if (Array.isArray(linkedInvoices) && linkedInvoices.length > 0) {
                  invoiceNumber = linkedInvoices[0]?.name || null
                } else if (linkedInvoices && typeof linkedInvoices === 'object') {
                  invoiceNumber = linkedInvoices.name || null
                }
              }
            }
          }

          if (!invoiceNumber) {
            toast.error('Invoice number not found. Cannot process payment.', {
              duration: 5000
            })
            return
          }

          // Get customer ID from multiple sources: tab customer, orderData, or store helper
          let customerId = currentTab?.customer?.customer_id || null

          // If not found in tab customer, try orderData
          if (!customerId && currentTab?.orderData?.customer) {
            customerId = currentTab.orderData.customer
            console.log('💳 Customer ID found in orderData:', customerId)
          }

          // If still not found, try getCurrentTabCustomer
          if (!customerId) {
            const selectedCustomer = getCurrentTabCustomer()
            customerId = selectedCustomer?.customer_id || null
            if (customerId) {
              console.log('💳 Customer ID found via getCurrentTabCustomer:', customerId)
            }
          }

          console.log('💳 Customer ID (final):', customerId)
          console.log('💳 Customer sources checked:', {
            tabCustomer: currentTab?.customer?.customer_id,
            orderDataCustomer: currentTab?.orderData?.customer,
            storeCustomer: getCurrentTabCustomer()?.customer_id
          })

          if (!customerId) {
            console.log('❌ Customer ID not found in any source, cannot proceed with payment')
            toast.error('Customer not found. Cannot process payment.', {
              duration: 5000
            })
            return
          }

          // Get posting date from store (selected date from order details) or use payment date
          const selectedPostingDate = getCurrentTabPostingDate()
          const formattedDate = selectedPostingDate || date || getCurrentDate()
          console.log('📅 Using posting date for payment entry:', formattedDate, 'from store:', selectedPostingDate)
          console.log('💳 Payments Count:', paymentsArray.length)
          console.log('💳 Payment Date:', date)

          // Loop through payments and create payment entries
          for (const payment of paymentsArray) {
            const rowAmount = parseFloat(payment.amount) || 0
            if (rowAmount <= 0) continue

            const paymentEntryData = {
              payment_type: 'Receive',
              party_type: 'Customer',
              party: customerId,
              posting_date: formattedDate,
              paid_amount: rowAmount,
              mode_of_payment: payment.mode,
              reference_no: payment.reference_no || null,
              reference_date: payment.reference_date || null,
              references: [
                {
                  reference_doctype: 'Sales Invoice',
                  reference_name: invoiceNumber,
                  allocated_amount: rowAmount
                }
              ]
            }

            console.log(`💳 ===== CREATE PAYMENT ENTRY API CALL (${payment.mode}) =====`)
            console.log('💳 Request Body:', JSON.stringify(paymentEntryData, null, 2))

            const paymentEntryResponse = await window.electronAPI?.proxy?.request({
              method: 'POST',
              url: '/api/method/centro_pos_apis.api.order.create_payment_entry',
              data: paymentEntryData
            })

            console.log(`💳 ===== CREATE PAYMENT ENTRY API RESPONSE (${payment.mode}) =====`)
            console.log('💳 Response Success:', paymentEntryResponse?.success)

            if (paymentEntryResponse?.success) {
              console.log(`✅ Payment entry created successfully for mode: ${payment.mode}`)
              // Extract pdf_download_url if available
              const pdfUrl = paymentEntryResponse.data?.data?.pdf_download_url || paymentEntryResponse.data?.pdf_download_url
              if (pdfUrl) {
                updateTabInstantPrintUrl(currentTab.id, pdfUrl)
              }
            } else {
              handleError(paymentEntryResponse?.data?._server_messages || `Failed to create payment entry for ${payment.mode}`)
            }
          }

          toast.success(`Payments processed successfully! Order ID: ${currentTab.orderId}`)

          // Update tab status to paid
          setTabStatus(currentTab.id, 'paid')

          // Fetch order details to refresh outstanding_amount after payment
          try {
            if (currentTab.orderId) {
              const orderDetailsRes = await window.electronAPI?.proxy?.request({
                url: '/api/method/centro_pos_apis.api.order.get_sales_order_details',
                params: {
                  sales_order_id: currentTab.orderId
                },
                method: 'GET'
              })
              if (orderDetailsRes?.data?.data && currentTab.id) {
                const orderData = orderDetailsRes.data.data
                updateTabOrderData(currentTab.id, orderData)
              }
            }
          } catch (e) {
            console.error('Failed to refresh order details after payment:', e)
          }

          // Close dialog and navigate to prints
          setOpen(false)
          onNavigateToPrints?.()
          return
        } catch (paymentError: any) {
          console.error('💳 ===== ERROR CREATING PAYMENT ENTRY =====')
          console.error('💳 Error Object:', paymentError)
          console.error('💳 Error Message:', paymentError?.message)
          console.error('💳 Error Stack:', paymentError?.stack)
          console.error('💳 Error Response:', paymentError?.response)
          console.error('💳 Error Response Data:', paymentError?.response?.data)
          console.error('💳 Error Response Status:', paymentError?.response?.status)
          console.error('💳 Server Messages:', paymentError?.response?.data?._server_messages)
          console.error('💳 ===== END ERROR =====')
          handleError(paymentError?.response?.data?._server_messages || paymentError, 'Failed to create payment entry. Please try again.')
          return
        }
      }

      // If we reach here:
      // - In Confirm window: Always call confirmation API (payment API is skipped)
      // - In Payment window: Order is not confirmed, so call confirmation API first, then check docstatus and call payment API if needed
      console.log('🔄 ===== ORDER CONFIRMATION API CALL START =====')
      console.log('🔄 Mode:', isConfirmingMode ? 'Confirm Window' : 'Payment Window')
      console.log('🔄 API Endpoint: /api/method/centro_pos_apis.api.order.order_confirmation')

      // Context Information
      console.log('📋 ===== CONTEXT INFORMATION =====')
      console.log('📋 Current Tab ID:', currentTab.id)
      console.log('📋 Order ID:', currentTab.orderId)
      console.log('📋 Tab Status:', currentTab.status)
      console.log('📋 Tab Type:', currentTab.type)
      console.log('📋 Tab Display Name:', currentTab.displayName)
      console.log('📋 Tab Is Edited:', currentTab.isEdited)

      // Customer Information
      const customer = getCurrentTabCustomer()
      console.log('👤 Customer Information:', {
        name: customer?.name || 'No customer',
        customer_id: customer?.customer_id || 'N/A',
        gst: customer?.gst || 'N/A'
      })

      // Order Items
      const tabItems = getCurrentTabItems()
      console.log('📦 Order Items Count:', tabItems.length)
      console.log('📦 Order Items:', tabItems.map(item => ({
        item_code: item.item_code,
        item_name: item.item_name,
        quantity: item.quantity,
        rate: item.standard_rate,
        discount_percentage: item.discount_percentage
      })))

      // Price List
      console.log('💰 Selected Price List:', selectedPriceList)

      // Order Amounts
      console.log('💵 Order Amount:', orderAmount)
      console.log('💵 Amount Due:', amountDue)
      console.log('💵 Total Pending:', totalPending)

      // Payment Information
      console.log('💳 Payments Count:', paymentsArray.length)
      console.log('💳 Payments:', JSON.stringify(paymentsArray, null, 2))
      console.log('💳 Payment Date:', date)

      // POS Profile
      console.log('🏪 POS Profile:', {
        name: profile.name,
        company: (profile as any).company || 'N/A',
        warehouse: (profile as any).warehouse || 'N/A'
      })

      // Other Details
      console.log('📝 Other Details:', {
        po_no: currentTab.po_no || null,
        po_date: currentTab.po_date || null,
        internal_note: currentTab.internal_note || null
      })

      // Rounding
      console.log('🔢 Rounding Enabled:', getCurrentTabRoundingEnabled())

      console.log('📋 ===== END CONTEXT INFORMATION =====')

      const confirmationData = {
        sales_order_id: currentTab.orderId,
        pos_profile: profile.name,
        payments: paymentsArray.map(p => ({
          mode_of_payment: p.mode,
          amount: parseFloat(p.amount) || 0,
          reference_no: p.reference_no || null,
          reference_date: p.reference_date || null
        }))
      }

      console.log('📦 Request Data:', JSON.stringify(confirmationData, null, 2))

      const response = await window.electronAPI?.proxy?.request({
        method: 'POST',
        url: '/api/method/centro_pos_apis.api.order.order_confirmation',
        data: confirmationData
      })

      console.log('📦 ===== ORDER CONFIRMATION API RESPONSE =====')
      console.log('📦 Full Response Object:', response)
      console.log('📦 Response Status:', response?.status)
      console.log('📦 Response Success:', response?.success)
      console.log('📦 Response Data:', JSON.stringify(response?.data, null, 2))
      console.log('📦 Response Headers:', response?.headers)
      console.log('📦 ===== END API RESPONSE =====')

      if (response?.success) {
        console.log('✅ ===== ORDER CONFIRMATION SUCCESS =====')
        console.log('✅ Order confirmed successfully!')
        console.log('✅ Payments:', paymentsArray)
        console.log('✅ Order ID:', currentTab.orderId)

        // Extract pdf_download_url from response
        const pdfUrl = response.data?.data?.pdf_download_url || response.data?.pdf_download_url
        if (pdfUrl) {
          console.log('📄 PDF Download URL extracted:', pdfUrl)
          updateTabInstantPrintUrl(currentTab.id, pdfUrl)
        } else {
          console.log('⚠️ No PDF download URL found in response')
        }

        // Fetch order details to get linked_invoices and invoice number
        try {
          console.log('📋 ===== FETCHING ORDER DETAILS AFTER CONFIRMATION =====')
          console.log('📋 Fetching order details to get invoice number...')
          console.log('📋 Order ID:', currentTab.orderId)

          const orderDetailsResponse = await window.electronAPI?.proxy?.request({
            url: '/api/method/centro_pos_apis.api.order.get_sales_order_details',
            params: {
              sales_order_id: currentTab.orderId
            }
          })

          console.log('📋 Order Details API Response:', orderDetailsResponse)

          if (orderDetailsResponse?.data?.data) {
            const orderData = orderDetailsResponse.data.data
            console.log('📋 ===== ORDER DETAILS FETCHED =====')
            console.log('📋 Order Data:', JSON.stringify(orderData, null, 2))
            console.log('📋 Order Docstatus:', orderData.docstatus)
            console.log('📋 Order Status:', orderData.status)
            console.log('📋 Order Grand Total:', orderData.grand_total)
            console.log('📋 Linked Invoices:', orderData.linked_invoices)
            console.log('🎨 Status colors from API:', {
              status_color: orderData.status_color,
              zatca_color: orderData.zatca_color,
              main_status: orderData.main_status,
              sub_status: orderData.sub_status,
              zatca_status: orderData.zatca_status
            })

            // Prepare fresh orderData with _relatedData preserved and cleared
            const freshOrderData = {
              ...orderData, // Fresh data from API (includes status_color, zatca_color, etc.)
              _relatedData: currentTab.orderData?._relatedData ? {
                ...currentTab.orderData._relatedData,
                customerInsights: null, // Clear cached insights to trigger refresh
                customerDetails: null
              } : undefined
            }

            // Update orderData in the tab with fresh data (preserving _relatedData structure but clearing cache)
            updateTabOrderData(currentTab.id, freshOrderData)
            console.log('✅ Order data updated in tab with fresh status colors')

            // Extract and handle ZATCA responses from order details API AFTER order data is updated
            // zatca_response is in the order details API response, not the order confirmation API
            const zatcaResponseData = orderData.zatca_response

            console.log('📦 ===== CHECKING FOR ZATCA RESPONSE IN ORDER DETAILS =====')
            console.log('📦 ZATCA Response Data:', JSON.stringify(zatcaResponseData, null, 2))

            if (zatcaResponseData && onZatcaResponses) {
              console.log('📦 ===== ZATCA RESPONSE FOUND =====')

              // Handle both array and single object responses
              const zatcaResponses = Array.isArray(zatcaResponseData)
                ? zatcaResponseData
                : [zatcaResponseData]

              console.log('📦 Parsed ZATCA Responses:', zatcaResponses)
              console.log('📦 Calling onZatcaResponses with:', zatcaResponses)
              onZatcaResponses(zatcaResponses)
            } else {
              console.log('📦 No ZATCA response found in order details or onZatcaResponses not available')
            }

            // Extract invoice number, status, and custom_reverse_status from linked_invoices
            const linkedInvoices = orderData.linked_invoices
            let invoiceNumber = null
            let invoiceStatus = null
            let invoiceCustomReverseStatus = null

            console.log('📋 ===== EXTRACTING INVOICE NUMBER =====')
            console.log('📋 Linked invoices raw data:', JSON.stringify(linkedInvoices, null, 2))
            console.log('📋 Linked invoices type:', typeof linkedInvoices)
            console.log('📋 Is array:', Array.isArray(linkedInvoices))

            if (linkedInvoices) {
              if (Array.isArray(linkedInvoices) && linkedInvoices.length > 0) {
                console.log('📋 Linked invoices is an array with length:', linkedInvoices.length)
                const firstInvoice = linkedInvoices[0]
                console.log('📋 First invoice object:', JSON.stringify(firstInvoice, null, 2))
                invoiceNumber = firstInvoice?.name || null
                invoiceStatus = firstInvoice?.status || null
                invoiceCustomReverseStatus = firstInvoice?.custom_reverse_status || null
                console.log('📋 First invoice name field:', invoiceNumber)
                console.log('📋 First invoice status field:', invoiceStatus)
                console.log('📋 First invoice custom_reverse_status field:', invoiceCustomReverseStatus)
              } else if (linkedInvoices && typeof linkedInvoices === 'object' && !Array.isArray(linkedInvoices)) {
                console.log('📋 Linked invoices is an object:', JSON.stringify(linkedInvoices, null, 2))
                invoiceNumber = linkedInvoices.name || null
                invoiceStatus = linkedInvoices.status || null
                invoiceCustomReverseStatus = linkedInvoices.custom_reverse_status || null
                console.log('📋 Linked invoices name field:', invoiceNumber)
                console.log('📋 Linked invoices status field:', invoiceStatus)
                console.log('📋 Linked invoices custom_reverse_status field:', invoiceCustomReverseStatus)
              } else {
                console.log('⚠️ Linked invoices is neither array nor object:', linkedInvoices)
              }

              if (invoiceNumber) {
                console.log('✅ Invoice number successfully extracted:', invoiceNumber)
                console.log('✅ Invoice status:', invoiceStatus)
                console.log('✅ Invoice custom_reverse_status:', invoiceCustomReverseStatus)
                updateTabInvoiceNumber(currentTab.id, invoiceNumber, invoiceStatus, invoiceCustomReverseStatus)
                console.log('✅ Invoice number, status, and custom_reverse_status stored in tab with ID:', currentTab.id)
              } else {
                console.log('⚠️ No invoice number found in linked_invoices')
                console.log('⚠️ Full linked_invoices structure:', JSON.stringify(linkedInvoices, null, 2))
              }
            } else {
              console.log('⚠️ No linked_invoices found in order data')
              console.log('⚠️ Order data keys:', orderData ? Object.keys(orderData) : 'No order data')
            }

            console.log('📋 ===== END EXTRACTING INVOICE NUMBER =====')

            // Check docstatus AFTER confirmation API call
            const isOrderConfirmed = Number(orderData.docstatus) === 1
            console.log('📋 Order docstatus checked AFTER confirmation API:', orderData.docstatus, 'isConfirmed:', isOrderConfirmed)

            // Only call payment API if:
            // 1. NOT in Confirm window mode (isConfirmingMode = false)
            // 2. Order is confirmed (docstatus = 1)
            // 3. Payment amount > 0
            // 4. Invoice number exists
            if (!isConfirmingMode && isOrderConfirmed && paymentAmount > 0 && invoiceNumber) {
              try {
                console.log('💳 ===== CREATING PAYMENT ENTRY FOR CONFIRMED ORDER =====')
                console.log('💳 Order is confirmed, calling create_payment_entry API...')

                // Get customer ID from multiple sources: tab customer, orderData, or store helper
                let customerId = currentTab?.customer?.customer_id || null

                // If not found in tab customer, try orderData
                if (!customerId && orderData?.customer) {
                  customerId = orderData.customer
                  console.log('💳 Customer ID found in orderData (confirmed order):', customerId)
                }

                // If still not found, try getCurrentTabCustomer
                if (!customerId) {
                  const selectedCustomer = getCurrentTabCustomer()
                  customerId = selectedCustomer?.customer_id || null
                  if (customerId) {
                    console.log('💳 Customer ID found via getCurrentTabCustomer (confirmed order):', customerId)
                  }
                }

                console.log('💳 Customer ID (final, confirmed order):', customerId)
                console.log('💳 Customer sources checked (confirmed order):', {
                  tabCustomer: currentTab?.customer?.customer_id,
                  orderDataCustomer: orderData?.customer,
                  storeCustomer: getCurrentTabCustomer()?.customer_id
                })

                if (!customerId) {
                  console.log('⚠️ No customer ID found in any source, cannot create payment entry')
                } else {
                  // Get posting date from store (selected date from order details) or use payment date
                  const selectedPostingDate = getCurrentTabPostingDate()
                  const formattedDate = selectedPostingDate || date || getCurrentDate()

                  for (const payment of paymentsArray) {
                    const rowAmount = parseFloat(payment.amount) || 0
                    if (rowAmount <= 0) continue

                    const paymentEntryData = {
                      payment_type: 'Receive',
                      party_type: 'Customer',
                      party: customerId,
                      posting_date: formattedDate,
                      paid_amount: rowAmount,
                      mode_of_payment: payment.mode,
                      reference_no: payment.reference_no || null,
                      reference_date: payment.reference_date || null,
                      references: [
                        {
                          reference_doctype: 'Sales Invoice',
                          reference_name: invoiceNumber,
                          allocated_amount: rowAmount
                        }
                      ]
                    }

                    console.log(`💳 ===== CREATE PAYMENT ENTRY API CALL (CONFIRMED ORDER - ${payment.mode}) =====`)
                    await window.electronAPI?.proxy?.request({
                      method: 'POST',
                      url: '/api/method/centro_pos_apis.api.order.create_payment_entry',
                      data: paymentEntryData
                    })
                  }
                }
              } catch (paymentError: any) {
                console.error('💳 ===== ERROR CREATING PAYMENT ENTRY (CONFIRMED ORDER PATH) =====')
                console.error('💳 Error Object:', paymentError)
                console.error('💳 Error Message:', paymentError?.message)
                console.error('💳 Error Stack:', paymentError?.stack)
                console.error('💳 Error Response:', paymentError?.response)
                console.error('💳 Error Response Data:', paymentError?.response?.data)
                console.error('💳 Error Response Status:', paymentError?.response?.status)
                console.error('💳 Server Messages:', paymentError?.response?.data?._server_messages)
                console.error('💳 ===== END ERROR =====')
                // Don't block the flow if payment entry fails - order is already confirmed
              }
            } else {
              if (isConfirmingMode) {
                console.log('🔘 Confirm window mode - skipping payment entry API call')
              } else if (!isOrderConfirmed) {
                console.log('📋 Order is not confirmed (docstatus != 1), skipping payment entry API call')
              } else if (paymentAmount <= 0) {
                console.log('📋 Payment amount is 0, skipping payment entry API call')
              } else if (!invoiceNumber) {
                console.log('📋 No invoice number available, skipping payment entry API call')
              }
            }

            console.log('📋 ===== END ORDER DETAILS =====')
          } else {
            console.log('⚠️ No order data in response')
          }
        } catch (error) {
          console.error('❌ ===== ERROR FETCHING ORDER DETAILS =====')
          console.error('❌ Error:', error)
          console.error('❌ Error message:', (error as any)?.message)
          console.error('❌ Error stack:', (error as any)?.stack)
          console.error('❌ ===== END ERROR =====')
          // Don't block the flow if this fails
        }

        // Update tab status based on payment amount
        const newStatus = paymentAmount > 0 ? 'paid' : 'confirmed'
        console.log('✅ ===== UPDATING TAB STATUS =====')
        console.log('✅ New Status:', newStatus)
        console.log('✅ Previous Status:', currentTab.status)
        console.log('✅ Payment Amount:', paymentAmount)
        setTabStatus(currentTab.id, newStatus)
        console.log('✅ Tab status updated')

        // Note: _relatedData clearing is now done in the order details update above
        // to preserve status colors from the fresh API response

        const action = paymentAmount > 0 ? 'paid' : 'confirmed'
        console.log('✅ Showing success toast for action:', action)
        toast.success(`Order ${action} successfully! Order ID: ${currentTab.orderId}`, {
          duration: 2000
        })

        console.log('✅ ===== POST-CONFIRMATION ACTIONS =====')
        console.log('✅ Closing dialog and resetting form')
        // Close the dialog
        setOpen(false)
        // Navigate to prints tab
        console.log('✅ Navigating to prints tab')
        onNavigateToPrints?.()

        // Final context summary
        console.log('📋 ===== FINAL CONTEXT SUMMARY =====')
        const updatedTab = getCurrentTab()
        console.log('📋 Updated Tab Status:', updatedTab?.status)
        console.log('📋 Updated Tab Invoice Number:', getCurrentTabInvoiceNumber())
        console.log('📋 Updated Tab Instant Print URL:', updatedTab?.instantPrintUrl)
        console.log('📋 Updated Tab Order Data Docstatus:', updatedTab?.orderData?.docstatus)
        console.log('📋 ===== END FINAL CONTEXT SUMMARY =====')

        console.log('✅ ===== ORDER CONFIRMATION SUCCESS END =====')
      } else {
        console.log('❌ ===== ORDER CONFIRMATION FAILED =====')
        console.log('❌ API call failed - response.success is false')
        console.log('❌ Response:', response)

        // Handle server error messages
        if (response?.data?._server_messages) {
          handleError(response.data._server_messages)
        } else {
          toast.error('Failed to confirm order. Please try again.')
        }
        return
      }
    } catch (error) {
      console.log('❌ ===== ORDER CONFIRMATION CATCH ERROR =====')
      console.error('❌ Error confirming order:', error)
      console.error('❌ Error message:', (error as any)?.message)
      console.error('❌ Error stack:', (error as any)?.stack)
      console.log('❌ ===== ORDER CONFIRMATION CATCH ERROR END =====')

      handleError(error, 'Failed to confirm order. Please try again.')
    } finally {
      console.log('🔄 Setting isProcessingPayment to false')
      setIsProcessingPayment(false)

      // After confirming, fetch order details to check docstatus, outstanding_amount, and lock tab if submitted
      try {
        const latestOrderId = currentTab?.orderId
        if (latestOrderId) {
          const res = await window.electronAPI?.proxy?.request({
            url: '/api/method/centro_pos_apis.api.order.get_sales_order_details',
            params: {
              sales_order_id: latestOrderId
            },
            method: 'GET'
          })
          const doc = res?.data?.data
          if (doc && currentTab?.id) {
            // Update orderData to refresh outstanding_amount check
            updateTabOrderData(currentTab.id, doc)
            if (Number(doc.docstatus) === 1) {
              setTabStatus(currentTab.id, 'confirmed')

              // Update orderAmount to use outstanding_amount for confirmed orders
              const linkedInvoices = doc.linked_invoices
              let outstandingAmount = 0

              if (linkedInvoices) {
                if (Array.isArray(linkedInvoices) && linkedInvoices.length > 0) {
                  outstandingAmount = Number(linkedInvoices[0]?.outstanding_amount ?? 0)
                } else if (typeof linkedInvoices === 'object' && !Array.isArray(linkedInvoices)) {
                  outstandingAmount = Number((linkedInvoices as any)?.outstanding_amount ?? 0)
                }
              }

              // Update Order Amount to use outstanding_amount
              setOrderAmount(outstandingAmount.toFixed(2))

              // Fetch Amount Due from customer insights API and calculate: Amount Due = (fetched) - Order Amount
              try {
                let customerId = currentTab?.customer?.customer_id
                if (!customerId && currentTab?.customer?.name) {
                  const listRes = await window.electronAPI?.proxy?.request({
                    url: '/api/method/centro_pos_apis.api.customer.customer_list',
                    params: { search_term: '', limit_start: 1, limit_page_length: 50 }
                  })
                  const list = listRes?.data?.data || []
                  const match = list.find((c: any) => c.customer_name === currentTab?.customer?.name)
                  customerId = match?.name
                }

                if (customerId) {
                  const insightsRes = await window.electronAPI?.proxy?.request({
                    url: '/api/method/centro_pos_apis.api.customer.customer_amount_insights',
                    params: { customer_id: customerId }
                  })
                  const fetchedAmountDue = Number(insightsRes?.data?.data?.amount_due ?? 0)

                  // Calculate Amount Due = (fetched Amount Due) - Order Amount
                  const calculatedAmountDue = Math.max(0, fetchedAmountDue - outstandingAmount)

                  console.log('📋 Order confirmed - Fetched Amount Due from API:', fetchedAmountDue)
                  console.log('📋 Order confirmed - Order Amount (outstanding_amount):', outstandingAmount)
                  console.log('📋 Order confirmed - Calculated Amount Due (fetched - order):', calculatedAmountDue)

                  setAmountDue(calculatedAmountDue.toFixed(2))
                }
              } catch (err) {
                console.error('Failed to fetch amount due after confirmation:', err)
              }
            }
            console.log('📋 Order details refreshed after confirm/pay. Outstanding amount:', doc?.linked_invoices?.[0]?.outstanding_amount)
          }
        }
      } catch (e) {
        console.error('Failed to refresh order after confirm:', e)
      }
    }
  }

  const handleConfirm = useCallback(() => {
    if (!currentTab) return
    console.log('🔘 Confirm button clicked - opening payment dialog')
    setPayments([
      {
        mode: 'Cash',
        amount: '0',
        reference_no: '',
        reference_date: getCurrentDate(),
        id: crypto.randomUUID()
      }
    ]) // Reset payments to '0' for confirm mode
    setIsConfirming(true) // Set confirming state
    setOpen('confirm')
    setShowValidationErrors(false)
  }, [currentTab])

  const handlePay = useCallback(() => {
    if (!currentTab) return
    console.log('💳 Pay button clicked - opening payment dialog')
    setPayments([
      {
        mode: 'Cash',
        amount: '0',
        reference_no: '',
        reference_date: getCurrentDate(),
        id: crypto.randomUUID()
      }
    ]) // Reset payments to '0' for pay mode
    setIsConfirming(false) // Reset confirming state
    setOpen('pay')
    setShowValidationErrors(false)
  }, [currentTab])

  const handleReturn = () => {
    console.log('🔄 Return button clicked - opening return modal')
    setIsReturnModalOpen(true)
  }

  // Keyboard shortcuts for Confirm and Pay
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey) {
        const key = e.key.toLowerCase()
        if (key === 's') {
          e.preventDefault()
          console.log('⌨️ Ctrl+Shift+S pressed - opening confirm dialog')
          handleConfirm()
        } else if (key === 'f') {
          e.preventDefault()
          console.log('⌨️ Ctrl+Shift+F pressed - opening pay dialog')
          handlePay()
        }
      } else if (e.ctrlKey && !e.shiftKey) {
        const key = e.key.toLowerCase()
        if (key === 'r') {
          e.preventDefault()
          console.log('⌨️ Ctrl+R pressed - opening return modal')
          handleReturn()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleConfirm, handlePay])

  // Handler for Confirm/Pay button click
  const handleConfirmPayClick = useCallback(async () => {
    // Wrap in try-catch to prevent errors from propagating to React error boundary
    try {
      console.log('💳 Confirm/Pay clicked in dialog')

      // Validation: Ensure for non-Cash payments, reference_no and reference_date are mandatory
      // Skip validation if autogenerate_bank_references is enabled in profile
      for (const payment of payments) {
        if (
          payment.mode !== 'Cash' &&
          !(profile as any)?.custom_autogenerate_bank_references
        ) {
          const rowAmount = parseFloat(payment.amount) || 0
          if (rowAmount > 0) {
            if (!payment.reference_no?.trim() || !payment.reference_date) {
              setShowValidationErrors(true)
              if (!payment.reference_no?.trim()) toast.error(`Reference Number is required for ${payment.mode} payment`)
              else if (!payment.reference_date) toast.error(`Reference Date is required for ${payment.mode} payment`)
              return
            }
          }
        }
      }

      // Validation: Ensure total payment does not exceed order amount
      const totalPayments = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
      const orderAmt = parseFloat(orderAmount || '0') || 0

      // We allow small rounding differences (e.g. 0.01) if necessary, but generally should be exact or less
      if (totalPayments > orderAmt + 0.01) {
        toast.error(`Total payment amount (${totalPayments.toFixed(2)}) cannot exceed order amount (${orderAmt.toFixed(2)})`)
        return
      }

      // Call order confirmation API with payments from dialog
      // Pass isConfirming flag to distinguish between Confirm window and Payment window
      await handleOrderConfirmation(payments, isConfirming)

      // Reset form and close dialogs (only if no error occurred)
      setOpen(false)
      setPayments([
        {
          mode: 'Cash',
          amount: '0',
          reference_no: '',
          reference_date: getCurrentDate(),
          id: crypto.randomUUID()
        }
      ])
      setDate(getCurrentDate())
      setIsConfirming(false)
      setShowValidationErrors(false)
    } catch (error) {
      // Errors are already handled in handleOrderConfirmation
      // Just ensure state is reset
      console.error('Error in Confirm/Pay onClick:', error)
      setIsProcessingPayment(false)
    }
  }, [payments, isConfirming, handleOrderConfirmation])

  // Spacebar shortcut to cycle payment modes for the last row and Shift+Enter to confirm
  useEffect(() => {
    if (!open) return // Only listen when modal is open

    const handleModalKeys = (e: KeyboardEvent) => {
      // Only handle shortcuts if not typing in an input field (except for Shift+Enter which can work in inputs)
      const target = e.target as HTMLElement
      const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      // Shift+Enter or Ctrl+Enter: Trigger Confirm button
      if ((e.key === 'Enter' && e.shiftKey) || (e.key === 'Enter' && e.ctrlKey)) {
        // Allow Shift+Enter even in input fields (common pattern for submitting forms)
        if (!isProcessingPayment) {
          e.preventDefault()
          e.stopPropagation()
          console.log('⌨️ Shift+Enter pressed - triggering Confirm/Pay')
          handleConfirmPayClick()
        }
      }
      // Spacebar: Cycle payment modes of the last row (only if not in input field)
      else if (e.key === ' ' && !isInputField) {
        e.preventDefault()
        e.stopPropagation()

        setPayments((prev) => {
          const lastIndex = prev.length - 1
          if (lastIndex < 0) return prev

          const currentMode = prev[lastIndex].mode
          const currentIndex = paymentModes.indexOf(currentMode)
          const nextIndex = (currentIndex + 1) % paymentModes.length
          const nextMode = paymentModes[nextIndex]

          console.log('⌨️ Spacebar pressed - cycling payment mode from', currentMode, 'to', nextMode)
          const newPayments = [...prev]
          newPayments[lastIndex] = { ...newPayments[lastIndex], mode: nextMode }
          return newPayments
        })
      }
      // Add new payment row with Ctrl+Plus or Alt+A
      else if ((e.ctrlKey && (e.key === '+' || e.key === '=')) || (e.altKey && (e.key === 'a' || e.key === 'A'))) {
        e.preventDefault()
        e.stopPropagation()
        console.log('⌨️ Add Payment shortcut pressed')
        setPayments((prev) => [
          ...prev,
          {
            mode: 'Cash',
            amount: '0',
            reference_no: '',
            reference_date: getCurrentDate(),
            id: crypto.randomUUID()
          }
        ])
      }
    }

    document.addEventListener('keydown', handleModalKeys)
    return () => document.removeEventListener('keydown', handleModalKeys)
  }, [open, paymentModes, isProcessingPayment, handleConfirmPayClick])

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
      <div className="p-3">
        <div className="flex justify-end items-center">
          <div className="flex gap-4">
            {/* Save Button - Always show, disable based on conditions */}
            <Button
              data-testid="save-button"
              variant="tab-yellow"
              className="px-4 py-2 font-medium transition-all duration-300 flex items-center gap-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!currentUserPrivileges?.sales || currentTab?.status === 'confirmed' || currentTab?.status === 'paid' || !currentTab?.isEdited || isSaving || isConfirming || isItemTableEditing}
              onClick={async () => {
                // Wrap in try-catch to prevent errors from propagating to React error boundary
                try {
                  await handleSave()
                } catch (error) {
                  // Errors are already handled in handleSave
                  console.error('Error in handleSave onClick:', error)
                }
              }}
            >
              {isSaving ? (
                <>
                  <i className="fas fa-spinner fa-spin text-xs"></i>
                  {currentTab?.orderId ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="floppy-disk" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor">
                    <path d="M64 32C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64H384c35.3 0 64-28.7 64-64V173.3c0-17-6.7-33.3-18.7-45.3L352 18.7C340 6.7 323.7 0 306.7 0H64zm0 96H384V416H64V128zM224 288a64 64 0 1 1 0 128 64 64 0 1 1 0-128z"></path>
                  </svg>
                  {currentTab?.orderId ? 'Update' : 'Save'}
                  <span className="text-[8px] opacity-80 bg-white/20 px-1 py-0 rounded ml-0.5">
                    Ctrl+S
                  </span>
                </>
              )}
            </Button>

            {/* Confirm Button - Only enable if order is created (has orderId) and there are NO unsaved edits */}
            <Button
              variant="tab-emerald"
              className="px-4 py-2 font-medium transition-all duration-300 flex items-center gap-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={
                !currentUserPrivileges?.billing ||
                !currentTab?.orderId ||
                currentTab?.status === 'confirmed' ||
                currentTab?.status === 'paid' ||
                // If there are unsaved edits (Update button active), block Confirm
                currentTab?.isEdited ||
                isItemTableEditing ||
                isSaving
              }
              onClick={handleConfirm}
            >
              <svg className="w-3 h-3" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="paper-plane" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor">
                <path d="M498.1 5.6c10.1 7 15.4 19.1 13.5 31.2l-64 416c-1.5 9.7-7.4 18.2-16 23s-18.9 5.4-28 1.6L284 427.7l-68.5 74.1c-8.9 9.7-22.9 12.9-35.2 8.1S160 493.2 160 480V396.4c0-4 1.5-7.8 4.2-10.7L331.8 202.8c5.8-6.3 5.6-16-.4-22s-15.7-6.4-22-.7L106 360.8 17.7 316.6C7.1 311.3 .3 300.7 0 288.9s5.9-22.8 16.1-28.7l448-256c10.7-6.1 23.9-5.5 34 1.4z"></path>
              </svg>
              Confirm
              <span className="text-[8px] opacity-80 bg-white/20 px-1 py-0 rounded ml-0.5">Shift+S</span>
            </Button>

            {/* Pay Button - Only enable if order is created (has orderId) */}
            {(() => {
              // Check if outstanding_amount is 0.0 in linked_invoices[0]
              const linkedInvoices = currentTab?.orderData?.linked_invoices
              const firstLinkedInvoice = Array.isArray(linkedInvoices) && linkedInvoices.length > 0 ? linkedInvoices[0] : null
              const outstandingAmount = firstLinkedInvoice?.outstanding_amount
              // Check if order is confirmed (docstatus = 1)
              const docstatus = currentTab?.orderData ? Number(currentTab.orderData.docstatus) : null
              const isConfirmed = docstatus === 1
              const shouldDisablePayButton = !currentUserPrivileges?.billing || !currentTab?.orderId || outstandingAmount === 0.0 || outstandingAmount === 0 || !isConfirmed

              return (
                <Button
                  variant="tab-blue"
                  className="px-4 py-2 font-medium transition-all duration-300 flex items-center gap-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={shouldDisablePayButton || isItemTableEditing}
                  onClick={handlePay}
                >
                  <svg className="w-3 h-3" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="credit-card" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" fill="currentColor">
                    <path d="M64 32C28.7 32 0 60.7 0 96v32H576V96c0-35.3-28.7-64-64-64H64zM576 224H0V416c0 35.3 28.7 64 64 64H512c35.3 0 64-28.7 64-64V224zM112 352h64c8.8 0 16 7.2 16 16s-7.2 16-16 16H112c-8.8 0-16-7.2-16-16s7.2-16 16-16zm112 16c0-8.8 7.2-16 16-16H368c8.8 0 16 7.2 16 16s-7.2 16-16 16H240c-8.8 0-16-7.2-16-16z"></path>
                  </svg>
                  Pay
                  <span className="text-[8px] opacity-80 bg-white/20 px-1 py-0 rounded ml-0.5">Shift+F</span>
                </Button>
              )
            })()}

            {/* Return Button - Only enable if order is confirmed (docstatus = 1) */}
            <Button
              data-testid="return-button"
              variant="tab-orange"
              className="relative px-4 py-2 font-medium transition-all duration-300 flex items-center gap-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={(() => {
                // Check if order is confirmed (docstatus = 1)
                const docstatus = currentTab?.orderData ? Number(currentTab.orderData.docstatus) : null
                const isConfirmed = docstatus === 1
                // Disable if: not confirmed OR no return privilege OR order is fully returned
                return !currentUserPrivileges?.return || !isConfirmed || currentTab?.orderData?.is_fully_returned === 1
              })()}
              onClick={() => {
                // Wrap in try-catch to prevent errors from propagating to React error boundary
                try {
                  handleReturn()
                } catch (error) {
                  console.error('Error in handleReturn onClick:', error)
                  toast.error('Failed to open return modal. Please try again.')
                }
              }}
            >
              {typeof currentTab?.orderData?.return_count === 'number' && currentTab.orderData.return_count > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[12px] h-[12px] px-0.5 rounded-full bg-white text-orange-600 text-[8px] font-bold flex items-center justify-center shadow">
                  {currentTab.orderData.return_count}
                </span>
              )}
              <svg className="w-3 h-3" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="arrow-rotate-left" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor">
                <path d="M125.7 160H176c17.7 0 32 14.3 32 32s-14.3 32-32 32H48c-17.7 0-32-14.3-32-32V64c0-17.7 14.3-32 32-32s32 14.3 32 32v51.2L97.6 97.6c87.5-87.5 229.3-87.5 316.8 0s87.5 229.3 0 316.8s-229.3 87.5-316.8 0c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0c62.5 62.5 163.8 62.5 226.3 0s62.5-163.8 0-226.3s-163.8-62.5-226.3 0L125.7 160z"></path>
              </svg>
              Return
              <span className="text-[8px] opacity-80 bg-white/20 px-1 py-0 rounded ml-0.5">Ctrl+R</span>
            </Button>
          </div>
          <div className="text-sm font-semibold text-gray-700">
            {/* Order #: {currentTab?.orderId || 'New Order'} | Items: {cartItems.length} */}
          </div>
        </div>
      </div>

      {/* Payment / Confirm Dialog */}
      <Dialog open={!!open} onOpenChange={(v) => setOpen(v ? open || 'confirm' : false)}>
        <DialogContent
          className="max-w-5xl w-[95vw] bg-white border-2 shadow-2xl"
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            // Focus will be handled by useEffect
          }}
        >
          <DialogHeader className="pb-4">
            <DialogTitle className="text-xl font-bold text-gray-800">
              {open === 'pay' ? 'Payment' : 'Confirm'}
            </DialogTitle>
          </DialogHeader>
          {/* Date */}
          <div className="mb-6">
            <div className="text-sm font-medium text-gray-700 mb-2">Date</div>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="max-w-[220px] text-lg py-3"
            />
          </div>
          {/* Row: amounts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 rounded-lg bg-gray-50 border-2">
              <div className="text-sm font-medium text-gray-700 mb-2 truncate">Order Amount</div>
              <div className="text-lg font-semibold text-gray-900">{orderAmount}</div>
            </div>
            <div className="p-4 rounded-lg bg-gray-50 border-2">
              <div className="text-sm font-medium text-gray-700 mb-2 truncate">Amount Due</div>
              <div className="text-lg font-semibold text-gray-900">{amountDue}</div>
            </div>
            <div className="p-4 rounded-lg bg-gray-50 border-2">
              <div className="text-sm font-medium text-gray-700 mb-2 truncate">Total Pending</div>
              <div className="text-lg font-semibold text-gray-900">{totalPending}</div>
            </div>
          </div>


          {/* Payment Rows */}
          <div className="space-y-4 mb-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            <div className="text-sm font-medium text-gray-700">Payments</div>
            {payments.map((payment, index) => (
              <div key={payment.id} className="p-4 rounded-lg border-2 bg-gray-50 relative group">
                <div
                  className={`grid grid-cols-1 ${payment.mode === 'Cash' || (profile as any)?.custom_autogenerate_bank_references
                    ? 'md:grid-cols-[100px_1fr]'
                    : 'md:grid-cols-[100px_1.2fr_1.8fr_140px]'
                    } gap-3`}
                >
                  <div>
                    <div className="text-xs font-medium text-gray-500 mb-1">Mode</div>
                    <Select
                      value={payment.mode}
                      onValueChange={(val) => {
                        const newPayments = [...payments]
                        newPayments[index].mode = val
                        // Clear reference fields if switched to Cash
                        if (val === 'Cash') {
                          newPayments[index].reference_no = ''
                          newPayments[index].reference_date = ''
                        }
                        setPayments(newPayments)
                      }}
                    >
                      <SelectTrigger
                        ref={(el) => {
                          modeInputRefs.current[payment.id] = el
                        }}
                        className="w-full bg-white"
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowRight') {
                            amountInputRefs.current[payment.id]?.focus()
                            amountInputRefs.current[payment.id]?.select()
                          }
                        }}
                      >
                        <SelectValue placeholder="Select mode" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        {paymentModes.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-500 mb-1">Amount</div>
                    <Input
                      ref={(el) => {
                        amountInputRefs.current[payment.id] = el
                      }}
                      type="number"
                      value={payment.amount}
                      onChange={(e) => {
                        const newPayments = [...payments]
                        newPayments[index].amount = e.target.value
                        setPayments(newPayments)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          const nextPayment = payments[index + 1]
                          if (nextPayment) {
                            // Focus next payment mode
                            modeInputRefs.current[nextPayment.id]?.focus()
                          } else {
                            // Submit if it's the last row
                            handleConfirmPayClick()
                          }
                        } else if (e.key === 'ArrowLeft') {
                          modeInputRefs.current[payment.id]?.focus()
                        } else if (e.key === 'ArrowRight') {
                          if (payment.mode !== 'Cash' && !(profile as any)?.custom_autogenerate_bank_references) {
                            refNoInputRefs.current[payment.id]?.focus()
                            refNoInputRefs.current[payment.id]?.select()
                          }
                        }
                      }}
                      className="bg-white"
                      placeholder="0.00"
                    />
                  </div>
                  {payment.mode !== 'Cash' && !(profile as any)?.custom_autogenerate_bank_references && (
                    <>
                      <div>
                        <div className="text-xs font-medium text-gray-500 mb-1">
                          Ref No. <span className="text-red-500 font-bold">*</span>
                        </div>
                        <Input
                          ref={(el) => {
                            refNoInputRefs.current[payment.id] = el
                          }}
                          type="text"
                          value={payment.reference_no}
                          onChange={(e) => {
                            const newPayments = [...payments]
                            newPayments[index].reference_no = e.target.value
                            setPayments(newPayments)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'ArrowLeft') {
                              amountInputRefs.current[payment.id]?.focus()
                              amountInputRefs.current[payment.id]?.select()
                            } else if (e.key === 'ArrowRight') {
                              refDateInputRefs.current[payment.id]?.focus()
                            }
                          }}
                          className={`bg-white border-2 focus:border-blue-500 ${showValidationErrors && !payment.reference_no?.trim() ? 'border-red-500 ring-red-500 focus:border-red-500' : ''}`}
                          placeholder="Required"
                          required
                        />
                      </div>
                      <div>
                        <div className="text-xs font-medium text-gray-500 mb-1">
                          Ref Date <span className="text-red-500 font-bold">*</span>
                        </div>
                        <Input
                          ref={(el) => {
                            refDateInputRefs.current[payment.id] = el
                          }}
                          type="date"
                          value={payment.reference_date}
                          onChange={(e) => {
                            const newPayments = [...payments]
                            newPayments[index].reference_date = e.target.value
                            setPayments(newPayments)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'ArrowLeft') {
                              refNoInputRefs.current[payment.id]?.focus()
                              refNoInputRefs.current[payment.id]?.select()
                            }
                          }}
                          className={`bg-white border-2 focus:border-blue-500 ${showValidationErrors && !payment.reference_date ? 'border-red-500 ring-red-500 focus:border-red-500' : ''}`}
                          required
                        />
                      </div>
                    </>
                  )}
                </div>
                {payments.length > 1 && (
                  <button
                    onClick={() => {
                      setPayments(payments.filter((_, i) => i !== index))
                      delete amountInputRefs.current[payment.id]
                      delete amountInputRefs.current[payment.id]
                      delete modeInputRefs.current[payment.id]
                      delete refNoInputRefs.current[payment.id]
                      delete refDateInputRefs.current[payment.id]
                    }}
                    className="absolute -top-2 -right-2 p-1 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors shadow-sm"
                    title="Remove Payment"
                  >
                    <Trash className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPayments([
                  ...payments,
                  {
                    mode: 'Cash',
                    amount: '0',
                    reference_no: '',
                    reference_date: getCurrentDate(),
                    id: crypto.randomUUID()
                  }
                ])
              }}
              className="w-full border-dashed flex items-center gap-2 hover:bg-gray-50 focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              <PlusCircle className="w-4 h-4" />
              Add Payment
            </Button>
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
              data-confirm-button
              onClick={handleConfirmPayClick}
              disabled={isProcessingPayment}
              className={`px-8 py-3 text-lg font-semibold flex items-center gap-2 ${isProcessingPayment ? 'bg-gray-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'} text-white`}
            >
              {isProcessingPayment ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  {isConfirming ? 'Confirming...' : 'Processing...'}
                </div>
              ) : isConfirming ? (
                <>
                  <svg className="w-4 h-4" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="paper-plane" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor">
                    <path d="M498.1 5.6c10.1 7 15.4 19.1 13.5 31.2l-64 416c-1.5 9.7-7.4 18.2-16 23s-18.9 5.4-28 1.6L284 427.7l-68.5 74.1c-8.9 9.7-22.9 12.9-35.2 8.1S160 493.2 160 480V396.4c0-4 1.5-7.8 4.2-10.7L331.8 202.8c5.8-6.3 5.6-16-.4-22s-15.7-6.4-22-.7L106 360.8 17.7 316.6C7.1 311.3 .3 300.7 0 288.9s5.9-22.8 16.1-28.7l448-256c10.7-6.1 23.9-5.5 34 1.4z"></path>
                  </svg>
                  Confirm
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="credit-card" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" fill="currentColor">
                    <path d="M64 32C28.7 32 0 60.7 0 96v32H576V96c0-35.3-28.7-64-64-64H64zM576 224H0V416c0 35.3 28.7 64 64 64H512c35.3 0 64-28.7 64-64V224zM112 352h64c8.8 0 16 7.2 16 16s-7.2 16-16 16H112c-8.8 0-16-7.2-16-16s7.2-16 16-16zm112 16c0-8.8 7.2-16 16-16H368c8.8 0 16 7.2 16 16s-7.2 16-16 16H240c-8.8 0-16-7.2-16-16z"></path>
                  </svg>
                  Confirm and Pay
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false)
                setIsConfirming(false)
              }}
              className="px-8 py-3 text-lg font-semibold"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* <PaymentSubmissionModal
        open={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onPaymentSubmit={handlePaymentSubmit}
        grandTotal={currentTab?.invoiceData?.total}
        outstandingAmount={currentTab?.invoiceData?.outstandingAmount} 
      /> */}

      {/* Return Modal */}
      <ReturnModal
        isOpen={isReturnModalOpen}
        onClose={() => setIsReturnModalOpen(false)}
        onReturnSuccess={() => {
          onNavigateToPrints?.()
        }}
      />
    </>
  )
}

export default ActionButtons
