import React, { useEffect, useRef, useState, useMemo } from 'react'
import { Search, Package } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Badge } from '@renderer/components/ui/badge'
import { usePOSProfileStore } from '@renderer/store/usePOSProfileStore'

// API and Hooks
import ItemCreationWizard from './item-creation-wizard'
import { useActiveScope } from '@renderer/hooks/useActiveScope'

// Types
interface Product {
  name: string
  item_name: string
  item_code: string
  image?: string | null
  standard_rate: number
}

interface ProductSearchModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (product: Product) => void
  selectedPriceList?: string
}


// Product Search Component
const ProductSearch: React.FC<{
  onSelect: (product: Product) => void
  onOpenWizard: () => void
  selectedPriceList?: string
  isOpen?: boolean
}> = ({ onSelect, onOpenWizard: _onOpenWizard, selectedPriceList = 'Standard Selling', isOpen = true }) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const { profile } = usePOSProfileStore()
  const currencySymbol = profile?.custom_currency_symbol || profile?.currency_symbol || profile?.currency || '$'
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])
  const listContainerRef = useRef<HTMLDivElement>(null)

  // Server-driven product list with cumulative pagination
  const [products, setProducts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isFetchingMore, setIsFetchingMore] = useState(false)
  const [page, setPage] = useState(1)
  const perPage = 15
  const [hasMore, setHasMore] = useState(true)
  const latestRequestId = useRef(0)

  // Activate hotkey scope when this search is open
  useActiveScope(isOpen ? 'product-search' : 'global')

  const fetchProducts = async (term: string, pageToLoad = 1) => {
    const requestId = ++latestRequestId.current
    const isAppend = pageToLoad > 1
    if (isAppend) setIsFetchingMore(true)
    else setIsLoading(true)
    try {
      const limit_start = pageToLoad
      const limit_page_length = perPage
      console.log('[ProductModal] Fetching', { term, price_list: selectedPriceList, limit_start, limit_page_length, isAppend })
      const res = await window.electronAPI?.proxy?.request({
        url: '/api/method/centro_pos_apis.api.product.product_list',
        params: {
          price_list: selectedPriceList,
          item: term || '',  // Send empty string when no search term
          limit_start,
          limit_page_length
        }
      })
      console.log('SHD ==> [ProductModal]', res)
      if (requestId !== latestRequestId.current) return
      const rows = Array.isArray(res?.data?.data) ? res.data.data : []
      console.log('[ProductModal] Received', rows.length, 'rows')

      setHasMore(rows.length >= perPage)
      setPage(pageToLoad)
      setProducts((prev) => (isAppend ? [...prev, ...rows] : rows))
    } catch (e) {
      console.error('[ProductModal] Fetch error', e)
    } finally {
      if (isAppend) setIsFetchingMore(false)
      else setIsLoading(false)
    }
  }

  // Unified debounced loader: runs on open, price list, or search changes.
  // Prevents double fetch on first open.
  useEffect(() => {
    if (!isOpen || !selectedPriceList) return
    const handle = setTimeout(() => {
      setProducts([])
      setPage(1)
      setHasMore(true)
      setSelectedIndex(-1) // Reset selection when search changes
      fetchProducts(searchTerm, 1)
    }, 300)
    return () => clearTimeout(handle)
  }, [isOpen, selectedPriceList, searchTerm])

  const productList = useMemo(() => products || [], [products])

  // Reset selection to top when new results are loaded
  useEffect(() => {
    if (productList.length > 0) {
      setSelectedIndex(0) // Always start from top when results change
    } else {
      setSelectedIndex(-1) // Reset if no results
    }
  }, [productList.length, searchTerm])

  useEffect(() => {
    if (selectedIndex >= 0 && itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      })
    }
  }, [selectedIndex])

  // // Reset selection when search term changes
  // useEffect(() => {
  //   setSelectedIndex(-1)
  // }, [searchTerm])

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      // case 'N':
      // case 'n':
      //   if (e.shiftKey) {
      //     e.preventDefault()
      //     onOpenWizard()
      //   }
      //   break
      case 'ArrowDown':
        e.preventDefault()
        if (selectedIndex === -1) {
          setSelectedIndex(0) // Start from top if no selection
        } else if (selectedIndex < productList.length - 1) {
          setSelectedIndex((prev) => prev + 1) // Move down if not at bottom
        }
        // Do nothing if already at bottom
        break
      case 'ArrowUp':
        e.preventDefault()
        if (selectedIndex > 0) {
          setSelectedIndex((prev) => prev - 1) // Move up if not at top
        }
        // Do nothing if already at top
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && productList[selectedIndex]) {
          const product = productList[selectedIndex]

          // Handle different possible field names for item code
          const code = product.item_id || product.item_code || product.name || product.item_name || `ITEM-${selectedIndex}`

          // Handle different possible field names for item name
          const itemName = product.item_name || product.name || product.label || 'Unknown Product'

          // Handle UOM details - try different possible structures
          let primaryUOM = { uom: 'Nos', rate: 0 }
          if (Array.isArray(product.uom_details) && product.uom_details.length > 0) {
            primaryUOM = product.uom_details[0]
          } else if (product.uom && product.rate) {
            primaryUOM = { uom: product.uom, rate: product.rate }
          } else if (product.stock_uom && product.standard_rate) {
            primaryUOM = { uom: product.stock_uom, rate: product.standard_rate }
          }

          const displayRate = Number(primaryUOM.rate || product.standard_rate || product.rate || 0)

          console.log('⌨️ Enter key - selecting product:', {
            code,
            itemName,
            displayRate,
            primaryUOM,
            originalProduct: product
          })

          onSelect({
            name: code,
            item_name: itemName,
            item_code: code,
            image: product.image,
            standard_rate: displayRate,
            uom: primaryUOM.uom,
            quantity: 1,
            discount_percentage: 0,
            uomRates: (Array.isArray(product.uom_details) ? Object.fromEntries(product.uom_details.map((d: any) => [d.uom, d.rate])) : {})
          } as any)
        }
        break
    }
  }

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Search products..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleKeyDown}
          className="pl-10 pr-28"
          autoFocus
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
          {/* <Button
            variant="outline"
            size="sm"
            onClick={onOpenWizard}
            className="h-8 gap-2"
          >
            <div className="flex items-center">
              <Plus className="h-3.5 w-3.5 mr-1 text-slate-600" />
              New
            </div>
            <span className="text-xs bg-gray-200 px-1 rounded text-muted-foreground">Shift+N</span>
          </Button> */}
        </div>
      </div>

      {/* Search Results */}
      <div
        className="h-[300px] overflow-y-auto"
        ref={listContainerRef}
        onScroll={(e) => {
          const el = e.currentTarget as HTMLDivElement
          const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 120
          if (nearBottom && hasMore && !isFetchingMore && !isLoading) {
            console.log('[ProductModal] Near bottom → increase page size to', (page + 1) * perPage)
            fetchProducts(searchTerm, page + 1)
          }
        }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span className="ml-2 text-sm text-muted-foreground">Loading products...</span>
          </div>
        ) : productList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <Package className="h-8 w-8 mb-2" />
            <span className="text-sm">
              {searchTerm ? 'No products found' : 'Start typing to search products'}
            </span>
          </div>
        ) : (
          <div className="space-y-1">
            {productList.map((product: any, index: number) => {
              console.log('🔍 Processing product:', product)

              // Handle different possible field names for item code
              const code = product.item_id || product.item_code || product.name || product.item_name || `ITEM-${index}`

              // Handle different possible field names for item name
              const itemName = product.item_name || product.name || product.label || 'Unknown Product'

              // Handle UOM details - try different possible structures
              let primaryUOM = { uom: 'Nos', rate: 0 }
              if (Array.isArray(product.uom_details) && product.uom_details.length > 0) {
                primaryUOM = product.uom_details[0]
              } else if (product.uom && product.rate) {
                primaryUOM = { uom: product.uom, rate: product.rate }
              } else if (product.stock_uom && product.standard_rate) {
                primaryUOM = { uom: product.stock_uom, rate: product.standard_rate }
              }

              const displayRate = Number(primaryUOM.rate || product.standard_rate || product.rate || 0)

              // Compute On Hand quantity for default_uom
              const defaultUom = product.default_uom || primaryUOM.uom
              // const onHandQty = Array.isArray(product.uom_details)
              //   ? (product.uom_details.find((d: any) => String(d.uom).toLowerCase() === String(defaultUom).toLowerCase())?.total_qty ?? 0)
              //   : 0
              const availableQty = Array.isArray(product.uom_details)
                ? (product.uom_details.find((d: any) => String(d.uom).toLowerCase() === String(defaultUom).toLowerCase())?.balance_qty ?? 0)
                : 0
              // const reservedQty = Array.isArray(product.uom_details)
              //   ? (product.uom_details.find((d: any) => String(d.uom).toLowerCase() === String(defaultUom).toLowerCase())?.reserved_qty ?? 0)
              //   : 0
              console.log('SHD ==>:[product]', product)
              console.log('🔍 Processed product data:', {
                code,
                itemName,
                displayRate,
                primaryUOM,
                originalProduct: product
              })

              return (
                <div
                  ref={(el) => {
                    itemRefs.current[index] = el
                  }}
                  key={code}
                  className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${selectedIndex === index ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                    }`}
                  onClick={() => {
                    console.log('🖱️ Product clicked:', product)
                    onSelect({
                      name: code,
                      item_name: itemName,
                      item_code: code,
                      item_description: product.description || '',
                      image: product.image,
                      standard_rate: displayRate,
                      uom: primaryUOM.uom,
                      quantity: 1,
                      discount_percentage: 0,
                      default_warehouse: product.default_warehouse,
                      uomRates: (Array.isArray(product.uom_details) ? Object.fromEntries(product.uom_details.map((d: any) => [d.uom, d.rate])) : {})
                    } as any)
                  }}
                // Disable cursor-driven navigation; cursor for click only
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm leading-tight">{itemName}</h4>
                      <p
                        className={`text-xs mt-1 ${selectedIndex === index
                          ? 'text-primary-foreground/80'
                          : 'text-muted-foreground'
                          }`}
                      >
                        {code}
                      </p>
                      <p
                        className={`text-[11px] mt-1 ${selectedIndex === index
                          ? Number(availableQty || 0) <= 0
                            ? 'text-red-500 font-medium'
                            : 'text-primary-foreground/80'
                          : Number(availableQty || 0) <= 0
                            ? 'text-red-500 font-medium'
                            : 'text-muted-foreground/80'
                          }`}
                      >
                        Available Quantity: {Number(availableQty || 0)} {defaultUom || primaryUOM.uom}
                      </p>
                    </div>
                    <Badge variant={selectedIndex === index ? 'secondary' : 'outline'}>
                      {currencySymbol} {displayRate.toFixed(2)}
                    </Badge>
                  </div>
                </div>
              )
            })}
            {isFetchingMore && (
              <div className="flex items-center justify-center py-3 text-sm text-muted-foreground">
                Loading more...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Main Modal Component
const ProductSearchModal: React.FC<ProductSearchModalProps> = ({
  open,
  onOpenChange,
  onSelect,
  selectedPriceList
}) => {
  const [isWizardOpen, setIsWizardOpen] = useState(false)

  const handleClose = () => {
    onOpenChange(false)
  }

  const handleProductSelect = (product: Product) => {
    onSelect(product)
    handleClose()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] bg-white"
        // onKeyDown={(e) => {
        //   if (e.shiftKey && (e.key === 'N' || e.key === 'n')) {
        //     e.preventDefault()
        //     setIsWizardOpen(true)
        //   }
        // }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Search Products
          </DialogTitle>
        </DialogHeader>

        <ProductSearch
          onSelect={handleProductSelect}
          onOpenWizard={() => setIsWizardOpen(true)}
          selectedPriceList={selectedPriceList}
          isOpen={open}
        />
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
        </DialogFooter>

        <ItemCreationWizard
          open={isWizardOpen}
          onOpenChange={setIsWizardOpen}
          onSuccess={(item) => {
            if (item) {
              onSelect({
                name: item.item_code || item.name,
                item_name: item.item_name,
                item_code: item.item_code || item.name,
                standard_rate: item.standard_rate || 0,
                uom: item.stock_uom,
                quantity: 1,
                discount_percentage: 0
              } as any)
            }
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

export default ProductSearchModal
