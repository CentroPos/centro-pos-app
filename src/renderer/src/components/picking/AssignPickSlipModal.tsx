import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@renderer/components/ui/dialog';
import { Button } from '@renderer/components/ui/button';
import { InvoiceItem, PickSlip, Warehouse } from '@renderer/types/picking';
import { cn } from '@renderer/lib/utils';
import { Printer, Play, Check, Clock } from 'lucide-react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@renderer/components/ui/table';
import { ScrollArea } from '@renderer/components/ui/scroll-area';
import { toast } from 'sonner';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from '@renderer/components/ui/select';

interface AssignPickSlipModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedItems: InvoiceItem[];
    warehouses: Warehouse[];
    onCreatePickSlip: (warehouseId: string, pickerId: string | null, startTime: Date | null, endTime: Date | null) => Promise<PickSlip | null>;
}

export function AssignPickSlipModal({
    isOpen,
    onClose,
    selectedItems,
    warehouses,
    onCreatePickSlip,
}: AssignPickSlipModalProps) {
    const [selectedWarehouse, setSelectedWarehouse] = useState<string | null>(null);
    const [selectedPicker, setSelectedPicker] = useState<string | null>(null);
    const [startTime, setStartTime] = useState<Date | null>(null);
    const [pickedTime, setPickedTime] = useState<Date | null>(null);
    const [availabilityMap, setAvailabilityMap] = useState<Record<string, any>>({});
    const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
    const [createdSlip, setCreatedSlip] = useState<PickSlip | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    const categories = [...new Set(selectedItems.map((item) => item.category))];
    const durations = [2, 4, 6, 8, 10, 15, 20, 25, 30];

    // Filter pickers based on selected warehouse
    const availablePickers = selectedWarehouse
        ? warehouses.find(w => w.id === selectedWarehouse)?.pickers || []
        : [];

    useEffect(() => {
        if (isOpen && warehouses.length > 0 && !selectedWarehouse) {
            setSelectedWarehouse(warehouses[0].id);
        }
    }, [isOpen, warehouses]);

    // Reset state on close or open
    useEffect(() => {
        if (isOpen) {
            setCreatedSlip(null);
            setIsCreating(false);
        } else {
            resetState();
        }
    }, [isOpen]);

    // Reset picker and times when warehouse changes
    useEffect(() => {
        setSelectedPicker(null);
        setStartTime(null);
        setPickedTime(null);
    }, [selectedWarehouse]);

    // Reset times when picker changes to restart cycle
    useEffect(() => {
        setStartTime(null);
        setPickedTime(null);
    }, [selectedPicker]);


    useEffect(() => {
        const fetchAvailability = async () => {
            if (!isOpen || !selectedWarehouse || selectedItems.length === 0) return;

            setIsLoadingAvailability(true);
            try {
                // Get unique items for payload
                const uniqueItemsMap = new Map();
                selectedItems.forEach(item => {
                    const key = `${item.itemCode}_${item.uom}`;
                    if (!uniqueItemsMap.has(key)) {
                        uniqueItemsMap.set(key, { item_code: item.itemCode, uom: item.uom });
                    }
                });

                const warehouseName = warehouses.find(w => w.id === selectedWarehouse)?.name;

                const res = await window.electronAPI?.proxy?.request({
                    url: '/api/method/centro_pos_apis.api.picking.get_item_availability',
                    method: 'POST',
                    data: {
                        warehouse: warehouseName,
                        items: Array.from(uniqueItemsMap.values())
                    }
                });

                const data = res?.data?.data || [];
                const newMap: Record<string, any> = {};

                data.forEach((avail: any) => {
                    const key = `${avail.item_code}_${avail.uom}`;
                    newMap[key] = avail;
                });

                setAvailabilityMap(newMap);

            } catch (e) {
                console.error("Failed to fetch item availability", e);
                toast.error("Failed to fetch item availability");
            } finally {
                setIsLoadingAvailability(false);
            }
        };

        fetchAvailability();
    }, [isOpen, selectedWarehouse, selectedItems]);

    // Start action: Set start time + Update API
    const handleStart = async () => {
        if (!selectedWarehouse || !selectedPicker) return;
        const now = new Date();
        setStartTime(now);

        setIsCreating(true);
        const slip = await onCreatePickSlip(selectedWarehouse, selectedPicker, now, null);
        setIsCreating(false);
        if (slip) setCreatedSlip(slip);
    };

    // Picked action: Set end time + Update API
    const handlePicked = async () => {
        if (!selectedWarehouse || !selectedPicker || !startTime) return;
        const now = new Date();
        setPickedTime(now);

        setIsCreating(true);
        const slip = await onCreatePickSlip(selectedWarehouse, selectedPicker, startTime, now);
        setIsCreating(false);
        if (slip) setCreatedSlip(slip);
    };

    const handleDurationUpdate = async (minutesStr: string) => {
        if (!startTime || !selectedWarehouse || !selectedPicker) {
            toast.error("Please start the picking first");
            return;
        }

        const minutes = parseInt(minutesStr);
        if (isNaN(minutes)) return;

        const newEndTime = new Date(startTime.getTime() + minutes * 60000);
        setPickedTime(newEndTime);

        setIsCreating(true);
        const slip = await onCreatePickSlip(selectedWarehouse, selectedPicker, startTime, newEndTime);
        setIsCreating(false);
        if (slip) {
            setCreatedSlip(slip);
            toast.success(`Updated picking duration to ${minutes} mins`);
        }
    };

    // Manual update or Assign action
    const handleCreate = async () => {
        if (selectedWarehouse) {
            setIsCreating(true);
            const slip = await onCreatePickSlip(selectedWarehouse, selectedPicker, startTime, pickedTime);
            setIsCreating(false);
            if (slip) {
                setCreatedSlip(slip);
            }
        }
    };

    const handlePrint = async () => {
        if (createdSlip?.print_url) {
            try {
                await (window.electronAPI?.proxy as any)?.print({
                    url: createdSlip.print_url,
                    silent: false
                });
            } catch (error) {
                console.error("Print failed", error);
                toast.error("Failed to print pick slip");
            }
        } else {
            toast.error("No print URL available");
        }
    };

    const resetState = () => {
        setSelectedWarehouse(null);
        setSelectedPicker(null);
        setStartTime(null);
        setPickedTime(null);
        setAvailabilityMap({});
        setCreatedSlip(null);
    };

    const resetAndClose = () => {
        resetState();
        onClose();
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    const getDuration = () => {
        if (!startTime) return '00:00';
        const end = pickedTime || new Date();
        const diff = Math.max(0, Math.floor((end.getTime() - startTime.getTime()) / 1000));
        const minutes = Math.floor(diff / 60);
        const seconds = diff % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    // Update duration timer every second if started but not picked
    useEffect(() => {
        if (startTime && !pickedTime) {
            const timer = setInterval(() => {
                // Force re-render
                setTick(t => t + 1);
            }, 1000);
            return () => clearInterval(timer);
        }
        return;
    }, [startTime, pickedTime]);

    const [, setTick] = useState(0);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && resetAndClose()}>
            <DialogContent className="!w-[60%] !max-w-[60%] max-h-[90vh] flex flex-col p-0 gap-0">
                <div className="p-6 pb-2">
                    <DialogHeader>
                        <DialogTitle>Assign Pick Slip</DialogTitle>
                        <DialogDescription>
                            Create and assign pick slips for warehouse operations
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-2 gap-4 mt-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Select Warehouse</label>
                            <div className="flex flex-wrap gap-2">
                                {warehouses.map((warehouse) => (
                                    <Button
                                        key={warehouse.id}
                                        variant={selectedWarehouse === warehouse.id ? 'default' : 'outline'}
                                        onClick={() => setSelectedWarehouse(warehouse.id)}
                                        className="h-auto py-2 px-3"
                                    >
                                        <div className="flex flex-col items-start gap-0.5">
                                            <span className="font-semibold">{warehouse.name}</span>
                                            {/* Removed code as it might not be in type */}
                                        </div>
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {selectedWarehouse && availablePickers.length > 0 && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Select Picker (Optional)</label>
                                <div className="flex flex-wrap gap-2">
                                    {availablePickers.map((picker) => (
                                        <Button
                                            key={picker.id}
                                            variant={selectedPicker === picker.id ? 'default' : 'outline'}
                                            onClick={() => setSelectedPicker(prev => prev === picker.id ? null : picker.id)}
                                            className="h-auto py-2 px-3"
                                        >
                                            <div className="flex flex-col items-start gap-0.5">
                                                <span className="font-semibold">{picker.name}</span>
                                                <span className="text-[10px] opacity-80">{picker.picker_no}</span>
                                            </div>
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-hidden px-6">
                    <div className="border rounded-lg h-full flex flex-col">
                        <div className="bg-muted/50 p-2 border-b flex items-center justify-between">
                            <div className="text-sm font-medium flex items-center gap-2">
                                Items Selected:
                                <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-bold">
                                    {selectedItems.length}
                                </span>
                            </div>
                            {selectedItems.length > 0 && (
                                <div className="flex gap-2 text-xs text-muted-foreground">
                                    {categories.map(cat => (
                                        <span key={cat} className="px-2 py-0.5 bg-background border rounded">
                                            {cat}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        <ScrollArea className="flex-1">
                            <Table>
                                <TableHeader className="sticky top-0 bg-background z-10">
                                    <TableRow>
                                        <TableHead className="w-[100px]">Item Code</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead className="w-[80px]">UOM</TableHead>
                                        <TableHead className="text-right w-[80px]">Qty</TableHead>
                                        <TableHead className="w-[100px] text-right">Stock</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {selectedItems.map((item) => {
                                        const availKey = `${item.itemCode}_${item.uom}`;
                                        const availability = availabilityMap[availKey];
                                        const stockQty = availability ? availability.actual_qty : null;
                                        const hasStock = stockQty !== null ? stockQty >= item.quantity : true;

                                        return (
                                            <TableRow key={item.id} className={!hasStock ? 'bg-red-50 hover:bg-red-100' : ''}>
                                                <TableCell className="font-medium">{item.itemCode}</TableCell>
                                                <TableCell className="max-w-[200px] truncate" title={item.itemName}>
                                                    {item.itemName}
                                                </TableCell>
                                                <TableCell>{item.uom}</TableCell>
                                                <TableCell className="text-right">{item.quantity}</TableCell>
                                                <TableCell className={cn("text-right", !hasStock && "text-red-600 font-bold")}>
                                                    {isLoadingAvailability ? (
                                                        <span className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin inline-block" />
                                                    ) : (
                                                        stockQty !== null ? stockQty : '-'
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </div>
                </div>

                <div className="p-6 pt-2 bg-background border-t">
                    {selectedWarehouse && availablePickers.length === 0 && (
                        <div className="mb-4 p-3 bg-yellow-50 text-yellow-800 rounded-md text-sm border border-yellow-200 flex items-center gap-2">
                            <span>⚠️ No pickers assigned to this warehouse. You can assign the invoice to the warehouse directly.</span>
                        </div>
                    )}


                    <div className="flex items-center gap-3 pt-4 border-t border-border">
                        <Button
                            variant="secondary"
                            onClick={handlePrint}
                            disabled={!createdSlip?.print_url}
                        >
                            <Printer className="w-4 h-4 mr-1" />
                            Print Slip
                        </Button>

                        <div className="flex items-center gap-2 ml-auto">
                            {/* Always show Start/picked controls to allow updates */}
                            <Button
                                variant={startTime ? 'secondary' : 'outline'}
                                onClick={handleStart}
                                disabled={!!startTime && !createdSlip}
                            >
                                <Play className="w-4 h-4 mr-1" />
                                {createdSlip && startTime ? 'Update Start' : 'Start'}
                                {startTime && (
                                    <span className="text-xs ml-1">{formatTime(startTime)}</span>
                                )}
                            </Button>

                            <Select
                                disabled={!startTime}
                                onValueChange={handleDurationUpdate}
                            >
                                <SelectTrigger
                                    className="h-10 px-3 py-2 bg-muted rounded-lg border-none hover:bg-muted/80 transition-colors gap-2 w-auto min-w-[100px]"
                                >
                                    <Clock className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-xl font-bold tabular-nums text-foreground">{getDuration()}</span>
                                </SelectTrigger>
                                <SelectContent align="end">
                                    <div className="p-2 text-xs text-muted-foreground font-medium">Set Duration (mins)</div>
                                    {durations.map(d => (
                                        <SelectItem key={d} value={d.toString()}>{d} mins</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Button
                                variant={pickedTime ? 'default' : 'outline'}
                                onClick={handlePicked}
                                disabled={(!startTime || !!pickedTime) && !createdSlip}
                            >
                                <Check className="w-4 h-4 mr-1" />
                                Picked
                                {pickedTime && (
                                    <span className="text-xs ml-1">{formatTime(pickedTime)}</span>
                                )}
                            </Button>
                        </div>

                        <Button
                            variant="default"
                            onClick={handleCreate}
                            disabled={!selectedWarehouse || isCreating}
                        >
                            {isCreating ? (
                                <span className="animate-spin mr-2">⏳</span>
                            ) : (
                                <Check className="w-4 h-4 mr-1" />
                            )}
                            {createdSlip ? 'Update' : 'Assign'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
