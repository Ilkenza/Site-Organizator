import { useEffect } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { useAuth } from '../context/AuthContext';

// Reusable Logo Component
const Logo = ({ size = 'md' }) => {
  const sizes = {
    sm: { container: 'w-8 h-8', icon: 'w-4 h-4' },
    md: { container: 'w-10 h-10', icon: 'w-5 h-5' },
    lg: { container: 'w-16 h-16', icon: 'w-8 h-8' },
    xl: { container: 'w-20 h-20', icon: 'w-10 h-10' }
  };

  return (
    <div className={`${sizes[size].container} rounded-xl bg-gradient-to-br from-app-accent to-[#4A9FE8] flex items-center justify-center shadow-lg shadow-app-accent/20`}>
      <svg className={`${sizes[size].icon} text-white`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    </div>
  );
};

export default function Home() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!loading && user) {
      window.location.href = '/dashboard';
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-app-accent"></div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Site Organizer - Organize Your Favorite Websites</title>
        <meta name="description" content="Save, categorize, and tag your favorite websites. Access them from anywhere with your personal dashboard." />
      </Head>

      <div className="min-h-screen bg-gray-950 relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-app-accent/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-pink-500/5 rounded-full blur-3xl"></div>
        </div>

        {/* Navigation */}
        <nav className="relative z-10 border-b border-app-border/50 backdrop-blur-sm bg-gray-950/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <Logo size="md" />
                <span className="text-xl font-bold text-white">Site Organizer</span>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href="/login"
                  className="px-4 py-2 text-gray-300 hover:text-white transition-colors font-medium"
                >
                  Sign In
                </Link>
                <Link
                  href="/login"
                  className="px-5 py-2 bg-[#1E4976] hover:bg-[#2A5B9E] text-white font-medium rounded-lg transition-all"
                >
                  Get Started
                </Link>
              </div>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <main className="relative z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
            <div className="text-center">
              {/* Logo Badge */}
              <div className="flex justify-center mb-8">
                <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-app-bg-light/50 border border-app-border backdrop-blur-sm">
                  <Logo size="sm" />
                  <span className="text-sm font-medium text-gray-300">Your Personal Bookmark Manager</span>
                </div>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold text-white mb-6 leading-tight">
                Organize Your
                <br />
                <span className="text-app-accent">Favorite Websites</span>
              </h1>

              <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
                Save, categorize, and tag your favorite websites. Access them from anywhere with your personal dashboard and browser extension.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/login"
                  className="w-full sm:w-auto px-8 py-4 bg-[#1E4976] hover:bg-[#2A5B9E] text-white font-semibold rounded-xl transition-all text-lg"
                >
                  Start Organizing Free
                </Link>
                <a
                  href="#features"
                  className="w-full sm:w-auto px-8 py-4 bg-app-bg-light/50 hover:bg-app-bg-light border border-app-border text-white font-medium rounded-xl transition-all text-lg backdrop-blur-sm"
                >
                  Learn More
                </a>
              </div>
            </div>

            {/* Dashboard Preview */}
            <div className="mt-20 relative">
              <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-transparent z-10 pointer-events-none"></div>
              <div className="bg-app-bg-light/30 border border-app-border rounded-2xl p-4 backdrop-blur-sm shadow-2xl">
                <div className="bg-gray-950 rounded-xl overflow-hidden">
                  {/* Mock Browser Bar */}
                  <div className="flex items-center gap-2 px-4 py-3 bg-app-bg-light/50 border-b border-app-border">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                    </div>
                    <div className="flex-1 flex justify-center">
                      <div className="px-4 py-1.5 bg-gray-950 rounded-lg text-xs text-gray-500 flex items-center gap-2">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                        siteorganizer.app/dashboard
                      </div>
                    </div>
                  </div>
                  {/* Mock Dashboard Content */}
                  <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Logo size="sm" />
                        <span className="text-white font-semibold">Site Organizer</span>
                      </div>
                      <div className="flex gap-2">
                        <div className="w-8 h-8 rounded-lg bg-app-bg-light"></div>
                        <div className="w-8 h-8 rounded-lg bg-app-bg-light"></div>
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-app-accent to-purple-500"></div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="bg-app-bg-light/50 border border-app-border rounded-xl p-4 space-y-2">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-app-accent/20 to-purple-500/20 flex items-center justify-center">
                            <div className="w-6 h-6 rounded bg-app-accent/30"></div>
                          </div>
                          <div className="h-3 bg-gray-700 rounded w-3/4"></div>
                          <div className="h-2 bg-gray-800 rounded w-1/2"></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Features Section */}
          <div id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Everything You Need
              </h2>
              <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                Powerful features to help you organize and access your favorite websites efficiently.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Feature 1 */}
              <div className="group bg-app-bg-light/30 hover:bg-app-bg-light/50 border border-app-border hover:border-app-accent/50 rounded-2xl p-6 transition-all duration-300">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-app-accent/20 to-app-accent/5 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <svg className="w-7 h-7 text-app-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">Save Websites</h3>
                <p className="text-gray-400 leading-relaxed">Quickly save any website with our browser extension or directly from the dashboard with one click.</p>
              </div>

              {/* Feature 2 */}
              <div className="group bg-app-bg-light/30 hover:bg-app-bg-light/50 border border-app-border hover:border-purple-500/50 rounded-2xl p-6 transition-all duration-300">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <svg className="w-7 h-7 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">Tags & Categories</h3>
                <p className="text-gray-400 leading-relaxed">Organize with custom categories and colorful tags to find what you need instantly.</p>
              </div>

              {/* Feature 3 */}
              <div className="group bg-app-bg-light/30 hover:bg-app-bg-light/50 border border-app-border hover:border-pink-500/50 rounded-2xl p-6 transition-all duration-300">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-pink-500/20 to-pink-500/5 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <svg className="w-7 h-7 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">Powerful Search</h3>
                <p className="text-gray-400 leading-relaxed">Find any saved site instantly with fast search, filters, and smart suggestions.</p>
              </div>

              {/* Feature 4 */}
              <div className="group bg-app-bg-light/30 hover:bg-app-bg-light/50 border border-app-border hover:border-emerald-500/50 rounded-2xl p-6 transition-all duration-300">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">PWA Support</h3>
                <p className="text-gray-400 leading-relaxed">Install as an app on your phone or desktop for quick access anywhere, anytime.</p>
              </div>

              {/* Feature 5 */}
              <div className="group bg-app-bg-light/30 hover:bg-app-bg-light/50 border border-app-border hover:border-amber-500/50 rounded-2xl p-6 transition-all duration-300">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <svg className="w-7 h-7 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">Favorites & Pins</h3>
                <p className="text-gray-400 leading-relaxed">Pin your most-used sites and mark favorites for lightning-fast access.</p>
              </div>

              {/* Feature 6 */}
              <div className="group bg-app-bg-light/30 hover:bg-app-bg-light/50 border border-app-border hover:border-cyan-500/50 rounded-2xl p-6 transition-all duration-300">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <svg className="w-7 h-7 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">Secure & Private</h3>
                <p className="text-gray-400 leading-relaxed">Your data is encrypted and secure. We support 2FA for extra protection.</p>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            <div className="bg-gradient-to-br from-app-bg-light/50 to-app-bg-light/30 border border-app-border rounded-3xl p-8 sm:p-12 text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-app-accent/5 pointer-events-none"></div>
              <div className="relative z-10">
                <Logo size="lg" />
                <h2 className="text-3xl sm:text-4xl font-bold text-white mt-6 mb-4">
                  Ready to Get Organized?
                </h2>
                <p className="text-gray-400 text-lg max-w-xl mx-auto mb-8">
                  Join thousands of users who organize their web with Site Organizer. Free to use, forever.
                </p>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 px-8 py-4 bg-[#1E4976] hover:bg-[#2A5B9E] text-white font-semibold rounded-xl transition-all text-lg"
                >
                  Get Started Free
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="relative z-10 border-t border-app-border/50 py-8 bg-gray-950/80 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Logo size="sm" />
                <span className="text-gray-400 font-medium">Site Organizer</span>
              </div>
              <p className="text-gray-500 text-sm">
                © {new Date().getFullYear()} Site Organizer. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}

export async function getServerSideProps() {
  // Prevent static prerendering for pages that rely on client auth
  return { props: {} };
}
