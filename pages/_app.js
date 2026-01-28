import '../styles/globals.css';
import { useEffect } from 'react';
import Head from 'next/head';
import { AuthProvider } from '../context/AuthContext';

export default function App({ Component, pageProps }) {
  // Register Service Worker for PWA
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker
        .register('/sw.js')
        .then(() => {
        })
        .catch(() => {
        });
    }
  }, []);

  return (
    <AuthProvider>
      <Head>
        {/* PWA Meta Tags */}
        <meta name="application-name" content="Site Organizer" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Site Organizer" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#050a30" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />

        {/* PWA Manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* Apple Touch Icons */}
        <link rel="apple-touch-icon" href="/icons/icon-152x152.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-192x192.png" />

        {/* Favicon */}
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-96x96.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/icon-72x72.png" />
      </Head>
      <Component {...pageProps} />
    </AuthProvider>
  );
}
