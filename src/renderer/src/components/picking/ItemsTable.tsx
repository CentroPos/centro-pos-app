import { useState, useMemo } from 'react';
import { InvoiceItem } from '@renderer/types/picking';
import { Checkbox } from '@renderer/components/ui/checkbox';
import { Package, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

interface ItemsTableProps {
    items: InvoiceItem[];
    selectedItems: Set<string>;
    onToggleItem: (itemId: string) => void;
    onToggleAll: () => void;
}

type SortDirection = 'asc' | 'desc' | 'none';

export function ItemsTable({
    items,
    selectedItems,
    onToggleItem,
    onToggleAll,
}: ItemsTableProps) {
    const [sortDirection, setSortDirection] = useState<SortDirection>('none');

    const unassignedItems = items.filter(item => !item.isAssigned);
    const allSelected = unassignedItems.length > 0 && unassignedItems.every((item) => selectedItems.has(item.id));

    const handleSort = () => {
        setSortDirection(prev => {
            if (prev === 'none') return 'desc';
            if (prev === 'desc') return 'asc';
            return 'none';
        });
    };

    const sortedItems = useMemo(() => {
        if (sortDirection === 'none') return items;

        return [...items].sort((a, b) => {
            if (sortDirection === 'asc') {
                return a.quantity - b.quantity;
            } else {
                return b.quantity - a.quantity;
            }
        });
    }, [items, sortDirection]);

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
                                disabled={unassignedItems.length === 0}
                            />
                        </th>
                        <th className="p-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider w-16">
                            Sl No
                        </th>
                        <th className="p-3 pl-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Item
                        </th>
                        <th className="p-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Category
                        </th>
                        <th className="p-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            UOM
                        </th>
                        <th
                            className="p-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted-foreground/5 transition-colors select-none"
                            onClick={handleSort}
                        >
                            <div className="flex items-center justify-center gap-1 text-center text-xs font-semibold text-muted-foreground uppercase">
                                Quantity
                                {sortDirection === 'none' && <ArrowUpDown className="w-3 h-3 text-muted-foreground/50" />}
                                {sortDirection === 'asc' && <ArrowUp className="w-3 h-3 text-muted-foreground/90 font-bold" />}
                                {sortDirection === 'desc' && <ArrowDown className="w-3 h-3 text-muted-foreground/90 font-bold" />}
                            </div>
                        </th>
                        <th className="p-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Packing No
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {sortedItems.map((item) => (
                        <tr
                            key={item.id}
                            className={`border-b border-border transition-colors ${selectedItems.has(item.id)
                                ? 'bg-primary/10'
                                : item.isAssigned
                                    ? 'bg-green-100'
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
                            <td className="p-3 font-medium text-muted-foreground text-sm text-center">{item.slNo}</td>
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
                            <td className="p-3 text-center">
                                <span className="inline-block px-3 py-1 rounded-md border bg-white border-gray-200 text-xs font-bold text-gray-700 shadow-sm whitespace-nowrap">
                                    {item.category}
                                </span>
                            </td>
                            <td className="p-3 text-muted-foreground text-sm text-center">{item.uom}</td>
                            <td className="p-3 font-semibold tabular-nums text-sm text-center">{item.quantity.toFixed(2)}</td>
                            <td className="p-3 text-muted-foreground text-sm text-center">{item.packingNo}</td>
                        </tr>
                    ))}
                    {sortedItems.length === 0 && (
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

