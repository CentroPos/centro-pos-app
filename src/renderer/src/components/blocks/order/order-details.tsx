import React, { useState } from 'react'
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

import CustomerSearchModal from '../customer/customer-search'
import { usePOSTabStore } from '@renderer/store/usePOSTabStore'
import { usePOSProfileStore } from '@renderer/store/usePOSProfileStore'



type OrderDetailsProps = {
  onPriceListChange?: (priceList: string) => void
}

const OrderDetails: React.FC<OrderDetailsProps> = ({ onPriceListChange }) => {

  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [selectedPriceList, setSelectedPriceList] = useState<string>('Standard Selling');
  const { activeTabId, getCurrentTabCustomer, updateTabCustomer } = usePOSTabStore()
  const { profile } = usePOSProfileStore()

  const selectedCustomer = getCurrentTabCustomer()

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
    }
    setShowCustomerModal(false)
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
            onValueChange={setSelectedPriceList}
          >
            <SelectTrigger className="w-full p-4 bg-white/80 border border-white/40 rounded-xl shadow-lg focus:ring-2 focus:ring-accent focus:border-transparent transition-all">
              <SelectValue placeholder="Select Price List" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Standard Selling">Standard Selling</SelectItem>
              <SelectItem value="Wholesale Price List">Wholesale Price List</SelectItem>
              <SelectItem value="Retail Price List">Retail Price List</SelectItem>
              <SelectItem value="VIP Price List">VIP Price List</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">Date</label>
          <Input
            type="date"
            defaultValue="2025-01-21"
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
