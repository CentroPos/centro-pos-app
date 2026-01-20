import React, { useEffect, useState } from 'react'
import { usePOSTabStore } from '@renderer/store/usePOSTabStore'
import { toast } from 'sonner'
import { Sparkles, CheckCircle2, AlertCircle, X } from 'lucide-react'

interface ItemOffer {
  uom: string
  offer_rate: number
  allow_all_uoms: number | boolean
  max_selling_qty: number
  total_available_offer_qty: number
  conversion_factor: number
  source: string
}

interface ItemOffersResponse {
  status?: string
  offers?: ItemOffer[]
}

interface ItemOffersProps {
  itemCode?: string
  selectedItem?: any // Current item from items array
}

const ItemOffers: React.FC<ItemOffersProps> = ({ itemCode, selectedItem }) => {
  const [data, setData] = useState<ItemOffersResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { activeTabId, updateItemInTabByIndex, getCurrentTab } = usePOSTabStore()

  useEffect(() => {
    if (!itemCode) {
      setData(null)
      setError(null)
      return
    }

    const fetchOffers = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await window.electronAPI?.proxy.request({
          url: '/api/method/centro_pos_apis.api.product.get_item_offer',
          method: 'GET',
          params: { item_code: itemCode }
        })

        const apiData = res?.data?.data as ItemOffersResponse | undefined

        if (apiData && Array.isArray(apiData.offers) && apiData.offers.length > 0) {
          setData(apiData)
        } else {
          setData({ status: apiData?.status, offers: [] })
        }
      } catch (err) {
        console.error('Failed to fetch item offers', err)
        setError('Could not load item offers')
        setData(null)
      } finally {
        setLoading(false)
      }
    }

    fetchOffers()
  }, [itemCode])

  if (!itemCode) return null

  return (
    <div className="p-4 border-b border-gray-200/60 bg-white/90">
      <h4 className="font-bold text-gray-800 mb-3">Item Offers</h4>

      {loading && (
        <div className="text-xs text-gray-500">Loading offers...</div>
      )}

      {!loading && error && (
        <div className="text-xs text-red-500">{error}</div>
      )}

      {!loading && !error && (!data || !data.offers || data.offers.length === 0) && (
        <div className="text-xs text-gray-500 italic">No active offers for this item.</div>
      )}

      {!loading && !error && data && data.offers && data.offers.length > 0 && (
        <div className="space-y-2">
          {data.offers.map((offer, idx) => {
            const currentQty = Number(selectedItem?.quantity || 0)
            const maxQty = Number(offer.max_selling_qty || 0)
            const availableQty = Number(offer.total_available_offer_qty || 0)
            const offerRate = Number(offer.offer_rate || 0)
            
            // Check if offer can be applied:
            // 1. total_available_offer_qty > 0
            // 2. quantity <= max_selling_qty OR (available < max AND quantity <= max AND quantity > available)
            const canApply = availableQty > 0 && (
              currentQty <= maxQty || 
              (availableQty < maxQty && currentQty > availableQty && currentQty <= maxQty)
            )
            
            // Check if offer is already applied
            const isApplied = selectedItem?.is_offer_applied === 1 && 
                              Number(selectedItem?.standard_rate || 0) === offerRate
            
            const handleApplyOffer = () => {
              if (!activeTabId || !itemCode || !canApply) {
                if (!canApply) {
                  toast.error(`Cannot apply offer: Quantity ${currentQty} exceeds max selling quantity ${maxQty} or offer is not available`)
                }
                return
              }
              
              const currentTab = getCurrentTab()
              if (!currentTab) {
                toast.error('No active tab found')
                return
              }
              
              const tabItems = currentTab.items || []
              
              // Find all items with this item_code to update them all
              const itemsToUpdate: number[] = []
              tabItems.forEach((item: any, index: number) => {
                if (item.item_code === itemCode) {
                  itemsToUpdate.push(index)
                }
              })
              
              if (itemsToUpdate.length === 0) {
                toast.error('Item not found in order')
                return
              }
              
              // Apply offer to all items with this item_code
              // Store original rate before changing it (only if not already stored)
              itemsToUpdate.forEach((index) => {
                const currentItem = tabItems[index]
                const currentRate = Number(currentItem?.standard_rate || 0)
                
                // Preserve existing original_rate if it exists (from previous offer application)
                // Otherwise, store the current rate as original
                const originalRateToStore = currentItem?.original_rate || currentRate
                
                updateItemInTabByIndex(activeTabId, index, {
                  original_rate: originalRateToStore, // Store original rate (preserve if exists)
                  standard_rate: offerRate,
                  is_offer_applied: 1,
                  offer_uom: offer.uom,
                  offer_max_qty: maxQty,
                  offer_available_qty: availableQty
                })
              })
              
              toast.success(`Offer applied! Price set to ${offerRate.toFixed(2)} for ${itemCode}`)
            }
            
            const handleUnapplyOffer = async () => {
              if (!activeTabId || !itemCode) {
                return
              }
              
              const currentTab = getCurrentTab()
              if (!currentTab) {
                toast.error('No active tab found')
                return
              }
              
              const tabItems = currentTab.items || []
              
              // Find all items with this item_code that have offer applied
              const itemsToUpdate: Array<{ index: number; item: any }> = []
              tabItems.forEach((item: any, index: number) => {
                if (item.item_code === itemCode && item.is_offer_applied === 1) {
                  itemsToUpdate.push({ index, item })
                }
              })
              
              if (itemsToUpdate.length === 0) {
                toast.error('No applied offer found for this item')
                return
              }
              
              // Try to fetch original price from product API if not stored
              let fallbackOriginalRate: number | null = null
              if (!itemsToUpdate[0].item?.original_rate) {
                try {
                  const productRes = await window.electronAPI?.proxy.request({
                    url: '/api/method/centro_pos_apis.api.product.product_list',
                    method: 'GET',
                    params: {
                      price_list: 'Standard Selling',
                      search_text: itemCode,
                      limit_start: 0,
                      limit_page_length: 1
                    }
                  })
                  
                  const productData = productRes?.data?.data?.[0]
                  if (productData) {
                    const uomDetails = Array.isArray(productData.uom_details) ? productData.uom_details : []
                    const matchingUom = uomDetails.find((detail: any) => 
                      String(detail?.uom || '').toLowerCase() === String(itemsToUpdate[0].item?.uom || 'Nos').toLowerCase()
                    )
                    fallbackOriginalRate = matchingUom ? Number(matchingUom.rate || 0) : Number(productData.standard_rate || 0)
                  }
                } catch (err) {
                  console.error('Failed to fetch original price from API:', err)
                }
              }
              
              // Unapply offer - restore original rate
              itemsToUpdate.forEach(({ index, item }) => {
                // Use stored original_rate, or fallback from API, or current rate as last resort
                const originalRate = Number(
                  item?.original_rate || 
                  fallbackOriginalRate || 
                  item?.standard_rate || 
                  0
                )
                
                // Only restore if we have a valid original rate
                if (originalRate > 0) {
                  updateItemInTabByIndex(activeTabId, index, {
                    standard_rate: originalRate,
                    is_offer_applied: 0,
                    original_rate: undefined, // Clear original_rate
                    offer_uom: undefined,
                    offer_max_qty: undefined,
                    offer_available_qty: undefined
                  })
                } else {
                  toast.error(`Could not determine original price for ${itemCode}`)
                }
              })
              
              toast.success(`Offer removed! Price restored to original for ${itemCode}`)
            }
            
            return (
              <div
                key={`${offer.uom}-${idx}`}
                className={`rounded-lg border transition-all duration-200 overflow-hidden ${
                  isApplied 
                    ? 'bg-gradient-to-br from-green-50 to-green-100 border-green-300 shadow-sm' 
                    : canApply
                    ? 'bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200 shadow-sm hover:shadow-md hover:border-amber-300'
                    : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200 opacity-60'
                }`}
              >
                {/* Header Section */}
                <div className={`px-2.5 py-2 ${isApplied ? 'bg-green-100/40' : canApply ? 'bg-amber-100/40' : 'bg-gray-100/40'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      {isApplied ? (
                        <CheckCircle2 className="w-3 h-3 text-green-600" />
                      ) : canApply ? (
                        <Sparkles className="w-3 h-3 text-amber-600" />
                      ) : (
                        <AlertCircle className="w-3 h-3 text-gray-400" />
                      )}
                      <span className={`text-[10px] font-semibold uppercase tracking-wide ${
                        isApplied ? 'text-green-700' : canApply ? 'text-amber-700' : 'text-gray-500'
                      }`}>
                        Special Offer
                      </span>
                    </div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      isApplied ? 'bg-green-200 text-green-800' : canApply ? 'bg-amber-200 text-amber-800' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {offer.uom}
                    </span>
                  </div>
                  
                  {/* Offer Price */}
                  <div className="flex items-baseline gap-1.5">
                    <span className={`text-sm font-bold ${
                      isApplied ? 'text-green-800' : canApply ? 'text-amber-800' : 'text-gray-600'
                    }`}>
                      {offer.offer_rate.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-gray-600">per unit</span>
                  </div>
                </div>

                {/* Details Section */}
                <div className="px-2.5 py-2 space-y-1.5">
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="flex flex-col">
                      <span className="text-gray-500 mb-0.5">Max per sale</span>
                      <span className="font-semibold text-gray-800 text-xs">{offer.max_selling_qty}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-gray-500 mb-0.5">Available</span>
                      <span className={`font-semibold text-xs ${
                        availableQty > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {offer.total_available_offer_qty}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-[9px] text-gray-500 pt-1.5 border-t border-gray-200">
                    <span>
                      All UOMs: <span className="font-medium">{offer.allow_all_uoms ? 'Yes' : 'No'}</span>
                    </span>
                    <span className="capitalize">
                      {offer.source?.replace(/_/g, ' ') || '-'}
                    </span>
                  </div>
                </div>

                {/* Apply Button Section */}
                {canApply && !isApplied && (
                  <div className="px-2.5 pb-2.5 pt-1.5">
                    <button
                      onClick={handleApplyOffer}
                      className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold py-2 px-3 rounded-md shadow-sm hover:shadow-md transition-all duration-200 transform hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-1.5 text-xs"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Apply Offer</span>
                    </button>
                  </div>
                )}
                
                {isApplied && (
                  <div className="px-2.5 pb-2.5 pt-1.5 space-y-1.5">
                    <div className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold py-2 px-3 rounded-md shadow-sm flex items-center justify-center gap-1.5 text-xs">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Offer Applied</span>
                    </div>
                    <button
                      onClick={handleUnapplyOffer}
                      className="w-full bg-gradient-to-r from-gray-400 to-gray-500 hover:from-gray-500 hover:to-gray-600 text-white font-semibold py-2 px-3 rounded-md shadow-sm hover:shadow-md transition-all duration-200 transform hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-1.5 text-xs"
                    >
                      <X className="w-3 h-3" />
                      <span>Remove Offer</span>
                    </button>
                  </div>
                )}
                
                {!canApply && !isApplied && (
                  <div className="px-2.5 pb-2.5 pt-1.5">
                    <div className="w-full bg-gray-300 text-gray-600 font-medium py-2 px-3 rounded-md flex items-center justify-center gap-1.5 text-xs cursor-not-allowed">
                      <AlertCircle className="w-3 h-3" />
                      <span>Not Available</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default ItemOffers


