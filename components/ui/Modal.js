import { useEffect, useRef } from 'react';
import Button from './Button';

export default function Modal({
    isOpen,
    onClose,
    title,
    children,
    footer,
    size = 'md',
    showClose = true
}) {
    const modalRef = useRef(null);

    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') onClose();
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const sizes = {
        sm: 'max-w-md',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl',
        full: 'max-w-[95vw]'
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div
                ref={modalRef}
                className={`${sizes[size]} w-full bg-app-bg-secondary border border-app-border rounded-xl shadow-2xl transform transition-all`}
                role="dialog"
                aria-modal="true"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-app-border">
                    <h2 className="text-lg sm:text-xl font-semibold text-app-text-primary">{title}</h2>
                    {showClose && (
                        <button
                            onClick={onClose}
                            className="p-1 text-app-text-secondary hover:text-app-text-primary hover:bg-app-bg-light rounded-lg transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>

                {/* Body */}
                <div className="px-4 sm:px-6 py-3 sm:py-4 max-h-[70vh] overflow-y-auto">
                    {children}
                </div>

                {/* Footer */}
                {footer && (
                    <div className="flex flex-col-reverse xs:flex-row xs:items-center xs:justify-end gap-2 xs:gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-app-border bg-app-bg-light/30 rounded-b-xl">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}

// Confirm dialog variant
export function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title = 'Confirm',
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'danger',
    loading = false
}) {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            size="sm"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={loading}>
                        {cancelText}
                    </Button>
                    <Button variant={variant} onClick={onConfirm} loading={loading}>
                        {confirmText}
                    </Button>
                </>
            }
        >
            <p className="text-app-text-secondary">{message}</p>
        </Modal>
    );
}
