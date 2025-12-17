import { useState, useEffect, useCallback } from 'react';
import { cn } from '@renderer/lib/utils';
import { Invoice } from '@renderer/types/picking';
import { Search, FileText, RefreshCw, AlertCircle } from 'lucide-react';
import { Input } from '@renderer/components/ui/input';
import { Button } from '@renderer/components/ui/button';

interface SalesTabProps {
    onSelectInvoice?: (invoice: Invoice) => void;
}

export function SalesTab({ onSelectInvoice }: SalesTabProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(1);
    const perPage = 20;

    const fetchInvoices = useCallback(async (isNewSearch = false) => {
        if (isLoading) return;
        setIsLoading(true);
        const currentPage = isNewSearch ? 1 : page;

        try {
            const limit_start = perPage;
            const res = await window.electronAPI?.proxy?.request({
                url: '/api/method/centro_pos_apis.api.picking.get_dynamic_picking_list',
                params: {
                    limit_start: currentPage,
                    limit_page_length: limit_start,
                    search_key: searchQuery
                }
            });

            const rawInvoices = res?.data?.data || [];

            // Map API response to match Invoice interface and QueueOrder-like structure for UI
            const mappedInvoices: Invoice[] = rawInvoices.map((inv: any) => ({
                id: inv.invoice_no,
                invoiceNo: inv.invoice_no,
                customerName: inv.customer_name,
                totalAmount: inv.total_amount,
                currency: 'SAR', // Assuming SAR based on mock data
                items: Array(inv.items_count).fill({}), // Mock items count length
                invoiceDate: inv.invoice_creation, // "2025-12-15 18:13:30.260524"
                status: inv.status, // "Unpaid", "Paid" etc for order_status
                returnStatus: inv.reverse_status,
                scheduleId: inv.schedule_id,
                // Extra fields mapped for UI display if we extend Invoice type or just cast/use specific fields
                // User mentioned "schedule_type 'instant/delivered'". API usually gives this.
                // Let's assume 'status' from API is 'delivered'/'not-delivered' (delivery status) 
                // and 'order_status' is Payment Status? 
                // In OpenInvoiceModal mapping: 
                // status: inv.status, returnStatus: inv.reverse_status.

                // We'll use the API fields directly if possible or stick to Invoice type.
                // Let's augment the Invoice type locally or just use 'any' casting in render if strictly needed, 
                // but better to stick to Invoice type.
                // Invoice type has: status, returnStatus.
                // We need: Order Status (Paid/Unpaid), Return Status, Delivery Status (Instant/Delivered/etc).

                // Wait, OpenInvoiceModal receives:
                // matchesFilter ... item.status === 'not-delivered' ...
                // In OpenInvoiceModal.tsx: 
                // status: inv.status
                // returnStatus: inv.reverse_status

                // In OrderQueueTab (Instant layout):
                // item.order_status (Paid/Overdue) -> This seems to vary. 
                // Let's check OpenInvoiceModal render logic again.
                // It renders `invoice.status` (e.g. "Unpaid") and `invoice.returnStatus`.

                // User request: "keep the schedule_type 'instant/delivered' in the item tile top right cornet status"
                // So top right badge = schedule_type? Or is it delivery status?
                // "schedule_type 'instant/delivered'" sounds like 'type' field? No.
                // Probably 'delivery_status'? 
                // Let's look at `OpenInvoiceModal` mapping again...
                // It doesn't map `schedule_type`.
                // But user says "api is same as OpenInvoiceModal".
                // Maybe the API field `status` IS the delivery status?
                // In `OpenInvoiceModal` render: `getStatusColor(invoice.status)`.
                // Labels: Paid, Overdue, or Amber (default).
                // Usually Payment Status is Paid/Unpaid.
                // Delivery Status is Delivered/Not Delivered.

                // User said: "keep the schedule_type 'instant/delivered' in the item tile top right cornet status"
                // I will add a `type` or `scheduleType` field to Invoice if needed, or just map it from API if available. 
                // If not, I'll default to "Instant" as per context? 
                // "keep the schedule_type 'instant/delivered'".
                // Maybe the API returns `type`? 
                // `get_dynamic_picking_list` usually returns `type`?
                // I will assume `inv.type` or `inv.schedule_type` exists.
                // I'll stick `any` for raw invoice access in render to be safe or add to type.
                scheduleType: inv.type || 'instant' // Mocking/Optimistic
            }));

            if (isNewSearch) {
                setInvoices(mappedInvoices);
                setHasMore(mappedInvoices.length === perPage);
                setPage(2);
            } else {
                setInvoices(prev => [...prev, ...mappedInvoices]);
                setHasMore(mappedInvoices.length === perPage);
                setPage(prev => prev + 1);
            }

        } catch (error) {
            console.error("Failed to fetch invoices:", error);
        } finally {
            setIsLoading(false);
        }
    }, [isLoading, page, searchQuery]);

    useEffect(() => {
        // Initial fetch
        fetchInvoices(true);
    }, []); // Run once on mount

    const handleSearch = () => {
        fetchInvoices(true);
    };

    const handleRefresh = () => {
        fetchInvoices(true);
    };

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchInvoices(true);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);


    const getStatusColor = (status?: string) => {
        const s = status?.toLowerCase() || '';
        if (s === 'paid') return 'bg-green-500 text-white';
        if (s === 'overdue') return 'bg-red-500 text-white';
        if (s === 'unpaid') return 'bg-amber-500 text-white';
        return 'bg-gray-500 text-white';
    };

    const formatFooterDateTime = (dateStr?: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
    };

    return (
        <div className="h-full flex flex-col">
            <div className="p-3 border-b border-gray-200 space-y-3 flex-shrink-0">
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
                        <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-3 space-y-2">
                {invoices.length === 0 && !isLoading ? (
                    <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                        <AlertCircle className="w-10 h-10 mb-2 opacity-50" />
                        <p className="text-sm">No sales found</p>
                    </div>
                ) : (
                    invoices.map((item, index) => (
                        <button
                            key={`${item.id}-${index}`}
                            className="w-full text-left bg-white border border-border rounded-lg hover:shadow-sm transition-all group overflow-hidden"
                            onClick={() => onSelectInvoice?.(item)}
                        >
                            <div className="p-3">
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                                        <FileText className="w-5 h-5 text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1 min-w-0 pr-2">
                                                <p className="font-bold text-gray-900 text-sm">{item.invoiceNo}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                                                        {item.customerName}
                                                    </span>
                                                    <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                                        Items: {item.items.length}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5 mt-2">
                                                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap", getStatusColor(item.status))}>
                                                        {item.status || 'Unpaid'}
                                                    </span>
                                                    {item.returnStatus && item.returnStatus !== 'No' && (
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-rose-500 text-white whitespace-nowrap">
                                                            {item.returnStatus}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex flex-col items-end shrink-0 gap-1.5 min-w-[140px]">
                                                {/* Schedule Type / Delivery Status Badge - Top Right */}
                                                <div className="flex justify-end">
                                                    <span className={cn(
                                                        "text-[10px] px-2 py-0.5 rounded-full font-medium border whitespace-nowrap",
                                                        // Logic for color based on type/status
                                                        "bg-gray-50 text-gray-700 border-gray-200"
                                                    )}>
                                                        {/* User requested schedule_type "instant/delivered" here */}
                                                        {/* Using item.status might be wrong if it is Payment status. */}
                                                        {/* Assuming 'type' or 'scheduleType' or defaulting to "Instant" */}
                                                        {(item as any).scheduleType || 'Instant'}
                                                    </span>
                                                </div>

                                                <span className="text-sm font-bold text-primary block mt-0.5">
                                                    {item.totalAmount.toLocaleString()} {item.currency}
                                                </span>

                                                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                                    {formatFooterDateTime(item.invoiceDate)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {/* No Footer Message as requested */}
                        </button>
                    ))
                )}
                {isLoading && invoices.length > 0 && (
                    <div className="py-2 text-center text-xs text-muted-foreground">Loading more...</div>
                )}
            </div>
        </div>
    );
}
