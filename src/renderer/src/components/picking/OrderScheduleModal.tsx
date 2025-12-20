import { useState, useRef, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@renderer/components/ui/dialog';
import { Button } from '@renderer/components/ui/button';
import { Textarea } from '@renderer/components/ui/textarea';
import { cn } from '@renderer/lib/utils';
import { Invoice, ScheduleDetails } from '@renderer/types/picking';
import { Zap, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface OrderScheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
    invoice: Invoice | null;
    schedule?: ScheduleDetails;
    onConfirm: (scheduleType: 'instant' | 'scheduled', scheduledDate?: Date, scheduledTime?: string, note?: string) => void;
}

const TIME_SLOTS = [
    '05:00 AM', '06:00 AM', '07:00 AM', '08:00 AM',
    '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
    '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM',
    '05:00 PM', '06:00 PM', '07:00 PM', '08:00 PM',
    '09:00 PM', '10:00 PM', '11:00 PM', '12:00 AM',
];

export function OrderScheduleModal({
    isOpen,
    onClose,
    invoice,
    schedule,
    onConfirm,
}: OrderScheduleModalProps) {
    const [scheduleType, setScheduleType] = useState<'instant' | 'scheduled'>('scheduled');
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [selectedTime, setSelectedTime] = useState<string>('');
    const [note, setNote] = useState('');
    const [currentWeekStart, setCurrentWeekStart] = useState<Date>(new Date());
    const dateInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            if (schedule) {
                setScheduleType(schedule.type);
                setNote(schedule.note || '');

                if (schedule.dateTime) {
                    const d = new Date(schedule.dateTime);
                    setSelectedDate(d);
                    setCurrentWeekStart(d);

                    // Format to match TIME_SLOTS (hh:00 AM/PM)
                    // We assume slots are hourly.
                    let hours = d.getHours();
                    const ampm = hours >= 12 ? 'PM' : 'AM';
                    hours = hours % 12;
                    hours = hours ? hours : 12;
                    const strTime = `${hours.toString().padStart(2, '0')}:00 ${ampm}`;
                    setSelectedTime(strTime);
                }
            } else {
                setScheduleType('scheduled');
                setSelectedDate(new Date());
                setSelectedTime('');
                setNote('');
                setCurrentWeekStart(new Date());
            }
        }
    }, [isOpen, schedule]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Ensure currentWeekStart is at start of day
    const weekStart = new Date(currentWeekStart);
    weekStart.setHours(0, 0, 0, 0);

    const weekDays = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + i);
        return date;
    });

    const isSameDay = (date1: Date, date2: Date) => {
        return date1.getDate() === date2.getDate() &&
            date1.getMonth() === date2.getMonth() &&
            date1.getFullYear() === date2.getFullYear();
    };

    const formatDate = (date: Date, format: 'EEE' | 'd' | 'MMM') => {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        if (format === 'EEE') return days[date.getDay()];
        if (format === 'd') return date.getDate().toString();
        if (format === 'MMM') return months[date.getMonth()];
        return '';
    };

    const navigateWeek = (direction: 'prev' | 'next') => {
        const newStart = new Date(weekStart);
        newStart.setDate(weekStart.getDate() + (direction === 'next' ? 7 : -7));

        // Prevent going back past current week
        if (direction === 'prev' && newStart < today) {
            // If the new start date is before today, we are trying to go back past the current week.
            // We should only allow this if the current weekStart is already before today.
            // If weekStart is today or in the future, we shouldn't go back further than today.
            if (weekStart.getTime() === today.getTime()) { // If current week starts today, don't go back
                return;
            }
            // If current weekStart is in the future, and newStart goes before today, set to today.
            if (weekStart > today && newStart < today) {
                setCurrentWeekStart(today);
                return;
            }
        }
        setCurrentWeekStart(newStart);
    };

    const canGoPrev = weekStart.getTime() > today.getTime();

    const handleDateSelect = (date: Date) => {
        setSelectedDate(date);
    };

    const handleNativeDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.value) {
            const date = new Date(e.target.value);
            setSelectedDate(date);
            setCurrentWeekStart(date); // Jump to that week
        }
    };

    const handleConfirm = () => {
        if (scheduleType === 'scheduled' && (!selectedDate || !selectedTime)) {
            return;
        }
        onConfirm(
            scheduleType,
            scheduleType === 'scheduled' ? selectedDate : undefined,
            scheduleType === 'scheduled' ? selectedTime : undefined,
            note.trim() || undefined
        );
        // Reset state
        setScheduleType('scheduled');
        setSelectedDate(new Date());
        setSelectedTime('');
        setNote('');
        setCurrentWeekStart(new Date()); // Reset week view
    };

    const handleClose = () => {
        setScheduleType('scheduled');
        setSelectedDate(new Date());
        setSelectedTime('');
        setNote('');
        setCurrentWeekStart(new Date()); // Reset week view
        onClose();
    };

    if (!invoice) return null;

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-md p-5">
                <DialogHeader className="pb-2">
                    <DialogTitle className="text-base font-semibold">Order Schedule</DialogTitle>
                    <div className="flex flex-col gap-1 mt-2 bg-muted/30 p-2 rounded-md border border-border/50">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="font-semibold text-sm">{invoice.invoiceNo}</p>
                                <p className="text-xs text-muted-foreground">{invoice.customerName}</p>
                            </div>
                            <div className="text-right">
                                <p className="font-bold text-sm text-primary">{invoice.totalAmount.toLocaleString()} {invoice.currency}</p>
                                <p className="text-[10px] text-muted-foreground">{invoice.items.length} Items</p>
                            </div>
                        </div>

                        <div className="flex justify-between items-end pt-1 border-t border-border/50 mt-1">
                            <div className="flex text-[10px] gap-1.5 flex-wrap">
                                <span className={`px-2 py-0.5 rounded-full font-medium ${(invoice.status?.toLowerCase() === 'paid') ? 'bg-green-500 text-white' :
                                    (invoice.status?.toLowerCase() === 'overdue') ? 'bg-red-500 text-white' :
                                        'bg-amber-500 text-white'
                                    }`}>
                                    {invoice.status || 'Unknown'}
                                </span>
                                {invoice.returnStatus && invoice.returnStatus !== 'No' && (
                                    <span className="px-2 py-0.5 rounded-full font-medium bg-rose-500 text-white">
                                        {invoice.returnStatus}
                                    </span>
                                )}
                            </div>
                            <div className="text-right flex flex-col items-end">
                                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                    {invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString('en-GB') : ''}
                                </span>
                                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                    {invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : ''}
                                </span>
                            </div>
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-3 py-1">
                    {/* Schedule Type Selection - Compact */}
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => setScheduleType('instant')}
                            className={cn(
                                'flex flex-row items-center justify-center gap-2 p-2 rounded-lg border transition-all h-14',
                                scheduleType === 'instant'
                                    ? 'border-blue-500 bg-blue-50 text-blue-600'
                                    : 'border-gray-300 bg-white hover:border-gray-400'
                            )}
                        >
                            <Zap className="w-3 h-3" />
                            <span className="font-semibold text-xs">Process Now</span>
                        </button>

                        <button
                            onClick={() => setScheduleType('scheduled')}
                            className={cn(
                                'flex flex-row items-center justify-center gap-2 p-2 rounded-lg border transition-all h-14',
                                scheduleType === 'scheduled'
                                    ? 'border-blue-500 bg-blue-50 text-blue-600'
                                    : 'border-gray-300 bg-white hover:border-gray-400'
                            )}
                        >
                            <Calendar className="w-3 h-3" />
                            <span className="font-semibold text-xs">Schedule Later</span>
                        </button>
                    </div>

                    {/* Date & Time Picker for Scheduled */}
                    {scheduleType === 'scheduled' && (
                        <div className="space-y-3 animate-in slide-in-from-top-2 duration-200">
                            {/* Date Navigation */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-medium text-foreground">
                                        Choose Date and Time
                                    </label>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => navigateWeek('prev')}
                                            disabled={!canGoPrev}
                                            className="p-1 hover:bg-muted rounded-md disabled:opacity-30 transition-colors"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => navigateWeek('next')}
                                            className="p-1 hover:bg-muted rounded-md transition-colors"
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                        <div className="relative ml-1">
                                            <button
                                                onClick={() => dateInputRef.current?.showPicker()}
                                                className="p-1 hover:bg-muted rounded-md transition-colors text-primary"
                                            >
                                                <Calendar className="w-4 h-4" />
                                            </button>
                                            <input
                                                type="date"
                                                ref={dateInputRef}
                                                className="absolute top-full right-0 opacity-0 w-0 h-0"
                                                onChange={handleNativeDateChange}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar justify-between">
                                    {weekDays.map((day, index) => (
                                        <button
                                            key={index}
                                            onClick={() => handleDateSelect(day)}
                                            className={cn(
                                                'flex-shrink-0 flex flex-col items-center p-1.5 rounded-lg w-[13.5%] transition-all',
                                                isSameDay(day, selectedDate)
                                                    ? 'bg-blue-500 text-white shadow-sm'
                                                    : 'bg-white hover:bg-gray-50 border border-gray-200 text-gray-700'
                                            )}
                                        >
                                            <span className="text-[9px] font-medium uppercase leading-tight opacity-80">
                                                {formatDate(day, 'EEE')}
                                            </span>
                                            <span className="text-sm font-bold mt-0.5 leading-none">
                                                {formatDate(day, 'd')}
                                            </span>
                                            <span className="text-[9px] mt-0.5 leading-tight">
                                                {formatDate(day, 'MMM')}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Time Slots - Grid Layout */}
                            <div>
                                <div className="grid grid-cols-4 gap-2">
                                    {TIME_SLOTS.map((time) => (
                                        <button
                                            key={time}
                                            onClick={() => setSelectedTime(time)}
                                            className={cn(
                                                'py-1.5 px-0 text-center rounded-md text-[10px] font-medium transition-all border',
                                                selectedTime === time
                                                    ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                                                    : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300 text-gray-700'
                                            )}
                                        >
                                            {time}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Note Field */}
                    <div>
                        <label className="text-xs font-medium text-foreground mb-1.5 block">
                            Note <span className="text-muted-foreground">(Optional)</span>
                        </label>
                        <Textarea
                            placeholder="Add any special instructions..."
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            className="min-h-[50px] resize-none text-xs"
                        />
                    </div>
                </div>

                <div className="flex gap-2 pt-1">
                    <Button variant="outline" className="flex-1 h-8 text-xs bg-white border-gray-300 text-gray-700 hover:bg-gray-50" onClick={handleClose}>
                        Cancel
                    </Button>
                    <Button
                        variant="default"
                        className="flex-1 h-8 text-xs bg-green-500 hover:bg-green-600 text-white"
                        onClick={handleConfirm}
                        disabled={scheduleType === 'scheduled' && !selectedTime}
                    >
                        {scheduleType === 'instant' ? 'Process Now' : 'Schedule Order'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
