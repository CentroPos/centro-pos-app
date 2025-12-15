import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@renderer/components/ui/dialog';
import { Button } from '@renderer/components/ui/button';
import { Textarea } from '@renderer/components/ui/textarea';
import { cn } from '@renderer/lib/utils';
import { Invoice } from '@renderer/types/picking';
import { Zap, Calendar, Clock } from 'lucide-react';

interface OrderScheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
    invoice: Invoice | null;
    onConfirm: (scheduleType: 'instant' | 'scheduled', scheduledDate?: Date, scheduledTime?: string, note?: string) => void;
}

const TIME_SLOTS = [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
    '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
    '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
];

export function OrderScheduleModal({
    isOpen,
    onClose,
    invoice,
    onConfirm,
}: OrderScheduleModalProps) {
    const [scheduleType, setScheduleType] = useState<'instant' | 'scheduled'>('scheduled');
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [selectedTime, setSelectedTime] = useState<string>('');
    const [note, setNote] = useState('');

    const today = new Date();
    const weekDays = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
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
    };

    const handleClose = () => {
        setScheduleType('scheduled');
        setSelectedDate(new Date());
        setSelectedTime('');
        setNote('');
        onClose();
    };

    if (!invoice) return null;

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-md p-5">
                <DialogHeader className="pb-2">
                    <DialogTitle className="text-base font-semibold">Order Schedule</DialogTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {invoice.invoiceNo} · {invoice.customerName}
                    </p>
                </DialogHeader>

                <div className="space-y-3 py-1">
                    {/* Schedule Type Selection */}
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => setScheduleType('instant')}
                            className={cn(
                                'flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all',
                                scheduleType === 'instant'
                                    ? 'border-blue-500 bg-blue-50 text-blue-600'
                                    : 'border-gray-300 bg-white hover:border-gray-400'
                            )}
                        >
                            <div className={cn(
                                'w-9 h-9 rounded-full flex items-center justify-center',
                                scheduleType === 'instant' ? 'bg-blue-500 text-white' : 'bg-gray-200'
                            )}>
                                <Zap className="w-4 h-4" />
                            </div>
                            <span className="font-semibold text-xs">Instant</span>
                            <span className="text-[10px] text-muted-foreground">Process Now</span>
                        </button>

                        <button
                            onClick={() => setScheduleType('scheduled')}
                            className={cn(
                                'flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all',
                                scheduleType === 'scheduled'
                                    ? 'border-blue-500 bg-blue-50 text-blue-600'
                                    : 'border-gray-300 bg-white hover:border-gray-400'
                            )}
                        >
                            <div className={cn(
                                'w-9 h-9 rounded-full flex items-center justify-center',
                                scheduleType === 'scheduled' ? 'bg-blue-500 text-white' : 'bg-gray-200'
                            )}>
                                <Calendar className="w-4 h-4" />
                            </div>
                            <span className="font-semibold text-xs">Scheduled</span>
                            <span className="text-[10px] text-muted-foreground">Pick Later</span>
                        </button>
                    </div>

                    {/* Date & Time Picker for Scheduled */}
                    {scheduleType === 'scheduled' && (
                        <div className="space-y-2.5 animate-in slide-in-from-top-2 duration-200">
                            {/* Quick Week View */}
                            <div>
                                <label className="text-xs font-medium text-foreground mb-1.5 block">
                                    Select Date
                                </label>
                                <div className="flex gap-1.5 overflow-x-auto pb-1">
                                    {weekDays.map((day, index) => (
                                        <button
                                            key={index}
                                            onClick={() => setSelectedDate(day)}
                                            className={cn(
                                                'flex-shrink-0 flex flex-col items-center p-1.5 rounded-lg min-w-[55px] transition-all',
                                                isSameDay(day, selectedDate)
                                                    ? 'bg-blue-500 text-white'
                                                    : 'bg-white hover:bg-gray-50 border border-gray-200'
                                            )}
                                        >
                                            <span className="text-[9px] font-medium uppercase leading-tight">
                                                {formatDate(day, 'EEE')}
                                            </span>
                                            <span className="text-base font-bold mt-0.5 leading-none">
                                                {formatDate(day, 'd')}
                                            </span>
                                            <span className="text-[9px] mt-0.5 leading-tight">
                                                {formatDate(day, 'MMM')}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Time Slots */}
                            <div>
                                <label className="text-xs font-medium text-foreground mb-1.5 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    Select Time
                                </label>
                                <div className="grid grid-cols-4 gap-1.5 max-h-[160px] overflow-y-auto pr-1">
                                    {TIME_SLOTS.map((time) => (
                                        <button
                                            key={time}
                                            onClick={() => setSelectedTime(time)}
                                            className={cn(
                                                'py-1.5 px-1.5 rounded-md text-[11px] font-medium transition-all border',
                                                selectedTime === time
                                                    ? 'bg-blue-500 text-white border-blue-500'
                                                    : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300'
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
                            className="min-h-[60px] resize-none text-xs"
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

