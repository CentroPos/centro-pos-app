import { useState } from 'react';
import { cn } from '@renderer/lib/utils';
import { OrderQueueItem, QueueOrder } from '@renderer/types/picking';
import { Search, Zap, Calendar, Clock, FileText, Trash2, RefreshCw } from 'lucide-react';
import { Input } from '@renderer/components/ui/input';
import { Button } from '@renderer/components/ui/button';

interface OrderQueueTabProps {
    orderQueue: OrderQueueItem[];
    onSelectOrder: (item: OrderQueueItem) => void;
    onRemoveOrder: (id: string) => void;
}

// Helper to generate mock dates for "Today" and "Tomorrow" testing
const getTodayDate = () => new Date().toISOString();
const getTomorrowDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return d.toISOString();
};
const getFutureDate = () => "2025-12-25T14:30:00.000000";

const MOCK_INSTANT_DATA: QueueOrder[] = [
    {
        type: "instant",
        invoice_no: "ACC-SINV-2025-00138",
        sales_order_id: "SAL-ORD-2025-00217",
        customer_name: "Riyadh Business Corp",
        total_amount: 80.5,
        item_count: 3,
        order_status: "Overdue",
        reverse_status: "No",
        invoice_creation: "2025-12-15 18:13:30.260524",
        note: "Server testing",
        status: "not-delivered",
        date_time: "2025-12-15 18:13:30.260524",
        scheduled_by: "Test User",
        scheduled_on: "2025-12-15 09:59:25.918932",
        modified_by: "Test User",
        modified_on: "2025-12-15 10:21:00.630230"
    },
    {
        type: "instant",
        invoice_no: "ACC-SINV-2025-00139",
        sales_order_id: "SAL-ORD-2025-00218",
        customer_name: "Alpha Retail",
        total_amount: 150.0,
        item_count: 5,
        order_status: "Paid",
        reverse_status: "No",
        invoice_creation: "2025-12-15 18:20:00.000000",
        note: "Urgent",
        status: "delivered",
        date_time: "2025-12-15 18:20:00.000000",
        scheduled_by: "Admin",
        scheduled_on: "2025-12-15 10:00:00.000000",
        modified_by: "",
        modified_on: ""
    },
    {
        type: "instant",
        invoice_no: "ACC-SINV-2025-00140",
        sales_order_id: "SAL-ORD-2025-00219",
        customer_name: "Mega Mart",
        total_amount: 2500.0,
        item_count: 12,
        order_status: "Unpaid",
        reverse_status: "No",
        invoice_creation: "2025-12-16 09:00:00.000000",
        note: "",
        status: "partial-delivered",
        date_time: "2025-12-16 09:00:00.000000",
        scheduled_by: "Test User",
        scheduled_on: "2025-12-16 08:30:00.000000",
        modified_by: "",
        modified_on: ""
    }
];

const MOCK_SCHEDULED_DATA: QueueOrder[] = [
    {
        type: "scheduled",
        invoice_no: "ACC-SINV-2025-00141",
        sales_order_id: "SAL-ORD-2025-00220",
        customer_name: "Fresh Market",
        total_amount: 1200.50,
        item_count: 15,
        order_status: "Paid",
        reverse_status: "No",
        invoice_creation: "2025-12-14 10:00:00",
        note: "Deliver to back door",
        status: "not-delivered",
        date_time: "2025-12-14 10:00:00",
        scheduled_by: "Logistics Mgr",
        scheduled_on: getTodayDate(), // Today
        modified_by: "",
        modified_on: ""
    },
    {
        type: "scheduled",
        invoice_no: "ACC-SINV-2025-00142",
        sales_order_id: "SAL-ORD-2025-00221",
        customer_name: "City Superstore",
        total_amount: 3500.00,
        item_count: 28,
        order_status: "Unpaid",
        reverse_status: "No",
        invoice_creation: "2025-12-14 15:30:00",
        note: "Call before arrival",
        status: "partial-delivered",
        date_time: "2025-12-14 15:30:00",
        scheduled_by: "Sales Rep",
        scheduled_on: getTomorrowDate(), // Tomorrow
        modified_by: "Admin",
        modified_on: "2025-12-15 09:00:00"
    },
    {
        type: "scheduled",
        invoice_no: "ACC-SINV-2025-00143",
        sales_order_id: "SAL-ORD-2025-00222",
        customer_name: "Oasis Cafe",
        total_amount: 450.75,
        item_count: 8,
        order_status: "Overdue",
        reverse_status: "No",
        invoice_creation: "2025-12-13 11:15:00",
        note: "",
        status: "not-delivered",
        date_time: "2025-12-13 11:15:00",
        scheduled_by: "System",
        scheduled_on: getFutureDate(), // Future date
        modified_by: "",
        modified_on: ""
    }
];

export function OrderQueueTab({
    orderQueue,
    onSelectOrder,
    onRemoveOrder,
}: OrderQueueTabProps) {
    const [activeSubTab, setActiveSubTab] = useState<'instant' | 'scheduled'>('instant');
    const [searchQuery, setSearchQuery] = useState('');
    const [instantFilter, setInstantFilter] = useState<'All' | 'Not Delivered' | 'Partial Delivered' | 'Delivered'>('All');
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = () => {
        setIsRefreshing(true);
        // Simulate API call
        setTimeout(() => setIsRefreshing(false), 1000);
        console.log("Refreshing Instant Orders...");
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

    const activeData = activeSubTab === 'instant' ? MOCK_INSTANT_DATA : MOCK_SCHEDULED_DATA;

    const filteredOrders = activeData.filter((item) => {
        const matchesSearch =
            item.invoice_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.customer_name.toLowerCase().includes(searchQuery.toLowerCase());

        // Apply filter logic
        const matchesFilter =
            instantFilter === 'All' ||
            (instantFilter === 'Not Delivered' && item.status === 'not-delivered') ||
            (instantFilter === 'Partial Delivered' && item.status === 'partial-delivered') ||
            (instantFilter === 'Delivered' && item.status === 'delivered');

        return matchesSearch && matchesFilter;
    });

    // Dynamic Counts
    const instantCount = MOCK_INSTANT_DATA.length;
    const scheduledCount = MOCK_SCHEDULED_DATA.length;

    const renderOrderCard = (item: QueueOrder, index: number) => (
        <button
            key={`${item.invoice_no}-${index}`}
            className="w-full text-left bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-all group overflow-hidden"
            onClick={() => {
                // Adapt to onSelectOrder if needed
            }}
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
                                {/* Delivery Status Badge - Top Right */}
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

                                {/* Date Time Display */}
                                {item.type === 'scheduled' ? (
                                    <div className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-[10px] font-semibold border border-blue-100 whitespace-nowrap">
                                        Scheduled: {formatScheduledTime(item.scheduled_on)}
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
            {/* Footer Message */}
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
                    {instantCount > 0 && (
                        <span className="px-1.5 py-0.5 text-xs rounded-full bg-green-600 text-white">
                            {instantCount}
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
                    {scheduledCount > 0 && (
                        <span className="px-1.5 py-0.5 text-xs rounded-full bg-green-600 text-white">
                            {scheduledCount}
                        </span>
                    )}
                </button>
            </div>

            <div className="p-3 border-b border-gray-200 space-y-3 flex-shrink-0">
                <div className="flex flex-wrap gap-2">
                    {(['All', 'Not Delivered', 'Partial Delivered', 'Delivered'] as const).map((filter) => (
                        <button
                            key={filter}
                            onClick={() => setInstantFilter(filter)}
                            className={cn(
                                "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                                instantFilter === filter
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

            <div className="flex-1 overflow-auto p-3 space-y-2">
                {filteredOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                        {activeSubTab === 'instant' ? <Zap className="w-10 h-10 mb-2 opacity-50" /> : <Calendar className="w-10 h-10 mb-2 opacity-50" />}
                        <p className="text-sm">No {activeSubTab} orders found</p>
                    </div>
                ) : (
                    filteredOrders.map((item, index) => renderOrderCard(item, index))
                )}
            </div>
        </div>
    );
}
