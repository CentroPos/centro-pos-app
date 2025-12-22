import { useState, useEffect, useCallback } from 'react';
import { cn } from '@renderer/lib/utils';
import { PickerLogItem, Invoice } from '@renderer/types/picking';
import { Search, RefreshCw, User, Clock, RotateCcw, Box, FileText } from 'lucide-react';
import { Input } from '@renderer/components/ui/input';
import { Button } from '@renderer/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@renderer/components/ui/select";
import { toast } from 'sonner';

interface PickerLogTabProps {
    onSelectInvoice?: (invoice: Invoice) => void;
}

export function PickerLogTab({ onSelectInvoice }: PickerLogTabProps) {
    const [activeSubTab, setActiveSubTab] = useState<'active' | 'logs'>('active');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPicker, setSelectedPicker] = useState<string>('all');
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Data State
    const [logs, setLogs] = useState<PickerLogItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(1);
    const [alertCount, setAlertCount] = useState(0);

    // Initial Fetch & Refresh
    const fetchLogs = useCallback(
        async (isRefresh = false, search = searchQuery) => {
            if (isLoading) return;
            if (!hasMore && !isRefresh && page > 1) return;

            setIsLoading(true);
            if (isRefresh) setIsRefreshing(true);

            const currentPage = isRefresh ? 1 : page;
            const isLogsTab = activeSubTab === 'logs';

            try {
                const res = await window.electronAPI?.proxy?.request({
                    url: isLogsTab
                        ? '/api/method/centro_pos_apis.api.picking.get_worker_log'
                        : '/api/method/centro_pos_apis.api.picking.get_active_worker_log',
                    method: 'GET',
                    params: {
                        search_key: search,
                        limit_start: currentPage,
                        limit_page_length: 20
                    }
                });

                console.log(`SHD ==> [${isLogsTab ? 'get_worker_log' : 'get_active_worker_log'}]`, res);

                if (res?.data?.data) {
                    const responseData = res.data.data;
                    const newLogs = isLogsTab ? responseData.worker_log : responseData.data;
                    const count = responseData.count;

                    if (!isLogsTab) {
                        setAlertCount(count?.active_picker_alert_count || 0);
                    }

                    console.log(`SHD ==> [${isLogsTab ? 'get_worker_log' : 'get_active_worker_log'}] data:`, newLogs);
                    console.log(`SHD ==> [${isLogsTab ? 'get_worker_log' : 'get_active_worker_log'}] count:`, count);

                    if (isRefresh || currentPage === 1) {
                        setLogs(newLogs || []);
                        setHasMore((newLogs || []).length === 20);
                        setPage(2);
                    } else {
                        setLogs((prev) => [...prev, ...(newLogs || [])]);
                        setHasMore((newLogs || []).length === 20);
                        setPage((prev) => prev + 1);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch picker logs', error);
                toast.error('Failed to load picking logs');
            } finally {
                setIsLoading(false);
                if (isRefresh) setIsRefreshing(false);
            }
        },
        [page, hasMore, searchQuery, isLoading, activeSubTab]
    );

    // Initial Load
    useEffect(() => {
        fetchLogs(true);
    }, [activeSubTab]); // Refetch on tab change

    // Debounced Search
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchLogs(true, searchQuery);
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [searchQuery]);

    const handleRefresh = () => {
        fetchLogs(true);
    };

    // Scroll Handler
    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
        if (scrollHeight - scrollTop <= clientHeight + 50) {
            if (!isLoading && hasMore) {
                fetchLogs();
            }
        }
    };


    // Filter based on Tab & Picker Selection (Client-side filter for now as API handles main data)
    // Note: The API likely returns all logs mixed. The requirement implies "Active Picker" tab logic 
    // vs "Picking Logs". Usually this would be an API filter.
    // Based on user prompt, we just display the data. But the UI splits 'active' vs 'logs'.
    // Assuming 'active' means is_closed = false? The prompt said "Active Pickers tab change the data...".
    // I'll filter client side for the sub-tabs if the API returns mixed, OR assuming the API returns what we need.
    // The prompt response structure shows 'is_closed': true/false.
    // I will use client side filtering for the tabs as the API seems general "get_active_worker_log".

    // NOTE: If API supports filtering by status, better. But prompt didn't specify params for that.
    // I'll filter the `logs` state.

    const filteredData = logs.filter(item => {
        // Tab Filter
        if (activeSubTab === 'logs') {
            // Client side picker filter if dropdown used
            if (selectedPicker !== 'all' && item.picker_name !== selectedPicker) return false;
        }

        return true;
    });

    // Unique picker names for filter
    const pickerNames = Array.from(new Set(logs.map(item => item.picker_name)));

    const formatTime = (dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const datePart = new Date(d.getFullYear(), d.getMonth(), d.getDate());

        if (datePart.getTime() === today.getTime()) {
            return 'Today';
        }
        return d.toLocaleDateString('en-GB');
    };

    const formatFooterDateTime = (dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
    };

    const handleItemClick = (item: PickerLogItem) => {
        console.log('SHD ==> Log item clicked:', item);
        if (!onSelectInvoice) {
            console.warn('SHD ==> onSelectInvoice is not defined');
            return;
        }

        // Map PickerLogItem to Invoice structure expected by fetchInvoiceDetails/openInvoiceTab
        const invoice: Invoice = {
            id: item.invoice_id,
            invoiceNo: item.invoice_id,
            customerName: item.customer_name,
            totalAmount: 0, // Not available in log response, fetchInvoiceDetails will fetch full data
            currency: 'SAR',
            items: Array(item.items_count).fill({}),
            invoiceDate: item.start_date_time,
            status: item.is_closed ? 'Picked' : 'In Process',
        };

        onSelectInvoice(invoice);
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex border-b border-border flex-shrink-0">
                <button
                    onClick={() => setActiveSubTab('active')}
                    className={cn(
                        'flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors',
                        activeSubTab === 'active'
                            ? 'bg-primary/10 text-primary border-b-2 border-primary'
                            : 'text-muted-foreground hover:bg-muted'
                    )}
                >
                    <User className="w-4 h-4" />
                    Active Pickers
                    {alertCount > 0 && (
                        <span className="px-1.5 py-0.5 text-xs rounded-full bg-green-600 text-white ml-1">
                            {alertCount}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveSubTab('logs')}
                    className={cn(
                        'flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors',
                        activeSubTab === 'logs'
                            ? 'bg-primary/10 text-primary border-b-2 border-primary'
                            : 'text-muted-foreground hover:bg-muted'
                    )}
                >
                    <RotateCcw className="w-4 h-4" />
                    Picking Logs
                </button>
            </div>

            <div className="p-3 border-b border-gray-200 space-y-3 flex-shrink-0">
                <div className="flex gap-2">
                    {activeSubTab === 'logs' && (
                        <Select value={selectedPicker} onValueChange={setSelectedPicker}>
                            <SelectTrigger className="w-[130px] h-9 text-xs">
                                <SelectValue placeholder="All" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                {pickerNames.map(name => (
                                    <SelectItem key={name} value={name}>{name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                            placeholder="Search picker, invoice..."
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
                {filteredData.length === 0 && !isLoading ? (
                    <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                        <User className="w-10 h-10 mb-2 opacity-50" />
                        <p className="text-sm">No records found</p>
                    </div>
                ) : (
                    filteredData.map((item, index) => {
                        return (
                            <button
                                key={`${item.pick_slip_id}-${index}`}
                                onClick={() => handleItemClick(item)}
                                className={cn(
                                    "w-full text-left border rounded-lg hover:shadow-md hover:border-primary/30 transition-all group overflow-hidden relative cursor-pointer active:scale-[0.99]",
                                    item.status === 'warn' ? "bg-red-50 border-red-200" : "bg-white border-gray-200"
                                )}
                            >
                                <div className="p-3">
                                    <div className="flex items-start gap-4">

                                        {/* Left: Picker Info */}
                                        <div className="flex flex-col items-center justify-center shrink-0 w-14 pt-1 gap-1 border-r border-gray-100 pr-2 mr-2">
                                            <div className={cn(
                                                "w-10 h-10 rounded-full flex items-center justify-center shadow-sm",
                                                item.status === 'warn' ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                                            )}>
                                                <span className="font-bold text-xs">{item.picker_name ? item.picker_name.substring(0, 2).toUpperCase() : 'NA'}</span>
                                            </div>
                                            <div className="text-center w-full">
                                                <p className="text-[10px] font-bold text-gray-900 leading-tight truncate px-1">{item.picker_name}</p>
                                                <p className="text-[9px] text-gray-500">{item.picker_id}</p>
                                            </div>
                                        </div>

                                        {/* Content Area */}
                                        <div className="flex-1 min-w-0 flex flex-col justify-between pl-3 pr-1 py-0.5">
                                            {/* Row 1: Invoice & Date */}
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <FileText className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                                                    <span className="text-sm font-bold text-gray-800 truncate" title={item.invoice_id}>
                                                        {item.invoice_id}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    {activeSubTab === 'active' && item.is_closed && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-green-100 text-green-700 border border-green-200 uppercase whitespace-nowrap leading-none">
                                                            Free
                                                        </span>
                                                    )}
                                                    <p className="text-[11px] font-bold text-gray-900 whitespace-nowrap">{formatDate(item.start_date_time)}</p>
                                                </div>
                                            </div>

                                            {/* Row 2: Customer & Time */}
                                            <div className="flex items-center justify-between gap-2 mt-0.5">
                                                <span className="text-xs text-gray-600 font-medium truncate pl-5" title={item.customer_name}>
                                                    {item.customer_name}
                                                </span>
                                                <p className="text-[10px] text-gray-500 whitespace-nowrap shrink-0">{formatTime(item.start_date_time)}</p>
                                            </div>

                                            {/* Row 3: Pick Slip (Left) & Items/Duration (Right) */}
                                            <div className="flex items-center justify-between mt-2">
                                                <div className="pl-5 min-w-0 flex-1 pr-2">
                                                    <div className="flex items-center gap-1 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 w-fit max-w-full">
                                                        <Box className="w-2.5 h-2.5 text-gray-400 shrink-0" />
                                                        <span className="text-[9px] font-medium text-gray-600 truncate" title={item.pick_slip_id}>
                                                            {item.pick_slip_id}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-end gap-2 shrink-0">
                                                    <span className={cn(
                                                        "text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap",
                                                        item.status === 'warn' ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"
                                                    )}>
                                                        {item.items_count} Items
                                                    </span>

                                                    <div className={cn(
                                                        "px-2 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1 whitespace-nowrap",
                                                        item.status === 'warn'
                                                            ? "bg-red-100 text-red-700 border-red-200"
                                                            : "bg-amber-50 text-amber-700 border-amber-100"
                                                    )}>
                                                        <Clock className="w-3 h-3" />
                                                        {item.duration} Min
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer Message */}
                                <div className={cn(
                                    "px-3 py-1.5 border-t text-[10px] flex items-center gap-2",
                                    item.status === 'warn'
                                        ? "bg-red-100/50 border-red-200 text-red-800"
                                        : "bg-blue-50/50 border-blue-100 text-gray-600"
                                )}>
                                    <User className={cn("w-3 h-3", item.status === 'warn' ? "text-red-500" : "text-blue-500")} />
                                    <span>
                                        {!item.is_closed ? 'Assigned' : 'Modified'} by <span className="font-semibold">{item.assigned_by}</span> on {formatFooterDateTime(item.assigned_on)}
                                    </span>
                                </div>
                            </button>
                        );
                    })
                )}
                {isLoading && (
                    <div className="flex justify-center p-4">
                        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                    </div>
                )}
            </div>
        </div>
    );
}

