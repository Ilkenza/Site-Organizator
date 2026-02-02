import { useEffect } from 'react';
import { useRouter } from 'next/router';

/**
 * Dashboard page - redirects to /dashboard/sites
 * All dashboard functionality is now in /dashboard/[tab].js
 */
export default function Dashboard() {
    const router = useRouter();

    useEffect(() => {
        // Redirect to /dashboard/sites on mount
        router.replace('/dashboard/sites');
    }, [router]);

    // Show loading while redirecting
    return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderColor: '#6CBBFB' }}></div>
        </div>
    );
}
