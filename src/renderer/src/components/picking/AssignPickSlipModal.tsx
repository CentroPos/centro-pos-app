import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@renderer/components/ui/dialog';
import { Button } from '@renderer/components/ui/button';
import { InvoiceItem, PickSlip, Warehouse } from '@renderer/types/picking';
import { cn } from '@renderer/lib/utils';
import { Printer, Play, Check } from 'lucide-react';
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


interface AssignPickSlipModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedItems: InvoiceItem[];
    warehouses: Warehouse[];
    invoiceNo: string;
    existingPickSlip?: PickSlip | null;
    onSuccess?: () => void;
}

export function AssignPickSlipModal({
    isOpen,
    onClose,
    selectedItems,
    warehouses,
    invoiceNo,
    existingPickSlip,
    onSuccess
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


    // Filter pickers based on selected warehouse
    const availablePickers = selectedWarehouse
        ? warehouses.find(w => w.id === selectedWarehouse)?.pickers || []
        : [];

    useEffect(() => {
        if (isOpen) {
            if (existingPickSlip) {
                // Edit Mode initialization
                // Try to match warehouse by ID first, then by name
                const matchingWarehouse = warehouses.find(w => w.id === existingPickSlip.warehouseId || w.name === existingPickSlip.warehouseName || w.name === existingPickSlip.warehouseId);

                if (matchingWarehouse) {
                    setSelectedWarehouse(matchingWarehouse.id);

                    // Also try to match picker robustly from the matching warehouse's pickers
                    const pickers = matchingWarehouse.pickers || [];
                    const rawPickerValue = (existingPickSlip as any).pickerName || existingPickSlip.pickerId;

                    const matchingPicker = pickers.find(p =>
                        p.id === rawPickerValue ||
                        p.name === rawPickerValue ||
                        p.picker_no === rawPickerValue
                    );

                    // Fallback to existing ID if no match found (or if it's null)
                    setSelectedPicker(matchingPicker ? matchingPicker.id : (existingPickSlip.pickerId || rawPickerValue));
                } else {
                    // Fallback to direct ID if defined, but arguably we should always find match
                    setSelectedWarehouse(existingPickSlip.warehouseId);
                    setSelectedPicker(existingPickSlip.pickerId);
                }

                setStartTime(existingPickSlip.startTime ? new Date(existingPickSlip.startTime) : null);
                setPickedTime(existingPickSlip.endTime ? new Date(existingPickSlip.endTime) : null);
                setCreatedSlip(existingPickSlip);
            } else if (warehouses.length > 0 && !selectedWarehouse) {
                // New Mode default
                setSelectedWarehouse(warehouses[0].id);
            }
        }
    }, [isOpen, warehouses, existingPickSlip]);

    // Reset state on close or open
    useEffect(() => {
        if (isOpen) {
            setIsCreating(false);
            if (!existingPickSlip) {
                setCreatedSlip(null);
            }
        } else {
            resetState();
        }
    }, [isOpen, existingPickSlip]);

    // Reset picker and times when warehouse changes (ONLY IN CREATE MODE)
    useEffect(() => {
        if (!existingPickSlip && isOpen) {
            setSelectedPicker(null);
            setStartTime(null);
            setPickedTime(null);
        }
    }, [selectedWarehouse, existingPickSlip, isOpen]);

    // Reset times when picker changes to restart cycle (ONLY IN CREATE MODE)
    useEffect(() => {
        if (!existingPickSlip && isOpen) {
            setStartTime(null);
            setPickedTime(null);
        }
    }, [selectedPicker, existingPickSlip, isOpen]);


    useEffect(() => {
        const fetchAvailability = async () => {
            if (!isOpen || !selectedWarehouse || selectedItems.length === 0) return;

            setIsLoadingAvailability(true);
            try {
                // Get unique items for payload
                const uniqueItemsMap = new Map();
                selectedItems.forEach(item => {
                    if (!item.itemCode) return;
                    const key = `${item.itemCode}_${item.uom || ''}`;
                    if (!uniqueItemsMap.has(key)) {
                        uniqueItemsMap.set(key, { item_code: item.itemCode, uom: item.uom });
                    }
                });

                if (uniqueItemsMap.size === 0) {
                    setIsLoadingAvailability(false);
                    return;
                }

                console.log("Fetching availability for items:", Array.from(uniqueItemsMap.values()));

                const warehouseName = warehouses.find(w => w.id === selectedWarehouse)?.name;

                const res = await window.electronAPI?.proxy?.request({
                    url: '/api/method/centro_pos_apis.api.picking.get_item_availability',
                    method: 'POST',
                    data: {
                        warehouse: warehouseName,
                        items: Array.from(uniqueItemsMap.values())
                    }
                });

                // Check for data in 'message' (common in Frappe) or 'data'
                const data = res?.data?.message || res?.data?.data || [];
                const newMap: Record<string, any> = {};

                if (Array.isArray(data)) {
                    data.forEach((avail: any) => {
                        const key = `${avail.item_code}_${avail.uom}`;
                        newMap[key] = avail;
                    });
                }

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


    const formatApiDate = (d: Date) => {
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };

    // API: Assign Pick Slip (Create)
    const handleAssign = async () => {
        if (!selectedWarehouse) return;
        setIsCreating(true);

        const warehouse = warehouses.find(w => w.id === selectedWarehouse);
        const picker = availablePickers.find(p => p.id === selectedPicker);

        const payloadItems = selectedItems.map(item => ({
            serial_no: item.slNo,
            item_code: item.itemCode,
            quantity: item.quantity,
            uom: item.uom
        }));

        try {
            const res = await window.electronAPI?.proxy?.request({
                url: '/api/method/centro_pos_apis.api.picking.assign_pick_slip',
                method: 'POST',
                data: {
                    invoice_no: invoiceNo,
                    warehouse: warehouse?.name,
                    assigned_to: picker?.id || "",
                    items: payloadItems
                }
            });

            const data = res?.data?.data;
            if (data) {
                toast.success(data.message || "Pick slip assigned successfully");

                const newSlip: PickSlip = {
                    id: data.picking_no,
                    slipNo: data.picking_no,
                    invoiceId: invoiceNo, // we have invoiceNo prop
                    warehouseId: warehouse?.id || '',
                    warehouseName: data.warehouse,
                    pickerId: picker?.id || '',
                    pickerName: data.assigned_to || picker?.name || 'Unassigned',
                    items: [], // we could map from selectedItems but parent refresh handles it better? 
                    // Actually let's just keep minimal structure for UI display
                    status: 'not-started',
                    createdAt: new Date(),
                    print_url: data.picking_slip_url
                };

                setCreatedSlip(newSlip);
                if (onSuccess) onSuccess();
            }
        } catch (e: any) {
            console.error("Failed to assign pick slip", e);
            toast.error(e?.message || "Failed to assign pick slip");
        } finally {
            setIsCreating(false);
        }
    };

    // API: Update Pick Slip
    const handleUpdate = async (st: Date | null, et: Date | null) => {
        if (!createdSlip) return;

        // We set isCreating to true just to show spinner on the button if needed, 
        // or we can handle loading separately. Reusing isCreating for simplicity.
        setIsCreating(true);

        try {
            const payload = {
                pick_list_id: createdSlip.id,
                assigned_to: selectedPicker || '',
                start_time: selectedPicker ? (st ? formatApiDate(st) : "") : "",
                end_time: selectedPicker ? (et ? formatApiDate(et) : "") : ""
            };

            const res = await window.electronAPI?.proxy?.request({
                url: '/api/method/centro_pos_apis.api.picking.update_assign_pick_slip',
                method: 'POST',
                data: payload
            });

            const data = res?.data?.data;
            if (data) {
                toast.success(data.message || "Pick slip updated successfully");

                // Update local state
                setCreatedSlip(prev => prev ? ({
                    ...prev,
                    pickerId: selectedPicker || prev.pickerId, // Update picker locally
                    print_url: data.picking_slip_url,
                    status: et ? 'picked' : (st ? 'in-progress' : 'not-started'),
                    startTime: st || undefined,
                    endTime: et || undefined
                }) : null);

                if (onSuccess) onSuccess();
            }
        } catch (e: any) {
            console.error("Failed to update pick slip", e);
            toast.error(e?.message || "Failed to update pick slip");
        } finally {
            setIsCreating(false);
        }
    };

    // Start action (Local State Only)
    const handleStart = () => {
        if (!selectedPicker) return;
        setStartTime(new Date());
    };

    // Picked action (Local State Only)
    const handlePicked = () => {
        if (!startTime) return;
        setPickedTime(new Date());
    };

    const handleClearStart = () => {
        setStartTime(null);
        setPickedTime(null); // Clear end time if start is cleared
    };

    const handleClearEnd = () => {
        setPickedTime(null);
    };

    const toLocalISO = (d: Date) => {
        const offset = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - offset).toISOString().slice(0, 16);
    };

    const handleDateChange = (type: 'start' | 'end', val: string) => {
        if (!val) return;
        const d = new Date(val);
        if (isNaN(d.getTime())) return;

        if (type === 'start') {
            setStartTime(d);
            // If new start is after end, clear end? Or let user fix.
            if (pickedTime && d > pickedTime) setPickedTime(null);
        } else {
            setPickedTime(d);
        }
    };

    // Manual update or Assign action (Bottom Right Button)
    const handleMainAction = async () => {
        if (createdSlip) {
            await handleUpdate(startTime, pickedTime);
        } else {
            await handleAssign();
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
                        {createdSlip && (
                            <div className="col-span-2 bg-blue-50/50 border border-blue-100 rounded-lg p-3 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div>
                                        <p className="text-[10px] uppercase text-muted-foreground font-semibold">Pick Slip ID</p>
                                        <p className="text-sm font-bold text-foreground">{createdSlip.slipNo}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase text-muted-foreground font-semibold">Current Status</p>
                                        <div className={cn(
                                            "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide",
                                            createdSlip.status === 'not-started' && "bg-red-100 text-red-700",
                                            createdSlip.status === 'in-progress' && "bg-orange-100 text-orange-700",
                                            (createdSlip.status === 'picked' || createdSlip.status === 'Completed') && "bg-green-100 text-green-700"
                                        )}>
                                            {createdSlip.status}
                                        </div>
                                    </div>
                                </div>
                                {createdSlip.assignedBy && (
                                    <div className="text-right">
                                        <p className="text-[10px] uppercase text-muted-foreground font-semibold">Assigned By</p>
                                        <p className="text-xs font-medium text-foreground">{createdSlip.assignedBy}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Select Warehouse</label>
                            <div className="flex flex-wrap gap-2">
                                {warehouses
                                    .filter(w => !w.is_delivery_warehouse)
                                    .map((warehouse) => {
                                        const isSelected = selectedWarehouse === warehouse.id;
                                        const isDisabled = !!existingPickSlip || !!createdSlip;

                                        return (
                                            <Button
                                                key={warehouse.id}
                                                variant="outline"
                                                onClick={() => !isDisabled && setSelectedWarehouse(warehouse.id)}
                                                disabled={isDisabled && !isSelected}
                                                className={cn(
                                                    "h-8 rounded-full px-4 text-xs font-medium border transition-all",
                                                    isSelected
                                                        ? "bg-green-700 hover:bg-green-800 text-white border-green-700 shadow-sm"
                                                        : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200",
                                                    !isSelected && isDisabled && "opacity-40"
                                                )}
                                            >
                                                {warehouse.name}
                                            </Button>
                                        );
                                    })}
                            </div>
                        </div>

                        {selectedWarehouse && (
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Select Picker (Optional)</label>
                                <div className="flex flex-wrap gap-2">
                                    {availablePickers.length > 0 ? availablePickers.map((picker) => {
                                        const isSelected = selectedPicker === picker.id;
                                        return (
                                            <Button
                                                key={picker.id}
                                                variant="outline"
                                                onClick={() => setSelectedPicker(prev => prev === picker.id ? null : picker.id)}
                                                className={cn(
                                                    "h-8 rounded-full px-4 text-xs font-medium border transition-all",
                                                    isSelected
                                                        ? "bg-green-700 hover:bg-green-800 text-white border-green-700 shadow-sm"
                                                        : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
                                                )}
                                            >
                                                <span className="mr-1">{picker.name}</span>
                                                <span className="opacity-70 text-[10px]">({picker.picker_no})</span>
                                            </Button>
                                        );
                                    }) : (
                                        <div className="text-xs text-muted-foreground italic px-2">
                                            No pickers available in this warehouse.
                                        </div>
                                    )}
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
                                <TableHeader className="sticky top-0 bg-slate-100 z-10 text-xs border-b border-slate-200 shadow-sm">
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="w-[50px] font-bold text-center text-slate-700">SL No</TableHead>
                                        <TableHead className="w-[80px] font-bold text-center text-slate-700">INV SL NO</TableHead>
                                        <TableHead className="w-[300px] font-bold text-left text-slate-700 pl-4">ITEM</TableHead>
                                        <TableHead className="w-[120px] font-bold text-center text-slate-700">CATEGORY</TableHead>
                                        <TableHead className="w-[80px] font-bold text-center text-slate-700">UOM</TableHead>
                                        <TableHead className="w-[80px] font-bold text-center text-slate-700">QUANTITY</TableHead>
                                        <TableHead className="w-[100px] font-bold text-center text-slate-700">ON-HAND QTY</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {selectedItems.map((item, index) => {
                                        const availKey = `${item.itemCode}_${item.uom}`;
                                        const availability = availabilityMap[availKey];
                                        const stockQty = availability ? availability.onhand_qty : null;
                                        const hasStock = stockQty !== null ? stockQty >= item.quantity : true;

                                        return (
                                            <TableRow key={item.id} className={cn("text-xs transition-colors border-b last:border-0", !hasStock ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-muted/50')}>
                                                <TableCell className="text-center text-muted-foreground font-medium">{index + 1}</TableCell>
                                                <TableCell className="text-center font-medium">{item.slNo || '-'}</TableCell>
                                                <TableCell className="py-2" title={item.itemName}>
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="font-semibold text-foreground text-xs">{item.itemName}</span>
                                                        <span className="text-[10px] text-muted-foreground truncate max-w-[280px] leading-tight">{item.itemPartNo || item.itemCode}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center text-muted-foreground">{item.category || '-'}</TableCell>
                                                <TableCell className="text-center font-medium">{item.uom}</TableCell>
                                                <TableCell className="text-center font-bold">{item.quantity}</TableCell>
                                                <TableCell className={cn("text-center font-bold", !hasStock ? "text-red-600" : "text-green-600")}>
                                                    {isLoadingAvailability ? (
                                                        <div className="flex justify-center">
                                                            <span className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                                                        </div>
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

                    <div className="relative flex items-center justify-center pt-4 border-t border-border mt-auto">
                        <div className="absolute left-0">
                            <Button
                                variant="secondary"
                                onClick={async () => {
                                    if (createdSlip?.print_url) {
                                        try {
                                            const response = await fetch(createdSlip.print_url);
                                            console.log('SHD ==> [PRINT]', createdSlip.print_url);
                                            console.log('SHD ==> [PRINT => response]', response);
                                            const blob = await response.blob();
                                            console.log('SHD ==> [PRINT => blob]', blob);
                                            if (blob) {
                                                const reader = new FileReader();
                                                reader.onloadend = async () => {
                                                    const base64data = reader.result as string;
                                                    console.log('SHD ==> [PRINT => base64]', base64data.substring(0, 50) + '...');

                                                    // Try using the dedicated printPDF method first (like in right-panel)
                                                    if (window.electronAPI?.print?.printPDF) {
                                                        await window.electronAPI.print.printPDF(base64data);
                                                    }
                                                    // Fallback to proxy print if available
                                                    else if ((window.electronAPI?.proxy as any)?.print) {
                                                        await (window.electronAPI?.proxy as any)?.print({
                                                            url: base64data,
                                                            silent: false
                                                        });
                                                    }
                                                };
                                                reader.readAsDataURL(blob);
                                            } else {
                                                toast.error("Failed to download print file");
                                            }
                                        } catch (error) {
                                            console.error("Print failed", error);
                                            toast.error("Failed to print pick slip");
                                        }
                                    } else {
                                        toast.error("No print URL available");
                                    }
                                }}
                                disabled={!createdSlip?.print_url}
                            >
                                <Printer className="w-4 h-4 mr-1" />
                                Print Slip
                            </Button>
                        </div>

                        {/* Centered Time Controls */}
                        <div className={cn(
                            "flex items-center gap-4 bg-muted/30 p-1.5 rounded-lg border transition-all duration-200",
                            (!createdSlip || !selectedPicker) && "opacity-50 pointer-events-none grayscale"
                        )}>
                            {/* Start Section */}
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[9px] uppercase font-bold text-muted-foreground px-1">Start Time</span>
                                <div className="flex items-center gap-1">
                                    {!startTime ? (
                                        <Button
                                            size="sm"
                                            className="h-8 bg-green-600 hover:bg-green-700 text-white"
                                            onClick={handleStart}
                                            disabled={!selectedPicker}
                                            title={!selectedPicker ? "Select a picker first" : "Start Picking"}
                                        >
                                            <Play className="w-3 h-3 mr-1.5" />
                                            Start
                                        </Button>
                                    ) : (
                                        <div className="flex items-center bg-white border rounded-md overflow-hidden h-8">
                                            <input
                                                type="datetime-local"
                                                value={toLocalISO(startTime)}
                                                onChange={(e) => handleDateChange('start', e.target.value)}
                                                className="h-full border-none text-xs px-2 focus:ring-0 w-[140px]"
                                            />
                                            <button
                                                onClick={handleClearStart}
                                                className="h-full px-2 hover:bg-red-50 text-gray-400 hover:text-red-500 border-l"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Timer Display */}
                            <div className="flex flex-col items-center justify-center min-w-[80px] px-2">
                                <span className="text-[9px] uppercase font-bold text-muted-foreground mb-0.5">Duration</span>
                                <div className={cn(
                                    "font-mono text-lg font-bold leading-none tabular-nums",
                                    !startTime ? "text-muted-foreground/30" :
                                        (pickedTime ? "text-green-600" : "text-blue-600")
                                )}>
                                    {getDuration()}
                                </div>
                            </div>

                            {/* End Section */}
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[9px] uppercase font-bold text-muted-foreground px-1">End Time</span>
                                <div className="flex items-center gap-1">
                                    {!pickedTime ? (
                                        <Button
                                            size="sm"
                                            variant={startTime ? "default" : "outline"}
                                            className={cn("h-8", startTime && "bg-blue-600 hover:bg-blue-700 text-white")}
                                            onClick={handlePicked}
                                            disabled={!startTime}
                                        >
                                            <Check className="w-3 h-3 mr-1.5" />
                                            End
                                        </Button>
                                    ) : (
                                        <div className="flex items-center bg-white border rounded-md overflow-hidden h-8">
                                            <input
                                                type="datetime-local"
                                                value={toLocalISO(pickedTime)}
                                                onChange={(e) => handleDateChange('end', e.target.value)}
                                                className="h-full border-none text-xs px-2 focus:ring-0 w-[140px]"
                                            />
                                            <button
                                                onClick={handleClearEnd}
                                                className="h-full px-2 hover:bg-red-50 text-gray-400 hover:text-red-500 border-l"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="absolute right-0">
                            <Button
                                variant="default"
                                onClick={handleMainAction}
                                // Logic: Create (Assign) if !createdSlip. Update if createdSlip.
                                // Disabled if no warehouse selected (for Create) OR isCreating.
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
                </div>
            </DialogContent>
        </Dialog>
    );
}
