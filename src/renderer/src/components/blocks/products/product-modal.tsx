import React, { useEffect, useRef, useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as Yup from 'yup'
import type { SubmitHandler } from 'react-hook-form'
import { Search, Plus, ArrowLeft, Wand2, Package } from 'lucide-react'
import { toast } from 'sonner'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Textarea } from '@renderer/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@renderer/components/ui/form'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Badge } from '@renderer/components/ui/badge'
import { usePOSProfileStore } from '@renderer/store/usePOSProfileStore'
import { Separator } from '@renderer/components/ui/separator'

// API and Hooks
import { useMutationQuery } from '@renderer/hooks/react-query/useReactQuery'
import { API_Endpoints } from '@renderer/config/endpoints'
import { ControlledTextField } from '@renderer/components/form/controlled-text-field'

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

// Validation schemas
const productSchema = Yup.object().shape({
  item_code: Yup.string().required('Item code is required'),
  item_name: Yup.string().required('Item name is required'),
  standard_rate: Yup.number().required('Standard rate is required').min(0, 'Rate must be positive'),
  description: Yup.string().optional(),
  stock_uom: Yup.string().required('UOM is required'),
  item_group: Yup.string().optional(),
  brand: Yup.string().optional(),
  barcode: Yup.string().optional(),
  opening_stock: Yup.number().optional().min(0, 'Stock must be positive'),
  min_order_qty: Yup.number().optional().min(0, 'Minimum quantity must be positive'),
  max_order_qty: Yup.number().optional().min(0, 'Maximum quantity must be positive')
}) as Yup.ObjectSchema<ProductFormData>

type ProductFormData = {
  item_code: string
  item_name: string
  standard_rate: number
  description?: string
  stock_uom: string
  item_group?: string
  brand?: string
  barcode?: string
  opening_stock?: number
  min_order_qty?: number
  max_order_qty?: number
}

// Product Search Component
const ProductSearch: React.FC<{
  onSelect: (product: Product) => void
  onCreateNew: () => void
  selectedPriceList?: string
  isOpen?: boolean
}> = ({ onSelect, onCreateNew, selectedPriceList = 'Standard Selling', isOpen = true }) => {
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

  const fetchProducts = async (term: string, pageToLoad = 1) => {
    const requestId = ++latestRequestId.current
    const isAppend = pageToLoad > 1
    if (isAppend) setIsFetchingMore(true)
    else setIsLoading(true)
    try {
      const limit_start = 1
      const limit_page_length = perPage
      console.log('[ProductModal] Fetching', { term, price_list: selectedPriceList, limit_start, limit_page_length })
      const res = await window.electronAPI?.proxy?.request({
        url: '/api/method/centro_pos_apis.api.product.product_list',
        params: {
          price_list: selectedPriceList,
          item: term || '',  // Send empty string when no search term
          limit_start,
          limit_page_length
        }
      })

      if (requestId !== latestRequestId.current) return
      const rows = Array.isArray(res?.data?.message?.data) ? res.data.message.data : []
      console.log('[ProductModal] Received', rows.length, 'rows (cumulative)')
      setHasMore(false)
      setPage(pageToLoad)
      setProducts(rows)
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

  const allowAddNew = Boolean((profile as any)?.custom_allow_adding_new_products === 1)

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
        <Button
          variant="outline"
          size="sm"
          onClick={onCreateNew}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 h-7"
          style={{ display: allowAddNew ? undefined : 'none' }}
        >
          <Plus className="h-3 w-3 mr-1" />
          New
        </Button>
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
              const onHandQty = Array.isArray(product.uom_details)
                ? (product.uom_details.find((d: any) => String(d.uom).toLowerCase() === String(defaultUom).toLowerCase())?.qty ?? 0)
                : 0

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
                            ? 'text-primary-foreground/80'
                            : 'text-muted-foreground'
                          }`}
                      >
                        On Hand: {Number(onHandQty || 0)} {defaultUom || primaryUOM.uom}
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

// Product Create Component
const ProductCreate: React.FC<{
  onBack: () => void
  onSuccess: (product: Product) => void
}> = ({ onBack, onSuccess }) => {
  const form = useForm<ProductFormData>({
    resolver: yupResolver(productSchema),
    defaultValues: {
      item_code: '',
      item_name: '',
      description: '',
      standard_rate: 0,
      stock_uom: 'Nos',
      item_group: 'Products',
      brand: '',
      barcode: '',
      opening_stock: 0,
      min_order_qty: 0,
      max_order_qty: 0
    }
  })

  const { mutate: createProduct, isPending } = useMutationQuery({
    endPoint: API_Endpoints.PRODUCTS,
    method: 'POST',
    options: {
      onSuccess: (response: any) => {
        toast.success('Product created successfully!')
        onSuccess(response.data)
        form.reset()
      },
      onError: (error) => {
        console.error('Product creation failed:', error)
      }
    }
  })

  const generateItemCode = () => {
    const timestamp = Date.now().toString().slice(-6)
    const random = Math.random().toString(36).substring(2, 5).toUpperCase()
    return `ITEM-${timestamp}-${random}`
  }

  const onSubmit: SubmitHandler<ProductFormData> = (data) => {
    const productData = {
      doctype: 'Item',
      item_code: data.item_code,
      item_name: data.item_name,
      description: data.description,
      item_group: data.item_group || 'Products',
      stock_uom: data.stock_uom,
      standard_rate: data.standard_rate,
      is_stock_item: 1,
      include_item_in_manufacturing: 0,
      is_sales_item: 1,
      is_purchase_item: 1,
      ...(data.brand && { brand: data.brand }),
      ...(data.barcode && { barcode: data.barcode }),
      ...(data.opening_stock && { opening_stock: data.opening_stock }),
      ...(data.min_order_qty && { min_order_qty: data.min_order_qty }),
      ...(data.max_order_qty && { max_order_qty: data.max_order_qty })
    }

    createProduct({
      data: productData,
      params: {}
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {/* Basic Information */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2">
                <Package className="h-4 w-4" />
                <h3 className="text-sm font-semibold">Basic Information</h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <ControlledTextField
                    name="item_code"
                    label="Item Code"
                    control={form.control}
                    required
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => form.setValue('item_code', generateItemCode())}
                    className="w-full"
                  >
                    <Wand2 className="h-3 w-3 mr-1" />
                    Generate Code
                  </Button>
                </div>

                <FormField
                  control={form.control}
                  name="stock_uom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit of Measure *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select UOM" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Nos">Nos</SelectItem>
                          <SelectItem value="Each">Each</SelectItem>
                          <SelectItem value="Box">Box</SelectItem>
                          <SelectItem value="Kg">Kg</SelectItem>
                          <SelectItem value="Ltr">Ltr</SelectItem>
                          <SelectItem value="Meter">Meter</SelectItem>
                          <SelectItem value="Piece">Piece</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <ControlledTextField
                name="item_name"
                label="Item Name"
                control={form.control}
                required
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Product description"
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Pricing & Category */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Pricing & Category</h3>

              <div className="grid grid-cols-2 gap-4">
                <ControlledTextField
                  name="standard_rate"
                  label="Standard Rate"
                  type="number"
                  control={form.control}
                  required
                />

                <ControlledTextField name="item_group" label="Item Group" control={form.control} />
              </div>

              <ControlledTextField name="brand" label="Brand" control={form.control} />
            </div>

            <Separator />

            {/* Inventory */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Inventory</h3>

              <div className="grid grid-cols-3 gap-4">
                <ControlledTextField
                  name="opening_stock"
                  label="Opening Stock"
                  type="number"
                  control={form.control}
                />

                <ControlledTextField
                  name="min_order_qty"
                  label="Min Order Qty"
                  type="number"
                  control={form.control}
                />

                <ControlledTextField
                  name="max_order_qty"
                  label="Max Order Qty"
                  type="number"
                  control={form.control}
                />
              </div>

              <ControlledTextField name="barcode" label="Barcode" control={form.control} />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Creating...' : 'Create Product'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}

// Main Modal Component
const ProductSearchModal: React.FC<ProductSearchModalProps> = ({
  open,
  onOpenChange,
  onSelect,
  selectedPriceList
}) => {
  const [view, setView] = useState<'search' | 'create'>('search')

  const handleClose = () => {
    setView('search')
    onOpenChange(false)
  }

  const handleProductSelect = (product: Product) => {
    onSelect(product)
    handleClose()
  }

  const handleProductCreated = (product: Product) => {
    onSelect(product)
    handleClose()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {view === 'search' ? 'Search Products' : 'Create New Product'}
          </DialogTitle>
        </DialogHeader>

        {view === 'search' ? (
          <>
            <ProductSearch
              onSelect={handleProductSelect}
              onCreateNew={() => setView('create')}
              selectedPriceList={selectedPriceList}
              isOpen={open}
            />
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
            </DialogFooter>
          </>
        ) : (
          <ProductCreate onBack={() => setView('search')} onSuccess={handleProductCreated} />
        )}
      </DialogContent>
    </Dialog>
  )
}

export default ProductSearchModal
