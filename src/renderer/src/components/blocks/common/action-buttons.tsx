import React, { useState, useEffect, useCallback } from 'react'
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
import ReturnModal from '../return/return-modal'
import { handleServerErrorMessages } from '@renderer/lib/error-handler'

type Props = {
  onNavigateToPrints?: () => void
  selectedPriceList?: string
  onSaveCompleted?: () => void
  isItemTableEditing?: boolean
  onInsufficientStockErrors?: (
    errors: Array<{ message: string; title: string; indicator: string; itemCode: string }>
  ) => void
  onFocusItem?: (itemCode: string) => void
}

// Helper function to format HTML content for display
const formatErrorMessage = (message: string): { mainMessage: string; details: string } => {
  // Remove HTML tags and format the content
  const cleanMessage = message
    .replace(/<br\s*\/?>/gi, '\n') // Convert <br> to newlines
    .replace(/<ul>/gi, '\n') // Convert <ul> to newline
    .replace(/<\/ul>/gi, '') // Remove </ul>
    .replace(/<li>/gi, '• ') // Convert <li> to bullet points
    .replace(/<\/li>/gi, '\n') // Convert </li> to newlines
    .replace(/<[^>]*>/g, '') // Remove any remaining HTML tags
    .replace(/\n\s*\n/g, '\n') // Remove multiple consecutive newlines
    .trim()

  // Split into main message and details
  const lines = cleanMessage.split('\n')
  const mainMessage = lines[0] || message
  const details = lines.slice(1).join('\n').trim()

  return { mainMessage, details }
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
                message: `Item: ${messageWithoutPrefix}`,
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
              message: `Item: ${messageWithoutPrefix}`,
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
              message: messageWithoutPrefix,
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
  selectedPriceList = 'Standard Selling',
  onSaveCompleted,
  isItemTableEditing = false,
  onInsufficientStockErrors
}) => {
  const [open, setOpen] = useState<false | 'confirm' | 'pay'>(false)
  const [orderAmount, setOrderAmount] = useState('0.00')
  const [amountDue, setAmountDue] = useState('0.00')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [mode, setMode] = useState('Cash')
  const [amount, setAmount] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false)
  const [paymentModes, setPaymentModes] = useState<string[]>(['Cash', 'Card', 'UPI', 'Bank'])

  // Get current tab data
  const {
    getCurrentTabItems,
    getCurrentTab,
    updateTabOrderId,
    setTabStatus,
    getCurrentTabCustomer,
    getCurrentTabGlobalDiscount,
    setTabEdited
  } = usePOSTabStore()
  const { currentUserPrivileges, profile } = usePOSProfileStore()
  const items = getCurrentTabItems()
  const currentTab = getCurrentTab()
  const globalDiscountPercent = getCurrentTabGlobalDiscount()
  // Load Amount Due from customer insights when dialog opens
  useEffect(() => {
    let cancelled = false
    const fetchAmountDue = async () => {
      try {
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
        if (!customerId) return
        const insightsRes = await window.electronAPI?.proxy?.request({
          url: '/api/method/centro_pos_apis.api.customer.customer_amount_insights',
          params: { customer_id: customerId }
        })
        const due = Number(insightsRes?.data?.data?.amount_due ?? 0)
        if (!cancelled) setAmountDue(due.toFixed(2))
      } catch (err) {
        console.error('Failed to load amount due:', err)
        if (!cancelled) setAmountDue('0.00')
      }
    }
    if (open) fetchAmountDue()
    return () => { cancelled = true }
  }, [open, currentTab?.customer?.customer_id, currentTab?.customer?.name])

  // Load POS profile data
  const loadPOSProfile = async () => {
    try {
      console.log('📋 Loading POS profile in ActionButtons...')
      const response = await window.electronAPI?.proxy?.request({
        url: '/api/method/centro_pos_apis.api.profile.get_pos_profile'
      })

      console.log('📋 POS profile API response in ActionButtons:', response)
      console.log('📋 Full response structure in ActionButtons:', JSON.stringify(response, null, 2))

      if (response?.data?.data) {
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
      }
    } catch (error) {
      console.error('📋 Error loading POS profile in ActionButtons:', error)
    }
  }

  // Load POS profile on component mount
  useEffect(() => {
    loadPOSProfile()
  }, [])

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
    return items
      .reduce((total, item) => {
        const quantity = parseFloat(item.quantity || '0') || 0
        const rate = parseFloat(item.standard_rate || '0') || 0
        const discount = parseFloat(item.discount_percentage || '0') || 0
        const itemTotal = quantity * rate
        const discountAmount = (itemTotal * discount) / 100
        return total + (itemTotal - discountAmount)
      }, 0)
      .toFixed(2)
  }, [items])

  // Update order amount when items change
  useEffect(() => {
    const total = calculateOrderTotal()
    setOrderAmount(total)
  }, [calculateOrderTotal])

  const totalPending = (() => {
    const a = parseFloat(orderAmount || '0') || 0
    const b = parseFloat(amountDue || '0') || 0
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
      } else if (selectedCustomer?.name && selectedCustomer.name !== 'Walking Customer') {
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

      // Use resolved customer_id or fallback to name or "Walking Customer"
      const finalCustomerId = customerId || selectedCustomer?.name || 'Walking Customer'
      console.log('🔍 Final customer ID for order:', finalCustomerId)

      // Map items for API - let backend handle calculations
      const mappedItems = items.map((item) => {
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
          uom: item.uom || 'Nos',
          rate,
          discount_percentage: discount,
          warehouse: item.warehouse || 'Stores - NAB'
        }
      })

      console.log('📊 UI Total (for reference):', orderAmount)
      console.log('📊 Items count:', items.length)
      console.log('📊 Global discount percentage:', globalDiscountPercent)

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

      // Prepare order data
      const orderData = {
        customer: finalCustomerId,
        posting_date: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD format
        selling_price_list: selectedPriceList,
        taxes_and_charges: 'VAT 15% - NAB', // Default tax, can be made configurable
        additional_discount_percentage: globalDiscountPercent, // Global discount from bottom section
        items: mappedItems,
        custom_stock_adjustment_sources: customStockAdjustmentSources
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

        response = await window.electronAPI?.proxy?.request({
          method: 'POST',
          url: '/api/method/centro_pos_apis.api.order.edit_order',
          data: editData
        })

        console.log('📝 Edit order response:', response)
        console.log('📝 Edit order response data:', JSON.stringify(response.data, null, 2))

        if (response?.success) {
          console.log('✅ Order updated successfully!')
          // Mark tab as not edited after successful save
          setTabEdited(currentTab.id, false)
          // Trigger save completed callback
          onSaveCompleted?.()
          // Navigate to prints tab
          onNavigateToPrints?.()
          toast.success(`Order updated successfully! Order ID: ${currentTab.orderId}`, {
            duration: 2000
          })
        } else {
          // Check for insufficient stock errors first
          if (response?.data?._server_messages) {
            try {
              const serverMessages = JSON.parse(response.data._server_messages)
              const stockErrors = parseInsufficientStockErrors(serverMessages)
              if (stockErrors.length > 0) {
                console.log('📝 Found insufficient stock errors:', stockErrors)
                onInsufficientStockErrors?.(stockErrors)
                // Don't show toast for stock errors, they'll be shown in the bottom error box
                return
              }
            } catch (parseError) {
              console.error('Error parsing server messages for stock errors:', parseError)
            }
          }

          // Handle other server error messages
          handleServerErrorMessages(response?.data?._server_messages, 'Failed to update order')
        }
      } else {
        // Create new order
        console.log('📦 Creating new order')

        response = await window.electronAPI?.proxy?.request({
          method: 'POST',
          url: '/api/method/centro_pos_apis.api.order.create_order',
          data: orderData
        })

        console.log('📦 Create order response:', response)
        console.log('📦 Response data structure:', JSON.stringify(response.data, null, 2))
        console.log('📦 Response keys:', Object.keys(response.data || {}))

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
            // Mark tab as not edited after successful save
            setTabEdited(currentTab.id, false)
            // Trigger save completed callback
            onSaveCompleted?.()
            // Navigate to prints tab
            onNavigateToPrints?.()
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
          // Check for insufficient stock errors first
          if (response?.data?._server_messages) {
            try {
              const serverMessages = JSON.parse(response.data._server_messages)
              const stockErrors = parseInsufficientStockErrors(serverMessages)
              if (stockErrors.length > 0) {
                console.log('📦 Found insufficient stock errors:', stockErrors)
                onInsufficientStockErrors?.(stockErrors)
                // Don't show toast for stock errors, they'll be shown in the bottom error box
                return
              }
            } catch (parseError) {
              console.error('Error parsing server messages for stock errors:', parseError)
            }
          }

          // Handle other server error messages
          handleServerErrorMessages(response?.data?._server_messages, 'Failed to create order')
        }
      }
    } catch (error) {
      console.error('❌ Error saving order:', error)

      // Check if this is a server message error that was already handled
      const errorMessage = (error as any)?.message || 'Please try again.'

      // If the error message contains validation errors or server messages,
      // it means the error was already handled by handleServerErrorMessages
      if (
        errorMessage.includes('Multiple validation errors') ||
        errorMessage.includes('Failed to update order') ||
        errorMessage.includes('Failed to create order') ||
        errorMessage.includes('Missing mandatory fields') ||
        errorMessage.includes('Invalid format or value for') ||
        errorMessage.includes('Buyer ID Type') ||
        errorMessage.includes('Pincode must be') ||
        errorMessage.includes('VAT Number') ||
        errorMessage.includes('Building Number') ||
        errorMessage.includes('customer_id_type_for_zatca') ||
        errorMessage.includes('tax_id') ||
        errorMessage.includes('building_number') ||
        errorMessage.includes('Validation Error') ||
        errorMessage.includes('exactly 5 digits') ||
        errorMessage.includes('exactly 15 digits') ||
        errorMessage.includes("must be 'CRN' or 'OTH'")
      ) {
        // Server messages were already handled, don't show generic error
        console.log('🔍 Server messages already handled, skipping generic error display')
        console.log('🔍 Error message that was handled:', errorMessage)
      } else {
        // Show generic error for other types of errors
        const isBackendError = errorMessage !== 'Please try again.'

        // Format the error message properly
        const { mainMessage, details } = formatErrorMessage(errorMessage)

        // Format the error message for better display
        const displayMessage = isBackendError
          ? `Backend Error: ${mainMessage}`
          : `Failed to save order: ${mainMessage}`

        toast.error(displayMessage, {
          duration: 8000, // Longer duration for backend errors
          description:
            details ||
            (isBackendError
              ? 'Please check the order details and try again.'
              : 'An unexpected error occurred. Please try again.')
        })
      }
    } finally {
      setIsSaving(false)
    }
  }

  // Order confirmation API function
  const handleOrderConfirmation = async (paymentAmount: number = 0) => {
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

    setIsProcessingPayment(true)
    try {
      console.log('🔄 ===== ORDER CONFIRMATION API CALL START =====')
      console.log('🔄 API Endpoint: /api/method/centro_pos_apis.api.order.order_confirmation')
      console.log('🔄 Payment Amount:', paymentAmount)
      console.log('🔄 Payment Mode:', mode)
      console.log('🔄 Order ID:', currentTab.orderId)
      console.log('🔄 POS Profile:', profile.name)

      const confirmationData = {
        sales_order_id: currentTab.orderId,
        pos_profile: profile.name,
        payments: [
          {
            mode_of_payment: mode,
            amount: paymentAmount
          }
        ]
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
      console.log('✅ Payment Amount:', paymentAmount)
      console.log('✅ Payment Mode:', mode)
        console.log('✅ Order ID:', currentTab.orderId)

        // Update tab status based on payment amount
        const newStatus = paymentAmount > 0 ? 'paid' : 'confirmed'
        console.log('✅ Setting tab status to:', newStatus)
        setTabStatus(currentTab.id, newStatus)

        const action = paymentAmount > 0 ? 'paid' : 'confirmed'
        console.log('✅ Showing success toast for action:', action)
        toast.success(`Order ${action} successfully! Order ID: ${currentTab.orderId}`, {
          duration: 2000
        })

        console.log('✅ Closing dialog and resetting form')
        // Close the dialog
        setOpen(false)
        console.log('✅ ===== ORDER CONFIRMATION SUCCESS END =====')
      } else {
        console.log('❌ ===== ORDER CONFIRMATION FAILED =====')
        console.log('❌ API call failed - response.success is false')
        console.log('❌ Response:', response)

        // Handle server error messages
        handleServerErrorMessages(response?.data?._server_messages, 'Failed to confirm order')
        return
      }
    } catch (error) {
      console.log('❌ ===== ORDER CONFIRMATION CATCH ERROR =====')
      console.error('❌ Error confirming order:', error)
      console.error('❌ Error message:', (error as any)?.message)
      console.error('❌ Error stack:', (error as any)?.stack)
      console.log('❌ ===== ORDER CONFIRMATION CATCH ERROR END =====')

      // Check if this is a server message error that was already handled
      const errorMessage = (error as any)?.message || 'Please try again.'

      // If the error message contains validation errors or server messages,
      // it means the error was already handled by handleServerErrorMessages
      if (
        errorMessage.includes('Multiple validation errors') ||
        errorMessage.includes('Failed to confirm order') ||
        errorMessage.includes('Missing mandatory fields') ||
        errorMessage.includes('Invalid format or value for') ||
        errorMessage.includes('Buyer ID Type') ||
        errorMessage.includes('Pincode must be') ||
        errorMessage.includes('VAT Number') ||
        errorMessage.includes('Building Number') ||
        errorMessage.includes('customer_id_type_for_zatca') ||
        errorMessage.includes('tax_id') ||
        errorMessage.includes('building_number') ||
        errorMessage.includes('Validation Error') ||
        errorMessage.includes('exactly 5 digits') ||
        errorMessage.includes('exactly 15 digits') ||
        errorMessage.includes("must be 'CRN' or 'OTH'")
      ) {
        // Server messages were already handled, don't show generic error
        console.log('🔍 Server messages already handled, skipping generic error display')
        console.log('🔍 Error message that was handled:', errorMessage)
      } else {
        // Show generic error for other types of errors
        const isBackendError = errorMessage !== 'Please try again.'

        // Format the error message properly
        const { mainMessage, details } = formatErrorMessage(errorMessage)

        // Format the error message for better display
        const displayMessage = isBackendError
          ? `Backend Error: ${mainMessage}`
          : `Failed to confirm order: ${mainMessage}`

        toast.error(displayMessage, {
          duration: 8000, // Longer duration for backend errors
          description:
            details ||
            (isBackendError
              ? 'Please check the order details and try again.'
              : 'An unexpected error occurred. Please try again.')
        })
      }
    } finally {
      console.log('🔄 Setting isProcessingPayment to false')
      setIsProcessingPayment(false)

      // After confirming, fetch order details to check docstatus and lock tab if submitted
      try {
        const latestOrderId = currentTab?.orderId
        if (latestOrderId) {
          const res = await window.electronAPI?.proxy?.request({
            url: `/api/resource/Sales Order/${latestOrderId}`,
            method: 'GET'
          })
          const doc = res?.data?.data
          if (doc && Number(doc.docstatus) === 1 && currentTab?.id) {
            setTabStatus(currentTab.id, 'confirmed')
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
    setAmount('0') // Set amount to 0 for confirm mode
    setIsConfirming(true) // Set confirming state
    setOpen('confirm')
  }, [currentTab])

  const handlePay = useCallback(() => {
    if (!currentTab) return
    console.log('💳 Pay button clicked - opening payment dialog')
    setAmount('') // Clear amount for pay mode
    setIsConfirming(false) // Reset confirming state
    setOpen('pay')
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
            {currentUserPrivileges?.sales && currentTab?.status !== 'confirmed' && currentTab?.status !== 'paid' && (
              <Button
                data-testid="save-button"
                className="px-2 py-2 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white font-medium rounded-xl hover:shadow-2xl transition-all duration-300 flex items-center gap-3  text-xs"
                disabled={!currentTab?.isEdited || isSaving || isItemTableEditing}
                onClick={handleSave}
              >
                {isSaving ? (
                  <>
                    <i className="fas fa-spinner fa-spin text-lg"></i>
                    {currentTab?.orderId ? 'Updating Order...' : 'Creating Order...'}
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="floppy-disk" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor">
                      <path d="M64 32C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64H384c35.3 0 64-28.7 64-64V173.3c0-17-6.7-33.3-18.7-45.3L352 18.7C340 6.7 323.7 0 306.7 0H64zm0 96H384V416H64V128zM224 288a64 64 0 1 1 0 128 64 64 0 1 1 0-128z"></path>
                    </svg>
                    {currentTab?.orderId ? 'Update Order' : 'Save Order'}{' '}
                    <span className="text-xs opacity-80 bg-white/20 px-2 py-1 rounded-lg">
                      Ctrl+S
                    </span>
                  </>
                )}
              </Button>
            )}

            {/* Confirm and Pay Buttons - Show if user has billing privilege */}
            {currentUserPrivileges?.billing && currentTab?.status !== 'confirmed' && currentTab?.status !== 'paid' && (
              <Button
                className="px-2 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-medium rounded-xl hover:shadow-2xl transition-all duration-300 flex items-center gap-3  text-xs"
                disabled={isItemTableEditing}
                onClick={handleConfirm}
              >
                <svg className="w-4 h-4" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="paper-plane" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor">
                  <path d="M498.1 5.6c10.1 7 15.4 19.1 13.5 31.2l-64 416c-1.5 9.7-7.4 18.2-16 23s-18.9 5.4-28 1.6L284 427.7l-68.5 74.1c-8.9 9.7-22.9 12.9-35.2 8.1S160 493.2 160 480V396.4c0-4 1.5-7.8 4.2-10.7L331.8 202.8c5.8-6.3 5.6-16-.4-22s-15.7-6.4-22-.7L106 360.8 17.7 316.6C7.1 311.3 .3 300.7 0 288.9s5.9-22.8 16.1-28.7l448-256c10.7-6.1 23.9-5.5 34 1.4z"></path>
                </svg>
                Confirm{' '}
                <span className="text-xs opacity-80 bg-white/20 px-2 py-1 rounded-lg">Ctrl+Shift+S</span>
              </Button>
            )}
            {currentUserPrivileges?.billing && (
              <Button
                className="px-2 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-xl hover:shadow-2xl transition-all duration-300 flex items-center gap-3  text-xs"
                disabled={isItemTableEditing}
                onClick={handlePay}
              >
                <svg className="w-4 h-4" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="credit-card" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" fill="currentColor">
                  <path d="M64 32C28.7 32 0 60.7 0 96v32H576V96c0-35.3-28.7-64-64-64H64zM576 224H0V416c0 35.3 28.7 64 64 64H512c35.3 0 64-28.7 64-64V224zM112 352h64c8.8 0 16 7.2 16 16s-7.2 16-16 16H112c-8.8 0-16-7.2-16-16s7.2-16 16-16zm112 16c0-8.8 7.2-16 16-16H368c8.8 0 16 7.2 16 16s-7.2 16-16 16H240c-8.8 0-16-7.2-16-16z"></path>
                </svg>
                Pay{' '}
                <span className="text-xs opacity-80 bg-white/20 px-2 py-1 rounded-lg">Ctrl+Shift+F</span>
              </Button>
            )}

            {/* Return Button - Show if user has return privilege */}
            {currentUserPrivileges?.return && (
              <Button
                data-testid="return-button"
                className="px-2 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-medium rounded-xl hover:shadow-2xl transition-all duration-300 flex items-center gap-3  text-xs"
                onClick={handleReturn}
              >
                <svg className="w-4 h-4" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="arrow-rotate-left" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor">
                  <path d="M125.7 160H176c17.7 0 32 14.3 32 32s-14.3 32-32 32H48c-17.7 0-32-14.3-32-32V64c0-17.7 14.3-32 32-32s32 14.3 32 32v51.2L97.6 97.6c87.5-87.5 229.3-87.5 316.8 0s87.5 229.3 0 316.8s-229.3 87.5-316.8 0c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0c62.5 62.5 163.8 62.5 226.3 0s62.5-163.8 0-226.3s-163.8-62.5-226.3 0L125.7 160z"></path>
                </svg>
                Return{' '}
                <span className="text-xs opacity-80 bg-white/20 px-2 py-1 rounded-lg">Ctrl+R</span>
              </Button>
            )}
          </div>
          <div className="text-sm font-semibold text-gray-700">
            {/* Order #: {currentTab?.orderId || 'New Order'} | Items: {cartItems.length} */}
          </div>
        </div>
      </div>

      {/* Payment / Confirm Dialog */}
      <Dialog open={!!open} onOpenChange={(v) => setOpen(v ? open || 'confirm' : false)}>
        <DialogContent className="max-w-4xl w-[90vw] bg-white border-2 shadow-2xl">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-xl font-bold text-gray-800">
              {open === 'pay' ? 'Payment' : 'Confirm'}
            </DialogTitle>
          </DialogHeader>

          {/* Row: amounts */}
          <div className="grid grid-cols-3 gap-4 mb-6">
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

          {/* Date, Mode, Amount */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">Date</div>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="text-lg py-3"
              />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">Payment Mode</div>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger className="w-full text-base py-2.5">
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200 shadow-lg">
                  {paymentModes.map((mode) => (
                    <SelectItem key={mode} value={mode}>
                      {mode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">Amount</div>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                readOnly={isConfirming}
                className={`text-lg py-3 ${isConfirming ? 'bg-gray-100' : ''}`}
              />
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
              onClick={async () => {
                console.log('💳 Confirm/Pay clicked in dialog')

                // Get payment amount from dialog
                const paymentAmount = parseFloat(amount) || 0

                // Call order confirmation API with payment amount from dialog
                await handleOrderConfirmation(paymentAmount)

                // Reset form and close dialogs
                setOpen(false)
                setAmount('')
                setMode('Cash')
                setDate(new Date().toISOString().slice(0, 10))
                setIsConfirming(false)
              }}
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
          // Optionally refresh data or show success message
          toast.success('Return order processed successfully!', { duration: 2000 })
        }}
      />
    </>
  )
}

export default ActionButtons
