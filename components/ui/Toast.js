import { useState, useEffect } from 'react';

export default function Toast({ message, type = 'info', duration = 3000, onClose }) {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(false);
            onClose?.();
        }, duration);

        return () => clearTimeout(timer);
    }, [duration, onClose]);

    const handleClose = () => {
        setIsVisible(false);
        onClose?.();
    };

    if (!isVisible) return null;

    const bgColor = {
        success: 'bg-success-bg',
        error: 'bg-btn-danger',
        warning: 'bg-app-accent',
        info: 'bg-app-accent'
    }[type] || 'bg-app-accent';

    const Icon = {
        success: () => (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
        ),
        error: () => (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
        ),
        warning: () => (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13 13h-2v-4h2v4zm0 8h-2v-2h2v2zm-1-15C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
            </svg>
        ),
        info: () => (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
            </svg>
        )
    }[type] || (() => null);

    return (
        <div
            className={`fixed bottom-4 right-4 ${bgColor} text-white px-4 py-3 rounded-lg shadow-xl flex items-center gap-3 z-50 max-w-xs animate-slideUp`}
        >
            <Icon />
            <span className="text-sm font-medium flex-1">{message}</span>
            <button
                onClick={handleClose}
                className="p-1 hover:bg-white/10 rounded transition-colors flex-shrink-0"
                aria-label="Close"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    );
}
