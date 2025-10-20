import React, { useEffect, useMemo, useState } from 'react'

// A right-side panel for the POS screen, adapted from pos.html
// Contains tabs for Product, Customer, Prints, Payments, Orders
// and renders the contextual info shown in the design mock.

type RightPanelProps = {
  selectedItemId?: string
  items: any[]
  selectedCustomer?: any
}

const RightPanel: React.FC<RightPanelProps> = ({ selectedItemId, items, selectedCustomer }) => {
  const [activeTab, setActiveTab] = useState<'product' | 'customer' | 'prints' | 'payments' | 'orders'>('product')
  const [subTab, setSubTab] = useState<'orders' | 'returns'>('orders')
  const [customerSubTab, setCustomerSubTab] = useState<'recent' | 'most'>('recent')
  const [ordersSubTab, setOrdersSubTab] = useState<'orders' | 'returns'>('orders')

  // Get the currently selected item
  const selectedItem = selectedItemId ? items.find(item => item.item_code === selectedItemId) : null
  const currentUom = (selectedItem && (selectedItem.uom || 'Nos')) || 'Nos'

  // Live warehouse stock fetched from backend (for current UOM)
  const [stockLoading, setStockLoading] = useState(false)
  const [stockError, setStockError] = useState<string | null>(null)
  const [warehouseStock, setWarehouseStock] = useState<{ name: string; qty: number }[]>([])

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

  // Use selected item data or default
  const productData = selectedItem ? {
    item_code: selectedItem.item_code || 'N/A',
    item_name: selectedItem.item_name || selectedItem.label || 'Unknown Product',
    category: selectedItem.category || 'General',
    location: selectedItem.location || 'Location not specified',
    standard_rate: parseFloat(selectedItem.standard_rate || '0') || 0,
    on_hand: selectedItem.on_hand || 0,
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
          onClick={() => setActiveTab('product')}
        >
          Product
        </button>
        <button
          className={`px-4 py-3 font-medium text-sm border-b-3 ${
            activeTab === 'customer'
              ? 'border-accent bg-white/90 text-accent font-semibold'
              : 'border-transparent text-gray-500 hover:text-black hover:bg-white/40 transition-all'
          }`}
          onClick={() => setActiveTab('customer')}
        >
          Customer
        </button>
        <button
          className={`px-4 py-3 font-medium text-sm border-b-3 ${
            activeTab === 'prints'
              ? 'border-accent bg-white/90 text-accent font-semibold'
              : 'border-transparent text-gray-500 hover:text-black hover:bg-white/40 transition-all'
          }`}
          onClick={() => setActiveTab('prints')}
        >
          Prints
        </button>
        <button
          className={`px-4 py-3 font-medium text-sm border-b-3 ${
            activeTab === 'payments'
              ? 'border-accent bg-white/90 text-accent font-semibold'
              : 'border-transparent text-gray-500 hover:text-black hover:bg-white/40 transition-all'
          }`}
          onClick={() => setActiveTab('payments')}
        >
          Payments
        </button>
        <button
          className={`px-4 py-3 font-medium text-sm border-b-3 ${
            activeTab === 'orders'
              ? 'border-accent bg-white/90 text-accent font-semibold'
              : 'border-transparent text-gray-500 hover:text-black hover:bg-white/40 transition-all'
          }`}
          onClick={() => setActiveTab('orders')}
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
            <div className="absolute right-0 top-10 bg-white rounded-lg shadow-lg border border-gray-200 py-2 min-w-48 z-50">
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
                onClick={() => {
                  // Handle logout
                  window.electronAPI?.auth?.logout()
                  setShowProfileDropdown(false)
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
                <div className="font-bold text-red-600">{productData.on_hand} units</div>
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
                  {selectedItem ? 'No stock available' : 'Select an item to view stock details'}
                </div>
              )}
            </div>
          </div>

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
                <div className="max-h-96 overflow-y-auto space-y-2">
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
                <div className="max-h-96 overflow-y-auto space-y-2">
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

      {activeTab !== 'product' && activeTab !== 'customer' && activeTab !== 'orders' && (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-500">
          <span>{activeTab[0].toUpperCase() + activeTab.slice(1)} panel coming soon</span>
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