import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@renderer/components/ui/dialog';
import { Button } from '@renderer/components/ui/button';
import { Warehouse, WarehouseOperation } from '@renderer/types/picking';
import { cn } from '@renderer/lib/utils';
import { Check } from 'lucide-react';
import { ScrollArea } from '@renderer/components/ui/scroll-area';

interface AssignWarehousesModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAssign: (deliveryWarehouseId: string, operations: WarehouseOperation[]) => void;
    warehouses: Warehouse[];
    currentOperations: WarehouseOperation[];
}

export function AssignWarehousesModal({
    isOpen,
    onClose,
    onAssign,
    warehouses,
    currentOperations
}: AssignWarehousesModalProps) {
    const [selectedDeliveryWarehouse, setSelectedDeliveryWarehouse] = useState<string | null>(null);
    const [operationsList, setOperationsList] = useState<WarehouseOperation[]>([]);

    // Filter available delivery warehouses: explicitly marked or in current operations
    const availableDeliveryWarehouses = useMemo(() => {
        const opNames = new Set(currentOperations.map(op => op.warehouseName));
        return warehouses.filter(w => w.is_delivery_warehouse || opNames.has(w.name));
    }, [warehouses, currentOperations]);

    // Initialize list when modal opens & Auto-select default
    useEffect(() => {
        if (isOpen) {
            setOperationsList(currentOperations.map(op => ({ ...op })));

            if (availableDeliveryWarehouses.length > 0) {
                setSelectedDeliveryWarehouse(availableDeliveryWarehouses[0].id);
            } else {
                setSelectedDeliveryWarehouse(null);
            }
        }
    }, [isOpen, currentOperations, availableDeliveryWarehouses]);

    // Update operations list when Delivery Warehouse selection changes
    useEffect(() => {
        if (!isOpen) return;

        // Start with a clean copy of original operations to avoid duplicating added rows
        let newList = currentOperations.map(op => ({ ...op }));

        if (selectedDeliveryWarehouse) {
            const selectedWH = warehouses.find(w => w.id === selectedDeliveryWarehouse);
            if (selectedWH) {
                const existingIdx = newList.findIndex(op => (op.warehouseId && op.warehouseId === selectedWH.id) || op.warehouseName === selectedWH.name);

                let deliveryOp: WarehouseOperation;

                if (existingIdx !== -1) {
                    // Remove existing from current position
                    deliveryOp = newList[existingIdx];
                    newList.splice(existingIdx, 1);
                } else {
                    // Create new operation
                    deliveryOp = {
                        warehouseId: selectedWH.id,
                        warehouseName: selectedWH.name,
                        type: 'pickup',
                        status: 'draft',
                        pickSlips: [],
                        isCustomerPickup: true
                    };
                }

                // Force Delivery WH to be Pickup
                deliveryOp.isCustomerPickup = true;

                // Force others to be Transfer (not pickup)
                newList.forEach(op => op.isCustomerPickup = false);

                // Add Delivery Op to the top
                newList.unshift(deliveryOp);
            }
        }

        setOperationsList(newList);
    }, [selectedDeliveryWarehouse, isOpen, warehouses, currentOperations]); // Depend on currentOperations to reset correctly

    const handleAssign = () => {
        // Allow assign if at least one pickup is selected (validation requirement)
        // And if we have a valid list
        if (operationsList.some(op => op.isCustomerPickup)) {
            const deliveryId = selectedDeliveryWarehouse || (operationsList.find(op => op.isCustomerPickup)?.warehouseId || '');
            onAssign(deliveryId, operationsList);
            onClose();
        }
    };

    const handleTogglePickup = (index: number) => {
        // Prevent toggling the first item if it is the enforced Delivery Warehouse
        if (index === 0 && selectedDeliveryWarehouse) return;

        setOperationsList(prev => {
            const newList = [...prev];
            // If we toggle one ON, should we toggle others OFF? 
            // "one internal transfer will mandatory" -> implies single pickup.
            // I'll enforce single pickup interaction: if I check one, uncheck others.

            const newState = !newList[index].isCustomerPickup;
            if (newState) {
                // If checking this one, uncheck all others
                newList.forEach((op, i) => {
                    op.isCustomerPickup = (i === index);
                });
            } else {
                // If unchecking, just uncheck
                newList[index] = { ...newList[index], isCustomerPickup: false };
            }

            return newList;
        });
    };

    const isValid = operationsList.some(op => op.isCustomerPickup);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="!w-[60%] !max-w-[60%] max-h-[90vh] flex flex-col p-0 gap-0">
                <div className="p-6 pb-4">
                    <DialogHeader>
                        <DialogTitle>Assign Warehouses</DialogTitle>
                    </DialogHeader>

                    <div className="mt-4 space-y-2">
                        <label className="text-sm font-medium text-gray-700">Delivery Warehouse</label>
                        <div className="flex flex-wrap gap-2">
                            {availableDeliveryWarehouses.map((warehouse) => (
                                <Button
                                    key={warehouse.id}
                                    variant={selectedDeliveryWarehouse === warehouse.id ? 'default' : 'secondary'}
                                    className={cn(
                                        "h-8 rounded-full text-xs font-medium transition-all",
                                        selectedDeliveryWarehouse === warehouse.id
                                            ? "bg-green-500 hover:bg-green-600 text-white border-transparent"
                                            : "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200"
                                    )}
                                    onClick={() => setSelectedDeliveryWarehouse(warehouse.id)}
                                >
                                    {warehouse.name}
                                </Button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden px-6 pb-2">
                    <div className="border rounded-lg bg-white overflow-hidden flex flex-col h-full">
                        <div className="bg-gray-50 border-b px-4 py-2 flex text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                            <div className="flex-1">Warehouse</div>
                            <div className="flex-1 text-center">Customer Pickup</div>
                            <div className="flex-[3]">Pick Slips</div>
                            <div className="flex-1 text-center">Status</div>
                        </div>
                        <ScrollArea className="flex-1">
                            <div className="divide-y divide-gray-100">
                                {operationsList.map((op, index) => {
                                    const isDeliveryRow = index === 0 && selectedDeliveryWarehouse !== null;

                                    return (
                                        <div key={`${op.warehouseName}-${index}`} className="flex items-center px-4 py-3 text-sm">
                                            <div className="flex-1 font-medium text-gray-900">
                                                {op.warehouseName}
                                            </div>
                                            <div className="flex-1 flex justify-center">
                                                <div
                                                    className={cn(
                                                        "w-5 h-5 rounded border flex items-center justify-center transition-colors",
                                                        op.isCustomerPickup
                                                            ? "bg-green-500 border-green-500 text-white"
                                                            : "bg-white border-gray-300",
                                                        isDeliveryRow
                                                            ? "opacity-50 cursor-not-allowed"
                                                            : "cursor-pointer hover:border-green-400"
                                                    )}
                                                    onClick={() => handleTogglePickup(index)}
                                                >
                                                    {op.isCustomerPickup && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                                </div>
                                            </div>
                                            <div className="flex-[3] flex flex-wrap gap-1.5 items-center">
                                                {op.pickSlips && op.pickSlips.length > 0 ? (
                                                    op.pickSlips.map((slip) => (
                                                        <span
                                                            key={slip}
                                                            className="px-2 py-0.5 bg-gray-100 rounded-md text-[11px] font-medium text-gray-600 border border-gray-200"
                                                            title={slip}
                                                        >
                                                            {slip}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-gray-400 text-xs">-</span>
                                                )}
                                            </div>
                                            <div className="flex-1 flex justify-center">
                                                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-medium border border-gray-200 uppercase">
                                                    {op.status || 'Draft'}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                                {operationsList.length === 0 && (
                                    <div className="p-8 text-center text-gray-400 text-sm">
                                        Select a delivery warehouse to begin
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                </div>

                <div className="p-4 border-t bg-white flex justify-end gap-3">
                    <Button variant="outline" onClick={onClose} className="bg-gray-100 hover:bg-gray-200 border-none text-gray-700">
                        Cancel
                    </Button>
                    <Button
                        onClick={handleAssign}
                        disabled={!isValid}
                        className="bg-blue-500 hover:bg-blue-600 text-white min-w-[100px]"
                    >
                        <Check className="w-4 h-4 mr-2" />
                        Assign
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
