import { useState, useEffect } from 'react';
import { CheckmarkIcon, CloseIcon, WarningFilledIcon, InfoFilledIcon } from './Icons';

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
        success: () => <CheckmarkIcon className="w-5 h-5" strokeWidth={3} />,
        error: () => <CloseIcon className="w-5 h-5" strokeWidth={3} />,
        warning: () => <WarningFilledIcon className="w-5 h-5" />,
        info: () => <InfoFilledIcon className="w-5 h-5" />
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
                <CloseIcon className="w-4 h-4" />
            </button>
        </div>
    );
}
