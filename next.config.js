/**
 * @fileoverview Next.js Configuration - Site Organizator
 * @see https://nextjs.org/docs/api-reference/next.config.js/introduction
 */

// Configuration constants
const CONFIG = {
    // Supabase project URL (extract domain from env)
    SUPABASE_DOMAIN: 'skacyhzljreaitrbgbte.supabase.co',

    // Build settings
    ESLINT_IGNORE_DURING_BUILDS: true, // TODO: Remove once all lint issues are fixed

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

    // Temporarily ignore ESLint during builds
    // TODO: Fix all ESLint warnings and remove this
    eslint: {
        ignoreDuringBuilds: CONFIG.ESLINT_IGNORE_DURING_BUILDS,
    },

    // Image optimization configuration
    images: {
        // Allow images from Supabase Storage (avatars)
        domains: [CONFIG.SUPABASE_DOMAIN],

        // Image formats to support
        formats: ['image/avif', 'image/webp'],

        // Disable static image imports for better control
        // disableStaticImages: false,
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
        ];
    },
};

module.exports = nextConfig;
