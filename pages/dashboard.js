/**
 * @fileoverview Legacy dashboard redirect page
 * Redirects to /dashboard/sites - all dashboard functionality is in /dashboard/[tab].js
 */

import { useEffect } from 'react';
import { useRouter } from 'next/router';

// Configuration
const REDIRECT_CONFIG = {
  TARGET_URL: '/dashboard/sites',
  SPINNER_COLOR: '#6CBBFB'
};

/**
 * Dashboard redirect component
 * @returns {JSX.Element} Loading spinner during redirect
 */
export default function Dashboard() {
  const router = useRouter();

  useEffect(() => {
    router.replace(REDIRECT_CONFIG.TARGET_URL);
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div
        className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2"
        style={{ borderColor: REDIRECT_CONFIG.SPINNER_COLOR }}
      />
    </div>
  );
}
