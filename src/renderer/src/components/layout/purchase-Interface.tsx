import React, { Fragment, useState } from 'react'
import { toast } from 'sonner'

import PurchaseItemsTable from '@renderer/components/blocks/purchase/purchase-items-table'
import ProductSearchModal from '@renderer/components/blocks/products/product-modal'

import PurchaseActionButtons from '@renderer/components/blocks/purchase/purchase-action-buttons'
import PurchaseHeader from '@renderer/components/blocks/purchase/purchase-header'
import SupplierModal from '@renderer/components/blocks/supplier/supplier-modal'
import PurchaseRightPanel from '@renderer/components/blocks/purchase/right-panel/right-panel'
import PurchaseDiscountSection from '@renderer/components/blocks/purchase/purchase-discount-section'

import { usePurchaseTabStore } from '@renderer/store/usePurchaseTabStore'
import { usePOSProfileStore } from '@renderer/store/usePOSProfileStore'
import { usePosProfile } from '@renderer/hooks/useProfile'
import { useAuthStore } from '@renderer/store/useAuthStore'

const PurchaseInterface: React.FC = () => {
  const [productModalOpen, setProductModalOpen] = useState(false)
  const [supplierModalOpen, setSupplierModalOpen] = useState(false)
  const [selectedItemId, setSelectedItemId] = useState<string | undefined>()
  const [shouldStartEditing, setShouldStartEditing] = useState(false)
  const [rightPanelTab, setRightPanelTab] = useState<'product' | 'customer' | 'prints' | 'payments' | 'orders'>('product')

  const [saveCompleted] = useState(0)

  const {
    getCurrentTab,
    getCurrentTabItems,
    getCurrentTabSupplier,
    activeTabId,
    addItemToTab,
    removeItemFromTab,
    updateTabSupplier,
    setTabEdited
  } = usePurchaseTabStore()

  const currentTab = getCurrentTab()
  const supplier = getCurrentTabSupplier()
  const items = getCurrentTabItems()
  const buyingPriceList = currentTab?.buying_price_list || 'Standard Buying'

  // Load POS profile once (so privileges + price list are available globally)
  const { data: posProfile } = usePosProfile()
  const { user } = useAuthStore()
  const { setProfile, setCurrentUserPrivileges } = usePOSProfileStore()

  React.useEffect(() => {
    if (posProfile) {
      setProfile(posProfile)
      if (user?.email) setCurrentUserPrivileges(user.email)
    }
  }, [posProfile, user?.email, setProfile, setCurrentUserPrivileges])

  const handleNewPurchase = () => {
    // Tab is already created by PurchaseHeader, just open supplier modal
    // Small delay to ensure tab is created before opening modal
    setTimeout(() => {
      setSupplierModalOpen(true)
    }, 100)
  }

  const addItem = (item: any) => {
    if (!activeTabId) {
      toast.error('No active tab. Please create a new purchase order first.')
      return
    }
    const itemToAdd = { ...item, quantity: 1 }
    addItemToTab(activeTabId, itemToAdd)
    setSelectedItemId(item.item_code)
    setRightPanelTab('product')
    setShouldStartEditing(true)
  }

  const removeItem = (itemCode: string) => {
    if (!activeTabId) return
    removeItemFromTab(activeTabId, itemCode)
    if (selectedItemId === itemCode) setSelectedItemId(undefined)
  }

  const handleItemSelect = (itemId: string) => {
    setSelectedItemId(itemId)
    setRightPanelTab('product')
  }

  return (
    <Fragment>
      <div className="h-full bg-gray-50 flex w-full overflow-hidden scrollbar-hide">
        <div className="flex-1 flex flex-col">
          <div className="flex w-full items-center bg-slate-50 border-b border-gray-200">
            <div className="w-[55%]">
              <PurchaseHeader onNewOrder={handleNewPurchase} />
            </div>
            <div className="w-[45%] flex justify-end">
              <PurchaseActionButtons isItemTableEditing={false} />
            </div>
          </div>

          <div className="flex-1 flex flex-col">
            <PurchaseItemsTable
              onRemoveItem={removeItem}
              selectedItemId={selectedItemId}
              selectItem={handleItemSelect}
              onAddItemClick={() => {
                if (!supplier) {
                  toast.error('Select supplier before selecting items')
                  setSupplierModalOpen(true)
                  return
                }
                setProductModalOpen(true)
              }}
              shouldStartEditing={shouldStartEditing}
              onEditingStarted={() => setShouldStartEditing(false)}
              onSaveCompleted={saveCompleted}
              isProductModalOpen={productModalOpen}
              isCustomerModalOpen={supplierModalOpen}
            />

            {/* Fixed bottom: Discount/Summary section */}
            <PurchaseDiscountSection
              forceOpenSupplierModal={supplierModalOpen}
              onSupplierModalChange={setSupplierModalOpen}
              onSupplierSelect={(supplier) => {
                if (!activeTabId) return
                updateTabSupplier(activeTabId, {
                  name: supplier.supplier_name || supplier.name,
                  supplier_id: supplier.supplier_id || supplier.name,
                  mobile_no: supplier.mobile_no,
                  email: supplier.email,
                  tax_id: supplier.tax_id
                })
                setRightPanelTab('customer')
              }}
            />
          </div>
        </div>

        <PurchaseRightPanel
          key={`${supplier?.name || 'no-supplier'}-${selectedItemId || 'no-item'}`}
          selectedItemId={selectedItemId}
          items={items}
          selectedCustomer={supplier as any}
          activeTab={rightPanelTab}
          onTabChange={(tab) => setRightPanelTab(tab as any)}
          onAddItem={addItem}
          onReplaceItem={() => { }}
        />
      </div>

      <ProductSearchModal
        open={productModalOpen}
        onOpenChange={setProductModalOpen}
        onSelect={addItem}
        selectedPriceList={buyingPriceList}
      />

      <SupplierModal
        open={supplierModalOpen}
        onClose={() => setSupplierModalOpen(false)}
        onSelect={(s) => {
          if (!activeTabId) {
            toast.error('No active tab. Please create a new purchase order first.')
            setSupplierModalOpen(false)
            return
          }
          // Update supplier in the tab store
          updateTabSupplier(activeTabId, {
            name: (s as any).supplier_name || s.name,
            supplier_id: (s as any).supplier_id || (s as any).name || s.name,
            mobile_no: (s as any).mobile_no,
            email: (s as any).email,
            tax_id: (s as any).tax_id
          })
          // Mark tab as edited since supplier was selected
          setTabEdited(activeTabId, true)
          setSupplierModalOpen(false)
          setRightPanelTab('customer')
          toast.success(`Supplier "${(s as any).supplier_name || s.name}" selected`)
        }}
      />
    </Fragment>
  )
}

export default PurchaseInterface


