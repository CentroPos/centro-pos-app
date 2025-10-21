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



const OrderDetails: React.FC = () => {

  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const { activeTabId, getCurrentTabCustomer, updateTabCustomer } = usePOSTabStore()

  const selectedCustomer = getCurrentTabCustomer()

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
          <Select defaultValue="default">
            <SelectTrigger className="w-full p-4 bg-white/80 border border-white/40 rounded-xl shadow-lg focus:ring-2 focus:ring-accent focus:border-transparent transition-all">
              <SelectValue placeholder="Select Price List" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default Price List</SelectItem>
              <SelectItem value="wholesale">Wholesale Price List</SelectItem>
              <SelectItem value="retail">Retail Price List</SelectItem>
              <SelectItem value="vip">VIP Price List</SelectItem>
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
