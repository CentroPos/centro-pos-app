import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { useMemo, useState, useRef, useEffect } from 'react'
import { usePOSTabStore } from '@renderer/store/usePOSTabStore'
import { useHotkeys } from 'react-hotkeys-hook'

type Props = unknown

function roundToNearest(value: number, step = 0.05) {
  const rounded = Math.round(value / step) * step
  return Number(rounded.toFixed(2))
}

const DiscountSection: React.FC<Props> = () => {
  const { getCurrentTabItems, getCurrentTabGlobalDiscount, updateTabGlobalDiscount, getCurrentTab } = usePOSTabStore()
  const items = getCurrentTabItems()
  const currentTab = getCurrentTab()
  const globalDiscountPercent = getCurrentTabGlobalDiscount()
  
  const [isEditingGlobalDiscount, setIsEditingGlobalDiscount] = useState(false)
  const [globalDiscountValue, setGlobalDiscountValue] = useState('')
  const globalDiscountRef = useRef<HTMLInputElement>(null)

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingGlobalDiscount && globalDiscountRef.current) {
      globalDiscountRef.current.focus()
      globalDiscountRef.current.select()
    }
  }, [isEditingGlobalDiscount])

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
    const vatCalc = netAfterGlobalDiscount * 0.1 // 10% VAT on discounted amount
    
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
  useHotkeys('ctrl+d', () => {
    if (currentTab) {
      handleGlobalDiscountClick()
    }
  }, { preventDefault: true, enableOnFormTags: true })

  return (
    <div className="p-4">
      <div className="flex gap-4 mb-4">
        <Button variant="outline" className="flex items-center gap-2">
          <span className="text-blue-500">%</span>
          Discount
          <span className="text-xs bg-gray-200 px-1 rounded">Ctrl+D</span>
        </Button>
        <Button variant="outline" className="flex items-center gap-2">
          <span className="text-green-500">$</span>
          Offer
          <span className="text-xs bg-gray-200 px-1 rounded">Ctrl+O</span>
        </Button>
        <Button variant="outline" className="flex items-center gap-2">
          <span className="text-orange-500">%</span>
          Commission
          <span className="text-xs bg-gray-200 px-1 rounded">Ctrl+C</span>
        </Button>
      </div>

      <div className="grid grid-cols-5 gap-4 items-end">
        <div className="text-center">
          <div className="text-sm text-gray-600">Untaxed</div>
          <div className="text-lg font-semibold">${untaxed.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="text-center">
          <div className="text-sm text-gray-600">Discount</div>
          {isEditingGlobalDiscount ? (
            <Input
              ref={globalDiscountRef}
              type="number"
              value={globalDiscountValue}
              onChange={handleGlobalDiscountChange}
              onBlur={handleGlobalDiscountBlur}
              onKeyDown={handleGlobalDiscountKeyDown}
              className="text-center text-lg font-semibold w-20"
              placeholder="0"
              min="0"
              max="100"
              step="0.1"
            />
          ) : (
            <div 
              className="text-lg font-semibold text-red-500 cursor-pointer hover:bg-gray-100 p-1 rounded"
              onClick={handleGlobalDiscountClick}
              title="Click to edit global discount percentage"
            >
              -${globalDiscount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              {globalDiscountPercent > 0 && (
                <div className="text-xs text-gray-500">({globalDiscountPercent}%)</div>
              )}
            </div>
          )}
        </div>
        <div className="text-center">
          <div className="text-sm text-gray-600">VAT (10%)</div>
          <div className="text-lg font-semibold">${vat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="text-center">
          <div className="text-sm text-gray-600">Rounding</div>
          <div className="text-lg font-semibold">${rounding.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="text-center">
          <div className="text-sm text-white bg-gray-800 p-2 rounded">
            <div className="text-sm">Total</div>
            <div className="text-xl font-bold">${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DiscountSection
