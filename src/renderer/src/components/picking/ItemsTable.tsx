import { InvoiceItem } from '@renderer/types/picking';
import { Checkbox } from '@renderer/components/ui/checkbox';
import { Package } from 'lucide-react';

interface ItemsTableProps {
    items: InvoiceItem[];
    selectedItems: Set<string>;
    onToggleItem: (itemId: string) => void;
    onToggleAll: () => void;
}

export function ItemsTable({
    items,
    selectedItems,
    onToggleItem,
    onToggleAll,
}: ItemsTableProps) {
    const allSelected = items.length > 0 && items.every((item) => selectedItems.has(item.id));

    return (
        <div className="h-full overflow-auto">
            <table className="w-full">
                <thead className="bg-muted sticky top-0 z-10">
                    <tr className="border-b border-border">
                        <th className="p-3 text-left w-12">
                            <Checkbox
                                checked={allSelected}
                                onCheckedChange={onToggleAll}
                                className="h-4 w-4"
                            />
                        </th>
                        <th className="p-3 pl-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-16">
                            Sl No
                        </th>
                        <th className="p-3 pl-10 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Item
                        </th>
                        <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Category
                        </th>
                        <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            UOM
                        </th>
                        <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Quantity
                        </th>
                        <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Packing No
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item) => (
                        <tr
                            key={item.id}
                            className={`border-b border-border transition-colors ${selectedItems.has(item.id)
                                ? 'bg-primary/10'
                                : item.isAssigned
                                    ? 'bg-green-50'
                                    : 'hover:bg-muted/50'
                                }`}
                        >
                            <td className="p-3">
                                <Checkbox
                                    checked={selectedItems.has(item.id)}
                                    onCheckedChange={() => onToggleItem(item.id)}
                                    disabled={item.isAssigned}
                                    className="h-4 w-4"
                                />
                            </td>
                            <td className="p-3 font-medium text-muted-foreground text-sm">{item.slNo}</td>
                            <td className="p-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                                        <Package className="w-4 h-4 text-muted-foreground" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-foreground text-sm">{item.itemName}</p>
                                        <p className="text-xs text-muted-foreground">{item.itemCode}</p>
                                    </div>
                                </div>
                            </td>
                            <td className="p-3">
                                <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs">
                                    {item.category}
                                </span>
                            </td>
                            <td className="p-3 text-muted-foreground text-sm">{item.uom}</td>
                            <td className="p-3 font-semibold tabular-nums text-sm">{item.quantity.toFixed(2)}</td>
                            <td className="p-3 text-muted-foreground text-sm">{item.packingNo}</td>
                        </tr>
                    ))}
                    {items.length === 0 && (
                        <tr>
                            <td colSpan={7} className="p-8 text-center text-muted-foreground text-sm">
                                No items to display
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}

