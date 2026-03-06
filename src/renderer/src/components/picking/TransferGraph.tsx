import { WarehouseOperation } from '@renderer/types/picking';
import { cn } from '@renderer/lib/utils';
import { ShoppingCart, Warehouse, ArrowRight } from 'lucide-react';

interface TransferGraphProps {
    operations: WarehouseOperation[];
    deliveryWarehouseId: string | null;
}

export function TransferGraph({ operations }: TransferGraphProps) {
    if (operations.length === 0) return null;

    const deliveryOp = operations[0];
    const sourceOps = operations.slice(1);

    const transferOps = sourceOps.filter(op => !op.isCustomerPickup);

    return (
        <div className="w-full h-48 bg-slate-50 border rounded-lg p-4 mb-4 flex items-center justify-around relative overflow-hidden">
            {/* Background Decor */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none flex items-center justify-center">
                <Warehouse className="w-64 h-64" />
            </div>

            <div className="flex flex-col gap-4 items-center justify-center flex-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">Source Warehouses</span>
                <div className="flex flex-col gap-3">
                    {sourceOps.length > 0 ? (
                        sourceOps.map((op, i) => (
                            <div key={op.warehouseId || i} className="flex items-center gap-4">
                                <div className={cn(
                                    "px-3 py-1.5 rounded-md border text-[11px] font-semibold flex items-center gap-2 transition-all shadow-sm",
                                    op.isCustomerPickup
                                        ? "bg-amber-50 border-amber-200 text-amber-700"
                                        : "bg-white border-slate-200 text-slate-700"
                                )}>
                                    <Warehouse className="w-3.5 h-3.5" />
                                    {op.warehouseName}
                                </div>

                                {!op.isCustomerPickup ? (
                                    <div className="flex items-center">
                                        <div className="h-[1px] w-8 bg-slate-300 relative">
                                            <ArrowRight className="w-3 h-3 absolute -right-1 -top-[5.5px] text-slate-400" />
                                        </div>
                                        <span className="text-[9px] text-slate-400 font-medium ml-1">Transfer</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center">
                                        <div className="h-[1px] w-8 bg-amber-100 relative">
                                            <ArrowRight className="w-3 h-3 absolute -right-1 -top-[5.5px] text-amber-300" />
                                        </div>
                                        <span className="text-[9px] text-amber-500 font-medium ml-1 italic">Direct</span>
                                    </div>
                                )}
                            </div>
                        ))
                    ) : (
                        <div className="text-[10px] text-slate-400 italic">No source warehouses</div>
                    )}
                </div>
            </div>

            <div className="flex flex-col items-center justify-center gap-6 px-4">
                <div className="flex flex-col items-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-3">Consolidation</span>
                    <div className={cn(
                        "p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all shadow-md bg-white",
                        transferOps.length > 0 ? "border-green-600 ring-4 ring-green-50" : "border-slate-200"
                    )}>
                        <Warehouse className={cn("w-6 h-6", transferOps.length > 0 ? "text-green-600" : "text-slate-400")} />
                        <span className="text-[12px] font-bold text-slate-800">{deliveryOp.warehouseName}</span>
                        <span className="text-[9px] text-slate-500 font-medium uppercase bg-slate-100 px-1.5 py-0.5 rounded">Delivery Hub</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center">
                <div className="flex flex-col items-center">
                    <div className="h-[1px] w-12 bg-green-500 relative flex items-center justify-center">
                        <ArrowRight className="w-4 h-4 absolute -right-1.5 -top-[7.5px] text-green-600" />
                    </div>
                    <span className="text-[9px] text-green-600 font-bold mt-1 uppercase tracking-tighter">Delivery</span>
                </div>
            </div>

            <div className="flex flex-col items-center justify-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-3">Customer</span>
                <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center shadow-lg border-4 border-white">
                    <ShoppingCart className="w-7 h-7 text-white" />
                </div>
            </div>
        </div>
    );
}
