import { cn } from '@renderer/lib/utils';
import { Search, RotateCcw } from 'lucide-react';

interface Category {
    label: string;
    count: number;
}

interface CategoryTabsProps {
    categories: Category[];
    activeCategory: string;
    onCategoryChange: (category: string) => void;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    onRefresh: () => void;
    isRefreshing?: boolean;
}

export function CategoryTabs({
    categories,
    activeCategory,
    onCategoryChange,
    searchQuery,
    onSearchChange,
    onRefresh,
    isRefreshing
}: CategoryTabsProps) {
    return (
        <div className="border-b border-border bg-card flex-shrink-0">
            <div className="flex items-center justify-between px-2 py-2 gap-4">
                {/* Scrollable Tabs */}
                <div className="flex gap-2 overflow-x-auto scrollbar-hide flex-1">
                    {categories.map((category) => (
                        <button
                            key={category.label}
                            onClick={() => onCategoryChange(category.label)}
                            className={cn(
                                'px-4 py-2.5 rounded-lg font-bold text-xs whitespace-nowrap transition-all border uppercase flex items-center gap-2',
                                activeCategory === category.label
                                    ? 'bg-slate-800 border-slate-700 text-white shadow-sm'
                                    : 'bg-white border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                            )}
                        >
                            <span>{category.label}</span>
                            <span className={cn(
                                "px-1.5 py-0.5 rounded text-[10px]",
                                activeCategory === category.label
                                    ? 'bg-white/20 text-white'
                                    : 'bg-slate-200 text-slate-700'
                            )}>
                                {category.count}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Right Side Controls */}
                <div className="flex items-center gap-2 flex-shrink-0 border-l border-border pl-4">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="SEARCH ITEM..."
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="h-10 w-[280px] pl-9 pr-3 rounded-lg border border-border bg-muted/30 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/70 uppercase"
                        />
                    </div>

                    <button
                        onClick={onRefresh}
                        className={cn("h-10 w-10 flex items-center justify-center rounded-lg border border-border transition-colors text-muted-foreground hover:text-foreground", isRefreshing ? "opacity-50 cursor-not-allowed bg-muted" : "hover:bg-muted")}
                        title="Refresh Items"
                        disabled={isRefreshing}
                    >
                        <RotateCcw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
                    </button>
                </div>
            </div>
        </div>
    );
}

