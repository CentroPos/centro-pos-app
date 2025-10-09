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

type Props = {
  selectedItemId?: string
  onRemoveItem: (value: string) => void
  selectItem: (value: string) => void
  shouldStartEditing?: boolean
  onEditingStarted?: () => void
}

type EditField = 'quantity' | 'uom' | 'discount_percentage'

const ItemsTable: React.FC<Props> = ({ selectedItemId, onRemoveItem, selectItem, shouldStartEditing = false, onEditingStarted }) => {
  const { getCurrentTabItems, activeTabId, updateItemInTab } = usePOSTabStore();
  const items = getCurrentTabItems();
  const [activeField, setActiveField] = useState<EditField>('quantity');
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<string>('')
  const inputRef = useRef<HTMLInputElement>(null)

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

  const handleSaveEdit = () => {
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

    updateItemInTab(activeTabId, selectedItemId, { [activeField]: finalValue })

    // Move to next field automatically
    const fieldOrder: EditField[] = ['quantity', 'uom', 'discount_percentage']
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
    'Enter',
    () => {
      handleSaveEdit()
    },
    { preventDefault: true }
  )

  useHotkeys(
    'Escape',
    () => {
      setIsEditing(false)
    },
    { preventDefault: true }
  )

  return (
    <div className="p-4 bg-white">
      <Tabs defaultValue="items" className="w-full">
        <TabsList>
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="other">Other Details</TabsTrigger>
        </TabsList>
        <TabsContent value="items" className="mt-4">
          <div className="border rounded-lg">
            {/* Static table header */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product Code</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>UOM</TableHead>
                  <TableHead>Disc %</TableHead>
                  <TableHead>Unit Price</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
            </Table>

            {/* Only the rows scroll */}
            <div className="max-h-[50vh] overflow-y-auto">
              <Table>
                <TableBody>
                {items.map((item) => {
                  const isSelected = item.item_code === selectedItemId
                  const isEditingQuantity = isSelected && isEditing && activeField === 'quantity'
                  const isEditingUom = isSelected && isEditing && activeField === 'uom'
                  const isEditingDiscount =
                    isSelected && isEditing && activeField === 'discount_percentage'

                  return (
                    <TableRow
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!isEditing) {
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
                      <TableCell className={isSelected ? 'image.pngfont-medium' : ''}>
                        {item.item_name}
                      </TableCell>

                      {/* Quantity Cell */}
                      <TableCell
                        className={`${isSelected && activeField === 'quantity'
                            ? 'ring-2 ring-blue-500 ring-inset bg-blue-50'
                            : ''
                          } ${isSelected ? 'font-medium' : ''}`}
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
                            className="w-full px-2 py-1 border-2 border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
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
                          } ${isSelected ? 'font-medium' : ''}`}
                      >
                        {isEditingUom ? (
                          <input
                            ref={inputRef}
                            type="text"
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
                            className="w-full px-2 py-1 border-2 border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                          />
                        ) : (
                          <div className="px-2 py-1">{item.uom}</div>
                        )}
                      </TableCell>

                      {/* Discount Cell */}
                      <TableCell
                        className={`${isSelected && activeField === 'discount_percentage'
                            ? 'ring-2 ring-blue-500 ring-inset bg-blue-50'
                            : ''
                          } ${isSelected ? 'font-medium' : ''}`}
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
                            className="w-full px-2 py-1 border-2 border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                            min="0"
                            max="100"
                            step="0.01"
                          />
                        ) : (
                          <div className="px-2 py-1">{item.discount_percentage}</div>
                        )}
                      </TableCell>

                      <TableCell className={isSelected ? 'font-medium' : ''}>
                        ${item.standard_rate}
                      </TableCell>
                      <TableCell className={`font-semibold ${isSelected ? 'text-blue-900' : ''}`}>
                        $
                        {(
                          item.standard_rate *
                          item.quantity *
                          (1 - item.discount_percentage / 100)
                        ).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1"
                          onClick={(e) => {
                            e.stopPropagation()
                            onRemoveItem(item.item_code)
                          }}
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
            {/* Static table header for Other Details */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Field</TableHead>
                  <TableHead>Value</TableHead>
                </TableRow>
              </TableHeader>
            </Table>

            {/* Only the rows scroll in Other Details */}
            <div className="max-h-[50vh] overflow-y-auto">
              <Table>
                <TableBody>
                  {/* Add other details rows here as needed */}
                </TableBody>
              </Table>
            </div>

            <div className="p-3 border-t bg-gray-50" />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default ItemsTable
