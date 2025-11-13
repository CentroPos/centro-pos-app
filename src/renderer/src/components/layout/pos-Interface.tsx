import React, { Fragment, useState } from 'react'
import ActionButtons from '../blocks/common/action-buttons'
import OrderDetails from '../blocks/order/order-details'
import ItemsTable from '../blocks/common/items-table'
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
  const [insufficientStockErrors, setInsufficientStockErrors] = useState<Array<{message: string, title: string, indicator: string, itemCode: string}>>([])
  const [isErrorBoxFocused, setIsErrorBoxFocused] = useState(false)

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

  // Handle closing insufficient stock errors
  const handleCloseInsufficientStockErrors = () => {
    setInsufficientStockErrors([])
  }

  // Handle focusing on a specific item from error box
  const handleFocusItem = (itemCode: string) => {
    console.log('🎯 Focusing on item:', itemCode)
    // Find the item by code and select it
    const items = getCurrentTabItems()
    const item = items.find(item => item.item_code === itemCode || item.code === itemCode)
    console.log('🔍 Found item:', item)
    if (item) {
      setSelectedItemId(item.item_code) // Use item_code for consistency
      setRightPanelTab('product')
      console.log('✅ Selected item and switched to product tab')
      
      // Trigger editing mode for the quantity field
      setTimeout(() => {
        // Find the quantity cell and click it to start editing
        const quantityCell = document.querySelector(`[data-item-code="${item.item_code}"][data-field="quantity"]`) as HTMLElement
        console.log('🔍 Found quantity cell:', quantityCell)
        if (quantityCell) {
          quantityCell.click()
          console.log('🖱️ Clicked quantity cell')
          
          // Wait a bit more for the input to appear, then focus it
          setTimeout(() => {
            // Look for the specific input with data attributes
            const quantityInput = document.querySelector(`input[data-item-code="${item.item_code}"][data-field="quantity"]`) as HTMLInputElement
            console.log('🔍 Found quantity input:', quantityInput)
            if (quantityInput) {
              quantityInput.focus()
              quantityInput.select()
              console.log('✅ Focused and selected quantity input')
            } else {
              // Fallback: find any number input in the quantity cell
              const fallbackInput = quantityCell.querySelector(`input[type="number"]`) as HTMLInputElement
              console.log('🔍 Found fallback input:', fallbackInput)
              if (fallbackInput) {
                fallbackInput.focus()
                fallbackInput.select()
                console.log('✅ Focused and selected fallback input')
              }
            }
          }, 150)
        }
      }, 100)
    }
  }

  const {
    getCurrentTabItems,
    addItemToTab,
    removeItemFromTab,
    activeTabId,
    itemExistsInTab,
    getCurrentTab,
    getCurrentTabCustomer,
    createNewTab,
    lastAction,
    setLastAction
  } = usePOSTabStore();

  // Get selected customer from store
  const selectedCustomer = getCurrentTabCustomer()

  const items = getCurrentTabItems();
  const currentTab = getCurrentTab();
  
  // Clear selected item when no active tab
  React.useEffect(() => {
    if (!activeTabId && selectedItemId) {
      setSelectedItemId(undefined)
    }
  }, [activeTabId, selectedItemId])

  // When a duplicate or open-existing action switches to a new tab, switch right panel to Customer
  React.useEffect(() => {
    if (lastAction === 'duplicated' || lastAction === 'opened') {
      setRightPanelTab('customer')
      setLastAction(null)
    }
  }, [activeTabId, lastAction, setLastAction])

  // Load POS profile and user profile details once POS loads
  const { data: profileDetails } = useProfileDetails()
  const { data: posProfile } = usePosProfile()
  const { user, isAuthenticated } = useAuthStore()
  const { setProfile, setCurrentUserPrivileges } = usePOSProfileStore()
  const { profile } = usePOSProfileStore()

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

  // After login/session validation, default right panel to Orders
  React.useEffect(() => {
    if (isAuthenticated) {
      setRightPanelTab('orders')
    }
  }, [isAuthenticated])

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

    const allowDuplicate = profile?.custom_allow_duplicate_items_in_cart === 1
    if (!allowDuplicate && itemExists(item.item_code)) {
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
    setRightPanelTab('product'); // Switch to product tab when item is added

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

  useHotkeys('backspace', () => {
    if (selectedItemId) {
      removeItem(selectedItemId);
    }
  }, { enableOnFormTags: false })
  
  // Ctrl+S for save/update order
  useHotkeys('ctrl+s', (event) => {
    event.preventDefault()
    if (!isItemTableEditing && getCurrentTab()?.isEdited) {
      // Trigger save by clicking the save button
      const saveButton = document.querySelector('[data-testid="save-button"]') as HTMLButtonElement
      if (saveButton && !saveButton.disabled) {
        saveButton.click()
      }
    }
  }, { enableOnFormTags: false })
  
  // Ctrl+N for new order
  useHotkeys('ctrl+n', (event) => {
    event.preventDefault()
    const created = createNewTab()
    if (created) {
      // Open customer selection automatically when new order is created
      setIsCustomerModalOpen(true)
    }
  }, { enableOnFormTags: false })
  
  // Ctrl+R for return
  useHotkeys('ctrl+r', (event) => {
    event.preventDefault()
    // Trigger return by clicking the return button
    const returnButton = document.querySelector('[data-testid="return-button"]') as HTMLButtonElement
    if (returnButton && !returnButton.disabled) {
      returnButton.click()
    }
  }, { enableOnFormTags: false })
  
  // Arrow keys are handled by the items table component, so we don't need global handlers here
  // Enter key is handled by the items table component, so we don't need a global handler here
  // Spacebar is handled by items-table component for UOM cycling
  // No global handler needed here

  // React effects to handle custom events
  React.useEffect(() => {
    const handleOpenCustomerModal = () => {
      setIsCustomerModalOpen(true);
      setOpen(false); // only customer select
    };
    window.addEventListener('openCustomerModal', handleOpenCustomerModal);
    return () => window.removeEventListener('openCustomerModal', handleOpenCustomerModal);
  }, []);

  React.useEffect(() => {
    const handleOpenPrintsTab = () => {
      setRightPanelTab('prints');
    };
    window.addEventListener('openPrintsTab', handleOpenPrintsTab);
    return () => window.removeEventListener('openPrintsTab', handleOpenPrintsTab);
  }, []);

  React.useEffect(() => {
    const handleGlobalRefresh = () => {
      console.log('🔁 POSInterface refreshing main page data')
      // Trigger a re-fetch by toggling the saveCompleted counter
      setSaveCompleted(prev => prev + 1)
    }

    window.addEventListener('pos-refresh', handleGlobalRefresh)
    return () => window.removeEventListener('pos-refresh', handleGlobalRefresh)
  }, [])

  // Hotkeys
  useHotkeys('ctrl+shift+p', () => setRightPanelTab('prints'), { enableOnFormTags: true });
  useHotkeys('ctrl+shift+c', () => setIsCustomerModalOpen(true), { enableOnFormTags: true });

  return (
    <Fragment>
      <div className="h-screen bg-gray-50 flex w-screen overflow-hidden scrollbar-hide">
        <div className="flex-1 flex flex-col">
          <Header onNewOrder={() => {
            // Open customer selection immediately when a new order is created
            setIsCustomerModalOpen(true)
          }} />
          {/* <button onClick={() => setOpen(true)} className="m-4 p-2 bg-blue-500 text-white rounded">
            Open
          </button> */}
        <ActionButtons
          onNavigateToPrints={() => setRightPanelTab('prints')}
          selectedPriceList={selectedPriceList}
          onSaveCompleted={() => setSaveCompleted(prev => prev + 1)}
          isItemTableEditing={isItemTableEditing}
          onInsufficientStockErrors={setInsufficientStockErrors}
          onFocusItem={handleFocusItem}
        />
          {/* Fixed top: Order details */}
          <OrderDetails 
            onPriceListChange={setSelectedPriceList} 
            onCustomerModalChange={setIsCustomerModalOpen}
            onCustomerSelect={(customer) => {
              handleCustomerSelect(customer)
            }}
            forceOpenCustomerModal={isCustomerModalOpen}
          />

          {/* Items area takes remaining space; inner table handles its own scroll */}
          <div className="flex-1 flex flex-col">
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
              isErrorBoxFocused={isErrorBoxFocused}
              onEditingStateChange={setIsItemTableEditing}
              errorItems={insufficientStockErrors.map(error => error.itemCode).filter(Boolean)}
            />
            
            {/* Fixed bottom: Discount/Summary section */}
            <DiscountSection 
              errors={insufficientStockErrors}
              onCloseErrors={handleCloseInsufficientStockErrors}
              onErrorBoxFocusChange={setIsErrorBoxFocused}
              onFocusItem={handleFocusItem}
            />
          </div>
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
