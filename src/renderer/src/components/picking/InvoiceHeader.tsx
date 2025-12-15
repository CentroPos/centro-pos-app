import { Invoice } from '@renderer/types/picking';

interface InvoiceHeaderProps {
    invoice: Invoice;
    allCount: number;
    unassignedCount: number;
    assignedCount: number;
    activeFilter: 'all' | 'unassigned' | 'assigned';
    onFilterChange: (filter: 'all' | 'unassigned' | 'assigned') => void;
    onAssign: () => void;
    onFinish: () => void;
    hasSelection: boolean;
    canFinish: boolean;
}

export function InvoiceHeader({
    invoice,
    allCount,
    unassignedCount,
    assignedCount,
    activeFilter,
    onFilterChange,
    onAssign,
    onFinish,
    hasSelection,
    canFinish,
}: InvoiceHeaderProps) {
    return (
        <div className="bg-card border-b border-border flex-shrink-0">
            <div className="flex items-center justify-between px-4 py-3">
                <div>
                    <h2 className="text-base font-bold text-foreground">{invoice.invoiceNo}</h2>
                    <p className="text-xs text-muted-foreground">{invoice.customerName}</p>
                    <p className="text-xs font-semibold text-primary mt-0.5">
                        {invoice.totalAmount.toLocaleString()} {invoice.currency}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => onFilterChange('all')}
                        className={`flex flex-col items-center px-3 py-1.5 rounded-lg transition-all ${activeFilter === 'all' ? 'bg-muted' : 'hover:bg-muted/50'
                            }`}
                    >
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">All</span>
                        <span className="text-xl font-bold tabular-nums text-foreground">{allCount}</span>
                    </button>

                    <button
                        onClick={() => onFilterChange('unassigned')}
                        className={`flex flex-col items-center px-3 py-1.5 rounded-lg transition-all ${activeFilter === 'unassigned' ? 'bg-red-100' : 'hover:bg-muted/50'
                            }`}
                    >
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-red-600">Unassigned</span>
                        <span className="text-xl font-bold tabular-nums text-red-600">{unassignedCount}</span>
                    </button>

                    <button
                        onClick={() => onFilterChange('assigned')}
                        className={`flex flex-col items-center px-3 py-1.5 rounded-lg transition-all ${activeFilter === 'assigned' ? 'bg-green-100' : 'hover:bg-muted/50'
                            }`}
                    >
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-green-600">Assigned</span>
                        <span className="text-xl font-bold tabular-nums text-green-600">{assignedCount}</span>
                    </button>

                    <div className="flex gap-2 ml-2">
                        <button
                            onClick={onAssign}
                            disabled={!hasSelection}
                            className={`px-4 py-1.5 rounded-lg font-semibold text-xs transition-all ${hasSelection
                                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                                : 'bg-muted text-muted-foreground cursor-not-allowed'
                                }`}
                        >
                            Assign
                        </button>
                        <button
                            onClick={onFinish}
                            disabled={!canFinish}
                            className={`px-4 py-1.5 rounded-lg font-semibold text-xs transition-all ${canFinish
                                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                                : 'bg-muted text-muted-foreground cursor-not-allowed'
                                }`}
                        >
                            Finish
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

