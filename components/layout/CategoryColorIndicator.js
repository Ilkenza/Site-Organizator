/**
 * CategoryColorIndicator Component
 * Displays the selected category with its color badge
 * Appears below the sites list when a category filter is active
 */

export default function CategoryColorIndicator({ category }) {
    if (!category) return null;

    const categoryColor = category.color || '#6CBBFB';

    return (
        <div className="flex items-center gap-2 px-4 py-3 bg-app-bg-light/30 border-t border-app-border/50 rounded-b-lg">
            <span className="text-xs text-app-text-tertiary font-medium uppercase tracking-wider">
                Selected Category:
            </span>
            <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium text-sm text-white"
                style={{ backgroundColor: categoryColor }}
            >
                <span className="w-2 h-2 rounded-full bg-white/60"></span>
                {category.name}
            </div>
        </div>
    );
}
