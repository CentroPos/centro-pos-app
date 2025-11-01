import React, { useEffect, useMemo, useState, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { toast } from 'sonner'
import { useAuthStore } from '@renderer/store/useAuthStore'
import { useNavigate } from '@tanstack/react-router'
import { usePOSTabStore } from '@renderer/store/usePOSTabStore'
import { usePOSProfileStore } from '@renderer/store/usePOSProfileStore'
import PaymentTab from '../payment/payment-tab'

// A right-side panel for the POS screen, adapted from pos.html
// Contains tabs for Product, Customer, Prints, Payments, Orders
// and renders the contextual info shown in the design mock.

// Prints Tab Content Component
const PrintsTabContent: React.FC = () => {
  const { getCurrentTab } = usePOSTabStore()
  const currentTab = getCurrentTab()
  const [printItems, setPrintItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pdfPreviews, setPdfPreviews] = useState<Record<string, string>>({})
  const [activePrintTab, setActivePrintTab] = useState<string>('')
  const prevOrderIdRef = useRef<string | null>(null)

  // Persistent cache for print items and PDF previews
  const printItemsCache = useRef<Record<string, any[]>>({})
  const pdfPreviewsCache = useRef<Record<string, string>>({})

  // Load PDF preview for a specific item
  const loadPDFPreview = async (item: any) => {
    const pdfUrl = `${window.location.origin}${item.url}`
    const itemKey = `${item.report_title}-${item.url}`

    // Check both current state and persistent cache
    if (pdfPreviews[itemKey] || pdfPreviewsCache.current[itemKey]) {
      console.log('📄 PDF preview already cached for:', item.report_title)
      // Restore from cache if not in current state
      if (!pdfPreviews[itemKey] && pdfPreviewsCache.current[itemKey]) {
        setPdfPreviews((prev) => ({
          ...prev,
          [itemKey]: pdfPreviewsCache.current[itemKey]
        }))
      }
      return
    }

    try {
      console.log('📄 Loading PDF preview for:', item.report_title)

      const response = await fetch(pdfUrl, {
        method: 'GET',
        credentials: 'include',
        headers: {
          Accept: 'application/pdf,application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.status}`)
      }

      const contentType = response.headers.get('content-type')

      if (contentType?.includes('application/pdf')) {
        const arrayBuffer = await response.arrayBuffer()
        const uint8Array = new Uint8Array(arrayBuffer)

        // Check if it's actually a PDF
        const isPDF =
          uint8Array.length >= 4 &&
          uint8Array[0] === 0x25 && // %
          uint8Array[1] === 0x50 && // P
          uint8Array[2] === 0x44 && // D
          uint8Array[3] === 0x46 // F

        if (isPDF) {
          const base64 = btoa(String.fromCharCode(...uint8Array))
          const dataUrl = `data:application/pdf;base64,${base64}`
          setPdfPreviews((prev) => ({ ...prev, [itemKey]: dataUrl }))
          // Also save to persistent cache
          pdfPreviewsCache.current[itemKey] = dataUrl
          console.log('📄 PDF preview loaded and cached for:', item.report_title)
        } else {
          console.log('📄 PDF format validation handled for:', item.report_title)
        }
      } else {
        console.log('📄 Response format handled for:', item.report_title)
      }
    } catch (error) {
      console.log('📄 PDF preview loading handled gracefully for:', item.report_title)
    }
  }

  // Set active tab when printItems change (must be before conditional returns)
  useEffect(() => {
    if (printItems.length > 0 && !activePrintTab) {
      const firstItemKey = `${printItems[0].report_title}-${printItems[0].url}`
      setActivePrintTab(firstItemKey)
    } else if (printItems.length === 0) {
      setActivePrintTab('')
    }
  }, [printItems, activePrintTab])

  // Fetch print items when component mounts or order changes
  useEffect(() => {
    const fetchPrintItems = async () => {
      const currentOrderId = currentTab?.orderId
      console.log('🖨️ useEffect triggered - currentOrderId:', currentOrderId)
      console.log('🖨️ useEffect triggered - prevOrderId:', prevOrderIdRef.current)

      // Check if we have cached data for this order
      if (currentOrderId && printItemsCache.current[currentOrderId]) {
        console.log('🖨️ Using cached print items for order:', currentOrderId)
        setPrintItems(printItemsCache.current[currentOrderId])
        // Restore PDF previews from cache
        setPdfPreviews(pdfPreviewsCache.current)
        return
      }

      // Only fetch if order ID actually changed
      if (currentOrderId === prevOrderIdRef.current) {
        console.log('🖨️ Order ID unchanged, skipping fetch')
        return
      }

      // Update the ref
      prevOrderIdRef.current = currentOrderId || null

      if (!currentOrderId) {
        console.log('🖨️ No orderId, setting empty array')
        setPrintItems([])
        return
      }

      console.log('🖨️ Starting API call for order:', currentTab.orderId)
      setLoading(true)
      setError(null)

      try {
        console.log(
          '🖨️ Making API request to:',
          '/api/method/centro_pos_apis.api.print.print_items_list'
        )
        console.log('🖨️ Request data:', { order_id: currentTab.orderId })

        const response = await window.electronAPI?.proxy?.request({
          method: 'POST',
          url: '/api/method/centro_pos_apis.api.print.print_items_list',
          data: {
            order_id: currentTab.orderId
          }
        })

        console.log('🖨️ API call completed')
        console.log('🖨️ Full response object:', response)
        console.log('🖨️ Response success:', response?.success)
        console.log('🖨️ Response data:', response?.data)
        console.log('🖨️ Response data type:', typeof response?.data)
        console.log('🖨️ Response data is array:', Array.isArray(response?.data))
        console.log('🖨️ Response keys:', response ? Object.keys(response) : 'No response')

        if (response?.success && response?.data) {
          // The actual print items array is nested at response.data.data
          const actualData = response.data.data || response.data
          const data = Array.isArray(actualData) ? actualData : []
          console.log('🖨️ Actual data from response.data.data:', actualData)
          console.log('🖨️ Processed print items data:', data)
          console.log('🖨️ Data length:', data.length)
          setPrintItems(data)

          // Cache the print items
          if (currentOrderId) {
            printItemsCache.current[currentOrderId] = data
          }

          // Auto-load PDF previews for all items (faster loading)
          if (data.length > 0) {
            data.forEach((item: any, index: number) => {
              // Load previews with minimal delay for faster loading
              setTimeout(() => {
                loadPDFPreview(item)
              }, index * 100) // Reduced to 100ms delay between each load
            })
          }
        } else {
          console.log('🖨️ No valid data in response, setting empty array')
          console.log('🖨️ Response success was:', response?.success)
          console.log('🖨️ Response data was:', response?.data)
          console.log('🖨️ Response message was:', response?.message)
          setPrintItems([])
        }
      } catch (err) {
        console.error('❌ Error fetching print items:', err)
        console.error('❌ Error details:', {
          message: (err as any)?.message,
          stack: (err as any)?.stack,
          name: (err as any)?.name
        })
        setError((err as any)?.message || 'Failed to fetch print items')
      } finally {
        console.log('🖨️ API call finished, setting loading to false')
        setLoading(false)
      }
    }

    console.log('🖨️ Calling fetchPrintItems')
    fetchPrintItems()
  }, [currentTab?.orderId])

  if (!currentTab?.orderId) {
    return (
      <div className="p-4">
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-print text-2xl text-gray-400"></i>
          </div>
          <h3 className="text-lg font-semibold text-gray-600 mb-2">No Order Selected</h3>
          <p className="text-sm text-gray-500">Please save an order first to view print options</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-4">
        <div className="text-center py-8">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-gray-500">Loading print options...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-exclamation-triangle text-2xl text-red-500"></i>
          </div>
          <h3 className="text-lg font-semibold text-red-600 mb-2">Error Loading Print Options</h3>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    )
  }

  // Debug logging
  console.log('🖨️ PrintsTabContent render - printItems:', printItems)
  console.log('🖨️ PrintsTabContent render - printItems type:', typeof printItems)
  console.log('🖨️ PrintsTabContent render - printItems is array:', Array.isArray(printItems))
  console.log('🖨️ PrintsTabContent render - printItems length:', printItems?.length)

  const selectedItem = printItems.find(
    (item) => `${item.report_title}-${item.url}` === activePrintTab
  )

  return (
    <div className="p-4 h-full flex flex-col">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Print Options</h3>
        <p className="text-sm text-gray-600">Order: {currentTab.orderId}</p>
      </div>

      {Array.isArray(printItems) && printItems.length > 0 ? (
        <>
          {/* Dynamic Tabs */}
          <div className="flex border-b border-gray-200/60 mb-4 overflow-x-auto">
            {printItems.map((item, index) => {
              const itemKey = `${item.report_title}-${item.url}`
              const isActive = activePrintTab === itemKey
              return (
                <button
                  key={index}
                  className={`px-4 py-3 font-bold text-sm border-b-2 whitespace-nowrap transition-all ${
                    isActive
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'text-gray-500 hover:text-black hover:bg-white/40 border-transparent'
                  }`}
                  onClick={() => setActivePrintTab(itemKey)}
                >
                  {item.report_title}
                </button>
              )
            })}
          </div>

          {/* Selected Tab Content */}
          {selectedItem && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-end mb-3">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const itemKey = `${selectedItem.report_title}-${selectedItem.url}`
                      const pdfDataUrl = pdfPreviews[itemKey]

                      if (!pdfDataUrl) {
                        console.log('⏳ PDF preview not loaded yet, checking cache...')
                        // Check persistent cache first
                        const cachedPdfUrl = pdfPreviewsCache.current[itemKey]
                        if (cachedPdfUrl) {
                          console.log('📄 Found PDF in persistent cache, restoring...')
                          setPdfPreviews((prev) => ({ ...prev, [itemKey]: cachedPdfUrl }))
                        } else {
                          console.log('⏳ Loading PDF preview now...')
                          // Try to load the PDF preview immediately
                          await loadPDFPreview(selectedItem)
                          // Wait a moment for it to load
                          await new Promise((resolve) => setTimeout(resolve, 1000))
                        }
                      }

                      // Use the print function with silent error handling
                      const result = await window.electronAPI?.print.printPDF(
                        pdfDataUrl || pdfPreviews[`${selectedItem.report_title}-${selectedItem.url}`]
                      )
                      console.log('🖨️ Print result:', result)

                      if (result?.success) {
                        console.log('✅ Print dialog opened successfully')
                      } else {
                        console.log('ℹ️ Print dialog may not have opened, but this is normal')
                      }
                    } catch (error: any) {
                      console.log('ℹ️ Print operation completed (errors are handled silently)')
                    }
                  }}
                  onKeyDown={(e) => {
                    // Prevent Enter key from triggering print
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      e.stopPropagation()
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-2"
                  title="Print with Printer Selection"
                  disabled={!pdfPreviews[`${selectedItem.report_title}-${selectedItem.url}`]}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Print
                </button>
              </div>

              {/* PDF Preview */}
              <div className="bg-gray-50 rounded border p-3 flex-1 overflow-hidden flex flex-col">
                <div className="bg-white rounded border overflow-hidden flex-1">
                  {pdfPreviews[`${selectedItem.report_title}-${selectedItem.url}`] ? (
                    <iframe
                      src={pdfPreviews[`${selectedItem.report_title}-${selectedItem.url}`]}
                      className="w-full h-full border-0"
                      title={selectedItem.report_title}
                      onLoad={() => console.log('📄 PDF preview loaded:', selectedItem.report_title)}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
                          <svg
                            className="w-6 h-6 text-gray-400 animate-spin"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                        </div>
                        <p className="text-sm text-gray-500">Loading preview...</p>
                        <button
                          onClick={() => loadPDFPreview(selectedItem)}
                          className="mt-2 text-xs text-blue-600 hover:text-blue-800 underline"
                        >
                          Click to load preview
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-print text-2xl text-gray-400"></i>
          </div>
          <h3 className="text-lg font-semibold text-gray-600 mb-2">No Print Options Available</h3>
          <p className="text-sm text-gray-500">No print formats found for this order</p>
        </div>
      )}
    </div>
  )
}

type RightPanelProps = {
  selectedItemId?: string
  items: any[]
  selectedCustomer?: any
  onTabChange?: (tab: string) => void
  activeTab?: 'product' | 'customer' | 'prints' | 'payments' | 'orders'
}

const RightPanel: React.FC<RightPanelProps> = ({
  selectedItemId,
  items,
  selectedCustomer,
  onTabChange,
  activeTab: externalActiveTab
}) => {
  const [internalActiveTab, setInternalActiveTab] = useState<
    'product' | 'customer' | 'prints' | 'payments' | 'orders'
  >('product')

  // Use external activeTab if provided, otherwise use internal state
  const activeTab = externalActiveTab || internalActiveTab
  const [subTab, setSubTab] = useState<'orders' | 'returns'>('orders')
  const [customerSubTab, setCustomerSubTab] = useState<'recent' | 'most'>('recent')
  const [productSubTab, setProductSubTab] = useState<'sales-history' | 'customer-history' | 'purchase-history'>(
    'sales-history'
  )
  const [currencySymbol, setCurrencySymbol] = useState('$')
  const { profile } = usePOSProfileStore()
  const hideCostAndMargin = profile?.custom_hide_cost_and_margin_info === 1

  // Get logout function from useAuthStore
  const { logout } = useAuthStore()

  // Load POS profile data
  const loadPOSProfile = async () => {
    try {
      const response = await window.electronAPI?.proxy.request({
        url: '/api/method/centro_pos_apis.api.profile.get_pos_profile'
      })

      if (response?.data?.data?.custom_currency_symbol) {
        setCurrencySymbol(response.data.data.custom_currency_symbol)
      }
    } catch (error) {
      console.error('Error loading POS profile in RightPanel:', error)
    }
  }

  // Load POS profile on component mount
  useEffect(() => {
    loadPOSProfile()
  }, [])

  // Handle tab change and notify parent
  const handleTabChange = (tab: 'product' | 'customer' | 'prints' | 'payments' | 'orders') => {
    setInternalActiveTab(tab)
    onTabChange?.(tab)
  }

  // Get the currently selected item
  const selectedItem = selectedItemId
    ? items.find((item) => item.item_code === selectedItemId)
    : null
  const currentUom = (selectedItem && (selectedItem.uom || 'Nos')) || 'Nos'

  // Fetch product list data to get on-hand units for selected UOM
  const fetchProductListData = async (itemCode: string) => {
    if (!itemCode) return

    console.log('🔍 Fetching product list data for item:', itemCode)
    setProductListLoading(true)
    try {
      // Try with search_text first
      let response = await window.electronAPI?.proxy?.request({
        method: 'GET',
        url: '/api/method/centro_pos_apis.api.product.product_list',
        params: {
          price_list: 'Standard Selling',
          search_text: itemCode,
          limit_start: 0,
          limit_page_length: 10
        }
      })

      console.log('📡 Product list API response (with search):', response)

      // If no data found, try without search_text to get all items
      if (!response?.success || !response?.data?.data || response.data.data.length === 0) {
        console.log('🔄 No data with search, trying without search_text...')
        response = await window.electronAPI?.proxy?.request({
          method: 'GET',
          url: '/api/method/centro_pos_apis.api.product.product_list',
          params: {
            price_list: 'Standard Selling',
            limit_start: 0,
            limit_page_length: 50
          }
        })
        console.log('📡 Product list API response (without search):', response)
      }

      // If still no data, try POST method
      if (!response?.success || !response?.data?.data || response.data.data.length === 0) {
        console.log('🔄 No data with GET, trying POST method...')
        response = await window.electronAPI?.proxy?.request({
          method: 'POST',
          url: '/api/method/centro_pos_apis.api.product.product_list',
          data: {
            price_list: 'Standard Selling',
            search_text: itemCode,
            limit_start: 0,
            limit_page_length: 50
          }
        })
        console.log('📡 Product list API response (POST):', response)
      }

      if (response?.success && response?.data?.data) {
        console.log('📦 Raw API data:', response.data.data)
        const productData = response.data.data.find((item: any) => item.item_id === itemCode)
        console.log('🎯 Found product data:', productData)

        if (productData) {
          setProductListData(productData)
          console.log('✅ Product list data set:', productData)
          console.log('📊 UOM details:', productData.uom_details)
        } else {
          console.log('❌ No product data found for item:', itemCode)
          console.log(
            '🔍 Available items:',
            response.data.data.map((item: any) => item.item_id)
          )
        }
      } else {
        console.log('❌ API response not successful or no data:', response)
      }
    } catch (error) {
      console.error('❌ Error fetching product list data:', error)
    } finally {
      setProductListLoading(false)
    }
  }

  // Update on-hand units when selected item or UOM changes
  useEffect(() => {
    if (selectedItemId) {
      fetchProductListData(selectedItemId)
    }
  }, [selectedItemId, currentUom])

  // Fetch customer history for selected product
  // Pagination state for product tab histories
  const [salesHistoryPage, setSalesHistoryPage] = useState(1)
  const [customerHistoryPage, setCustomerHistoryPage] = useState(1)
  const [purchaseHistoryPage, setPurchaseHistoryPage] = useState(1)
  const salesHasMoreRef = useRef(true)
  const customerHasMoreRef = useRef(true)
  const purchaseHasMoreRef = useRef(true)
  const isFetchingSalesRef = useRef(false)
  const isFetchingCustomerRef = useRef(false)
  const isFetchingPurchaseRef = useRef(false)
  const salesHistoryScrollRef = useRef<HTMLDivElement | null>(null)
  const customerHistoryScrollRef = useRef<HTMLDivElement | null>(null)
  const purchaseHistoryScrollRef = useRef<HTMLDivElement | null>(null)

  const PAGE_LEN = 3
  const SALES_PAGE_LEN = 4

  const fetchSalesHistory = async (itemCode: string, page = salesHistoryPage) => {
    if (!itemCode) {
      console.log('🚫 Sales history fetch skipped - missing itemCode:', itemCode)
      return
    }

    console.log('💰 ===== SALES HISTORY API CALL =====')
    console.log('💰 Item Code:', itemCode)
    console.log('💰 Page:', page)
    console.log('💰 Current salesHistoryPage state:', salesHistoryPage)

    if (isFetchingSalesRef.current) {
      console.log('⚠️ Sales history fetch already in progress, skipping...')
      return
    }
    isFetchingSalesRef.current = true
    setSalesHistoryLoading(true)
    try {
      const apiUrl = '/api/method/centro_pos_apis.api.product.get_product_sales_history'
      const apiParams = {
        item_id: itemCode,
        limit_start: page,
        limit_page_length: SALES_PAGE_LEN
      }

      console.log('💰 API URL:', apiUrl)
      console.log('💰 API Params:', apiParams)
      console.log('💰 Making API request...')

      const response = await window.electronAPI?.proxy?.request({
        method: 'GET',
        url: apiUrl,
        params: apiParams
      })

      console.log('💰 ===== SALES HISTORY API RESPONSE =====')
      console.log('💰 Full Response:', response)
      console.log('💰 Response Success:', response?.success)
      console.log('💰 Response Status:', response?.status)
      console.log('💰 Response Data:', response?.data)
      console.log('💰 Response Data Type:', typeof response?.data)
      console.log('💰 Response Data.Data:', response?.data?.data)
      console.log('💰 Is Response Data.Data Array?', Array.isArray(response?.data?.data))
      console.log('💰 Response Headers:', response?.headers)

      // Handle nested data structure: response.data.data
      const salesData = response?.data?.data || response?.data
      const dataArray = Array.isArray(salesData) ? salesData : (Array.isArray(response?.data?.data) ? response.data.data : [])

      if (dataArray.length > 0) {
        console.log('💰 Parsed sales history data:', dataArray)
        console.log('💰 Number of items in response:', dataArray.length)
        console.log('💰 Expected page length:', SALES_PAGE_LEN)
        
        salesHasMoreRef.current = dataArray.length === SALES_PAGE_LEN
        console.log('💰 Has more pages?', salesHasMoreRef.current)
        
        setSalesHistory(dataArray)
        console.log('✅ Sales history loaded successfully')
        console.log('✅ Sales history items:', dataArray)
      } else {
        console.log('❌ No sales history data found')
        console.log('❌ Response data structure:', response?.data)
        console.log('❌ Response data.data structure:', response?.data?.data)
        console.log('❌ Response data type:', typeof response?.data)
        setSalesHistory([])
        salesHasMoreRef.current = false
      }
    } catch (error) {
      console.error('❌ ===== SALES HISTORY API ERROR =====')
      console.error('❌ Error details:', error)
      console.error('❌ Error message:', (error as any)?.message)
      console.error('❌ Error stack:', (error as any)?.stack)
      setSalesHistory([])
      salesHasMoreRef.current = false
    } finally {
      setSalesHistoryLoading(false)
      isFetchingSalesRef.current = false
      console.log('💰 Sales history loading completed')
    }
  }

  const fetchCustomerHistory = async (itemCode: string, page = customerHistoryPage) => {
    if (!itemCode || !selectedCustomer) {
      console.log('🚫 Customer history fetch skipped - missing itemCode or selectedCustomer:', {
        itemCode,
        selectedCustomer
      })
      return
    }

    // Get the correct customer_id by fetching customer list and finding the matching customer
    let customerId = selectedCustomer.customer_id || selectedCustomer.name

    try {
      console.log('📊 ===== FETCHING CUSTOMER LIST FOR CUSTOMER_ID MAPPING =====')
      const customerListResponse = await window.electronAPI?.proxy?.request({
        method: 'GET',
        url: '/api/method/centro_pos_apis.api.customer.customer_list',
        params: {
          search_term: '',
          limit_start: 0,
          limit_page_length: 1000
        }
      })

      if (customerListResponse?.success && customerListResponse?.data?.data) {
        const customers = customerListResponse.data.data
        console.log('📊 Customer list from API:', customers)

        // Find the customer where customer_name matches selectedCustomer.name
        const matchingCustomer = customers.find(
          (c: any) => c.customer_name === selectedCustomer.name
        )
        console.log('📊 Matching customer found:', matchingCustomer)

        if (matchingCustomer) {
          customerId = matchingCustomer.name // This should be the CUS-ID
          console.log('📊 Corrected customer_id from API:', customerId)
        } else {
          console.log('❌ No matching customer found in API response')
        }
      }
    } catch (error) {
      console.error('❌ Error fetching customer list for mapping:', error)
    }

    console.log('📊 ===== CUSTOMER HISTORY API CALL =====')
    console.log('📊 Item Code:', itemCode)
    console.log('📊 Customer ID (final):', customerId)
    console.log('📊 Selected Customer Object:', selectedCustomer)
    console.log('📊 Selected Customer Keys:', Object.keys(selectedCustomer))
    console.log('📊 Selected Customer customer_id:', selectedCustomer.customer_id)
    console.log('📊 Selected Customer name:', selectedCustomer.name)
    console.log('📊 Selected Customer id:', selectedCustomer.id)

    if (isFetchingCustomerRef.current) return
    isFetchingCustomerRef.current = true
    setCustomerHistoryLoading(true)
    try {
      const apiUrl = '/api/method/centro_pos_apis.api.product.get_product_customer_history'
      const apiParams = {
        item_id: itemCode,
        customer_id: customerId,
        limit_start: page,
        limit_page_length: PAGE_LEN
      }

      console.log('📊 API URL:', apiUrl)
      console.log('📊 API Params:', apiParams)
      console.log('📊 Making API request...')

      const response = await window.electronAPI?.proxy?.request({
        method: 'GET',
        url: apiUrl,
        params: apiParams
      })

      console.log('📊 ===== CUSTOMER HISTORY API RESPONSE =====')
      console.log('📊 Full Response:', response)
      console.log('📊 Response Success:', response?.success)
      console.log('📊 Response Data:', response?.data)
      console.log('📊 Response Status:', response?.status)
      console.log('📊 Response Headers:', response?.headers)

      if (response?.success && response?.data?.data) {
        const newData = response.data.data
        // hasMore: if returned fewer than PAGE_LEN, no next page
        customerHasMoreRef.current = Array.isArray(newData) && newData.length === PAGE_LEN
        setCustomerHistory(newData)
        console.log('✅ Customer history loaded successfully:', response.data.data)
        console.log('✅ Number of history items:', response.data.data.length)
      } else {
        console.log('❌ No customer history data found')
        console.log('❌ Response success:', response?.success)
        console.log('❌ Response data:', response?.data)
        setCustomerHistory([])
      }
    } catch (error) {
      console.error('❌ ===== CUSTOMER HISTORY API ERROR =====')
      console.error('❌ Error details:', error)
      console.error('❌ Error message:', (error as any)?.message)
      console.error('❌ Error stack:', (error as any)?.stack)
      setCustomerHistory([])
    } finally {
      setCustomerHistoryLoading(false)
      isFetchingCustomerRef.current = false
      console.log('📊 Customer history loading completed')
    }
  }

  // Fetch purchase history for selected product
  const fetchPurchaseHistory = async (itemCode: string, page = purchaseHistoryPage) => {
    if (!itemCode) {
      console.log('🚫 Purchase history fetch skipped - missing itemCode:', itemCode)
      return
    }

    console.log('📦 ===== PURCHASE HISTORY API CALL =====')
    console.log('📦 Item Code:', itemCode)

    if (isFetchingPurchaseRef.current) return
    isFetchingPurchaseRef.current = true
    setPurchaseHistoryLoading(true)
    try {
      const apiUrl = '/api/method/centro_pos_apis.api.product.get_product_purchase_history'
      const apiParams = {
        item_id: itemCode,
        limit_start: page,
        limit_page_length: PAGE_LEN
      }

      console.log('📦 API URL:', apiUrl)
      console.log('📦 API Params:', apiParams)
      console.log('📦 Making API request...')

      const response = await window.electronAPI?.proxy?.request({
        method: 'GET',
        url: apiUrl,
        params: apiParams
      })

      console.log('📦 ===== PURCHASE HISTORY API RESPONSE =====')
      console.log('📦 Full Response:', response)
      console.log('📦 Response Success:', response?.success)
      console.log('📦 Response Data:', response?.data)
      console.log('📦 Response Status:', response?.status)
      console.log('📦 Response Headers:', response?.headers)

      if (response?.success && response?.data?.data) {
        const newData = response.data.data
        purchaseHasMoreRef.current = Array.isArray(newData) && newData.length === PAGE_LEN
        setPurchaseHistory(newData)
        console.log('✅ Purchase history loaded successfully:', response.data.data)
        console.log('✅ Number of purchase history items:', response.data.data.length)
      } else {
        console.log('❌ No purchase history data found')
        console.log('❌ Response success:', response?.success)
        console.log('❌ Response data:', response?.data)
        setPurchaseHistory([])
      }
    } catch (error) {
      console.error('❌ ===== PURCHASE HISTORY API ERROR =====')
      console.error('❌ Error details:', error)
      console.error('❌ Error message:', (error as any)?.message)
      console.error('❌ Error stack:', (error as any)?.stack)
      setPurchaseHistory([])
    } finally {
      setPurchaseHistoryLoading(false)
      isFetchingPurchaseRef.current = false
      console.log('📦 Purchase history loading completed')
    }
  }

  // Load history data when product or customer changes
  useEffect(() => {
    console.log('🔄 ===== HISTORY LOADING TRIGGERED =====')
    console.log('🔄 Selected Item ID:', selectedItemId)
    console.log('🔄 Selected Customer:', selectedCustomer)
    console.log('🔄 Customer ID:', selectedCustomer?.customer_id || selectedCustomer?.name)
    console.log('🔄 Current Product Subtab:', productSubTab)

    if (selectedItemId) {
      console.log('🔄 Product/Customer changed, loading history data...')

      // Load histories when product or customer changes
      console.log('🔄 Calling fetchSalesHistory with:', selectedItemId)
      console.log('🔄 Calling fetchCustomerHistory with:', selectedItemId)
      console.log('🔄 Calling fetchPurchaseHistory with:', selectedItemId)
      fetchSalesHistory(selectedItemId)
      fetchCustomerHistory(selectedItemId)
      fetchPurchaseHistory(selectedItemId)
    } else {
      console.log('🔄 No product selected, clearing history data...')
      // Clear history when no product is selected
      setSalesHistory([])
      setCustomerHistory([])
      setPurchaseHistory([])
    }
    // reset pagination on product or customer change
    setSalesHistoryPage(1)
    setCustomerHistoryPage(1)
    setPurchaseHistoryPage(1)
    salesHasMoreRef.current = true
    customerHasMoreRef.current = true
    purchaseHasMoreRef.current = true
  }, [selectedItemId, selectedCustomer])

  // Reset customer/most pagination when customer tab switches or customer changes
  useEffect(() => {
    setRecentPage(1)
    setRecentHasMore(true)
    setMostPage(1)
    setMostHasMore(true)
  }, [customerSubTab, selectedCustomer?.name])

  // Load history data when subtab changes
  useEffect(() => {
    console.log('🔄 ===== SUBTAB CHANGED =====')
    console.log('🔄 Current Product Subtab:', productSubTab)
    console.log('🔄 Selected Item ID:', selectedItemId)
    console.log('🔄 Selected Customer:', selectedCustomer)

    if (selectedItemId) {
      if (productSubTab === 'sales-history') {
        console.log('🔄 Sales History tab active, fetching sales history...')
        fetchSalesHistory(selectedItemId)
      } else if (productSubTab === 'customer-history') {
        console.log('🔄 Customer History tab active, fetching customer history...')
        fetchCustomerHistory(selectedItemId)
      } else if (productSubTab === 'purchase-history') {
        console.log('🔄 Purchase History tab active, fetching purchase history...')
        fetchPurchaseHistory(selectedItemId)
      }
    }
  }, [productSubTab])

  // Live warehouse stock fetched from backend (for all UOMs)
  const [stockLoading, setStockLoading] = useState(false)
  const [stockError, setStockError] = useState<string | null>(null)
  const [warehouseStock, setWarehouseStock] = useState<{ name: string; quantities: Array<{ uom: string; qty: number }> }[]>([])

  // Product list API data for on-hand units
  const [productListData, setProductListData] = useState<any>(null)
  const [productListLoading, setProductListLoading] = useState(false)

  // Unified product data used by the Product tab UI
  const productData = (() => {
    const code = productListData?.item_id || selectedItem?.item_code || ''
    const name = productListData?.item_name || selectedItem?.item_name || ''
    const defaultUom = productListData?.default_uom || 'Nos'
    // Use the selected item's current UOM if available, otherwise use default
    const displayUom = currentUom || defaultUom
    const uomDetails = Array.isArray(productListData?.uom_details)
      ? productListData.uom_details
      : []
    const rateFromApi = uomDetails.length > 0 ? Number(uomDetails[0]?.rate || 0) : undefined
    const standardRate = Number(
      rateFromApi ?? selectedItem?.standard_rate ?? 0
    )
    // Calculate on-hand qty for the current UOM (selected item's UOM)
    const onHandQty = (() => {
      if (!uomDetails || uomDetails.length === 0) return 0
      const match = uomDetails.find(
        (d: any) => String(d.uom).toLowerCase() === String(displayUom).toLowerCase()
      )
      return Number(match?.qty || 0)
    })()
    return {
      item_code: code,
      item_name: name,
      standard_rate: standardRate,
      on_hand: onHandQty,
      on_hand_uom: displayUom, // Include the UOM for display
      cost: Number(productListData?.cost_price || 0),
      margin: Number(productListData?.margin || 0),
      warehouses: Array.isArray(productListData?.warehouses) ? productListData.warehouses : [],
      category: productListData?.item_group || '',
      location: (productListData as any)?.location || ''
    }
  })()

  // Product history states
  const [salesHistory, setSalesHistory] = useState<any[]>([])
  const [customerHistory, setCustomerHistory] = useState<any[]>([])
  const [purchaseHistory, setPurchaseHistory] = useState<any[]>([])
  const [salesHistoryLoading, setSalesHistoryLoading] = useState(false)
  const [customerHistoryLoading, setCustomerHistoryLoading] = useState(false)
  const [purchaseHistoryLoading, setPurchaseHistoryLoading] = useState(false)
  const [salesHistorySearch, setSalesHistorySearch] = useState('')
  const [customerHistorySearch, setCustomerHistorySearch] = useState('')
  const [purchaseHistorySearch, setPurchaseHistorySearch] = useState('')

  // Customer tab search states
  const [recentOrdersSearch, setRecentOrdersSearch] = useState('')
  const [mostOrderedSearch, setMostOrderedSearch] = useState('')

  // Orders tab search states
  const [ordersSearch, setOrdersSearch] = useState('')
  const [returnsSearch, setReturnsSearch] = useState('')

  // Recent orders for selected customer
  const [recentOrders, setRecentOrders] = useState<any[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersError, setOrdersError] = useState<string | null>(null)
  const [recentPage, setRecentPage] = useState(1)
  const [recentHasMore, setRecentHasMore] = useState(true)

  // Most ordered products for selected customer
  const [mostOrdered, setMostOrdered] = useState<any[]>([])
  const [mostLoading, setMostLoading] = useState(false)
  const [mostError, setMostError] = useState<string | null>(null)
  const [mostPage, setMostPage] = useState(1)
  const [mostHasMore, setMostHasMore] = useState(true)

  // Customer details and insights
  const [customerDetails, setCustomerDetails] = useState<any>(null)
  const [customerInsights, setCustomerInsights] = useState<any>(null)
  const [customerDetailsLoading, setCustomerDetailsLoading] = useState(false)
  const [customerDetailsError, setCustomerDetailsError] = useState<string | null>(null)

  // Edit customer dialog state
  const [editOpen, setEditOpen] = useState(false)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editForm, setEditForm] = useState<any>({
    customer_id: '',
    customer_name: '',
    customer_name_arabic: '',
    email: '',
    mobile: '',
    customer_type: 'Individual',
    tax_id: '',
    customer_id_type_for_zatca: '',
    customer_id_number_for_zatca: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    pincode: ''
  })

  // Orders/Returns lists with pagination
  const [ordersList, setOrdersList] = useState<any[]>([])
  const [returnsList, setReturnsList] = useState<any[]>([])
  const [ordersTabLoading, setOrdersTabLoading] = useState(false)
  const [ordersTabError, setOrdersTabError] = useState<string | null>(null)
  const [ordersPage, setOrdersPage] = useState(1)
  const [returnsPage, setReturnsPage] = useState(1)
  const [pageLength, setPageLength] = useState(10)

  // Profile data and dropdown
  const [profileData, setProfileData] = useState<any>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)

  // Filter customer history based on search
  const filteredCustomerHistory = useMemo(() => {
    if (!customerHistorySearch.trim()) return customerHistory

    const searchTerm = customerHistorySearch.toLowerCase()
    return customerHistory.filter(
      (item: any) =>
        item.sales_order_no?.toLowerCase().includes(searchTerm) ||
        item.invoice_no?.toLowerCase().includes(searchTerm) ||
        item.quantity?.toString().includes(searchTerm) ||
        item.unit_price?.toString().includes(searchTerm) ||
        item.total_amount?.toString().includes(searchTerm) ||
        item.creation_datetime?.toLowerCase().includes(searchTerm)
    )
  }, [customerHistory, customerHistorySearch])

  // Filter purchase history based on search
  const filteredPurchaseHistory = useMemo(() => {
    if (!purchaseHistorySearch.trim()) return purchaseHistory

    const searchTerm = purchaseHistorySearch.toLowerCase()
    return purchaseHistory.filter(
      (item: any) =>
        item.invoice_no?.toLowerCase().includes(searchTerm) ||
        item.purchase_order_no?.toLowerCase().includes(searchTerm) ||
        item.qty?.toString().includes(searchTerm) ||
        item.unit_price?.toString().includes(searchTerm) ||
        item.total_amount?.toString().includes(searchTerm) ||
        item.creation_datetime?.toLowerCase().includes(searchTerm)
    )
  }, [purchaseHistory, purchaseHistorySearch])

  // Filter recent orders based on search
  const filteredRecentOrders = useMemo(() => {
    if (!recentOrdersSearch.trim()) return recentOrders

    const searchTerm = recentOrdersSearch.toLowerCase()
    return recentOrders.filter(
      (order: any) =>
        order.invoice_no?.toLowerCase().includes(searchTerm) ||
        order.sales_order_no?.toLowerCase().includes(searchTerm) ||
        order.total_qty?.toString().includes(searchTerm) ||
        order.total_amount?.toString().includes(searchTerm) ||
        order.status?.toLowerCase().includes(searchTerm) ||
        order.creation_datetime?.toLowerCase().includes(searchTerm)
    )
  }, [recentOrders, recentOrdersSearch])

  // Filter most ordered based on search
  const filteredMostOrdered = useMemo(() => {
    if (!mostOrderedSearch.trim()) return mostOrdered

    const searchTerm = mostOrderedSearch.toLowerCase()
    return mostOrdered.filter(
      (item: any) =>
        item.item_name?.toLowerCase().includes(searchTerm) ||
        item.item_code?.toLowerCase().includes(searchTerm) ||
        item.total_qty?.toString().includes(searchTerm) ||
        item.avg_price?.toString().includes(searchTerm) ||
        item.total_price?.toString().includes(searchTerm)
    )
  }, [mostOrdered, mostOrderedSearch])

  // Filter orders based on search (current page only)
  const filteredOrders = useMemo(() => {
    const orders = ordersList
    if (!ordersSearch.trim()) return orders

    const searchTerm = ordersSearch.toLowerCase()
    return orders.filter(
      (order: any) =>
        order.invoice_no?.toLowerCase().includes(searchTerm) ||
        order.sales_order_no?.toLowerCase().includes(searchTerm) ||
        order.total_qty?.toString().includes(searchTerm) ||
        order.total_amount?.toString().includes(searchTerm) ||
        order.status?.toLowerCase().includes(searchTerm) ||
        order.creation_datetime?.toLowerCase().includes(searchTerm)
    )
  }, [ordersList, ordersSearch])

  // Filter returns based on search (current page only)
  const filteredReturns = useMemo(() => {
    const returns = returnsList
    if (!returnsSearch.trim()) return returns

    const searchTerm = returnsSearch.toLowerCase()
    return returns.filter(
      (order: any) =>
        order.invoice_no?.toLowerCase().includes(searchTerm) ||
        order.sales_order_no?.toLowerCase().includes(searchTerm) ||
        order.total_qty?.toString().includes(searchTerm) ||
        order.total_amount?.toString().includes(searchTerm) ||
        order.status?.toLowerCase().includes(searchTerm) ||
        order.creation_datetime?.toLowerCase().includes(searchTerm)
    )
  }, [returnsList, returnsSearch])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showProfileDropdown) {
        const target = event.target as Element
        if (!target.closest('.profile-dropdown')) {
          setShowProfileDropdown(false)
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showProfileDropdown])

  useEffect(() => {
    let cancelled = false
    async function loadStock() {
      if (!selectedItem?.item_code) {
        setWarehouseStock([])
        return
      }
      try {
        setStockLoading(true)
        setStockError(null)
        // Use item_id from productListData if available, otherwise use item_code
        const itemId = productListData?.item_id || selectedItem.item_code
        console.log('🔍 Loading stock for item:')
        console.log('  - selectedItem.item_code:', selectedItem.item_code)
        console.log('  - productListData?.item_id:', productListData?.item_id)
        console.log('  - Using item_id:', itemId)
        console.log('  - Current UOM:', currentUom)
        console.log('🔍 API Call: /api/method/centro_pos_apis.api.product.item_stock_warehouse_list')
        console.log('🔍 API Params:', {
          item_id: itemId,
          search_text: '',
          limit_start: 0,
          limit_page_length: 20
        })
        const res = await window.electronAPI?.proxy?.request({
          url: '/api/method/centro_pos_apis.api.product.item_stock_warehouse_list',
          params: {
            item_id: itemId,
            search_text: '',
            limit_start: 0,
            limit_page_length: 20
          }
        })
        console.log('📦 Stock API Response:')
        console.log('  - Full response:', res)
        console.log('  - Response success:', res?.success)
        console.log('  - Response status:', res?.status)
        console.log('  - Response data:', res?.data)
        console.log('  - Response data.data:', res?.data?.data)
        const list = Array.isArray(res?.data?.data) ? res.data.data : []
        console.log('  - Parsed list length:', list.length)
        console.log('  - Parsed list:', list)
        // Store all UOMs and quantities for each warehouse
        const mapped = list.map((w: any) => {
          const q = Array.isArray(w.quantities) ? w.quantities : []
          const quantities = q.map((qq: any) => ({
            uom: String(qq.uom || ''),
            qty: Number(qq.qty || 0)
          })).filter((qty: any) => qty.qty > 0) // Only show UOMs with quantity > 0
          return { 
            name: w.warehouse, 
            quantities: quantities
          }
        }).filter((w: any) => w.quantities.length > 0) // Only show warehouses with stock
        console.log('🗂️ Mapped warehouses with all UOMs:', mapped)
        if (!cancelled)
          setWarehouseStock(mapped)

          // Add test command to window for debugging
        ;(window as any).testStockAPI = async (itemCode: string) => {
          try {
            const res = await window.electronAPI?.proxy?.request({
              url: '/api/method/centro_pos_apis.api.product.item_stock_warehouse_list',
              params: {
                item_id: itemCode,
                search_text: '',
                limit_start: 0,
                limit_page_length: 20
              }
            })
            console.log('🧪 Test API result:', res)
            return res
          } catch (e) {
            console.error('🧪 Test API error:', e)
            return e
          }
        }
      } catch (e: any) {
        console.error('❌ Stock loading error:', e)
        if (!cancelled) setStockError(e?.message || 'Failed to load stock')
      } finally {
        if (!cancelled) setStockLoading(false)
      }
    }
    loadStock()
    return () => {
      cancelled = true
    }
  }, [selectedItem?.item_code, productListData?.item_id])

  // Fetch recent orders when customer is selected
  useEffect(() => {
    let cancelled = false
    async function loadRecentOrders(page: number) {
      console.log('🔍 loadRecentOrders called with selectedCustomer:', selectedCustomer)
      if (!selectedCustomer) {
        console.log('❌ No selected customer, clearing orders')
        setRecentOrders([])
        return
      }
      try {
        setOrdersLoading(true)
        setOrdersError(null)
        console.log('🔍 Loading recent orders for customer:', selectedCustomer)
        console.log('🔍 Customer name from dropdown:', selectedCustomer.name)

        // Step 1: Call customer list API to get the correct customer_id
        console.log('🔍 Step 1: Fetching customer list to find correct customer_id...')
        const customerListRes = await window.electronAPI?.proxy?.request({
          url: '/api/method/centro_pos_apis.api.customer.customer_list',
          params: {
            search_term: '',
            limit_start: 1,
            limit_page_length: 50
          }
        })

        console.log('🔍 Customer list API response:', customerListRes)

        // Step 2: Find the customer where customer_name matches selectedCustomer.name
        const customers = customerListRes?.data?.data || []
        console.log('🔍 Available customers:', customers)

        const matchingCustomer = customers.find(
          (c: any) => c.customer_name === selectedCustomer.name
        )
        console.log('🔍 Matching customer found:', matchingCustomer)

        if (!matchingCustomer) {
          console.log('❌ No matching customer found in customer list')
          setOrdersError('Customer not found in system')
          return
        }

        // Step 3: Use the 'name' field as customer_id
        const customerId = matchingCustomer.name
        console.log('🔍 Selected Customer ID for recent orders API:', customerId)
        console.log(
          '🔍 API URL: /api/method/centro_pos_apis.api.customer.get_customer_recent_orders'
        )
        console.log('🔍 API Params:', {
          customer_id: customerId,
          limit_start: page,
          limit_page_length: PAGE_LEN
        })

        // Step 4: Call recent orders API with correct customer_id
        const res = await window.electronAPI?.proxy?.request({
          url: '/api/method/centro_pos_apis.api.customer.get_customer_recent_orders',
          params: {
            customer_id: customerId,
            limit_start: page,
            limit_page_length: PAGE_LEN
          }
        })
        console.log('📦 Recent orders API response:', res)
        console.log('📦 Response success:', res?.success)
        console.log('📦 Response status:', res?.status)
        console.log('📦 Response data:', res?.data)
        console.log('📦 Response data.data:', res?.data?.data)

        if (res?.success && res?.data?.data) {
          const orders = Array.isArray(res.data.data) ? res.data.data : []
          console.log('📋 Recent orders array:', orders)
          console.log('📋 Recent orders length:', orders.length)
          if (!cancelled) {
            if (orders.length === 0) {
              setRecentHasMore(false)
              // Do not move to an empty page; revert page index
              if (page > 1) setRecentPage(page - 1)
              return
            }
            // Optimistically assume possibly more if full page, then verify by probing next page
            setRecentHasMore(orders.length === PAGE_LEN)
            setRecentOrders(orders)

            if (orders.length === PAGE_LEN) {
              try {
                const probe = await window.electronAPI?.proxy?.request({
                  url: '/api/method/centro_pos_apis.api.customer.get_customer_recent_orders',
                  params: { customer_id: customerId, limit_start: page + 1, limit_page_length: PAGE_LEN }
                })
                const nextItems = Array.isArray(probe?.data?.data) ? probe.data.data : []
                setRecentHasMore(nextItems.length > 0)
              } catch (_) {
                // If probe fails, keep previous hasMore assumption
              }
            }
          }
        } else {
          console.log('❌ No orders found in response or API failed')
          if (!cancelled) {
            setRecentOrders([])
          }
        }
      } catch (err) {
        console.error('❌ Error loading recent orders:', err)
        if (!cancelled) {
          setOrdersError(err instanceof Error ? err.message : 'Failed to load recent orders')
        }
      } finally {
        if (!cancelled) {
          setOrdersLoading(false)
        }
      }
    }
    loadRecentOrders(recentPage)
    return () => {
      cancelled = true
    }
  }, [selectedCustomer?.id, recentPage])

  // Fetch most ordered when customer is selected
  useEffect(() => {
    let cancelled = false
    async function loadMostOrdered(page: number) {
      if (!selectedCustomer) {
        setMostOrdered([])
        return
      }
      try {
        setMostLoading(true)
        setMostError(null)
        // Resolve customer_id via list (same as recent orders strategy)
        const listRes = await window.electronAPI?.proxy?.request({
          url: '/api/method/centro_pos_apis.api.customer.customer_list',
          params: { search_term: '', limit_start: 1, limit_page_length: 50 }
        })
        const list = listRes?.data?.data || []
        const match = list.find((c: any) => c.customer_name === selectedCustomer.name)
        const customerId = match?.name
        if (!customerId) {
          setMostOrdered([])
          return
        }
        const res = await window.electronAPI?.proxy?.request({
          url: '/api/method/centro_pos_apis.api.customer.get_customer_most_ordered_products',
          params: { customer_id: customerId, limit_start: page, limit_page_length: PAGE_LEN }
        })
        const items = Array.isArray(res?.data?.data) ? res.data.data : []
        if (!cancelled) {
          if (items.length === 0) {
            setMostHasMore(false)
            if (page > 1) setMostPage(page - 1)
            return
          }
          setMostHasMore(items.length === PAGE_LEN)
          setMostOrdered(items)

          if (items.length === PAGE_LEN) {
            try {
              const probe = await window.electronAPI?.proxy?.request({
                url: '/api/method/centro_pos_apis.api.customer.get_customer_most_ordered_products',
                params: { customer_id: customerId, limit_start: page + 1, limit_page_length: PAGE_LEN }
              })
              const nextItems = Array.isArray(probe?.data?.data) ? probe.data.data : []
              setMostHasMore(nextItems.length > 0)
            } catch (_) {
              // ignore probe failure
            }
          }
        }
      } catch (e: any) {
        if (!cancelled) setMostError(e?.message || 'Failed to load most ordered')
      } finally {
        if (!cancelled) setMostLoading(false)
      }
    }
    loadMostOrdered(mostPage)
    return () => {
      cancelled = true
    }
  }, [selectedCustomer?.name, mostPage])

  // Fetch customer details and insights when customer is selected
  useEffect(() => {
    let cancelled = false
    async function loadCustomerDetails() {
      if (!selectedCustomer) {
        setCustomerDetails(null)
        setCustomerInsights(null)
        return
      }
      try {
        setCustomerDetailsLoading(true)
        setCustomerDetailsError(null)

        // Step 1: Get customer ID from customer list
        const listRes = await window.electronAPI?.proxy?.request({
          url: '/api/method/centro_pos_apis.api.customer.customer_list',
          params: { search_term: '', limit_start: 1, limit_page_length: 50 }
        })
        const list = listRes?.data?.data || []
        const match = list.find((c: any) => c.customer_name === selectedCustomer.name)
        const customerId = match?.name

        if (!customerId) {
          setCustomerDetails(null)
          setCustomerInsights(null)
          return
        }

        // Step 2: Fetch customer details
        const detailsRes = await window.electronAPI?.proxy?.request({
          url: `/api/resource/Customer/${customerId}`,
          params: {}
        })

        // Step 3: Fetch customer insights
        const insightsRes = await window.electronAPI?.proxy?.request({
          url: '/api/method/centro_pos_apis.api.customer.customer_amount_insights',
          params: { customer_id: customerId }
        })

        if (!cancelled) {
          setCustomerDetails(detailsRes?.data?.data || null)
          setCustomerInsights(insightsRes?.data?.data || null)
        }
      } catch (e: any) {
        if (!cancelled) {
          setCustomerDetailsError(e?.message || 'Failed to load customer details')
        }
      } finally {
        if (!cancelled) {
          setCustomerDetailsLoading(false)
        }
      }
    }
    loadCustomerDetails()
    return () => {
      cancelled = true
    }
  }, [selectedCustomer?.name])

  // PATCH 1: Add page size state
  const pageSizeOptions = [10, 25, 50];

  // PATCH 2: Refetch and reset page on pageLength change
  useEffect(() => {
    setOrdersPage(1);
  }, [pageLength]);
  useEffect(() => {
    setReturnsPage(1);
  }, [pageLength]);

  // PATCH 3: Console.log API responses, use limit_start = page
  useEffect(() => {
    let cancelled = false;
    async function loadOrdersPaginated(page: number) {
      try {
        setOrdersTabLoading(true);
        setOrdersTabError(null);
            const res = await window.electronAPI?.proxy?.request({
          url: '/api/method/centro_pos_apis.api.order.order_list',
              params: {
            is_returned: 0,
            limit_start: page,
            limit_page_length: pageLength
          },
        });
        console.log('Orders API result:', res);
        if (!cancelled) {
          const data = Array.isArray(res?.data?.data) ? res.data.data : [];
          setOrdersList(data);
          // PATCH 4: Store total (API: res.data.total or data.length fallback)
          setOrdersTotal(typeof res?.data?.total === 'number' ? res.data.total : data.length);
        }
      } catch (err) {
        if (!cancelled) setOrdersTabError(err instanceof Error ? err.message : 'Failed to load orders');
      } finally {
        if (!cancelled) setOrdersTabLoading(false);
        }
      }
    if (activeTab === 'orders' && subTab === 'orders') {
      loadOrdersPaginated(ordersPage);
    }
    return () => {
      cancelled = true;
    };
  }, [ordersPage, pageLength, activeTab, subTab]);

  useEffect(() => {
    let cancelled = false;
    async function loadReturnsPaginated(page: number) {
      try {
        setOrdersTabLoading(true);
        setOrdersTabError(null);
        const res = await window.electronAPI?.proxy?.request({
          url: '/api/method/centro_pos_apis.api.order.order_list',
          params: {
            is_returned: 1,
            limit_start: page,
            limit_page_length: pageLength
          },
        });
        console.log('Returns API result:', res);
          if (!cancelled) {
          const data = Array.isArray(res?.data?.data) ? res.data.data : [];
          setReturnsList(data);
          setReturnsTotal(typeof res?.data?.total === 'number' ? res.data.total : data.length);
        }
      } catch (err) {
        if (!cancelled) setOrdersTabError(err instanceof Error ? err.message : 'Failed to load returns');
      } finally {
        if (!cancelled) setOrdersTabLoading(false);
        }
      }
    if (activeTab === 'orders' && subTab === 'returns') {
      loadReturnsPaginated(returnsPage);
    }
    return () => {
      cancelled = true;
    };
  }, [returnsPage, pageLength, activeTab, subTab]);

  // PATCH 5: Show total state for orders/returns
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [returnsTotal, setReturnsTotal] = useState(0);

  // PATCH 6: Add dropdown and show total above each list
  // ... in the JSX for Orders list, above the result count ...
  <div className="flex items-center justify-between mb-2">
    <span className="text-xs text-gray-500">{ordersTotal} results found</span>
    <select
      value={pageLength}
      onChange={e => setPageLength(Number(e.target.value))}
      className="text-xs border rounded px-2 py-1"
    >
      {pageSizeOptions.map(opt => (
        <option key={opt} value={opt}>{opt} / page</option>
      ))}
    </select>
  </div>
  // ... and similarly for Returns list, use returnsTotal.

  return (
    <div className="w-[480px] bg-white/60 backdrop-blur border-l border-white/20 flex flex-col overflow-y-auto scrollbar-hide">
      <div className="flex justify-end border-b border-gray-200/60 bg-white/80 pl-2 pr-2">
        <button
          className={`px-4 py-3 font-semibold text-sm border-b-3 ${
            activeTab === 'product'
              ? 'border-accent bg-white/90 text-accent'
              : 'border-transparent text-gray-500 hover:text-black hover:bg-white/40 transition-all'
          }`}
          onClick={() => handleTabChange('product')}
        >
          Product
        </button>
        <button
          className={`px-4 py-3 font-medium text-sm border-b-3 ${
            activeTab === 'customer'
              ? 'border-accent bg-white/90 text-accent font-semibold'
              : 'border-transparent text-gray-500 hover:text-black hover:bg-white/40 transition-all'
          }`}
          onClick={() => handleTabChange('customer')}
        >
          Customer
        </button>
        <button
          className={`px-4 py-3 font-medium text-sm border-b-3 ${
            activeTab === 'prints'
              ? 'border-accent bg-white/90 text-accent font-semibold'
              : 'border-transparent text-gray-500 hover:text-black hover:bg-white/40 transition-all'
          }`}
          onClick={() => handleTabChange('prints')}
        >
          Prints
        </button>
        <button
          className={`px-4 py-3 font-medium text-sm border-b-3 ${
            activeTab === 'payments'
              ? 'border-accent bg-white/90 text-accent font-semibold'
              : 'border-transparent text-gray-500 hover:text-black hover:bg-white/40 transition-all'
          }`}
          onClick={() => handleTabChange('payments')}
        >
          Payments
        </button>
        <button
          className={`px-4 py-3 font-medium text-sm border-b-3 ${
            activeTab === 'orders'
              ? 'border-accent bg-white/90 text-accent font-semibold'
              : 'border-transparent text-gray-500 hover:text-black hover:bg-white/40 transition-all'
          }`}
          onClick={() => handleTabChange('orders')}
        >
          Orders
        </button>

        {/* Profile Circle */}
        <div className="relative ml-2 mr-2 flex items-center">
          <button
            className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-semibold hover:from-blue-600 hover:to-purple-700 transition-all"
            onClick={() => setShowProfileDropdown(!showProfileDropdown)}
          >
            {profileLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : profileData?.name ? (
              profileData.name.substring(0, 2).toUpperCase()
            ) : (
              'U'
            )}
          </button>

          {/* Profile Dropdown */}
          {showProfileDropdown && (
            <div
              className="absolute right-0 top-10 bg-white rounded-lg shadow-lg border border-gray-200 py-2 min-w-48 z-50"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-2 border-b border-gray-100">
                <div className="text-sm font-semibold text-gray-800">
                  {profileData?.name || 'User Profile'}
                </div>
                <div className="text-xs text-gray-500">{profileData?.company || 'Company'}</div>
              </div>
              <button
                className="w-full px-4 py-2 text-left text-sm font-semibold text-black hover:bg-gray-100 transition-colors"
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  console.log('=== DROPDOWN LOGOUT BUTTON MOUSE DOWN ===')
                }}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  console.log('=== DROPDOWN LOGOUT BUTTON CLICKED ===')

                  // Don't close dropdown immediately - let logout handle it

                  const performLogout = async () => {
                    try {
                      // Clear the auth store
                      console.log('1. Calling logout from store...')
                      logout()
                      console.log('2. Store logout completed')

                      // Also clear the proxy session
                      console.log('3. Calling proxy logout...')
                      await window.electronAPI?.proxy?.logout()
                      console.log('4. Proxy logout completed')

                      // Clear only authentication-related localStorage (preserve POS tabs)
                      console.log('5. Clearing authentication data...')
                      localStorage.removeItem('userData')
                      localStorage.removeItem('auth-store')
                      console.log('6. Authentication data cleared, POS tabs preserved')

                      // Close dropdown
                      setShowProfileDropdown(false)
                      console.log('7. Dropdown closed')

                      // FORCE reload to login page
                      console.log('8. Reloading page to login...')
                      window.location.href = '/'
                      console.log('9. Page reload initiated')
                    } catch (error) {
                      console.error('=== DROPDOWN LOGOUT FAILED ===', error)
                      // Force reload even if logout fails
                      console.log('Fallback: Force reloading page...')
                      setShowProfileDropdown(false)
                      localStorage.removeItem('userData')
                      localStorage.removeItem('auth-store')
                      window.location.href = '/'
                    }
                  }

                  // Execute logout
                  performLogout()
                }}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {activeTab === 'product' && (
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {!selectedItem ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-600 mb-2">
                  Select an item to view details
                </h3>
                <p className="text-sm text-gray-500">
                  Choose a product from the items table to see pricing, stock, and other
                  information.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Product Overview */}
              <div className="p-4 border-b border-gray-200/60 bg-white/90">
                <div className="flex">
                  <div className="w-32 h-32 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl mb-4 flex items-center justify-center">
                    <div className="w-24 h-24 bg-blue-600 text-white rounded-lg flex items-center justify-center font-bold">
                      {productData.item_code.substring(0, 3).toUpperCase()}
                    </div>
                  </div>
                  <div className="space-y-2 ml-4">
                    <div className="font-bold text-lg text-primary">{productData.item_code}</div>
                    <div className="font-semibold text-gray-800">{productData.item_name}</div>
                    <div className="text-sm text-gray-600">Category: {productData.category}</div>
                    <div className="text-sm text-gray-600">Location: {productData.location}</div>
                  </div>
                </div>
              </div>

              {/* Pricing & Stock */}
              <div className="p-4 border-b border-gray-200/60 bg-white/90">
                <h4 className="font-bold text-gray-800 mb-3">Pricing & Stock</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
                    <div className="text-xs text-gray-600">Unit Price</div>
                    <div className="font-bold text-blue-600">
                      {currencySymbol} {productData.standard_rate.toFixed(2)}
                    </div>
                  </div>
                  <div className="p-3 bg-gradient-to-r from-red-50 to-pink-50 rounded-xl">
                    <div className="text-xs text-gray-600">On Hand</div>
                    {productListLoading ? (
                      <div className="font-bold text-gray-500">Loading...</div>
                    ) : (
                      <div className="font-bold text-red-600">{productData.on_hand} {productData.on_hand_uom || 'units'}</div>
                    )}
                  </div>
                  {!hideCostAndMargin && (
                    <>
                  <div className="p-3 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-xl">
                    <div className="text-xs text-gray-600">Cost</div>
                    <div className="font-bold text-orange-600">
                      {currencySymbol} {productData.cost.toFixed(2)}
                    </div>
                  </div>
                  <div className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl">
                    <div className="text-xs text-gray-600">Margin</div>
                    <div className="font-bold text-purple-600">
                      {productData.margin.toFixed(1)}%
                    </div>
                  </div>
                    </>
                  )}
                </div>
              </div>

              {/* Stock Details */}
              <div className="p-4 border-b border-gray-200/60 bg-white/90">
                <h4 className="font-bold text-gray-800 mb-3">Stock Details</h4>
                <div className="space-y-2">
                  {stockLoading && <div className="text-xs text-gray-500">Loading stock...</div>}
                  {stockError && <div className="text-xs text-red-600">{stockError}</div>}
                  {!stockLoading &&
                    !stockError &&
                    warehouseStock.length > 0 &&
                    warehouseStock.map((warehouse, index) => (
                      <div
                        key={index}
                        className="p-2 bg-gradient-to-r from-gray-50 to-slate-50 rounded-lg text-xs"
                      >
                        <div className="flex justify-between items-center">
                          <div className="font-semibold text-primary">{warehouse.name}</div>
                          <div className="flex items-center gap-2 flex-wrap justify-end">
                            {warehouse.quantities.map((qtyItem, qtyIndex) => (
                              <span key={qtyIndex} className="text-green-600">
                                <span className="font-semibold">Qty: {qtyItem.qty}</span>
                                <span className="text-[10px] text-gray-500 font-normal ml-1">{qtyItem.uom}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  {!stockLoading && !stockError && warehouseStock.length === 0 && (
                    <div className="text-xs text-gray-500 text-center py-4">No stock available</div>
                  )}
                </div>
              </div>

              {/* Product History Section */}
              <div className="bg-white/90 mt-2">
                <div className="flex border-b border-gray-200/60">
                  <button
                    className={`flex-1 px-4 py-3 font-bold text-sm border-b-2 ${
                      productSubTab === 'sales-history'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'text-gray-500 hover:text-black hover:bg-white/40'
                    }`}
                    onClick={() => {
                      console.log('🔄 Switching to Sales History tab')
                      setProductSubTab('sales-history')
                      if (selectedItemId) {
                        console.log('🔄 Triggering sales history fetch from tab click')
                        fetchSalesHistory(selectedItemId)
                      }
                    }}
                  >
                    Sales History
                  </button>
                  <button
                    className={`flex-1 px-4 py-3 font-bold text-sm border-b-2 ${
                      productSubTab === 'customer-history'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'text-gray-500 hover:text-black hover:bg-white/40'
                    }`}
                    onClick={() => {
                      console.log('🔄 Switching to Customer History tab')
                      setProductSubTab('customer-history')
                      if (selectedItemId) {
                        console.log('🔄 Triggering customer history fetch from tab click')
                        fetchCustomerHistory(selectedItemId)
                      }
                    }}
                  >
                    Customer History
                  </button>
                  <button
                    className={`flex-1 px-4 py-3 font-bold text-sm border-b-2 ${
                      productSubTab === 'purchase-history'
                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                        : 'text-gray-500 hover:text-black hover:bg-white/40'
                    }`}
                    onClick={() => {
                      console.log('🔄 Switching to Purchase History tab')
                      setProductSubTab('purchase-history')
                      if (selectedItemId) {
                        console.log('🔄 Triggering purchase history fetch from tab click')
                        fetchPurchaseHistory(selectedItemId)
                      }
                    }}
                  >
                    Purchase History
                  </button>
                </div>

                {/* Sales History Tab */}
                {productSubTab === 'sales-history' && (
                  <div className="p-4">
                    <div className="text-xs text-gray-500 mb-2">
                      Sales history for {selectedItem?.item_name || selectedItemId || 'selected product'}
                    </div>

                    {/* Search Bar */}
                    <div className="relative mb-4">
                      <input
                        type="text"
                        placeholder="Search sales history..."
                        value={salesHistorySearch}
                        onChange={(e) => setSalesHistorySearch(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <svg
                          className="w-4 h-4 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                          />
                        </svg>
                      </div>
                    </div>

                    {/* Sales History Content */}
                    <div ref={salesHistoryScrollRef} className="max-h-64 overflow-y-auto scrollbar-hide">
                      {salesHistoryLoading ? (
                        <div className="text-center py-4">
                          <div className="text-sm text-gray-500">Loading sales history...</div>
                        </div>
                      ) : salesHistory.length === 0 ? (
                        <div className="text-center py-4">
                          <div className="text-sm text-gray-500">No sales history found</div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {salesHistory
                            .filter((item: any) => {
                              if (!salesHistorySearch) return true
                              const searchLower = salesHistorySearch.toLowerCase()
                              return (
                                item.sales_order_no?.toLowerCase().includes(searchLower) ||
                                item.invoice_no?.toLowerCase().includes(searchLower)
                              )
                            })
                            .map((item: any, index: number) => {
                              const formatDate = (dateString: string) => {
                                if (!dateString) return 'N/A'
                                const date = new Date(dateString)
                                const day = String(date.getDate()).padStart(2, '0')
                                const month = String(date.getMonth() + 1).padStart(2, '0')
                                const year = date.getFullYear()
                                return `${day}/${month}/${year}`
                              }
                              return (
                                <div
                                  key={index}
                                  className="p-3 bg-gradient-to-r from-blue-50 to-slate-50 rounded-lg border border-blue-100"
                                >
                                  <div className="flex justify-between items-start mb-1">
                                    <div className="font-semibold text-black text-xs">
                                      {item.sales_order_no || 'N/A'}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {item.creation_datetime
                                        ? formatDate(item.creation_datetime)
                                        : 'N/A'}
                                    </div>
                                  </div>
                                  <div className="text-xs text-gray-600">
                                    Qty: {item.qty || 0} | Unit Price: {Number(item.unit_price || 0).toFixed(2)}{' '}
                                    {currencySymbol}
                                  </div>
                                </div>
                              )
                            })}
                        </div>
                      )}
                    </div>

                    {/* Pagination Controls */}
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                      <button
                        className={`px-3 py-1 text-sm rounded border ${
                          salesHistoryPage > 1 ? 'bg-white hover:bg-gray-50' : 'opacity-40 cursor-not-allowed'
                        }`}
                        disabled={salesHistoryPage <= 1}
                        onClick={() => {
                          const prev = Math.max(1, salesHistoryPage - 1)
                          setSalesHistoryPage(prev)
                          fetchSalesHistory(selectedItemId as string, prev)
                          salesHistoryScrollRef.current?.scrollTo({ top: 0 })
                        }}
                      >
                        Prev
                      </button>
                      <div className="text-sm text-gray-600">Page {salesHistoryPage}</div>
                      <button
                        className={`px-3 py-1 text-sm rounded border ${
                          salesHasMoreRef.current ? 'bg-white hover:bg-gray-50' : 'opacity-40 cursor-not-allowed'
                        }`}
                        disabled={!salesHasMoreRef.current}
                        onClick={() => {
                          const next = salesHistoryPage + 1
                          setSalesHistoryPage(next)
                          fetchSalesHistory(selectedItemId as string, next)
                          salesHistoryScrollRef.current?.scrollTo({ top: 0 })
                        }}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}

                {/* Customer History Tab */}
                {productSubTab === 'customer-history' && (
                  <div className="p-4">
                    <div className="text-xs text-gray-500 mb-2">
                      {selectedCustomer
                        ? `Customer history for ${selectedCustomer.name}`
                        : 'Select a customer to view customer history'}
                    </div>

                    {/* Search Bar */}
                    <div className="relative mb-4">
                      <input
                        type="text"
                        placeholder="Search customer history..."
                        value={customerHistorySearch}
                        onChange={(e) => setCustomerHistorySearch(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <svg
                          className="w-4 h-4 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                          />
                        </svg>
                      </div>
                    </div>

                    {/* Customer History Content */}
                    <div ref={customerHistoryScrollRef} className="max-h-64 overflow-y-auto scrollbar-hide">
                      {!selectedCustomer ? (
                        <div className="text-center py-4">
                          <div className="text-sm text-gray-500">
                            Select a customer to view history
                          </div>
                        </div>
                      ) : customerHistoryLoading ? (
                        <div className="text-center py-4">
                          <div className="text-sm text-gray-500">Loading customer history...</div>
                        </div>
                      ) : filteredCustomerHistory.length > 0 ? (
                        <div className="space-y-2">
                          {filteredCustomerHistory.map((item, index) => {
                            const formatDate = (dateString: string) => {
                              if (!dateString) return 'N/A'
                              const date = new Date(dateString)
                              const day = String(date.getDate()).padStart(2, '0')
                              const month = String(date.getMonth() + 1).padStart(2, '0')
                              const year = date.getFullYear()
                              return `${day}/${month}/${year}`
                            }
                            return (
                              <div
                                key={index}
                                className="p-3 bg-gradient-to-r from-blue-50 to-slate-50 rounded-lg border border-blue-100"
                              >
                                <div className="flex justify-between items-start mb-1">
                                  <div className="font-semibold text-black text-xs">
                                    {item.sales_order_no || 'N/A'}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {item.creation_datetime
                                      ? formatDate(item.creation_datetime)
                                      : 'N/A'}
                                  </div>
                                </div>
                                <div className="text-xs text-gray-600">
                                  Qty: {item.quantity || item.qty || 0} | Unit Price: {Number(item.unit_price || 0).toFixed(2)}{' '}
                                  {currencySymbol}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-4">
                          <div className="text-sm text-gray-500">No customer history found</div>
                        </div>
                      )}
                    </div>
                    {/* Pager */}
                    <div className="flex items-center justify-between mt-3">
                      <button
                        className={`px-3 py-1 text-sm rounded border ${customerHistoryPage > 1 ? 'bg-white hover:bg-gray-50' : 'opacity-40 cursor-not-allowed'}`}
                        disabled={customerHistoryPage <= 1}
                        onClick={() => {
                          if (customerHistoryPage <= 1) return
                          const prev = Math.max(1, customerHistoryPage - 1)
                          setCustomerHistoryPage(prev)
                          fetchCustomerHistory(selectedItemId as string, prev)
                          customerHistoryScrollRef.current?.scrollTo({ top: 0 })
                        }}
                      >
                        Prev
                      </button>
                      <div className="text-sm text-gray-600">Page {customerHistoryPage}</div>
                      <button
                        className={`px-3 py-1 text-sm rounded border ${customerHasMoreRef.current ? 'bg-white hover:bg-gray-50' : 'opacity-40 cursor-not-allowed'}`}
                        disabled={!customerHasMoreRef.current}
                        onClick={() => {
                          if (!customerHasMoreRef.current) return
                          const next = customerHistoryPage + 1
                          setCustomerHistoryPage(next)
                          fetchCustomerHistory(selectedItemId as string, next)
                          customerHistoryScrollRef.current?.scrollTo({ top: 0 })
                        }}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}

                {/* Purchase History Tab */}
                {productSubTab === 'purchase-history' && (
                  <div className="p-4">
                    <div className="text-xs text-gray-500 mb-2">
                      Purchase history for selected product
                    </div>

                    {/* Search Bar */}
                    <div className="relative mb-4">
                      <input
                        type="text"
                        placeholder="Search purchase history..."
                        value={purchaseHistorySearch}
                        onChange={(e) => setPurchaseHistorySearch(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <svg
                          className="w-4 h-4 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                          />
                        </svg>
                      </div>
                    </div>

                    {/* Purchase History Content */}
                    <div ref={purchaseHistoryScrollRef} className="max-h-64 overflow-y-auto scrollbar-hide">
                      {purchaseHistoryLoading ? (
                        <div className="text-center py-4">
                          <div className="text-sm text-gray-500">Loading purchase history...</div>
                        </div>
                      ) : filteredPurchaseHistory.length > 0 ? (
                        <div className="space-y-2">
                          {filteredPurchaseHistory.map((item, index) => (
                            <div
                              key={index}
                              className="p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-100"
                            >
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <span className="font-semibold text-gray-600">Invoice:</span>
                                  <div className="font-bold text-green-700">{item.invoice_no}</div>
                                </div>
                                <div>
                                  <span className="font-semibold text-gray-600">Qty:</span>
                                  <div className="font-bold text-green-600">{item.qty}</div>
                                </div>
                                <div>
                                  <span className="font-semibold text-gray-600">Unit Price:</span>
                                  <div className="font-bold text-orange-600">
                                    {currencySymbol} {item.unit_price?.toFixed(2)}
                                  </div>
                                </div>
                                <div>
                                  <span className="font-semibold text-gray-600">Total:</span>
                                  <div className="font-bold text-purple-600">
                                    {currencySymbol} {item.total_amount?.toFixed(2)}
                                  </div>
                                </div>
                                <div className="col-span-2">
                                  <span className="font-semibold text-gray-600">Date:</span>
                                  <div className="text-gray-700">
                                    {new Date(item.creation_datetime).toLocaleString()}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4">
                          <div className="text-sm text-gray-500">No purchase history found</div>
                        </div>
                      )}
                    </div>
                    {/* Pager */}
                    <div className="flex items-center justify-between mt-3">
                      <button
                        className={`px-3 py-1 text-sm rounded border ${purchaseHistoryPage > 1 ? 'bg-white hover:bg-gray-50' : 'opacity-40 cursor-not-allowed'}`}
                        disabled={purchaseHistoryPage <= 1}
                        onClick={() => {
                          if (purchaseHistoryPage <= 1) return
                          const prev = Math.max(1, purchaseHistoryPage - 1)
                          setPurchaseHistoryPage(prev)
                          fetchPurchaseHistory(selectedItemId as string, prev)
                          purchaseHistoryScrollRef.current?.scrollTo({ top: 0 })
                        }}
                      >
                        Prev
                      </button>
                      <div className="text-sm text-gray-600">Page {purchaseHistoryPage}</div>
                      <button
                        className={`px-3 py-1 text-sm rounded border ${purchaseHasMoreRef.current ? 'bg-white hover:bg-gray-50' : 'opacity-40 cursor-not-allowed'}`}
                        disabled={!purchaseHasMoreRef.current}
                        onClick={() => {
                          if (!purchaseHasMoreRef.current) return
                          const next = purchaseHistoryPage + 1
                          setPurchaseHistoryPage(next)
                          fetchPurchaseHistory(selectedItemId as string, next)
                          purchaseHistoryScrollRef.current?.scrollTo({ top: 0 })
                        }}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'customer' && (
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="p-4 border-b border-gray-200/60 bg-white/90">
            {customerDetailsLoading && (
              <div className="text-center py-4">
                <div className="text-sm text-gray-500">Loading customer details...</div>
              </div>
            )}
            {customerDetailsError && (
              <div className="text-center py-4">
                <div className="text-sm text-red-600">{customerDetailsError}</div>
              </div>
            )}
            {!customerDetailsLoading && !customerDetailsError && customerDetails && (
              <>
                <div className="flex items-center gap-4 mb-6 justify-between">
                  <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-primary to-slate-700 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="user" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor">
                      <path d="M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3C0 498.7 13.3 512 29.7 512H418.3c16.4 0 29.7-13.3 29.7-29.7C448 383.8 368.2 304 269.7 304H178.3z"></path>
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">
                      {customerDetails.customer_name || 'Walking Customer'}
                    </h3>
                    <p style={{ fontSize: '12px' }} className="text-sm text-gray-600">VAT: {customerDetails.tax_id || 'Not Applicable'}</p>
                    <p style={{ fontSize: '12px' }} className="text-sm text-gray-600">Type: {customerDetails.customer_type || '—'}</p>
                    <p style={{ fontSize: '12px' }} className="text-sm text-gray-600">Mobile: {customerDetails.mobile_no || '—'}</p>
                    <p style={{ fontSize: '12px' }} className="text-sm text-gray-600">
                      ADDRESS:{' '}
                      {customerDetails.primary_address
                        ? customerDetails.primary_address
                            .replace(/<br\s*\/?>/gi, ', ')
                            .replace(/<[^>]+>/g, '')
                            .trim()
                        : 'Address not available'}
                    </p>
                  </div>
                  </div>
                  <div>
                    <button
                      className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
                      onClick={() => {
                        // populate form
                        setEditForm({
                          customer_id: customerDetails.name || selectedCustomer?.name || selectedCustomer?.customer_id,
                          customer_name: customerDetails.customer_name || '',
                          customer_name_arabic: customerDetails.customer_name_arabic || '',
                          email: customerDetails.email_id || '',
                          mobile: customerDetails.mobile_no || '',
                          customer_type: customerDetails.customer_type || 'Individual',
                          tax_id: customerDetails.tax_id || '',
                          customer_id_type_for_zatca: customerDetails.customer_id_type_for_zatca || '',
                          customer_id_number_for_zatca: customerDetails.customer_id_number_for_zatca || '',
                          address_line1: customerDetails.address_line1 || '',
                          address_line2: customerDetails.address_line2 || '',
                          city: customerDetails.city || '',
                          state: customerDetails.state || '',
                          pincode: customerDetails.pincode || ''
                        })
                        setEditOpen(true)
                      }}
                    >
                      Edit
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
                    <div className="text-xs text-gray-600">Total Invoiced</div>
                    <div className="font-bold text-blue-600">
                      {(() => {
                        const inv = Number(customerInsights?.total_invoice_amount ?? 0)
                        const ret = Number(customerInsights?.total_return_amount ?? 0)
                        const net = inv - ret
                        if (isNaN(net)) return '0.00'
                        const formattedValue = Math.abs(net).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        return net < 0 ? `-${formattedValue}` : formattedValue
                      })()}{' '}{currencySymbol}
                    </div>
                  </div>
                  <div className="p-3 bg-gradient-to-r from-red-50 to-pink-50 rounded-xl">
                    <div className="text-xs text-gray-600">Amount Due</div>
                    <div className="font-bold text-red-600">
                      {(() => {
                        const value = Number(customerInsights?.amount_due ?? 0)
                        if (isNaN(value)) return '0.00'
                        const formattedValue = Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        return value < 0 ? `-${formattedValue}` : formattedValue
                      })()}{' '}{currencySymbol}
                    </div>
                  </div>
                  <div className="p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl">
                    <div className="text-xs text-gray-600">
                      Last Payment{' '}
                      {customerInsights?.last_payment_datetime
                        ? `| ${new Date(customerInsights.last_payment_datetime).toLocaleDateString(
                            'en-US',
                            {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            }
                          )}`
                        : ''}
                    </div>
                    <div className="font-bold text-green-600">
                      {(customerInsights?.last_payment_amount?.toLocaleString() || '0.00')}{' '}{currencySymbol}
                    </div>
                  </div>
                  <div className="p-3 bg-gradient-to-r from-blue-50 to-yellow-50 rounded-xl">
                    <div className="text-xs text-gray-600">Credit Limit</div>
                    <div className="font-bold text-orange-600">
                      {(() => {
                        const value = Number(customerInsights?.total_credit_limit ?? 0)
                        if (isNaN(value)) return '0.00'
                        const formattedValue = Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        return value < 0 ? `-${formattedValue}` : formattedValue
                      })()}{' '}{currencySymbol}
                    </div>
                  </div>
                  <div className="p-3 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-xl">
                    <div className="text-xs text-gray-600">Available Credit Limit</div>
                    <div className="font-bold text-orange-600">
                      {(() => {
                        const value = Number(customerInsights?.available_credit_limit ?? 0)
                        if (isNaN(value)) return '0.00'
                        const formattedValue = Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        return value < 0 ? `-${formattedValue}` : formattedValue
                      })()}{' '}{currencySymbol}
                    </div>
                  </div>
                  <div className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl">
                    <div className="text-[10px] text-gray-600">Returns vs Invoices</div>
                    <div className="flex flex-col gap-1 mt-1">
                      <span className="text-[11px] font-semibold text-purple-700">
                        Returns:{' '}
                        {(() => {
                          const value = Number(customerInsights?.total_return_amount ?? 0)
                          if (isNaN(value)) return '0'
                          const formattedValue = Math.abs(value).toLocaleString('en-US')
                          return value < 0 ? `-${formattedValue}` : formattedValue
                        })()}{' '}{currencySymbol}
                      </span>
                      <span className="text-[11px] font-semibold text-blue-600">
                        Invoices:{' '}
                        {(() => {
                          const value = Number(customerInsights?.total_invoice_amount ?? 0)
                          if (isNaN(value)) return '0'
                          const formattedValue = Math.abs(value).toLocaleString('en-US')
                          return value < 0 ? `-${formattedValue}` : formattedValue
                        })()}{' '}{currencySymbol}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}
            {!customerDetailsLoading && !customerDetailsError && !customerDetails && (
              <div className="text-center py-4">
                <div className="text-sm text-gray-500">Select a customer to view details</div>
              </div>
            )}
          </div>

          {/* Edit Customer Dialog */}
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Edit Customer</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div className="col-span-2">
                  <label className="text-xs text-gray-600">Customer ID</label>
                  <input className="w-full border rounded px-2 py-1 text-sm" disabled value={editForm.customer_id} />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Name *</label>
                  <input className="w-full border rounded px-2 py-1 text-sm" value={editForm.customer_name} onChange={e=>setEditForm({...editForm, customer_name:e.target.value})} />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Arabic Name</label>
                  <input className="w-full border rounded px-2 py-1 text-sm" value={editForm.customer_name_arabic} onChange={e=>setEditForm({...editForm, customer_name_arabic:e.target.value})} />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Email *</label>
                  <input className="w-full border rounded px-2 py-1 text-sm" value={editForm.email} onChange={e=>setEditForm({...editForm, email:e.target.value})} />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Mobile *</label>
                  <input className="w-full border rounded px-2 py-1 text-sm" value={editForm.mobile} onChange={e=>setEditForm({...editForm, mobile:e.target.value})} />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Type *</label>
                  <select className="w-full border rounded px-2 py-1 text-sm" value={editForm.customer_type} onChange={e=>setEditForm({...editForm, customer_type:e.target.value})}>
                    <option value="Company">Company</option>
                    <option value="Individual">Individual</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-600">Tax ID {editForm.customer_type==='Company' ? '*' : '(Optional)'} </label>
                  <input className="w-full border rounded px-2 py-1 text-sm" value={editForm.tax_id} onChange={e=>setEditForm({...editForm, tax_id:e.target.value})} />
                </div>
                {editForm.customer_type==='Company' && (
                  <>
                    <div>
                      <label className="text-xs text-gray-600">Customer ID Type for ZATCA *</label>
                      <select className="w-full border rounded px-2 py-1 text-sm" value={editForm.customer_id_type_for_zatca} onChange={e=>setEditForm({...editForm, customer_id_type_for_zatca:e.target.value})}>
                        <option value="">Select ID type</option>
                        <option value="CRN">CRN</option>
                        <option value="NIN">NIN</option>
                        <option value="TIN">TIN</option>
                        <option value="MOMRA">MOMRA</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Customer ID Number for ZATCA *</label>
                      <input className="w-full border rounded px-2 py-1 text-sm" value={editForm.customer_id_number_for_zatca} onChange={e=>setEditForm({...editForm, customer_id_number_for_zatca:e.target.value})} />
                    </div>
                  </>
                )}
                <div className="col-span-2">
                  <label className="text-xs text-gray-600">Address Line 1 *</label>
                  <input className="w-full border rounded px-2 py-1 text-sm" value={editForm.address_line1} onChange={e=>setEditForm({...editForm, address_line1:e.target.value})} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-600">Address Line 2</label>
                  <input className="w-full border rounded px-2 py-1 text-sm" value={editForm.address_line2} onChange={e=>setEditForm({...editForm, address_line2:e.target.value})} />
                </div>
                <div>
                  <label className="text-xs text-gray-600">City *</label>
                  <input className="w-full border rounded px-2 py-1 text-sm" value={editForm.city} onChange={e=>setEditForm({...editForm, city:e.target.value})} />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Province *</label>
                  <input className="w-full border rounded px-2 py-1 text-sm" value={editForm.state} onChange={e=>setEditForm({...editForm, state:e.target.value})} />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Pincode *</label>
                  <input className="w-full border rounded px-2 py-1 text-sm" value={editForm.pincode} onChange={e=>setEditForm({...editForm, pincode:e.target.value})} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={()=>setEditOpen(false)}>Cancel</Button>
                <Button disabled={editSubmitting} onClick={async()=>{
                  try{
                    setEditSubmitting(true)
                    console.log('📝 Editing customer - request body:', editForm)
                    // validation
                    if(!editForm.customer_name){ toast.error('Customer name is required'); setEditSubmitting(false); return }
                    if(!editForm.email){ toast.error('Email is required'); setEditSubmitting(false); return }
                    if(!editForm.mobile){ toast.error('Mobile is required'); setEditSubmitting(false); return }
                    if(!editForm.address_line1){ toast.error('Address Line 1 is required'); setEditSubmitting(false); return }
                    if(!editForm.city){ toast.error('City is required'); setEditSubmitting(false); return }
                    if(!editForm.state){ toast.error('Province is required'); setEditSubmitting(false); return }
                    if(!editForm.pincode){ toast.error('Pincode is required'); setEditSubmitting(false); return }
                    if(editForm.customer_type==='Company'){
                      if(!editForm.tax_id){ toast.error('Tax ID is required for Company'); setEditSubmitting(false); return }
                      if(!editForm.customer_id_type_for_zatca || !editForm.customer_id_number_for_zatca){
                        toast.error('ZATCA ID Type and Number are required for Company'); setEditSubmitting(false); return
                      }
                    }
                    const res = await (window as any).electronAPI?.proxy?.request({
                      method:'POST',
                      url:'/api/method/centro_pos_apis.api.customer.edit_customer',
                      data: editForm
                    })
                    console.log('✅ Edit customer response:', res)
                    const serverMsg = res?.data?.data?.message || res?.data?.message
                    const serverError = res?.data?._server_messages
                    if (res?.success === false || res?.status >= 400 || serverError) {
                      let prettyErr = 'Update failed'
                      console.log('❌ Edit customer server error raw:', serverError)
                      try {
                        if (typeof serverError === 'string') {
                          // Try direct JSON parse
                          try {
                            const arr = JSON.parse(serverError)
                            if (Array.isArray(arr) && arr.length) {
                              const obj = arr[0]
                              if (typeof obj === 'object') {
                                if (obj.message) prettyErr = obj.message
                                else prettyErr = JSON.stringify(obj, null, 2)
                              } else if (typeof obj === 'string') {
                                prettyErr = obj
                              }
                            }
                          } catch (e1) {
                            // Try with unescaped quotes cleanup
                            const cleaned = serverError
                              .replace(/\\n/g, '\n')
                              .replace(/\\r/g, '\r')
                              .replace(/\\t/g, '\t')
                              .replace(/\\\\/g, '\\')
                              .replace(/\\\"/g, '"')
                            try {
                              const arr2 = JSON.parse(cleaned)
                              if (Array.isArray(arr2) && arr2.length) {
                                const obj2 = arr2[0]
                                if (typeof obj2 === 'object') {
                                  if (obj2.message) prettyErr = obj2.message
                                  else prettyErr = JSON.stringify(obj2, null, 2)
                                } else if (typeof obj2 === 'string') {
                                  prettyErr = obj2
                                }
                              }
                            } catch (e2) {
                              // Last resort: extract between \"message\": \" ... \"
                              const m = serverError.match(/message\\\"\s*:\s*\\\"([^\"]+)/i)
                              if (m && m[1]) prettyErr = m[1]
                            }
                          }
                        }
                      } catch (_) {}
                      // Prefer showing only the human-friendly message
                      let uiMsg = prettyErr
                      try {
                        if (prettyErr.startsWith('[')) {
                          const arr = JSON.parse(prettyErr)
                          const obj = typeof arr[0] === 'string' ? JSON.parse(arr[0]) : arr[0]
                          if (obj?.message) uiMsg = obj.message
                        } else if (prettyErr.startsWith('{')) {
                          const obj = JSON.parse(prettyErr)
                          if (obj?.message) uiMsg = obj.message
                        }
                      } catch (_) {}
                      toast.error(uiMsg)
                      setEditSubmitting(false)
                      return
                    }
                    const msg = serverMsg || 'Customer updated successfully'
                    // refresh details
                    if (selectedCustomer?.name || selectedCustomer?.customer_id || customerDetails?.name){
                      // trigger reload using existing loadCustomerDetails flow
                      try{ await (async()=>{ 
                        let cancelled=false; 
                        setCustomerDetailsLoading(true); setCustomerDetailsError(null); 
                        const listRes = await (window as any).electronAPI?.proxy?.request({url: '/api/method/centro_pos_apis.api.customer.customer_list', params:{search_term:'', limit_start:1, limit_page_length:50}})
                        const list = listRes?.data?.data || []
                        const match = list.find((c:any)=> c.customer_name === (selectedCustomer?.name || customerDetails?.customer_name))
                        const customerId = match?.name || customerDetails?.name
                        if (customerId){
                          const detailsRes = await (window as any).electronAPI?.proxy?.request({url:`/api/resource/Customer/${customerId}`, params:{}})
                          setCustomerDetails(detailsRes?.data?.data || null)
                        }
                        setCustomerDetailsLoading(false)
                      })() }catch(e){}
                    }
                    toast.success(msg)
                    setEditOpen(false)
                  }catch(err){
                    toast.error('Failed to update customer')
                  }finally{
                    setEditSubmitting(false)
                  }
                }}>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Customer insights: Recent Orders and Most Ordered */}
          <div className="bg-white/90 mt-2">
            <div className="flex border-b border-gray-200/60">
              <button
                className={`flex-1 px-4 py-3 font-bold text-sm border-b-2 ${
                  customerSubTab === 'recent'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'text-gray-500 hover:text-black hover:bg-white/40'
                }`}
                onClick={() => setCustomerSubTab('recent')}
              >
                Recent Orders
              </button>
              <button
                className={`flex-1 px-4 py-3 font-bold text-sm border-b-2 ${
                  customerSubTab === 'most'
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'text-gray-500 hover:text-black hover:bg-white/40'
                }`}
                onClick={() => setCustomerSubTab('most')}
              >
                Most Ordered
              </button>
            </div>

            {customerSubTab === 'recent' ? (
              <div className="p-4">
                <div className="text-xs text-gray-500 mb-2">
                  {selectedCustomer
                    ? `Recent orders for ${selectedCustomer.name}`
                    : 'Select a customer to view recent orders'}
                </div>

                {/* Search Bar */}
                <div className="relative mb-4">
                  <input
                    type="text"
                    placeholder="Search recent orders..."
                    value={recentOrdersSearch}
                    onChange={(e) => setRecentOrdersSearch(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <svg
                      className="w-4 h-4 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>
                </div>

                <div className="space-y-2">
                  {ordersLoading && (
                    <div className="text-xs text-gray-500 text-center py-4">
                      Loading recent orders...
                    </div>
                  )}
                  {ordersError && (
                    <div className="text-xs text-red-600 text-center py-4">{ordersError}</div>
                  )}
                  {!ordersLoading &&
                    !ordersError &&
                    filteredRecentOrders.length > 0 &&
                    filteredRecentOrders.map((order, index) => (
                      <div
                        key={index}
                        className="p-3 bg-gradient-to-r from-gray-50 to-slate-50 rounded-lg text-xs border border-gray-200"
                      >
                        <div className="flex justify-between items-center mb-2">
                          <div className="font-semibold text-primary text-sm">
                            {order.invoice_no || order.sales_order_no}
                          </div>
                          <div className="text-gray-600 text-xs">
                            {new Date(order.creation_datetime).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </div>
                        </div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-gray-600 font-medium">Qty: {order.total_qty}</span>
                          <span className="font-bold text-green-600 text-sm">
                            {currencySymbol} {order.total_amount?.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span
                            className={`text-xs px-2 py-1 rounded-full font-medium ${
                              order.status === 'Overdue'
                                ? 'bg-red-100 text-red-700'
                                : order.status === 'Paid'
                                  ? 'bg-green-100 text-green-700'
                                  : order.status === 'Draft'
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {order.status}
                          </span>
                          <span className="text-gray-500 text-xs">
                            {new Date(order.creation_datetime).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>
                    ))}
                  {!ordersLoading &&
                    !ordersError &&
                    filteredRecentOrders.length === 0 &&
                    selectedCustomer && (
                      <div className="text-xs text-gray-500 text-center py-4">
                        No recent orders found
                      </div>
                    )}
                  {/* Pager for Recent Orders */}
                  <div className="flex items-center justify-between mt-3">
                    <button
                      className={`px-3 py-1 text-sm rounded border ${recentPage > 1 ? 'bg-white hover:bg-gray-50' : 'opacity-40 cursor-not-allowed'}`}
                      disabled={recentPage <= 1}
                      onClick={() => setRecentPage(Math.max(1, recentPage - 1))}
                    >
                      Prev
                    </button>
                    <div className="text-sm text-gray-600">Page {recentPage}</div>
                    <button
                      className={`px-3 py-1 text-sm rounded border ${recentHasMore ? 'bg-white hover:bg-gray-50' : 'opacity-40 cursor-not-allowed'}`}
                      disabled={!recentHasMore}
                      onClick={() => setRecentPage(recentPage + 1)}
                    >
                      Next
                    </button>
                    </div>
                </div>
              </div>
            ) : (
              <div className="p-4">
                <div className="text-xs text-gray-500 mb-2">
                  {selectedCustomer
                    ? `Most ordered by ${selectedCustomer.name}`
                    : 'Select a customer to view most ordered products'}
                </div>

                {/* Search Bar */}
                <div className="relative mb-4">
                  <input
                    type="text"
                    placeholder="Search most ordered..."
                    value={mostOrderedSearch}
                    onChange={(e) => setMostOrderedSearch(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <svg
                      className="w-4 h-4 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>
                </div>

                <div className="space-y-2">
                  {mostLoading && (
                    <div className="text-xs text-gray-500 text-center py-4">
                      Loading most ordered...
                    </div>
                  )}
                  {mostError && (
                    <div className="text-xs text-red-600 text-center py-4">{mostError}</div>
                  )}
                  {!mostLoading &&
                    !mostError &&
                    filteredMostOrdered.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200 text-xs"
                      >
                        <div className="flex justify-between items-center">
                          <div className="font-semibold text-black">
                            {item.item_name} ({item.item_code})
                          </div>
                          <div className="text-gray-600">Qty: {item.total_qty}</div>
                        </div>
                        <div className="flex justify-between mt-1">
                          <span className="text-gray-600">Avg Price: {item.avg_price}</span>
                          <span className="font-semibold text-purple-700">
                            Total: {item.total_price}
                          </span>
                        </div>
                      </div>
                    ))}
                  {!mostLoading &&
                    !mostError &&
                    filteredMostOrdered.length === 0 &&
                    selectedCustomer && (
                      <div className="text-xs text-gray-500 text-center py-4">No data</div>
                    )}
                  {/* Pager for Most Ordered */}
                  <div className="flex items-center justify-between mt-3">
                    <button
                      className={`px-3 py-1 text-sm rounded border ${mostPage > 1 ? 'bg-white hover:bg-gray-50' : 'opacity-40 cursor-not-allowed'}`}
                      disabled={mostPage <= 1}
                      onClick={() => setMostPage(Math.max(1, mostPage - 1))}
                    >
                      Prev
                    </button>
                    <div className="text-sm text-gray-600">Page {mostPage}</div>
                    <button
                      className={`px-3 py-1 text-sm rounded border ${mostHasMore ? 'bg-white hover:bg-gray-50' : 'opacity-40 cursor-not-allowed'}`}
                      disabled={!mostHasMore}
                      onClick={() => setMostPage(mostPage + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'prints' && (
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <PrintsTabContent />
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="bg-white/90 mt-2">
            <div className="flex border-b border-gray-200/60">
              <button
                className={`flex-1 px-4 py-3 font-bold text-sm border-b-2 ${
                  subTab === 'orders'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'text-gray-500 hover:text-black hover:bg-white/40'
                }`}
                onClick={() => setSubTab('orders')}
              >
                Orders
              </button>
              <button
                className={`flex-1 px-4 py-3 font-bold text-sm border-b-2 ${
                  subTab === 'returns'
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'text-gray-500 hover:text-black hover:bg-white/40'
                }`}
                onClick={() => setSubTab('returns')}
              >
                Returns
              </button>
            </div>

            {subTab === 'orders' ? (
              <div className="p-4">
                <div className="text-xs text-gray-500 mb-2">
                  All Orders ({filteredOrders.length})
                </div>

                {/* Search Bar */}
                <div className="relative mb-4">
                  <input
                    type="text"
                    placeholder="Search orders..."
                    value={ordersSearch}
                    onChange={(e) => setOrdersSearch(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <svg
                      className="w-4 h-4 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>
                </div>

                <div className="space-y-2">
                  {ordersTabLoading && (
                    <div className="text-xs text-gray-500 text-center py-4">Loading orders...</div>
                  )}
                  {ordersTabError && (
                    <div className="text-xs text-red-600 text-center py-4">{ordersTabError}</div>
                  )}
                  {!ordersTabLoading &&
                    !ordersTabError &&
                    filteredOrders.length > 0 &&
                    filteredOrders.map((order, index) => {
                      const createdRaw = order.creation_datetime || order.creation_date || order.posting_datetime || order.posting_date
                      const createdDate = createdRaw ? new Date(String(createdRaw).replace(' ', 'T')) : null
                      const amountVal =
                        (typeof order.total_amount === 'number' ? order.total_amount : undefined) ??
                        (typeof order.grand_total === 'number' ? order.grand_total : undefined) ??
                        (typeof order.total === 'number' ? order.total : undefined) ??
                        (typeof order.amount === 'number' ? order.amount : undefined)
                      const qtyVal = order.total_qty ?? order.qty ?? order.total_quantity
                      return (
                      <div
                        key={index}
                        className="p-3 bg-gradient-to-r from-gray-50 to-slate-50 rounded-lg text-xs border border-gray-200"
                      >
                        <div className="flex justify-between items-center mb-2">
                          <div className="font-semibold text-primary text-sm">
                            {order.invoice_no || order.sales_order_no}
                          </div>
                          <div className="text-gray-600 text-xs">
                            {createdDate ? createdDate.toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            }) : '—'}
                          </div>
                        </div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-gray-600 font-medium">Qty: {qtyVal ?? '—'}</span>
                          <span className="font-bold text-green-600 text-sm">
                            {currencySymbol} {typeof amountVal === 'number' ? amountVal.toLocaleString() : '—'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span
                            className={`text-xs px-2 py-1 rounded-full font-medium ${
                              order.status === 'Overdue'
                                ? 'bg-red-100 text-red-700'
                                : order.status === 'Paid'
                                  ? 'bg-green-100 text-green-700'
                                  : order.status === 'Draft'
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {order.status}
                          </span>
                          <span className="text-gray-500 text-xs">
                            {createdDate ? createdDate.toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : '—'}
                          </span>
                        </div>
                      </div>
                    )})}
                  {!ordersTabLoading && !ordersTabError && filteredOrders.length === 0 && (
                    <div className="text-xs text-gray-500 text-center py-4">No orders found</div>
                  )}
                  <div className="flex items-center justify-between pt-3">
                    <button
                      className="px-3 py-1 text-xs border rounded disabled:opacity-40"
                      onClick={() => setOrdersPage((p) => Math.max(1, p - 1))}
                      disabled={ordersPage <= 1}
                    >
                      Prev
                    </button>
                    <div className="text-xs text-gray-600">Page {ordersPage}</div>
                    <button
                      className="px-3 py-1 text-xs border rounded disabled:opacity-40"
                      onClick={() => setOrdersPage((p) => p + 1)}
                      disabled={filteredOrders.length < pageLength}
                    >
                      Next
                    </button>
                </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500">{ordersTotal} results found</span>
                    <select
                      value={pageLength}
                      onChange={e => setPageLength(Number(e.target.value))}
                      className="text-xs border rounded px-2 py-1"
                    >
                      {pageSizeOptions.map(opt => (
                        <option key={opt} value={opt}>{opt} / page</option>
                      ))}
                    </select>
              </div>
                </div>
              </div>
            )
             : (
              <div className="p-4">
                <div className="text-xs text-gray-500 mb-2">Returns ({filteredReturns.length})</div>

                {/* Search Bar */}
                <div className="relative mb-4">
                  <input
                    type="text"
                    placeholder="Search returns..."
                    value={returnsSearch}
                    onChange={(e) => setReturnsSearch(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <svg
                      className="w-4 h-4 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>
                </div>

                <div className="space-y-2">
                  {ordersTabLoading && (
                    <div className="text-xs text-gray-500 text-center py-4">Loading returns...</div>
                  )}
                  {ordersTabError && (
                    <div className="text-xs text-red-600 text-center py-4">{ordersTabError}</div>
                  )}
                  {!ordersTabLoading &&
                    !ordersTabError &&
                    filteredReturns.length > 0 &&
                    filteredReturns.map((order, index) => {
                      const createdRaw = order.creation_datetime || order.creation_date || order.posting_datetime || order.posting_date
                      const createdDate = createdRaw ? new Date(String(createdRaw).replace(' ', 'T')) : null
                      const amountVal =
                        (typeof order.total_amount === 'number' ? order.total_amount : undefined) ??
                        (typeof order.grand_total === 'number' ? order.grand_total : undefined) ??
                        (typeof order.total === 'number' ? order.total : undefined) ??
                        (typeof order.amount === 'number' ? order.amount : undefined)
                      const qtyVal = order.total_qty ?? order.qty ?? order.total_quantity
                      return (
                      <div
                        key={index}
                        className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg text-xs border border-purple-200"
                      >
                        <div className="flex justify-between items-center mb-2">
                          <div className="font-semibold text-purple-700 text-sm">
                            {order.invoice_no || order.sales_order_no}
                          </div>
                          <div className="text-gray-600 text-xs">
                            {createdDate ? createdDate.toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            }) : '—'}
                          </div>
                        </div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-gray-600">Qty: {qtyVal ?? '—'}</span>
                          <span className="font-bold text-purple-600 text-sm">
                            {currencySymbol} {typeof amountVal === 'number' ? amountVal.toLocaleString() : '—'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs px-2 py-1 rounded-full font-medium bg-purple-100 text-purple-700">
                            Return
                          </span>
                          <span className="text-gray-500 text-xs">
                            {createdDate ? createdDate.toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : '—'}
                          </span>
                        </div>
                      </div>
                    )})}
                  {!ordersTabLoading && !ordersTabError && filteredReturns.length === 0 && (
                    <div className="text-xs text-gray-500 text-center py-4">No returns found</div>
                  )}
                  <div className="flex items-center justify-between pt-3">
                    <button
                      className="px-3 py-1 text-xs border rounded disabled:opacity-40"
                      onClick={() => setReturnsPage((p) => Math.max(1, p - 1))}
                      disabled={returnsPage <= 1}
                    >
                      Prev
                    </button>
                    <div className="text-xs text-gray-600">Page {returnsPage}</div>
                    <button
                      className="px-3 py-1 text-xs border rounded disabled:opacity-40"
                      onClick={() => setReturnsPage((p) => p + 1)}
                      disabled={filteredReturns.length < pageLength}
                    >
                      Next
                    </button>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500">{returnsTotal} results found</span>
                    <select
                      value={pageLength}
                      onChange={e => setPageLength(Number(e.target.value))}
                      className="text-xs border rounded px-2 py-1"
                    >
                      {pageSizeOptions.map(opt => (
                        <option key={opt} value={opt}>{opt} / page</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Placeholder only for tabs not yet implemented */}
      {activeTab === 'payments' && <PaymentTab />}
    </div>
  )
}

export default RightPanel
