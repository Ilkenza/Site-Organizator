/** Fallback redirect — next.config.js handles /dashboard → /dashboard/sites via 301 */
import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Dashboard() {
  const router = useRouter();
  useEffect(() => { router.replace('/dashboard/sites'); }, [router]);
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderColor: '#6CBBFB' }} />
    </div>
  );
}
