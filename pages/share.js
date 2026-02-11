/** Share Target page — receives URLs from mobile "Share" menu (PWA Share Target API) */

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';

export default function SharePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    // Not logged in — redirect to login, then come back
    if (!user) {
      const params = new URLSearchParams(window.location.search).toString();
      router.replace(`/login?redirect=/share${params ? `?${params}` : ''}`);
      return;
    }

    // Extract shared data from query params (set by share_target in manifest.json)
    const { url, title, text } = router.query;

    // Try to extract a URL from the shared data
    let sharedUrl = url || '';
    if (!sharedUrl && text) {
      // Some apps put URL in "text" field — try to extract it
      const urlMatch = text.match(/https?:\/\/[^\s]+/);
      if (urlMatch) sharedUrl = urlMatch[0];
    }

    // Redirect to dashboard with the shared URL pre-filled in the site modal
    const params = new URLSearchParams();
    if (sharedUrl) params.set('addUrl', sharedUrl);
    if (title) params.set('addTitle', title);

    router.replace(`/dashboard/sites?${params.toString()}`);
  }, [router, user, loading]);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-app-accent/30 border-t-app-accent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-400">Saving your link...</p>
      </div>
    </div>
  );
}
