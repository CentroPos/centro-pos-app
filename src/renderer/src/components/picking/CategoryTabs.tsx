import { cn } from '@renderer/lib/utils';

interface CategoryTabsProps {
  categories: string[];
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}

export function CategoryTabs({
  categories,
  activeCategory,
  onCategoryChange,
}: CategoryTabsProps) {
  return (
    <div className="border-b border-border bg-card flex-shrink-0">
      <div className="flex gap-1 px-2 py-1.5 overflow-x-auto scrollbar-hide">
        <button
          onClick={() => onCategoryChange('All')}
          className={cn(
            'px-3 py-1.5 rounded font-medium text-xs whitespace-nowrap transition-all border',
            activeCategory === 'All'
              ? 'bg-gray-200 border-border text-foreground'
              : 'bg-card border-border text-muted-foreground hover:bg-muted/50'
          )}
        >
          All
        </button>
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => onCategoryChange(category)}
            className={cn(
              'px-3 py-1.5 rounded font-medium text-xs whitespace-nowrap transition-all border',
              activeCategory === category
                ? 'bg-gray-200 border-border text-foreground'
                : 'bg-card border-border text-muted-foreground hover:bg-muted/50'
            )}
          >
            {category}
          </button>
        ))}
      </div>
    </div>
  );
}

