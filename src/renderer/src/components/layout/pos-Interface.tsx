import React, { Fragment, useState } from 'react'
import ActionButtons from '../blocks/common/action-buttons'
import OrderDetails from '../blocks/order/order-details'
import ItemsTable from '../blocks/common/items-table'
import PaymentAlert from '../blocks/payment/payment-alert'
import RightPanel from '../blocks/right-panel/right-panel'
import Header from '../blocks/common/header'
import DiscountSection from '../blocks/products/discount-section'
import ProductSearchModal from '../blocks/products/product-modal'
import { useHotkeys } from 'react-hotkeys-hook'
import { usePOSTabStore } from '@renderer/store/usePOSTabStore'
import { usePosProfile, useProfileDetails } from '@renderer/hooks/useProfile'
import { usePOSProfileStore } from '@renderer/store/usePOSProfileStore'
import { useAuthStore } from '@renderer/store/useAuthStore'
import { toast } from 'sonner'

const POSInterface: React.FC = () => {
  const [open, setOpen] = useState(false)
  const [selectedItemId, setSelectedItemId] = useState<string | undefined>()
  const [shouldStartEditing, setShouldStartEditing] = useState(false)
  const [rightPanelTab, setRightPanelTab] = useState<'product' | 'customer' | 'prints' | 'payments' | 'orders'>('product')
  const [selectedPriceList, setSelectedPriceList] = useState<string>('Standard Selling')
  const [saveCompleted, setSaveCompleted] = useState(0)
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false)
  const [isItemTableEditing, setIsItemTableEditing] = useState(false)

  // Handle item selection - switch to product tab
  const handleItemSelect = (itemId: string) => {
    setSelectedItemId(itemId)
    setRightPanelTab('product')
  }

  // Handle customer selection - switch to customer tab and unselect all items
  const handleCustomerSelect = (customer: any) => {
    setSelectedItemId(undefined) // Unselect all items
    setRightPanelTab('customer')
  }

  const {
    getCurrentTabItems,
    addItemToTab,
    removeItemFromTab,
    activeTabId,
    itemExistsInTab,
    getCurrentTab,
    getCurrentTabCustomer
  } = usePOSTabStore();

  // Get selected customer from store
  const selectedCustomer = getCurrentTabCustomer()

  const items = getCurrentTabItems();
  const currentTab = getCurrentTab();

  // Load POS profile and user profile details once POS loads
  const { data: profileDetails } = useProfileDetails()
  const { data: posProfile } = usePosProfile()
  const { user } = useAuthStore()
  const { setProfile, setCurrentUserPrivileges } = usePOSProfileStore()

  // Test direct API call and set profile data
  React.useEffect(() => {
    const loadPOSProfile = async () => {
      try {
        console.log('🧪 Testing direct POS profile API call...')
        const response = await window.electronAPI?.proxy?.request({
          url: '/api/method/centro_pos_apis.api.profile.get_pos_profile',
          params: {}
        })
        console.log('🧪 Direct API response:', response)
        
        // If direct API call succeeds, use that data
        if (response?.data?.data) {
          console.log('✅ Using direct API data:', response.data.data)
          console.log('✅ Applicable users:', response.data.data.applicable_for_users)
          setProfile(response.data.data)
          
          // Try to get user email from auth store or use the first user from API
          let userEmail = user?.email
          
          // If no user email from auth store, or if we can't find a match, use the first user from API
          if (!userEmail || !response.data.data.applicable_for_users?.find(u => u.user === userEmail)) {
            if (response.data.data.applicable_for_users?.length > 0) {
              userEmail = response.data.data.applicable_for_users[0].user
              console.log('⚠️ Using email from API response (no match found):', userEmail)
            }
          } else {
            console.log('✅ Found matching user email in auth store:', userEmail)
          }
          
          if (userEmail) {
            console.log('✅ Setting privileges for user:', userEmail)
            console.log('✅ User object:', user)
            setCurrentUserPrivileges(userEmail)
          } else {
            console.log('❌ No user email found anywhere')
            console.log('❌ User object:', user)
          }
        }
      } catch (error) {
        console.error('🧪 Direct API error:', error)
      }
    }
    
    loadPOSProfile()
  }, [user?.email, setProfile, setCurrentUserPrivileges])

  // Set POS profile data when loaded
  React.useEffect(() => {
    console.log('🔍 POS Profile Debug:', {
      posProfile,
      posProfileData: posProfile?.data,
      userEmail: user?.email,
      hasData: !!posProfile?.data?.data
    })
    
    if (posProfile?.data?.data) {
      console.log('✅ Setting POS profile data:', posProfile.data.data)
      setProfile(posProfile.data.data)
      // Set current user privileges
      if (user?.email) {
        console.log('✅ Setting user privileges for:', user.email)
        setCurrentUserPrivileges(user.email)
      }
    } else {
      console.log('❌ No POS profile data found')
    }
  }, [posProfile, user?.email, setProfile, setCurrentUserPrivileges])

  const itemExists = (itemCode: string) => {
    if (!activeTabId) return false;
    return itemExistsInTab(activeTabId, itemCode);
  };

  // Add item to current tab
  const addItem = (item: any) => {
    if (!activeTabId) {
      toast.error('No active tab. Please create a new order first.');
      return;
    }

    if (itemExists(item.item_code)) {
      toast.error('Item already in cart');
      return;
    }

    console.log('🛒 Adding item to cart:', {
      item_code: item.item_code,
      item_name: item.item_name,
      standard_rate: item.standard_rate,
      uom: item.uom,
      quantity: item.quantity,
      fullItem: item
    });

    addItemToTab(activeTabId, item);
    setSelectedItemId(item.item_code);

    // Trigger auto-editing
    setShouldStartEditing(true);
  };

  // Remove item from current tab
  const removeItem = (itemCode: string) => {
    if (!activeTabId) return;

    removeItemFromTab(activeTabId, itemCode);

    if (selectedItemId === itemCode) {
      setSelectedItemId(undefined);
    }
  };

  // Select item
  const selectItem = (itemCode: string) => {
    setSelectedItemId(itemCode);
  };

  // Navigate items (up/down)
  const navigateItem = (direction: 'up' | 'down') => {
    if (items.length === 0) return;

    const currentIndex = selectedItemId
      ? items.findIndex(item => item.item_code === selectedItemId)
      : -1;

    let newIndex;
    if (direction === 'down') {
      newIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
    } else {
      newIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
    }

    console.log('🔄 Navigation:', { 
      direction, 
      currentIndex, 
      newIndex, 
      totalItems: items.length, 
      selectedItemId, 
      newItemCode: items[newIndex]?.item_code,
      items: items.map(item => item.item_code)
    });
    
    // Ensure we have a valid item at the new index
    if (items[newIndex]) {
      setSelectedItemId(items[newIndex].item_code);
    } else {
      console.error('❌ Invalid navigation index:', newIndex, 'items length:', items.length);
    }
  };

  useHotkeys('shift', () => setOpen(true))
  useHotkeys('backspace', () => {
    if (selectedItemId) {
      removeItem(selectedItemId);
    }
  }, { enableOnFormTags: false })
  // Arrow keys are handled by the items table component, so we don't need global handlers here
  // Enter key is handled by the items table component, so we don't need a global handler here
  useHotkeys('space', () => {
    // Check if we're in a text input field - if so, don't prevent default spacebar behavior
    const activeElement = document.activeElement
    if (activeElement && (
      activeElement.tagName === 'INPUT' || 
      activeElement.tagName === 'TEXTAREA' || 
      activeElement.contentEditable === 'true'
    )) {
      return // Allow normal spacebar behavior in text fields
    }
    
    // Spacebar functionality is handled by individual components
    // No need for global notification
  }, { enableOnFormTags: false, preventDefault: false })

  return (
    <Fragment>
      <div className="h-screen bg-gray-50 flex w-screen overflow-hidden scrollbar-hide">
        <div className="flex-1 flex flex-col">
          <Header />
          {/* <button onClick={() => setOpen(true)} className="m-4 p-2 bg-blue-500 text-white rounded">
            Open
          </button> */}
          <ActionButtons 
            onNavigateToPrints={() => setRightPanelTab('prints')} 
            selectedPriceList={selectedPriceList}
            onSaveCompleted={() => setSaveCompleted(prev => prev + 1)}
            isItemTableEditing={isItemTableEditing}
          />
          {/* Fixed top: Order details */}
          <OrderDetails 
            onPriceListChange={setSelectedPriceList} 
            onCustomerModalChange={setIsCustomerModalOpen}
            onCustomerSelect={handleCustomerSelect}
          />

          {/* Items area takes remaining space; inner table handles its own scroll */}
          <div className="flex-1">
            <ItemsTable
              onRemoveItem={removeItem}
              selectedItemId={selectedItemId}
              selectItem={handleItemSelect}
              shouldStartEditing={shouldStartEditing}
              onEditingStarted={() => setShouldStartEditing(false)}
              onAddItemClick={() => setOpen(true)}
              onSaveCompleted={saveCompleted}
              isProductModalOpen={open}
              isCustomerModalOpen={isCustomerModalOpen}
              onEditingStateChange={setIsItemTableEditing}
            />
          </div>

          {/* Fixed bottom: Discount/Summary section */}
          <DiscountSection />
          <PaymentAlert orderNumber={currentTab?.orderId || ''} />
        </div>
        <RightPanel 
          key={`${selectedCustomer?.name || 'no-customer'}-${selectedItemId || 'no-item'}`}
          selectedItemId={selectedItemId} 
          items={items} 
          selectedCustomer={selectedCustomer}
          activeTab={rightPanelTab}
          onTabChange={setRightPanelTab}
        />
      </div>
      <ProductSearchModal
        open={open}
        onOpenChange={setOpen}
        onSelect={addItem}
        selectedPriceList={selectedPriceList}
      />
    </Fragment>
  )
}

export default POSInterface
