import React, { useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '@renderer/store/useAuthStore'
import { useNavigate } from '@tanstack/react-router'
import { usePOSTabStore } from '@renderer/store/usePOSTabStore'

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

  // Load PDF preview for a specific item
  const loadPDFPreview = async (item: any) => {
    const pdfUrl = `${window.location.origin}${item.url}`
    const itemKey = `${item.report_title}-${item.url}`
    
    if (pdfPreviews[itemKey]) {
      return // Already loaded
    }

    try {
      console.log('📄 Loading PDF preview for:', item.report_title)
      
      const response = await fetch(pdfUrl, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/pdf,application/json',
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
        const isPDF = uint8Array.length >= 4 && 
                     uint8Array[0] === 0x25 && // %
                     uint8Array[1] === 0x50 && // P
                     uint8Array[2] === 0x44 && // D
                     uint8Array[3] === 0x46    // F
        
        if (isPDF) {
          const base64 = btoa(String.fromCharCode(...uint8Array))
          const dataUrl = `data:application/pdf;base64,${base64}`
          setPdfPreviews(prev => ({ ...prev, [itemKey]: dataUrl }))
          console.log('📄 PDF preview loaded for:', item.report_title)
        } else {
          console.error('📄 Invalid PDF format for:', item.report_title)
        }
      } else {
        console.error('📄 Non-PDF response for:', item.report_title)
      }
    } catch (error) {
      console.error('📄 Error loading PDF preview:', error)
    }
  }

  // Fetch print items when component mounts or order changes
  useEffect(() => {
    const fetchPrintItems = async () => {
      console.log('🖨️ useEffect triggered - currentTab:', currentTab)
      console.log('🖨️ useEffect triggered - orderId:', currentTab?.orderId)
      
      if (!currentTab?.orderId) {
        console.log('🖨️ No orderId, setting empty array')
        setPrintItems([])
        return
      }

      console.log('🖨️ Starting API call for order:', currentTab.orderId)
      setLoading(true)
      setError(null)

      try {
        console.log('🖨️ Making API request to:', '/api/method/centro_pos_apis.api.print.print_items_list')
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
          
          // Auto-load PDF previews for all items
          if (data.length > 0) {
            data.forEach((item: any, index: number) => {
              // Load previews with a small delay to avoid overwhelming the server
              setTimeout(() => {
                loadPDFPreview(item)
              }, index * 500) // 500ms delay between each load
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

  return (
    <div className="p-4 h-full flex flex-col">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Print Options</h3>
        <p className="text-sm text-gray-600">Order: {currentTab.orderId}</p>
        {/* <p className="text-xs text-gray-500">Debug: printItems = {JSON.stringify(printItems)}</p> */}
      </div>

      <div className="space-y-4 flex-1 overflow-y-auto">
        {Array.isArray(printItems) && printItems.map((item, index) => {
          const itemKey = `${item.report_title}-${item.url}`
          const pdfPreview = pdfPreviews[itemKey]
          
          return (
            <div key={index} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-800">{item.report_title}</h4>
                <button
                  onClick={async () => {
                    try {
                      const itemKey = `${item.report_title}-${item.url}`
                      const pdfDataUrl = pdfPreviews[itemKey]
                      
                      if (!pdfDataUrl) {
                        alert('PDF preview not loaded yet. Please wait for it to load.')
                        return
                      }
                      
                     
                      
                      // Use the print function with proper error handling
                      const result = await window.electronAPI?.print.printPDF(pdfDataUrl)
                      console.log('🖨️ Print result:', result)
                      
                      if (result?.success) {
                        console.log('✅ Print dialog opened successfully')
                      } else {
                        console.error('❌ Print failed:', result?.error)
                        alert(`Print failed: ${result?.error || 'Unknown error'}`)
                      }
                    } catch (error: any) {
                      console.error('❌ Print error:', error)
                      alert(`Print error: ${error.message}`)
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-2"
                  title="Print with Printer Selection"
                  disabled={!pdfPreviews[`${item.report_title}-${item.url}`]}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" />
                  </svg>
                  Print
                </button>
              </div>
              
              {/* PDF Preview */}
              <div className="bg-gray-50 rounded border p-3">
                <div className="h-48 bg-white rounded border overflow-hidden">
                  {pdfPreview ? (
                    <iframe
                      src={pdfPreview}
                      className="w-full h-full border-0"
                      title={item.report_title}
                      onLoad={() => console.log('📄 PDF preview loaded:', item.report_title)}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
                          <svg className="w-6 h-6 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        </div>
                        <p className="text-sm text-gray-500">Loading preview...</p>
                        <button
                          onClick={() => loadPDFPreview(item)}
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
          )
        })}

        {(!Array.isArray(printItems) || printItems.length === 0) && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-print text-2xl text-gray-400"></i>
            </div>
            <h3 className="text-lg font-semibold text-gray-600 mb-2">No Print Options Available</h3>
            <p className="text-sm text-gray-500">No print formats found for this order</p>
          </div>
        )}
      </div>
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

const RightPanel: React.FC<RightPanelProps> = ({ selectedItemId, items, selectedCustomer, onTabChange, activeTab: externalActiveTab }) => {
  const [internalActiveTab, setInternalActiveTab] = useState<'product' | 'customer' | 'prints' | 'payments' | 'orders'>('product')
  
  // Use external activeTab if provided, otherwise use internal state
  const activeTab = externalActiveTab || internalActiveTab
  const [subTab, setSubTab] = useState<'orders' | 'returns'>('orders')
  const [customerSubTab, setCustomerSubTab] = useState<'recent' | 'most'>('recent')
  const [ordersSubTab, setOrdersSubTab] = useState<'orders' | 'returns'>('orders')
  
  // Get logout function from useAuthStore
  const { logout } = useAuthStore()
  const navigate = useNavigate()

  // Handle tab change and notify parent
  const handleTabChange = (tab: 'product' | 'customer' | 'prints' | 'payments' | 'orders') => {
    setInternalActiveTab(tab)
    onTabChange?.(tab)
  }

  // Get the currently selected item
  const selectedItem = selectedItemId ? items.find(item => item.item_code === selectedItemId) : null
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
          console.log('🔍 Available items:', response.data.data.map((item: any) => item.item_id))
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

  // Live warehouse stock fetched from backend (for current UOM)
  const [stockLoading, setStockLoading] = useState(false)
  const [stockError, setStockError] = useState<string | null>(null)
  const [warehouseStock, setWarehouseStock] = useState<{ name: string; qty: number }[]>([])

  // Product list API data for on-hand units
  const [productListData, setProductListData] = useState<any>(null)
  const [productListLoading, setProductListLoading] = useState(false)

  // Recent orders for selected customer
  const [recentOrders, setRecentOrders] = useState<any[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersError, setOrdersError] = useState<string | null>(null)

  // Most ordered products for selected customer
  const [mostOrdered, setMostOrdered] = useState<any[]>([])
  const [mostLoading, setMostLoading] = useState(false)
  const [mostError, setMostError] = useState<string | null>(null)

  // Customer details and insights
  const [customerDetails, setCustomerDetails] = useState<any>(null)
  const [customerInsights, setCustomerInsights] = useState<any>(null)
  const [customerDetailsLoading, setCustomerDetailsLoading] = useState(false)
  const [customerDetailsError, setCustomerDetailsError] = useState<string | null>(null)

  // All orders and returns
  const [allOrders, setAllOrders] = useState<any[]>([])
  const [ordersTabLoading, setOrdersTabLoading] = useState(false)
  const [ordersTabError, setOrdersTabError] = useState<string | null>(null)

  // Profile data and dropdown
  const [profileData, setProfileData] = useState<any>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)

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
        console.log('🔍 Loading stock for:', selectedItem.item_code, 'UOM:', currentUom)
        const res = await window.electronAPI?.proxy?.request({
          url: '/api/method/centro_pos_apis.api.product.item_stock_warehouse_list',
          params: {
            item_id: selectedItem.item_code,
            search_text: '',
            limit_start: 0,
            limit_page_length: 20
          }
        })
        console.log('📦 Stock API response:', res)
        console.log('📦 Response success:', res?.success)
        console.log('📦 Response status:', res?.status)
        console.log('📦 Response data:', res?.data)
        const list = Array.isArray(res?.data?.data) ? res.data.data : []
        const mapped = list.map((w: any) => {
          const q = Array.isArray(w.quantities) ? w.quantities : []
          const match = q.find((qq: any) => String(qq.uom).toLowerCase() === String(currentUom).toLowerCase())
          return { name: w.warehouse, qty: Number(match?.qty || 0) }
        })
        console.log('🗂️ Mapped warehouses:', mapped)
        if (!cancelled) setWarehouseStock(mapped)
        
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
  }, [selectedItem?.item_code, currentUom])

  // Fetch recent orders when customer is selected
  useEffect(() => {
    let cancelled = false
    async function loadRecentOrders() {
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
        
        const matchingCustomer = customers.find((c: any) => c.customer_name === selectedCustomer.name)
        console.log('🔍 Matching customer found:', matchingCustomer)
        
        if (!matchingCustomer) {
          console.log('❌ No matching customer found in customer list')
          setOrdersError('Customer not found in system')
          return
        }
        
        // Step 3: Use the 'name' field as customer_id
        const customerId = matchingCustomer.name
        console.log('🔍 Selected Customer ID for recent orders API:', customerId)
        console.log('🔍 API URL: /api/method/centro_pos_apis.api.customer.get_customer_recent_orders')
        console.log('🔍 API Params:', { customer_id: customerId, limit_start: 0, limit_page_length: 10 })
        
        // Step 4: Call recent orders API with correct customer_id
        const res = await window.electronAPI?.proxy?.request({
          url: '/api/method/centro_pos_apis.api.customer.get_customer_recent_orders',
          params: {
            customer_id: customerId,
            limit_start: 0,
            limit_page_length: 10
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
            setRecentOrders(orders)
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
    loadRecentOrders()
    return () => { cancelled = true }
  }, [selectedCustomer?.id])

  // Fetch most ordered when customer is selected
  useEffect(() => {
    let cancelled = false
    async function loadMostOrdered() {
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
          params: { customer_id: customerId, limit_start: 0, limit_page_length: 10 }
        })
        const items = Array.isArray(res?.data?.data) ? res.data.data : []
        if (!cancelled) setMostOrdered(items)
      } catch (e: any) {
        if (!cancelled) setMostError(e?.message || 'Failed to load most ordered')
      } finally {
        if (!cancelled) setMostLoading(false)
      }
    }
    loadMostOrdered()
    return () => { cancelled = true }
  }, [selectedCustomer?.name])

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
    return () => { cancelled = true }
  }, [selectedCustomer?.name])

  // Fetch all orders when Orders tab is active
  useEffect(() => {
    let cancelled = false
    async function loadAllOrders() {
      if (activeTab !== 'orders') {
        return
      }
      try {
        setOrdersTabLoading(true)
        setOrdersTabError(null)
        
        // Use the same API as recent orders but get all orders for all customers
        // We'll fetch orders for each customer and combine them
        const customerListRes = await window.electronAPI?.proxy?.request({
          url: '/api/method/centro_pos_apis.api.customer.customer_list',
          params: { search_term: '', limit_start: 1, limit_page_length: 50 }
        })
        
        const customers = customerListRes?.data?.data || []
        let allOrdersData: any[] = []
        
        // Fetch orders for each customer
        for (const customer of customers) {
          try {
            const res = await window.electronAPI?.proxy?.request({
              url: '/api/method/centro_pos_apis.api.customer.get_customer_recent_orders',
              params: {
                customer_id: customer.name,
                limit_start: 0,
                limit_page_length: 50 // Get more orders per customer
              }
            })
            
            if (res?.success && res?.data?.data) {
              const orders = Array.isArray(res.data.data) ? res.data.data : []
              allOrdersData = [...allOrdersData, ...orders]
            }
          } catch (err) {
            console.error(`Error fetching orders for customer ${customer.name}:`, err)
            // Continue with other customers even if one fails
          }
        }
        
        if (!cancelled) {
          setAllOrders(allOrdersData)
        }
      } catch (err) {
        console.error('❌ Error loading all orders:', err)
        if (!cancelled) {
          setOrdersTabError(err instanceof Error ? err.message : 'Failed to load orders')
        }
      } finally {
        if (!cancelled) {
          setOrdersTabLoading(false)
        }
      }
    }
    loadAllOrders()
    return () => { cancelled = true }
  }, [activeTab])

  // Fetch profile data on component mount
  useEffect(() => {
    let cancelled = false
    async function loadProfile() {
      try {
        setProfileLoading(true)
        setProfileError(null)
        
        const res = await window.electronAPI?.proxy?.request({
          url: '/api/method/centro_pos_apis.api.profile.get_pos_profile',
          params: {}
        })
        
        if (res?.success && res?.data?.data) {
          if (!cancelled) {
            setProfileData(res.data.data)
          }
        }
      } catch (err) {
        console.error('❌ Error loading profile:', err)
        if (!cancelled) {
          setProfileError(err instanceof Error ? err.message : 'Failed to load profile')
        }
      } finally {
        if (!cancelled) {
          setProfileLoading(false)
        }
      }
    }
    loadProfile()
    return () => { cancelled = true }
  }, [])

  // Default product data when no item is selected
  const defaultProduct = {
    item_code: 'SGS24-256',
    item_name: 'Samsung Galaxy S24',
    category: 'Smartphones',
    location: 'Rack A-15, Shelf 3',
    standard_rate: 799.00,
    on_hand: 3,
    cost: 650.00,
    margin: 18.6,
    warehouses: [
      { name: 'Warehouse - 2', qty: 10 },
      { name: 'Warehouse - 3', qty: 12 },
      { name: 'Warehouse - 4', qty: 30 }
    ]
  }

  // Calculate on-hand units from product list API based on selected UOM
  const getOnHandUnits = () => {
    if (!productListData || !currentUom) return 0
    
    const uomDetails = Array.isArray(productListData.uom_details) ? productListData.uom_details : []
    const selectedUomDetail = uomDetails.find((detail: any) => 
      String(detail.uom).toLowerCase() === String(currentUom).toLowerCase()
    )
    
    const onHandUnits = selectedUomDetail ? Number(selectedUomDetail.qty || 0) : 0
    
    console.log('📊 On-hand calculation:', {
      itemCode: selectedItem?.item_code,
      currentUom,
      uomDetails,
      selectedUomDetail,
      onHandUnits
    })
    
    return onHandUnits
  }

  // Use selected item data or default
  const productData = selectedItem ? {
    item_code: selectedItem.item_code || 'N/A',
    item_name: selectedItem.item_name || selectedItem.label || 'Unknown Product',
    category: selectedItem.category || 'General',
    location: selectedItem.location || 'Location not specified',
    standard_rate: parseFloat(selectedItem.standard_rate || '0') || 0,
    on_hand: getOnHandUnits(), // Use API data instead of selectedItem.on_hand
    cost: selectedItem.cost || 0,
    margin: selectedItem.margin || 0,
    warehouses: warehouseStock.length > 0
      ? warehouseStock
      : selectedItem.warehouses || []
  } : {
    ...defaultProduct,
    warehouses: [] // Empty warehouses when no item selected
  }

  return (
    <div className="w-[480px] bg-white/60 backdrop-blur border-l border-white/20 flex flex-col">
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
                <div className="text-xs text-gray-500">
                  {profileData?.company || 'Company'}
                </div>
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
        <div className="flex-1 overflow-y-auto">
          {!selectedItem ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-600 mb-2">Select an item to view details</h3>
                <p className="text-sm text-gray-500">Choose a product from the items table to see pricing, stock, and other information.</p>
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
                    <div className="font-bold text-blue-600">${productData.standard_rate.toFixed(2)}</div>
                  </div>
                  <div className="p-3 bg-gradient-to-r from-red-50 to-pink-50 rounded-xl">
                    <div className="text-xs text-gray-600">On Hand</div>
                    {productListLoading ? (
                      <div className="font-bold text-gray-500">Loading...</div>
                    ) : (
                      <div className="font-bold text-red-600">{productData.on_hand} units</div>
                    )}
                  </div>
                  <div className="p-3 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-xl">
                    <div className="text-xs text-gray-600">Cost</div>
                    <div className="font-bold text-orange-600">${productData.cost.toFixed(2)}</div>
                  </div>
                  <div className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl">
                    <div className="text-xs text-gray-600">Margin</div>
                    <div className="font-bold text-purple-600">{productData.margin.toFixed(1)}%</div>
                  </div>
                </div>
              </div>

              {/* Stock Details */}
              <div className="p-4 border-b border-gray-200/60 bg-white/90">
                <h4 className="font-bold text-gray-800 mb-3">Stock Details</h4>
                <div className="space-y-2">
                  {stockLoading && (
                    <div className="text-xs text-gray-500">Loading stock...</div>
                  )}
                  {stockError && (
                    <div className="text-xs text-red-600">{stockError}</div>
                  )}
                  {!stockLoading && !stockError && productData.warehouses.length > 0 && productData.warehouses.map((warehouse, index) => (
                    <div key={index} className="p-2 bg-gradient-to-r from-gray-50 to-slate-50 rounded-lg text-xs">
                      <div className="flex justify-between items-center">
                        <div className="font-semibold text-primary">{warehouse.name}</div>
                        <span className="font-semibold text-green-600">Qty: {warehouse.qty || warehouse.available || 0}</span>
                      </div>
                    </div>
                  ))}
                  {!stockLoading && !stockError && productData.warehouses.length === 0 && (
                    <div className="text-xs text-gray-500 text-center py-4">
                      No stock available
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'customer' && (
        <div className="flex-1 overflow-y-auto">
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
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-r from-primary to-slate-700 rounded-full flex items-center justify-center">
                    <i className="fas fa-user text-white text-lg" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{customerDetails.customer_name || 'Walking Customer'}</h3>
                    <p style={{ fontSize: '12px' }} className="text-sm text-gray-600">
                      VAT: {customerDetails.tax_id || 'Not Applicable'}
                    </p>
                    <p style={{ fontSize: '12px' }} className="text-sm text-gray-600">
                      ADDRESS: {customerDetails.primary_address ? 
                        customerDetails.primary_address.replace(/<br\s*\/?>/gi, ', ').replace(/<[^>]+>/g, '').trim() : 
                        'Address not available'
                      }
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
                    <div className="text-xs text-gray-600">Total Invoiced</div>
                    <div className="font-bold text-blue-600">
                      ${customerInsights?.total_invoice_amount?.toLocaleString() || '0.00'}
                    </div>
                  </div>
                  <div className="p-3 bg-gradient-to-r from-red-50 to-pink-50 rounded-xl">
                    <div className="text-xs text-gray-600">Amount Due</div>
                    <div className="font-bold text-red-600">
                      ${customerInsights?.amount_due?.toLocaleString() || '0.00'}
                    </div>
                  </div>
                  <div className="p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl">
                    <div className="text-xs text-gray-600">
                      Last Payment {customerInsights?.last_payment_datetime ? 
                        `| ${new Date(customerInsights.last_payment_datetime).toLocaleDateString('en-US', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}` : ''
                      }
                    </div>
                    <div className="font-bold text-green-600">
                      ${customerInsights?.last_payment_amount?.toLocaleString() || '0.00'}
                    </div>
                  </div>
                  <div className="p-3 bg-gradient-to-r from-blue-50 to-yellow-50 rounded-xl">
                    <div className="text-xs text-gray-600">Credit Limit</div>
                    <div className="font-bold text-orange-600">
                      ${customerInsights?.total_credit_limit?.toLocaleString() || '0.00'}
                    </div>
                  </div>
                  <div className="p-3 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-xl">
                    <div className="text-xs text-gray-600">Available Credit Limit</div>
                    <div className="font-bold text-orange-600">
                      ${customerInsights?.available_credit_limit?.toLocaleString() || '0.00'}
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

          {/* Customer insights: Recent Orders and Most Ordered */}
          <div className="bg-white/90 mt-2">
            <div className="flex border-b border-gray-200/60">
              <button
                className={`flex-1 px-4 py-3 font-semibold text-sm border-b-2 ${
                  customerSubTab === 'recent' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'text-gray-500 hover:text-black hover:bg-white/40'
                }`}
                onClick={() => setCustomerSubTab('recent')}
              >
                Recent Orders
              </button>
              <button
                className={`flex-1 px-4 py-3 font-medium text-sm border-b-2 ${
                  customerSubTab === 'most' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'text-gray-500 hover:text-black hover:bg-white/40'
                }`}
                onClick={() => setCustomerSubTab('most')}
              >
                Most Ordered
              </button>
            </div>

            {customerSubTab === 'recent' ? (
              <div className="p-4">
                <div className="text-xs text-gray-500 mb-2">
                  {selectedCustomer ? `Recent orders for ${selectedCustomer.name}` : 'Select a customer to view recent orders'}
                </div>
                <div className="space-y-2">
                  {ordersLoading && (
                    <div className="text-xs text-gray-500 text-center py-4">Loading recent orders...</div>
                  )}
                  {ordersError && (
                    <div className="text-xs text-red-600 text-center py-4">{ordersError}</div>
                  )}
                  {!ordersLoading && !ordersError && recentOrders.length > 0 && recentOrders.slice(0, 3).map((order, index) => (
                    <div key={index} className="p-3 bg-gradient-to-r from-gray-50 to-slate-50 rounded-lg text-xs border border-gray-200">
                      <div className="flex justify-between items-center mb-2">
                        <div className="font-semibold text-primary text-sm">{order.invoice_no || order.sales_order_no}</div>
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
                        <span className="font-bold text-green-600 text-sm">${order.total_amount?.toLocaleString()}</span>
                  </div>
                    <div className="flex justify-between items-center">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          order.status === 'Overdue' ? 'bg-red-100 text-red-700' : 
                          order.status === 'Paid' ? 'bg-green-100 text-green-700' :
                          order.status === 'Draft' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
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
                  {!ordersLoading && !ordersError && recentOrders.length === 0 && selectedCustomer && (
                    <div className="text-xs text-gray-500 text-center py-4">No recent orders found</div>
                  )}
                  {!ordersLoading && !ordersError && recentOrders.length > 3 && (
                    <div className="text-xs text-gray-400 text-center py-2">
                      Showing 3 of {recentOrders.length} orders
                  </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4">
                <div className="text-xs text-gray-500 mb-2">
                  {selectedCustomer ? `Most ordered by ${selectedCustomer.name}` : 'Select a customer to view most ordered products'}
                      </div>
                <div className="space-y-2">
                  {mostLoading && (
                    <div className="text-xs text-gray-500 text-center py-4">Loading most ordered...</div>
                  )}
                  {mostError && (
                    <div className="text-xs text-red-600 text-center py-4">{mostError}</div>
                  )}
                  {!mostLoading && !mostError && mostOrdered.slice(0,3).map((item, idx) => (
                    <div key={idx} className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200 text-xs">
                      <div className="flex justify-between items-center">
                        <div className="font-semibold text-purple-700">{item.item_name} ({item.item_code})</div>
                        <div className="text-gray-600">Qty: {item.total_qty}</div>
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-gray-600">Avg Price: {item.avg_price}</span>
                        <span className="font-semibold text-purple-700">Total: {item.total_price}</span>
                    </div>
                  </div>
                  ))}
                  {!mostLoading && !mostError && mostOrdered.length === 0 && selectedCustomer && (
                    <div className="text-xs text-gray-500 text-center py-4">No data</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'prints' && (
        <div className="flex-1 overflow-y-auto">
          <PrintsTabContent />
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="flex-1 overflow-y-auto">
          <div className="bg-white/90 mt-2">
            <div className="flex border-b border-gray-200/60">
              <button
                className={`flex-1 px-4 py-3 font-semibold text-sm border-b-2 ${
                  subTab === 'orders' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'text-gray-500 hover:text-black hover:bg-white/40'
                }`}
                onClick={() => setSubTab('orders')}
              >
                Orders
              </button>
              <button
                className={`flex-1 px-4 py-3 font-medium text-sm border-b-2 ${
                  subTab === 'returns' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'text-gray-500 hover:text-black hover:bg-white/40'
                }`}
                onClick={() => setSubTab('returns')}
              >
                Returns
              </button>
            </div>

            {subTab === 'orders' ? (
              <div className="p-4">
                <div className="text-xs text-gray-500 mb-2">
                  All Orders ({allOrders.filter(order => order.status !== 'Return').length})
                        </div>
                <div className="space-y-2">
                  {ordersTabLoading && (
                    <div className="text-xs text-gray-500 text-center py-4">Loading orders...</div>
                  )}
                  {ordersTabError && (
                    <div className="text-xs text-red-600 text-center py-4">{ordersTabError}</div>
                  )}
                  {!ordersTabLoading && !ordersTabError && allOrders.filter(order => order.status !== 'Return').length > 0 && 
                    allOrders.filter(order => order.status !== 'Return').map((order, index) => (
                      <div key={index} className="p-3 bg-gradient-to-r from-gray-50 to-slate-50 rounded-lg text-xs border border-gray-200">
                        <div className="flex justify-between items-center mb-2">
                          <div className="font-semibold text-primary text-sm">{order.invoice_no || order.sales_order_no}</div>
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
                          <span className="font-bold text-green-600 text-sm">${order.total_amount?.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            order.status === 'Overdue' ? 'bg-red-100 text-red-700' : 
                            order.status === 'Paid' ? 'bg-green-100 text-green-700' :
                            order.status === 'Draft' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
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
                    ))
                  }
                  {!ordersTabLoading && !ordersTabError && allOrders.filter(order => order.status !== 'Return').length === 0 && (
                    <div className="text-xs text-gray-500 text-center py-4">No orders found</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4">
                <div className="text-xs text-gray-500 mb-2">
                  Returns ({allOrders.filter(order => order.status === 'Return').length})
                        </div>
                <div className="space-y-2">
                  {ordersTabLoading && (
                    <div className="text-xs text-gray-500 text-center py-4">Loading returns...</div>
                  )}
                  {ordersTabError && (
                    <div className="text-xs text-red-600 text-center py-4">{ordersTabError}</div>
                  )}
                  {!ordersTabLoading && !ordersTabError && allOrders.filter(order => order.status === 'Return').length > 0 && 
                    allOrders.filter(order => order.status === 'Return').map((order, index) => (
                      <div key={index} className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg text-xs border border-purple-200">
                        <div className="flex justify-between items-center mb-2">
                          <div className="font-semibold text-purple-700 text-sm">{order.invoice_no || order.sales_order_no}</div>
                          <div className="text-gray-600 text-xs">
                            {new Date(order.creation_datetime).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                        </div>
                      </div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-gray-600">Qty: {order.total_qty}</span>
                          <span className="font-bold text-purple-600 text-sm">${order.total_amount?.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs px-2 py-1 rounded-full font-medium bg-purple-100 text-purple-700">
                            Return
                          </span>
                          <span className="text-gray-500 text-xs">
                            {new Date(order.creation_datetime).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                    </div>
                  </div>
                    ))
                  }
                  {!ordersTabLoading && !ordersTabError && allOrders.filter(order => order.status === 'Return').length === 0 && (
                    <div className="text-xs text-gray-500 text-center py-4">No returns found</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Placeholder only for tabs not yet implemented */}
      {activeTab === 'payments' && (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-500">
          <span>Payments panel coming soon</span>
        </div>
      )}
    </div>
  )
}

export default RightPanel

// import { useState, useEffect } from 'react';
// import { FaHistory, FaBoxes, FaUserCircle } from 'react-icons/fa';
// import InfoBoxGrid from './InfoBoxGrid';
// import RightPanelProductTab from './RightPanelProductTab';
// import RightPanelCustomerTab from './RightPanelCustomerTab';
// import RightPanelOrdersTab from './RightPanelOrdersTab';
// import RightPanelPrintTab from './RightPanelPrintTab';
// import { useCartStore } from '../store/useCartStore';

// // Type definitions
// interface MostOrderedItem {
//   name: string;
//   code: string;
//   units: string;
//   amount: string;
// }

// interface InfoBoxItem {
//   label: string;
//   value: string;
//   color: string;
//   bg: string;
// }

// interface Product {
//   id?: string;
//   name?: string;
//   code?: string;
//   price?: number;
//   quantity?: number;
//   [key: string]: any;
// }

// interface Customer {
//   id?: string;
//   name?: string;
//   [key: string]: any;
// }

// interface CartStore {
//   activeRightPanelTab: string;
//   setActiveRightPanelTab: (tab: string) => void;
//   selectedProduct: Product | null;
//   selectedCustomer: Customer | null;
//   orderActionTrigger: string | null;
//   setOrderActionTrigger: (trigger: string | null) => void;
// }

// interface RightPanelProductTabProps {
//   upsellTab: string;
//   setUpsellTab: (tab: string) => void;
//   productInfo: InfoBoxItem[];
//   selectedProduct: Product | null;
// }

// interface RightPanelCustomerTabProps {
//   customerInfo: InfoBoxItem[];
//   mostOrderedData: MostOrderedItem[];
// }

// const mostOrderedData: MostOrderedItem[] = [
//   {
//     name: 'iPhone 15 Pro',
//     code: 'IPH15-PRO',
//     units: '15 units',
//     amount: '$13,485',
//   },
//   {
//     name: 'Galaxy S24',
//     code: 'SGS24-256',
//     units: '12 units',
//     amount: '$9,588',
//   },
// ];

// const RightPanel: React.FC = () => {
//   // Get active tab from cart store
//   const { 
//     activeRightPanelTab, 
//     setActiveRightPanelTab, 
//     selectedProduct, 
//     selectedCustomer, 
//     orderActionTrigger, 
//     setOrderActionTrigger 
//   }: CartStore = useCartStore();
  
//   const [upsellTab, setUpsellTab] = useState<string>('upsell');
//   const [isInitialized, setIsInitialized] = useState<boolean>(false);

//   // Auto-switch to product tab when a product is selected
//   useEffect(() => {
//     if (selectedProduct) {
//       setActiveRightPanelTab('product');
//     }
//   }, [selectedProduct, setActiveRightPanelTab]);

//   // Auto-switch to customer tab when customer is selected
//   useEffect(() => {
//     if (selectedCustomer && selectedCustomer.name !== 'Walking Customer') {
//       setActiveRightPanelTab('customer');
//     }
//   }, [selectedCustomer, setActiveRightPanelTab]);

//   // Auto-switch to orders tab when order action happens
//   useEffect(() => {
//     if (orderActionTrigger) {
//       setActiveRightPanelTab('orders');
//       // Reset the trigger after switching
//       setOrderActionTrigger(null);
//     }
//   }, [orderActionTrigger, setActiveRightPanelTab, setOrderActionTrigger]);

//   useEffect(() => {
//     // Only set default tab once when app first loads
//     if (!isInitialized) {
//       setActiveRightPanelTab('orders');
//       setIsInitialized(true);
//       return;
//     }

//     // After initialization, only auto-switch when there are actual selections
//     if (selectedProduct || selectedCustomer || orderActionTrigger) {
//       return; // Something is selected, don't change
//     }
//   }, [isInitialized, selectedProduct, selectedCustomer, orderActionTrigger, setActiveRightPanelTab]);

//   // InfoBoxGrid data for each tab
//   const productInfo: InfoBoxItem[] = [
//     { label: 'Unit Price', value: '$799.00', color: 'text-blue-600', bg: 'from-blue-50 to-indigo-50' },
//     { label: 'On Hand', value: '3 units', color: 'text-red-600', bg: 'from-red-50 to-pink-50' },
//     { label: 'Cost', value: '$650.00', color: 'text-orange-600', bg: 'from-orange-50 to-yellow-50' },
//     { label: 'Margin', value: '18.6%', color: 'text-purple-600', bg: 'from-purple-50 to-pink-50' },
//   ];

//   const customerInfo: InfoBoxItem[] = [
//     { label: 'Total Invoiced', value: '$12,450.00', color: 'text-blue-600', bg: 'from-blue-50 to-indigo-50' },
//     { label: 'Amount Due', value: '$2,570.00', color: 'text-red-600', bg: 'from-red-50 to-pink-50' },
//     { label: 'Last Payment', value: '$1,200.00', color: 'text-green-600', bg: 'from-green-50 to-emerald-50' },
//     { label: 'Commission', value: '$125.40', color: 'text-orange-600', bg: 'from-orange-50 to-yellow-50' },
//   ];

//   return (
//     <div className="w-full h-full bg-white/60 backdrop-blur border-l border-white/20 flex flex-col relative">
//       {/* Top Tabs */}
//       <div className="flex border-b border-gray-200/60 bg-white/80 overflow-x-auto">
//         <button
//           className={`px-4 py-3 font-semibold text-sm border-b-3 ${activeRightPanelTab === 'product' ? 'border-accent bg-white/90 text-accent' : 'border-transparent text-gray-500 hover:text-black hover:bg-white/40 transition-all'}`}
//           onClick={() => setActiveRightPanelTab('product')}
//         >
//           Product
//         </button>
//         <button
//           className={`px-4 py-3 font-medium text-sm border-b-3 ${activeRightPanelTab === 'customer' ? 'border-accent bg-white/90 text-accent font-semibold' : 'border-transparent text-gray-500 hover:text-black hover:bg-white/40 transition-all'}`}
//           onClick={() => setActiveRightPanelTab('customer')}
//         >
//           Customer
//         </button>
//         <button 
//           className={`px-4 py-3 font-medium text-sm border-b-3 ${activeRightPanelTab === 'print' ? 'border-accent bg-white/90 text-accent font-semibold' : 'border-transparent text-gray-500 hover:text-black hover:bg-white/40 transition-all'}`}
//           onClick={() => setActiveRightPanelTab('print')}
//         >
//           Print
//         </button>
//         <button
//           className={`px-4 py-3 font-medium text-sm border-b-3 ${activeRightPanelTab === 'orders' ? 'border-accent bg-white/90 text-accent font-semibold' : 'border-transparent text-gray-500 hover:text-black hover:bg-white/40 transition-all'}`}
//           onClick={() => setActiveRightPanelTab('orders')}
//         >
//           Orders
//         </button>
//         <button className="px-4 py-3 font-medium text-gray-500 hover:text-black hover:bg-white/40 transition-all text-sm">
//           Cash In/Out
//         </button>
//       </div>

//       {/* Quick Action Controls - Only show for Product tab */}
//       {activeRightPanelTab === 'product' && (
//         <div className="p-4 bg-white/90 border-b border-gray-200/60">
//           <div className="grid grid-cols-3 gap-3">
//             <button className="px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-medium rounded-xl hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-2">
//               <FaHistory />
//               History
//             </button>
//             <button className="px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-medium rounded-xl hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-2">
//               <FaBoxes />
//               Stock
//             </button>
//             <button className="px-4 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white text-sm font-medium rounded-xl hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-2">
//               <FaUserCircle />
//               Account
//             </button>
//           </div>
//         </div>
//       )}

//       {/* Tab Content */}
//       {activeRightPanelTab === 'product' && (
//         <RightPanelProductTab
//           upsellTab={upsellTab}
//           setUpsellTab={setUpsellTab}
//           productInfo={productInfo}
//           selectedProduct={selectedProduct}
//         />
//       )}
//       {activeRightPanelTab === 'customer' && (
//         <RightPanelCustomerTab
//           customerInfo={customerInfo}
//           mostOrderedData={mostOrderedData}
//         />
//       )}
//       {activeRightPanelTab === 'print' && (
//         <RightPanelPrintTab />
//       )}
//       {activeRightPanelTab === 'orders' && (
//         <RightPanelOrdersTab />
//       )}
//       {/* TODO: Add modular components for Invoice, Cash In/Out tabs in the future */}
//     </div>
//   );
// };

// export default RightPanel;