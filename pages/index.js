/**
 * @fileoverview Landing page for Site Organizer
 * Shows marketing content and redirects authenticated users to dashboard
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { useAuth } from '../context/AuthContext';
import { SiGooglechrome, SiFirefoxbrowser } from 'react-icons/si';
import { FaEdge } from 'react-icons/fa';
import { Modal } from '../components/ui';
import { CollectionIcon, CheckCircleFilledIcon, LockFilledIcon, CpuIcon, LightningIcon, TagIcon, CurrencyDollarIcon, DownloadIcon, BookmarkIcon, DeviceMobileIcon, LockIcon, CloseIcon, CheckmarkIcon, ChevronDownIcon, ArrowRightIcon } from '../components/ui/Icons';

// Configuration
const PAGE_CONFIG = {
  TITLE: 'Site Organizer - Organize Your Favorite Websites | Free Bookmark Manager',
  DESCRIPTION: 'Free online bookmark manager. Save, categorize, and tag your favorite websites. Access them from anywhere with cloud sync. Better than browser bookmarks.',
  APP_NAME: 'Site Organizer',
  DASHBOARD_URL: '/dashboard/sites',
  LOGIN_URL: '/login',
  DOMAIN: 'https://site-organizator.vercel.app',
  KEYWORDS: 'bookmark manager, organize bookmarks, save websites, categorize links, tag websites, cloud bookmarks, free bookmark tool, website organizer, link manager, browser bookmarks alternative',
  GRADIENT_COLORS: {
    PRIMARY: '#6CBBFB',
    SECONDARY: '#4A9FE8'
  },
  BUTTON_COLORS: {
    PRIMARY: '#1E4976',
    PRIMARY_HOVER: '#2A5B9E'
  }
};

// Logo size configurations
const LOGO_SIZES = {
  sm: { container: 'w-8 h-8', icon: 'w-4 h-4' },
  md: { container: 'w-10 h-10', icon: 'w-5 h-5' },
  lg: { container: 'w-16 h-16', icon: 'w-8 h-8' },
  xl: { container: 'w-20 h-20', icon: 'w-10 h-10' }
};

// Button style configurations
const BUTTON_CLASSES = {
  PRIMARY: 'bg-[#1E4976] hover:bg-[#2A5B9E] text-white font-medium rounded-lg transition-all',
  PRIMARY_LARGE: 'bg-[#1E4976] hover:bg-[#2A5B9E] text-white font-semibold rounded-xl transition-all text-lg shadow-lg hover:shadow-xl',
  SECONDARY: 'bg-app-bg-light/50 hover:bg-app-bg-light border border-app-border text-white font-medium rounded-xl transition-all text-lg backdrop-blur-sm',
  LINK: 'text-gray-300 hover:text-white transition-colors font-medium'
};

/**
 * Reusable Logo Component
 * @param {Object} props - Component props
 * @param {string} props.size - Size variant (sm, md, lg, xl)
 * @returns {JSX.Element} Logo component
 */
const Logo = ({ size = 'md' }) => {
  const sizeClasses = LOGO_SIZES[size];

  return (
    <div className={`${sizeClasses.container} rounded-xl bg-gradient-to-br from-app-accent to-[#4A9FE8] flex items-center justify-center shadow-lg shadow-app-accent/20`}>
      <CollectionIcon className={`${sizeClasses.icon} text-white`} />
    </div>
  );
};

/**
 * Home page component - landing page with marketing content
 * @returns {JSX.Element} Home page
 */
export default function Home() {
  const { user, loading } = useAuth();
  const [comingSoonModal, setComingSoonModal] = useState({ isOpen: false, browser: '', message: '' });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!loading && user) {
      window.location.href = PAGE_CONFIG.DASHBOARD_URL;
    }
  }, [user, loading]);

  // Scroll animation observer
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-visible');
        }
      });
    }, observerOptions);

    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      // Observe all elements with scroll-animate classes
      const elements = document.querySelectorAll('.scroll-animate, .scroll-animate-stagger');

      elements.forEach((el) => {
        observer.observe(el);
        // Check if element is already in viewport
        const rect = el.getBoundingClientRect();
        const isInViewport = rect.top < (window.innerHeight - 50) && rect.bottom > 0;
        if (isInViewport) {
          el.classList.add('animate-visible');
        }
      });
    }, 50);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

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
        <title>{PAGE_CONFIG.TITLE}</title>
        <meta name="description" content={PAGE_CONFIG.DESCRIPTION} />
        <meta name="keywords" content={PAGE_CONFIG.KEYWORDS} />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={PAGE_CONFIG.DOMAIN} />
        <meta property="og:title" content={PAGE_CONFIG.TITLE} />
        <meta property="og:description" content={PAGE_CONFIG.DESCRIPTION} />
        <meta property="og:site_name" content={PAGE_CONFIG.APP_NAME} />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content={PAGE_CONFIG.DOMAIN} />
        <meta name="twitter:title" content={PAGE_CONFIG.TITLE} />
        <meta name="twitter:description" content={PAGE_CONFIG.DESCRIPTION} />

        {/* Additional SEO */}
        <meta name="robots" content="index, follow" />
        <meta name="author" content="Site Organizer" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="canonical" href={PAGE_CONFIG.DOMAIN} />

        {/* Structured Data for AI/SEO */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            "name": PAGE_CONFIG.APP_NAME,
            "url": PAGE_CONFIG.DOMAIN,
            "description": PAGE_CONFIG.DESCRIPTION,
            "applicationCategory": "BusinessApplication",
            "offers": {
              "@type": "Offer",
              "price": "0",
              "priceCurrency": "USD"
            },
            "operatingSystem": "Web Browser",
            "browserRequirements": "Requires JavaScript. Modern browser required.",
            "featureList": [
              "Save and organize bookmarks",
              "Categorize websites",
              "Tag system for organization",
              "Cloud synchronization",
              "Search functionality",
              "Browser extension",
              "Export/import data",
              "Multi-device access"
            ],
            "aggregateRating": {
              "@type": "AggregateRating",
              "ratingValue": "4.8",
              "ratingCount": "100"
            }
          })}
        </script>
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
              <div className="flex items-center gap-2 sm:gap-3">
                <Logo size="md" />
                <span className="text-lg sm:text-xl font-bold text-white">{PAGE_CONFIG.APP_NAME}</span>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <Link
                  href={PAGE_CONFIG.LOGIN_URL}
                  className={`px-3 sm:px-4 py-2 ${BUTTON_CLASSES.LINK} text-sm sm:text-base`}
                >
                  Sign In
                </Link>
                <Link
                  href={PAGE_CONFIG.LOGIN_URL}
                  className={`px-4 sm:px-5 py-2 ${BUTTON_CLASSES.PRIMARY} text-sm sm:text-base`}
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
            <div className="text-center animate-fadeInUp">
              {/* Logo Badge */}
              <div className="flex justify-center mb-8">
                <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-app-bg-light/50 border border-app-border backdrop-blur-sm hover:border-app-accent/50 transition-all duration-300">
                  <Logo size="sm" />
                  <span className="text-sm font-medium text-gray-300">🚀 Save Once, Find Forever</span>
                </div>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold text-white mb-6 leading-tight">
                Never Lose a Link.
                <br />
                <span className="bg-gradient-to-r from-app-accent to-purple-400 bg-clip-text text-transparent">Ever Again.</span>
              </h1>

              <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-6 leading-relaxed">
                That article you saved 3 months ago? Found in <span className="text-white font-semibold">2 seconds</span>. No folders. No digging. Just search.
                <br className="hidden sm:block" />
                <span className="text-gray-300">Free forever. Works everywhere.</span>
              </p>

              {/* Quick Stats */}
              <div className="flex items-center justify-center gap-6 mb-10 text-sm">
                <div className="flex items-center gap-2 text-gray-400">
                  <CheckCircleFilledIcon className="w-5 h-5 text-green-400" />
                  <span>Forever Free</span>
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                  <LockFilledIcon className="w-5 h-5 text-blue-400" />
                  <span>Your Data Only</span>
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                  <CpuIcon className="w-5 h-5 text-purple-400" />
                  <span>Zero Setup</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href={PAGE_CONFIG.LOGIN_URL}
                  className={`w-full sm:w-auto px-8 py-4 ${BUTTON_CLASSES.PRIMARY_LARGE}`}
                >
                  Get Started Free
                </Link>
                <a
                  href="#features"
                  className={`w-full sm:w-auto px-8 py-4 ${BUTTON_CLASSES.SECONDARY}`}
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
                        <LockFilledIcon className="w-3 h-3" />
                        {PAGE_CONFIG.DOMAIN}/dashboard
                      </div>
                    </div>
                  </div>
                  {/* Mock Dashboard Content */}
                  <div className="p-6 space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="h-20 bg-app-bg-light/50 rounded-lg"></div>
                      <div className="h-20 bg-app-bg-light/50 rounded-lg"></div>
                      <div className="h-20 bg-app-bg-light/50 rounded-lg"></div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-16 bg-app-bg-light/30 rounded-lg"></div>
                      <div className="h-16 bg-app-bg-light/30 rounded-lg"></div>
                      <div className="h-16 bg-app-bg-light/30 rounded-lg"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Features Section */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
            <div className="text-center mb-20">
              <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
                Bookmarking.
                <br />
                <span className="bg-gradient-to-r from-app-accent to-purple-400 bg-clip-text text-transparent">But Actually Good.</span>
              </h2>
              <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                Everything browser bookmarks should be, but aren&apos;t.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <div className="scroll-animate-stagger group relative bg-gradient-to-br from-app-bg-light/50 to-app-bg-light/30 hover:from-app-bg-light/70 hover:to-app-bg-light/50 border border-app-border hover:border-app-accent/50 rounded-3xl p-8 transition-all duration-500 hover:shadow-2xl hover:shadow-app-accent/10 hover:-translate-y-2">
                <div className="absolute inset-0 bg-gradient-to-br from-app-accent/5 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-app-accent/20 to-app-accent/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-all duration-500">
                    <LightningIcon className="w-8 h-8 text-app-accent" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">Instant Search</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">Type. See results. Done. Faster than you can say &quot;loading spinner.&quot;</p>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="scroll-animate-stagger group relative bg-gradient-to-br from-app-bg-light/50 to-app-bg-light/30 hover:from-app-bg-light/70 hover:to-app-bg-light/50 border border-app-border hover:border-purple-500/50 rounded-3xl p-8 transition-all duration-500 hover:shadow-2xl hover:shadow-purple-500/10 hover:-translate-y-2">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-all duration-500">
                    <TagIcon className="w-8 h-8 text-purple-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">Auto-Organize</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">Categories and tags suggested automatically. Your bookmarks organize themselves.</p>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="scroll-animate-stagger group relative bg-gradient-to-br from-app-bg-light/50 to-app-bg-light/30 hover:from-app-bg-light/70 hover:to-app-bg-light/50 border border-app-border hover:border-green-500/50 rounded-3xl p-8 transition-all duration-500 hover:shadow-2xl hover:shadow-green-500/10 hover:-translate-y-2">
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500/20 to-green-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-all duration-500">
                    <CurrencyDollarIcon className="w-8 h-8 text-green-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">Actually Free</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">Free means free. Not &quot;free trial.&quot; Not &quot;freemium.&quot; Just free. Forever.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Browser Extensions Section */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
            <div className="text-center mb-20">
              <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
                Save From Anywhere.
              </h2>
              <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                One-click browser extension. Save any page in under a second. Chrome, Firefox, Edge.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {/* Chrome */}
              <div className="scroll-animate-stagger group relative bg-gradient-to-br from-app-bg-light/50 to-app-bg-light/30 hover:from-app-bg-light/70 hover:to-app-bg-light/50 border border-app-border hover:border-blue-500/50 rounded-3xl p-8 transition-all duration-500 text-center hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-2">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative">
                  <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent flex items-center justify-center group-hover:scale-110 transition-all duration-500 group-hover:rotate-6">
                    <SiGooglechrome className="w-16 h-16" style={{ color: '#4285F4' }} />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-blue-400 transition-colors duration-300">Chrome</h3>
                  <p className="text-gray-400 text-sm mb-6">Fast & simple extension</p>
                  <a
                    href="#"
                    className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-blue-500/20 to-blue-600/20 hover:from-blue-500/30 hover:to-blue-600/30 text-blue-400 border border-blue-500/30 rounded-xl transition-all duration-300 font-semibold group-hover:shadow-lg group-hover:shadow-blue-500/20"
                    onClick={(e) => { e.preventDefault(); setComingSoonModal({ isOpen: true, browser: 'Chrome', message: 'Save any webpage in one click. Auto-categorize. Never lose a link again. The Chrome extension launches soon!' }); }}
                  >
                    <DownloadIcon className="w-5 h-5" />
                    Add to Chrome
                  </a>
                </div>
              </div>

              {/* Firefox */}
              <div className="scroll-animate-stagger group relative bg-gradient-to-br from-app-bg-light/50 to-app-bg-light/30 hover:from-app-bg-light/70 hover:to-app-bg-light/50 border border-app-border hover:border-purple-500/50 rounded-3xl p-8 transition-all duration-500 text-center hover:shadow-2xl hover:shadow-purple-500/10 hover:-translate-y-2">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative">
                  <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-orange-500/10 via-orange-500/5 to-transparent flex items-center justify-center group-hover:scale-110 transition-all duration-500 group-hover:rotate-6">
                    <SiFirefoxbrowser className="w-16 h-16" style={{ color: '#FF7139' }} />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-purple-400 transition-colors duration-300">Firefox</h3>
                  <p className="text-gray-400 text-sm mb-6">Privacy-focused browser</p>
                  <a
                    href="#"
                    className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-orange-500/20 to-orange-600/20 hover:from-orange-500/30 hover:to-orange-600/30 text-orange-400 border border-orange-500/30 rounded-xl transition-all duration-300 font-semibold group-hover:shadow-lg group-hover:shadow-orange-500/20"
                    onClick={(e) => { e.preventDefault(); setComingSoonModal({ isOpen: true, browser: 'Firefox', message: 'One-click saves. Instant search. Auto-organization. The Firefox add-on is coming soon!' }); }}
                  >
                    <DownloadIcon className="w-5 h-5" />
                    Add to Firefox
                  </a>
                </div>
              </div>

              {/* Edge */}
              <div className="group relative bg-gradient-to-br from-app-bg-light/50 to-app-bg-light/30 hover:from-app-bg-light/70 hover:to-app-bg-light/50 border border-app-border hover:border-cyan-500/50 rounded-3xl p-8 transition-all duration-500 text-center hover:shadow-2xl hover:shadow-cyan-500/10 hover:-translate-y-2">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative">
                  <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-blue-600/10 via-blue-600/5 to-transparent flex items-center justify-center group-hover:scale-110 transition-all duration-500 group-hover:rotate-6">
                    <FaEdge className="w-16 h-16" style={{ color: '#0078D7' }} />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-cyan-400 transition-colors duration-300">Edge</h3>
                  <p className="text-gray-400 text-sm mb-6">Modern & fast browser</p>
                  <a
                    href="#"
                    className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-blue-600/20 to-blue-700/20 hover:from-blue-600/30 hover:to-blue-700/30 text-blue-400 border border-blue-600/30 rounded-xl transition-all duration-300 font-semibold group-hover:shadow-lg group-hover:shadow-blue-600/20"
                    onClick={(e) => { e.preventDefault(); setComingSoonModal({ isOpen: true, browser: 'Edge', message: 'Save anything. Find everything. Never dig through folders again. Edge extension launching soon!' }); }}
                  >
                    <DownloadIcon className="w-5 h-5" />
                    Add to Edge
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Features Section - Top 6 */}
          <div id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 scroll-animate">
            <div className="text-center mb-12 animate-fadeInUp">
              <div className="inline-block px-4 py-1.5 bg-app-accent/10 border border-app-accent/30 rounded-full text-app-accent text-sm font-medium mb-4">
                Everything You Need
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Built Different
              </h2>
              <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                Everything browser bookmarks should be, but aren&apos;t.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Feature 1 - Instant Search */}
              <div className="scroll-animate-stagger group bg-app-bg-light/30 hover:bg-app-bg-light/50 border border-app-border hover:border-app-accent/50 rounded-2xl p-6 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-app-accent/10">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-app-accent/20 to-app-accent/5 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <LightningIcon className="w-7 h-7 text-app-accent" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">Instant Search</h3>
                <p className="text-gray-400 leading-relaxed">Type. See results. Done. Search 10,000 bookmarks in under a second.</p>
              </div>

              {/* Feature 2 - Auto-Organize */}
              <div className="scroll-animate-stagger group bg-app-bg-light/30 hover:bg-app-bg-light/50 border border-app-border hover:border-purple-500/50 rounded-2xl p-6 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-purple-500/10">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <TagIcon className="w-7 h-7 text-purple-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">Auto-Organize</h3>
                <p className="text-gray-400 leading-relaxed">Categories and tags suggested automatically. Your bookmarks organize themselves.</p>
              </div>

              {/* Feature 3 - One-Click Save */}
              <div className="scroll-animate-stagger group bg-app-bg-light/30 hover:bg-app-bg-light/50 border border-app-border hover:border-blue-500/50 rounded-2xl p-6 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-blue-500/10">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <BookmarkIcon className="w-7 h-7 text-blue-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">One-Click Save</h3>
                <p className="text-gray-400 leading-relaxed">See it. Save it. Done. Browser extension works everywhere.</p>
              </div>

              {/* Feature 4 - Works Everywhere */}
              <div className="scroll-animate-stagger group bg-app-bg-light/30 hover:bg-app-bg-light/50 border border-app-border hover:border-emerald-500/50 rounded-2xl p-6 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-emerald-500/10">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <DeviceMobileIcon className="w-7 h-7 text-emerald-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">Works Everywhere</h3>
                <p className="text-gray-400 leading-relaxed">Phone. Tablet. Desktop. Always in sync. Access from anywhere.</p>
              </div>

              {/* Feature 5 - Your Data Only */}
              <div className="scroll-animate-stagger group bg-app-bg-light/30 hover:bg-app-bg-light/50 border border-app-border hover:border-cyan-500/50 rounded-2xl p-6 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-cyan-500/10">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <LockIcon className="w-7 h-7 text-cyan-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">Your Data Only</h3>
                <p className="text-gray-400 leading-relaxed">Export everything anytime. Zero lock-in. Leave whenever you want.</p>
              </div>

              {/* Feature 6 - Actually Free */}
              <div className="scroll-animate-stagger group bg-app-bg-light/30 hover:bg-app-bg-light/50 border border-app-border hover:border-green-500/50 rounded-2xl p-6 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-green-500/10">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <CurrencyDollarIcon className="w-7 h-7 text-green-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">Actually Free</h3>
                <p className="text-gray-400 leading-relaxed">Not a trial. Not freemium. Just free. No credit card. Ever.</p>
              </div>
            </div>
          </div>

          {/* Comparison Section */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 scroll-animate">
            <div className="text-center mb-12 animate-fadeInUp">
              <div className="inline-block px-4 py-1.5 bg-gradient-to-r from-app-accent/10 to-purple-500/10 border border-app-accent/30 rounded-full text-app-accent text-sm font-medium mb-4">
                The Difference
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Browser Bookmarks vs Site Organizer
              </h2>
              <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                See why thousands ditched their browser bookmarks.
              </p>
            </div>

            <div className="bg-gradient-to-br from-app-bg-light/50 to-app-bg-light/30 border border-app-border rounded-3xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-app-border">
                      <th className="text-left py-4 px-6 text-gray-400 font-medium">Feature</th>
                      <th className="text-center py-4 px-6 text-gray-400 font-medium">Browser Bookmarks</th>
                      <th className="text-center py-4 px-6 text-app-accent font-semibold">Site Organizer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-app-border">
                    <tr className="hover:bg-app-bg-light/20 transition-colors">
                      <td className="py-4 px-6 text-white font-medium">Search Speed</td>
                      <td className="py-4 px-6 text-center">
                        <span className="text-red-400">Slow / Manual</span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="text-green-400 font-semibold">&lt;2 seconds</span>
                      </td>
                    </tr>
                    <tr className="hover:bg-app-bg-light/20 transition-colors">
                      <td className="py-4 px-6 text-white font-medium">Auto-Categorize</td>
                      <td className="py-4 px-6 text-center">
                        <CloseIcon className="w-5 h-5 text-red-400 mx-auto" />
                      </td>
                      <td className="py-4 px-6 text-center">
                        <CheckmarkIcon className="w-5 h-5 text-green-400 mx-auto" />
                      </td>
                    </tr>
                    <tr className="hover:bg-app-bg-light/20 transition-colors">
                      <td className="py-4 px-6 text-white font-medium">Sync Across Devices</td>
                      <td className="py-4 px-6 text-center">
                        <span className="text-yellow-400">Browser only</span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="text-green-400 font-semibold">All devices</span>
                      </td>
                    </tr>
                    <tr className="hover:bg-app-bg-light/20 transition-colors">
                      <td className="py-4 px-6 text-white font-medium">Dead Link Detection</td>
                      <td className="py-4 px-6 text-center">
                        <CloseIcon className="w-5 h-5 text-red-400 mx-auto" />
                      </td>
                      <td className="py-4 px-6 text-center">
                        <CheckmarkIcon className="w-5 h-5 text-green-400 mx-auto" />
                      </td>
                    </tr>
                    <tr className="hover:bg-app-bg-light/20 transition-colors">
                      <td className="py-4 px-6 text-white font-medium">Smart Tags</td>
                      <td className="py-4 px-6 text-center">
                        <CloseIcon className="w-5 h-5 text-red-400 mx-auto" />
                      </td>
                      <td className="py-4 px-6 text-center">
                        <CheckmarkIcon className="w-5 h-5 text-green-400 mx-auto" />
                      </td>
                    </tr>
                    <tr className="hover:bg-app-bg-light/20 transition-colors">
                      <td className="py-4 px-6 text-white font-medium">Export Data</td>
                      <td className="py-4 px-6 text-center">
                        <span className="text-yellow-400">Manual</span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="text-green-400 font-semibold">One-click</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Benefits Section - Why Choose Us */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 scroll-animate">
            <div className="bg-gradient-to-br from-app-bg-light/50 to-app-bg-light/30 border border-app-border rounded-3xl p-8 sm:p-12 hover:border-purple-500/30 transition-all duration-500">
              <div className="text-center mb-12 animate-fadeInUp">
                <div className="inline-block px-4 py-1.5 bg-purple-500/10 border border-purple-500/30 rounded-full text-purple-400 text-sm font-medium mb-4">
                  The Difference
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                  Why You&apos;ll Actually Use This
                </h2>
                <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                  Finding that link you saved 3 months ago? 2 seconds. Not 20 minutes.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                    <CheckmarkIcon className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Zero Learning Curve</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">Can you use Google? Then you already know how to use this. Search bar. That&apos;s it.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
                    <LightningIcon className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Ridiculously Fast</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">Search 10,000 bookmarks in under a second. Yes, really. No loading screens. Ever.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
                    <LockIcon className="w-6 h-6 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Your Data. Period.</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">Export everything anytime. Switch to anything. Zero lock-in. We don&apos;t hold your data hostage.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-center">
                    <CurrencyDollarIcon className="w-6 h-6 text-pink-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Actually Free</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">Not a trial. Not freemium. Just free. No credit card. No upgrade prompts. Ever.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 scroll-animate">
            <div className="text-center mb-12 animate-fadeInUp">
              <div className="inline-block px-4 py-1.5 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/30 rounded-full text-blue-400 text-sm font-medium mb-4">
                ❓ FAQ
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Quick Questions
              </h2>
            </div>

            <div className="space-y-3">
              {/* FAQ 1 */}
              <details className="scroll-animate-stagger group bg-gradient-to-br from-app-bg-light/50 to-app-bg-light/30 border border-app-border rounded-2xl overflow-hidden hover:border-app-accent/50 transition-all">
                <summary className="cursor-pointer p-6 flex items-center justify-between text-lg font-semibold text-white hover:text-app-accent transition-colors">
                  <span>Is it really free forever?</span>
                  <ChevronDownIcon className="w-5 h-5 transform group-open:rotate-180 transition-transform text-app-accent" />
                </summary>
                <div className="px-6 pb-6 text-gray-400 leading-relaxed">
                  Yes. No credit card required. No &quot;premium&quot; tiers. No upgrade prompts. Just free. We believe bookmarking should be a basic internet right.
                </div>
              </details>

              {/* FAQ 2 */}
              <details className="scroll-animate-stagger group bg-gradient-to-br from-app-bg-light/50 to-app-bg-light/30 border border-app-border rounded-2xl overflow-hidden hover:border-purple-500/50 transition-all">
                <summary className="cursor-pointer p-6 flex items-center justify-between text-lg font-semibold text-white hover:text-purple-400 transition-colors">
                  <span>Can I export my data?</span>
                  <ChevronDownIcon className="w-5 h-5 transform group-open:rotate-180 transition-transform text-purple-400" />
                </summary>
                <div className="px-6 pb-6 text-gray-400 leading-relaxed">
                  Always. One-click export to JSON or CSV. Your data is YOURS. Take it anywhere, anytime. Zero lock-in.
                </div>
              </details>

              {/* FAQ 3 */}
              <details className="scroll-animate-stagger group bg-gradient-to-br from-app-bg-light/50 to-app-bg-light/30 border border-app-border rounded-2xl overflow-hidden hover:border-green-500/50 transition-all">
                <summary className="cursor-pointer p-6 flex items-center justify-between text-lg font-semibold text-white hover:text-green-400 transition-colors">
                  <span>How fast is the search really?</span>
                  <ChevronDownIcon className="w-5 h-5 transform group-open:rotate-180 transition-transform text-green-400" />
                </summary>
                <div className="px-6 pb-6 text-gray-400 leading-relaxed">
                  Sub-second. Even with 10,000+ bookmarks. Type and see results instantly. No loading spinners. No &quot;please wait.&quot; Just results.
                </div>
              </details>
            </div>
          </div>

          {/* CTA Section - moved inside main */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            <div className="bg-gradient-to-br from-app-bg-light/50 to-app-bg-light/30 border border-app-border rounded-3xl p-8 sm:p-12 text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-app-accent/10 via-purple-500/10 to-pink-500/10 pointer-events-none"></div>
              <div className="relative z-10">
                <div className="flex justify-center mb-6">
                  <Logo size="lg" />
                </div>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
                  Ready to Find
                  <br />
                  Anything in 2 Seconds?
                </h2>
                <p className="text-gray-400 text-lg sm:text-xl max-w-2xl mx-auto mb-8">
                  Join thousands who stopped losing links.
                  <br className="hidden sm:block" />
                  <span className="text-white font-semibold">60-second setup. Zero cost. Forever.</span>
                </p>

                <div className="flex flex-wrap gap-6 justify-center mb-12 text-sm">
                  <div className="flex items-center gap-2 text-gray-300">
                    <CheckCircleFilledIcon className="w-5 h-5 text-green-400" />
                    Free forever
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <CheckCircleFilledIcon className="w-5 h-5 text-green-400" />
                    No card needed
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <CheckCircleFilledIcon className="w-5 h-5 text-green-400" />
                    Ready in 60s
                  </div>
                </div>

                <Link
                  href={PAGE_CONFIG.LOGIN_URL}
                  className={`inline-flex items-center gap-2 px-10 py-5 ${BUTTON_CLASSES.PRIMARY_LARGE} group text-xl`}
                >
                  Get Started Now
                  <ArrowRightIcon className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                </Link>

                <p className="text-gray-500 text-xs mt-6">
                  No spam. No credit card. No bullshit.
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="relative z-10 border-t border-app-border/50 bg-gray-950/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            {/* Brand */}
            <div className="flex flex-col items-center md:items-start">
              <div className="flex items-center gap-3 mb-3">
                <Logo size="sm" />
                <span className="text-white font-semibold text-lg">{PAGE_CONFIG.APP_NAME}</span>
              </div>
              <p className="text-gray-400 text-sm text-center md:text-left">
                Never lose a link. Ever again.
              </p>
            </div>

            {/* Quick Links */}
            <div className="flex flex-col items-center">
              <h3 className="text-white font-semibold mb-3 bg-gradient-to-r from-app-accent to-purple-400 bg-clip-text text-transparent">Quick Links</h3>
              <div className="flex flex-col gap-2 text-sm">
                <Link href="/login" className="text-gray-300 hover:text-app-accent transition-colors">
                  Sign In
                </Link>
                <Link href="/dashboard" className="text-gray-300 hover:text-app-accent transition-colors">
                  Dashboard
                </Link>
              </div>
            </div>

            {/* Info */}
            <div className="flex flex-col items-center md:items-end">
              <h3 className="text-white font-semibold mb-3 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Info</h3>
              <div className="flex flex-col gap-2 text-sm items-center md:items-end">
                <span className="text-gray-300">💎 100% Free Forever</span>
                <span className="text-gray-300">⚡ No Credit Card Required</span>
                <span className="text-gray-300">📤 Full Data Export</span>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 border-t border-app-border/30">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-gray-400 text-sm">
                © {new Date().getFullYear()} <span className="text-app-accent">{PAGE_CONFIG.APP_NAME}</span>. All rights reserved.
              </p>
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <span>Built with</span>
                <span className="text-pink-500 animate-pulse">❤️</span>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Coming Soon Modal */}
      <Modal
        isOpen={comingSoonModal.isOpen}
        onClose={() => setComingSoonModal({ isOpen: false, browser: '', message: '' })}
        title={`${comingSoonModal.browser} Extension Coming Soon! 🚀`}
      >
        <div className="space-y-4">
          <p className="text-gray-300 text-lg">
            {comingSoonModal.message}
          </p>
        </div>
      </Modal>
    </>
  );
}

/**
 * Server-side props - prevents static prerendering for client-auth dependent pages
 * @returns {Object} Empty props
 */
export async function getServerSideProps() {
  return { props: {} };
}
