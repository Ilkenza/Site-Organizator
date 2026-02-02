/**
 * @fileoverview PostCSS Configuration - Site Organizator
 * @see https://postcss.org/
 * @description Configures CSS processing pipeline with Tailwind CSS and Autoprefixer
 */

/**
 * PostCSS plugins configuration
 * @type {import('postcss-load-config').Config}
 */
module.exports = {
  plugins: {
    // Tailwind CSS - Utility-first CSS framework
    tailwindcss: {},

    // Autoprefixer - Adds vendor prefixes automatically
    autoprefixer: {},
  },
};