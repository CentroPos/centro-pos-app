import React, { useMemo, useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'

import { Button } from '@renderer/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@renderer/components/ui/select'
import { usePOSProfileStore } from '@renderer/store/usePOSProfileStore'
import { usePurchaseTabStore } from '@renderer/store/usePurchaseTabStore'
import { handleServerErrorMessages } from '@renderer/lib/error-handler'
import PurchaseReturnModal from './purchase-return-modal'

const paymentModes = ['Cash', 'Bank'] as const
type PaymentMode = (typeof paymentModes)[number]

type PurchaseActionButtonsProps = {
  isItemTableEditing?: boolean
}

const PurchaseActionButtons: React.FC<PurchaseActionButtonsProps> = ({ isItemTableEditing }) => {
  const { profile, currentUserPrivileges } = usePOSProfileStore()
  const {
    activeTabId,
    getCurrentTab,
    getCurrentTabItems,
    updateTabPurchaseOrderId,
    setTabEdited,
    updateTabOrderData,
    getCurrentTabGlobalDiscount,
    getCurrentTabRoundingEnabled,
    getCurrentTabPostingDate,
    getCurrentTabSupplier
  } = usePurchaseTabStore()

  const currentTab = getCurrentTab()
  const items = getCurrentTabItems()
  const globalDiscountPercent = getCurrentTabGlobalDiscount()
  const isRoundingEnabled = getCurrentTabRoundingEnabled()

  const [isSaving, setIsSaving] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [returnModalOpen, setReturnModalOpen] = useState(false)
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('Cash')
  const [amount, setAmount] = useState<string>('')
  const [date, setDate] = useState<string>('')
  const [orderAmount, setOrderAmount] = useState<string>('0.00')
  const [amountDue, setAmountDue] = useState<string>('0.00')
  const amountInputRef = React.useRef<HTMLInputElement>(null)

  const buyingPriceList = currentTab?.buying_price_list || profile?.buying_price_list || 'Standard Buying'
  const transactionDate = currentTab?.posting_date || new Date().toISOString().slice(0, 10)
  
  // Get current date helper
  const getCurrentDate = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Calculate order total (similar to sales)
  const calculateOrderTotal = useCallback(() => {
    const normalize = (value: any) => {
      const num = Number(value)
      return Number.isFinite(num) ? Number(num.toFixed(2)) : null
    }

    const hasSavedOrder = Boolean(currentTab?.purchaseOrderId)
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
        console.log('📋 Using outstanding_amount for confirmed purchase order:', outstandingAmount)
        return outstandingAmount.toFixed(2)
      }
    }

    // For draft orders, use calculated total
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
    if (hasSavedOrder && serverTotal !== null && !isEdited) {
      console.log('📋 Using server-provided rounded total for purchase:', serverTotal)
      return serverTotal.toFixed(2)
    }

    // Calculate from items (similar to discount section)
    const untaxedSum = items.reduce((sum: number, it: any) => {
      const qty = Number(it.quantity || 0)
      const rate = Number(it.standard_rate || 0)
      return sum + qty * rate
    }, 0)

    const individualDiscountSum = items.reduce((sum: number, it: any) => {
      const qty = Number(it.quantity || 0)
      const rate = Number(it.standard_rate || 0)
      const disc = Number(it.discount_percentage || 0)
      return sum + (qty * rate * disc) / 100
    }, 0)

    const netAfterIndividualDiscount = untaxedSum - individualDiscountSum
    const globalDiscountAmount = (netAfterIndividualDiscount * globalDiscountPercent) / 100
    const netAfterGlobalDiscount = netAfterIndividualDiscount - globalDiscountAmount
    
    // Get VAT percentage from profile
    const vatPercentage = Number(profile?.custom_purchase_tax_rate || profile?.custom_tax_rate || 15)
    const vatCalc = netAfterGlobalDiscount * (vatPercentage / 100)
    const totalRaw = netAfterGlobalDiscount + vatCalc
    
    // Rounding logic
    const roundToNearest = (value: number, step = 0.05) => {
      const rounded = Math.round(value / step) * step
      return Number(rounded.toFixed(2))
    }
    const totalRoundedCandidate = roundToNearest(totalRaw, 0.05)
    const useRounding = isRoundingEnabled
    const totalFinal = useRounding ? totalRoundedCandidate : Number(totalRaw.toFixed(2))

    return totalFinal.toFixed(2)
  }, [
    items,
    globalDiscountPercent,
    isRoundingEnabled,
    currentTab?.orderData,
    currentTab?.purchaseOrderId,
    currentTab?.isEdited,
    profile
  ])

  // Update order amount when items, discount, or VAT changes
  useEffect(() => {
    const total = calculateOrderTotal()
    setOrderAmount(total)
  }, [calculateOrderTotal])

  // Calculate total pending
  const totalPending = (() => {
    const a = parseFloat(orderAmount || '0') || 0
    const b = parseFloat(amountDue || '0') || 0
    return (a + b).toFixed(2)
  })()

  // Calculate payment status
  const getPaymentStatus = () => {
    const enteredAmount = parseFloat(amount || '0') || 0
    const orderAmt = parseFloat(orderAmount || '0') || 0

    if (enteredAmount === 0) {
      return { text: 'Credit Purchase', color: 'bg-orange-100 text-orange-800' }
    } else if (enteredAmount >= orderAmt) {
      return { text: 'Fully Paid', color: 'bg-green-100 text-green-800' }
    } else {
      return { text: 'Partially Paid', color: 'bg-yellow-100 text-yellow-800' }
    }
  }

  const paymentStatus = getPaymentStatus()

  // Load Amount Due from supplier (for purchase, we'll use 0.00 for now or fetch from supplier insights if available)
  useEffect(() => {
    if (!confirmOpen && !payOpen) return
    
    let cancelled = false
    const fetchAmountDue = async () => {
      try {
        // For purchase, amount due would be from supplier's outstanding invoices
        // For now, set to 0.00 (can be enhanced later with supplier insights API)
        const supplier = getCurrentTabSupplier()
        if (!supplier?.supplier_id) {
          if (!cancelled) setAmountDue('0.00')
          return
        }

        // TODO: If supplier insights API exists, fetch from there
        // For now, use 0.00
        if (!cancelled) setAmountDue('0.00')
      } catch (err) {
        console.error('Failed to load amount due:', err)
        if (!cancelled) setAmountDue('0.00')
      }
    }
    fetchAmountDue()
    return () => { cancelled = true }
  }, [confirmOpen, payOpen, getCurrentTabSupplier])

  // Initialize date when modal opens
  useEffect(() => {
    if (confirmOpen || payOpen) {
      setDate(transactionDate || getCurrentDate())
    }
  }, [confirmOpen, payOpen, transactionDate, getCurrentDate])

  // Define handleConfirmPayClick with useCallback before useEffect that uses it
  const handleConfirmPayClick = useCallback(async () => {
    if (!currentTab?.purchaseOrderId) {
      toast.error('Purchase order ID not found')
      return
    }
    
    const paidAmount = Number(amount || 0)
    
    // For confirm mode, allow 0 amount (credit purchase)
    // For pay mode, require amount > 0
    if (!isConfirming && (!Number.isFinite(paidAmount) || paidAmount <= 0)) {
      toast.error('Please enter a valid paid amount')
      return
    }

    if (isConfirming) {
      setIsConfirming(true)
    } else {
      setIsProcessingPayment(true)
    }

    try {
      let confirmResponse: any = null
      
      // Only confirm if in confirm mode (not pay mode)
      if (isConfirming) {
        // First confirm the purchase order - ONLY send these 3 fields as per API requirement
        console.log('📦 ===== CONFIRM PURCHASE ORDER API CALL =====')
        console.log('📦 API URL: /api/method/centro_pos_apis.api.purchase.purchase_order_confirmation')
        console.log('📦 Request Method: POST')
        
        const confirmPayload = {
          purchase_order_id: currentTab.purchaseOrderId,
          mode_of_payment: paymentMode,
          paid_amount: paidAmount
        }
        
        console.log('📦 Request Body (ONLY 3 fields):', JSON.stringify(confirmPayload, null, 2))
        console.log('📦 Purchase Order ID:', confirmPayload.purchase_order_id)
        console.log('📦 Payment Mode:', confirmPayload.mode_of_payment)
        console.log('📦 Paid Amount:', confirmPayload.paid_amount)
        
        confirmResponse = await window.electronAPI?.proxy?.request({
          url: '/api/method/centro_pos_apis.api.purchase.purchase_order_confirmation',
          method: 'POST',
          data: confirmPayload
        })
        
        console.log('📦 ===== CONFIRM PURCHASE ORDER API RESPONSE =====')
        console.log('📦 Full Response:', confirmResponse)
        console.log('📦 Response Success:', confirmResponse?.success)
        console.log('📦 Response Status:', confirmResponse?.status)
        console.log('📦 Response Data:', JSON.stringify(confirmResponse?.data, null, 2))
        
        // Check if confirmation was successful
        if (confirmResponse?.success === false || confirmResponse?.status === 400) {
          console.error('❌ Purchase order confirmation failed')
          if (confirmResponse?.data?._server_messages) {
            handleServerErrorMessages(confirmResponse.data._server_messages, '')
          } else {
            toast.error(confirmResponse?.data?.message || confirmResponse?.message || 'Failed to confirm purchase order')
          }
          setIsConfirming(false)
          setIsProcessingPayment(false)
          return
        }
      }

      // Get supplier ID for payment entry
      const selectedSupplier = getCurrentTabSupplier()
      let supplierId = selectedSupplier?.supplier_id || currentTab?.supplier?.supplier_id || null

      // If supplier ID not found, try to get from order data
      if (!supplierId && currentTab?.orderData?.supplier) {
        supplierId = currentTab.orderData.supplier
      }

      if (!supplierId) {
        console.error('❌ No supplier ID found for payment entry')
        toast.error('Supplier ID not found. Payment entry not created.')
      } else {
        // Get posting date from store or use current date
        const selectedPostingDate = getCurrentTabPostingDate()
        const formattedDate = selectedPostingDate || transactionDate || getCurrentDate()

        // Get purchase invoice number from order data (if available after confirmation or from existing order)
        // If no invoice, reference the Purchase Order itself
        const purchaseInvoice = currentTab?.orderData?.purchase_invoice_no || 
                               confirmResponse?.data?.data?.purchase_invoice_no ||
                               null
        const purchaseOrderId = currentTab.purchaseOrderId

        // For pay mode, try to get invoice from linked invoices if available
        const linkedInvoices = currentTab?.orderData?.linked_invoices
        let purchaseInvoiceFromLinked = null
        if (linkedInvoices && !purchaseInvoice) {
          if (Array.isArray(linkedInvoices) && linkedInvoices.length > 0) {
            purchaseInvoiceFromLinked = linkedInvoices[0]?.purchase_invoice_no || linkedInvoices[0]?.name
          } else if (typeof linkedInvoices === 'object') {
            purchaseInvoiceFromLinked = (linkedInvoices as any)?.purchase_invoice_no || (linkedInvoices as any)?.name
          }
        }

        const finalPurchaseInvoice = purchaseInvoice || purchaseInvoiceFromLinked

        // Create payment entry using the same endpoint as sales
        const paymentEntryData = {
          payment_type: 'Pay', // Pay for purchase (opposite of Receive for sales)
          party_type: 'Supplier', // Supplier for purchase (opposite of Customer for sales)
          party: supplierId,
          posting_date: formattedDate,
          paid_amount: paidAmount,
          mode_of_payment: paymentMode,
          references: finalPurchaseInvoice ? [
            {
              reference_doctype: 'Purchase Invoice',
              reference_name: finalPurchaseInvoice,
              allocated_amount: paidAmount
            }
          ] : purchaseOrderId ? [
            {
              reference_doctype: 'Purchase Order',
              reference_name: purchaseOrderId,
              allocated_amount: paidAmount
            }
          ] : []
        }

        console.log('💳 ===== CREATE PAYMENT ENTRY API CALL (PURCHASE) =====')
        console.log('💳 API URL: /api/method/centro_pos_apis.api.order.create_payment_entry')
        console.log('💳 Request Method: POST')
        console.log('💳 Request Body:', JSON.stringify(paymentEntryData, null, 2))

        await window.electronAPI?.proxy?.request({
          method: 'POST',
          url: '/api/method/centro_pos_apis.api.order.create_payment_entry',
          data: paymentEntryData
        })

        console.log('💳 Payment entry created successfully for purchase order')
      }

      // Refresh order data FIRST to update status and enable Pay/Return buttons
      if (activeTabId && currentTab.purchaseOrderId) {
        try {
          console.log('🔄 Refreshing purchase order data after confirm/payment...')
          const res = await window.electronAPI?.proxy?.request({
            url: '/api/method/centro_pos_apis.api.purchase.get_purchase_order_details',
            params: {
              purchase_order_id: currentTab.purchaseOrderId
            }
          })
          if (res?.data?.data) {
            console.log('✅ Purchase order data refreshed:', res.data.data)
            updateTabOrderData(activeTabId, res.data.data)
            const newDocstatus = Number(res.data.data?.docstatus)
            console.log('📋 Order status after refresh - docstatus:', newDocstatus, 'isConfirmed:', newDocstatus === 1)
            
            // Force a small delay to ensure state updates propagate
            await new Promise(resolve => setTimeout(resolve, 100))
          }
        } catch (refreshError) {
          console.error('❌ Failed to refresh purchase order data:', refreshError)
        }
      }

      if (isConfirming) {
        toast.success('Purchase Order confirmed and payment recorded')
        setConfirmOpen(false)
        setIsConfirming(false)
      } else {
        toast.success('Payment recorded successfully')
        setPayOpen(false)
        setIsProcessingPayment(false)
      }
      setAmount('')
    } catch (e: any) {
      console.error('❌ Purchase confirm/payment failed', e)
      toast.error(e?.response?.data?.message || e?.message || `Failed to ${isConfirming ? 'confirm' : 'process payment for'} purchase order`)
    } finally {
      setIsConfirming(false)
      setIsProcessingPayment(false)
    }
  }, [currentTab, amount, paymentMode, isConfirming, activeTabId, transactionDate, getCurrentTabSupplier, getCurrentTabPostingDate, updateTabOrderData, setConfirmOpen, setPayOpen, setAmount, setIsConfirming, setIsProcessingPayment])

  // Auto-focus Amount input when dialog opens
  useEffect(() => {
    if (confirmOpen || payOpen) {
      const focusAmount = () => {
        if (amountInputRef.current) {
          amountInputRef.current.focus()
          if (document.activeElement !== amountInputRef.current) {
            amountInputRef.current.focus()
          }
        }
      }
      const timer1 = setTimeout(() => focusAmount(), 100)
      const timer2 = setTimeout(() => focusAmount(), 250)
      return () => {
        clearTimeout(timer1)
        clearTimeout(timer2)
      }
    }
    return undefined
  }, [confirmOpen, payOpen])

  // Keyboard shortcuts for Confirm/Pay modal
  useEffect(() => {
    if (!confirmOpen && !payOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
      
      // Shift+Enter: Trigger Confirm button
      if (e.key === 'Enter' && e.shiftKey) {
        // Allow Shift+Enter even in input fields (common pattern for submitting forms)
        if (!isConfirming && !isProcessingPayment) {
          e.preventDefault()
          e.stopPropagation()
          console.log('⌨️ Shift+Enter pressed - triggering Confirm/Pay')
          handleConfirmPayClick()
        }
      }
      // Spacebar: Cycle payment modes (only if not in input field)
      else if (e.key === ' ' && !isInputField) {
        e.preventDefault()
        e.stopPropagation()
        
        // Cycle through payment modes
        const currentIndex = paymentModes.indexOf(paymentMode)
        const nextIndex = (currentIndex + 1) % paymentModes.length
        const nextMode = paymentModes[nextIndex]
        
        console.log('⌨️ Spacebar pressed - cycling payment mode from', paymentMode, 'to', nextMode)
        setPaymentMode(nextMode)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [confirmOpen, payOpen, paymentMode, paymentModes, isConfirming, isProcessingPayment, handleConfirmPayClick])

  // Keyboard shortcuts for buttons
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey) {
        const key = e.key.toLowerCase()
        if (key === 's') {
          e.preventDefault()
          handleConfirm()
        } else if (key === 'f') {
          e.preventDefault()
          handlePay()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [currentTab?.purchaseOrderId])

  const handleSave = async () => {
    if (!currentTab || isSaving) return

    if (!currentTab?.supplier?.supplier_id) {
      toast.error('Please select a supplier before saving')
      return
    }
    if (items.length === 0) {
      toast.error('Please add at least one item')
      return
    }

    setIsSaving(true)
    try {
      const mappedItems = items.map((it) => ({
        item_code: it.item_code,
        qty: Number(it.quantity || 0),
        uom: it.uom,
        rate: Number(it.standard_rate || 0),
        discount_percentage: Number(it.discount_percentage || 0)
      }))

      // Get posting date from store or use transaction date
      const selectedPostingDate = getCurrentTabPostingDate()
      const postingDate = selectedPostingDate || transactionDate || getCurrentDate()
      
      // If rounding is enabled, disable_rounded_total = 0, else 1
      const disable_rounded_total = isRoundingEnabled ? 0 : 1

      // Use purchase-specific buying price list from profile if available
      const finalBuyingPriceList = profile?.custom_buying_price_list || buyingPriceList

      const payload: any = {
        supplier: currentTab.supplier.supplier_id,
        transaction_date: postingDate,
        schedule_date: '', // Empty as per user's example
        buying_price_list: finalBuyingPriceList,
        internal_note: currentTab.internal_note || '',
        disable_rounded_total: disable_rounded_total,
        additional_discount_percentage: globalDiscountPercent,
        items: mappedItems
      }

      // Use purchase-specific tax template from profile
      // Profile has: custom_purchase_taxes_and_charges = "VAT 15 % Purchase - NAB"
      if (profile?.custom_purchase_taxes_and_charges && profile.custom_purchase_taxes_and_charges.trim()) {
        payload.taxes_and_charges = profile.custom_purchase_taxes_and_charges.trim()
        console.log('📦 Using Purchase Tax Template from Profile:', payload.taxes_and_charges)
      } else {
        console.warn('⚠️ No custom_purchase_taxes_and_charges in profile, using fallback')
        // Fallback to the exact format from the API example
        payload.taxes_and_charges = 'VAT 15 % Purchase - NAB'
      }
      
      console.log('📦 Final Purchase Tax Template:', payload.taxes_and_charges)
      console.log('📦 Buying Price List:', finalBuyingPriceList)

      // Add other details if present
      if (currentTab.po_no) {
        payload.po_no = currentTab.po_no
      }
      if (currentTab.po_date) {
        payload.po_date = currentTab.po_date
      }

      let response: any

      // Check if this is an existing order (has purchaseOrderId) or new order
      if (currentTab.purchaseOrderId) {
        // Edit existing purchase order
        console.log('📝 Editing existing purchase order:', currentTab.purchaseOrderId)

        const editData = {
          purchase_order_id: currentTab.purchaseOrderId,
          ...payload
        }

        response = await window.electronAPI?.proxy?.request({
          method: 'POST',
          url: '/api/method/centro_pos_apis.api.purchase.edit_purchase_order',
          data: editData
        })
      } else {
        // Create new purchase order
        console.log('📦 ===== CREATING NEW PURCHASE ORDER =====')
        console.log('📦 API URL: /api/method/centro_pos_apis.api.purchase.create_purchase_order')
        console.log('📦 Request Method: POST')
        console.log('📦 Request Payload:', JSON.stringify(payload, null, 2))
        console.log('📦 Full Payload Object:', payload)

        response = await window.electronAPI?.proxy?.request({
          url: '/api/method/centro_pos_apis.api.purchase.create_purchase_order',
          method: 'POST',
          data: payload
        })

        console.log('📦 ===== PURCHASE ORDER CREATE RESPONSE =====')
        console.log('📦 Full Response Object:', response)
        console.log('📦 Response Type:', typeof response)
        console.log('📦 Response Keys:', response ? Object.keys(response) : 'null')
        console.log('📦 Response.data:', response?.data)
        console.log('📦 Response.data Type:', typeof response?.data)
        console.log('📦 Response.data Keys:', response?.data ? Object.keys(response?.data) : 'null')
        console.log('📦 Response.data.data:', response?.data?.data)
        console.log('📦 Response.data.data Type:', typeof response?.data?.data)
        console.log('📦 Response.data.data Keys:', response?.data?.data ? Object.keys(response?.data?.data) : 'null')
        console.log('📦 Response Stringified:', JSON.stringify(response, null, 2))
      }

      console.log('📦 ===== PURCHASE ORDER API RESPONSE =====')
      console.log('📦 Full Response:', response)
      console.log('📦 Response Success:', response?.success)
      console.log('📦 Response Status:', response?.status)
      console.log('📦 Response Data:', JSON.stringify(response?.data, null, 2))
      console.log('📦 Response Keys:', response ? Object.keys(response) : [])
      console.log('📦 Response.data Keys:', response?.data ? Object.keys(response?.data) : [])
      console.log('📦 Response.data.data Keys:', response?.data?.data ? Object.keys(response?.data?.data) : [])
      console.log('📦 ===== END PURCHASE ORDER API RESPONSE =====')

      // Check if response indicates success (explicitly check for true or undefined/not false)
      // Only proceed with ID extraction if success is true or not explicitly false
      const isSuccess = response?.success === true || (response?.success !== false && response?.status !== 400)
      
      if (!isSuccess) {
        // Handle error response
        console.error('❌ Purchase order save failed - response indicates failure')
        console.error('❌ Response Success:', response?.success)
        console.error('❌ Response Status:', response?.status)
        console.error('❌ Full Response:', JSON.stringify(response, null, 2))
        
        // Handle server error messages
        if (response?.data?._server_messages) {
          handleServerErrorMessages(response.data._server_messages, '')
        } else {
          toast.error(response?.data?.message || response?.message || 'Failed to save purchase order')
        }
        return
      }

      // Handle response structure - check multiple possible locations (same pattern as sales)
      // Response can be: { data: { data: { purchase_order_id: "..." } } }
      // Or: { data: { purchase_order_id: "..." } }
      const purchaseOrderId =
        response?.data?.data?.purchase_order_id ||
        response?.data?.data?.name ||
        response?.data?.data?.purchase_order ||
        response?.data?.purchase_order_id ||
        response?.data?.name ||
        response?.data?.purchase_order ||
        null

      console.log('🔍 ===== EXTRACTING PURCHASE ORDER ID =====')
      console.log('🔍 Checking response.data.data.purchase_order_id:', response?.data?.data?.purchase_order_id)
      console.log('🔍 Checking response.data.data.name:', response?.data?.data?.name)
      console.log('🔍 Checking response.data.purchase_order_id:', response?.data?.purchase_order_id)
      console.log('🔍 Checking response.data.name:', response?.data?.name)
      console.log('🔍 Extracted Purchase Order ID:', purchaseOrderId)
      console.log('🔍 ID Type:', typeof purchaseOrderId)
      console.log('🔍 ID Truthy Check:', !!purchaseOrderId)

      if (purchaseOrderId) {
        console.log('✅ ===== PURCHASE ORDER ID SUCCESSFULLY EXTRACTED =====')
        console.log('✅ Purchase Order ID:', purchaseOrderId)
        
        // Update tab with order data if available
        if (response?.data?.data) {
          updateTabOrderData(activeTabId, response.data.data)
        }

        updateTabPurchaseOrderId(activeTabId, String(purchaseOrderId))
        setTabEdited(activeTabId, false)
        toast.success(`Purchase Order ${currentTab.purchaseOrderId ? 'updated' : 'saved'}: ${purchaseOrderId}`)
      } else {
        console.error('❌ ===== NO PURCHASE ORDER ID FOUND =====')
        console.error('❌ Full Response:', JSON.stringify(response, null, 2))
        console.error('❌ Response Structure:', {
          hasResponse: !!response,
          hasData: !!response?.data,
          hasNestedData: !!response?.data?.data,
          responseKeys: response ? Object.keys(response) : [],
          dataKeys: response?.data ? Object.keys(response?.data) : [],
          nestedDataKeys: response?.data?.data ? Object.keys(response?.data?.data) : []
        })
        console.error('❌ All Possible ID Locations:', {
          'response.data.data.purchase_order_id': response?.data?.data?.purchase_order_id,
          'response.data.data.name': response?.data?.data?.name,
          'response.data.purchase_order_id': response?.data?.purchase_order_id,
          'response.data.name': response?.data?.name,
          'response.purchase_order_id': response?.purchase_order_id
        })
        toast.error('Purchase order saved, but no ID returned from server')
        return
      }
    } catch (e: any) {
      console.error('❌ Purchase save failed', e)
      toast.error(e?.response?.data?.message || e?.message || 'Failed to save purchase order')
    } finally {
      setIsSaving(false)
    }
  }

  const handleConfirm = () => {
    if (!currentTab?.purchaseOrderId) {
      toast.error('Please save the purchase order first')
      return
    }
    console.log('🔘 Confirm button clicked - opening confirm dialog')
    console.log('🔘 Current tab purchaseOrderId:', currentTab.purchaseOrderId)
    console.log('🔘 Current tab isEdited:', currentTab.isEdited)
    console.log('🔘 Is confirmed:', isConfirmed)
    setAmount('')
    setIsConfirming(true)
    setConfirmOpen(true)
  }

  const handlePay = () => {
    if (!currentTab?.purchaseOrderId) {
      toast.error('Please save the purchase order first')
      return
    }
    // Check if order is confirmed
    const docstatus = currentTab?.orderData ? Number(currentTab.orderData.docstatus) : null
    const isConfirmed = docstatus === 1
    console.log('💳 Pay button clicked')
    console.log('💳 Current tab purchaseOrderId:', currentTab.purchaseOrderId)
    console.log('💳 Order docstatus:', docstatus)
    console.log('💳 Is confirmed:', isConfirmed)
    if (!isConfirmed) {
      toast.error('Please confirm the purchase order first')
      return
    }
    setAmount('')
    setIsConfirming(false)
    setPayOpen(true)
  }

  const handleReturn = () => {
    if (!currentTab?.purchaseOrderId) {
      toast.error('Please save the purchase order first')
      return
    }
    console.log('🔄 Return button clicked - opening return modal')
    setReturnModalOpen(true)
  }

  // Check if order is confirmed (docstatus = 1)
  const docstatus = currentTab?.orderData ? Number(currentTab.orderData.docstatus) : null
  const isConfirmed = docstatus === 1

  return (
    <>
      <div className="p-3">
        <div className="flex justify-end items-center">
          <div className="flex gap-4">
            {/* Save Button */}
            <Button
              data-testid="purchase-save-button"
              className="px-2 py-1 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white font-medium rounded-lg hover:shadow-lg transition-all duration-300 flex items-center gap-1.5 text-[9px] disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={
                !currentUserPrivileges?.purchase ||
                currentTab?.status === 'confirmed' ||
                currentTab?.status === 'paid' ||
                !currentTab?.isEdited ||
                isSaving ||
                isConfirming ||
                isItemTableEditing
              }
              onClick={async () => {
                try {
                  await handleSave()
                } catch (error) {
                  console.error('Error in handleSave onClick:', error)
                }
              }}
            >
              {isSaving ? (
                <>
                  <i className="fas fa-spinner fa-spin text-xs"></i>
                  {currentTab?.purchaseOrderId ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="floppy-disk" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor">
                    <path d="M64 32C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64H384c35.3 0 64-28.7 64-64V173.3c0-17-6.7-33.3-18.7-45.3L352 18.7C340 6.7 323.7 0 306.7 0H64zm0 96H384V416H64V128zM224 288a64 64 0 1 1 0 128 64 64 0 1 1 0-128z"></path>
                  </svg>
                  {currentTab?.purchaseOrderId ? 'Update' : 'Save'}
                  <span className="text-[8px] opacity-80 bg-white/20 px-1 py-0 rounded ml-0.5">
                    Ctrl+S
                  </span>
                </>
              )}
            </Button>

            {/* Confirm Button - Only enable if order is created (has purchaseOrderId) and there are NO unsaved edits */}
            {/* Button stays visible but disabled after confirmation, just like sales */}
            <Button
              data-testid="purchase-confirm-button"
              className="px-2 py-1 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-medium rounded-lg hover:shadow-lg transition-all duration-300 flex items-center gap-1.5 text-[9px] disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={
                !currentUserPrivileges?.purchase ||
                !currentTab?.purchaseOrderId ||
                isConfirmed ||
                currentTab?.isEdited ||
                isItemTableEditing ||
                isSaving ||
                isConfirming
              }
              onClick={handleConfirm}
            >
              <svg className="w-3 h-3" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="paper-plane" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor">
                <path d="M498.1 5.6c10.1 7 15.4 19.1 13.5 31.2l-64 416c-1.5 9.7-7.4 18.2-16 23s-18.9 5.4-28 1.6L284 427.7l-68.5 74.1c-8.9 9.7-22.9 12.9-35.2 8.1S160 493.2 160 480V396.4c0-4 1.5-7.8 4.2-10.7L331.8 202.8c5.8-6.3 5.6-16-.4-22s-15.7-6.4-22-.7L106 360.8 17.7 316.6C7.1 311.3 .3 300.7 0 288.9s5.9-22.8 16.1-28.7l448-256c10.7-6.1 23.9-5.5 34 1.4z"></path>
              </svg>
              Confirm
              <span className="text-[8px] opacity-80 bg-white/20 px-1 py-0 rounded ml-0.5">Shift+S</span>
            </Button>

            {/* Pay Button - Only enable if order is confirmed */}
            {(() => {
              // For purchase, check if there's a purchase invoice with outstanding amount
              // Purchase orders might have linked_invoices (purchase invoices) after confirmation
              const linkedInvoices = currentTab?.orderData?.linked_invoices
              const firstLinkedInvoice = Array.isArray(linkedInvoices) && linkedInvoices.length > 0 ? linkedInvoices[0] : null
              const outstandingAmount = firstLinkedInvoice?.outstanding_amount
              // Check if order is confirmed (docstatus = 1)
              const docstatus = currentTab?.orderData ? Number(currentTab.orderData.docstatus) : null
              const isConfirmed = docstatus === 1
              
              // Pay button should be enabled if:
              // 1. Order is confirmed
              // 2. If there's a purchase invoice, check outstanding amount > 0
              // 3. If no invoice yet, still allow payment (will reference purchase order directly)
              const hasOutstanding = outstandingAmount !== undefined && outstandingAmount !== null && Number(outstandingAmount) > 0
              const hasInvoice = !!firstLinkedInvoice
              const noInvoiceYet = !hasInvoice
              // Disable only if: no privilege, no order ID, not confirmed, OR (has invoice AND outstanding is 0 or null)
              // Allow payment if: confirmed AND (no invoice yet OR has outstanding amount)
              const shouldDisablePayButton = !currentUserPrivileges?.purchase || !currentTab?.purchaseOrderId || !isConfirmed || (hasInvoice && !hasOutstanding)

              console.log('💳 Pay button state:', {
                isConfirmed,
                hasOutstanding,
                hasInvoice,
                noInvoiceYet,
                outstandingAmount,
                shouldDisablePayButton,
                purchaseOrderId: currentTab?.purchaseOrderId
              })

              return (
                <Button
                  className="px-2 py-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-lg hover:shadow-lg transition-all duration-300 flex items-center gap-1.5 text-[9px] disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={shouldDisablePayButton || isItemTableEditing || isProcessingPayment}
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
              data-testid="purchase-return-button"
              className="relative px-2 py-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-medium rounded-lg hover:shadow-lg transition-all duration-300 flex items-center gap-1.5 text-[9px] disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={
                !currentUserPrivileges?.purchase ||
                !isConfirmed ||
                !currentTab?.purchaseOrderId ||
                currentTab?.orderData?.is_fully_returned === 1 ||
                isItemTableEditing
              }
              onClick={() => {
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
        </div>
      </div>

      {/* Confirm Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent
          className="max-w-4xl w-[90vw] bg-white border-2 shadow-2xl"
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            // Focus will be handled by useEffect
          }}
        >
          <DialogHeader className="pb-4">
            <DialogTitle className="text-xl font-bold text-gray-800">Confirm Purchase Order</DialogTitle>
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
              <Select value={paymentMode} onValueChange={(v) => setPaymentMode(v as PaymentMode)}>
                <SelectTrigger className="w-full text-sm py-3">
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
                ref={amountInputRef}
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => {
                  // When arrow keys are pressed, move focus out of the input
                  if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                    // Only blur if cursor is at the edge (beginning for left/up, end for right/down)
                    const input = e.currentTarget as HTMLInputElement
                    const cursorPosition = input.selectionStart || 0
                    const valueLength = input.value.length
                    
                    if (
                      (e.key === 'ArrowRight' && cursorPosition === valueLength) ||
                      (e.key === 'ArrowLeft' && cursorPosition === 0) ||
                      e.key === 'ArrowDown' ||
                      e.key === 'ArrowUp'
                    ) {
                      e.preventDefault()
                      input.blur()
                      // Focus the Confirm button or next logical element
                      setTimeout(() => {
                        const confirmButton = document.querySelector('[data-confirm-button]') as HTMLButtonElement
                        if (confirmButton && !confirmButton.disabled) {
                          confirmButton.focus()
                        }
                      }, 0)
                    }
                  }
                }}
                className="text-lg py-3"
                placeholder="Enter amount"
                min="0"
                step="0.01"
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
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              data-confirm-button
              onClick={handleConfirmPayClick}
              disabled={isConfirming || isProcessingPayment}
              className={`px-8 py-3 text-lg font-semibold flex items-center gap-2 ${isConfirming || isProcessingPayment ? 'bg-gray-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'} text-white`}
            >
              {isConfirming ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Confirming...
                </div>
              ) : (
                <>
                  <svg className="w-4 h-4" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="paper-plane" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor">
                    <path d="M498.1 5.6c10.1 7 15.4 19.1 13.5 31.2l-64 416c-1.5 9.7-7.4 18.2-16 23s-18.9 5.4-28 1.6L284 427.7l-68.5 74.1c-8.9 9.7-22.9 12.9-35.2 8.1S160 493.2 160 480V396.4c0-4 1.5-7.8 4.2-10.7L331.8 202.8c5.8-6.3 5.6-16-.4-22s-15.7-6.4-22-.7L106 360.8 17.7 316.6C7.1 311.3 .3 300.7 0 288.9s5.9-22.8 16.1-28.7l448-256c10.7-6.1 23.9-5.5 34 1.4z"></path>
                  </svg>
                  Confirm
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pay Dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent
          className="max-w-4xl w-[90vw] bg-white border-2 shadow-2xl"
          onOpenAutoFocus={(e) => {
            e.preventDefault()
          }}
        >
          <DialogHeader>
            <DialogTitle>Make Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Payment Mode</label>
              <Select value={paymentMode} onValueChange={(v) => setPaymentMode(v as PaymentMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentModes.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Paid Amount</label>
              <Input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                inputMode="decimal"
                onKeyDown={(e) => {
                  // Move focus out of input when arrow keys are pressed at edges
                  if (e.key === 'ArrowLeft' && (e.target as HTMLInputElement).selectionStart === 0) {
                    e.preventDefault()
                    ;(e.target as HTMLInputElement).blur()
                  } else if (
                    e.key === 'ArrowRight' &&
                    (e.target as HTMLInputElement).selectionStart === (e.target as HTMLInputElement).value.length
                  ) {
                    e.preventDefault()
                    ;(e.target as HTMLInputElement).blur()
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>
              Cancel
            </Button>
            <Button
              data-confirm-button
              onClick={handleConfirmPayClick}
              disabled={isProcessingPayment || !amount || Number(amount) <= 0}
            >
              {isProcessingPayment ? 'Processing...' : 'Pay'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Purchase Return Modal */}
      <PurchaseReturnModal
        isOpen={returnModalOpen}
        onClose={() => setReturnModalOpen(false)}
        onReturnSuccess={() => {
          console.log('✅ Purchase return successful - refreshing order data')
        }}
      />
    </>
  )
}

export default PurchaseActionButtons
