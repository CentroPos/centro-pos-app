import React, { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'

type Warehouse = {
  name: string
  available: number
  allocated: number
  selected: boolean
}

type MultiWarehousePopupProps = {
  open: boolean
  onClose: () => void
  onAssign: (allocations: Warehouse[]) => void
  itemCode: string
  itemName: string
  requiredQty: number
  currentWarehouseQty: number
  warehouses: Warehouse[]
  uom?: string
  defaultWarehouse?: string
}

const MultiWarehousePopup: React.FC<MultiWarehousePopupProps> = ({
  open,
  onClose,
  onAssign,
  itemCode,
  itemName,
  requiredQty,
  currentWarehouseQty,
  warehouses,
  uom = 'Nos',
  defaultWarehouse
}) => {
  const [warehouseData, setWarehouseData] = useState<Warehouse[]>([])
  const shortage = requiredQty - currentWarehouseQty
  const firstInputRef = useRef<HTMLInputElement | null>(null)
  const assignBtnRef = useRef<HTMLButtonElement | null>(null)
  const showShortageMessage = requiredQty > currentWarehouseQty

  useEffect(() => {
    if (open) {
      // Initialize warehouse data with pre-selected warehouses from props
      // Preserve existing allocations if they exist, otherwise use defaults
      setWarehouseData(
        warehouses.map((warehouse) => {
          const isDefaultWarehouse = defaultWarehouse && warehouse.name === defaultWarehouse
          // Use existing selected state if provided, otherwise default to defaultWarehouse
          const isSelected = warehouse.selected !== undefined ? warehouse.selected : (isDefaultWarehouse || false)
          
          // Pre-fill allocation: use existing allocated value if provided, otherwise calculate default
          let initialAllocated = warehouse.allocated || 0
          if (initialAllocated === 0 && isSelected && isDefaultWarehouse) {
            // Only auto-fill if no existing allocation and it's the default warehouse
            // If required < available, use required; otherwise use available
            if (requiredQty < warehouse.available) {
              initialAllocated = requiredQty
            } else {
              initialAllocated = warehouse.available
            }
          }
          
          return {
            ...warehouse,
            allocated: initialAllocated,
            selected: isSelected
          }
        })
      )
    }
  }, [open, warehouses, defaultWarehouse, requiredQty])

  // Focus the first selected input after warehouseData is set
  useEffect(() => {
    if (open && warehouseData.length > 0) {
      setTimeout(() => {
        // First try to find a warehouse that was pre-selected
        const firstSelectedIndex = warehouseData.findIndex((w) => w.selected)
        if (firstSelectedIndex >= 0) {
          const inputElement = document.querySelector(
            `input[data-warehouse-index="${firstSelectedIndex}"]`
          ) as HTMLInputElement
          if (inputElement) {
            inputElement.focus()
            inputElement.select()
          }
        } else if (firstInputRef.current) {
          firstInputRef.current.focus()
          firstInputRef.current.select()
        }
      }, 100)
    }
  }, [open, warehouseData])

  const handleWarehouseToggle = (index: number, checked: boolean) => {
    setWarehouseData((prev) =>
      prev.map((warehouse, i) =>
        i === index
          ? { ...warehouse, selected: checked, allocated: checked ? 0 : warehouse.allocated }
          : warehouse
      )
    )
  }

  const handleAllocationChange = (index: number, value: string) => {
    const allocatedQty = parseInt(value) || 0
    const warehouse = warehouseData[index]

    if (allocatedQty > warehouse.available) {
      return // Don't allow more than available
    }

    setWarehouseData((prev) =>
      prev.map((w, i) => (i === index ? { ...w, allocated: allocatedQty } : w))
    )
  }

  const handleAssign = () => {
    const selectedWarehouses = warehouseData.filter((w) => w.selected && w.allocated > 0)
    onAssign(selectedWarehouses)
    onClose()
  }

  const totalAllocated = warehouseData.reduce((sum, w) => sum + w.allocated, 0)
  const isValidAllocation = totalAllocated >= requiredQty && warehouseData.some((w) => w.selected)

  console.log('📊 Allocation summary:', {
    totalAllocated,
    shortage,
    requiredQty,
    isValidAllocation,
    warehouses: warehouseData.map((w) => ({
      name: w.name,
      allocated: w.allocated,
      selected: w.selected
    }))
  })

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="max-w-2xl bg-white border-2 shadow-2xl"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            onClose()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-800">Multi Warehouse</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Shortage Message - Only show if required qty > current warehouse stock */}
          {showShortageMessage && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-sm text-gray-700 mb-1">
                <strong>Item:</strong> {itemCode} - {itemName}
              </div>
              <div className="text-sm text-red-700">
                <strong>Enough qty not available in current warehouse</strong>
              </div>
            </div>
          )}

          {/* Warehouse Allocation Table */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Allocate
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Available
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Total</th>
                </tr>
              </thead>
              <tbody>
                {warehouseData.map((warehouse, index) => (
                  <tr key={index} className="border-b border-gray-200">
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={warehouse.selected}
                          onChange={(e) => handleWarehouseToggle(index, e.target.checked)}
                          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                        />
                        <span className="text-sm font-medium text-gray-700">{warehouse.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">{warehouse.available} {uom}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        ref={index === 0 ? firstInputRef : undefined}
                        type="number"
                        value={warehouse.allocated || ''}
                        onChange={(e) => handleAllocationChange(index, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === ' ') {
                            e.preventDefault()
                            assignBtnRef.current?.focus()
                          }
                        }}
                        disabled={!warehouse.selected}
                        className="w-20 text-sm"
                        min="0"
                        max={warehouse.available}
                        data-warehouse-index={index}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Allocation Summary */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-700">
                <strong>Total Allocated:</strong> {totalAllocated} {uom}
              </div>
              <div className="text-sm text-gray-700">
                <strong>Required:</strong> {requiredQty} {uom}
              </div>
              <div
                className={`text-sm font-semibold ${totalAllocated >= requiredQty ? 'text-green-600' : 'text-red-600'}`}
              >
                {totalAllocated >= requiredQty ? 'Sufficient' : 'Insufficient'}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={onClose} className="px-6 py-2">
            Cancel
          </Button>
          <Button
            ref={assignBtnRef}
            onClick={handleAssign}
            disabled={!isValidAllocation}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white"
          >
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default MultiWarehousePopup
