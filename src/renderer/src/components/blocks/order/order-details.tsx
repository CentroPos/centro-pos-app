import React, { useState } from 'react'
import { ChevronDown } from 'lucide-react'

import { Button } from '@renderer/components/ui/button'

import CustomerSearchModal from '../customer/customer-modal'
import { usePOSTabStore } from '@renderer/store/usePOSTabStore'
import { toast } from 'sonner'



type OrderDetailsProps = {
  onPriceListChange?: (priceList: string) => void
  onCustomerModalChange?: (isOpen: boolean) => void
  onCustomerSelect?: (customer: any) => void
  forceOpenCustomerModal?: boolean
}

const OrderDetails: React.FC<OrderDetailsProps> = ({
  onCustomerModalChange,
  onCustomerSelect,
  forceOpenCustomerModal
}) => {
  const [showCustomerModal, setShowCustomerModal] = useState(false)

  const {
    activeTabId,
    getCurrentTabCustomer,
    updateTabCustomer,
    setTabEdited
  } = usePOSTabStore()

  const selectedCustomer = getCurrentTabCustomer()
  // Subscribe to current tab reactively so UI updates after actions (save/confirm/pay/return)
  const currentTab = usePOSTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId))

  // Check if order is confirmed - similar to items table
  const isReadOnly = currentTab?.status === 'confirmed' || currentTab?.status === 'paid' ||
    (currentTab?.orderData && Number(currentTab.orderData.docstatus) === 1)


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

    // Notify parent component about customer selection
    onCustomerSelect?.(customer)
  }

  return (
    <div className="relative p-3 bg-white/60 backdrop-blur border-b border-white/20">
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
            className={`w - full p - 4 bg - white / 80 border border - white / 40 rounded - xl shadow - lg focus: ring - 2 focus: ring - accent focus: border - transparent transition - all text - left flex items - center justify - between ${isReadOnly ? 'opacity-60 cursor-not-allowed' : 'hover:bg-white/90'
              } `}
          >
            <span className={`font - bold ${!selectedCustomer?.name ? 'text-gray-400' : ''} `}>
              {!selectedCustomer?.name ? 'Select Customer' : selectedCustomer.name}
            </span>
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </Button>
        </div>
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
