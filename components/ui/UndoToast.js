import { useEffect, useState } from 'react';

export default function UndoToast({ message, onUndo, onClose, duration = 5000 }) {
    const [timeLeft, setTimeLeft] = useState(duration);
    const [isVisible, setIsVisible] = useState(true);

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
    }, []);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(() => onClose?.(), 300);
    };

    const handleUndo = () => {
        onUndo?.();
        handleClose();
    };

    if (!isVisible) return null;

    const progress = (timeLeft / duration) * 100;

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slideUp">
            <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl px-4 py-3 flex items-center gap-4 min-w-[320px] backdrop-blur-lg">
                {/* Icon */}
                <div className="flex-shrink-0">
                    <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>

                {/* Message */}
                <p className="text-sm text-gray-200 flex-1">{message}</p>

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
                    className="flex-shrink-0 text-gray-400 hover:text-gray-200 transition-colors"
                    aria-label="Close"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* Progress Bar */}
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-800 rounded-b-lg overflow-hidden">
                    <div
                        className="h-full bg-app-accent transition-all duration-100 ease-linear"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>
        </div>
    );
}
