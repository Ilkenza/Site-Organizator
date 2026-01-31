import { memo } from 'react';

// Pre-defined icons as constants (created once, reused everywhere)
const FOLDER_ICON = (
    <svg className="w-3 h-3 flex-shrink-0 opacity-70" fill="currentColor" viewBox="0 0 20 20">
        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
    </svg>
);

const TAG_ICON = (
    <svg className="w-3 h-3 flex-shrink-0 opacity-70" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
);

// Static color mappings (created once)
const COLORS = {
    gray: 'bg-gray-700 text-gray-300',
    blue: 'bg-blue-900/50 text-blue-300 border border-blue-700',
    green: 'bg-green-900/50 text-green-300 border border-green-700',
    red: 'bg-red-900/50 text-red-300 border border-red-700',
    yellow: 'bg-yellow-900/50 text-yellow-300 border border-yellow-700',
    purple: 'bg-purple-900/50 text-purple-300 border border-purple-700',
    pink: 'bg-pink-900/50 text-pink-300 border border-pink-700',
    orange: 'bg-orange-900/50 text-orange-300 border border-orange-700',
    teal: 'bg-teal-900/50 text-teal-300 border border-teal-700',
};

const SIZES = {
    xs: 'px-1.5 py-0.5 text-xs',
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm'
};

function Badge({
    children,
    color = 'gray',
    size = 'sm',
    variant = 'default', // 'default' | 'category' | 'tag'
    removable = false,
    onRemove,
    className = ''
}) {
    // Check if it's a hex color
    const isHexColor = color && color.startsWith('#');

    // For hex colors, use inline styles with the actual color
    const hexStyle = isHexColor ? {
        backgroundColor: `${color}20`,
        color: color,
        border: `1px solid ${color}40`
    } : {};

    const colorClass = isHexColor ? '' : (COLORS[color] || COLORS.gray);
    const roundedClass = variant === 'category' ? 'rounded-md' : 'rounded-full';

    return (
        <span
            className={`inline-flex items-center gap-1 ${roundedClass} font-medium ${colorClass} ${SIZES[size]} ${className}`}
            style={hexStyle}
        >
            {/* Category folder icon */}
            {variant === 'category' && FOLDER_ICON}
            {/* Tag icon */}
            {variant === 'tag' && TAG_ICON}
            {children}
            {removable && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove?.();
                    }}
                    className="ml-0.5 hover:bg-white/10 rounded-full p-0.5 transition-colors"
                >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            )}
        </span>
    );
}

export default memo(Badge);
