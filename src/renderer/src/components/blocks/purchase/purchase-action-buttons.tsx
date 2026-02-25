import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { toast } from 'sonner'

import { Button } from '@renderer/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@renderer/components/ui/select'
import { usePOSProfileStore } from '@renderer/store/usePOSProfileStore'
import { usePurchaseTabStore } from '@renderer/store/usePurchaseTabStore'
import { handleError } from '@renderer/lib/error-handler'
import PurchaseReturnModal from './purchase-return-modal'
import PurchaseReceiptModal from './PurchaseReceiptModal'

import { PlusCircle, Trash } from 'lucide-react'

interface Payment {
  mode: string
  amount: string
  reference_no: string
  reference_date: string
  id: string
}

type PurchaseActionButtonsProps = {
  isItemTableEditing?: boolean
  onNavigateToPrints?: () => void
}

const PurchaseActionButtons: React.FC<PurchaseActionButtonsProps> = ({ isItemTableEditing, onNavigateToPrints }) => {
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
    getCurrentTabSupplier,
    updateTabInstantPrintUrl,
    setPurchaseOrderPrintUrl,
    setPurchaseInvoicePrintUrl,
    updateTabStatus // Ensure this exists in store
  } = usePurchaseTabStore()

  const currentTab = getCurrentTab()
  const items = getCurrentTabItems()
  const globalDiscountPercent = getCurrentTabGlobalDiscount()
  const isRoundingEnabled = getCurrentTabRoundingEnabled()

  // Fetch order details when tab is opened/selected (for previously opened orders)
  // This ensures button states update dynamically when switching tabs
  React.useEffect(() => {
    const fetchOrderDetails = async () => {
      if (!currentTab?.purchaseOrderId || !currentTab?.id) return

      try {
        console.log('📦 Fetching purchase order details for tab:', currentTab.id, 'Order ID:', currentTab.purchaseOrderId)
        const res = await window.electronAPI?.proxy?.request({
          url: '/api/method/centro_pos_apis.api.purchase.get_purchase_order_details',
          params: {
            purchase_order_id: currentTab.purchaseOrderId
          },
          method: 'GET'
        })

        if (res?.data?.data && currentTab.id) {
          const orderData = res.data.data
          const docstatus = Number(orderData.docstatus) || null

          console.log('📦 Purchase order details fetched for tab:', {
            tabId: currentTab.id,
            orderId: currentTab.purchaseOrderId,
            docstatus: docstatus,
            isConfirmed: docstatus === 1
          })

          // Update orderData to refresh status and button states
          updateTabOrderData(currentTab.id, orderData)
        }
      } catch (e) {
        console.error('Failed to fetch purchase order details for tab:', e)
      }
    }

    // Fetch when purchaseOrderId exists (order is created) and tab changes
    if (currentTab?.purchaseOrderId) {
      fetchOrderDetails()
    }
  }, [activeTabId, currentTab?.purchaseOrderId, currentTab?.id, updateTabOrderData])

  const [isSaving, setIsSaving] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  const [open, setOpen] = useState<'pay' | 'confirm' | false>(false)
  const [returnModalOpen, setReturnModalOpen] = useState(false)
  const [receiptModalOpen, setReceiptModalOpen] = useState(false)
  const [paymentModes, setPaymentModes] = useState<string[]>(['Cash', 'Bank'])
  const [payments, setPayments] = useState<Payment[]>([])
  const [showValidationErrors, setShowValidationErrors] = useState(false)
  const [date, setDate] = useState<string>('')
  const [orderAmount, setOrderAmount] = useState<string>('0.00')
  const [amountDue, setAmountDue] = useState<string>('0.00')
  const amountInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({})
  const modeInputRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({})
  const refNoInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({})
  const refDateInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({})
  const prevPaymentsLengthRef = useRef(0)

  // Get current date helper
  const getCurrentDate = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const buyingPriceList = currentTab?.buying_price_list || profile?.custom_buying_price_list || 'Standard Buying'
  const transactionDate = currentTab?.posting_date || new Date().toISOString().slice(0, 10)

  // Check if order is confirmed (docstatus = 1)
  const docstatus = currentTab?.orderData ? Number(currentTab.orderData.docstatus) : null
  const isConfirmed = docstatus === 1

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
    const vatPercentage = Number(profile?.custom_purchase_tax_rate || 15)
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
    const totalPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
    const orderAmt = parseFloat(orderAmount || '0') || 0

    if (totalPaid === 0) {
      return { text: 'Credit Purchase', color: 'bg-orange-100 text-orange-800' }
    } else if (totalPaid >= orderAmt) {
      return { text: 'Fully Paid', color: 'bg-green-100 text-green-800' }
    } else {
      return { text: 'Partially Paid', color: 'bg-yellow-100 text-yellow-800' }
    }
  }

  const paymentStatus = getPaymentStatus()

  // Load POS Profile data for payment modes
  const loadPOSProfile = async () => {
    try {
      const response = await window.electronAPI?.proxy?.request({
        url: '/api/method/centro_pos_apis.api.pos_profile.get_pos_profile_details',
        method: 'GET'
      })

      if (response?.data?.data) {
        const profileData = response.data.data
        if (profileData.payments && Array.isArray(profileData.payments)) {
          const modes = profileData.payments
            .map((p: any) => p.mode_of_payment)
            .filter((m: any) => m && m.trim() !== '')
          const uniqueModes = [...new Set(modes)]
          if (uniqueModes.length > 0) {
            setPaymentModes(uniqueModes as string[])
          }
        }
      }
    } catch (error) {
      console.error('Error loading POS profile for purchase:', error)
    }
  }

  useEffect(() => {
    loadPOSProfile()
  }, [])

  // Focus new payment mode when row is added
  useEffect(() => {
    if (payments.length > prevPaymentsLengthRef.current) {
      const lastPayment = payments[payments.length - 1]
      setTimeout(() => {
        modeInputRefs.current[lastPayment.id]?.focus()
      }, 50)
    }
    prevPaymentsLengthRef.current = payments.length
  }, [payments.length])

  const paymentsRef = useRef(payments)
  useEffect(() => {
    paymentsRef.current = payments
  }, [payments])

  // Auto-focus first payment mode input when dialog opens
  useEffect(() => {
    if (open) {
      const focusFirstPayment = () => {
        const currentPayments = paymentsRef.current
        const firstPaymentId = currentPayments[0]?.id
        if (firstPaymentId && modeInputRefs.current[firstPaymentId]) {
          const btn = modeInputRefs.current[firstPaymentId]
          btn?.focus()
        }
      }
      const t1 = setTimeout(focusFirstPayment, 100)
      const t2 = setTimeout(focusFirstPayment, 250)
      const t3 = setTimeout(focusFirstPayment, 500)
      return () => {
        clearTimeout(t1)
        clearTimeout(t2)
        clearTimeout(t3)
      }
    }
    return undefined
  }, [open])

  // Load Amount Due and update Order Amount when Pay dialog opens
  useEffect(() => {
    if (open !== 'pay') return

    let cancelled = false
    const fetchAmountDue = async () => {
      try {
        // For Pay dialog, update Order Amount to use outstanding_amount from linked_invoices[0]
        if (currentTab?.orderData?.linked_invoices) {
          const linkedInvoices = currentTab.orderData.linked_invoices
          let outstandingAmount: number | null = null

          if (Array.isArray(linkedInvoices) && linkedInvoices.length > 0) {
            outstandingAmount = Number(linkedInvoices[0]?.outstanding_amount ?? 0)
          } else if (typeof linkedInvoices === 'object' && !Array.isArray(linkedInvoices)) {
            outstandingAmount = Number((linkedInvoices as any)?.outstanding_amount ?? 0)
          }

          // Update Order Amount to use outstanding_amount
          if (outstandingAmount !== null && !cancelled) {
            setOrderAmount(outstandingAmount.toFixed(2))
          }
        }

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
  }, [open, currentTab?.orderData?.linked_invoices, getCurrentTabSupplier])

  // Initialize date when modal opens
  useEffect(() => {
    if (open) {
      setDate(transactionDate || getCurrentDate())
      // Initialize payments if empty
      if (payments.length === 0) {
        setPayments([
          {
            mode: 'Cash',
            amount: open === 'pay' ? orderAmount : '0',
            reference_no: '',
            reference_date: getCurrentDate(),
            id: crypto.randomUUID()
          }
        ])
      }
    }
  }, [open, transactionDate, getCurrentDate, orderAmount])

  // Purchase order confirmation API function
  const handlePurchaseOrderConfirmation = async (paymentsArray: Payment[] = [], isConfirmingMode: boolean = false) => {
    const paymentAmount = paymentsArray.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)

    const zeroQtyItem = items.find((it: any) => Number(it.quantity || 0) <= 0)
    if (zeroQtyItem) {
      toast.error(`Item ${zeroQtyItem.item_code} has 0 quantity. Please set a valid quantity.`)
      setIsProcessingPayment(false)
      return
    }

    setIsProcessingPayment(true)

    try {
      if (!currentTab || !currentTab.purchaseOrderId) {
        toast.error('No purchase order found. Please save the order first.')
        return
      }

      // Check if order is already confirmed (docstatus = 1)
      let isAlreadyConfirmed = false
      try {
        const orderDetailsCheck = await window.electronAPI?.proxy?.request({
          url: '/api/method/centro_pos_apis.api.purchase.get_purchase_order_details',
          params: {
            purchase_order_id: currentTab.purchaseOrderId
          },
          method: 'GET'
        })
        if (orderDetailsCheck?.data?.data) {
          isAlreadyConfirmed = Number(orderDetailsCheck.data.data.docstatus) === 1
        }
      } catch (checkError) {
        console.warn('Failed to check docstatus:', checkError)
        isAlreadyConfirmed = currentTab?.orderData && Number(currentTab.orderData.docstatus) === 1
      }

      // If already confirmed and we have payments, create payment entries directly
      if (!isConfirmingMode && isAlreadyConfirmed && paymentAmount > 0) {
        let supplierId = currentTab?.supplier?.supplier_id || currentTab?.orderData?.supplier || null
        if (!supplierId) {
          const s = getCurrentTabSupplier()
          supplierId = s?.supplier_id || null
        }

        if (!supplierId) {
          toast.error('Supplier not found. Cannot process payment.')
          return
        }

        // Get invoice number
        let invoiceNumber = currentTab?.orderData?.purchase_invoice_no || null
        if (!invoiceNumber && currentTab?.orderData?.linked_invoices) {
          const linked = currentTab.orderData.linked_invoices
          if (Array.isArray(linked) && linked.length > 0) {
            invoiceNumber = linked[0]?.name || null
          } else if (linked && typeof linked === 'object') {
            invoiceNumber = (linked as any).name || null
          }
        }

        const postingDate = getCurrentTabPostingDate() || date || getCurrentDate()

        for (const payment of paymentsArray) {
          const rowAmount = parseFloat(payment.amount) || 0
          if (rowAmount <= 0) continue

          const paymentEntryData = {
            payment_type: 'Pay',
            party_type: 'Supplier',
            party: supplierId,
            posting_date: postingDate,
            paid_amount: rowAmount,
            mode_of_payment: payment.mode,
            reference_no: payment.reference_no || null,
            reference_date: payment.reference_date || null,
            references: [
              {
                reference_doctype: 'Purchase Invoice',
                reference_name: invoiceNumber,
                allocated_amount: rowAmount
              }
            ]
          }

          const res = await window.electronAPI?.proxy?.request({
            method: 'POST',
            url: '/api/method/centro_pos_apis.api.order.create_payment_entry',
            data: paymentEntryData
          })

          if (res?.success) {
            const pdfUrl = res.data?.data?.pdf_download_url || res.data?.pdf_download_url
            if (pdfUrl) updateTabInstantPrintUrl(currentTab.id, pdfUrl)
          } else {
            handleError(res?.data?._server_messages || `Failed to create payment entry for ${payment.mode}`)
          }
        }

        toast.success(`Payments processed successfully!`)
        if (activeTabId) updateTabStatus?.(activeTabId, 'paid')

        // Refresh details
        try {
          const res = await window.electronAPI?.proxy?.request({
            url: '/api/method/centro_pos_apis.api.purchase.get_purchase_order_details',
            params: { purchase_order_id: currentTab.purchaseOrderId }
          })
          if (res?.data?.data && activeTabId) updateTabOrderData(activeTabId, res.data.data)
        } catch (e) { }

        setOpen(false)
        onNavigateToPrints?.()
        return
      }

      // Confirmation mode or not confirmed yet
      const confirmationData = {
        purchase_order_id: currentTab.purchaseOrderId,
        payments: paymentsArray.map(p => ({
          mode_of_payment: p.mode,
          amount: parseFloat(p.amount) || 0,
          reference_no: p.reference_no || null,
          reference_date: p.reference_date || null
        }))
      }

      console.log('📦 Confirmation Payload:', JSON.stringify(confirmationData, null, 2))

      const response = await window.electronAPI?.proxy?.request({
        method: 'POST',
        url: '/api/method/centro_pos_apis.api.purchase.purchase_order_confirmation',
        data: confirmationData
      })

      if (response?.success) {
        toast.success('Purchase Order confirmed successfully')

        const pdfUrl = response.data?.data?.pdf_download_url || response.data?.pdf_download_url
        if (pdfUrl) {
          updateTabInstantPrintUrl(currentTab.id, pdfUrl)
          setPurchaseInvoicePrintUrl(currentTab.id, pdfUrl)
        }

        // Refresh and check for payments
        const refreshRes = await window.electronAPI?.proxy?.request({
          url: '/api/method/centro_pos_apis.api.purchase.get_purchase_order_details',
          params: { purchase_order_id: currentTab.purchaseOrderId }
        })

        if (refreshRes?.data?.data) {
          const orderData = refreshRes.data.data
          updateTabOrderData(currentTab.id, orderData)

          // Extract invoice number for potential payments
          const linked = orderData.linked_invoices
          let invoiceNumber = null
          if (Array.isArray(linked) && linked.length > 0) {
            invoiceNumber = linked[0]?.name || null
          } else if (linked && typeof linked === 'object') {
            invoiceNumber = (linked as any).name || null
          }

          // If not in confirm-only mode and we have remaining payment to process
          if (!isConfirmingMode && paymentAmount > 0 && invoiceNumber) {
            let supplierId = orderData.supplier || currentTab?.supplier?.supplier_id
            const postingDate = getCurrentTabPostingDate() || date || getCurrentDate()

            for (const payment of paymentsArray) {
              const rowAmount = parseFloat(payment.amount) || 0
              if (rowAmount <= 0) continue

              const paymentEntryData = {
                payment_type: 'Pay',
                party_type: 'Supplier',
                party: supplierId,
                posting_date: postingDate,
                paid_amount: rowAmount,
                mode_of_payment: payment.mode,
                reference_no: payment.reference_no || null,
                reference_date: payment.reference_date || null,
                references: [
                  {
                    reference_doctype: 'Purchase Invoice',
                    reference_name: invoiceNumber,
                    allocated_amount: rowAmount
                  }
                ]
              }

              await window.electronAPI?.proxy?.request({
                method: 'POST',
                url: '/api/method/centro_pos_apis.api.order.create_payment_entry',
                data: paymentEntryData
              })
            }
          }
        }

        setOpen(false)
        onNavigateToPrints?.()
      } else {
        handleError(response?.data?._server_messages || response?.data?.message || 'Failed to confirm purchase order')
      }
    } catch (error) {
      handleError(error, 'Failed to confirm purchase order')
    } finally {
      setIsProcessingPayment(false)
      setIsConfirming(false)
    }
  }

  const handleConfirmPayClick = () => {
    // Validate payments
    const invalidPayment = payments.find(p => {
      const amount = parseFloat(p.amount) || 0
      if (amount <= 0) return false
      if (p.mode === 'Cash') return false
      return !p.reference_no?.trim() || !p.reference_date
    })

    if (invalidPayment) {
      setShowValidationErrors(true)
      toast.error('Please fill in reference numbers and dates for non-cash payments.')
      return
    }

    setShowValidationErrors(false)
    handlePurchaseOrderConfirmation(payments, open === 'confirm')
  }


  // Keyboard shortcuts for Confirm/Pay modal
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      // Ctrl + Plus (+) to add new row
      if (e.ctrlKey && (e.key === '+' || e.key === '=')) {
        e.preventDefault()
        setPayments(prev => [
          ...prev,
          {
            mode: 'Cash',
            amount: '0',
            reference_no: '',
            reference_date: getCurrentDate(),
            id: crypto.randomUUID()
          }
        ])
        return
      }

      // Shift+Enter or Ctrl+Enter: Trigger Confirm button
      if ((e.key === 'Enter' && e.shiftKey) || (e.key === 'Enter' && e.ctrlKey)) {
        if (!isProcessingPayment) {
          e.preventDefault()
          e.stopPropagation()
          handleConfirmPayClick()
        }
      }
      // Spacebar: Cycle payment modes (only if not in input field)
      else if (e.key === ' ' && !isInputField) {
        e.preventDefault()
        e.stopPropagation()

        if (payments.length > 0) {
          const currentIndex = paymentModes.indexOf(payments[0].mode)
          const nextIndex = (currentIndex + 1) % paymentModes.length
          const nextMode = paymentModes[nextIndex]
          const newPayments = [...payments]
          newPayments[0].mode = nextMode
          setPayments(newPayments)
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, payments, paymentModes, isProcessingPayment, handleConfirmPayClick])

  // Keyboard shortcuts for buttons
  useHotkeys('ctrl+s', (e) => {
    const canSave = (
      currentUserPrivileges?.purchase &&
      currentTab?.status !== 'confirmed' &&
      currentTab?.status !== 'paid' &&
      !isConfirmed &&
      currentTab?.isEdited &&
      !isSaving &&
      !isConfirming &&
      !isItemTableEditing
    )

    if (canSave) {
      e.preventDefault()
      handleSave()
    }
  }, { enableOnFormTags: true }, [currentUserPrivileges, currentTab, isConfirmed, isSaving, isConfirming, isItemTableEditing])

  useHotkeys('ctrl+shift+s', (e) => {
    const canConfirm = (
      currentUserPrivileges?.purchase &&
      currentTab?.purchaseOrderId &&
      !isConfirmed &&
      !currentTab?.isEdited &&
      !isItemTableEditing &&
      !isSaving &&
      !isConfirming
    )

    if (canConfirm) {
      e.preventDefault()
      handleConfirm()
    }
  }, { enableOnFormTags: true }, [currentUserPrivileges, currentTab, isConfirmed, isItemTableEditing, isSaving, isConfirming])

  useHotkeys('ctrl+shift+f', (e) => {
    const linkedInvoices = currentTab?.orderData?.linked_invoices
    const firstLinkedInvoice = Array.isArray(linkedInvoices) && linkedInvoices.length > 0 ? linkedInvoices[0] : null
    const outstandingAmount = firstLinkedInvoice?.outstanding_amount
    const hasOutstanding = outstandingAmount !== undefined && outstandingAmount !== null && Number(outstandingAmount) > 0
    const hasInvoice = !!firstLinkedInvoice
    const canPay = (
      currentUserPrivileges?.purchase &&
      currentTab?.purchaseOrderId &&
      isConfirmed &&
      (!hasInvoice || hasOutstanding) &&
      !isItemTableEditing &&
      !isProcessingPayment
    )

    if (canPay) {
      e.preventDefault()
      handlePay()
    }
  }, { enableOnFormTags: true }, [currentUserPrivileges, currentTab, isConfirmed, isItemTableEditing, isProcessingPayment])

  useHotkeys('ctrl+r', (e) => {
    const canReturn = (
      currentUserPrivileges?.purchase &&
      isConfirmed &&
      currentTab?.purchaseOrderId &&
      currentTab?.orderData?.is_fully_returned !== 1 &&
      !isItemTableEditing
    )

    const target = e.target as HTMLElement
    const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
    if (!isInputField && canReturn) {
      e.preventDefault()
      handleReturn()
    }
  }, { enableOnFormTags: true }, [currentUserPrivileges, isConfirmed, currentTab, isItemTableEditing])

  const handleSave = async () => {
    if (!currentTab || isSaving || isConfirmed) return

    if (!currentTab?.supplier?.supplier_id) {
      toast.error('Please select a supplier before saving')
      return
    }
    if (items.length === 0) {
      toast.error('Please add at least one item')
      return
    }

    const zeroQtyItem = items.find((it) => Number(it.quantity || 0) <= 0)
    if (zeroQtyItem) {
      toast.error(`Item ${zeroQtyItem.item_code} has 0 quantity. Please set a valid quantity.`)
      return
    }

    setIsSaving(true)
    try {
      const mappedItems = items.map((it) => ({
        item_code: it.item_code,
        qty: Number(it.quantity || 0),
        uom: it.uom,
        rate: Number(it.standard_rate || 0),
        discount_percentage: Number(it.discount_percentage || 0),
        ...(it.pr_item_id ? { pr_item_id: it.pr_item_id } : {})
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
        handleError(response?.data?._server_messages || response?.data?.message || response?.message || 'Failed to save purchase order')
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

      if (purchaseOrderId && activeTabId) {
        console.log('✅ ===== PURCHASE ORDER ID SUCCESSFULLY EXTRACTED =====')
        console.log('✅ Purchase Order ID:', purchaseOrderId)

        // Update tab with order data if available
        if (response?.data?.data) {
          updateTabOrderData(activeTabId, response.data.data)
        }

        updateTabPurchaseOrderId(activeTabId, String(purchaseOrderId))

        // Extract pdf_download_url from response
        const pdfUrl = response.data?.data?.pdf_download_url || response.data?.pdf_download_url
        if (pdfUrl) {
          console.log('🖨️ Purchase Order PDF URL found:', pdfUrl)
          updateTabInstantPrintUrl(activeTabId, pdfUrl)
          // Also update the specific Purchase Order Print URL
          setPurchaseOrderPrintUrl(activeTabId, pdfUrl)
        }

        setTabEdited(activeTabId, false)
        toast.success(`Purchase Order ${currentTab.purchaseOrderId ? 'updated' : 'saved'}: ${purchaseOrderId}`)

        // Navigate to prints tab if URL was available
        if (pdfUrl) {
          onNavigateToPrints?.()
        }
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
      handleError(e, 'Failed to save purchase order')
    } finally {
      setIsSaving(false)
    }
  }

  const handleConfirm = () => {
    if (!currentTab?.purchaseOrderId) {
      toast.error('Please save the purchase order first')
      return
    }
    setPayments([])
    setIsConfirming(true)
    setOpen('confirm')
  }

  const handlePay = () => {
    if (!currentTab?.purchaseOrderId) {
      toast.error('Please save the purchase order first')
      return
    }
    const docstatus = currentTab?.orderData ? Number(currentTab.orderData.docstatus) : null
    if (docstatus !== 1) {
      toast.error('Please confirm the purchase order first')
      return
    }
    setPayments([])
    setIsConfirming(false)
    setOpen('pay')
  }

  const handleReturn = () => {
    if (!currentTab?.purchaseOrderId) {
      toast.error('Please save the purchase order first')
      return
    }
    console.log('🔄 Return button clicked - opening return modal')
    setReturnModalOpen(true)
  }

  return (
    <>
      <div className="p-3">
        <div className="flex justify-end items-center">
          <div className="flex gap-4">
            {/* Receipt Button - add items from unbilled purchase receipt */}
            <Button
              data-testid="purchase-receipt-button"
              className="px-2 py-1 bg-gradient-to-r from-violet-500 to-violet-600 text-white font-medium rounded-lg hover:shadow-lg transition-all duration-300 flex items-center gap-1.5 text-[9px] disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={
                !currentUserPrivileges?.purchase ||
                currentTab?.status === 'confirmed' ||
                currentTab?.status === 'paid' ||
                !currentTab
              }
              onClick={() => setReceiptModalOpen(true)}
            >
              <svg className="w-3 h-3" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="receipt" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" fill="currentColor">
                <path d="M64 0C28.7 0 0 28.7 0 64V448c0 35.3 28.7 64 64 64H320c35.3 0 64-28.7 64-64V160H256c-17.7 0-32-14.3-32-32V0H64zM256 0V128H384L256 0zM80 256H304c8.8 0 16 7.2 16 16s-7.2 16-16 16H80c-8.8 0-16-7.2-16-16s7.2-16 16-16zm0 64H304c8.8 0 16 7.2 16 16s-7.2 16-16 16H80c-8.8 0-16-7.2-16-16s7.2-16 16-16zm0 64H304c8.8 0 16 7.2 16 16s-7.2 16-16 16H80c-8.8 0-16-7.2-16-16s7.2-16 16-16z"></path>
              </svg>
              Receipt
            </Button>

            {/* Save Button */}
            <Button
              data-testid="purchase-save-button"
              className="px-2 py-1 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white font-medium rounded-lg hover:shadow-lg transition-all duration-300 flex items-center gap-1.5 text-[9px] disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={
                !currentUserPrivileges?.purchase ||
                currentTab?.status === 'confirmed' ||
                currentTab?.status === 'paid' ||
                isConfirmed ||
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

      {/* Payment / Confirm Dialog */}
      <Dialog open={!!open} onOpenChange={(v) => setOpen(v ? open || 'confirm' : false)}>
        <DialogContent
          className="max-w-5xl w-[95vw] bg-white border-2 shadow-2xl"
          onOpenAutoFocus={(e) => {
            e.preventDefault()
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
                            modeInputRefs.current[nextPayment.id]?.focus()
                          } else {
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

      {/* Purchase Return Modal */}
      <PurchaseReturnModal
        isOpen={returnModalOpen}
        onClose={() => setReturnModalOpen(false)}
        onReturnSuccess={() => {
          console.log('✅ Purchase return successful - navigating to prints')
          onNavigateToPrints?.()
        }}
      />

      {/* Purchase Receipt Modal - add items from unbilled purchase receipts */}
      <PurchaseReceiptModal
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        onAdded={() => setReceiptModalOpen(false)}
      />
    </>
  )
}

export default PurchaseActionButtons
