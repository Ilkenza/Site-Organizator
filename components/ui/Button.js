import { SpinnerFullIcon } from './Icons';

export default function Button({
    children,
    variant = 'primary',
    size = 'md',
    disabled = false,
    loading = false,
    className = '',
    onClick,
    type = 'button',
    ...props
}) {
    const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

    const variants = {
        primary: 'bg-app-accent text-app-bg-primary hover:bg-app-accentLight focus:ring-app-accent',
        secondary: 'bg-app-bg-light text-app-text-primary hover:bg-app-bg-lighter focus:ring-app-accent',
        danger: 'bg-btn-danger text-white hover:bg-btn-dangerHover focus:ring-btn-danger',
        success: 'bg-success-bg text-success-text hover:opacity-90 focus:ring-success-bg',
        ghost: 'bg-transparent text-app-text-secondary hover:bg-app-bg-light focus:ring-app-accent',
        outline: 'border border-app-border text-app-text-primary hover:bg-app-bg-light focus:ring-app-accent'
    };

    const sizes = {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2 text-sm',
        lg: 'px-6 py-3 text-base'
    };

    return (
        <button
            type={type}
            disabled={disabled || loading}
            onClick={onClick}
            className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
            {...props}
        >
            {loading && (
                <SpinnerFullIcon className="animate-spin -ml-1 mr-2 h-4 w-4" />
            )}
            {children}
        </button>
    );
}
