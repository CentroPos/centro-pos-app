import { useState, useEffect, useCallback } from 'react';
import { cn } from '@renderer/lib/utils';
import { Invoice, QueueOrder } from '@renderer/types/picking';
import { Search, Zap, Calendar, Clock, FileText, RefreshCw } from 'lucide-react';
import { Input } from '@renderer/components/ui/input';
import { Button } from '@renderer/components/ui/button';
import { toast } from 'sonner';

interface OrderQueueTabProps {
    onSelectInvoice?: (invoice: Invoice) => void;
}

export function OrderQueueTab({
    onSelectInvoice,
}: OrderQueueTabProps) {
    const [activeSubTab, setActiveSubTab] = useState<'instant' | 'scheduled'>('instant');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'All' | 'Not Delivered' | 'Partial Delivered' | 'Delivered'>('All');
    const [orders, setOrders] = useState<QueueOrder[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(1);
    const [instantAlertCount, setInstantAlertCount] = useState(0);
    const [scheduleAlertCount, setScheduleAlertCount] = useState(0);

    const fetchQueue = useCallback(async (isNewSearch = false) => {
        if (isLoading) return;
        setIsLoading(true);
        if (isNewSearch) setIsRefreshing(true);
        const currentPage = isNewSearch ? 1 : page;

        try {
            const res = await window.electronAPI?.proxy?.request({
                url: '/api/method/centro_pos_apis.api.picking.get_schedule_queue_list',
                params: {
                    type: activeSubTab,
                    limit_start: currentPage,
                    limit_page_length: 20,
                    search_key: searchQuery
                }
            });

            if (res?.data?.data) {
                const responseData = res.data.data;
                const newOrders = responseData.data || [];
                const count = responseData.count;

                setInstantAlertCount(count?.instant_alert_count || 0);
                setScheduleAlertCount(count?.schedule_alert_count || 0);

                if (isNewSearch) {
                    setOrders(newOrders);
                    setHasMore(newOrders.length === 20);
                    setPage(2);
                } else {
                    setOrders(prev => [...prev, ...newOrders]);
                    setHasMore(newOrders.length === 20);
                    setPage(prev => prev + 1);
                }
            }
        } catch (error) {
            console.error("Failed to fetch queue:", error);
            toast.error("Failed to load queue");
        } finally {
            setIsLoading(false);
            if (isNewSearch) setIsRefreshing(false);
        }
    }, [isLoading, page, searchQuery, activeSubTab]);

    useEffect(() => {
        fetchQueue(true);
    }, [activeSubTab]);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchQueue(true);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const handleRefresh = () => {
        fetchQueue(true);
    };

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
        if (scrollHeight - scrollTop <= clientHeight + 50) {
            if (!isLoading && hasMore) {
                fetchQueue();
            }
        }
    };

    const getStatusColor = (status?: string) => {
        const s = status?.toLowerCase() || '';
        if (s === 'paid') return 'bg-green-500 text-white';
        if (s === 'overdue') return 'bg-red-500 text-white';
        return 'bg-amber-500 text-white';
    };

    const formatFooterDateTime = (dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
    };

    const formatScheduledTime = (dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const datePart = new Date(d.getFullYear(), d.getMonth(), d.getDate());

        const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

        if (datePart.getTime() === today.getTime()) {
            return `Today ${timeStr}`;
        } else if (datePart.getTime() === tomorrow.getTime()) {
            return `Tomorrow ${timeStr}`;
        } else {
            return formatFooterDateTime(dateStr);
        }
    };

    const handleItemClick = (item: QueueOrder) => {
        if (!onSelectInvoice) return;

        // Map QueueOrder to Invoice structure
        const invoice: Invoice = {
            id: item.invoice_no,
            invoiceNo: item.invoice_no,
            customerName: item.customer_name,
            totalAmount: item.total_amount,
            currency: 'SAR',
            items: Array(Number(item.item_count)).fill({}),
            invoiceDate: item.invoice_creation,
            status: item.order_status,
            returnStatus: item.reverse_status,
            scheduleId: item.sales_order_id,
            scheduleType: item.type
        };

        onSelectInvoice(invoice);
    };

    const filteredOrders = orders.filter((item) => {
        if (statusFilter !== 'All') {
            const status = item.status === 'not-delivered' ? 'Not Delivered' :
                item.status === 'partial-delivered' ? 'Partial Delivered' :
                    item.status === 'delivered' ? 'Delivered' : '';
            if (status !== statusFilter) return false;
        }
        return true;
    });

    const renderOrderCard = (item: QueueOrder, index: number) => (
        <button
            key={`${item.invoice_no}-${index}`}
            className="w-full text-left bg-white border border-gray-200 rounded-lg hover:shadow-md hover:border-primary/30 hover:bg-gray-50/50 transition-all group overflow-hidden relative cursor-pointer active:scale-[0.99]"
            onClick={() => handleItemClick(item)}
        >
            <div className="p-3">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                        <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0 pr-2">
                                <p className="font-bold text-gray-900 text-sm">{item.invoice_no}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                                        {item.customer_name}
                                    </span>
                                    <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                        Items: {item.item_count}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5 mt-2">
                                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap", getStatusColor(item.order_status))}>
                                        {item.order_status}
                                    </span>
                                    {item.reverse_status !== 'No' && (
                                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-rose-500 text-white whitespace-nowrap">
                                            {item.reverse_status}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col items-end shrink-0 gap-1.5 min-w-[140px]">
                                <div className="flex justify-end">
                                    <span className={cn(
                                        "text-[10px] px-2 py-0.5 rounded-full font-medium border whitespace-nowrap",
                                        item.status === 'delivered' ? "bg-green-50 text-green-700 border-green-200" :
                                            item.status === 'partial-delivered' ? "bg-orange-50 text-orange-700 border-orange-200" :
                                                "bg-gray-50 text-gray-700 border-gray-200"
                                    )}>
                                        {item.status === 'not-delivered' ? 'Not Delivered' : item.status === 'partial-delivered' ? 'Partial' : 'Delivered'}
                                    </span>
                                </div>

                                <span className="text-sm font-bold text-primary block mt-0.5">
                                    {item.total_amount.toLocaleString()} SAR
                                </span>

                                {item.type === 'scheduled' ? (
                                    <div className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-[10px] font-semibold border border-blue-100 whitespace-nowrap">
                                        Scheduled: {formatScheduledTime(item.date_time)}
                                    </div>
                                ) : (
                                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                        {formatFooterDateTime(item.date_time)}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="bg-amber-50 px-3 py-2 border-t border-amber-100 text-[10px] text-gray-600 flex items-center gap-2">
                <Clock className="w-3 h-3 text-amber-500" />
                <span>
                    {item.modified_by ? (
                        <>{item.type === 'instant' ? 'Instant' : 'Scheduled'} Modified by <span className="font-semibold text-gray-800">{item.modified_by}</span> on {formatFooterDateTime(item.modified_on)}</>
                    ) : (
                        <>{item.type === 'instant' ? 'Instant' : 'Scheduled'} Scheduled by <span className="font-semibold text-gray-800">{item.scheduled_by}</span> on {formatFooterDateTime(item.scheduled_on)}</>
                    )}
                </span>
            </div>
        </button>
    );

    return (
        <div className="h-full flex flex-col">
            <div className="flex border-b border-border flex-shrink-0">
                <button
                    onClick={() => setActiveSubTab('instant')}
                    className={cn(
                        'flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors',
                        activeSubTab === 'instant'
                            ? 'bg-primary/10 text-primary border-b-2 border-primary'
                            : 'text-muted-foreground hover:bg-muted'
                    )}
                >
                    <Zap className="w-4 h-4" />
                    Instant
                    {instantAlertCount > 0 && (
                        <span className="px-1.5 py-0.5 text-xs rounded-full bg-green-600 text-white">
                            {instantAlertCount}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveSubTab('scheduled')}
                    className={cn(
                        'flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors',
                        activeSubTab === 'scheduled'
                            ? 'bg-primary/10 text-primary border-b-2 border-primary'
                            : 'text-muted-foreground hover:bg-muted'
                    )}
                >
                    <Calendar className="w-4 h-4" />
                    Scheduled
                    {scheduleAlertCount > 0 && (
                        <span className="px-1.5 py-0.5 text-xs rounded-full bg-green-600 text-white">
                            {scheduleAlertCount}
                        </span>
                    )}
                </button>
            </div>

            <div className="p-3 border-b border-gray-200 space-y-3 flex-shrink-0">
                <div className="flex flex-wrap gap-2">
                    {(['All', 'Not Delivered', 'Partial Delivered', 'Delivered'] as const).map((filter) => (
                        <button
                            key={filter}
                            onClick={() => setStatusFilter(filter)}
                            className={cn(
                                "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                                statusFilter === filter
                                    ? "bg-slate-800 text-white border-slate-800"
                                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                            )}
                        >
                            {filter}
                        </button>
                    ))}
                </div>

                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                            placeholder="Search invoice or customer..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 h-9 border-gray-200 focus:border-blue-500"
                        />
                    </div>
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        onClick={handleRefresh}
                    >
                        <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-3 space-y-2" onScroll={handleScroll}>
                {orders.length === 0 && !isLoading ? (
                    <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                        {activeSubTab === 'instant' ? <Zap className="w-10 h-10 mb-2 opacity-50" /> : <Calendar className="w-10 h-10 mb-2 opacity-50" />}
                        <p className="text-sm">No {activeSubTab} orders found</p>
                    </div>
                ) : (
                    filteredOrders.map((item, index) => renderOrderCard(item, index))
                )}
                {isLoading && orders.length > 0 && (
                    <div className="py-2 text-center text-xs text-muted-foreground font-medium">Loading more...</div>
                )}
            </div>
        </div>
    );
}
