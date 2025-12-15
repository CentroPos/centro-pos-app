import { useState } from 'react';
import { cn } from '@renderer/lib/utils';
import { OrderQueueItem, Invoice } from '@renderer/types/picking';
import { Search, Zap, Calendar, Clock, FileText, Trash2 } from 'lucide-react';
import { Input } from '@renderer/components/ui/input';
import { Button } from '@renderer/components/ui/button';

interface OrderQueueTabProps {
  orderQueue: OrderQueueItem[];
  onSelectOrder: (item: OrderQueueItem) => void;
  onRemoveOrder: (id: string) => void;
  onUpdateOrder: (id: string, updates: Partial<OrderQueueItem>) => void;
}

export function OrderQueueTab({
  orderQueue,
  onSelectOrder,
  onRemoveOrder,
  onUpdateOrder,
}: OrderQueueTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<'instant' | 'scheduled'>('instant');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredQueue = orderQueue.filter((item) => {
    const matchesType = item.scheduleType === activeSubTab;
    const matchesSearch = searchQuery === '' ||
      item.invoice.invoiceNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.invoice.customerName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const sortedQueue = [...filteredQueue].sort((a, b) => a.priority - b.priority);

  const instantCount = orderQueue.filter((item) => item.scheduleType === 'instant').length;
  const scheduledCount = orderQueue.filter((item) => item.scheduleType === 'scheduled').length;

  return (
    <div className="h-full flex flex-col">
      <div className="flex border-b border-border">
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

      <div className="p-3 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search invoice or customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 border-gray-200 focus:border-blue-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-2">
        {sortedQueue.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-500">
            <FileText className="w-10 h-10 mb-2 opacity-50" />
            <p className="text-sm">No {activeSubTab} orders in queue</p>
          </div>
        ) : (
          sortedQueue.map((item, index) => (
            <div
              key={item.id}
              className="p-3 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <div 
                  className="flex-1 cursor-pointer"
                  onClick={() => onSelectOrder(item)}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-400 text-white text-xs font-bold flex items-center justify-center">
                      {index + 1}
                    </span>
                    <p className="font-bold text-gray-900 text-sm">{item.invoice.invoiceNo}</p>
                  </div>
                  <p className="text-xs text-gray-600 mt-1 ml-8">
                    {item.invoice.customerName}
                  </p>
                  {item.scheduleType === 'scheduled' && item.scheduledDate && (
                    <div className="flex items-center gap-2 mt-2 ml-8 text-xs text-gray-500">
                      <Calendar className="w-3 h-3" />
                      <span>{item.scheduledDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      {item.scheduledTime && (
                        <>
                          <Clock className="w-3 h-3 ml-2" />
                          <span>{item.scheduledTime}</span>
                        </>
                      )}
                    </div>
                  )}
                  {item.note && (
                    <p className="text-xs text-gray-500 mt-1 ml-8 italic line-clamp-1">
                      "{item.note}"
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => onRemoveOrder(item.id)}
                    className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                    title="Remove from queue"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

