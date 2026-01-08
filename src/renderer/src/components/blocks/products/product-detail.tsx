import { Card, CardContent } from '@renderer/components/ui/card'
import { Separator } from '@renderer/components/ui/separator'
import { useState, useEffect } from 'react'

type Props = {
  selectedProduct: string
}

const ProductDetail: React.FC<Props> = () => {
  const [currencySymbol, setCurrencySymbol] = useState('$')

  // Load POS profile data
  useEffect(() => {
    const loadPOSProfile = async () => {
      try {
        const response = await window.electronAPI?.proxy?.request({
          url: '/api/method/centro_pos_apis.api.profile.get_pos_profile'
        })
        
        if (response?.data?.data?.custom_currency_symbol) {
          setCurrencySymbol(response.data.data.custom_currency_symbol)
        }
      } catch (error) {
        console.error('Error loading POS profile in ProductDetail:', error)
      }
    }

    loadPOSProfile()
  }, [])

  return (
  <Card className="h-full">
    <CardContent className="p-4 space-y-4">
      <div className="text-center">
        <div className="w-16 h-16 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg mx-auto mb-2">
          S24
        </div>
        <h3 className="font-semibold">SGS24-256</h3>
        <p className="text-sm text-gray-600">Samsung Galaxy S24</p>
        <p className="text-xs text-gray-500">Category: Smartphones</p>
        <p className="text-xs text-gray-500">Location: Rack A-15, Shelf 3</p>
      </div>

      <Separator />

      <div>
        <h4 className="font-semibold mb-2">Pricing & Stock</h4>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm">Unit Price</span>
            <span className="text-sm">On Hand</span>
          </div>
          <div className="flex justify-between">
            <span className="text-blue-600 font-medium">{currencySymbol} 799.00</span>
            <span className="text-red-500 font-medium">3 units</span>
          </div>

          <div className="flex justify-between mt-4">
            <span className="text-sm">Cost</span>
            <span className="text-sm">Margin</span>
          </div>
          <div className="flex justify-between">
            <span className="text-orange-600 font-medium">{currencySymbol} 650.00</span>
            <span className="text-purple-600 font-medium">18.6%</span>
          </div>
        </div>
      </div>

      <Separator />

      <div>
        <h4 className="font-semibold mb-2">Customer&apos;s History</h4>
        <p className="text-xs text-gray-600 mb-2">Previous purchases of Samsung Galaxy S24</p>
        <div className="flex justify-between text-sm">
          <span>POS-2024-892</span>
          <span className="text-gray-500">Dec 15, 2024</span>
        </div>
      </div>

      <Separator />

      <div>
        <h4 className="font-semibold mb-2">Most Ordered</h4>
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <div>
              <div className="font-medium">iPhone 15 Pro</div>
              <div className="text-xs text-gray-500">IPH15-PRO</div>
            </div>
            <div className="text-right">
              <div className="font-medium">15 units</div>
              <div className="text-xs text-gray-500">{currencySymbol} 13,485</div>
            </div>
          </div>
          <div className="flex justify-between items-center text-sm">
            <div>
              <div className="font-medium">Galaxy S24</div>
              <div className="text-xs text-gray-500">SGS24-256</div>
            </div>
            <div className="text-right">
              <div className="font-medium">12 units</div>
              <div className="text-xs text-gray-500">{currencySymbol} 9,588</div>
            </div>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
  )
}

export default ProductDetail
