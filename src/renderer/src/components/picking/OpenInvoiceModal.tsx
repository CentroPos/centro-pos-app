import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@renderer/components/ui/dialog';
import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
import { Invoice } from '@renderer/types/picking';
import { Search, FileText } from 'lucide-react';

interface OpenInvoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectInvoice: (invoice: Invoice) => void;
}

export function OpenInvoiceModal({
    isOpen,
    onClose,
    onSelectInvoice,
}: Pick<OpenInvoiceModalProps, 'isOpen' | 'onClose' | 'onSelectInvoice'>) {
    const [searchQuery, setSearchQuery] = useState('');
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(1);
    const perPage = 20;
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setSearchQuery('');
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
        }
    }, [isOpen]);

    const fetchInvoices = async (isNewSearch = false) => {
        if (isLoading || (!hasMore && !isNewSearch)) return;

        setIsLoading(true);
        const currentPage = isNewSearch ? 1 : page;

        try {
            const limit_start = perPage;
            // limit_page_length is pageNo as per user request
            // limit_start is the static limit (20)
            const res = await window.electronAPI?.proxy?.request({
                url: '/api/method/centro_pos_apis.api.picking.get_dynamic_picking_list',
                params: {
                    limit_start: currentPage,
                    limit_page_length: limit_start,
                    search_key: searchQuery
                }
            });

            const rawInvoices = res?.data?.data || [];

            const mappedInvoices: Invoice[] = rawInvoices.map((inv: any) => {
                console.log('INV DATA OpenInvoice:', inv, inv.schedule_type);
                return {
                    id: inv.invoice_no,
                    invoiceNo: inv.invoice_no,
                    customerName: inv.customer_name,
                    totalAmount: inv.total_amount,
                    currency: ' SAR',
                    items: Array(inv.items_count).fill({}),
                    invoiceDate: inv.invoice_creation,
                    status: inv.status,
                    returnStatus: inv.reverse_status,
                    scheduleId: inv.schedule_id,
                    scheduleType: inv.schedule_type
                };
            });

            if (isNewSearch) {
                setInvoices(mappedInvoices);
            } else {
                setInvoices(prev => [...prev, ...mappedInvoices]);
            }

            setHasMore(mappedInvoices.length === perPage);
            setPage(currentPage + 1);

        } catch (error) {
            console.error("Failed to fetch invoices:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Debounce search
    useEffect(() => {
        if (!isOpen) return;
        const timer = setTimeout(() => {
            fetchInvoices(true);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery, isOpen]);


    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
        if (scrollHeight - scrollTop <= clientHeight + 50 && hasMore && !isLoading) {
            fetchInvoices(false);
        }
    };

    const handleSelect = (invoice: Invoice) => {
        onSelectInvoice(invoice);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-lg p-0 gap-0">
                <DialogHeader className="p-6 pb-4">
                    <DialogTitle className="text-xl font-semibold">Open Invoice</DialogTitle>
                </DialogHeader>

                <div className="px-6 pb-6 space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            ref={inputRef}
                            placeholder="Search invoice number or customer..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>

                    <div
                        className="max-h-[300px] overflow-auto space-y-2"
                        onScroll={handleScroll}
                    >
                        {invoices.map((invoice, index) => {
                            const getStatusColor = (status?: string) => {
                                const s = status?.toLowerCase() || '';
                                if (s === 'paid') return 'bg-green-500 text-white';
                                if (s === 'overdue') return 'bg-red-500 text-white';
                                return 'bg-amber-500 text-white';
                            };

                            return (
                                <button
                                    key={`${invoice.id}-${index}`}
                                    onClick={() => handleSelect(invoice)}
                                    className="w-full p-3 text-left border border-border rounded-lg hover:bg-muted transition-colors group"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors mt-1">
                                            <FileText className="w-5 h-5 text-primary" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1 min-w-0 pr-2">
                                                    <p className="font-semibold text-foreground text-sm">{invoice.invoiceNo}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                                                            {invoice.customerName}
                                                        </span>
                                                        <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                                            Items: {invoice.items.length}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-1.5 mt-2">
                                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${getStatusColor(invoice.status)}`}>
                                                            {invoice.status || 'Unknown'}
                                                        </span>
                                                        {invoice.returnStatus && invoice.returnStatus !== 'No' && (
                                                            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-rose-500 text-white">
                                                                {invoice.returnStatus}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="text-right shrink-0">
                                                    {invoice.scheduleType && (
                                                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase mb-1 inline-block ${String(invoice.scheduleType).toLowerCase() === 'instant'
                                                                ? 'bg-orange-100 text-orange-700'
                                                                : 'bg-blue-100 text-blue-700'
                                                            }`}>
                                                            {invoice.scheduleType}
                                                        </span>
                                                    )}
                                                    <span className="text-sm font-bold text-primary block">
                                                        {invoice.totalAmount.toLocaleString()} {invoice.currency}
                                                    </span>
                                                    <div className="flex flex-col items-end mt-1">
                                                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                                            {(() => {
                                                                if (!invoice.invoiceDate) return '';
                                                                const date = new Date(invoice.invoiceDate);
                                                                if (isNaN(date.getTime())) return '';
                                                                const day = String(date.getDate()).padStart(2, '0');
                                                                const month = String(date.getMonth() + 1).padStart(2, '0');
                                                                const year = date.getFullYear();
                                                                return `${day}/${month}/${year}`;
                                                            })()}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                                            {(() => {
                                                                if (!invoice.invoiceDate) return '';
                                                                const date = new Date(invoice.invoiceDate);
                                                                if (isNaN(date.getTime())) return '';
                                                                let hours = date.getHours();
                                                                const minutes = String(date.getMinutes()).padStart(2, '0');
                                                                const ampm = hours >= 12 ? 'PM' : 'AM';
                                                                hours = hours % 12;
                                                                hours = hours ? hours : 12;
                                                                return `${hours}:${minutes} ${ampm}`;
                                                            })()}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                        {isLoading && (
                            <div className="py-4 text-center text-sm text-muted-foreground">Loading...</div>
                        )}
                        {!isLoading && invoices.length === 0 && (
                            <div className="py-8 text-center text-muted-foreground">
                                No invoices found
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end pt-4 border-t border-border">
                        <Button variant="secondary" onClick={onClose}>
                            Cancel
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

