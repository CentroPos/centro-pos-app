import { Button } from '@renderer/components/ui/button'
import { User } from 'lucide-react'
import { Input } from '@renderer/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@renderer/components/ui/dialog'
import { useMemo, useState, useRef, useEffect } from 'react'
import { usePurchaseTabStore } from '@renderer/store/usePurchaseTabStore'
import { useHotkeys } from 'react-hotkeys-hook'
import BottomErrorBox from '../common/bottom-error-box'
import SupplierModal from '../supplier/supplier-modal'
import { toast } from 'sonner'

interface ErrorMessage {
  message: string
  title: string
  indicator: string
  itemCode: string
}

type Props = {
  errors?: ErrorMessage[]
  onCloseErrors?: () => void
  onErrorBoxFocusChange?: (isFocused: boolean) => void
  onFocusItem?: (itemCode: string, idx?: number) => void
  forceOpenSupplierModal?: boolean
  onSupplierModalChange?: (isOpen: boolean) => void
  onSupplierSelect?: (supplier: any) => void
}

function roundToNearest(value: number, step = 0.05) {
  const rounded = Math.round(value / step) * step
  return Number(rounded.toFixed(2))
}

const PurchaseDiscountSection: React.FC<Props> = ({
  errors = [],
  onCloseErrors,
  onErrorBoxFocusChange,
  onFocusItem,
  forceOpenSupplierModal,
  onSupplierModalChange,
  onSupplierSelect
}) => {
  const {
    getCurrentTabItems,
    getCurrentTabGlobalDiscount,
    updateTabGlobalDiscount,
    getCurrentTab,
    setTabEdited,
    duplicateCurrentTab,
    updateTabRoundingEnabled,
    getCurrentTabRoundingEnabled,
    getCurrentTabSupplier,
    updateTabSupplier,
    activeTabId
  } = usePurchaseTabStore()
  const items = getCurrentTabItems()
  const currentTab = getCurrentTab()
  const selectedSupplier = getCurrentTabSupplier()
  const globalDiscountPercent = getCurrentTabGlobalDiscount()

  const [isEditingGlobalDiscount, setIsEditingGlobalDiscount] = useState(false)
  const [globalDiscountValue, setGlobalDiscountValue] = useState('')
  const globalDiscountRef = useRef<HTMLInputElement>(null)
  const [currencySymbol, setCurrencySymbol] = useState('$')
  const [vatPercentage, setVatPercentage] = useState(10)
  const isRoundingEnabledFromStore = getCurrentTabRoundingEnabled()
  const [isRoundingEnabled, setIsRoundingEnabled] = useState(isRoundingEnabledFromStore)
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false)
  const duplicateConfirmBtnRef = useRef<HTMLButtonElement>(null)
  const duplicateCancelBtnRef = useRef<HTMLButtonElement>(null)
  const [showSupplierModal, setShowSupplierModal] = useState(false)

  // Extract paid_amount and outstanding_amount from linked_invoices
  const { paidAmount, outstandingAmount } = useMemo(() => {
    const linkedInvoices = currentTab?.orderData?.linked_invoices

    if (linkedInvoices) {
      let paid = null
      let outstanding = null

      if (Array.isArray(linkedInvoices) && linkedInvoices.length > 0) {
        paid = linkedInvoices[0]?.paid_amount
        outstanding = linkedInvoices[0]?.outstanding_amount
      } else if (linkedInvoices && typeof linkedInvoices === 'object') {
        paid = linkedInvoices.paid_amount
        outstanding = (linkedInvoices as any)?.outstanding_amount
      }

      return {
        paidAmount: paid !== null && paid !== undefined ? Number(paid) : null,
        outstandingAmount: outstanding !== null && outstanding !== undefined ? Number(outstanding) : null
      }
    }

    return { paidAmount: null, outstandingAmount: null }
  }, [currentTab?.orderData])

  // Check if order is confirmed/paid/read-only
  const isReadOnly = currentTab?.status === 'confirmed' ||
    currentTab?.status === 'paid' ||
    (currentTab?.orderData && Number(currentTab.orderData.docstatus) === 1) ||
    (currentTab?.purchaseOrderId && outstandingAmount !== null && Math.abs(outstandingAmount) < 0.01) ||
    (outstandingAmount !== null && Math.abs(outstandingAmount) < 0.01 && currentTab?.orderData?.linked_invoices)

  const handleSupplierSelect = async (supplier: any) => {
    if (!activeTabId) {
      toast.error('No active tab. Please create a new purchase order first.')
      setShowSupplierModal(false)
      return
    }
    // Update supplier in the tab store
    updateTabSupplier(activeTabId, {
      name: supplier.supplier_name || supplier.name,
      supplier_id: supplier.supplier_id || supplier.name,
      mobile_no: supplier.mobile_no,
      email: supplier.email,
      tax_id: supplier.tax_id
    })
    // Mark tab as edited since supplier was selected
    setTabEdited(activeTabId, true)
    setShowSupplierModal(false)
    // Notify parent component
    onSupplierSelect?.(supplier)
    // Show success message
    toast.success(`Supplier "${supplier.supplier_name || supplier.name}" selected`)
  }

  // Sync local state with store
  useEffect(() => {
    setIsRoundingEnabled(isRoundingEnabledFromStore)
  }, [isRoundingEnabledFromStore])

  // Update store when rounding changes
  const handleRoundingChange = (enabled: boolean) => {
    if (isReadOnly) return
    setIsRoundingEnabled(enabled)
    if (currentTab) {
      updateTabRoundingEnabled(currentTab.id, enabled)
      setTabEdited(currentTab.id, true)
    }
  }

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingGlobalDiscount && globalDiscountRef.current) {
      globalDiscountRef.current.focus()
      globalDiscountRef.current.select()
    }
  }, [isEditingGlobalDiscount])

  // Load POS profile data
  const loadPOSProfile = async () => {
    try {
      const response = await window.electronAPI?.proxy?.request({
        url: '/api/method/centro_pos_apis.api.profile.get_pos_profile'
      })

      if (response?.data?.data) {
        const profileData = response.data.data

        if (profileData.custom_currency_symbol) {
          setCurrencySymbol(profileData.custom_currency_symbol)
        }

        if (profileData.custom_tax_rate !== null && profileData.custom_tax_rate !== undefined) {
          const vatValue = Number(profileData.custom_tax_rate)
          if (!isNaN(vatValue) && vatValue >= 0) {
            setVatPercentage(vatValue)
          }
        }
      }
    } catch (error) {
      console.error('📋 Error loading POS profile in PurchaseDiscountSection:', error)
    }
  }

  useEffect(() => {
    loadPOSProfile()
  }, [])

  // Sync local state with external forceOpen prop
  useEffect(() => {
    if (forceOpenSupplierModal) {
      setShowSupplierModal(true)
    }
  }, [forceOpenSupplierModal])

  // Notify parent when modal state changes
  useEffect(() => {
    onSupplierModalChange?.(showSupplierModal)
  }, [showSupplierModal, onSupplierModalChange])

  // Initialize global discount value
  useEffect(() => {
    setGlobalDiscountValue(globalDiscountPercent.toString())
  }, [globalDiscountPercent])

  const { untaxed, globalDiscount, vat, rounding, total } = useMemo(() => {
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
    const vatCalc = netAfterGlobalDiscount * (vatPercentage / 100)
    const totalRaw = netAfterGlobalDiscount + vatCalc
    const totalRoundedCandidate = roundToNearest(totalRaw, 0.05)
    const roundingCandidate = Number((totalRoundedCandidate - totalRaw).toFixed(2))

    const useRounding = isRoundingEnabled
    let totalFinal = useRounding ? totalRoundedCandidate : Number(totalRaw.toFixed(2))
    let roundingAdj = useRounding ? roundingCandidate : 0

    const hasSavedOrder = Boolean(currentTab?.purchaseOrderId)
    const docstatus = currentTab?.orderData ? Number(currentTab.orderData.docstatus) : null
    const isConfirmed = docstatus === 1
    const isEdited = currentTab?.isEdited ?? false

    const roundedTotalFromOrder = currentTab?.orderData?.final_total
    const grandTotalFromOrder = currentTab?.orderData?.grand_total

    const linkedInvoices = currentTab?.orderData?.linked_invoices
    let linkedInvoiceGrandTotal: number | null = null
    if (linkedInvoices) {
      if (Array.isArray(linkedInvoices) && linkedInvoices.length > 0) {
        linkedInvoiceGrandTotal = Number(linkedInvoices[0]?.grand_total)
      } else if (typeof linkedInvoices === 'object') {
        linkedInvoiceGrandTotal = Number((linkedInvoices as any)?.grand_total)
      }
      if (linkedInvoiceGrandTotal !== null && isNaN(linkedInvoiceGrandTotal)) {
        linkedInvoiceGrandTotal = null
      }
    }

    const normalize = (value: any) => {
      const num = Number(value)
      return Number.isFinite(num) ? Number(num.toFixed(2)) : null
    }

    const serverRoundedTotal =
      normalize(roundedTotalFromOrder) ??
      normalize(linkedInvoiceGrandTotal) ??
      normalize(grandTotalFromOrder)

    if (hasSavedOrder && serverRoundedTotal !== null && (isConfirmed || !isEdited)) {
      totalFinal = serverRoundedTotal
      roundingAdj = Number((serverRoundedTotal - totalRaw).toFixed(2))
    }

    return {
      untaxed: Number(untaxedSum.toFixed(2)),
      individualDiscount: Number(individualDiscountSum.toFixed(2)),
      globalDiscount: Number(globalDiscountAmount.toFixed(2)),
      vat: Number(vatCalc.toFixed(2)),
      rounding: roundingAdj,
      total: totalFinal
    }
  }, [
    items,
    globalDiscountPercent,
    isRoundingEnabled,
    currentTab?.orderData,
    currentTab?.purchaseOrderId,
    currentTab?.isEdited,
    vatPercentage
  ])

  const handleGlobalDiscountClick = () => {
    if (isReadOnly) return
    if (currentTab) {
      setIsEditingGlobalDiscount(true)
    }
  }

  const handleGlobalDiscountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value
    if (inputValue === '') {
      setGlobalDiscountValue('')
      return
    }
    const numValue = parseFloat(inputValue)
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
      setGlobalDiscountValue(inputValue)
    } else if (!isNaN(numValue) && numValue > 100) {
      setGlobalDiscountValue('100')
    }
  }

  const handleGlobalDiscountBlur = () => {
    if (currentTab) {
      let newValue = parseFloat(globalDiscountValue) || 0
      newValue = Math.max(0, Math.min(100, newValue))
      updateTabGlobalDiscount(currentTab.id, newValue)
      setTabEdited(currentTab.id, true)
      setIsEditingGlobalDiscount(false)
    }
  }

  const handleGlobalDiscountKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleGlobalDiscountBlur()
    } else if (e.key === 'Escape') {
      setGlobalDiscountValue(globalDiscountPercent.toString())
      setIsEditingGlobalDiscount(false)
    }
  }

  // Hotkey for global discount editing
  useHotkeys(
    'ctrl+d',
    () => {
      if (isReadOnly) return
      if (currentTab) {
        handleGlobalDiscountClick()
      }
    },
    { preventDefault: true, enableOnFormTags: true }
  )

  // Duplicate current order tab
  const handleDuplicate = () => {
    setShowDuplicateConfirm(true)
  }

  const handleConfirmDuplicate = () => {
    duplicateCurrentTab()
    setShowDuplicateConfirm(false)
  }

  // Hotkey: Ctrl+Shift+2
  useHotkeys(
    'ctrl+shift+2',
    () => handleDuplicate(),
    { preventDefault: true, enableOnFormTags: true }
  )

  return (
    <div className="p-2 pb-6 relative">
      <div className="flex gap-3 mb-2">
        <Button
          variant="outline"
          className="flex items-center gap-2"
          onClick={handleGlobalDiscountClick}
          disabled={isReadOnly || !currentTab?.id}
          title={isReadOnly ? 'Discount cannot be edited for confirmed orders' : 'Click to edit global discount percentage'}
        >
          <span className="text-blue-500">%</span>
          Discount
          <span className="text-xs bg-gray-200 px-1 rounded">Ctrl+D</span>
        </Button>
        <Button variant="outline" className="flex items-center gap-2" onClick={handleDuplicate}>
          <span className="text-slate-600">⎘</span>
          Duplicate
          <span className="text-xs bg-gray-200 px-1 rounded">Ctrl+Shift+2</span>
        </Button>
        {/* Paid and Outstanding amounts for confirmed orders */}
        {currentTab?.orderData && Number(currentTab.orderData.docstatus) === 1 && (paidAmount !== null || outstandingAmount !== null) && (
          <>
            {paidAmount !== null && (
              <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md bg-green-50">
                <span className="text-xs text-gray-600 font-medium">Paid:</span>
                <span className="text-sm font-semibold text-green-700">
                  {currencySymbol} {paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
            {outstandingAmount !== null && (
              <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md bg-orange-50">
                <span className="text-xs text-gray-600 font-medium">Outstanding:</span>
                <span className="text-sm font-semibold text-orange-700">
                  {currencySymbol} {outstandingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </>
        )}

        <div className="ml-auto w-[235px]">
          <Button
            onClick={() => {
              if (!isReadOnly) {
                if (!currentTab?.id) {
                  toast.error('No active tab. Please create a new purchase order first.')
                  return
                }
                setShowSupplierModal(true)
              }
            }}
            disabled={isReadOnly}
            className={`w-full p-1.5 h-[38px] bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 transition-all text-left flex items-center gap-2 overflow-hidden ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''
              }`}
            variant="ghost"
          >
            <div className="flex-shrink-0 h-7 w-7 bg-gray-100 rounded-full flex items-center justify-center border border-gray-200">
              <User className="h-4 w-4 text-gray-500" />
            </div>
            <div className="flex flex-col items-start justify-center overflow-hidden w-full h-full">
              <span className={`font-bold text-xs truncate w-full leading-tight ${!selectedSupplier?.name ? 'text-gray-400' : 'text-gray-900'}`}>
                {!selectedSupplier?.name ? 'Select Supplier' : selectedSupplier.name}
              </span>

              {selectedSupplier?.name && (
                <div className="flex items-center gap-2 w-full mt-[0px]">
                  {selectedSupplier?.tax_id && (
                    <span className="text-[9px] text-gray-500 truncate leading-none">
                      VAT: <span className="font-medium text-gray-700">{selectedSupplier.tax_id}</span>
                    </span>
                  )}
                  {selectedSupplier?.mobile_no && (
                    <span className="text-[9px] text-gray-500 truncate leading-none">
                      Mob: <span className="font-medium text-gray-700">{selectedSupplier.mobile_no}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-3 items-end text-sm">
        <div className="text-center">
          <div className="text-xs text-gray-600">Untaxed</div>
          <div className="text-base font-semibold">
            {currencySymbol} {untaxed.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-600">Discount</div>
          {isEditingGlobalDiscount ? (
            <Input
              ref={globalDiscountRef}
              type="number"
              value={globalDiscountValue}
              onChange={handleGlobalDiscountChange}
              onBlur={handleGlobalDiscountBlur}
              onKeyDown={handleGlobalDiscountKeyDown}
              disabled={isReadOnly}
              className={`text-center text-base font-semibold w-16 h-8 mx-auto ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
              placeholder="0"
              min="0"
              max="100"
              step="0.1"
            />
          ) : (
            <div
              className={`text-base font-semibold text-blue-600 px-1 rounded flex flex-col items-center justify-center ${isReadOnly ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-gray-100'
                }`}
              onClick={handleGlobalDiscountClick}
              title={isReadOnly ? 'Discount cannot be edited for confirmed orders' : 'Click to edit global discount percentage'}
            >
              <div>{currencySymbol} {globalDiscount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              {globalDiscountPercent > 0 && (
                <div className="text-[10px] text-gray-500">({globalDiscountPercent}%)</div>
              )}
            </div>
          )}
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-600">VAT ({vatPercentage}%)</div>
          <div className="text-base font-semibold text-red-600">
            {currencySymbol} {vat.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div
          className={`text-center rounded p-1 ${isReadOnly ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-gray-50'
            }`}
          onClick={() => handleRoundingChange(!isRoundingEnabled)}
          title={isReadOnly ? 'Rounding cannot be changed for confirmed orders' : 'Click to toggle rounding'}
        >
          <div className="text-xs text-gray-600 flex items-center justify-center gap-1">
            Rounding
            <div className={`w-2 h-2 rounded-full ${isRoundingEnabled ? 'bg-green-500' : 'bg-gray-300'}`} />
          </div>
          <div className={`text-base font-semibold ${rounding !== 0 ? 'text-orange-600' : 'text-gray-900'} ${!isRoundingEnabled ? 'opacity-50' : ''}`}>
            {currencySymbol} {Math.abs(rounding).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="text-center bg-gradient-to-r from-primary to-slate-700 text-white p-2 rounded shadow-sm">
          <div className="text-xs text-white/80 font-bold">Total</div>
          <div className="text-lg font-bold text-white">
            {currencySymbol} {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Duplicate Confirmation Dialog */}
      <Dialog open={showDuplicateConfirm} onOpenChange={setShowDuplicateConfirm}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Duplicate Purchase Order</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>Are you sure you want to duplicate the current purchase order?</p>
            <p className="text-sm text-gray-500 mt-2">This will create a new tab with the same items.</p>
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              ref={duplicateCancelBtnRef}
              variant="outline"
              onClick={() => setShowDuplicateConfirm(false)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight') duplicateConfirmBtnRef.current?.focus()
              }}
            >
              Cancel
            </Button>
            <Button
              ref={duplicateConfirmBtnRef}
              onClick={handleConfirmDuplicate}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') duplicateCancelBtnRef.current?.focus()
              }}
            >
              Duplicate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bottom Error Box */}
      {errors.length > 0 && (
        <BottomErrorBox
          errors={errors}
          isVisible={true}
          onClose={() => onCloseErrors?.()}
          onFocusChange={onErrorBoxFocusChange}
          onFocusItem={onFocusItem}
        />
      )}

      {/* Supplier Search Modal */}
      <SupplierModal
        open={showSupplierModal}
        onClose={() => setShowSupplierModal(false)}
        onSelect={handleSupplierSelect}
      />
    </div>
  )
}

export default PurchaseDiscountSection

