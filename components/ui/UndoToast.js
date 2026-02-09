import { useEffect, useState, useCallback } from 'react';
import { WarningIcon, CloseIcon } from './Icons';

export default function UndoToast({ message, onUndo, onClose, duration = 5000 }) {
    const [timeLeft, setTimeLeft] = useState(duration);
    const [isVisible, setIsVisible] = useState(true);

    const handleClose = useCallback(() => {
        setIsVisible(false);
        setTimeout(() => onClose?.(), 300);
    }, [onClose]);

    useEffect(() => {
        const interval = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 100) {
                    clearInterval(interval);
                    handleClose();
                    return 0;
                }
                return prev - 100;
            });
        }, 100);

        return () => clearInterval(interval);
    }, [handleClose]);

    const handleUndo = () => {
        onUndo?.();
        handleClose();
    };

    if (!isVisible) return null;

    const progress = (timeLeft / duration) * 100;

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slideUp">
            <div className="bg-app-bg-primary border border-app-border rounded-lg shadow-2xl px-4 py-3 flex items-center gap-4 min-w-[320px] backdrop-blur-lg">
                {/* Icon */}
                <div className="flex-shrink-0">
                    <WarningIcon className="w-5 h-5 text-app-accent" />
                </div>

                {/* Message */}
                <p className="text-sm text-app-text-primary flex-1">{message}</p>

                {/* Undo Button */}
                <button
                    onClick={handleUndo}
                    className="px-3 py-1.5 text-sm font-medium text-app-accent hover:text-app-accentLight bg-app-accent/10 hover:bg-app-accent/20 rounded-md transition-colors"
                >
                    Undo
                </button>

                {/* Close Button */}
                <button
                    onClick={handleClose}
                    className="flex-shrink-0 text-app-text-secondary hover:text-app-text-primary transition-colors"
                    aria-label="Close"
                >
                    <CloseIcon className="w-4 h-4" />
                </button>

                {/* Progress Bar */}
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-app-bg-secondary rounded-b-lg overflow-hidden">
                    <div
                        className="h-full bg-app-accent transition-all duration-100 ease-linear"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>
        </div>
    );
}
