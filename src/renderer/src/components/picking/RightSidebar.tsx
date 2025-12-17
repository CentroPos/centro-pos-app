import { WarehouseOperation, PickSlip, OrderQueueItem, Invoice } from '@renderer/types/picking';
import { cn } from '@renderer/lib/utils';
import { OrderQueueTab } from './OrderQueueTab';
import { SalesTab } from './SalesTab';

interface RightSidebarProps {
    activeTab: 'details' | 'sales' | 'queue';
    onTabChange: (tab: 'details' | 'sales' | 'queue') => void;
    operations: WarehouseOperation[];
    pickSlips: PickSlip[];
    onManageOperations: () => void;
    onPickSlipClick?: (pickSlip: PickSlip) => void;
    orderQueue: OrderQueueItem[];
    onSelectQueueOrder: (item: OrderQueueItem) => void;
    onRemoveQueueOrder: (id: string) => void;
    invoices?: Invoice[];
    onSelectInvoice?: (invoice: Invoice) => void;
}

export function RightSidebar({
    activeTab,
    onTabChange,
    operations,
    pickSlips,
    onManageOperations,
    onPickSlipClick,
    orderQueue,
    onSelectQueueOrder,
    onRemoveQueueOrder,
    invoices = [],
    onSelectInvoice,
}: RightSidebarProps) {
    const getStatusLabel = (status: PickSlip['status']) => {
        switch (status) {
            case 'not-started':
                return 'Not Started';
            case 'in-progress':
                return 'In Progress';
            case 'picked':
                return 'Picked';
            default:
                return status;
        }
    };

    const hasPickSlips = pickSlips.length > 0;

    return (
        <div className="w-[450px] border-l border-border bg-card flex flex-col flex-shrink-0 h-full">
            <div className="flex border-b border-border flex-shrink-0">
                <button
                    onClick={() => onTabChange('details')}
                    className={cn(
                        'flex-1 px-4 py-2.5 text-sm font-medium transition-colors border-b-2',
                        activeTab === 'details'
                            ? 'text-primary border-primary'
                            : 'text-muted-foreground border-transparent hover:text-foreground'
                    )}
                >
                    Details
                </button>
                <button
                    onClick={() => onTabChange('sales')}
                    className={cn(
                        'flex-1 px-4 py-2.5 text-sm font-medium transition-colors border-b-2',
                        activeTab === 'sales'
                            ? 'text-primary border-primary'
                            : 'text-muted-foreground border-transparent hover:text-foreground'
                    )}
                >
                    Sales
                </button>
                <button
                    onClick={() => onTabChange('queue')}
                    className={cn(
                        'flex-1 px-4 py-2.5 text-sm font-medium transition-colors relative border-b-2',
                        activeTab === 'queue'
                            ? 'text-primary border-primary'
                            : 'text-muted-foreground border-transparent hover:text-foreground'
                    )}
                >
                    Queue
                    {orderQueue.length > 0 && (
                        <span className="absolute top-1 right-2 w-5 h-5 rounded-full bg-green-600 text-white text-xs flex items-center justify-center">
                            {orderQueue.length}
                        </span>
                    )}
                </button>
            </div>

            <div className="flex-1 overflow-auto">
                {activeTab === 'details' && (
                    <div className="p-4 space-y-6">
                        {hasPickSlips && (
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="font-semibold text-foreground">Warehouse Operations</h3>
                                    <button
                                        onClick={onManageOperations}
                                        className="text-sm text-primary hover:underline"
                                    >
                                        Manage
                                    </button>
                                </div>
                                <div className="border border-border rounded-lg overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted">
                                            <tr>
                                                <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                                                    Warehouse
                                                </th>
                                                <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                                                    Type
                                                </th>
                                                <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                                                    Status
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {operations.map((op) => (
                                                <tr key={op.warehouseId} className="border-t border-border">
                                                    <td className="px-3 py-2 text-foreground">{op.warehouseName}</td>
                                                    <td className="px-3 py-2 text-muted-foreground">
                                                        {op.isCustomerPickup ? 'Pickup' : 'Transfer'}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <span className={cn(
                                                            "px-2 py-1 rounded-full text-xs",
                                                            op.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                                                        )}>
                                                            {op.status === 'draft' ? 'Draft' : 'Confirmed'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        <div>
                            <h3 className="font-semibold text-foreground mb-3">Picking Slips</h3>
                            <div className="space-y-2">
                                {pickSlips.map((originalSlip, index) => {
                                    // --- DUMMY CODE FOR UI TESTING ---
                                    const slip = { ...originalSlip };
                                    if (index === 0) {
                                        slip.status = 'not-started';
                                        slip.assignedBy = 'System Admin';
                                        slip.assignedOn = new Date();
                                    } else if (index === 1) {
                                        slip.status = 'in-progress';
                                        slip.startTime = new Date(new Date().getTime() - 15 * 60000); // Started 15 mins ago
                                    } else if (index === 2) {
                                        slip.status = 'picked';
                                        slip.endTime = new Date();
                                        slip.durationMinutes = 12;
                                    }
                                    // ----------------------------------

                                    /* Helper to format date: DD/MM/YYYY hh:mm AM/PM */
                                    const formatDateTime = (date?: Date) => {
                                        if (!date) return { date: '-', time: '-' };
                                        const d = new Date(date);
                                        const dateStr = d.toLocaleDateString('en-GB'); // DD/MM/YYYY
                                        const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
                                        return { date: dateStr, time: timeStr };
                                    };

                                    const isDraft = slip.status === 'not-started';
                                    const isStarted = slip.status === 'in-progress';
                                    const isPicked = slip.status === 'picked' || slip.status === 'Completed';

                                    // Determine background color based on status
                                    let statusBg = 'bg-gray-100 border-gray-200';
                                    if (isDraft) statusBg = 'bg-red-50 border-red-100 hover:bg-red-100/50';
                                    if (isStarted) statusBg = 'bg-orange-50 border-orange-100 hover:bg-orange-100/50';
                                    if (isPicked) statusBg = 'bg-green-50 border-green-100 hover:bg-green-100/50';

                                    /* Status Badge Colors */
                                    const badgeClass = cn(
                                        "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide mb-1 inline-block text-center w-full",
                                        isDraft && "bg-red-100 text-red-700",
                                        isStarted && "bg-orange-100 text-orange-700",
                                        isPicked && "bg-green-100 text-green-700"
                                    );

                                    return (
                                        <div
                                            key={slip.id}
                                            onClick={() => onPickSlipClick?.(slip)}
                                            className={cn(
                                                "p-3 border rounded-lg cursor-pointer transition-all group",
                                                statusBg
                                            )}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                {/* Left Side: Info */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-baseline justify-between mb-1">
                                                        <p className="font-bold text-foreground text-sm">{slip.slipNo}</p>
                                                    </div>

                                                    <div className="text-xs text-muted-foreground space-y-1.5 mt-0.5">
                                                        <p className="font-medium text-foreground truncate">{slip.warehouseName}</p>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 font-semibold border-b-2">
                                                                {slip.pickerName}
                                                            </span>
                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-semibold border-b-2">
                                                                {slip.items.length} Items
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Draft Info */}
                                                    {isDraft && slip.assignedBy && (
                                                        <div className="mt-2 pt-2 border-t border-red-100/50 text-[10px] text-red-600/80 truncate">
                                                            Assigned by {slip.assignedBy} on {slip.assignedOn ? (() => {
                                                                const { date, time } = formatDateTime(slip.assignedOn);
                                                                return `${date} ${time}`;
                                                            })() : ''}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Right Side: Status & Time */}
                                                <div className="flex flex-col items-end shrink-0 w-24">
                                                    <span className={badgeClass}>
                                                        {getStatusLabel(slip.status)}
                                                    </span>

                                                    <div className="text-right space-y-0.5 pr-1">

                                                        {isStarted && slip.startTime && (() => {
                                                            const { date, time } = formatDateTime(slip.startTime);
                                                            return (
                                                                <>
                                                                    <p className="text-[11px] font-medium text-foreground">{date}</p>
                                                                    <p className="text-[11px] text-muted-foreground">{time}</p>
                                                                </>
                                                            );
                                                        })()}

                                                        {isPicked && slip.endTime && (() => {
                                                            const { date, time } = formatDateTime(slip.endTime);
                                                            return (
                                                                <>
                                                                    <p className="text-[11px] font-medium text-foreground">{date}</p>
                                                                    <p className="text-[11px] text-muted-foreground">{time}</p>
                                                                    {slip.durationMinutes !== undefined && (
                                                                        <p className="text-xs font-bold text-green-700 mt-1">
                                                                            {slip.durationMinutes} Min
                                                                        </p>
                                                                    )}
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {pickSlips.length === 0 && (
                                    <div className="p-4 text-center text-muted-foreground text-sm border border-dashed border-border rounded-lg">
                                        No pick slips created yet
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'sales' && (
                    <SalesTab onSelectInvoice={onSelectInvoice} />
                )}

                {activeTab === 'queue' && (
                    <OrderQueueTab
                        orderQueue={orderQueue}
                        onSelectOrder={onSelectQueueOrder}
                        onRemoveOrder={onRemoveQueueOrder}
                    />
                )}
            </div>
        </div>
    );
}

