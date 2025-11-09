import React, { useState, useEffect } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { ChevronDown } from "lucide-react"

import { Input } from '@renderer/components/ui/input'
import { Button } from '@renderer/components/ui/button'

import CustomerSearchModal from '../customer/customer-modal'
import { usePOSTabStore } from '@renderer/store/usePOSTabStore'
import { usePOSProfileStore } from '@renderer/store/usePOSProfileStore'



type OrderDetailsProps = {
  onPriceListChange?: (priceList: string) => void
  onCustomerModalChange?: (isOpen: boolean) => void
  onCustomerSelect?: (customer: any) => void
  forceOpenCustomerModal?: boolean
}

const OrderDetails: React.FC<OrderDetailsProps> = ({ onPriceListChange, onCustomerModalChange, onCustomerSelect, forceOpenCustomerModal }) => {

  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [selectedPriceList, setSelectedPriceList] = useState<string>('Standard Selling');
  const [priceLists, setPriceLists] = useState<string[]>([]);
  const [loadingPriceLists, setLoadingPriceLists] = useState(false);
  // Get current date in local timezone (YYYY-MM-DD format)
  const getCurrentDate = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  
  const [orderDate, setOrderDate] = useState<string>(getCurrentDate());
  const { activeTabId, getCurrentTabCustomer, updateTabCustomer, setTabEdited, getCurrentTab, updateTabPostingDate } = usePOSTabStore()
  const { profile } = usePOSProfileStore()

  const selectedCustomer = getCurrentTabCustomer()
  const currentTab = getCurrentTab()
  
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


  return (
    <div className="p-3 bg-white/60 backdrop-blur border-b border-white/20">
      <div className="grid grid-cols-4 gap-6">
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">Customer</label>
          <Button
            onClick={() => !isReadOnly && setShowCustomerModal(true)}
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
