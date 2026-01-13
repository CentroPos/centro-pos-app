import { Button } from '@renderer/components/ui/button'
import { User } from 'lucide-react'
import { Input } from '@renderer/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@renderer/components/ui/dialog'
import { useMemo, useState, useRef, useEffect } from 'react'
import { usePOSTabStore } from '@renderer/store/usePOSTabStore'
import { usePOSProfileStore } from '@renderer/store/usePOSProfileStore'
import { useHotkeys } from 'react-hotkeys-hook'
import BottomErrorBox from '../common/bottom-error-box'
// import BottomZatcaBox from '../common/bottom-zatca-box'
import CustomerSearchModal from '../customer/customer-modal'
import { toast } from 'sonner'

interface ErrorMessage {
  message: string
  title: string
  indicator: string
  itemCode: string
}

interface ZatcaResponse {
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
}

type Props = {
  errors?: ErrorMessage[]
  onCloseErrors?: () => void
  onErrorBoxFocusChange?: (isFocused: boolean) => void
  onFocusItem?: (itemCode: string, idx?: number) => void
  zatcaResponses?: ZatcaResponse[]
  onCloseZatcaResponses?: () => void
  onZatcaBoxFocusChange?: (isFocused: boolean) => void
  forceOpenCustomerModal?: boolean
  onCustomerModalChange?: (isOpen: boolean) => void
  onCustomerSelect?: (customer: any) => void
}

function roundToNearest(value: number, step = 0.05) {
  const rounded = Math.round(value / step) * step
  return Number(rounded.toFixed(2))
}

const DiscountSection: React.FC<Props> = ({
  errors = [],
  onCloseErrors,
  onErrorBoxFocusChange,
  onFocusItem,
  // zatcaResponses = [],
  // onCloseZatcaResponses,
  // onZatcaBoxFocusChange,
  forceOpenCustomerModal,
  onCustomerModalChange,
  onCustomerSelect
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
    getCurrentTabCustomer,
    updateTabCustomer,
    activeTabId,
    updateTabOrderData
  } = usePOSTabStore()
  const { profile } = usePOSProfileStore()
  const items = getCurrentTabItems()
  const currentTab = getCurrentTab()
  const selectedCustomer = getCurrentTabCustomer()
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
  const [showCustomerModal, setShowCustomerModal] = useState(false)

  // Check if order is confirmed/paid/read-only
  const isReadOnly = currentTab?.status === 'confirmed' || currentTab?.status === 'paid' ||
    (currentTab?.orderData && Number(currentTab.orderData.docstatus) === 1)

  const handleCustomerSelect = async (customer: any) => {
    if (!activeTabId) {
      toast.error('No active tab. Please create a new order first.')
      setShowCustomerModal(false)
      return
    }
    if (activeTabId) {
      updateTabCustomer(activeTabId, customer)
      setTabEdited(activeTabId, true)
    }
    setShowCustomerModal(false)

    // Notify parent
    onCustomerSelect?.(customer)

    // Sync Price List Logic (Migrated from OrderDetails)
    let resolvedDefault: string | undefined = customer?.default_price_list
    if (!resolvedDefault && customer?.customer_id) {
      try {
        // We won't log extensively here to keep it clean, but logic remains same
        const resp = await window.electronAPI?.proxy?.request({
          method: 'GET',
          url: '/api/method/centro_pos_apis.api.customer.get_customer_details',
          params: { customer_id: customer.customer_id }
        })
        resolvedDefault = resp?.data?.data?.default_price_list
      } catch (e) {
        console.warn('⚠️ Failed fetching customer default_price_list', e)
      }
    }
    const nextPriceListRaw = resolvedDefault || profile?.selling_price_list
    const nextPriceList = typeof nextPriceListRaw === 'string' ? nextPriceListRaw.trim() : nextPriceListRaw

    if (nextPriceList) {
      // We update the order data with the new price list if we have a tab
      // Note: DiscountSection doesn't hold 'selectedPriceList' state like OrderDetails did, 
      // but we should update the tab's order data so that backend gets it.
      // However, 'updateTabOrderData' might be needed.
      if (currentTab?.orderData) {
        updateTabOrderData(activeTabId, { ...currentTab.orderData, price_list: nextPriceList })
      }
    }
  }

  // Sync local state with store
  useEffect(() => {
    setIsRoundingEnabled(isRoundingEnabledFromStore)
  }, [isRoundingEnabledFromStore])

  // Update store when rounding changes
  const handleRoundingChange = (enabled: boolean) => {
    setIsRoundingEnabled(enabled)
    if (currentTab) {
      updateTabRoundingEnabled(currentTab.id, enabled)
      // Mark tab as edited when rounding changes
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

        // Extract currency symbol
        if (profileData.custom_currency_symbol) {
          setCurrencySymbol(profileData.custom_currency_symbol)
        }

        // Extract VAT percentage from custom_tax_rate
        if (profileData.custom_tax_rate !== null && profileData.custom_tax_rate !== undefined) {
          const vatValue = Number(profileData.custom_tax_rate)
          if (!isNaN(vatValue) && vatValue >= 0) {
            setVatPercentage(vatValue)
          }
        }
      }
    } catch (error) {
      console.error('📋 Error loading POS profile in DiscountSection:', error)
    }
  }

  // Load POS profile on component mount
  useEffect(() => {
    loadPOSProfile()
  }, [])

  // Sync local state with external forceOpen prop
  useEffect(() => {
    if (forceOpenCustomerModal) {
      setShowCustomerModal(true)
    }
  }, [forceOpenCustomerModal])

  // Notify parent when modal state changes
  useEffect(() => {
    onCustomerModalChange?.(showCustomerModal)
  }, [showCustomerModal, onCustomerModalChange])

  // Initialize global discount value
  useEffect(() => {
    setGlobalDiscountValue(globalDiscountPercent.toString())
  }, [globalDiscountPercent])

  // Extract paid_amount and outstanding_amount from linked_invoices when docstatus is 1
  const { paidAmount, outstandingAmount } = useMemo(() => {
    const isConfirmed = currentTab?.orderData && Number(currentTab.orderData.docstatus) === 1
    const linkedInvoices = currentTab?.orderData?.linked_invoices

    if (isConfirmed && linkedInvoices) {
      let paid = null
      let outstanding = null

      // Handle linked_invoices as array or object
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

  // Status Ribbon Logic
  // const ribbonClipPath = 'polygon(12% 0%, 88% 0%, 100% 50%, 88% 100%, 12% 100%, 0% 50%)' // Removed as requested

  // Get main_status and sub_status from order detail API
  const mainStatus = currentTab?.orderData?.main_status || null
  const subStatus = currentTab?.orderData?.sub_status || null

  // Get zatca_status from order detail API
  const zatcaStatus = currentTab?.orderData?.zatca_status || null

  // Check if statuses should be displayed (hide if null, undefined, empty, or 'N/A')
  const shouldShowOrderStatus = mainStatus && mainStatus !== 'N/A' && String(mainStatus).trim() !== ''
  const shouldShowZatcaStatus = zatcaStatus && zatcaStatus !== 'N/A' && String(zatcaStatus).trim() !== ''

  // Get status colors from order detail API - default to yellow (golden) if null/missing
  const statusColor = currentTab?.orderData?.status_color || 'yellow'
  const zatcaColor = currentTab?.orderData?.zatca_color || 'yellow'

  const getStatusRibbonStyle = (color: string) => {
    const colorMap: { [key: string]: string } = {
      grey: 'from-gray-400 to-gray-500',
      green: 'from-green-400 to-green-500',
      yellow: 'from-amber-400 to-orange-400',
      red: 'from-red-400 to-red-500'
    }
    return colorMap[color.toLowerCase()] || colorMap.yellow
  }

  const getZatcaRibbonStyle = (color: string) => {
    const colorMap: { [key: string]: string } = {
      green: 'from-green-400 to-green-500',
      red: 'from-red-400 to-red-500',
      yellow: 'from-amber-400 to-orange-400'
    }
    return colorMap[color.toLowerCase()] || colorMap.green
  }

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

    // Net amount after individual discounts (before VAT)
    const netAfterIndividualDiscount = untaxedSum - individualDiscountSum

    // Apply global discount to net amount (before VAT) - ZATCA compliant
    const globalDiscountAmount = (netAfterIndividualDiscount * globalDiscountPercent) / 100
    const netAfterGlobalDiscount = netAfterIndividualDiscount - globalDiscountAmount

    // Calculate VAT on the globally discounted net amount
    const vatCalc = netAfterGlobalDiscount * (vatPercentage / 100) // Dynamic VAT on discounted amount

    // Final total = discounted net amount + VAT
    const totalRaw = netAfterGlobalDiscount + vatCalc
    const totalRoundedCandidate = roundToNearest(totalRaw, 0.05)
    const roundingCandidate = Number((totalRoundedCandidate - totalRaw).toFixed(2))

    const useRounding = isRoundingEnabled
    let totalFinal = useRounding ? totalRoundedCandidate : Number(totalRaw.toFixed(2))
    let roundingAdj = useRounding ? roundingCandidate : 0

    // Prefer final_total returned from backend once the order exists
    // For confirmed orders (docstatus = 1), always use API value
    // For draft orders (docstatus != 1):
    //   - If not edited (just saved), use API value
    //   - If edited (user making changes), use real-time calculation
    const hasSavedOrder = Boolean(currentTab?.orderId)
    const docstatus = currentTab?.orderData ? Number(currentTab.orderData.docstatus) : null
    const isConfirmed = docstatus === 1
    const isEdited = currentTab?.isEdited ?? false

    const roundedTotalFromOrder = currentTab?.orderData?.final_total
    const grandTotalFromOrder = currentTab?.orderData?.grand_total

    // For confirmed orders, we may also have grand_total inside linked invoices
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

    // Use API value if:
    // 1. Order is confirmed (docstatus = 1), OR
    // 2. Order is saved and not edited (just saved/updated)
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
    currentTab?.orderId,
    currentTab?.isEdited,
    vatPercentage
  ])

  const handleGlobalDiscountClick = () => {
    if (currentTab) {
      setIsEditingGlobalDiscount(true)
    }
  }

  const handleGlobalDiscountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value
    // Allow empty string for clearing the field
    if (inputValue === '') {
      setGlobalDiscountValue('')
      return
    }
    const numValue = parseFloat(inputValue)
    // Only accept values in range 0-100
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
      setGlobalDiscountValue(inputValue)
    } else if (!isNaN(numValue) && numValue > 100) {
      // Cap at 100 if user tries to enter more
      setGlobalDiscountValue('100')
    }
  }

  const handleGlobalDiscountBlur = () => {
    if (currentTab) {
      let newValue = parseFloat(globalDiscountValue) || 0
      // Clamp value to 0-100 range
      newValue = Math.max(0, Math.min(100, newValue))

      updateTabGlobalDiscount(currentTab.id, newValue)
      setTabEdited(currentTab.id, true) // Mark tab as edited when global discount changes
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

  // Handle confirmed duplicate
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
        <Button variant="outline" className="flex items-center gap-2">
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

        {/* Status Indicators - Redesigned as buttons */}
        {(shouldShowOrderStatus || shouldShowZatcaStatus) && (
          <div className="flex items-center gap-2 ml-2">
            {/* Order Status Badge */}
            {shouldShowOrderStatus && (
              <div
                className={`flex flex-col items-center justify-center px-4 py-1 rounded-md shadow-sm border border-white/20 bg-gradient-to-r ${getStatusRibbonStyle(statusColor)} text-white`}
                style={{ height: '38px', minWidth: '100px' }}
              >
                <div className="text-[11px] font-bold uppercase tracking-wide leading-none">{mainStatus}</div>
                {subStatus && subStatus !== 'N/A' && String(subStatus).trim() !== '' && (
                  <div className="text-[9px] font-medium opacity-90 leading-none mt-[2px]">{subStatus}</div>
                )}
              </div>
            )}

            {/* Zatca Status Badge */}
            {shouldShowZatcaStatus && (
              <div
                className={`flex items-center justify-center px-4 py-1 rounded-md shadow-sm border border-white/20 bg-gradient-to-r ${getZatcaRibbonStyle(zatcaColor)} text-white`}
                style={{ height: '38px', minWidth: '100px' }}
              ><div className="text-[10px] uppercase tracking-wide">ZATCA</div> &nbsp;&nbsp;&nbsp;
                <div className="text-[10px] font-bold uppercase tracking-wide">{zatcaStatus}</div>
              </div>
            )}
          </div>
        )}

        <div className="ml-auto w-[235px]">
          <Button
            onClick={() => {
              if (!isReadOnly) {
                if (!currentTab?.id) {
                  toast.error('No active tab. Please create a new order first.')
                  return
                }
                setShowCustomerModal(true)
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
              <span className={`font-bold text-xs truncate w-full leading-tight ${!selectedCustomer?.name ? 'text-gray-400' : 'text-gray-900'}`}>
                {!selectedCustomer?.name ? 'Select Customer' : selectedCustomer.name}
              </span>

              {selectedCustomer?.name && (
                <div className="flex items-center gap-2 w-full mt-[0px]">
                  {(selectedCustomer as any)?.tax_id && (
                    <span className="text-[9px] text-gray-500 truncate leading-none">
                      VAT: <span className="font-medium text-gray-700">{(selectedCustomer as any).tax_id}</span>
                    </span>
                  )}
                  {(selectedCustomer as any)?.mobile_no && (
                    <span className="text-[9px] text-gray-500 truncate leading-none">
                      Mob: <span className="font-medium text-gray-700">{(selectedCustomer as any).mobile_no}</span>
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
              className="text-center text-base font-semibold w-16 h-8 mx-auto"
              placeholder="0"
              min="0"
              max="100"
              step="0.1"
            />
          ) : (
            <div
              className="text-base font-semibold text-blue-600 cursor-pointer hover:bg-gray-100 px-1 rounded flex flex-col items-center justify-center"
              onClick={handleGlobalDiscountClick}
              title="Click to edit global discount percentage"
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
        <div className="text-center cursor-pointer hover:bg-gray-50 rounded p-1" onClick={() => handleRoundingChange(!isRoundingEnabled)}>
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

      {/* Global Discount editing is now inline - no dialog needed */}

      {/* Duplicate Confirmation Dialog */}
      <Dialog open={showDuplicateConfirm} onOpenChange={setShowDuplicateConfirm}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Duplicate Order</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>Are you sure you want to duplicate the current order?</p>
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

      {/* Bottom Zatca Box */}
      {/* {zatcaResponses.length > 0 && (
        <BottomZatcaBox
          zatcaResponses={zatcaResponses}
          isVisible={true}
          onClose={() => onCloseZatcaResponses?.()}
          onFocusChange={onZatcaBoxFocusChange}
        />
      )} */}

      {/* Customer Search Modal */}
      <CustomerSearchModal
        open={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
        onSelect={handleCustomerSelect}
      />
    </div>
  )
}

export default DiscountSection
