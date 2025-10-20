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
}

type EditField = 'quantity' | 'standard_rate' | 'uom' | 'discount_percentage'

const ItemsTable: React.FC<Props> = ({ selectedItemId, onRemoveItem, selectItem, shouldStartEditing = false, onEditingStarted }) => {
  const { getCurrentTabItems, activeTabId, updateItemInTab, getCurrentTab } = usePOSTabStore();
  const items = getCurrentTabItems();
  const currentTab = getCurrentTab();
  const isReadOnly = false; // Temporarily disabled for debugging
  // const isReadOnly = currentTab?.status === 'confirmed' || currentTab?.status === 'paid';
  
  const [activeField, setActiveField] = useState<EditField>('quantity');
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<string>('')
  const inputRef = useRef<HTMLInputElement>(null)
  
  console.log('🔧 ItemsTable Debug:', {
    activeTabId,
    currentTabStatus: currentTab?.status,
    isReadOnly,
    itemsCount: items.length,
    selectedItemId,
    isEditing
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
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing, activeField, selectedItemId])

  // Set initial edit value when editing starts
  useEffect(() => {
    if (isEditing && selectedItemId) {
      const item = items.find((i) => i.item_code === selectedItemId)
      if (item) {
        const value = item[activeField]
        setEditValue(value?.toString() || '')
      }
    }
  }, [isEditing, activeField, selectedItemId, items])

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
      } catch {}
    }

    updateItemInTab(activeTabId, selectedItemId, { [activeField]: finalValue })

    // Move to next field automatically
    // Jump from Qty → Unit Price, then stop
    const fieldOrder: EditField[] = ['quantity', 'standard_rate']
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

  useHotkeys(
    'space',
    () => {
      console.log('⌨️ Space key pressed, isEditing:', isEditing, 'selectedItemId:', selectedItemId)
      handleSaveEdit()
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
    const fieldOrder: EditField[] = ['quantity', 'standard_rate']
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
            {/* Single table with sticky header to keep columns aligned */}
            <div className="max-h-[22vh] overflow-y-auto">
              <Table className="table-fixed w-full">
                <TableHeader className="sticky top-0 z-10 bg-white">
                  <TableRow>
                    <TableHead className="w-[160px]">Product Code</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead className="w-[80px]">Qty</TableHead>
                    <TableHead className="w-[110px]">UOM</TableHead>
                    <TableHead className="w-[100px]">Discount</TableHead>
                    <TableHead className="w-[120px]">Unit Price</TableHead>
                    <TableHead className="w-[140px]">Total</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
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
                      <TableCell className={isSelected ? 'font-semibold text-blue-900' : ''}>
                        {item.item_code}
                      </TableCell>
                      <TableCell className={isSelected ? 'font-medium' : ''}>
                        {item.item_name}
                      </TableCell>

                      {/* Quantity Cell */}
                      <TableCell
                        className={`${isSelected && activeField === 'quantity'
                            ? 'ring-2 ring-blue-500 ring-inset bg-blue-50'
                            : ''
                          } ${isSelected ? 'font-medium' : ''} w-[80px]`}
                        onClick={(e) => {
                          e.stopPropagation()
                          console.log('🖱️ Quantity cell clicked:', item.item_code, 'isReadOnly:', isReadOnly)
                          if (!isReadOnly) {
                            selectItem(item.item_code)
                            setActiveField('quantity')
                            setIsEditing(true)
                            setEditValue(String(item.quantity ?? ''))
                            console.log('✅ Started editing quantity for:', item.item_code)
                          }
                        }}
                      >
                        {isEditingQuantity ? (
                          <input
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
                            className="w-full max-w-[72px] px-2 py-1 border-2 border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
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
                          } ${isSelected ? 'font-medium' : ''} w-[110px]`}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (!isReadOnly) {
                            selectItem(item.item_code)
                            setActiveField('uom')
                            setIsEditing(true)
                            setEditValue(String(item.uom ?? 'Nos'))
                          }
                        }}
                      >
                        {isEditingUom ? (
                          <input
                            ref={inputRef}
                            type="text"
                            value={editValue}
                            onChange={(e) => {
                              const val = e.target.value
                              setEditValue(val)
                              // Update UOM immediately and adjust rate
                              const applyRate = async () => {
                                try {
                                  let rates: Record<string, number> | undefined = (item as any).uomRates
                                  if (!rates || rates[val] === undefined) {
                                    const resp = await api.get(API_Endpoints.PRODUCT_LIST_METHOD, {
                                      params: {
                                        price_list: 'Standard Selling',
                                        search_text: item.item_code,
                                        limit_start: 1,
                                        limit_page_length: 1
                                      }
                                    })
                                    const entry = resp?.data?.data?.[0]
                                    const details = Array.isArray(entry?.uom_details) ? entry.uom_details : []
                                    rates = Object.fromEntries(details.map((d: any) => [d.uom, Number(d.rate || 0)]))
                                  }
                                  // Fallback #2: compute from Item detail conversion factors
                                  if (!rates || rates[val] === undefined) {
                                    const resp2 = await api.get(`${API_Endpoints.PRODUCTS}/${item.item_code}`)
                                    const det = resp2?.data?.data
                                    const baseRate = Number(det?.standard_rate || 0)
                                    const convs = Array.isArray(det?.uoms) ? det.uoms : []
                                    const computed: Record<string, number> = Object.fromEntries(
                                      convs.map((u: any) => [u.uom, baseRate * Number(u.conversion_factor || 1)])
                                    )
                                    rates = { ...(rates || {}), ...computed }
                                  }
                                  const rate = rates && rates[val]
                                  if (activeTabId) {
                                    updateItemInTab(activeTabId, item.item_code, {
                                      uom: val,
                                      standard_rate: Number(rate || 0),
                                      uomRates: rates
                                    })
                                  }
                                } catch {}
                              }
                              applyRate()
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
                            className="w-full max-w-[100px] px-2 py-1 border-2 border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-600 truncate"
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
                          } ${isSelected ? 'font-medium' : ''} w-[100px]`}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (!isReadOnly) {
                            selectItem(item.item_code)
                            setActiveField('discount_percentage')
                            setIsEditing(true)
                            setEditValue(String(item.discount_percentage ?? '0'))
                          }
                        }}
                      >
                        {isEditingDiscount ? (
                          <input
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
                            className="w-full max-w-[90px] px-2 py-1 border-2 border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
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
                        className={`${isSelected ? 'font-medium' : ''} w-[120px] ${
                          isSelected && activeField === 'standard_rate'
                            ? 'ring-2 ring-blue-500 ring-inset bg-blue-50'
                            : ''
                        }`}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (!isReadOnly) {
                            selectItem(item.item_code)
                            setActiveField('standard_rate')
                            setIsEditing(true)
                            setEditValue(String(item.standard_rate ?? ''))
                          }
                        }}
                      >
                        {isEditingRate ? (
                          <input
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
                            className="w-full max-w-[110px] px-2 py-1 border-2 border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                          />
                        ) : (
                          <>{Number(item.standard_rate || 0).toFixed(2)}</>
                        )}
                      </TableCell>
                      <TableCell className={`font-semibold ${isSelected ? 'text-blue-900' : ''}`}>
                        {(
                          Number(item.standard_rate || 0) *
                          Number(item.quantity || 0) *
                          (1 - Number(item.discount_percentage || 0) / 100)
                        ).toFixed(2)}
                      </TableCell>
                      <TableCell>
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
            <div className="p-3 border-t bg-gray-50">
              <Button
                variant="ghost"
                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              >
                <Plus className="w-4 h-4 mr-2" />
                Press &apos;Shift&apos; to add item • Space to edit • ←→ to navigate fields
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
