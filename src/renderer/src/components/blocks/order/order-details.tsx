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
  const { activeTabId, getCurrentTabCustomer, updateTabCustomer, setTabEdited } = usePOSTabStore()
  const { profile } = usePOSProfileStore()

  const selectedCustomer = getCurrentTabCustomer()

  // Fetch price lists from API
  useEffect(() => {
    const fetchPriceLists = async () => {
      setLoadingPriceLists(true)
      try {
        console.log('📋 Fetching price lists from API...')
        const response = await window.electronAPI?.proxy?.request({
          method: 'GET',
          url: '/api/resource/Price List'
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

  const handleCustomerSelect = (customer: any) => {
    if (activeTabId) {
      updateTabCustomer(activeTabId, customer)
      setTabEdited(activeTabId, true) // Mark tab as edited when customer changes
    }
    setShowCustomerModal(false)
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
    if (activeTabId) {
      setTabEdited(activeTabId, true) // Mark tab as edited when date changes
    }
  }


  return (
    <div className="p-3 bg-white/60 backdrop-blur border-b border-white/20">
      <div className="grid grid-cols-4 gap-6">
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">Customer</label>
          <Button
            onClick={() => setShowCustomerModal(true)}
            className="w-full p-4 bg-white/80 border border-white/40 rounded-xl shadow-lg focus:ring-2 focus:ring-accent focus:border-transparent transition-all text-left flex items-center justify-between hover:bg-white/90"
          >
            <span className={selectedCustomer.name === 'Walking Customer' ? 'text-gray-400' : ''}>
              {selectedCustomer.name === 'Walking Customer' ? 'Select Customer' : selectedCustomer.name}
            </span>
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </Button>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">Price List</label>
          <Select 
            value={selectedPriceList} 
            onValueChange={handlePriceListChange}
            disabled={loadingPriceLists}
          >
            <SelectTrigger className="w-full p-4 bg-white/80 border border-white/40 rounded-xl shadow-lg focus:ring-2 focus:ring-accent focus:border-transparent transition-all">
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
            defaultValue={new Date().toISOString().slice(0, 10)}
            onChange={handleDateChange}
            className="w-full p-4 bg-white/80 border border-white/40 rounded-xl shadow-lg focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
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
