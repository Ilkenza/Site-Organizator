/**
 * @fileoverview Next.js application wrapper component
 * Provides global providers, PWA configuration, and service worker registration
 */

import '../styles/globals.css';
import { useEffect } from 'react';
import Head from 'next/head';
import { AuthProvider } from '../context/AuthContext';

// Configuration
const APP_CONFIG = {
  NAME: 'Site Organizer',
  THEME_COLOR: '#050a30',
  STATUS_BAR_STYLE: 'black-translucent',
  MANIFEST_PATH: '/manifest.json',
  SERVICE_WORKER_PATH: '/sw.js',
  FAVICON_SVG: '/favicon.svg',
  ICONS: {
    APPLE_TOUCH_152: '/icons/icon-152x152.png',
    APPLE_TOUCH_192: '/icons/icon-192x192.png',
    FAVICON_32: '/icons/icon-96x96.png',
    FAVICON_16: '/icons/icon-72x72.png'
  }
};

// Console error filter patterns
const CONSOLE_FILTER_PATTERNS = ['faviconV2', 't1.gstatic.com'];

/**
 * Check if error should be filtered (suppressed)
 * @param {string} message - Error message to check
 * @returns {boolean} True if error should be suppressed
 */
const shouldFilterError = (message) => {
  if (!message?.includes) return false;
  return CONSOLE_FILTER_PATTERNS.some(pattern => message.includes(pattern));
};

/**
 * Setup console error filter to suppress Google favicon 404 warnings
 * @returns {Function} Cleanup function to restore original console.error
 */
const setupConsoleErrorFilter = () => {
  const originalError = console.error;

  console.error = (...args) => {
    if (shouldFilterError(args[0])) {
      return; // Silent ignore
    }
    originalError(...args);
  };

  return () => {
    console.error = originalError;
  };
};

/**
 * Register service worker for PWA functionality
 * Only runs in production mode
 * @returns {Promise<void>}
 */
const registerServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  try {
    await navigator.serviceWorker.register(APP_CONFIG.SERVICE_WORKER_PATH);
  } catch (error) {
    // Silent fail - service worker is optional enhancement
  }
};

/**
 * Main application component wrapper
 * @param {Object} props - Component props
 * @param {React.ComponentType} props.Component - Active page component
 * @param {Object} props.pageProps - Page component props
 * @returns {JSX.Element} Application wrapper
 */
export default function App({ Component, pageProps }) {
  // Setup console error filter
  useEffect(() => {
    const cleanup = setupConsoleErrorFilter();
    return cleanup;
  }, []);

  // Register service worker
  useEffect(() => {
    registerServiceWorker();
  }, []);

  return (
    <AuthProvider>
      <Head>
        {/* PWA Meta Tags */}
        <meta name="application-name" content={APP_CONFIG.NAME} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content={APP_CONFIG.STATUS_BAR_STYLE} />
        <meta name="apple-mobile-web-app-title" content={APP_CONFIG.NAME} />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content={APP_CONFIG.THEME_COLOR} />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />

        {/* PWA Manifest */}
        <link rel="manifest" href={APP_CONFIG.MANIFEST_PATH} />

        {/* Apple Touch Icons */}
        <link rel="apple-touch-icon" href={APP_CONFIG.ICONS.APPLE_TOUCH_152} />
        <link rel="apple-touch-icon" sizes="180x180" href={APP_CONFIG.ICONS.APPLE_TOUCH_192} />

        {/* Favicon */}
        <link rel="icon" type="image/svg+xml" href={APP_CONFIG.FAVICON_SVG} />
        <link rel="icon" type="image/png" sizes="32x32" href={APP_CONFIG.ICONS.FAVICON_32} />
        <link rel="icon" type="image/png" sizes="16x16" href={APP_CONFIG.ICONS.FAVICON_16} />
      </Head>
      <Component {...pageProps} />
    </AuthProvider>
  );
}
