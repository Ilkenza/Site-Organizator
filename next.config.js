/**
 * @fileoverview Next.js Configuration - Site Organizator
 * @see https://nextjs.org/docs/api-reference/next.config.js/introduction
 */

// Configuration constants
const CONFIG = {
    // Supabase project URL (extract domain from env)
    SUPABASE_DOMAIN: (() => {
        try {
            const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
            return url.replace(/^https?:\/\//, '').split('/')[0] || 'localhost';
        } catch { return 'localhost'; }
    })(),

    // Build settings — ESLint runs during builds (errors fail the build; warnings don't)
    ESLINT_IGNORE_DURING_BUILDS: false,

    // PWA settings
    PWA_ENABLED: true,

    // Performance settings
    COMPRESS_ENABLED: true,
    STRICT_MODE: true
};

/** @type {import('next').NextConfig} */
const nextConfig = {
    // React strict mode for better development warnings
    reactStrictMode: CONFIG.STRICT_MODE,

    // ESLint runs during builds; errors fail the build (warnings are allowed)
    eslint: {
        ignoreDuringBuilds: CONFIG.ESLINT_IGNORE_DURING_BUILDS,
    },

    // SWC-based minification (faster than Terser)
    swcMinify: true,

    // Image optimization configuration
    images: {
        // Allow images from Supabase Storage (avatars) and Google favicons
        domains: [CONFIG.SUPABASE_DOMAIN, 'www.google.com'],

        // Image formats to support
        formats: ['image/avif', 'image/webp'],

        // Cache optimized images for 24h
        minimumCacheTTL: 86400,
    },

    // Compression
    compress: CONFIG.COMPRESS_ENABLED,

    // PWA configuration
    ...(CONFIG.PWA_ENABLED && {
        // Service Worker and PWA assets
        // Note: Actual PWA implementation in public/sw.js and manifest.json
    }),

    // Environment variables exposed to browser
    env: {
        // Add any custom env vars here if needed (beyond NEXT_PUBLIC_*)
    },

    // Custom webpack configuration (if needed)
    webpack: (config) => {
        // Custom webpack modifications can go here
        return config;
    },

    // Redirects
    async redirects() {
        return [
            {
                source: '/dashboard',
                destination: '/dashboard/sites',
                permanent: true, // 301 redirect
            },
        ];
    },

    // Security Headers
    async headers() {
        return [
            {
                source: '/:path*',
                headers: [
                    {
                        key: 'X-DNS-Prefetch-Control',
                        value: 'on',
                    },
                    {
                        key: 'Strict-Transport-Security',
                        value: 'max-age=63072000; includeSubDomains; preload',
                    },
                    {
                        key: 'X-Frame-Options',
                        value: 'SAMEORIGIN',
                    },
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff',
                    },
                    {
                        key: 'X-XSS-Protection',
                        value: '1; mode=block',
                    },
                    {
                        key: 'Referrer-Policy',
                        value: 'strict-origin-when-cross-origin',
                    },
                    {
                        key: 'Permissions-Policy',
                        value: 'camera=(), microphone=(), geolocation=()',
                    },
                ],
            },
            // PWA: serve the manifest with the correct content type
            {
                source: '/manifest.json',
                headers: [
                    { key: 'Content-Type', value: 'application/manifest+json' },
                    { key: 'Cache-Control', value: 'public, max-age=3600' },
                ],
            },
            // PWA: never cache the service worker so updates are picked up
            {
                source: '/sw.js',
                headers: [
                    { key: 'Content-Type', value: 'application/javascript' },
                    { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
                ],
            },
            // Icons are immutable — cache for a year
            {
                source: '/icons/:path*',
                headers: [
                    { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
                ],
            },
        ];
    },
};

module.exports = nextConfig;
