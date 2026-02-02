/**
 * @fileoverview Tailwind CSS Configuration - Site Organizator
 * @see https://tailwindcss.com/docs/configuration
 * @description Custom theme with dark color palette, responsive breakpoints, and utility classes
 */

/**
 * Tailwind configuration object
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  // Content paths for Tailwind to scan
  content: [
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './app/**/*.{js,jsx}',
  ],

  theme: {
    // Custom responsive breakpoints
    screens: {
      xs: '320px',   // Extra small devices
      sm: '640px',   // Small devices (mobile)
      md: '768px',   // Medium devices (tablets)
      lg: '1024px',  // Large devices (desktops)
      xl: '1280px',  // Extra large devices
      '2xl': '1536px', // 2X extra large devices
    },

    extend: {
      // Custom color palette
      colors: {
        // ----------------------------------------
        // Main Application Colors
        // ----------------------------------------
        app: {
          bg: {
            primary: '#050a30',    // Main background (dark blue)
            secondary: '#0F1E3D',  // Secondary background
            tertiary: '#0b1638',   // Tertiary background
            light: '#1A2E52',      // Light background
            lighter: '#2A3E5F',    // Lighter background
            card: '#243A5E',       // Card background
          },
          text: {
            primary: '#E0E8F7',    // Primary text (light)
            secondary: '#A0B4D0',  // Secondary text
            tertiary: '#8A9FB5',   // Tertiary text
            muted: '#556b85',      // Muted text
            accent: '#6CBBFB',     // Accent text (blue)
            light: '#A0D8FF',      // Light text
          },
          accent: '#6CBBFB',       // Primary accent color
          accentLight: '#A0D8FF',  // Light accent color
          border: '#3A4E6F',       // Border color
          divider: '#1A2E52',      // Divider color
        },

        // ----------------------------------------
        // Category Palette Colors
        // ----------------------------------------
        category: {
          purple: '#667eea',       // Purple category
          blue: '#6CBBFB',         // Blue category
          teal: '#52A69B',         // Teal category
          coral: '#D98B8B',        // Coral category
          orange: '#E0A96D',       // Orange category
          rose: '#D98BAC',         // Rose category
          gold: '#D4B86A',         // Gold category
        },

        // ----------------------------------------
        // Pricing Model Colors
        // ----------------------------------------
        pricing: {
          fullyFree: '#1A5E3F',        // Fully Free background
          fullyFreeText: '#7FD8BE',    // Fully Free text
          paid: '#8B2C2C',             // Paid background
          paidText: '#FFB3B3',         // Paid text
          freemium: '#8B7C1D',         // Freemium background
          freemiumText: '#FFE66D',     // Freemium text
          freeTrial: '#26547C',        // Free Trial background
          freeTrialText: '#8ECAE6',    // Free Trial text
        },

        // ----------------------------------------
        // Alert/Status Colors
        // ----------------------------------------
        alert: {
          success: '#1B4332',          // Success background
          successText: '#95D5B2',      // Success text
          error: '#6A1B1B',            // Error background
          errorText: '#FC8181',        // Error text
          info: '#0c5460',             // Info background
          infoText: '#1dd1a1',         // Info text
        },

        // ----------------------------------------
        // Button/Form Colors
        // ----------------------------------------
        btn: {
          primary: '#1E4976',          // Primary button
          hover: '#2A5A8A',            // Primary button hover
          secondary: '#1A2E52',        // Secondary button
          danger: '#8B3A3A',           // Danger button
          dangerHover: '#A85252',      // Danger button hover
        },

        // ----------------------------------------
        // Error State Colors
        // ----------------------------------------
        error: {
          light: '#3D1F1F',            // Light error background
          lighter: '#4D2929',          // Lighter error background
          text: '#E57373',             // Error text
          textLight: '#FF8A8A',        // Light error text
        },

        // ----------------------------------------
        // Warning State Colors
        // ----------------------------------------
        warning: {
          light: '#FF6B6B',            // Warning text
        },

        // ----------------------------------------
        // Success State Colors
        // ----------------------------------------
        success: {
          bg: '#1a472a',               // Success background
          text: '#6ee7b7',             // Success text
          border: '#6ee7b7',           // Success border
        },

        // ----------------------------------------
        // Danger State Colors
        // ----------------------------------------
        danger: {
          bg: '#472025',               // Danger background
          text: '#f87171',             // Danger text
          border: '#f87171',           // Danger border
        },
      },

      // ----------------------------------------
      // Custom Background Gradients
      // ----------------------------------------
      backgroundImage: {
        'gradient-app': 'linear-gradient(135deg, #050a30 0%, #0F1E3D 100%)',
        'gradient-card': 'linear-gradient(135deg, #0F1E3D 0%, #1A2E52 100%)',
        'gradient-dark': 'linear-gradient(135deg, #0F1E3D 0%, #1a0a0a 100%)',
      },

      // ----------------------------------------
      // Custom Animations
      // ----------------------------------------
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'bounce-slow': 'bounceSlow 2s ease-in-out infinite',
      },

      // ----------------------------------------
      // Custom Keyframes
      // ----------------------------------------
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        bounceSlow: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },

  // Plugins (add custom utilities or components)
  plugins: [],
};