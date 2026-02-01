import { useState, useRef, useEffect } from 'react';

export default function InlineEditableName({ value, onSave, onCancel, className = '' }) {
    const [editValue, setEditValue] = useState(value);
    const inputRef = useRef(null);

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, []);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (editValue.trim() && editValue !== value) {
                onSave(editValue.trim());
            } else {
                onCancel();
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
        }
    };

    const handleBlur = () => {
        if (editValue.trim() && editValue !== value) {
            onSave(editValue.trim());
        } else {
            onCancel();
        }
    };

    return (
        <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            className={`block font-semibold text-app-text-primary bg-app-bg-card px-2 py-1 sm:px-1 sm:py-0 w-full border border-app-border focus:border-app-accent rounded-md focus:outline-none focus:ring-2 focus:ring-app-accent leading-tight m-0 h-auto align-baseline text-sm sm:text-base ${className}`}
            onClick={(e) => e.stopPropagation()}
        />
    );
}
