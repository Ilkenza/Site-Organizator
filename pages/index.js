/**
 * @fileoverview Landing page for Site Organizer
 * Shows marketing content for the Site Organizer app
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { SiGooglechrome, SiFirefoxbrowser } from 'react-icons/si';
import { FaEdge } from 'react-icons/fa';
import { Modal } from '../components/ui';
import { CollectionIcon, CheckCircleFilledIcon, LockFilledIcon, CpuIcon, LightningIcon, TagIcon, CurrencyDollarIcon, DownloadIcon, BookmarkIcon, DeviceMobileIcon, LockIcon, CloseIcon, CheckmarkIcon, ChevronDownIcon, ArrowRightIcon } from '../components/ui/Icons';

// Configuration
const PAGE_CONFIG = {
  TITLE: 'Site Organizer - Organize Your Favorite Websites | Smart Bookmark Manager',
  DESCRIPTION: 'Smart online bookmark manager with AI-powered organization. Save, categorize, and tag your favorite websites. Free plan available with Pro upgrades for power users.',
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
  const [comingSoonModal, setComingSoonModal] = useState({ isOpen: false, browser: '', message: '' });

  // If user has auth tokens (online or offline), redirect to dashboard
  useEffect(() => {
    try {
      const supabaseUrlEnv = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const storageKey = `sb-${supabaseUrlEnv.replace(/^"|"$/g, '').split('//')[1]?.split('.')[0]}-auth-token`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const tokens = JSON.parse(stored);
        if (tokens?.access_token && tokens?.user) {
          window.location.replace(PAGE_CONFIG.DASHBOARD_URL);
        }
      }
    } catch (e) {
      // Ignore — not logged in
    }
  }, []);

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
              "@type": "AggregateOffer",
              "lowPrice": "0",
              "priceCurrency": "USD",
              "offerCount": "3"
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
            ]
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
                  <span className="text-sm font-medium text-gray-300">🚀 Bookmark manager with AI-powered suggestions</span>
                </div>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold text-white mb-6 leading-tight">
                You Saved the Link.
                <br />
                <span className="bg-gradient-to-r from-app-accent to-purple-400 bg-clip-text text-transparent">Then Googled It Again.</span>
              </h1>

              <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-4 leading-relaxed">
                Browser bookmarks become a mess. You save stuff but never find it.
              </p>

              <p className="text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto mb-10 leading-relaxed">
                <span className="text-white font-semibold">Site Organizer</span> lets you add any link, get AI-suggested categories &amp; tags,
                and find anything with instant search.
              </p>

              {/* Trust Badges */}
              <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 mb-10 text-sm">
                <div className="flex items-center gap-2 text-gray-400">
                  <CheckCircleFilledIcon className="w-5 h-5 text-green-400" />
                  <span>1,000 bookmarks free</span>
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                  <CpuIcon className="w-5 h-5 text-purple-400" />
                  <span>AI suggests tags &amp; categories</span>
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                  <LockFilledIcon className="w-5 h-5 text-blue-400" />
                  <span>Only you see your data</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href={PAGE_CONFIG.LOGIN_URL}
                  className={`w-full sm:w-auto px-8 py-4 ${BUTTON_CLASSES.PRIMARY_LARGE}`}
                >
                  Organize My Bookmarks
                </Link>
                <a
                  href="#how-it-works"
                  className={`w-full sm:w-auto px-8 py-4 ${BUTTON_CLASSES.SECONDARY}`}
                >
                  See How It Works
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
                  <div className="p-4 sm:p-6 flex gap-4">
                    {/* Mock Sidebar */}
                    <div className="hidden sm:flex flex-col gap-3 w-48 flex-shrink-0 border-r border-app-border/30 pr-4">
                      <div className="h-8 bg-app-accent/20 rounded-lg flex items-center px-3">
                        <span className="text-xs text-app-accent font-medium">All Sites</span>
                      </div>
                      <div className="h-7 bg-app-bg-light/30 rounded-lg flex items-center px-3">
                        <span className="text-xs text-gray-500">Favorites</span>
                      </div>
                      <div className="h-7 bg-app-bg-light/30 rounded-lg flex items-center px-3">
                        <span className="text-xs text-gray-500">Categories</span>
                      </div>
                      <div className="h-7 bg-app-bg-light/30 rounded-lg flex items-center px-3">
                        <span className="text-xs text-gray-500">Tags</span>
                      </div>
                      <div className="mt-4 pt-3 border-t border-app-border/30">
                        <div className="text-[10px] text-gray-600 mb-2 uppercase tracking-wide">Categories</div>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-400"></div><span className="text-xs text-gray-500">Development</span></div>
                          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-400"></div><span className="text-xs text-gray-500">Design</span></div>
                          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-purple-400"></div><span className="text-xs text-gray-500">Marketing</span></div>
                          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-400"></div><span className="text-xs text-gray-500">Tools</span></div>
                        </div>
                      </div>
                    </div>
                    {/* Mock Main Content */}
                    <div className="flex-1 space-y-3">
                      {/* Search bar */}
                      <div className="h-10 bg-app-bg-light/40 rounded-lg flex items-center px-3 border border-app-border/30">
                        <span className="text-xs text-gray-600">Search bookmarks...</span>
                      </div>
                      {/* Site cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {[{ name: 'GitHub', url: 'github.com', cat: 'Development', catColor: 'bg-blue-400', tag: 'Code' },
                        { name: 'Figma', url: 'figma.com', cat: 'Design', catColor: 'bg-green-400', tag: 'UI' },
                        { name: 'Vercel', url: 'vercel.com', cat: 'Development', catColor: 'bg-blue-400', tag: 'Hosting' },
                        { name: 'Notion', url: 'notion.so', cat: 'Tools', catColor: 'bg-amber-400', tag: 'Notes' },
                        { name: 'Stripe', url: 'stripe.com', cat: 'Development', catColor: 'bg-blue-400', tag: 'Payments' },
                        { name: 'Dribbble', url: 'dribbble.com', cat: 'Design', catColor: 'bg-green-400', tag: 'Inspiration' }].map((s) => (
                          <div key={s.name} className="bg-app-bg-light/30 border border-app-border/30 rounded-lg p-3 hover:border-app-accent/30 transition-colors">
                            <div className="flex items-center gap-2 mb-2">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={`https://www.google.com/s2/favicons?domain=${s.url}&sz=32`} alt="" width={16} height={16} className="w-4 h-4 rounded" loading="lazy" referrerPolicy="no-referrer" />
                              <span className="text-xs font-medium text-white truncate">{s.name}</span>
                            </div>
                            <div className="text-[10px] text-gray-600 truncate mb-2">{s.url}</div>
                            <div className="flex items-center gap-1.5">
                              <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-opacity-20 ${s.catColor}/20 text-gray-400`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${s.catColor}`}></span>{s.cat}
                              </span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-app-bg-light/50 text-gray-500">{s.tag}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* How It Works Section */}
          <div id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 scroll-animate">
            <div className="text-center mb-16">
              <div className="inline-block px-4 py-1.5 bg-app-accent/10 border border-app-accent/30 rounded-full text-app-accent text-sm font-medium mb-4">
                3 Steps
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                How It Works
              </h2>
              <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                From chaos to organized in under a minute.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 relative">
              {/* Connector line (desktop only) */}
              <div className="hidden md:block absolute top-16 left-[20%] right-[20%] h-0.5 bg-gradient-to-r from-app-accent/50 via-purple-500/50 to-green-500/50"></div>

              {/* Step 1 */}
              <div className="scroll-animate-stagger relative text-center">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-app-accent/20 to-app-accent/10 border-2 border-app-accent/30 flex items-center justify-center mx-auto mb-6 relative z-10">
                  <span className="text-xl font-bold text-app-accent">1</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Add a Link</h3>
                <p className="text-gray-400 leading-relaxed">Paste a URL, use the browser extension, or share from your phone. Already have bookmarks? Import them from a file (JSON, CSV, or HTML).</p>
              </div>

              {/* Step 2 */}
              <div className="scroll-animate-stagger relative text-center">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-500/10 border-2 border-purple-500/30 flex items-center justify-center mx-auto mb-6 relative z-10">
                  <span className="text-xl font-bold text-purple-400">2</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">AI Suggests, You Pick</h3>
                <p className="text-gray-400 leading-relaxed">AI analyzes the URL and recommends categories and tags. Accept what fits, skip what doesn&apos;t. You&apos;re always in control.</p>
              </div>

              {/* Step 3 */}
              <div className="scroll-animate-stagger relative text-center">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500/20 to-green-500/10 border-2 border-green-500/30 flex items-center justify-center mx-auto mb-6 relative z-10">
                  <span className="text-xl font-bold text-green-400">3</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Find It Instantly</h3>
                <p className="text-gray-400 leading-relaxed">Type a few letters and your bookmark appears. Search across names, URLs, categories, and tags at the same time.</p>
              </div>
            </div>
          </div>

          {/* Browser Extensions Section */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
            <div className="text-center mb-20">
              <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
                See It. Save It. Find It Later.
              </h2>
              <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                One click in your browser and the page is saved, categorized, and searchable forever.
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
                  <p className="text-gray-400 text-sm mb-6">Most popular. Works out of the box.</p>
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
                  <p className="text-gray-400 text-sm mb-6">Full support. Same one-click save.</p>
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
                  <p className="text-gray-400 text-sm mb-6">Chromium-based. Installs instantly.</p>
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
                What You Actually Get
              </h2>
              <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                Six reasons people stop using browser bookmarks after trying this.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Feature 1 - Instant Search */}
              <div className="scroll-animate-stagger group bg-app-bg-light/30 hover:bg-app-bg-light/50 border border-app-border hover:border-app-accent/50 rounded-2xl p-6 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-app-accent/10">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-app-accent/20 to-app-accent/5 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <LightningIcon className="w-7 h-7 text-app-accent" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">Instant Search</h3>
                <p className="text-gray-400 leading-relaxed">Start typing, results show up. Searches names, URLs, categories, and tags at the same time. No scrolling through folders.</p>
              </div>

              {/* Feature 2 - Auto-Organize */}
              <div className="scroll-animate-stagger group bg-app-bg-light/30 hover:bg-app-bg-light/50 border border-app-border hover:border-purple-500/50 rounded-2xl p-6 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-purple-500/10">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <TagIcon className="w-7 h-7 text-purple-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">AI Suggestions</h3>
                <p className="text-gray-400 leading-relaxed">Add a link and AI recommends categories and tags that make sense. You pick, you skip — your call. Organizing goes from minutes to seconds.</p>
              </div>

              {/* Feature 3 - One-Click Save */}
              <div className="scroll-animate-stagger group bg-app-bg-light/30 hover:bg-app-bg-light/50 border border-app-border hover:border-blue-500/50 rounded-2xl p-6 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-blue-500/10">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <BookmarkIcon className="w-7 h-7 text-blue-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">One-Click Save</h3>
                <p className="text-gray-400 leading-relaxed">Browser extension saves the page you&apos;re on with one click. No copy-pasting URLs. Works on Chrome, Firefox, and Edge.</p>
              </div>

              {/* Feature 4 - Works Everywhere */}
              <div className="scroll-animate-stagger group bg-app-bg-light/30 hover:bg-app-bg-light/50 border border-app-border hover:border-emerald-500/50 rounded-2xl p-6 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-emerald-500/10">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <DeviceMobileIcon className="w-7 h-7 text-emerald-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">Works Everywhere</h3>
                <p className="text-gray-400 leading-relaxed">Save on desktop, find it on your phone. PWA works on any device with a browser — no app store needed.</p>
              </div>

              {/* Feature 5 - Your Data Only */}
              <div className="scroll-animate-stagger group bg-app-bg-light/30 hover:bg-app-bg-light/50 border border-app-border hover:border-cyan-500/50 rounded-2xl p-6 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-cyan-500/10">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <LockIcon className="w-7 h-7 text-cyan-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">Your Data, Always</h3>
                <p className="text-gray-400 leading-relaxed">Full JSON export anytime. No lock-in, no hidden catches. If you want to leave, your bookmarks come with you.</p>
              </div>

              {/* Feature 6 - Free + Pro Plans */}
              <div className="scroll-animate-stagger group bg-app-bg-light/30 hover:bg-app-bg-light/50 border border-app-border hover:border-green-500/50 rounded-2xl p-6 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-green-500/10">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <CurrencyDollarIcon className="w-7 h-7 text-green-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">Start Free, Scale Up</h3>
                <p className="text-gray-400 leading-relaxed">1,000 bookmarks and 30 AI suggestions a month for free. Hit the limit? Pro and Pro Max remove the ceiling.</p>
              </div>
            </div>
          </div>

          {/* Comparison Section */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 scroll-animate">
            <div className="text-center mb-12 animate-fadeInUp">
              <div className="inline-block px-4 py-1.5 bg-gradient-to-r from-app-accent/10 to-purple-500/10 border border-app-accent/30 rounded-full text-app-accent text-sm font-medium mb-4">
                Side by Side
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                What Changes When You Switch
              </h2>
              <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                Same bookmarks. Completely different experience.
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
                      <td className="py-4 px-6 text-white font-medium">Finding a saved link</td>
                      <td className="py-4 px-6 text-center">
                        <span className="text-red-400">Scroll and hope</span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="text-green-400 font-semibold">Type 2 letters, done</span>
                      </td>
                    </tr>
                    <tr className="hover:bg-app-bg-light/20 transition-colors">
                      <td className="py-4 px-6 text-white font-medium">Organizing</td>
                      <td className="py-4 px-6 text-center">
                        <CloseIcon className="w-5 h-5 text-red-400 mx-auto" />
                      </td>
                      <td className="py-4 px-6 text-center">
                        <CheckmarkIcon className="w-5 h-5 text-green-400 mx-auto" />
                      </td>
                    </tr>
                    <tr className="hover:bg-app-bg-light/20 transition-colors">
                      <td className="py-4 px-6 text-white font-medium">Access from other devices</td>
                      <td className="py-4 px-6 text-center">
                        <span className="text-yellow-400">Same browser only</span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="text-green-400 font-semibold">Any device, any browser</span>
                      </td>
                    </tr>
                    <tr className="hover:bg-app-bg-light/20 transition-colors">
                      <td className="py-4 px-6 text-white font-medium">Broken links</td>
                      <td className="py-4 px-6 text-center">
                        <CloseIcon className="w-5 h-5 text-red-400 mx-auto" />
                      </td>
                      <td className="py-4 px-6 text-center">
                        <CheckmarkIcon className="w-5 h-5 text-green-400 mx-auto" />
                      </td>
                    </tr>
                    <tr className="hover:bg-app-bg-light/20 transition-colors">
                      <td className="py-4 px-6 text-white font-medium">Tags &amp; categories</td>
                      <td className="py-4 px-6 text-center">
                        <CloseIcon className="w-5 h-5 text-red-400 mx-auto" />
                      </td>
                      <td className="py-4 px-6 text-center">
                        <CheckmarkIcon className="w-5 h-5 text-green-400 mx-auto" />
                      </td>
                    </tr>
                    <tr className="hover:bg-app-bg-light/20 transition-colors">
                      <td className="py-4 px-6 text-white font-medium">Getting your data out</td>
                      <td className="py-4 px-6 text-center">
                        <span className="text-yellow-400">HTML file, maybe</span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="text-green-400 font-semibold">JSON, CSV, or HTML</span>
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
                  Why It Sticks
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                  Built for People Who Gave Up on Bookmarks
                </h2>
                <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                  You&apos;ve tried folders. You&apos;ve tried &quot;Read Later&quot; apps. Here&apos;s why this one actually works.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                    <CheckmarkIcon className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Nothing to Learn</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">If you can type into a search bar, you already know the whole app. No tutorials, no onboarding videos.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
                    <LightningIcon className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Fast Enough to Be Useful</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">Search results appear while you type. If it took longer than your browser&apos;s address bar, nobody would use it. It doesn&apos;t.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
                    <LockIcon className="w-6 h-6 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Your Data Leaves When You Do</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">One-click export to JSON, CSV, or HTML. No lock-in. If you find something better tomorrow, take everything with you.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-center">
                    <CurrencyDollarIcon className="w-6 h-6 text-pink-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Free Means Free</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">1,000 bookmarks, 100 categories, 300 tags, 30 AI suggestions a month. No credit card. No &quot;free trial.&quot; Just free.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Pricing Section */}
          <div id="pricing" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 scroll-animate">
            <div className="text-center mb-12 animate-fadeInUp">
              <div className="inline-block px-4 py-1.5 bg-green-500/10 border border-green-500/30 rounded-full text-green-400 text-sm font-medium mb-4">
                Pricing
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Pick What Fits
              </h2>
              <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                Most people never need more than the free plan. But if you do, it&apos;s here.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Free */}
              <div className="scroll-animate-stagger bg-app-bg-light/30 border border-app-border rounded-2xl p-8 hover:border-gray-500/50 transition-all">
                <div className="text-sm font-medium text-gray-400 mb-2">Free</div>
                <div className="text-3xl font-bold text-white mb-1">$0</div>
                <div className="text-sm text-gray-500 mb-6">Forever. No card needed.</div>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center gap-3 text-sm text-gray-300">
                    <CheckmarkIcon className="w-4 h-4 text-green-400 flex-shrink-0" />1,000 bookmarks
                  </li>
                  <li className="flex items-center gap-3 text-sm text-gray-300">
                    <CheckmarkIcon className="w-4 h-4 text-green-400 flex-shrink-0" />100 categories
                  </li>
                  <li className="flex items-center gap-3 text-sm text-gray-300">
                    <CheckmarkIcon className="w-4 h-4 text-green-400 flex-shrink-0" />300 tags
                  </li>
                  <li className="flex items-center gap-3 text-sm text-gray-300">
                    <CheckmarkIcon className="w-4 h-4 text-green-400 flex-shrink-0" />30 AI suggestions / month
                  </li>
                  <li className="flex items-center gap-3 text-sm text-gray-300">
                    <CheckmarkIcon className="w-4 h-4 text-green-400 flex-shrink-0" />Full export (JSON, CSV, HTML)
                  </li>
                  <li className="flex items-center gap-3 text-sm text-gray-300">
                    <CheckmarkIcon className="w-4 h-4 text-green-400 flex-shrink-0" />All devices &amp; browser extension
                  </li>
                </ul>
                <Link href={PAGE_CONFIG.LOGIN_URL} className={`block text-center px-6 py-3 ${BUTTON_CLASSES.PRIMARY} w-full`}>
                  Get Started
                </Link>
              </div>

              {/* Pro */}
              <div className="scroll-animate-stagger relative bg-app-bg-light/30 border-2 border-amber-500/50 rounded-2xl p-8 hover:border-amber-400/70 transition-all shadow-lg shadow-amber-500/5">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-amber-500/20 border border-amber-500/30 rounded-full text-amber-400 text-xs font-medium">
                  Most popular
                </div>
                <div className="text-sm font-medium text-amber-400 mb-2">Pro</div>
                <div className="text-3xl font-bold text-white mb-1">Coming soon</div>
                <div className="text-sm text-gray-500 mb-6">For power users.</div>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center gap-3 text-sm text-gray-300">
                    <CheckmarkIcon className="w-4 h-4 text-amber-400 flex-shrink-0" />10,000 bookmarks
                  </li>
                  <li className="flex items-center gap-3 text-sm text-gray-300">
                    <CheckmarkIcon className="w-4 h-4 text-amber-400 flex-shrink-0" />500 categories
                  </li>
                  <li className="flex items-center gap-3 text-sm text-gray-300">
                    <CheckmarkIcon className="w-4 h-4 text-amber-400 flex-shrink-0" />1,000 tags
                  </li>
                  <li className="flex items-center gap-3 text-sm text-gray-300">
                    <CheckmarkIcon className="w-4 h-4 text-amber-400 flex-shrink-0" />500 AI suggestions / month
                  </li>
                  <li className="flex items-center gap-3 text-sm text-gray-300">
                    <CheckmarkIcon className="w-4 h-4 text-amber-400 flex-shrink-0" />Link health check
                  </li>
                  <li className="flex items-center gap-3 text-sm text-gray-300">
                    <CheckmarkIcon className="w-4 h-4 text-amber-400 flex-shrink-0" />Everything in Free
                  </li>
                </ul>
                <div className="block text-center px-6 py-3 bg-amber-500/10 border border-amber-500/30 text-amber-400 font-medium rounded-lg cursor-default w-full">
                  Coming Soon
                </div>
              </div>

              {/* Pro Max */}
              <div className="scroll-animate-stagger bg-app-bg-light/30 border border-purple-500/30 rounded-2xl p-8 hover:border-purple-500/50 transition-all">
                <div className="text-sm font-medium text-purple-400 mb-2">Pro Max</div>
                <div className="text-3xl font-bold text-white mb-1">Coming soon</div>
                <div className="text-sm text-gray-500 mb-6">No limits. Period.</div>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center gap-3 text-sm text-gray-300">
                    <CheckmarkIcon className="w-4 h-4 text-purple-400 flex-shrink-0" />Unlimited bookmarks
                  </li>
                  <li className="flex items-center gap-3 text-sm text-gray-300">
                    <CheckmarkIcon className="w-4 h-4 text-purple-400 flex-shrink-0" />Unlimited categories &amp; tags
                  </li>
                  <li className="flex items-center gap-3 text-sm text-gray-300">
                    <CheckmarkIcon className="w-4 h-4 text-purple-400 flex-shrink-0" />Unlimited AI suggestions
                  </li>
                  <li className="flex items-center gap-3 text-sm text-gray-300">
                    <CheckmarkIcon className="w-4 h-4 text-purple-400 flex-shrink-0" />Everything in Pro
                  </li>
                </ul>
                <div className="block text-center px-6 py-3 bg-purple-500/10 border border-purple-500/30 text-purple-400 font-medium rounded-lg cursor-default w-full">
                  Coming Soon
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
                Before You Sign Up
              </h2>
            </div>

            <div className="space-y-3">
              {/* FAQ 1 */}
              <details className="scroll-animate-stagger group bg-gradient-to-br from-app-bg-light/50 to-app-bg-light/30 border border-app-border rounded-2xl overflow-hidden hover:border-app-accent/50 transition-all">
                <summary className="cursor-pointer p-6 flex items-center justify-between text-lg font-semibold text-white hover:text-app-accent transition-colors">
                  <span>I have 500+ bookmarks in Chrome. Can I bring them over?</span>
                  <ChevronDownIcon className="w-5 h-5 transform group-open:rotate-180 transition-transform text-app-accent" />
                </summary>
                <div className="px-6 pb-6 text-gray-400 leading-relaxed">
                  Yes. Export your bookmarks from any browser as an HTML file, then import them into Site Organizer with one click. Categories and folder structure are preserved. You can also import from JSON and CSV files.
                </div>
              </details>

              {/* FAQ 2 */}
              <details className="scroll-animate-stagger group bg-gradient-to-br from-app-bg-light/50 to-app-bg-light/30 border border-app-border rounded-2xl overflow-hidden hover:border-purple-500/50 transition-all">
                <summary className="cursor-pointer p-6 flex items-center justify-between text-lg font-semibold text-white hover:text-purple-400 transition-colors">
                  <span>What if I want to leave? Am I stuck here?</span>
                  <ChevronDownIcon className="w-5 h-5 transform group-open:rotate-180 transition-transform text-purple-400" />
                </summary>
                <div className="px-6 pb-6 text-gray-400 leading-relaxed">
                  Not at all. One-click export to JSON, CSV, or HTML anytime from Settings. Every bookmark, category, and tag comes with you. No emails, no &quot;are you sure?&quot; screens. Your data, your choice.
                </div>
              </details>

              {/* FAQ 3 */}
              <details className="scroll-animate-stagger group bg-gradient-to-br from-app-bg-light/50 to-app-bg-light/30 border border-app-border rounded-2xl overflow-hidden hover:border-green-500/50 transition-all">
                <summary className="cursor-pointer p-6 flex items-center justify-between text-lg font-semibold text-white hover:text-green-400 transition-colors">
                  <span>Does the AI auto-organize my bookmarks?</span>
                  <ChevronDownIcon className="w-5 h-5 transform group-open:rotate-180 transition-transform text-green-400" />
                </summary>
                <div className="px-6 pb-6 text-gray-400 leading-relaxed">
                  AI suggests categories and tags when you add a link &mdash; you decide which ones to apply. Nothing happens without your approval. Think of it as a smart assistant that recommends, not a robot that rearranges your stuff.
                </div>
              </details>

              {/* FAQ 4 */}
              <details className="scroll-animate-stagger group bg-gradient-to-br from-app-bg-light/50 to-app-bg-light/30 border border-app-border rounded-2xl overflow-hidden hover:border-amber-500/50 transition-all">
                <summary className="cursor-pointer p-6 flex items-center justify-between text-lg font-semibold text-white hover:text-amber-400 transition-colors">
                  <span>What happens when I hit the free plan limit?</span>
                  <ChevronDownIcon className="w-5 h-5 transform group-open:rotate-180 transition-transform text-amber-400" />
                </summary>
                <div className="px-6 pb-6 text-gray-400 leading-relaxed">
                  Nothing breaks. You keep all your existing bookmarks and can still search, edit, and export everything. You just can&apos;t add new ones until you upgrade or free up space. Free tier includes 1,000 bookmarks, 100 categories, 300 tags, and 30 AI suggestions per month.
                </div>
              </details>

              {/* FAQ 5 */}
              <details className="scroll-animate-stagger group bg-gradient-to-br from-app-bg-light/50 to-app-bg-light/30 border border-app-border rounded-2xl overflow-hidden hover:border-cyan-500/50 transition-all">
                <summary className="cursor-pointer p-6 flex items-center justify-between text-lg font-semibold text-white hover:text-cyan-400 transition-colors">
                  <span>Can other people see my bookmarks?</span>
                  <ChevronDownIcon className="w-5 h-5 transform group-open:rotate-180 transition-transform text-cyan-400" />
                </summary>
                <div className="px-6 pb-6 text-gray-400 leading-relaxed">
                  No. Every bookmark is tied to your account and filtered by your user ID at the database level. There are no public profiles, no social features, no sharing by default. Only you see your data.
                </div>
              </details>

              {/* FAQ 6 */}
              <details className="scroll-animate-stagger group bg-gradient-to-br from-app-bg-light/50 to-app-bg-light/30 border border-app-border rounded-2xl overflow-hidden hover:border-rose-500/50 transition-all">
                <summary className="cursor-pointer p-6 flex items-center justify-between text-lg font-semibold text-white hover:text-rose-400 transition-colors">
                  <span>I don&apos;t use a computer much. Does it work on my phone?</span>
                  <ChevronDownIcon className="w-5 h-5 transform group-open:rotate-180 transition-transform text-rose-400" />
                </summary>
                <div className="px-6 pb-6 text-gray-400 leading-relaxed">
                  Yes. Site Organizer is a PWA &mdash; it works in any mobile browser and you can install it to your home screen like a native app. On Android, you can even share links directly from your browser to Site Organizer using the Share menu.
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
                  Stop Googling Links
                  <br />
                  You Already Saved.
                </h2>
                <p className="text-gray-400 text-lg sm:text-xl max-w-2xl mx-auto mb-8">
                  Create a free account, import your bookmarks, and find anything in seconds.
                  <br className="hidden sm:block" />
                  <span className="text-white font-semibold">Takes under a minute. No card required.</span>
                </p>

                <div className="flex flex-wrap gap-6 justify-center mb-12 text-sm">
                  <div className="flex items-center gap-2 text-gray-300">
                    <CheckCircleFilledIcon className="w-5 h-5 text-green-400" />
                    1,000 bookmarks free
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <CheckCircleFilledIcon className="w-5 h-5 text-green-400" />
                    Import from any browser
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <CheckCircleFilledIcon className="w-5 h-5 text-green-400" />
                    Export anytime
                  </div>
                </div>

                <Link
                  href={PAGE_CONFIG.LOGIN_URL}
                  className={`inline-flex items-center gap-2 px-10 py-5 ${BUTTON_CLASSES.PRIMARY_LARGE} group text-xl`}
                >
                  Create Free Account
                  <ArrowRightIcon className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                </Link>

                <p className="text-gray-500 text-xs mt-6">
                  No credit card. No trial period. Free means free.
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
                Your bookmarks, finally organized.
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
              <h3 className="text-white font-semibold mb-3 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">What You Get</h3>
              <div className="flex flex-col gap-2 text-sm items-center md:items-end">
                <span className="text-gray-300">💎 Free plan with 1,000 bookmarks</span>
                <span className="text-gray-300">🤖 AI category &amp; tag suggestions</span>
                <span className="text-gray-300">📤 JSON, CSV &amp; HTML export</span>
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
                <span>Made for people who save too many links</span>
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
