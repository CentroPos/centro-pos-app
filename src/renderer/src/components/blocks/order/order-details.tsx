import React, { useState, useEffect } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { ChevronDown, RefreshCcw } from 'lucide-react'

import { Input } from '@renderer/components/ui/input'
import { Button } from '@renderer/components/ui/button'

import CustomerSearchModal from '../customer/customer-modal'
import { usePOSTabStore } from '@renderer/store/usePOSTabStore'
import { usePOSProfileStore } from '@renderer/store/usePOSProfileStore'
import { toast } from 'sonner'



type OrderDetailsProps = {
  onPriceListChange?: (priceList: string) => void
  onCustomerModalChange?: (isOpen: boolean) => void
  onCustomerSelect?: (customer: any) => void
  forceOpenCustomerModal?: boolean
}

const OrderDetails: React.FC<OrderDetailsProps> = ({
  onPriceListChange,
  onCustomerModalChange,
  onCustomerSelect,
  forceOpenCustomerModal
}) => {
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [selectedPriceList, setSelectedPriceList] = useState<string>('Standard Selling')
  const [priceLists, setPriceLists] = useState<string[]>([])
  const [loadingPriceLists, setLoadingPriceLists] = useState(false)
  // Get current date in local timezone (YYYY-MM-DD format)
  const getCurrentDate = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  
  const [orderDate, setOrderDate] = useState<string>(getCurrentDate());
  const {
    activeTabId,
    getCurrentTabCustomer,
    updateTabCustomer,
    setTabEdited,
    updateTabPostingDate,
    updateTabOtherDetails,
    updateTabOrderData
  } = usePOSTabStore()
  const { profile } = usePOSProfileStore()

  const selectedCustomer = getCurrentTabCustomer()
  // Subscribe to current tab reactively so UI updates after actions (save/confirm/pay/return)
  const currentTab = usePOSTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId))
  const hasSavedOrder = Boolean(currentTab?.orderId)
  const handleGlobalRefresh = async () => {
    if (!currentTab?.orderId || !activeTabId) return

    try {
      console.log('🔁 Refreshing order data for', currentTab.orderId)
      const response = await window.electronAPI?.proxy?.request({
        url: '/api/method/centro_pos_apis.api.order.get_sales_order_details',
        params: { sales_order_id: currentTab.orderId }
      })

      const orderData = response?.data?.data
      if (!orderData) {
        toast.error('Failed to refresh order data')
        return
      }

      console.log('🔁 Order data refreshed:', orderData)
      if (orderData.customer) {
        updateTabCustomer(activeTabId, {
          name: orderData.customer_name,
          gst: orderData.customer_gst || '',
          customer_id: orderData.customer
        })
        onCustomerSelect?.({
          name: orderData.customer_name,
          customer_id: orderData.customer
        })
      }

      updateTabPostingDate(activeTabId, orderData.posting_date || getCurrentDate())

      updateTabOtherDetails(activeTabId, {
        po_no: orderData.po_no || null,
        po_date: orderData.po_date || null,
        internal_note: orderData.custom_internal_note || orderData.internal_note || null
      })

      const defaultPriceList =
        orderData.items?.[0]?.price_list || orderData.price_list || 'Standard Selling'
      setSelectedPriceList(defaultPriceList)
      onPriceListChange?.(defaultPriceList)

      toast.success('Order refreshed successfully')
      updateTabOrderData(activeTabId, orderData)
      window.dispatchEvent(new CustomEvent('pos-refresh'))
    } catch (error) {
      console.error('Failed to refresh order data:', error)
      toast.error('Failed to refresh order data')
    }
  }
  
  // Check if order is confirmed - similar to items table
  const isReadOnly = currentTab?.status === 'confirmed' || currentTab?.status === 'paid' || 
    (currentTab?.orderData && Number(currentTab.orderData.docstatus) === 1)
  
  // Check if date change is allowed from POS profile
  const isDateChangeAllowed = profile?.custom_allow_order_date_change === 1
  
  // Always default to current date when tab changes or component mounts
  React.useEffect(() => {
    const currentDate = getCurrentDate()
    console.log('📅 Setting order date. Current date:', currentDate, 'Tab ID:', activeTabId, 'Order ID:', currentTab?.orderId, 'Status:', currentTab?.status)
    
    // For new orders (no orderId or draft status), use stored date or current date
    if (!currentTab?.orderId || currentTab?.status === 'draft' || !isReadOnly) {
      const storedDate = currentTab?.posting_date || currentDate
      console.log('📅 New/draft order - using stored date or current date:', storedDate)
      setOrderDate(storedDate)
      if (activeTabId && !currentTab?.posting_date) {
        updateTabPostingDate(activeTabId, currentDate) // Store current date if not already stored
      }
      return
    }
    
    // Only for confirmed/paid orders, use the order's posting_date if available
    if (isReadOnly && currentTab?.orderData?.posting_date) {
      const orderDateStr = currentTab.orderData.posting_date
      console.log('📅 Confirmed order - using posting_date:', orderDateStr)
      if (orderDateStr) {
        try {
          // Handle different date formats
          let date: Date
          if (orderDateStr.includes('T')) {
            date = new Date(orderDateStr)
          } else {
            // If it's just a date string, parse it carefully
            date = new Date(orderDateStr + 'T00:00:00')
          }
          if (!isNaN(date.getTime())) {
            const year = date.getFullYear()
            const month = String(date.getMonth() + 1).padStart(2, '0')
            const day = String(date.getDate()).padStart(2, '0')
            const formattedDate = `${year}-${month}-${day}`
            console.log('📅 Formatted order date:', formattedDate)
            setOrderDate(formattedDate)
            return
          }
        } catch (e) {
          console.warn('Invalid date format:', orderDateStr, e)
        }
      }
    }
    
    // Fallback to current date
    console.log('📅 Fallback - setting to current date:', currentDate)
    setOrderDate(currentDate)
  }, [activeTabId, currentTab?.orderId, currentTab?.status, currentTab?.orderData?.posting_date, isReadOnly])
  
  // Force current date when date change is not allowed
  React.useEffect(() => {
    if (!isDateChangeAllowed) {
      const currentDate = getCurrentDate()
      console.log('📅 Date change not allowed - forcing current date:', currentDate)
      setOrderDate(currentDate)
    }
  }, [isDateChangeAllowed])

  // Fetch price lists from API
  useEffect(() => {
    const fetchPriceLists = async () => {
      setLoadingPriceLists(true)
      try {
        console.log('📋 Fetching price lists from API...')
        const response = await window.electronAPI?.proxy?.request({
          method: 'GET',
          url: '/api/resource/Price List',
          params: {
            limit_start: 1,
            limit_page_length: 10
          }
        })
        
        console.log('📋 Price lists API response:', response)
        
        if (response?.data?.data && Array.isArray(response.data.data)) {
          const priceListNames = response.data.data.map((item: any) => item.name).filter(Boolean)
          console.log('📋 Extracted price list names:', priceListNames)
          setPriceLists(priceListNames)
          
          // If no price lists found, use default
          if (priceListNames.length === 0) {
            console.log('📋 No price lists found, using default')
            setPriceLists(['Standard Selling'])
          }
        } else {
          console.log('📋 Invalid response format, using default price lists')
          setPriceLists(['Standard Selling'])
        }
      } catch (error) {
        console.error('❌ Error fetching price lists:', error)
        // Fallback to default price lists
        setPriceLists(['Standard Selling'])
      } finally {
        setLoadingPriceLists(false)
      }
    }

    fetchPriceLists()
  }, [])

  // Initialize price list from profile
  React.useEffect(() => {
    if (profile?.selling_price_list) {
      setSelectedPriceList(profile.selling_price_list)
    }
  }, [profile?.selling_price_list])

  // Notify parent when price list changes
  React.useEffect(() => {
    onPriceListChange?.(selectedPriceList)
  }, [selectedPriceList, onPriceListChange])

  // Notify parent when customer modal state changes
  React.useEffect(() => {
    onCustomerModalChange?.(showCustomerModal)
  }, [showCustomerModal, onCustomerModalChange])

  // Open customer modal when forced by parent (e.g., after New Order)
  React.useEffect(() => {
    if (forceOpenCustomerModal) {
      setShowCustomerModal(true)
    }
  }, [forceOpenCustomerModal])

  // Debug logging
  React.useEffect(() => {
    console.log('🔍 OrderDetails Debug:', {
      profile,
      sellingPriceList: profile?.selling_price_list,
      selectedPriceList
    })
  }, [profile, selectedPriceList])

  // Keep price list in sync with selected customer's default or POS profile default
  React.useEffect(() => {
    const desiredRaw = (selectedCustomer as any)?.default_price_list || profile?.selling_price_list
    const desired = typeof desiredRaw === 'string' ? desiredRaw.trim() : desiredRaw
    if (desired && selectedPriceList !== desired) {
      console.log('🔁 Sync price list from customer/profile', { desired, fromCustomer: (selectedCustomer as any)?.default_price_list, fromProfile: profile?.selling_price_list })
      setPriceLists((prev) => (prev.includes(desired) ? prev : [...prev, desired]))
      setSelectedPriceList(desired)
      onPriceListChange?.(desired)
    }
  }, [selectedCustomer?.name, (selectedCustomer as any)?.default_price_list, profile?.selling_price_list])

  const handleCustomerSelect = async (customer: any) => {
    console.log('🧾 Customer selected:', customer)
    if (!activeTabId) {
      toast.error('No active tab. Please create a new order first.')
      setShowCustomerModal(false)
      return
    }
    if (activeTabId) {
      updateTabCustomer(activeTabId, customer)
      setTabEdited(activeTabId, true) // Mark tab as edited when customer changes
    }
    setShowCustomerModal(false)
    // Try to resolve default price list from selection; if missing, fetch from Customer resource
    let resolvedDefault: string | undefined = customer?.default_price_list
    if (!resolvedDefault && customer?.customer_id) {
      try {
        const resp = await window.electronAPI?.proxy?.request({
          method: 'GET',
          url: `/api/resource/Customer/${encodeURIComponent(customer.customer_id)}`,
          params: { fields: '["default_price_list"]' }
        })
        resolvedDefault = resp?.data?.data?.default_price_list
        console.log('🧾 Fetched customer default_price_list:', resolvedDefault)
      } catch (e) {
        console.warn('⚠️ Failed fetching customer default_price_list', e)
      }
    }
    // If customer has a default price list, use it; else fallback to profile's selling_price_list
    const nextPriceListRaw = resolvedDefault || profile?.selling_price_list
    const nextPriceList = typeof nextPriceListRaw === 'string' ? nextPriceListRaw.trim() : nextPriceListRaw
    console.log('🧾 Resolved nextPriceList:', nextPriceList, {
      customerDefault: resolvedDefault || customer?.default_price_list,
      profileSelling: profile?.selling_price_list
    })
    if (nextPriceList) {
      // Ensure the price list exists in dropdown options
      setPriceLists((prev) => (prev.includes(nextPriceList) ? prev : [...prev, nextPriceList]))
      setSelectedPriceList(nextPriceList)
      onPriceListChange?.(nextPriceList)
    }
    // Notify parent component about customer selection
    onCustomerSelect?.(customer)
  }

  const handlePriceListChange = (priceList: string) => {
    setSelectedPriceList(priceList)
    if (activeTabId) {
      setTabEdited(activeTabId, true) // Mark tab as edited when price list changes
    }
  }

  const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = event.target.value
    setOrderDate(newDate)
    if (activeTabId) {
      updateTabPostingDate(activeTabId, newDate) // Store the selected date in the tab
      setTabEdited(activeTabId, true) // Mark tab as edited when date changes
    }
  }


  const ribbonClipPath = 'polygon(12% 0%, 88% 0%, 100% 50%, 88% 100%, 12% 100%, 0% 50%)'
  const orderStatusText =
    currentTab?.orderData?.order_status || currentTab?.invoiceStatus || 'N/A'
  const returnStatusText =
    currentTab?.invoiceCustomReverseStatus ||
    (Array.isArray(currentTab?.orderData?.linked_invoices) &&
      currentTab?.orderData?.linked_invoices[0]?.custom_reverse_status) ||
    'N/A'

  return (
    <div className="relative p-3 bg-white/60 backdrop-blur border-b border-white/20">
      {hasSavedOrder && (
        <button
          type="button"
          onClick={handleGlobalRefresh}
          className="absolute right-[28px] top-[58px] z-[70] pointer-events-auto inline-flex items-center justify-center rounded-full border border-gray-200 bg-white p-2 text-gray-600 shadow hover-border-blue-300 hover:text-blue-600"
          title="Refresh order data in POS"
        >
          <RefreshCcw className="h-4 w-4" />
        </button>
      )}
      {/* Order & Return ribbons */}
      <div className="pointer-events-none absolute right-[28px] top-0 z-[60] flex flex-col gap-3 items-end">
        <div
          className="px-3 py-1 bg-gradient-to-r from-amber-400 to-orange-400 text-white text-[10px] font-semibold uppercase shadow-lg tracking-wide origin-top-right"
          style={{ 
            clipPath: ribbonClipPath, 
            transform: 'rotate(42deg) translateX(30px)',
            width: '160px',
            height: '26px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <span className="whitespace-nowrap overflow-hidden text-ellipsis">{orderStatusText}</span>
        </div>
        <div
          className="px-3 py-1 bg-gradient-to-r from-purple-400 to-indigo-400 text-white text-[9px] font-semibold uppercase shadow-lg tracking-wide origin-top-right"
          style={{ 
            clipPath: ribbonClipPath, 
            transform: 'rotate(42deg) translateX(30px) translateY(-6px)',
            width: '160px',
            height: '26px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <span className="whitespace-nowrap overflow-hidden text-ellipsis">{returnStatusText}</span>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-4 gap-6">
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">Customer</label>
          <Button
            onClick={() => {
              if (!isReadOnly) {
                if (!activeTabId) {
                  toast.error('No active tab. Please create a new order first.')
                  return
                }
                setShowCustomerModal(true)
              }
            }}
            disabled={isReadOnly}
            className={`w-full p-4 bg-white/80 border border-white/40 rounded-xl shadow-lg focus:ring-2 focus:ring-accent focus:border-transparent transition-all text-left flex items-center justify-between ${
              isReadOnly ? 'opacity-60 cursor-not-allowed' : 'hover:bg-white/90'
            }`}
          >
            <span className={`font-bold ${!selectedCustomer?.name ? 'text-gray-400' : ''}`}>
              {!selectedCustomer?.name ? 'Select Customer' : selectedCustomer.name}
            </span>
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </Button>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">Price List</label>
          <Select 
            value={selectedPriceList} 
            onValueChange={handlePriceListChange}
            disabled={loadingPriceLists || isReadOnly}
          >
            <SelectTrigger className={`w-full p-4 bg-white/80 border border-white/40 rounded-xl shadow-lg focus:ring-2 focus:ring-accent focus:border-transparent transition-all [&_span]:font-bold ${
              isReadOnly ? 'opacity-60 cursor-not-allowed' : ''
            }`}>
              <SelectValue placeholder={loadingPriceLists ? "Loading price lists..." : "Select Price List"} />
            </SelectTrigger>
            <SelectContent className="bg-white border-gray-200 shadow-lg">
              {loadingPriceLists ? (
                <SelectItem value="loading" disabled>Loading price lists...</SelectItem>
              ) : priceLists.length > 0 ? (
                priceLists.map((priceList) => (
                  <SelectItem key={priceList} value={priceList}>
                    {priceList}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="Standard Selling">Standard Selling</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">Date</label>
          <Input
            type="date"
            value={orderDate}
            onChange={handleDateChange}
            disabled={isReadOnly || !isDateChangeAllowed}
            className={`w-full p-4 bg-white/80 border border-white/40 rounded-xl shadow-lg focus:ring-2 focus:ring-accent focus:border-transparent transition-all font-bold ${
              isReadOnly || !isDateChangeAllowed ? 'opacity-60 cursor-not-allowed' : ''
            }`}
          />
        </div>

        {/* Delivery options removed as requested */}
      </div>

      {/* Status badges were moved above; nothing here */}

      {/* Customer Search Modal */}
      <CustomerSearchModal
        open={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
        onSelect={handleCustomerSelect}
      />
    </div>
  );
}

export default OrderDetails
