import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import { Input } from '@renderer/components/ui/input'
import { Search as SearchIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@renderer/components/ui/table'
import { Plus, X } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { usePOSTabStore } from '@renderer/store/usePOSTabStore'
import { useHotkeys } from 'react-hotkeys-hook'
import MultiWarehousePopup from './multi-warehouse-popup'
import api from '@renderer/services/api'
import { API_Endpoints } from '@renderer/config/endpoints'
import { toast } from 'sonner'
import { usePOSProfileStore } from '@renderer/store/usePOSProfileStore';

type Props = {
  selectedItemId?: string
  onRemoveItem: (value: string) => void
  selectItem: (value: string) => void
  shouldStartEditing?: boolean
  onEditingStarted?: () => void
  onAddItemClick?: () => void
  onSaveCompleted?: number
  isProductModalOpen?: boolean
  isCustomerModalOpen?: boolean
  isErrorBoxFocused?: boolean
  onEditingStateChange?: (isEditing: boolean) => void
  errorItems?: string[]
}

type EditField = 'quantity' | 'standard_rate' | 'uom' | 'discount_percentage' | 'item_name'

const ItemsTable: React.FC<Props> = ({ selectedItemId, onRemoveItem, selectItem, shouldStartEditing = false, onEditingStarted, onAddItemClick, onSaveCompleted, isProductModalOpen = false, isCustomerModalOpen = false, isErrorBoxFocused = false, onEditingStateChange, errorItems = [] }) => {
  const { getCurrentTabItems, activeTabId, updateItemInTab, updateItemInTabByIndex, getCurrentTab, setTabEdited } = usePOSTabStore();
  const items = getCurrentTabItems();
  const hasBottomErrors = Array.isArray(errorItems) && errorItems.length > 0;
  const [tableSearch, setTableSearch] = useState('')
  const filteredItems = items.filter((it) => {
    const term = tableSearch.trim().toLowerCase()
    if (!term) return true
    return (
      String(it.item_code || '').toLowerCase().includes(term) ||
      String(it.item_name || '').toLowerCase().includes(term)
    )
  })
  const totalProducts = items.length;
  const totalQuantity = items.reduce((sum, it) => sum + (Number(it.quantity || 0) || 0), 0);
  const currentTab = getCurrentTab();
  const isReadOnly = false; // Temporarily disabled for debugging
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteCandidate, setDeleteCandidate] = useState<string | null>(null)
  const confirmBtnRef = useRef<HTMLButtonElement>(null)
  const cancelBtnRef = useRef<HTMLButtonElement>(null)
  // const isReadOnly = currentTab?.status === 'confirmed' || currentTab?.status === 'paid';

  // Helper function to update item and mark tab as edited (by exact row when possible)
  const updateItemAndMarkEdited = (itemCode: string, updates: any) => {
    if (!activeTabId) return
    const currentRef = filteredItems[selectedRowIndex]
    const absoluteIndex = items.indexOf(currentRef)
    if (absoluteIndex >= 0) {
      updateItemInTabByIndex(activeTabId, absoluteIndex, updates)
    } else {
      updateItemInTab(activeTabId, itemCode, updates)
    }
      setTabEdited(activeTabId, true)
    }

  // Editable field order and keyboard navigation between fields
  type EditField = 'item_name' | 'quantity' | 'uom' | 'discount_percentage' | 'standard_rate'
  const fieldOrder: EditField[] = ['item_name', 'quantity', 'uom', 'discount_percentage', 'standard_rate']
  // Virtual field for actions column (not editable input)
  const extendedFieldOrder: Array<EditField | 'actions'> = [...fieldOrder, 'actions']

  const moveToField = (itemCode: string, field: EditField) => {
    selectItem(itemCode)
    setActiveField(field)
    setIsEditing(true)
    const rowItem = items.find((i) => i.item_code === itemCode)
    if (!rowItem) return
    switch (field) {
      case 'item_name':
        setEditValue(String(rowItem.item_name ?? ''))
        break
      case 'quantity':
        setEditValue(String(rowItem.quantity ?? ''))
        break
      case 'uom':
        setEditValue(String(rowItem.uom ?? 'Nos'))
        break
      case 'discount_percentage':
        setEditValue(String(rowItem.discount_percentage ?? '0'))
        break
      case 'standard_rate':
        setEditValue(String(rowItem.standard_rate ?? ''))
        break
    }
  }

  const handleArrowNavigation = (e: React.KeyboardEvent, currentField: EditField, itemCode: string) => {
    if (showDeleteConfirm) return
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    e.stopPropagation()
    const idx = extendedFieldOrder.indexOf(currentField as any)
    if (idx === -1) return
    const nextIdx = e.key === 'ArrowRight' ? Math.min(idx + 1, extendedFieldOrder.length - 1) : Math.max(idx - 1, 0)
    const nextField = extendedFieldOrder[nextIdx]
    if (nextField === 'actions') {
      // Focus the delete button
      const btn = document.querySelector(`[data-item-code="${itemCode}"] button[data-action="delete"]`) as HTMLButtonElement | null
      if (btn) btn.focus()
      setIsEditing(false)
      return
    }
    moveToField(itemCode, nextField as EditField)
  }

  // Up/Down navigation to same field on previous/next row
  const handleVerticalNavigation = (e: React.KeyboardEvent, currentField: EditField, itemCode: string) => {
    if (showDeleteConfirm) return
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    e.stopPropagation()
    const currentIndex = selectedRowIndex
    const nextIndex = e.key === 'ArrowDown' ? Math.min(currentIndex + 1, filteredItems.length - 1) : Math.max(currentIndex - 1, 0)
    const nextItem = filteredItems[nextIndex]
    if (!nextItem) return
    navigatingRef.current = true
    setSelectedRowIndex(nextIndex)
    moveToField(nextItem.item_code, currentField)
    // After scrolling, force refocus into the active input
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus()
          inputRef.current.select()
        }
      }, 40)
    })
    setTimeout(() => {
      navigatingRef.current = false
    }, 150)
  }

  // Helper function to check if an item has an error
  const hasItemError = (itemCode: string) => {
    return errorItems.includes(itemCode)
  }
  
  const [activeField, setActiveField] = useState<EditField>('quantity');
  const [isEditing, setIsEditing] = useState(false);
  // Selected visual row index to avoid selecting all duplicates
  const [selectedRowIndex, setSelectedRowIndex] = useState(0)
  
  // Notify parent component when editing state changes
  useEffect(() => {
    onEditingStateChange?.(isEditing)
  }, [isEditing, onEditingStateChange])

  // Reset editing state when tab is no longer edited (after save)
  useEffect(() => {
    if (currentTab && !currentTab.isEdited) {
      console.log('🔄 Tab saved, resetting editing state', { isEdited: currentTab.isEdited, isEditing })
      resetEditingState()
    }
  }, [currentTab?.isEdited])

  // Additional reset when tab changes
  useEffect(() => {
    if (activeTabId) {
      console.log('🔄 Tab changed, resetting editing state')
      resetEditingState()
    }
  }, [activeTabId])

  // Reset when save is completed (direct callback)
  useEffect(() => {
    if (onSaveCompleted && onSaveCompleted > 0) {
      console.log('🔄 Save completed callback received, resetting editing state', onSaveCompleted)
      resetEditingState()
    }
  }, [onSaveCompleted])
  const [editValue, setEditValue] = useState<string>('')
  const [forceFocus, setForceFocus] = useState(0)
  const [invalidUomMessage, setInvalidUomMessage] = useState<string>('')
  const [warehouseAllocatedItems, setWarehouseAllocatedItems] = useState<Set<string>>(new Set())
  const inputRef = useRef<HTMLInputElement>(null)
  const tableScrollRef = useRef<HTMLDivElement>(null)
  const localKeyHandlingRef = useRef(false)
  const navigatingRef = useRef(false)

  // Function to completely reset editing state
  const resetEditingState = () => {
    console.log('🔄 Resetting editing state completely')
    setIsEditing(false)
    setActiveField('quantity')
    setEditValue('')
    setInvalidUomMessage('')
    setForceFocus(0)
    setWarehouseAllocatedItems(new Set()) // Clear warehouse-allocated items
    
    // Force a complete re-render by updating the force focus counter
    setTimeout(() => {
      setForceFocus(prev => prev + 1)
    }, 10)
  }
  
  console.log('🔧 ItemsTable Debug:', {
    activeTabId,
    currentTabStatus: currentTab?.status,
    isReadOnly,
    itemsCount: items.length,
    selectedItemId,
    isEditing,
    items: items.map(item => ({
      item_code: item.item_code,
      item_name: item.item_name,
      standard_rate: item.standard_rate,
      quantity: item.quantity,
      uom: item.uom
    }))
  });
  
  // Warehouse popup state
  const [showWarehousePopup, setShowWarehousePopup] = useState(false)
  const [warehousePopupData, setWarehousePopupData] = useState<{
    itemCode: string
    itemName: string
    requiredQty: number
    currentWarehouseQty: number
    warehouses: any[]
  } | null>(null)

  // Function to scroll selected item into view (aware of sticky footer)
  const scrollToSelectedItem = (itemCode: string, rowIndex?: number) => {
    setTimeout(() => {
      const container = tableScrollRef.current
      if (!container) return
      let rowEl: HTMLElement | null = null
      if (typeof rowIndex === 'number') {
        rowEl = container.querySelector(`tr[data-row-index="${rowIndex}"]`) as HTMLElement | null
      }
      if (!rowEl) {
        rowEl = container.querySelector(`tr[data-item-code="${itemCode}"]`) as HTMLElement | null
      }
      if (!rowEl) return
      const stickyFooterHeight = 64
      const rowRect = rowEl.getBoundingClientRect()
      const contRect = container.getBoundingClientRect()
      if (rowRect.bottom > contRect.bottom - stickyFooterHeight) {
        container.scrollTop += rowRect.bottom - (contRect.bottom - stickyFooterHeight) + 12
      } else if (rowRect.top < contRect.top) {
        container.scrollTop -= contRect.top - rowRect.top + 12
      }
      console.log('📜 Scrolled to selected item:', itemCode, rowIndex)
    }, 20)
  }

  useEffect(() => {
    if (shouldStartEditing && selectedItemId && !isEditing) {
      setActiveField('quantity');
      setIsEditing(true);
      onEditingStarted?.(); // Call the callback to reset the flag
    }
  }, [shouldStartEditing, selectedItemId, isEditing, onEditingStarted]);

  // Ensure the scroll container has keyboard focus when a row is selected without editing
  useEffect(() => {
    if (selectedItemId && !isEditing) {
      tableScrollRef.current?.focus()
    }
  }, [selectedItemId, isEditing])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      // Use a longer delay to ensure the input is fully rendered and reset
      setTimeout(() => {
        if (inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
      }, 100)
    }
  }, [isEditing, activeField, selectedItemId, forceFocus])

  // Set initial edit value when editing starts.
  // Important: do NOT depend on items, or we may overwrite user typing after store updates.
  useEffect(() => {
    if (!isEditing || !selectedItemId) return
      const item = items.find((i) => i.item_code === selectedItemId)
    if (!item) return
    // Only set if editValue is empty or we switched fields
    if (editValue === '' || (activeField && String(item[activeField]) !== editValue)) {
        const value = item[activeField]
        setEditValue(value?.toString() || '')
      }
    // Clear invalid UOM message when starting to edit
    if (activeField === 'uom') {
      setInvalidUomMessage('')
    }
  }, [isEditing, activeField, selectedItemId])

  // Handle focus after revert - more robust approach
  useEffect(() => {
    console.log('🎯 Focus effect triggered:', { forceFocus, isEditing, activeField, selectedItemId })
    
    if (forceFocus > 0) {
      // Try multiple times to ensure focus works
      const attemptFocus = (attempt = 1) => {
        console.log(`🎯 Focus attempt ${attempt}`)
        if (inputRef.current && isEditing && activeField === 'uom') {
          console.log('🎯 Focusing input field')
          inputRef.current.focus()
          inputRef.current.select()
          return true
        } else if (attempt < 5) {
          // Retry after a short delay
          setTimeout(() => attemptFocus(attempt + 1), 100)
        } else {
          console.log('🎯 Failed to focus after 5 attempts')
        }
        return false
      }
      
      setTimeout(() => attemptFocus(), 50)
    }
  }, [forceFocus, isEditing, activeField, selectedItemId])

  // Debug the isEditingUom condition
  useEffect(() => {
    if (selectedItemId) {
      const item = items.find((i) => i.item_code === selectedItemId)
      const isSelected = item?.item_code === selectedItemId
      const isEditingUom = isSelected && isEditing && activeField === 'uom'
      console.log('🔍 UOM editing state:', { 
        selectedItemId, 
        itemCode: item?.item_code, 
        isSelected, 
        isEditing, 
        activeField, 
        isEditingUom 
      })
    }
  }, [selectedItemId, isEditing, activeField, items])

  // Function to refresh item data from API
  const refreshItemData = async (itemCode: string) => {
    try {
      console.log('🔄 Refreshing item data for:', itemCode)
      const resp = await api.get(API_Endpoints.PRODUCT_LIST_METHOD, {
        params: {
          price_list: 'Standard Selling',
          search_text: itemCode,
          limit_start: 0,
          limit_page_length: 10
        }
      })
      
      const allItems = Array.isArray(resp?.data?.data) ? resp.data.data : []
      const freshItem = allItems.find((i: any) => i.item_id === itemCode)
      
      if (freshItem && activeTabId) {
        console.log('✅ Refreshed item data:', freshItem)
        const uomDetails = Array.isArray(freshItem?.uom_details) ? freshItem.uom_details : []
        const uomRates = Object.fromEntries(uomDetails.map((d: any) => [d.uom, d.rate]))
        
        // Update the item with fresh data
        updateItemAndMarkEdited(itemCode, {
          uomRates: uomRates,
          // Keep current UOM and rate, just update the rates map
        })
      }
    } catch (error) {
      console.error('Error refreshing item data:', error)
    }
  }

  // Quantity validation function for warehouse popup
  const validateQuantityAndShowPopup = async (item: any, quantity: number, uom: string) => {
    // Skip popup if this item has already been warehouse-allocated
    if (warehouseAllocatedItems.has(item.item_code)) {
      console.log('⏭️ Skipping warehouse popup for already allocated item:', item.item_code)
      return false
    }

    const requiredQty = typeof quantity === 'number' ? quantity : parseFloat(String(quantity)) || 0
    const uomToCheck = String(uom || 'Nos').toLowerCase()
    
    try {
      // Get current warehouse from POS profile first
      const profileResponse = await (window as any).electronAPI?.proxy?.request({
        method: 'GET',
        url: '/api/method/centro_pos_apis.api.profile.get_pos_profile'
      })
      const currentWarehouse = profileResponse?.data?.data?.warehouse || 'Stores - NAB'
      
      // Fetch warehouse stock for this item
      const res = await (window as any).electronAPI?.proxy?.request({
        url: '/api/method/centro_pos_apis.api.product.item_stock_warehouse_list',
        params: {
          item_id: item.item_code,
          search_text: '',
          limit_start: 0,
          limit_page_length: 20
        }
      })
      const list = Array.isArray(res?.data?.data) ? res.data.data : []
      
      // Find current warehouse stock for the selected UOM
      const currentWarehouseData = list.find((w: any) => w.warehouse === currentWarehouse)
      const currentWarehouseQty = currentWarehouseData ? (() => {
        const q = Array.isArray(currentWarehouseData.quantities) ? currentWarehouseData.quantities : []
        const match = q.find((qq: any) => String(qq.uom).toLowerCase() === uomToCheck)
        return Number(match?.qty || 0)
      })() : 0

      // Check if required quantity exceeds current warehouse stock
      if (requiredQty > currentWarehouseQty) {
        // Prepare all warehouses for popup
        const warehouses = list.map((w: any) => {
          const q = Array.isArray(w.quantities) ? w.quantities : []
          const match = q.find((qq: any) => String(qq.uom).toLowerCase() === uomToCheck)
          return { 
            name: w.warehouse, 
            available: Number(match?.qty || 0),
            selected: w.warehouse === currentWarehouse // Pre-select current warehouse
          }
        })

        setWarehousePopupData({
          itemCode: item.item_code,
          itemName: item.item_name || item.label || 'Unknown Product',
          requiredQty,
          currentWarehouseQty: currentWarehouseQty,
          warehouses
        })
        setShowWarehousePopup(true)
        return true // Indicates popup was shown
      }
    } catch (err) {
      console.error('Error checking warehouse quantities:', err)
    }
    return false // No popup needed
  }

  const handleSaveEdit = async () => {
    if (!isEditing || !selectedItemId || !activeTabId) return

    const item = items.find((i) => i.item_code === selectedItemId)
    if (!item) return

    let finalValue: string | number = editValue

    if (activeField === 'item_name') {
      // Handle item_name field - no validation needed, just use the string value
      finalValue = editValue
    } else if (activeField !== 'uom') {
      const numValue = parseFloat(editValue)
      if (isNaN(numValue) || numValue < 0) {
        setIsEditing(false)
        return
      }
      finalValue = numValue
    } else {
      // Handle UOM validation
      try {
        console.log('🔍 Validating UOM for item:', item.item_code, 'UOM:', editValue)
        
        // Fetch fresh UOM details from API for this specific item
        const resp = await api.get(API_Endpoints.PRODUCT_LIST_METHOD, {
          params: {
            price_list: 'Standard Selling',
            search_text: item.item_code,
            limit_start: 0,
            limit_page_length: 10
          }
        })
        
        console.log('📡 API Response for UOM validation:', resp?.data)
        
        // Find the exact item in the response
        const allItems = Array.isArray(resp?.data?.data) ? resp.data.data : []
        const exactItem = allItems.find((i: any) => i.item_id === item.item_code)
        
        if (!exactItem) {
          console.error('❌ Item not found in API response:', item.item_code)
          toast.error(`Item ${item.item_code} not found in API. Please refresh and try again.`, {
            duration: 5000,
          })
          setIsEditing(false)
          return
        }
        
        console.log('✅ Found exact item:', exactItem.item_id, 'UOM details:', exactItem.uom_details)
        
        const uomDetails = Array.isArray(exactItem?.uom_details) ? exactItem.uom_details : []
        
        // Create a map of UOM -> rate for easy lookup
        const uomMap = Object.fromEntries(
          uomDetails.map((d: any) => [String(d.uom).toLowerCase(), {
            uom: d.uom,
            rate: Number(d.rate || 0),
            qty: Number(d.qty || 0)
          }])
        )
        
        console.log('🗺️ UOM Map created:', uomMap)
        
        const previousUom = String(item.uom || 'Nos')
        const editValueLower = String(editValue).toLowerCase()
        const uomInfo = uomMap[editValueLower]

        console.log('🔍 Looking for UOM:', editValueLower, 'Found:', uomInfo)

        // Check if UOM exists in API response
        if (!uomInfo) {
          // UOM not found in API - just revert without popup
          const prevUomInfo = uomMap[String(previousUom).toLowerCase()]
          const fallbackRate = prevUomInfo?.rate || Number(item.standard_rate || 0)
          
          console.log('❌ UOM not found, reverting to:', previousUom, 'with rate:', fallbackRate)
          
          // Update the item with previous UOM
          updateItemAndMarkEdited(item.item_code, {
            uom: previousUom,
            standard_rate: Number(fallbackRate || 0),
            uomRates: Object.fromEntries(uomDetails.map((d: any) => [d.uom, d.rate]))
          })
          
          // Set the edit value to the previous UOM
          setEditValue(previousUom)
          
          // Set visual message instead of popup
          setInvalidUomMessage(`No ${String(editValue)} available. Reverted to ${previousUom}.`)
          
          // Clear the message after 3 seconds
          setTimeout(() => {
            setInvalidUomMessage('')
          }, 3000)
          
          // Just return without breaking the editing state
          return
        }

        // UOM exists in API - use the rate (regardless of qty)
        console.log('✅ UOM found, updating with rate:', uomInfo.rate)
        
        updateItemAndMarkEdited(item.item_code, {
          uom: uomInfo.uom, // Use the exact UOM from API (preserves case)
          standard_rate: Number(uomInfo.rate || 0),
          uomRates: Object.fromEntries(uomDetails.map((d: any) => [d.uom, d.rate]))
        })
        
        // Refresh item data to ensure UI is updated
        setTimeout(() => {
          refreshItemData(item.item_code)
        }, 100)
        finalValue = uomInfo.uom
      } catch (error) {
        console.error('Error fetching UOM details:', error)
        // If API fails, just use the typed value
        finalValue = editValue
      }
    }

    // Check for quantity shortage against current warehouse stock
    const shouldCheckQuantity = activeField === 'quantity' || activeField === 'uom' || activeField === 'standard_rate'
    
    if (shouldCheckQuantity) {
      // Get the current quantity (either from edit or existing item)
      const currentQuantity = activeField === 'quantity' ? finalValue : item.quantity
      const requiredQty = typeof currentQuantity === 'number' ? currentQuantity : parseFloat(String(currentQuantity)) || 0
      
      // Get the current UOM (either from edit or existing item)
      const currentUom = activeField === 'uom' ? finalValue : item.uom
      const uomToCheck = String(currentUom || 'Nos').toLowerCase()
      
      try {
        // Get current warehouse from POS profile first
        const profileResponse = await (window as any).electronAPI?.proxy?.request({
          method: 'GET',
          url: '/api/method/centro_pos_apis.api.profile.get_pos_profile'
        })
        const currentWarehouse = profileResponse?.data?.data?.warehouse || 'Stores - NAB'
        
        // Fetch warehouse stock for this item
        const res = await (window as any).electronAPI?.proxy?.request({
          url: '/api/method/centro_pos_apis.api.product.item_stock_warehouse_list',
          params: {
            item_id: item.item_code,
            search_text: '',
            limit_start: 0,
            limit_page_length: 20
          }
        })
        const list = Array.isArray(res?.data?.data) ? res.data.data : []
        
        // Find current warehouse stock for the selected UOM
        const currentWarehouseData = list.find((w: any) => w.warehouse === currentWarehouse)
        const currentWarehouseQty = currentWarehouseData ? (() => {
          const q = Array.isArray(currentWarehouseData.quantities) ? currentWarehouseData.quantities : []
          const match = q.find((qq: any) => String(qq.uom).toLowerCase() === uomToCheck)
          return Number(match?.qty || 0)
        })() : 0

        // Check if required quantity exceeds current warehouse stock
        if (requiredQty > currentWarehouseQty) {
          // Prepare all warehouses for popup
        const warehouses = list.map((w: any) => {
          const q = Array.isArray(w.quantities) ? w.quantities : []
            const match = q.find((qq: any) => String(qq.uom).toLowerCase() === uomToCheck)
            return { 
              name: w.warehouse, 
              available: Number(match?.qty || 0),
              selected: w.warehouse === currentWarehouse // Pre-select current warehouse
            }
          })

          setWarehousePopupData({
            itemCode: item.item_code,
            itemName: item.item_name || item.label || 'Unknown Product',
            requiredQty,
            currentWarehouseQty: currentWarehouseQty,
            warehouses
          })
          setShowWarehousePopup(true)
          return // Don't save yet, wait for warehouse allocation
        }
      } catch (err) {
        console.error('Error checking warehouse quantities:', err)
      }
    }


    updateItemAndMarkEdited(selectedItemId, { [activeField]: finalValue })

    // Don't auto-navigate - let user use arrow keys for navigation
    // Just save the value and stay in current field
      setIsEditing(false)
  }

  // Emergency reset hotkey
  useHotkeys('ctrl+r', () => {
    console.log('🔄 Emergency reset triggered')
    resetEditingState()
  }, { preventDefault: true, enableOnFormTags: true })

  useHotkeys(
    'space',
    async () => {
      console.log('⌨️ Space key pressed. Active field:', activeField, 'Selected item:', selectedItemId)
      // New behavior: Space toggles/cycles UOM for the selected item from any field
      if (isProductModalOpen) return // Disable when product modal is open
      if (isCustomerModalOpen) return // Disable when customer modal is open
      if (!selectedItemId || isReadOnly) return
      
      // Check if we're in a text input field - if so, don't prevent default spacebar behavior
      const activeElement = document.activeElement
      if (activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA' || 
        (activeElement as HTMLElement).contentEditable === 'true'
      )) {
        return // Allow normal spacebar behavior in text fields
      }

      try {
        const item = items.find((i) => i.item_code === selectedItemId)
        if (!item) return

        // Fetch UOM list for the exact item
        const resp = await api.get(API_Endpoints.PRODUCT_LIST_METHOD, {
          params: {
            price_list: 'Standard Selling',
            search_text: item.item_code,
            limit_start: 0,
            limit_page_length: 10
          }
        })
        const allItems = Array.isArray(resp?.data?.data) ? resp.data.data : []
        const exactItem = allItems.find((i: any) => i.item_id === item.item_code)
        const details: Array<{ uom: string; rate: number; qty?: number }> = Array.isArray(exactItem?.uom_details)
          ? exactItem.uom_details
          : []
        if (details.length === 0) return

        // Build ordered UOM list
        const orderedUoms = details.map((d) => ({ uom: String(d.uom), rate: Number(d.rate || 0) }))
        const currentUomLower = String(item.uom || 'Nos').toLowerCase()
        const currentIndex = Math.max(
          0,
          orderedUoms.findIndex((d) => d.uom.toLowerCase() === currentUomLower)
        )
        const nextIndex = (currentIndex + 1) % orderedUoms.length
        const next = orderedUoms[nextIndex]

        console.log('🔁 Cycling UOM:', {
          current: item.uom,
          next: next.uom,
          nextRate: next.rate,
          list: orderedUoms
        })

        updateItemAndMarkEdited(item.item_code, {
          uom: next.uom,
          standard_rate: Number(next.rate || 0),
          uomRates: Object.fromEntries(orderedUoms.map((d) => [d.uom, d.rate]))
        })

        // Reflect the change in the inline editor state if it's open
        if (isEditing && activeField === 'uom') {
          setEditValue(next.uom)
        }
      } catch (err) {
        console.error('Space-to-cycle UOM failed:', err)
      }
    },
    { preventDefault: false, enableOnFormTags: false }
  )

  // Emergency reset shortcut (Ctrl+R)
  useHotkeys(
    'ctrl+r',
    () => {
      console.log('🆘 Emergency reset triggered')
      resetEditingState()
    },
    { preventDefault: true, enableOnFormTags: true }
  )

  useHotkeys(
    'Escape',
    () => {
      setIsEditing(false)
    },
    { preventDefault: true }
  )

  // Shift key to show product list popup immediately
  useHotkeys(
    'shift',
    async () => {
      console.log('⌨️ Shift key pressed - showing product list popup')
      if (onAddItemClick && !isProductModalOpen && !isCustomerModalOpen) {
        // If currently editing, save the current value first
        if (isEditing && selectedItemId && activeTabId) {
          console.log('💾 Saving current edit before opening product modal')
          await handleSaveEdit()
        }
        onAddItemClick()
      }
    },
    { preventDefault: true, enableOnFormTags: true }
  )

  // Arrow key navigation - only between qty and unit price
  useHotkeys(
    'ArrowLeft',
    () => {
      if (isProductModalOpen) return // Disable when product modal is open
      if (isEditing && selectedItemId && activeField === 'standard_rate') {
        // Save current value and navigate from unit price back to quantity
        const item = items.find((i) => i.item_code === selectedItemId)
        if (item && activeTabId) {
          // Save current unit price value
          const numValue = parseFloat(editValue)
          if (!isNaN(numValue) && numValue >= 0) {
            updateItemAndMarkEdited(selectedItemId, { standard_rate: numValue })
          }
          // Navigate to quantity and keep editing
        setActiveField('quantity')
          setEditValue(String(item.quantity ?? ''))
        setIsEditing(true)
        }
      } else if (isEditing && selectedItemId && activeField === 'quantity') {
        // If already at quantity, stay at quantity but keep editing
        const item = items.find((i) => i.item_code === selectedItemId)
        if (item) {
          setActiveField('quantity')
          setEditValue(String(item.quantity ?? ''))
          setIsEditing(true)
        }
      }
    },
    { preventDefault: true, enableOnFormTags: true }
  )

  useHotkeys(
    'ArrowRight',
    async () => {
      if (isProductModalOpen) return // Disable when product modal is open
      if (isEditing && selectedItemId && activeField === 'quantity') {
        // Save current value and navigate from quantity to unit price
        const item = items.find((i) => i.item_code === selectedItemId)
        if (item && activeTabId) {
          // Save current quantity value
          const numValue = parseFloat(editValue)
          if (!isNaN(numValue) && numValue >= 0) {
            updateItemAndMarkEdited(selectedItemId, { quantity: numValue })
            
            // Check for quantity validation and show warehouse popup if needed
            const popupShown = await validateQuantityAndShowPopup(item, numValue, item.uom || 'Nos')
            if (popupShown) {
              // Don't navigate if popup is shown - wait for user to handle allocation
              return
            }
          }
          // Navigate to unit price and keep editing
          setActiveField('standard_rate')
          setEditValue(String(item.standard_rate ?? ''))
          setIsEditing(true)
        }
      } else if (isEditing && selectedItemId && activeField === 'standard_rate') {
        // If already at unit price, stay at unit price but keep editing
        const item = items.find((i) => i.item_code === selectedItemId)
        if (item) {
          setActiveField('standard_rate')
          setEditValue(String(item.standard_rate ?? ''))
          setIsEditing(true)
        }
      }
    },
    { preventDefault: true, enableOnFormTags: true }
  )

  useHotkeys(
    'ArrowUp',
    () => {
      if (isProductModalOpen) return // Disable when product modal is open
      if (isErrorBoxFocused) return // Disable when error box is focused
      // Avoid double-handling when container already processed the key
      if (document.activeElement === tableScrollRef.current || localKeyHandlingRef.current) return
      if (selectedItemId && !isReadOnly) {
        const currentIndex = selectedRowIndex
        if (currentIndex > 0) {
          const prevItem = filteredItems[currentIndex - 1]
          console.log('⬆️ Arrow Up: Moving from', selectedItemId, 'to', prevItem.item_code)
          selectItem(prevItem.item_code)
          setSelectedRowIndex(currentIndex - 1)
          scrollToSelectedItem(prevItem.item_code, currentIndex - 1)
          if (isEditing) {
            // Keep editing mode but switch to the previous item
            setTimeout(() => {
              const item = items.find((i) => i.item_code === prevItem.item_code)
              if (item) {
                setEditValue(String(item[activeField] ?? ''))
              }
            }, 10)
          }
        }
      } else if (filteredItems.length > 0 && !isReadOnly) {
        // No item selected, select the last item
        console.log('⬆️ Arrow Up: No item selected, selecting last item')
        selectItem(filteredItems[filteredItems.length - 1].item_code)
        setSelectedRowIndex(filteredItems.length - 1)
        scrollToSelectedItem(filteredItems[filteredItems.length - 1].item_code, filteredItems.length - 1)
      }
    },
    { preventDefault: true, enableOnFormTags: true }
  )

  useHotkeys(
    'ArrowDown',
    () => {
      if (isProductModalOpen) return // Disable when product modal is open
      if (isErrorBoxFocused) return // Disable when error box is focused
      if (document.activeElement === tableScrollRef.current || localKeyHandlingRef.current) return
      if (selectedItemId && !isReadOnly) {
        const currentIndex = selectedRowIndex
        if (currentIndex < filteredItems.length - 1) {
          const nextItem = filteredItems[currentIndex + 1]
          console.log('⬇️ Arrow Down: Moving from', selectedItemId, 'to', nextItem.item_code)
          selectItem(nextItem.item_code)
          setSelectedRowIndex(currentIndex + 1)
          scrollToSelectedItem(nextItem.item_code, currentIndex + 1)
          if (isEditing) {
            // Keep editing mode but switch to the next item
            setTimeout(() => {
              const item = items.find((i) => i.item_code === nextItem.item_code)
              if (item) {
                setEditValue(String(item[activeField] ?? ''))
              }
            }, 10)
          }
        }
      } else if (filteredItems.length > 0 && !isReadOnly) {
        // No item selected, select the first item
        console.log('⬇️ Arrow Down: No item selected, selecting first item')
        selectItem(filteredItems[0].item_code)
        setSelectedRowIndex(0)
        scrollToSelectedItem(filteredItems[0].item_code, 0)
      }
    },
    { preventDefault: true, enableOnFormTags: true }
  )

  // Enter key handler for navigation
  useHotkeys(
    'enter',
    () => {
      if (isProductModalOpen) return // Disable when product modal is open
      if (selectedItemId && !isReadOnly && !isEditing) {
        const currentIndex = items.findIndex((i) => i.item_code === selectedItemId)
        if (currentIndex < items.length - 1) {
          const nextItem = items[currentIndex + 1]
          console.log('⏎ Enter: Moving from', selectedItemId, 'to', nextItem.item_code)
          selectItem(nextItem.item_code)
          scrollToSelectedItem(nextItem.item_code)
        } else {
          // If at last item, go to first item
          console.log('⏎ Enter: At last item, moving to first item')
          selectItem(items[0].item_code)
          scrollToSelectedItem(items[0].item_code)
        }
      } else if (items.length > 0 && !isReadOnly && !selectedItemId) {
        // No item selected, select the first item
        console.log('⏎ Enter: No item selected, selecting first item')
        selectItem(items[0].item_code)
        scrollToSelectedItem(items[0].item_code)
      }
    },
    { preventDefault: true, enableOnFormTags: false }
  )

  // Handle warehouse allocation
  const handleWarehouseAllocation = (allocations: any[]) => {
    if (!warehousePopupData || !activeTabId) return

    // Calculate total allocated quantity from all warehouses
    const totalAllocated = allocations.reduce((sum, allocation) => {
      return sum + (Number(allocation.allocated) || 0)
    }, 0)

    // Update the item with the total allocated quantity
    updateItemAndMarkEdited(warehousePopupData.itemCode, { 
      quantity: totalAllocated,
      warehouseAllocations: allocations 
    })

    // Mark this item as warehouse-allocated to prevent future popups
    setWarehouseAllocatedItems(prev => new Set([...prev, warehousePopupData.itemCode]))

    // Close the popup
    setShowWarehousePopup(false)

    // Move focus to unit price field
      setTimeout(() => {
      const item = items.find(i => i.item_code === warehousePopupData.itemCode)
      if (item) {
        selectItem(warehousePopupData.itemCode)
        setActiveField('standard_rate')
        setIsEditing(true)
        setEditValue(String(item.standard_rate || 0))
        console.log('🎯 Moved to unit price after warehouse allocation')
      }
    }, 100)
  }

  const { profile } = usePOSProfileStore();
  const allowDuplicateItems = Boolean(profile?.custom_allow_duplicate_items_in_cart === 1);

  return (
    <div className="px-4 pt-4 pb-0 bg-white h-full flex flex-col min-h-0">
      <Tabs defaultValue="items" className="w-full h-full flex flex-col min-h-0">
        <div className="flex items-center justify-between">
        <TabsList>
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="other">Other Details</TabsTrigger>
        </TabsList>
          <div className="relative w-1/4 min-w-[220px]">
            <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search items..."
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>
        <TabsContent value="items" className="mt-4 flex-1 flex flex-col min-h-0">
          <div className="border rounded-lg flex flex-col min-h-0">
            {/* Sticky table head, scrollable body only */}
            <div className="bg-white sticky top-0 z-10">
              <Table className="table-fixed w-full">
              <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px] text-center">S.No</TableHead>
                    <TableHead className="w-[110px]">
                      <div className="flex items-center gap-2">
                        <span>Product</span>
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 text-[10px] font-semibold">
                          {totalProducts}
                        </span>
                      </div>
                    </TableHead>
                    <TableHead className="w-[300px]">Label</TableHead>
                    <TableHead className="w-[70px] text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span>Qty</span>
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 text-[10px] font-semibold">
                          {totalQuantity}
                        </span>
                      </div>
                    </TableHead>
                  <TableHead className="w-[80px] text-center px-1">UOM</TableHead>
                  <TableHead className="w-[80px] text-center">Discount</TableHead>
                  <TableHead className="w-[100px] text-center">Unit Price</TableHead>
                    <TableHead className="w-[100px] text-left pl-8">Total</TableHead>
                  <TableHead className="w-[60px] text-center pl-1">Actions</TableHead>
                  </TableRow>
                </TableHeader>
            </Table>
            </div>
            {/* Only the body scrolls. Dynamically reduce height when error box is visible */}
            <div
              className={`flex-1 min-h-0 overflow-y-auto transition-[max-height] duration-200`}
              style={{ maxHeight: hasBottomErrors ? '240px' : '336px' }}
              ref={tableScrollRef}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                  e.preventDefault()
                  localKeyHandlingRef.current = true
                  const currentIndex = selectedRowIndex
                  const nextIndex = e.key === 'ArrowDown'
                    ? Math.min(currentIndex + 1, filteredItems.length - 1)
                    : Math.max(currentIndex - 1, 0)
                  const nextItem = filteredItems[nextIndex]
                  if (nextItem) {
                    selectItem(nextItem.item_code)
                    setSelectedRowIndex(nextIndex)
                    scrollToSelectedItem(nextItem.item_code, nextIndex)
                  }
                  setTimeout(() => {
                    localKeyHandlingRef.current = false
                  }, 30)
                }
              }}
              onClick={(e) => {
                // Only trigger if clicking on empty space (not on table cells)
                if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'DIV') {
                  console.log('🖱️ Items table area clicked - opening product modal')
                  onAddItemClick?.()
                }
                // ensure container can receive arrow keys
                ;(e.currentTarget as HTMLElement).focus()
              }}
            >
              <Table className="table-fixed w-full">
                <TableBody>
                  {filteredItems.map((item, index) => {
                    const isSelected = item.item_code === selectedItemId && index === selectedRowIndex
                  const isEditingQuantity = isSelected && isEditing && activeField === 'quantity'
                  const isEditingRate = isSelected && isEditing && activeField === 'standard_rate'
                  const isEditingUom = isSelected && isEditing && activeField === 'uom'
                  const isEditingDiscount =
                    isSelected && isEditing && activeField === 'discount_percentage'
                  const isEditingItemName = isSelected && isEditing && activeField === 'item_name'
                  const hasError = hasItemError(item.item_code)

                  return (
                    <TableRow
                      key={item.item_code}
                      data-item-code={item.item_code}
                      data-row-index={index}
                      onClick={(e) => {
                        e.stopPropagation()
                        console.log('🖱️ Row clicked:', item.item_code, 'isEditing:', isEditing, 'isReadOnly:', isReadOnly)
                        if (!isEditing && !isReadOnly) {
                          selectItem(item.item_code)
                          setSelectedRowIndex(index)
                          // Focus container so Arrow keys work when not editing
                          tableScrollRef.current?.focus()
                          scrollToSelectedItem(item.item_code, index)
                        }
                      }}
                      className={`transition-all ${
                        isSelected
                          ? 'bg-gradient-to-r from-blue-50 to-blue-100 border-l-4 border-l-blue-500 shadow-md'
                          : 'hover:bg-gray-50'
                        }`}
                    >
                        <TableCell className="w-[50px] text-center">{index + 1}</TableCell>
                      <TableCell className={`w-[110px]`}>
                        <div className="flex flex-col">
                          <span className={`${hasError ? 'text-red-600 font-semibold' : isSelected ? 'font-semibold text-blue-900' : 'text-gray-800'} text-[11px] leading-4 truncate`}>{item.item_code}</span>
                          <span className={`text-[11px] leading-4 ${isSelected ? 'text-blue-700' : 'text-gray-500'} truncate`}>{item.item_name}</span>
                        </div>
                      </TableCell>
                      {/* Label Cell */}
                      <TableCell
                        className={`${hasError ? 'text-red-600 font-medium' : isSelected ? 'font-medium' : ''} w-[300px]`}
                        data-item-code={item.item_code}
                        data-field="item_name"
                        onClick={(e) => {
                          e.stopPropagation()
                          console.log('🖱️ Label cell clicked:', item.item_code, 'isReadOnly:', isReadOnly)
                          if (!isReadOnly) {
                            // Always reset editing state first, regardless of current state
                            resetEditingState()
                            // Use a small delay to ensure reset is complete
                            setTimeout(() => {
                            selectItem(item.item_code)
                              setSelectedRowIndex(index)
                            setActiveField('item_name')
                            setIsEditing(true)
                              setEditValue(String(item.item_name ?? item.item_description ?? ''))
                            console.log('✅ Started editing label for:', item.item_code)
                            }, 50)
                          }
                        }}
                      >
                        {isEditingItemName ? (
                          <input
                            key={`label-${item.item_code}-${isEditingItemName}-${forceFocus}`}
                            ref={inputRef}
                            type="text"
                            value={editValue}
                            onChange={(e) => {
                              const newValue = e.target.value
                              setEditValue(newValue)
                              // Real-time update for item name
                              if (selectedItemId && activeTabId) {
                                updateItemAndMarkEdited(selectedItemId, { item_name: newValue })
                              }
                            }}
                            onKeyDown={(e) => {
                              handleArrowNavigation(e, 'item_name', item.item_code)
                              handleVerticalNavigation(e, 'item_name', item.item_code)
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                e.stopPropagation()
                                // Save label value and end editing
                                if (activeTabId && selectedItemId) {
                                  updateItemAndMarkEdited(selectedItemId, { item_name: editValue })
                                }
                                setIsEditing(false)
                              } else if (e.key === 'Escape') {
                                e.preventDefault()
                                e.stopPropagation()
                                setIsEditing(false)
                              }
                            }}
                            onBlur={(e) => {
                              if (navigatingRef.current) return
                              handleSaveEdit()
                            }}
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder={String(item.item_description ?? '')}
                          />
                        ) : (
                          <span
                            className="block truncate"
                            title={(item.item_name || item.item_description || '')}
                          >
                            {item.item_name || item.item_description || ''}
                          </span>
                        )}
                      </TableCell>

                      {/* Quantity Cell */}
                      <TableCell
                        className={`${hasError ? 'text-red-600 font-medium' : isSelected ? 'font-medium' : ''} w-[70px] text-center`}
                        data-item-code={item.item_code}
                        data-field="quantity"
                        onClick={(e) => {
                          e.stopPropagation()
                          console.log('🖱️ Quantity cell clicked:', item.item_code, 'isReadOnly:', isReadOnly)
                          if (!isReadOnly) {
                            // Always reset editing state first, regardless of current state
                            resetEditingState()
                            
                            // Use a small delay to ensure reset is complete
                            setTimeout(() => {
                            selectItem(item.item_code)
                              setSelectedRowIndex(index)
                            setActiveField('quantity')
                            setIsEditing(true)
                            setEditValue(String(item.quantity ?? ''))
                            console.log('✅ Started editing quantity for:', item.item_code)
                            }, 50)
                          }
                        }}
                      >
                        {isEditingQuantity ? (
                          <input
                            key={`qty-${item.item_code}-${isEditingQuantity}-${forceFocus}`}
                            ref={inputRef}
                            type="number"
                            data-item-code={item.item_code}
                            data-field="quantity"
                            value={editValue}
                            onChange={(e) => {
                              const newValue = e.target.value
                              setEditValue(newValue)
                              // Real-time update for quantity
                              if (selectedItemId && activeTabId) {
                                const numValue = parseFloat(newValue)
                                if (!isNaN(numValue) && numValue >= 0) {
                                  updateItemAndMarkEdited(selectedItemId, { quantity: numValue })
                                  
                                  // Clear warehouse-allocated status when quantity changes
                                  if (warehouseAllocatedItems.has(selectedItemId)) {
                                    console.log('🔄 Quantity changed for warehouse-allocated item, clearing allocation status:', selectedItemId)
                                    setWarehouseAllocatedItems(prev => {
                                      const newSet = new Set(prev)
                                      newSet.delete(selectedItemId)
                                      return newSet
                                    })
                                    
                                    // Clear warehouse allocation data from the item
                                    updateItemInTab(activeTabId, selectedItemId, { 
                                      warehouseAllocations: [] // Clear previous warehouse allocations
                                    })
                                    console.log('🧹 Cleared warehouse allocation data for item:', selectedItemId)
                                  }
                                }
                              }
                            }}
                            onKeyDown={async (e) => {
                                handleArrowNavigation(e, 'quantity', item.item_code)
                                handleVerticalNavigation(e, 'quantity', item.item_code)
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                e.stopPropagation()
                                // Save qty value directly without ending editing
                                const numValue = parseFloat(editValue)
                                if (!isNaN(numValue) && numValue >= 0 && activeTabId && selectedItemId) {
                                  updateItemAndMarkEdited(selectedItemId, { quantity: numValue })
                                  
                                  // Check for quantity validation and show warehouse popup if needed
                                  const popupShown = await validateQuantityAndShowPopup(item, numValue, item.uom || 'Nos')
                                  if (popupShown) {
                                    // Don't navigate if popup is shown - wait for user to handle allocation
                                    return
                                  }
                                }
                                // Navigate to unit price and keep editing
                                  moveToField(item.item_code, 'standard_rate')
                              } else if (e.key === 'Escape') {
                                e.preventDefault()
                                e.stopPropagation()
                                setIsEditing(false)
                              }
                            }}
                            onBlur={() => {
                              if (navigatingRef.current) return
                              handleSaveEdit()
                            }}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            className="w-[50px] mx-auto px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
                            min="0"
                            step="0.01"
                          />
                        ) : (
                          <div className="px-2 py-1">{item.quantity}</div>
                        )}
                      </TableCell>

                      {/* UOM Cell - Not clickable, only editable via spacebar */}
                      <TableCell
                        className={`${hasError ? 'text-red-600 font-medium' : isSelected ? 'font-medium' : ''} w-[80px] text-center`}
                      >
                        {isEditingUom ? (
                          <input
                            key={`uom-${item.item_code}-${isEditingUom}-${forceFocus}`}
                            ref={inputRef}
                            type="text"
                            value={editValue}
                              onChange={() => { /* disabled manual edit */ }}
                            onKeyDown={(e) => {
                                // Allow horizontal navigation to other fields
                                handleArrowNavigation(e, 'uom', item.item_code)
                                handleVerticalNavigation(e, 'uom', item.item_code)
                                if (e.key === ' ') {
                                  e.preventDefault()
                                  // Cycle to next UOM
                                  const rates = item.uomRates || {}
                                  const uoms = Object.keys(rates)
                                  const currentUom = String(item.uom || 'Nos')
                                  const currentIndex = Math.max(0, uoms.indexOf(currentUom))
                                  const nextIndex = (currentIndex + 1) % (uoms.length || 1)
                                  const nextUom = uoms.length ? uoms[nextIndex] : currentUom
                                  setEditValue(nextUom)
                                  if (activeTabId && selectedItemId) {
                                    updateItemAndMarkEdited(selectedItemId, {
                                      uom: nextUom,
                                      standard_rate: rates[nextUom] ?? item.standard_rate
                                    })
                                  }
                                } else if (e.key === 'Escape') {
                                e.preventDefault()
                                setIsEditing(false)
                              }
                            }}
                             onBlur={() => {
                               if (navigatingRef.current) return
                               handleSaveEdit()
                             }}
                            className="w-[70px] mx-auto px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-center truncate"
                              readOnly
                          />
                        ) : (
                          <div className="px-2 py-1">{item.uom || 'Nos'}</div>
                        )}
                      </TableCell>

                      {/* Discount Cell */}
                      <TableCell
                        className={`${hasError ? 'text-red-600 font-medium' : isSelected ? 'font-medium' : ''} w-[80px] text-center`}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (!isReadOnly) {
                            // Always reset editing state first, regardless of current state
                            resetEditingState()
                            
                            // Use a small delay to ensure reset is complete
                            setTimeout(() => {
                            selectItem(item.item_code)
                              setSelectedRowIndex(index)
                            setActiveField('discount_percentage')
                            setIsEditing(true)
                            setEditValue(String(item.discount_percentage ?? '0'))
                            }, 50)
                          }
                        }}
                      >
                        {isEditingDiscount ? (
                          <input
                            key={`discount-${item.item_code}-${isEditingDiscount}-${forceFocus}`}
                            ref={inputRef}
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                                handleArrowNavigation(e, 'discount_percentage', item.item_code)
                                handleVerticalNavigation(e, 'discount_percentage', item.item_code)
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                e.stopPropagation()
                                handleSaveEdit()
                              } else if (e.key === 'Escape') {
                                e.preventDefault()
                                e.stopPropagation()
                                setIsEditing(false)
                              }
                            }}
                             onBlur={() => {
                               if (navigatingRef.current) return
                               handleSaveEdit()
                             }}
                            className="w-[60px] mx-auto px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
                            min="0"
                            max="100"
                            step="0.01"
                          />
                        ) : (
                          <div className="px-2 py-1">{item.discount_percentage ?? 0}</div>
                        )}
                      </TableCell>

                      {/* Unit Price (editable) */}
                      <TableCell
                        className={`${hasError ? 'text-red-600 font-medium' : isSelected ? 'font-medium' : ''} w-[100px] text-center`}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (!isReadOnly) {
                            // Always reset editing state first, regardless of current state
                            resetEditingState()
                            
                            // Use a small delay to ensure reset is complete
                            setTimeout(() => {
                            selectItem(item.item_code)
                              setSelectedRowIndex(index)
                            setActiveField('standard_rate')
                            setIsEditing(true)
                            setEditValue(String(item.standard_rate ?? ''))
                            }, 50)
                          }
                        }}
                      >
                        {isEditingRate ? (
                          <input
                            key={`rate-${item.item_code}-${isEditingRate}-${forceFocus}`}
                            ref={inputRef}
                            type="number"
                            value={editValue}
                            onChange={(e) => {
                              const newValue = e.target.value
                              setEditValue(newValue)
                              // Real-time update for unit price
                              if (selectedItemId && activeTabId) {
                                const numValue = parseFloat(newValue)
                                if (!isNaN(numValue) && numValue >= 0) {
                                  updateItemAndMarkEdited(selectedItemId, { standard_rate: numValue })
                                }
                              }
                            }}
                            onKeyDown={(e) => {
                                handleArrowNavigation(e, 'standard_rate', item.item_code)
                                handleVerticalNavigation(e, 'standard_rate', item.item_code)
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                handleSaveEdit()
                                // End editing - no further navigation
                                setIsEditing(false)
                                  
                                  // If this is the last item, open product modal
                                  const currentIndex = filteredItems.findIndex(i => i.item_code === item.item_code)
                                  if (currentIndex === filteredItems.length - 1) {
                                    console.log('⌨️ Enter pressed on last item unit price - opening product modal')
                                    onAddItemClick?.()
                                  }
                              } else if (e.key === 'Escape') {
                                e.preventDefault()
                                setIsEditing(false)
                              }
                            }}
                            onBlur={handleSaveEdit}
                            min="0"
                            step="0.01"
                            className="w-[80px] mx-auto px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
                          />
                        ) : (
                          <>{Number(item.standard_rate || 0).toFixed(2)}</>
                        )}
                      </TableCell>
                      <TableCell className={`font-semibold ${hasError ? 'text-red-600' : isSelected ? 'text-blue-900' : ''} w-[100px] text-left pl-8`}>
                        {(
                          Number(item.standard_rate || 0) *
                          Number(item.quantity || 0) *
                          (1 - Number(item.discount_percentage || 0) / 100)
                        ).toFixed(2)}
                      </TableCell>
                      <TableCell className="w-[60px] text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                            data-action="delete"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1"
                          onClick={(e) => {
                            e.stopPropagation()
                              if (isReadOnly) return
                              setDeleteCandidate(item.item_code)
                              setShowDeleteConfirm(true)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                if (!isReadOnly) {
                                  setDeleteCandidate(item.item_code)
                                  setShowDeleteConfirm(true)
                                }
                              } else if (e.key === 'ArrowLeft') {
                                e.preventDefault()
                                moveToField(item.item_code, 'standard_rate')
                              } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                                handleVerticalNavigation(e as any, 'standard_rate', item.item_code)
                              }
                          }}
                          disabled={isReadOnly}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
                </TableBody>
              </Table>
            </div>
            
            {/* Add Item button sticky at bottom of table card (compact) */}
            <div className="bg-gray-50 border-t py-1.5 px-3 sticky bottom-0 z-10">
              <Button
                variant="ghost"
                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 text-sm h-7 py-1"
                onClick={() => {
                  console.log('🖱️ Add item button clicked - opening product modal')
                  onAddItemClick?.()
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Click or press &apos;Shift&apos; to add item • Space to switch UOM • ← → to navigate fields • ↑ ↓ to navigate rows
              </Button>
            </div>
            {/* Invalid UOM Message (not sticky, stays above add button) */}
            {invalidUomMessage && (
              <div className="px-3 py-2 bg-red-50 border-t border-red-200 mb-2">
                <div className="text-red-700 text-sm text-center">
                  ⚠️ {invalidUomMessage}
                </div>
              </div>
            )}
          </div>
        </TabsContent>
        <TabsContent value="other" className="mt-4">
          <div className="border rounded-lg">
            {/* Fixed header */}
            <Table className="table-fixed w-full">
              <TableHeader>
                <TableRow>
                  <TableHead>Field</TableHead>
                  <TableHead>Value</TableHead>
                </TableRow>
              </TableHeader>
            </Table>
            {/* Scrollable body */}
            <div className="max-h-[22vh] overflow-y-auto">
              <Table className="table-fixed w-full">
                <TableBody>
                  {/* Add other details rows here as needed */}
                </TableBody>
              </Table>
            </div>
            <div className="p-3 border-t bg-gray-50" />
          </div>
        </TabsContent>
      </Tabs>
      
      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={(v) => setShowDeleteConfirm(v)}>
        <DialogContent className="max-w-sm" onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') {
            e.preventDefault()
            // Move focus to the left (Confirm)
            confirmBtnRef.current?.focus()
          } else if (e.key === 'ArrowRight') {
            e.preventDefault()
            // Move focus to the right (Cancel)
            cancelBtnRef.current?.focus()
          } else if (e.key === 'Enter') {
            // Activate the focused button
            (document.activeElement as HTMLButtonElement)?.click()
          }
        }}>
          <DialogHeader>
            <DialogTitle>Delete item?</DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button
              ref={confirmBtnRef}
              onClick={() => {
                if (deleteCandidate) onRemoveItem(deleteCandidate)
                setShowDeleteConfirm(false)
                setDeleteCandidate(null)
              }}
              autoFocus
            >
              Confirm
            </Button>
            <Button ref={cancelBtnRef} variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Multi Warehouse Allocation Popup */}
      {warehousePopupData && (
        <MultiWarehousePopup
          open={showWarehousePopup}
          onClose={() => {
            setShowWarehousePopup(false)
            // Programmatically click on the qty field to make it editable
            if (selectedItemId) {
              console.log('🔄 Warehouse popup closed, clicking on qty field')
              setTimeout(() => {
                // Find the qty cell for the selected item and click it
                const qtyCell = document.querySelector(`[data-item-code="${selectedItemId}"] [data-field="quantity"]`)
                if (qtyCell) {
                  console.log('🎯 Clicking on qty field')
                  ;(qtyCell as HTMLElement).click()
                } else {
                  console.log('❌ Qty cell not found for item:', selectedItemId)
                }
              }, 100)
            }
          }}
          onAssign={handleWarehouseAllocation}
          itemCode={warehousePopupData.itemCode}
          itemName={warehousePopupData.itemName}
          requiredQty={warehousePopupData.requiredQty}
          currentWarehouseQty={warehousePopupData.currentWarehouseQty}
          warehouses={warehousePopupData.warehouses}
        />
      )}
    </div>
  )
}

export default ItemsTable
