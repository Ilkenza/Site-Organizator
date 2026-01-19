export default function Input({
    label,
    error,
    helperText,
    className = '',
    ...props
}) {
    return (
        <div className={`space-y-1.5 ${className}`}>
            {label && (
                <label className="block text-sm font-medium text-app-text-primary">
                    {label}
                </label>
            )}
            <input
                className={`w-full px-3 py-2 bg-app-bg-light border rounded-lg text-app-text-primary placeholder-app-text-tertiary 
          focus:outline-none focus:ring-2 focus:ring-app-accent focus:border-transparent
          transition-colors disabled:opacity-50 disabled:cursor-not-allowed
          ${error ? 'border-error-text' : 'border-app-border hover:border-app-accent/50'}`}
                {...props}
            />
            {error && <p className="text-sm text-error-text">{error}</p>}
            {helperText && !error && <p className="text-sm text-app-text-secondary">{helperText}</p>}
        </div>
    );
}

export function Textarea({
    label,
    error,
    helperText,
    className = '',
    rows = 3,
    ...props
}) {
    return (
        <div className={`space-y-1.5 ${className}`}>
            {label && (
                <label className="block text-sm font-medium text-app-text-primary">
                    {label}
                </label>
            )}
            <textarea
                rows={rows}
                className={`w-full px-3 py-2 bg-app-bg-light border rounded-lg text-app-text-primary placeholder-app-text-tertiary 
          focus:outline-none focus:ring-2 focus:ring-app-accent focus:border-transparent
          transition-colors resize-none disabled:opacity-50 disabled:cursor-not-allowed
          ${error ? 'border-error-text' : 'border-app-border hover:border-app-accent/50'}`}
                {...props}
            />
            {error && <p className="text-sm text-error-text">{error}</p>}
            {helperText && !error && <p className="text-sm text-app-text-secondary">{helperText}</p>}
        </div>
    );
}

export function Select({
    label,
    error,
    options = [],
    placeholder = 'Select...',
    className = '',
    ...props
}) {
    return (
        <div className={`space-y-1.5 ${className}`}>
            {label && (
                <label className="block text-sm font-medium text-gray-300">
                    {label}
                </label>
            )}
            <select
                className={`w-full px-3 py-2 bg-gray-800 border rounded-lg text-white 
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
          transition-colors disabled:opacity-50 disabled:cursor-not-allowed
          ${error ? 'border-red-500' : 'border-gray-700 hover:border-gray-600'}`}
                {...props}
            >
                <option value="">{placeholder}</option>
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
            {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
    );
}
