import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { useMemo, useState, useRef, useEffect } from 'react'
import { usePOSTabStore } from '@renderer/store/usePOSTabStore'
import { useHotkeys } from 'react-hotkeys-hook'
import BottomErrorBox from '../common/bottom-error-box'

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
  onFocusItem?: (itemCode: string) => void
}

function roundToNearest(value: number, step = 0.05) {
  const rounded = Math.round(value / step) * step
  return Number(rounded.toFixed(2))
}

const DiscountSection: React.FC<Props> = ({
  errors = [],
  onCloseErrors,
  onErrorBoxFocusChange,
  onFocusItem
}) => {
  const {
    getCurrentTabItems,
    getCurrentTabGlobalDiscount,
    updateTabGlobalDiscount,
    getCurrentTab,
    setTabEdited
  } = usePOSTabStore()
  const items = getCurrentTabItems()
  const currentTab = getCurrentTab()
  const globalDiscountPercent = getCurrentTabGlobalDiscount()

  const [isEditingGlobalDiscount, setIsEditingGlobalDiscount] = useState(false)
  const [globalDiscountValue, setGlobalDiscountValue] = useState('')
  const globalDiscountRef = useRef<HTMLInputElement>(null)
  const [currencySymbol, setCurrencySymbol] = useState('$')
  const [vatPercentage, setVatPercentage] = useState(10)

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
      console.log('📋 Loading POS profile in DiscountSection...')
      const response = await window.electronAPI.proxy.request({
        url: '/api/method/centro_pos_apis.api.profile.get_pos_profile'
      })

      console.log('📋 POS profile API response in DiscountSection:', response)

      if (response?.data?.data) {
        const profileData = response.data.data

        // Extract currency symbol
        if (profileData.custom_currency_symbol) {
          console.log(
            '💰 Currency symbol from profile in DiscountSection:',
            profileData.custom_currency_symbol
          )
          setCurrencySymbol(profileData.custom_currency_symbol)
        }

        // Extract VAT percentage from taxes_and_charges
        if (profileData.taxes_and_charges) {
          const vatMatch = profileData.taxes_and_charges.match(/(\d+)%/)
          if (vatMatch) {
            const vatValue = parseInt(vatMatch[1])
            console.log('📊 VAT percentage from profile in DiscountSection:', vatValue)
            setVatPercentage(vatValue)
          }
        }

        console.log('✅ Successfully loaded POS profile data in DiscountSection')
      }
    } catch (error) {
      console.error('📋 Error loading POS profile in DiscountSection:', error)
    }
  }

  // Load POS profile on component mount
  useEffect(() => {
    loadPOSProfile()
  }, [])

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

    // Net amount after individual discounts (before VAT)
    const netAfterIndividualDiscount = untaxedSum - individualDiscountSum

    // Apply global discount to net amount (before VAT) - ZATCA compliant
    const globalDiscountAmount = (netAfterIndividualDiscount * globalDiscountPercent) / 100
    const netAfterGlobalDiscount = netAfterIndividualDiscount - globalDiscountAmount

    // Calculate VAT on the globally discounted net amount
    const vatCalc = netAfterGlobalDiscount * (vatPercentage / 100) // Dynamic VAT on discounted amount

    // Final total = discounted net amount + VAT
    const totalRaw = netAfterGlobalDiscount + vatCalc
    const totalRounded = roundToNearest(totalRaw, 0.05)
    const roundingAdj = Number((totalRounded - totalRaw).toFixed(2))

    return {
      untaxed: Number(untaxedSum.toFixed(2)),
      individualDiscount: Number(individualDiscountSum.toFixed(2)),
      globalDiscount: Number(globalDiscountAmount.toFixed(2)),
      vat: Number(vatCalc.toFixed(2)),
      rounding: roundingAdj,
      total: totalRounded
    }
  }, [items, globalDiscountPercent])

  const handleGlobalDiscountClick = () => {
    if (currentTab) {
      setIsEditingGlobalDiscount(true)
    }
  }

  const handleGlobalDiscountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGlobalDiscountValue(e.target.value)
  }

  const handleGlobalDiscountBlur = () => {
    if (currentTab) {
      const newValue = parseFloat(globalDiscountValue) || 0
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

  return (
    <div className="p-2">
      <div className="flex gap-3 mb-2">
        <Button variant="outline" className="flex items-center gap-2">
          <span className="text-blue-500">%</span>
          Discount
          <span className="text-xs bg-gray-200 px-1 rounded">Ctrl+D</span>
        </Button>
        <Button variant="outline" className="flex items-center gap-2">
          <span className="text-green-500">{currencySymbol}</span>
          Offer
          <span className="text-xs bg-gray-200 px-1 rounded">Ctrl+O</span>
        </Button>
        <Button variant="outline" className="flex items-center gap-2">
          <span className="text-orange-500">%</span>
          Commission
          <span className="text-xs bg-gray-200 px-1 rounded">Ctrl+C</span>
        </Button>
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
              className="text-center text-base font-semibold w-16 h-8"
              placeholder="0"
              min="0"
              max="100"
              step="0.1"
            />
          ) : (
            <div
              className="text-base font-semibold text-red-500 cursor-pointer hover:bg-gray-100 px-1 rounded"
              onClick={handleGlobalDiscountClick}
              title="Click to edit global discount percentage"
            >
              -{currencySymbol} {globalDiscount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              {globalDiscountPercent > 0 && (
                <div className="text-[10px] text-gray-500">({globalDiscountPercent}%)</div>
              )}
            </div>
          )}
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-600">VAT ({vatPercentage}%)</div>
          <div className="text-base font-semibold">
            {currencySymbol} {vat.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-600">Rounding</div>
          <div className="text-base font-semibold">
            {currencySymbol} {rounding.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-white bg-gray-800 p-2 rounded">
            <div className="text-xs">Total</div>
            <div className="text-lg font-bold">
              {currencySymbol} {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Error Box */}
      {errors.length > 0 && (
        <BottomErrorBox
          errors={errors}
          isVisible={errors.length > 0}
          onClose={onCloseErrors || (() => {})}
          onFocusChange={onErrorBoxFocusChange}
          onFocusItem={onFocusItem}
        />
      )}
    </div>
  )
}

export default DiscountSection
