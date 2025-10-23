import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
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

type Props = {
  selectedItemId?: string
  onRemoveItem: (value: string) => void
  selectItem: (value: string) => void
  shouldStartEditing?: boolean
  onEditingStarted?: () => void
  onAddItemClick?: () => void
  onSaveCompleted?: number
}

type EditField = 'quantity' | 'standard_rate' | 'uom' | 'discount_percentage'

const ItemsTable: React.FC<Props> = ({ selectedItemId, onRemoveItem, selectItem, shouldStartEditing = false, onEditingStarted, onAddItemClick, onSaveCompleted }) => {
  const { getCurrentTabItems, activeTabId, updateItemInTab, getCurrentTab } = usePOSTabStore();
  const items = getCurrentTabItems();
  const currentTab = getCurrentTab();
  const isReadOnly = false; // Temporarily disabled for debugging
  // const isReadOnly = currentTab?.status === 'confirmed' || currentTab?.status === 'paid';
  
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
  
  const [activeField, setActiveField] = useState<EditField>('quantity');
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<string>('')
  const [forceFocus, setForceFocus] = useState(0)
  const [invalidUomMessage, setInvalidUomMessage] = useState<string>('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Function to completely reset editing state
  const resetEditingState = () => {
    console.log('🔄 Resetting editing state completely')
    setIsEditing(false)
    setActiveField('quantity')
    setEditValue('')
    setInvalidUomMessage('')
    setForceFocus(0)
    
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

  useEffect(() => {
    if (shouldStartEditing && selectedItemId && !isEditing) {
      setActiveField('quantity');
      setIsEditing(true);
      onEditingStarted?.(); // Call the callback to reset the flag
    }
  }, [shouldStartEditing, selectedItemId, isEditing, onEditingStarted]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      // Use a longer delay to ensure the input is fully rendered and reset
      setTimeout(() => {
        if (inputRef.current) {
          console.log('🎯 Focusing input after editing state change')
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
        updateItemInTab(activeTabId, itemCode, {
          uomRates: uomRates,
          // Keep current UOM and rate, just update the rates map
        })
      }
    } catch (error) {
      console.error('Error refreshing item data:', error)
    }
  }

  const handleSaveEdit = async () => {
    if (!isEditing || !selectedItemId || !activeTabId) return

    const item = items.find((i) => i.item_code === selectedItemId)
    if (!item) return

    let finalValue: string | number = editValue

    if (activeField !== 'uom') {
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
          alert(`Item ${item.item_code} not found in API. Please refresh and try again.`)
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
          if (activeTabId) {
            updateItemInTab(activeTabId, item.item_code, {
              uom: previousUom,
              standard_rate: Number(fallbackRate || 0),
              uomRates: Object.fromEntries(uomDetails.map((d: any) => [d.uom, d.rate]))
            })
          }
          
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
        
        if (activeTabId) {
          updateItemInTab(activeTabId, item.item_code, {
            uom: uomInfo.uom, // Use the exact UOM from API (preserves case)
            standard_rate: Number(uomInfo.rate || 0),
            uomRates: Object.fromEntries(uomDetails.map((d: any) => [d.uom, d.rate]))
          })
          
          // Refresh item data to ensure UI is updated
          setTimeout(() => {
            refreshItemData(item.item_code)
          }, 100)
        }
        finalValue = uomInfo.uom
      } catch (error) {
        console.error('Error fetching UOM details:', error)
        // If API fails, just use the typed value
        finalValue = editValue
      }
    }

    // Check for quantity shortage when saving quantity
    if (activeField === 'quantity' && typeof finalValue === 'number') {
      const requiredQty = finalValue
      try {
        // Fetch live warehouse stock for this item and map to current UOM
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
        const uomKey = String(item.uom || 'Nos').toLowerCase()
        const warehouses = list.map((w: any) => {
          const q = Array.isArray(w.quantities) ? w.quantities : []
          const match = q.find((qq: any) => String(qq.uom).toLowerCase() === uomKey)
          return { name: w.warehouse, available: Number(match?.qty || 0) }
        })
        const totalAvailable = warehouses.reduce((s: number, w: any) => s + (Number(w.available) || 0), 0)

        if (requiredQty > totalAvailable) {
          console.log('⚠️ Shortage detected:', { requiredQty, totalAvailable, warehouses })
          // Show warehouse allocation popup with live availability for the selected UOM
          setWarehousePopupData({
            itemCode: item.item_code,
            itemName: item.item_name || item.label || 'Unknown Product',
            requiredQty,
            currentWarehouseQty: totalAvailable,
            warehouses
          })
          setShowWarehousePopup(true)
          return // Don't save yet, wait for warehouse allocation
        }
      } catch (err) {
        console.error('Error checking warehouse quantities:', err)
      }
    }

    updateItemInTab(activeTabId, selectedItemId, { [activeField]: finalValue })

    // Move to next field automatically
    // Navigate through all editable fields: Qty → UOM → Discount → Unit Price
    const fieldOrder: EditField[] = ['quantity', 'uom', 'discount_percentage', 'standard_rate']
    const currentIndex = fieldOrder.indexOf(activeField)

    if (currentIndex < fieldOrder.length - 1) {
      // Move to next field
      const nextField = fieldOrder[currentIndex + 1];
      setTimeout(() => {
        setActiveField(nextField);
        setIsEditing(true);
      }, 50)
    } else {
      // Done editing this item
      setIsEditing(false)
    }
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
      // New behavior: Space toggles/cycles UOM for the selected item
      if (!selectedItemId || isReadOnly) return
      if (activeField !== 'uom') return

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

        if (activeTabId) {
          updateItemInTab(activeTabId, item.item_code, {
            uom: next.uom,
            standard_rate: Number(next.rate || 0),
            uomRates: Object.fromEntries(orderedUoms.map((d) => [d.uom, d.rate]))
          })
        }

        // Reflect the change in the inline editor state if it's open
        if (isEditing && activeField === 'uom') {
          setEditValue(next.uom)
        }
      } catch (err) {
        console.error('Space-to-cycle UOM failed:', err)
      }
    },
    { preventDefault: true, enableOnFormTags: true }
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

  // Arrow key navigation
  useHotkeys(
    'ArrowLeft',
    () => {
      if (isEditing && selectedItemId) {
        const fieldOrder: EditField[] = ['quantity', 'uom', 'discount_percentage', 'standard_rate']
        const currentIndex = fieldOrder.indexOf(activeField)
        
        if (currentIndex > 0) {
          const prevField = fieldOrder[currentIndex - 1]
          setActiveField(prevField)
          const item = items.find((i) => i.item_code === selectedItemId)
          if (item) {
            setEditValue(String(item[prevField] ?? ''))
          }
        }
      }
    },
    { preventDefault: true, enableOnFormTags: true }
  )

  useHotkeys(
    'ArrowRight',
    () => {
      if (isEditing && selectedItemId) {
        const fieldOrder: EditField[] = ['quantity', 'uom', 'discount_percentage', 'standard_rate']
        const currentIndex = fieldOrder.indexOf(activeField)
        
        if (currentIndex < fieldOrder.length - 1) {
          const nextField = fieldOrder[currentIndex + 1]
          setActiveField(nextField)
          const item = items.find((i) => i.item_code === selectedItemId)
          if (item) {
            setEditValue(String(item[nextField] ?? ''))
          }
        }
      }
    },
    { preventDefault: true, enableOnFormTags: true }
  )

  useHotkeys(
    'ArrowUp',
    () => {
      if (selectedItemId && !isReadOnly) {
        const currentIndex = items.findIndex((i) => i.item_code === selectedItemId)
        if (currentIndex > 0) {
          const prevItem = items[currentIndex - 1]
          selectItem(prevItem.item_code)
          if (isEditing) {
            // Keep editing mode but switch to the previous item
            const item = items.find((i) => i.item_code === prevItem.item_code)
            if (item) {
              setEditValue(String(item[activeField] ?? ''))
            }
          }
        }
      }
    },
    { preventDefault: true, enableOnFormTags: true }
  )

  useHotkeys(
    'ArrowDown',
    () => {
      if (selectedItemId && !isReadOnly) {
        const currentIndex = items.findIndex((i) => i.item_code === selectedItemId)
        if (currentIndex < items.length - 1) {
          const nextItem = items[currentIndex + 1]
          selectItem(nextItem.item_code)
          if (isEditing) {
            // Keep editing mode but switch to the next item
            const item = items.find((i) => i.item_code === nextItem.item_code)
            if (item) {
              setEditValue(String(item[activeField] ?? ''))
            }
          }
        }
      }
    },
    { preventDefault: true, enableOnFormTags: true }
  )

  // Handle warehouse allocation
  const handleWarehouseAllocation = (allocations: any[]) => {
    if (!warehousePopupData || !activeTabId) return

    // Calculate total allocated quantity from all warehouses
    const totalAllocated = allocations.reduce((sum, allocation) => {
      return sum + (Number(allocation.allocated) || 0)
    }, 0)

    console.log('📦 Warehouse allocation:', { 
      allocations, 
      totalAllocated, 
      requiredQty: warehousePopupData.requiredQty 
    })

    // Update the item with the total allocated quantity
    updateItemInTab(activeTabId, warehousePopupData.itemCode, { 
      quantity: totalAllocated,
      warehouseAllocations: allocations 
    })

    // Move to next field after successful allocation
    const fieldOrder: EditField[] = ['quantity', 'uom', 'discount_percentage', 'standard_rate']
    const currentIndex = fieldOrder.indexOf(activeField)

    if (currentIndex < fieldOrder.length - 1) {
      const nextField = fieldOrder[currentIndex + 1];
      setTimeout(() => {
        setActiveField(nextField);
        setIsEditing(true);
      }, 50)
    } else {
      setIsEditing(false)
    }
  }

  return (
    <div className="p-4 bg-white">
      <Tabs defaultValue="items" className="w-full">
        <TabsList>
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="other">Other Details</TabsTrigger>
        </TabsList>
        <TabsContent value="items" className="mt-4">
          <div className="border rounded-lg">
            {/* Fixed header (outside scroll) */}
            <Table className="table-fixed w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Product Code</TableHead>
                  <TableHead className="w-[200px]">Label</TableHead>
                  <TableHead className="w-[70px] text-center">Qty</TableHead>
                  <TableHead className="w-[80px] text-center px-1">UOM</TableHead>
                  <TableHead className="w-[80px] text-center">Discount</TableHead>
                  <TableHead className="w-[100px] text-center">Unit Price</TableHead>
                  <TableHead className="w-[100px] text-left pl-5">Total</TableHead>
                  <TableHead className="w-[60px] text-center pl-1">Actions</TableHead>
                </TableRow>
              </TableHeader>
            </Table>

            {/* Scrollable body only */}
            <div 
              className="max-h-[22vh] overflow-y-auto cursor-pointer"
              onClick={(e) => {
                // Only trigger if clicking on empty space (not on table cells)
                if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'DIV') {
                  console.log('🖱️ Items table area clicked - opening product modal')
                  onAddItemClick?.()
                }
              }}
            >
              <Table className="table-fixed w-full">
                <TableBody>
                {items.map((item) => {
                  const isSelected = item.item_code === selectedItemId
                  const isEditingQuantity = isSelected && isEditing && activeField === 'quantity'
                  const isEditingRate = isSelected && isEditing && activeField === 'standard_rate'
                  const isEditingUom = isSelected && isEditing && activeField === 'uom'
                  const isEditingDiscount =
                    isSelected && isEditing && activeField === 'discount_percentage'

                  return (
                    <TableRow
                      onClick={(e) => {
                        e.stopPropagation()
                        console.log('🖱️ Row clicked:', item.item_code, 'isEditing:', isEditing, 'isReadOnly:', isReadOnly)
                        if (!isEditing && !isReadOnly) {
                          selectItem(item.item_code)
                        }
                      }}
                      key={item.item_code}
                      className={`transition-all ${isSelected
                          ? 'bg-gradient-to-r from-blue-50 to-blue-100 border-l-4 border-l-blue-500 shadow-md'
                          : 'hover:bg-gray-50'
                        }`}
                    >
                      <TableCell className={`${isSelected ? 'font-semibold text-blue-900' : ''} w-[140px]`}>
                        {item.item_code}
                      </TableCell>
                      <TableCell className={`${isSelected ? 'font-medium' : ''} w-[200px]`}>
                        <span
                          className="block truncate"
                          title={item.item_name || ''}
                        >
                          {item.item_name}
                        </span>
                      </TableCell>

                      {/* Quantity Cell */}
                      <TableCell
                        className={`${isSelected && activeField === 'quantity'
                            ? 'ring-2 ring-blue-500 ring-inset bg-blue-50'
                            : ''
                          } ${isSelected ? 'font-medium' : ''} w-[70px] text-center`}
                        onClick={(e) => {
                          e.stopPropagation()
                          console.log('🖱️ Quantity cell clicked:', item.item_code, 'isReadOnly:', isReadOnly)
                          if (!isReadOnly) {
                            // Always reset editing state first, regardless of current state
                            resetEditingState()
                            
                            // Use a small delay to ensure reset is complete
                            setTimeout(() => {
                              selectItem(item.item_code)
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
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                handleSaveEdit()
                              } else if (e.key === 'Escape') {
                                e.preventDefault()
                                setIsEditing(false)
                              }
                            }}
                            onBlur={handleSaveEdit}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            className="w-[50px] mx-auto px-2 py-1 border-2 border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-600 text-center"
                            min="0"
                            step="0.01"
                          />
                        ) : (
                          <div className="px-2 py-1">{item.quantity}</div>
                        )}
                      </TableCell>

                      {/* UOM Cell */}
                      <TableCell
                        className={`${isSelected && activeField === 'uom'
                            ? 'ring-2 ring-blue-500 ring-inset bg-blue-50'
                            : ''
                          } ${isSelected ? 'font-medium' : ''} w-[80px] text-center`}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (!isReadOnly) {
                            // Always reset editing state first, regardless of current state
                            resetEditingState()
                            
                            // Use a small delay to ensure reset is complete
                            setTimeout(() => {
                              selectItem(item.item_code)
                              setActiveField('uom')
                              setIsEditing(true)
                              setEditValue(String(item.uom ?? 'Nos'))
                            }, 50)
                          }
                        }}
                      >
                        {isEditingUom ? (
                          <input
                            key={`uom-${item.item_code}-${isEditingUom}-${forceFocus}`}
                            ref={inputRef}
                            type="text"
                            value={editValue}
                            onChange={(e) => {
                              const val = e.target.value
                              console.log('📝 UOM input onChange:', val)
                              setEditValue(val)
                              // Don't validate on every keystroke - only on blur/enter
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                handleSaveEdit()
                              } else if (e.key === 'Escape') {
                                e.preventDefault()
                                setIsEditing(false)
                              }
                            }}
                            onBlur={handleSaveEdit}
                            className="w-[70px] mx-auto px-2 py-1 border-2 border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-600 text-center truncate"
                          />
                        ) : (
                          <div className="px-2 py-1">{item.uom || 'Nos'}</div>
                        )}
                      </TableCell>

                      {/* Discount Cell */}
                      <TableCell
                        className={`${isSelected && activeField === 'discount_percentage'
                            ? 'ring-2 ring-blue-500 ring-inset bg-blue-50'
                            : ''
                          } ${isSelected ? 'font-medium' : ''} w-[80px] text-center`}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (!isReadOnly) {
                            // Always reset editing state first, regardless of current state
                            resetEditingState()
                            
                            // Use a small delay to ensure reset is complete
                            setTimeout(() => {
                              selectItem(item.item_code)
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
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                handleSaveEdit()
                              } else if (e.key === 'Escape') {
                                e.preventDefault()
                                setIsEditing(false)
                              }
                            }}
                            onBlur={handleSaveEdit}
                            className="w-[60px] mx-auto px-2 py-1 border-2 border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-600 text-center"
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
                        className={`${isSelected ? 'font-medium' : ''} w-[100px] text-center ${
                          isSelected && activeField === 'standard_rate'
                            ? 'ring-2 ring-blue-500 ring-inset bg-blue-50'
                            : ''
                        }`}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (!isReadOnly) {
                            // Always reset editing state first, regardless of current state
                            resetEditingState()
                            
                            // Use a small delay to ensure reset is complete
                            setTimeout(() => {
                              selectItem(item.item_code)
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
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                handleSaveEdit()
                              } else if (e.key === 'Escape') {
                                e.preventDefault()
                                setIsEditing(false)
                              }
                            }}
                            onBlur={handleSaveEdit}
                            min="0"
                            step="0.01"
                            className="w-[80px] mx-auto px-2 py-1 border-2 border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-600 text-center"
                          />
                        ) : (
                          <>{Number(item.standard_rate || 0).toFixed(2)}</>
                        )}
                      </TableCell>
                      <TableCell className={`font-semibold ${isSelected ? 'text-blue-900' : ''} w-[100px] text-left pl-8`}>
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
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (!isReadOnly) onRemoveItem(item.item_code)
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
            
            {/* Invalid UOM Message */}
            {invalidUomMessage && (
              <div className="px-3 py-2 bg-red-50 border-t border-red-200">
                <div className="text-red-700 text-sm text-center">
                  ⚠️ {invalidUomMessage}
                </div>
              </div>
            )}
            
            <div className="p-3 border-t bg-gray-50">
              <Button
                variant="ghost"
                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                onClick={() => {
                  console.log('🖱️ Add item button clicked - opening product modal')
                  onAddItemClick?.()
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Click or press &apos;Shift&apos; to add item • Space to switch UOM • ← → to navigate fields • ↑ ↓ to navigate rows
              </Button>
            </div>
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
      
      {/* Multi Warehouse Allocation Popup */}
      {warehousePopupData && (
        <MultiWarehousePopup
          open={showWarehousePopup}
          onClose={() => setShowWarehousePopup(false)}
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
