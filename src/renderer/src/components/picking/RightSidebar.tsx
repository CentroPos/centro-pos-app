import { WarehouseOperation, PickSlip, OrderQueueItem, Invoice } from '@renderer/types/picking';
import { cn } from '@renderer/lib/utils';
import { OrderQueueTab } from './OrderQueueTab';
import { FileText, Search } from 'lucide-react';
import { useState } from 'react';
import { Input } from '@renderer/components/ui/input';

interface RightSidebarProps {
  activeTab: 'details' | 'sales' | 'queue';
  onTabChange: (tab: 'details' | 'sales' | 'queue') => void;
  operations: WarehouseOperation[];
  pickSlips: PickSlip[];
  onManageOperations: () => void;
  onPickSlipClick?: (pickSlip: PickSlip) => void;
  orderQueue: OrderQueueItem[];
  onSelectQueueOrder: (item: OrderQueueItem) => void;
  onRemoveQueueOrder: (id: string) => void;
  onUpdateQueueOrder: (id: string, updates: Partial<OrderQueueItem>) => void;
  invoices?: Invoice[];
  onSelectInvoice?: (invoice: Invoice) => void;
}

export function RightSidebar({
  activeTab,
  onTabChange,
  operations,
  pickSlips,
  onManageOperations,
  onPickSlipClick,
  orderQueue,
  onSelectQueueOrder,
  onRemoveQueueOrder,
  onUpdateQueueOrder,
  invoices = [],
  onSelectInvoice,
}: RightSidebarProps) {
  const [salesSearchQuery, setSalesSearchQuery] = useState('');

  const getStatusClass = (status: PickSlip['status']) => {
    switch (status) {
      case 'not-started':
        return 'bg-red-100 text-red-700';
      case 'in-progress':
        return 'bg-yellow-100 text-yellow-700';
      case 'picked':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status: PickSlip['status']) => {
    switch (status) {
      case 'not-started':
        return 'Not Started';
      case 'in-progress':
        return 'In Progress';
      case 'picked':
        return 'Picked';
      default:
        return status;
    }
  };

  const hasPickSlips = pickSlips.length > 0;
  const filteredInvoices = invoices.filter(
    (inv) =>
      inv.invoiceNo.toLowerCase().includes(salesSearchQuery.toLowerCase()) ||
      inv.customerName.toLowerCase().includes(salesSearchQuery.toLowerCase())
  );

  return (
    <div className="w-96 border-l border-border bg-card flex flex-col flex-shrink-0 h-full">
      <div className="flex border-b border-border flex-shrink-0">
        <button
          onClick={() => onTabChange('details')}
          className={cn(
            'flex-1 px-4 py-2.5 text-sm font-medium transition-colors border-b-2',
            activeTab === 'details'
              ? 'text-primary border-primary'
              : 'text-muted-foreground border-transparent hover:text-foreground'
          )}
        >
          Details
        </button>
        <button
          onClick={() => onTabChange('sales')}
          className={cn(
            'flex-1 px-4 py-2.5 text-sm font-medium transition-colors border-b-2',
            activeTab === 'sales'
              ? 'text-primary border-primary'
              : 'text-muted-foreground border-transparent hover:text-foreground'
          )}
        >
          Sales
        </button>
        <button
          onClick={() => onTabChange('queue')}
          className={cn(
            'flex-1 px-4 py-2.5 text-sm font-medium transition-colors relative border-b-2',
            activeTab === 'queue'
              ? 'text-primary border-primary'
              : 'text-muted-foreground border-transparent hover:text-foreground'
          )}
        >
          Queue
          {orderQueue.length > 0 && (
            <span className="absolute top-1 right-2 w-5 h-5 rounded-full bg-green-600 text-white text-xs flex items-center justify-center">
              {orderQueue.length}
            </span>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {activeTab === 'details' && (
          <div className="p-4 space-y-6">
            {hasPickSlips && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-foreground">Warehouse Operations</h3>
                  <button
                    onClick={onManageOperations}
                    className="text-sm text-primary hover:underline"
                  >
                    Manage
                  </button>
                </div>
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                          Warehouse
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                          Type
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {operations.map((op) => (
                        <tr key={op.warehouseId} className="border-t border-border">
                          <td className="px-3 py-2 text-foreground">{op.warehouseName}</td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {op.isCustomerPickup ? 'Pickup' : 'Transfer'}
                          </td>
                          <td className="px-3 py-2">
                            <span className={cn(
                              "px-2 py-1 rounded-full text-xs",
                              op.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                            )}>
                              {op.status === 'draft' ? 'Draft' : 'Confirmed'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div>
              <h3 className="font-semibold text-foreground mb-3">Picking Slips</h3>
              <div className="space-y-2">
                {pickSlips.map((slip) => (
                  <div
                    key={slip.id}
                    onClick={() => onPickSlipClick?.(slip)}
                    className="p-3 border border-border rounded-lg bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-foreground">{slip.slipNo}</p>
                        <p className="text-xs text-muted-foreground">
                          {slip.items.length} Items
                        </p>
                      </div>
                      <span className={cn('px-2 py-1 rounded-full text-xs', getStatusClass(slip.status))}>
                        {getStatusLabel(slip.status)}
                        {slip.durationMinutes && ` · ${slip.durationMinutes} Min`}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {slip.warehouseName} · {slip.pickerName}
                    </div>
                  </div>
                ))}
                {pickSlips.length === 0 && (
                  <div className="p-4 text-center text-muted-foreground text-sm border border-dashed border-border rounded-lg">
                    No pick slips created yet
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'sales' && (
          <div className="p-4 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search invoice..."
                value={salesSearchQuery}
                onChange={(e) => setSalesSearchQuery(e.target.value)}
                className="pl-10 border-gray-200 focus:border-blue-500"
              />
            </div>
            
            <div className="space-y-2">
              {filteredInvoices.map((invoice) => (
                <button
                  key={invoice.id}
                  onClick={() => onSelectInvoice?.(invoice)}
                  className="w-full p-3 text-left bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-50 border border-green-200 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-gray-900 text-sm">{invoice.invoiceNo}</p>
                        <span className="text-sm font-semibold text-blue-400">
                          {invoice.totalAmount.toLocaleString()} {invoice.currency}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        {invoice.customerName}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {invoice.items.length} items
                      </p>
                    </div>
                  </div>
                </button>
              ))}
              {filteredInvoices.length === 0 && (
                <div className="py-8 text-center text-gray-500 text-sm">
                  No invoices found
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'queue' && (
          <OrderQueueTab
            orderQueue={orderQueue}
            onSelectOrder={onSelectQueueOrder}
            onRemoveOrder={onRemoveQueueOrder}
            onUpdateOrder={onUpdateQueueOrder}
          />
        )}
      </div>
    </div>
  );
}

