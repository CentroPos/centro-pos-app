import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@renderer/components/ui/dialog';
import { Button } from '@renderer/components/ui/button';
import { InvoiceItem, Picker, Warehouse } from '@renderer/types/picking';
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

interface AssignPickSlipModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedItems: InvoiceItem[];
    warehouses: Warehouse[];
    pickers: Picker[];
    onCreatePickSlip: (warehouseId: string, pickerId: string) => void;
}

export function AssignPickSlipModal({
    isOpen,
    onClose,
    selectedItems,
    warehouses,
    pickers,
    onCreatePickSlip,
}: AssignPickSlipModalProps) {
    const [selectedWarehouse, setSelectedWarehouse] = useState<string | null>(null);
    const [selectedPicker, setSelectedPicker] = useState<string | null>(null);
    const [startTime, setStartTime] = useState<Date | null>(null);
    const [pickedTime, setPickedTime] = useState<Date | null>(null);

    const categories = [...new Set(selectedItems.map((item) => item.category))];

    const handleStart = () => {
        setStartTime(new Date());
    };

    const handlePicked = () => {
        setPickedTime(new Date());
    };

    const handleCreate = () => {
        if (selectedWarehouse && selectedPicker) {
            onCreatePickSlip(selectedWarehouse, selectedPicker);
            resetAndClose();
        }
    };

    const resetAndClose = () => {
        setSelectedWarehouse(null);
        setSelectedPicker(null);
        setStartTime(null);
        setPickedTime(null);
        onClose();
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    };

    const getDuration = () => {
        if (startTime && pickedTime) {
            const diff = Math.floor((pickedTime.getTime() - startTime.getTime()) / 1000 / 60);
            return `${diff} Min`;
        }
        if (startTime) {
            const diff = Math.floor((new Date().getTime() - startTime.getTime()) / 1000 / 60);
            return `${diff}:${String(Math.floor((new Date().getTime() - startTime.getTime()) / 1000) % 60).padStart(2, '0')}`;
        }
        return '--:--';
    };

    return (
        <Dialog open={isOpen} onOpenChange={resetAndClose}>
            <DialogContent className="max-w-4xl p-0 gap-0 max-h-[90vh] flex flex-col">
                <DialogHeader className="p-6 pb-4">
                    <DialogTitle className="text-xl font-semibold">Assign Pick Slip</DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        Select warehouse and picker for {selectedItems.length} items
                    </DialogDescription>
                </DialogHeader>

                <div className="px-6 pb-6 space-y-5 flex-1 overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-2xl font-bold text-foreground">
                                {selectedItems.length} Items Selected
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                Categories: {categories.join(', ')}
                            </p>
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-semibold text-foreground mb-2 block">
                            Warehouse:
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {warehouses.map((warehouse) => (
                                <button
                                    key={warehouse.id}
                                    onClick={() => setSelectedWarehouse(warehouse.id)}
                                    className={cn(
                                        'px-4 py-2 rounded-full font-medium text-sm transition-all',
                                        selectedWarehouse === warehouse.id
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-secondary text-secondary-foreground hover:bg-secondary/60'
                                    )}
                                >
                                    {warehouse.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {selectedWarehouse && (
                        <div className="flex-1 min-h-0">
                            <label className="text-sm font-semibold text-foreground mb-2 block">
                                Items to Pick:
                            </label>
                            <ScrollArea className="h-[200px] border border-border rounded-lg">
                                <Table>
                                    <TableHeader className="bg-muted/50 sticky top-0">
                                        <TableRow>
                                            <TableHead className="w-12 text-xs font-semibold">Sl No</TableHead>
                                            <TableHead className="w-16 text-xs font-semibold">Inv Sl</TableHead>
                                            <TableHead className="text-xs font-semibold">Item</TableHead>
                                            <TableHead className="w-20 text-xs font-semibold">Category</TableHead>
                                            <TableHead className="w-14 text-xs font-semibold text-center">UOM</TableHead>
                                            <TableHead className="w-14 text-xs font-semibold text-right">Qty</TableHead>
                                            <TableHead className="w-20 text-xs font-semibold text-right">On-Hand</TableHead>
                                            <TableHead className="w-20 text-xs font-semibold text-right">In-Process</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {selectedItems.map((item, index) => (
                                            <TableRow key={item.id} className="text-sm">
                                                <TableCell className="py-2 text-muted-foreground">{index + 1}</TableCell>
                                                <TableCell className="py-2 font-medium">{item.slNo}</TableCell>
                                                <TableCell className="py-2">
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-foreground">{item.itemName}</span>
                                                        <span className="text-xs text-muted-foreground">{item.itemCode}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-2">
                                                    <span className="px-2 py-0.5 bg-secondary text-secondary-foreground rounded text-xs">
                                                        {item.category}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="py-2 text-center text-muted-foreground">{item.uom}</TableCell>
                                                <TableCell className="py-2 text-right font-semibold">{item.quantity}</TableCell>
                                                <TableCell className="py-2 text-right">
                                                    <span className={cn(
                                                        "font-medium",
                                                        item.onHand >= item.quantity ? "text-green-600" : "text-red-600"
                                                    )}>
                                                        {item.onHand}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="py-2 text-right">
                                                    <span className="text-yellow-600 font-medium">{item.inProcessQty}</span>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </div>
                    )}

                    <div>
                        <label className="text-sm font-semibold text-foreground mb-2 block">
                            Picker:
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {pickers.map((picker) => (
                                <button
                                    key={picker.id}
                                    onClick={() => setSelectedPicker(picker.id)}
                                    className={cn(
                                        'px-4 py-2 rounded-full font-medium text-sm transition-all',
                                        selectedPicker === picker.id
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-secondary text-secondary-foreground hover:bg-secondary/60'
                                    )}
                                >
                                    {picker.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-3 pt-4 border-t border-border">
                        <Button variant="secondary">
                            <Printer className="w-4 h-4 mr-1" />
                            Print Slip
                        </Button>

                        <div className="flex items-center gap-2 ml-auto">
                            <Button
                                variant={startTime ? 'secondary' : 'outline'}
                                onClick={handleStart}
                                disabled={!!startTime}
                            >
                                <Play className="w-4 h-4 mr-1" />
                                Start
                                {startTime && (
                                    <span className="text-xs ml-1">{formatTime(startTime)}</span>
                                )}
                            </Button>

                            <div className="flex items-center gap-1 px-3 py-2 bg-muted rounded-lg">
                                <Clock className="w-4 h-4 text-muted-foreground" />
                                <span className="text-xl font-bold tabular-nums">{getDuration()}</span>
                            </div>

                            <Button
                                variant={pickedTime ? 'default' : 'outline'}
                                onClick={handlePicked}
                                disabled={!startTime || !!pickedTime}
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
                            disabled={!selectedWarehouse || !selectedPicker}
                        >
                            <Check className="w-4 h-4 mr-1" />
                            Assign
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

