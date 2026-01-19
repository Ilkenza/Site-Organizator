/**
 * CategoryColorIndicator Component
 * Displays the selected category with its color badge
 * Appears below the sites list when a category filter is active
 */

export default function CategoryColorIndicator({ category }) {
    if (!category) return null;

    // Map category colors
    const categoryColorMap = {
        purple: { bg: '#667eea', label: 'Purple' },
        blue: { bg: '#6CBBFB', label: 'Blue' },
        teal: { bg: '#52A69B', label: 'Teal' },
        coral: { bg: '#D98B8B', label: 'Coral' },
        orange: { bg: '#E0A96D', label: 'Orange' },
        rose: { bg: '#D98BAC', label: 'Rose' },
        gold: { bg: '#D4B86A', label: 'Gold' }
    };

    const categoryColor = categoryColorMap[category.color] || categoryColorMap.blue;
    const contrastText = ['coral', 'orange', 'gold'].includes(category.color) ? '#050a30' : '#E0E8F7';

    return (
        <div className="flex items-center gap-2 px-4 py-3 bg-app-bg-light/30 border-t border-app-border/50 rounded-b-lg">
            <span className="text-xs text-app-text-tertiary font-medium uppercase tracking-wider">
                Selected Category:
            </span>
            <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium text-sm"
                style={{
                    backgroundColor: categoryColor.bg,
                    color: contrastText
                }}
            >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: contrastText, opacity: 0.6 }}></span>
                {category.name}
            </div>
        </div>
    );
}
