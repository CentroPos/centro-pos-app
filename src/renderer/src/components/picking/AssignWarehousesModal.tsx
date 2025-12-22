import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@renderer/components/ui/dialog';
import { Button } from '@renderer/components/ui/button';
import { Warehouse, WarehouseOperation } from '@renderer/types/picking';
import { cn } from '@renderer/lib/utils';
import { Check } from 'lucide-react';
import { ScrollArea } from '@renderer/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@renderer/components/ui/table';

import { toast } from 'sonner';

interface AssignWarehousesModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAssign: (deliveryWarehouseId: string, operations: WarehouseOperation[]) => void;
    warehouses: Warehouse[];
    currentOperations: WarehouseOperation[];
    invoiceNo: string;
}

export function AssignWarehousesModal({
    isOpen,
    onClose,
    onAssign,
    warehouses,
    currentOperations,
    invoiceNo
}: AssignWarehousesModalProps) {
    const [selectedDeliveryWarehouse, setSelectedDeliveryWarehouse] = useState<string | null>(null);
    const [operationsList, setOperationsList] = useState<WarehouseOperation[]>([]);
    const [isAssigning, setIsAssigning] = useState(false);

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

    const handleAssign = async () => {
        // Allow assign if at least one pickup is selected (validation requirement)
        // And if we have a valid list
        if (operationsList.some(op => op.isCustomerPickup)) {
            setIsAssigning(true);
            try {
                const deliveryId = selectedDeliveryWarehouse || (operationsList.find(op => op.isCustomerPickup)?.warehouseId || '');
                const deliveryWarehouse = warehouses.find(w => w.id === deliveryId);

                const payload = {
                    invoice_no: invoiceNo,
                    delivery_warehouse: deliveryWarehouse?.name || '',
                    operations: operationsList.map(op => ({
                        warehouse: op.warehouseName,
                        customer_pickup: op.isCustomerPickup
                    }))
                };

                console.log("Assign Warehouse Payload:", payload);

                const res = await window.electronAPI?.proxy?.request({
                    url: '/api/method/centro_pos_apis.api.picking.assign_warehouse_operation',
                    method: 'POST',
                    data: payload
                });

                if (res && (res.status === 200 || res.status === 201)) { // Accept 201 as strictly success too if needed, usually 200 for RPC
                    toast.success("Successfully assigned warehouses");
                    onAssign(deliveryId, operationsList);
                    onClose();
                } else {
                    console.error("Assign Warehouse Error:", res);
                    toast.error("Failed to assign warehouses. Please try again.");
                }
            } catch (error) {
                console.error("Assign Warehouse API Error:", error);
                toast.error("An error occurred while assigning warehouses.");
            } finally {
                setIsAssigning(false);
            }
        }
    };

    const handleTogglePickup = (index: number) => {
        const isDeliveryRow = index === 0 && selectedDeliveryWarehouse !== null;
        // Check if row should be disabled (logic duplicated from render for safety)
        const isSingleRow = operationsList.length === 1;
        const selectedWH = warehouses.find(w => w.id === selectedDeliveryWarehouse);
        const isDeliveryWarehouse = selectedWH?.is_delivery_warehouse;
        const isFirstLineDelivery = isDeliveryRow && isDeliveryWarehouse;
        const isDone = (operationsList[index].status || '').toLowerCase() === 'done';

        // Prevent toggling if disabled
        if (isSingleRow) return;
        if (isFirstLineDelivery) return;
        if (isDone) return;

        setOperationsList(prev => {
            const newList = [...prev];
            // Toggle the target row
            newList[index] = { ...newList[index], isCustomerPickup: !newList[index].isCustomerPickup };
            return newList;
        });
    };

    // Validation Logic
    const isValid = useMemo(() => {
        const hasSelection = operationsList.some(op => op.isCustomerPickup);
        if (!hasSelection) return false;

        const isDeliveryRow = selectedDeliveryWarehouse !== null;
        const isDeliverySelected = isDeliveryRow && operationsList[0]?.isCustomerPickup;

        // If Delivery Row is selected, NO other rows should be selected (Exclusivity)
        if (isDeliverySelected) {
            const othersSelected = operationsList.slice(1).some(op => op.isCustomerPickup);
            return !othersSelected;
        }

        return true;
    }, [operationsList, selectedDeliveryWarehouse]);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="!w-[60%] !max-w-[60%] max-h-[90vh] flex flex-col p-0 gap-0">
                <div className="p-6 pb-4">
                    <DialogHeader>
                        <DialogTitle>Assign Warehouses</DialogTitle>
                    </DialogHeader>

                    <div className="mt-4 space-y-2">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Delivery Warehouse</label>
                        <div className="flex flex-wrap gap-2">
                            {availableDeliveryWarehouses.map((warehouse) => (
                                <Button
                                    key={warehouse.id}
                                    variant="outline"
                                    className={cn(
                                        "h-8 rounded-full px-4 text-xs font-medium border transition-all",
                                        selectedDeliveryWarehouse === warehouse.id
                                            ? "bg-green-700 hover:bg-green-800 text-white border-green-700 shadow-sm"
                                            : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
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
                        <ScrollArea className="flex-1">
                            <Table>
                                <TableHeader className="sticky top-0 bg-slate-100 z-10 text-xs border-b border-slate-200 shadow-sm">
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="font-bold text-slate-700 pl-4 text-left">Warehouse</TableHead>
                                        <TableHead className="w-[150px] font-bold text-center text-slate-700">Customer Pickup</TableHead>
                                        <TableHead className="w-auto flex-1 font-bold text-slate-700 text-left">Pick Slips</TableHead>
                                        <TableHead className="w-[100px] font-bold text-center text-slate-700">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {operationsList.map((op, index) => {
                                        const isDeliveryRow = index === 0 && selectedDeliveryWarehouse !== null;
                                        const isDone = (op.status || '').toLowerCase() === 'done';
                                        const isPending = (op.status || '').toLowerCase() === 'pending';

                                        // Checkbox Logic
                                        const isSingleRow = operationsList.length === 1;
                                        const selectedWH = warehouses.find(w => w.id === selectedDeliveryWarehouse);
                                        // Use optional chaining carefully - assuming warehouse object structure
                                        const isDeliveryWarehouse = selectedWH && 'is_delivery_warehouse' in selectedWH && !!selectedWH.is_delivery_warehouse;
                                        const isFirstLineDelivery = isDeliveryRow && isDeliveryWarehouse;

                                        // Condition: "if only having one row, the checkbox will true by default and inactive"
                                        // Condition: "first line should be inactive if ... is delivery warehouse"
                                        // Condition: "if done ... inactive"
                                        const isCheckboxDisabled = isSingleRow || isFirstLineDelivery || isDone;

                                        return (
                                            <TableRow
                                                key={`${op.warehouseName}-${index}`}
                                                className={cn(
                                                    "text-xs hover:bg-muted/50 transition-colors border-b last:border-0",
                                                    isDone && "opacity-50 pointer-events-none bg-muted/30"
                                                )}
                                            >
                                                <TableCell className="font-medium pl-4 py-3 text-left">
                                                    {op.warehouseName}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <div className="flex justify-center">
                                                        <div
                                                            className={cn(
                                                                "w-5 h-5 rounded border flex items-center justify-center transition-all",
                                                                op.isCustomerPickup
                                                                    ? "bg-green-700 border-green-700 text-white"
                                                                    : "bg-white border-slate-300 hover:border-green-600",
                                                                isCheckboxDisabled
                                                                    ? "opacity-50 cursor-not-allowed"
                                                                    : "cursor-pointer"
                                                            )}
                                                            onClick={() => !isCheckboxDisabled && handleTogglePickup(index)}
                                                        >
                                                            {op.isCustomerPickup && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-left w-[40%]">
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {op.pickSlips && op.pickSlips.length > 0 ? (
                                                            op.pickSlips.map((slip) => (
                                                                <span
                                                                    key={slip}
                                                                    className="px-2 py-0.5 bg-slate-100 rounded-md text-[10px] font-medium text-slate-600 border border-slate-200"
                                                                    title={slip}
                                                                >
                                                                    {slip}
                                                                </span>
                                                            ))
                                                        ) : (
                                                            <span className="text-muted-foreground">-</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <span className={cn(
                                                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase border tracking-wide",
                                                        isPending && "bg-orange-100 text-orange-700 border-orange-200",
                                                        isDone && "bg-green-100 text-green-700 border-green-200",
                                                        !isPending && !isDone && "bg-slate-100 text-slate-600 border-slate-200"
                                                    )}>
                                                        {op.status || 'Draft'}
                                                    </span>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                    {operationsList.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-24 text-center text-muted-foreground italic">
                                                Select a delivery warehouse to begin
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </div>
                </div>

                <div className="p-4 border-t bg-white flex justify-end gap-3">
                    <Button variant="outline" onClick={onClose} className="bg-gray-100 hover:bg-gray-200 border-none text-gray-700">
                        Cancel
                    </Button>
                    <Button
                        onClick={handleAssign}
                        disabled={!isValid || isAssigning}
                        className="bg-slate-200 text-slate-900 hover:bg-slate-300 min-w-[100px] border border-slate-300"
                    >
                        {isAssigning ? (
                            <div className="w-4 h-4 border-2 border-slate-600 border-t-transparent rounded-full animate-spin mr-2" />
                        ) : (
                            <Check className="w-4 h-4 mr-2" />
                        )}
                        {isAssigning ? 'Assigning...' : 'Assign'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
