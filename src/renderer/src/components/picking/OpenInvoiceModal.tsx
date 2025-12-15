import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@renderer/components/ui/dialog';
import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
import { Invoice } from '@renderer/types/picking';
import { Search, FileText } from 'lucide-react';

interface OpenInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoices: Invoice[];
  onSelectInvoice: (invoice: Invoice) => void;
}

export function OpenInvoiceModal({
  isOpen,
  onClose,
  invoices,
  onSelectInvoice,
}: OpenInvoiceModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredInvoices = invoices.filter(
    (inv) =>
      inv.invoiceNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.customerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
              placeholder="Search invoice number or customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="max-h-[300px] overflow-auto space-y-2">
            {filteredInvoices.map((invoice) => (
              <button
                key={invoice.id}
                onClick={() => handleSelect(invoice)}
                className="w-full p-4 text-left border border-border rounded-lg hover:bg-muted transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-foreground">{invoice.invoiceNo}</p>
                      <span className="text-sm font-medium text-primary">
                        {invoice.totalAmount.toLocaleString()} {invoice.currency}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {invoice.customerName}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {invoice.items.length} items
                    </p>
                  </div>
                </div>
              </button>
            ))}
            {filteredInvoices.length === 0 && (
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

