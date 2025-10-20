import { Fragment, useState } from 'react'
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
import { toast } from 'sonner'

const POSInterface: React.FC = () => {
  const [open, setOpen] = useState(false)
  const [selectedItemId, setSelectedItemId] = useState<string | undefined>()
  const [shouldStartEditing, setShouldStartEditing] = useState(false)

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

    setSelectedItemId(items[newIndex].item_code);
  };

  useHotkeys('shift', () => setOpen(true))
  useHotkeys('backspace', () => {
    if (selectedItemId) {
      removeItem(selectedItemId);
    }
  }, { enableOnFormTags: false })
  useHotkeys('down', () => navigateItem('down'), { enableOnFormTags: false })
  useHotkeys('up', () => navigateItem('up'), { enableOnFormTags: false })
  useHotkeys('space', () => {
    if (selectedItemId) {
      toast.info('Press Space on a selected item to edit');
    }
  }, { enableOnFormTags: false, preventDefault: true })

  return (
    <Fragment>
      <div className="h-screen bg-gray-50 flex w-screen">
        <div className="flex-1 flex flex-col">
          <Header />
          {/* <button onClick={() => setOpen(true)} className="m-4 p-2 bg-blue-500 text-white rounded">
            Open
          </button> */}
          <ActionButtons />
          {/* Fixed top: Order details */}
          <OrderDetails />

          {/* Items area takes remaining space; inner table handles its own scroll */}
          <div className="flex-1">
            <ItemsTable
              onRemoveItem={removeItem}
              selectedItemId={selectedItemId}
              selectItem={selectItem}
              shouldStartEditing={shouldStartEditing}
              onEditingStarted={() => setShouldStartEditing(false)}
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
        />
      </div>
      <ProductSearchModal
        open={open}
        onOpenChange={setOpen}
        onSelect={addItem}
      />
    </Fragment>
  )
}

export default POSInterface
