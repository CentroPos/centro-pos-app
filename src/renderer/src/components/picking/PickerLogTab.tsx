import { useState, useMemo } from 'react';
import { cn } from '@renderer/lib/utils';
import { PickerLogItem } from '@renderer/types/picking';
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

const MOCK_PICKER_LOG_DATA: PickerLogItem[] = [
    {
        picker_name: "Abdulla",
        picker_id: "PC-0091",
        items_count: 5,
        pick_slip_id: "ACC-PS-2025-00137",
        invoice_id: "ACC-SINV-2025-00137",
        customer_name: "Customer 1",
        assigned_on: "2025-12-17 15:11:27",
        assigned_by: "Abin",
        modified_on: "2025-12-17 15:11:27",
        modified_by: "Abin",
        start_date_time: "2025-12-17 15:11:27",
        end_date_time: "2025-12-17 15:11:27",
        duration: "10:00",
        status: "normal",
        is_closed: true
    },
    {
        picker_name: "Rahul",
        picker_id: "PC-0092",
        items_count: 12,
        pick_slip_id: "ACC-PS-2025-0992",
        invoice_id: "ACC-SINV-2025-0992",
        customer_name: "Super Market Ltd",
        assigned_on: "2025-12-17 16:30:00",
        assigned_by: "Manager",
        modified_on: "2025-12-17 16:45:00",
        modified_by: "Manager",
        start_date_time: "2025-12-17 16:30:00",
        end_date_time: "",
        duration: "45:00",
        status: "warn",
        is_closed: false
    }
];

export function PickerLogTab() {
    const [activeSubTab, setActiveSubTab] = useState<'active' | 'logs'>('active');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPicker, setSelectedPicker] = useState<string>('all');
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = () => {
        setIsRefreshing(true);
        setTimeout(() => setIsRefreshing(false), 1000);
    };

    const pickerNames = useMemo(() => {
        return Array.from(new Set(MOCK_PICKER_LOG_DATA.map(item => item.picker_name)));
    }, []);

    const filteredData = MOCK_PICKER_LOG_DATA.filter(item => {
        const matchesSearch = item.picker_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.picker_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.invoice_id.toLowerCase().includes(searchQuery.toLowerCase());

        if (activeSubTab === 'logs') {
            if (selectedPicker !== 'all' && item.picker_name !== selectedPicker) {
                return false;
            }
        }

        return matchesSearch;
    });

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
                    <span className="px-1.5 py-0.5 text-xs rounded-full bg-green-600 text-white ml-1">
                        {MOCK_PICKER_LOG_DATA.filter(i => !i.is_closed).length}
                    </span>
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

            <div className="flex-1 overflow-auto p-3 space-y-2">
                {filteredData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                        <User className="w-10 h-10 mb-2 opacity-50" />
                        <p className="text-sm">No active pickers found</p>
                    </div>
                ) : (
                    filteredData.map((item, index) => (
                        <div
                            key={`${item.pick_slip_id}-${index}`}
                            className={cn(
                                "w-full text-left border rounded-lg hover:shadow-sm transition-all group overflow-hidden relative",
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
                                            <span className="font-bold text-xs">{item.picker_name.substring(0, 2).toUpperCase()}</span>
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
                                // Keep the highlight style as requested
                                item.status === 'warn'
                                    ? "bg-red-100/50 border-red-200 text-red-800"
                                    : "bg-blue-50/50 border-blue-100 text-gray-600"
                            )}>
                                <User className={cn("w-3 h-3", item.status === 'warn' ? "text-red-500" : "text-blue-500")} />
                                <span>
                                    {!item.is_closed ? 'Assigned' : 'Modified'} by <span className="font-semibold">{item.assigned_by}</span> on {formatFooterDateTime(item.assigned_on)}
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

