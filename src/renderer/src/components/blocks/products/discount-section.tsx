import { Button } from '@renderer/components/ui/button'
import { useMemo } from 'react'
import { usePOSTabStore } from '@renderer/store/usePOSTabStore'

type Props = unknown

function roundToNearest(value: number, step = 0.05) {
  const rounded = Math.round(value / step) * step
  return Number(rounded.toFixed(2))
}

const DiscountSection: React.FC<Props> = () => {
  const { getCurrentTabItems } = usePOSTabStore()
  const items = getCurrentTabItems()

  const { untaxed, discount, vat, rounding, total } = useMemo(() => {
    const untaxedSum = items.reduce((sum: number, it: any) => {
      const qty = Number(it.quantity || 0)
      const rate = Number(it.standard_rate || 0)
      return sum + qty * rate
    }, 0)

    const discountSum = items.reduce((sum: number, it: any) => {
      const qty = Number(it.quantity || 0)
      const rate = Number(it.standard_rate || 0)
      const disc = Number(it.discount_percentage || 0)
      return sum + (qty * rate * disc) / 100
    }, 0)

    const net = untaxedSum - discountSum
    const vatCalc = net * 0.1 // 10%
    const totalRaw = net + vatCalc
    const totalRounded = roundToNearest(totalRaw, 0.05)
    const roundingAdj = Number((totalRounded - totalRaw).toFixed(2))

    return {
      untaxed: Number(untaxedSum.toFixed(2)),
      discount: Number(discountSum.toFixed(2)),
      vat: Number(vatCalc.toFixed(2)),
      rounding: roundingAdj,
      total: totalRounded
    }
  }, [items])

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
          <div className="text-lg font-semibold text-red-500">-${discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
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
