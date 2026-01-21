import React, { useMemo, useState, useEffect } from 'react'
import { toast } from 'sonner'

import { Button } from '@renderer/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@renderer/components/ui/select'
import { usePOSProfileStore } from '@renderer/store/usePOSProfileStore'
import { usePurchaseTabStore } from '@renderer/store/usePurchaseTabStore'

const paymentModes = ['Cash', 'Card', 'Bank', 'UPI'] as const
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
    updateTabOrderData
  } = usePurchaseTabStore()

  const currentTab = getCurrentTab()
  const items = getCurrentTabItems()

  const [isSaving, setIsSaving] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('Cash')
  const [amount, setAmount] = useState<string>('')

  const buyingPriceList = currentTab?.buying_price_list || profile?.buying_price_list || 'Standard Buying'
  const transactionDate = currentTab?.posting_date || new Date().toISOString().slice(0, 10)

  const totalAmount = useMemo(() => {
    return items.reduce((acc, it) => {
      const qty = Number(it.quantity || 0)
      const rate = Number(it.standard_rate || 0)
      const disc = Number(it.discount_percentage || 0)
      const row = qty * rate * (1 - disc / 100)
      return acc + (Number.isFinite(row) ? row : 0)
    }, 0)
  }, [items])

  // Keyboard shortcuts for Confirm modal
  useEffect(() => {
    if (!confirmOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Spacebar: Cycle through payment modes
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault()
        setPaymentMode((prev) => {
          const currentIndex = paymentModes.indexOf(prev)
          const nextIndex = (currentIndex + 1) % paymentModes.length
          return paymentModes[nextIndex]
        })
      }

      // Shift+Enter: Trigger confirm
      if (e.shiftKey && e.code === 'Enter') {
        e.preventDefault()
        handleConfirmPayClick()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [confirmOpen, paymentMode])

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

      const payload: any = {
        supplier: currentTab.supplier.supplier_id,
        transaction_date: transactionDate,
        buying_price_list: buyingPriceList,
        taxes_and_charges: profile?.taxes_and_charges,
        internal_note: currentTab.internal_note || '',
        items: mappedItems
      }

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
        console.log('📦 Creating new purchase order')

        response = await window.electronAPI?.proxy?.request({
          url: '/api/method/centro_pos_apis.api.purchase.create_purchase_order',
          method: 'POST',
          data: payload
        })
      }

      const data = response?.data?.data
      const purchaseOrderId = data?.purchase_order_id || data?.name || data?.purchase_order || null

      if (!purchaseOrderId) {
        toast.error('Purchase order saved, but no ID returned from server')
        return
      }

      // Update tab with order data if available
      if (data) {
        updateTabOrderData(activeTabId, data)
      }

      updateTabPurchaseOrderId(activeTabId, String(purchaseOrderId))
      setTabEdited(activeTabId, false)
      toast.success(`Purchase Order ${currentTab.purchaseOrderId ? 'updated' : 'saved'}: ${purchaseOrderId}`)
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
    setAmount('')
    setConfirmOpen(true)
  }

  const handleConfirmPayClick = async () => {
    if (!currentTab?.purchaseOrderId) return
    const paidAmount = Number(amount || 0)
    if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
      toast.error('Please enter a valid paid amount')
      return
    }

    setIsConfirming(true)
    try {
      await window.electronAPI?.proxy?.request({
        url: '/api/method/centro_pos_apis.api.purchase.purchase_order_confirmation',
        method: 'POST',
        data: {
          purchase_order_id: currentTab.purchaseOrderId,
          mode_of_payment: paymentMode,
          paid_amount: paidAmount
        }
      })
      toast.success('Purchase Order confirmed')
      setConfirmOpen(false)
      setAmount('')
      // Refresh order data
      if (activeTabId) {
        const res = await window.electronAPI?.proxy?.request({
          url: '/api/method/centro_pos_apis.api.purchase.get_purchase_order_details',
          params: {
            purchase_order_id: currentTab.purchaseOrderId
          }
        })
        if (res?.data?.data) {
          updateTabOrderData(activeTabId, res.data.data)
        }
      }
    } catch (e: any) {
      console.error('❌ Purchase confirm failed', e)
      toast.error(e?.response?.data?.message || e?.message || 'Failed to confirm purchase order')
    } finally {
      setIsConfirming(false)
    }
  }

  const handleReturn = () => {
    if (!currentTab?.purchaseOrderId) {
      toast.error('Please save the purchase order first')
      return
    }
    // TODO: Implement purchase return modal
    toast.info('Purchase return functionality coming soon')
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

            {/* Confirm Button */}
            <Button
              data-testid="purchase-confirm-button"
              className="px-2 py-1 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-medium rounded-lg hover:shadow-lg transition-all duration-300 flex items-center gap-1.5 text-[9px] disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={
                !currentUserPrivileges?.purchase ||
                !currentTab?.purchaseOrderId ||
                currentTab?.status === 'confirmed' ||
                currentTab?.status === 'paid' ||
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

            {/* Return Button */}
            <Button
              data-testid="purchase-return-button"
              className="relative px-2 py-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-medium rounded-lg hover:shadow-lg transition-all duration-300 flex items-center gap-1.5 text-[9px] disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={
                !currentUserPrivileges?.purchase ||
                !isConfirmed ||
                !currentTab?.purchaseOrderId ||
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
              <svg className="w-3 h-3" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="arrow-rotate-left" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor">
                <path d="M125.7 160H176c17.7 0 32 14.3 32 32s-14.3 32-32 32H48c-17.7 0-32-14.3-32-32V64c0-17.7 14.3-32 32-32s32 14.3 32 32v51.2L97.6 97.6c87.5-87.5 229.3-87.5 316.8 0s87.5 229.3 0 316.8s-229.3 87.5-316.8 0c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0c62.5 62.5 163.8 62.5 226.3 0s62.5-163.8 0-226.3s-163.8-62.5-226.3 0L125.7 160z"></path>
              </svg>
              Return
              <span className="text-[8px] opacity-80 bg-white/20 px-1 py-0 rounded ml-0.5">Ctrl+R</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Confirm/Payment Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent
          className="max-w-4xl w-[90vw] bg-white border-2 shadow-2xl"
          onOpenAutoFocus={(e) => {
            e.preventDefault()
          }}
        >
          <DialogHeader>
            <DialogTitle>Confirm Purchase Order</DialogTitle>
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
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              data-confirm-button
              onClick={handleConfirmPayClick}
              disabled={isConfirming || !amount || Number(amount) <= 0}
            >
              {isConfirming ? 'Confirming...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default PurchaseActionButtons
