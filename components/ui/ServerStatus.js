import { useState, useEffect } from 'react';

export default function ServerStatus() {
    const [status, setStatus] = useState('checking'); // 'online', 'offline', 'checking'
    const [lastCheck, setLastCheck] = useState(null);

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const response = await fetch('/api/health', {
                    method: 'GET',
                    cache: 'no-store'
                });

                if (response.ok) {
                    setStatus('online');
                } else {
                    setStatus('offline');
                }
                setLastCheck(new Date());
            } catch (error) {
                setStatus('offline');
                setLastCheck(new Date());
            }
        };

        // Check immediately
        checkStatus();

        // Check every 30 seconds
        const interval = setInterval(checkStatus, 30000);

        return () => clearInterval(interval);
    }, []);

    const getStatusColor = () => {
        switch (status) {
            case 'online':
                return 'bg-green-500';
            case 'offline':
                return 'bg-red-500';
            case 'checking':
                return 'bg-yellow-500 animate-pulse';
            default:
                return 'bg-gray-500';
        }
    };

    const getStatusText = () => {
        switch (status) {
            case 'online':
                return 'Online';
            case 'offline':
                return 'Offline';
            case 'checking':
                return 'Checking...';
            default:
                return 'Unknown';
        }
    };

    return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-app-bg-light/50 rounded-lg border border-app-border group relative">
            {/* Status Dot */}
            <div className="relative">
                <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
                {status === 'online' && (
                    <div className={`absolute inset-0 w-2 h-2 rounded-full ${getStatusColor()} animate-ping opacity-75`} />
                )}
            </div>

            {/* Status Text - Hidden on mobile, visible on hover */}
            <span className="text-xs font-medium text-app-text-secondary hidden sm:inline">
                {getStatusText()}
            </span>

            {/* Tooltip */}
            <div className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                Server: {getStatusText()}
                {lastCheck && (
                    <div className="text-gray-400">
                        Last checked: {lastCheck.toLocaleTimeString()}
                    </div>
                )}
            </div>
        </div>
    );
}
