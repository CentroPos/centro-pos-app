import { Invoice, ScheduleDetails } from '@renderer/types/picking';
import { Calendar, Clock, StickyNote, Zap } from 'lucide-react';

interface InvoiceHeaderProps {
    invoice: Invoice;
    schedule?: ScheduleDetails;
    allCount: number;
    unassignedCount: number;
    assignedCount: number;
    activeFilter: 'all' | 'unassigned' | 'assigned';
    onFilterChange: (filter: 'all' | 'unassigned' | 'assigned') => void;
    onAssign: () => void;
    onFinish: () => void;
    hasSelection: boolean;
    canFinish: boolean;
    onScheduleClick?: () => void;
}

export function InvoiceHeader({
    invoice,
    schedule,
    allCount,
    unassignedCount,
    assignedCount,
    activeFilter,
    onFilterChange,
    onAssign,
    onFinish,
    hasSelection,
    canFinish,
    onScheduleClick
}: InvoiceHeaderProps) {
    return (
        <div className="bg-card border-b border-border flex-shrink-0">
            <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-start gap-8">
                    <div>
                        <h2 className="text-base font-bold text-foreground">{invoice.invoiceNo}</h2>
                        <p className="text-xs text-muted-foreground">{invoice.customerName}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                            <p className="text-xs font-semibold text-primary">
                                {invoice.totalAmount.toLocaleString()} {invoice.currency}
                            </p>
                            <div className="flex items-center gap-1.5">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${(() => {
                                    const s = invoice.status?.toLowerCase() || '';
                                    if (s === 'paid') return 'bg-green-500 text-white';
                                    if (s === 'overdue') return 'bg-red-500 text-white';
                                    return 'bg-amber-500 text-white';
                                })()
                                    }`}>
                                    {invoice.status || 'Unknown'}
                                </span>
                                {invoice.returnStatus && invoice.returnStatus !== 'No' && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-rose-500 text-white">
                                        {invoice.returnStatus}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {schedule && (
                        <div
                            onClick={onScheduleClick}
                            className={`bg-muted/50 rounded-lg p-2 border border-border/50 flex flex-col gap-1.5 min-w-[200px] transition-all ${onScheduleClick ? 'cursor-pointer hover:bg-muted hover:border-border' : ''}`}
                        >
                            <div className="flex items-center gap-2">
                                {schedule.type === 'instant' ? (
                                    <div className="flex items-center gap-1.5 text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-100">
                                        <Zap className="w-3 h-3 fill-orange-600" />
                                        <span className="text-[10px] font-bold uppercase tracking-wide">Instant Order</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1.5 text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                        <Calendar className="w-3 h-3" />
                                        <span className="text-[10px] font-bold uppercase tracking-wide">Scheduled</span>
                                    </div>
                                )}
                            </div>

                            {schedule.type === 'scheduled' && schedule.dateTime && (
                                <div className="flex items-center gap-1.5 text-xs text-foreground font-medium pl-1">
                                    <Clock className="w-3 h-3 text-muted-foreground" />
                                    {new Date(schedule.dateTime).toLocaleDateString()} {new Date(schedule.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            )}

                            {schedule.note && (
                                <div className="flex items-start gap-1.5 bg-yellow-50/50 p-1.5 rounded border border-yellow-100 text-yellow-900">
                                    <StickyNote className="w-3 h-3 shrink-0 mt-0.5" />
                                    <p className="text-[10px] leading-tight font-medium">{schedule.note}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => onFilterChange('all')}
                        className={`flex flex-col items-center px-4 py-2 rounded-xl transition-all min-w-[100px] border ${activeFilter === 'all'
                            ? 'bg-slate-100 border-slate-300 shadow-sm'
                            : 'bg-transparent border-transparent hover:bg-muted/50'
                            }`}
                    >
                        <span className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${activeFilter === 'all' ? 'text-slate-700' : 'text-muted-foreground'}`}>All</span>
                        <span className={`text-xl font-bold tabular-nums ${activeFilter === 'all' ? 'text-slate-900' : 'text-foreground'}`}>{allCount}</span>
                    </button>

                    <button
                        onClick={() => onFilterChange('unassigned')}
                        className={`flex flex-col items-center px-4 py-2 rounded-xl transition-all min-w-[100px] border ${activeFilter === 'unassigned'
                            ? 'bg-red-50 border-red-200 shadow-sm'
                            : 'bg-transparent border-transparent hover:bg-muted/50'
                            }`}
                    >
                        <span className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${activeFilter === 'unassigned' ? 'text-red-700' : 'text-red-600/70'}`}>Unassigned</span>
                        <span className={`text-xl font-bold tabular-nums ${activeFilter === 'unassigned' ? 'text-red-700' : 'text-red-600'}`}>{unassignedCount}</span>
                    </button>

                    <button
                        onClick={() => onFilterChange('assigned')}
                        className={`flex flex-col items-center px-4 py-2 rounded-xl transition-all min-w-[100px] border ${activeFilter === 'assigned'
                            ? 'bg-green-50 border-green-200 shadow-sm'
                            : 'bg-transparent border-transparent hover:bg-muted/50'
                            }`}
                    >
                        <span className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${activeFilter === 'assigned' ? 'text-green-700' : 'text-green-600/70'}`}>Assigned</span>
                        <span className={`text-xl font-bold tabular-nums ${activeFilter === 'assigned' ? 'text-green-700' : 'text-green-600'}`}>{assignedCount}</span>
                    </button>

                    <div className="flex gap-2 ml-4 border-l border-border pl-4">
                        <button
                            onClick={onAssign}
                            disabled={!hasSelection}
                            className={`h-12 px-6 rounded-xl font-bold text-sm shadow-sm transition-all flex items-center justify-center min-w-[100px] ${hasSelection
                                ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow shadow-primary/20'
                                : 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'
                                }`}
                        >
                            Assign
                        </button>
                        <button
                            onClick={onFinish}
                            disabled={!canFinish}
                            className={`h-12 px-6 rounded-xl font-bold text-sm shadow-sm transition-all flex items-center justify-center min-w-[100px] ${canFinish
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow shadow-emerald-600/20'
                                : 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'
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
