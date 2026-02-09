import { memo } from 'react';
import { FolderFilledIcon, TagFilledIcon, CloseIcon } from './Icons';

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
            {variant === 'category' && <FolderFilledIcon className="w-3 h-3 flex-shrink-0 opacity-70" />}
            {/* Tag icon */}
            {variant === 'tag' && <TagFilledIcon className="w-3 h-3 flex-shrink-0 opacity-70" />}
            {children}
            {removable && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove?.();
                    }}
                    className="ml-0.5 hover:bg-white/10 rounded-full p-0.5 transition-colors"
                >
                    <CloseIcon className="w-3 h-3" />
                </button>
            )}
        </span>
    );
}

export default memo(Badge);
