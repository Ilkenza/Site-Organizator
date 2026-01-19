module.exports = {
  content: [
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './app/**/*.{js,jsx}'
  ],
  theme: {
    screens: {
      'xs': '320px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        // Main app colors from legacy dashboard
        app: {
          bg: {
            primary: '#050a30',      // Main background
            secondary: '#0F1E3D',    // Secondary background
            tertiary: '#0b1638',     // Tertiary background
            light: '#1A2E52',        // Light background
            lighter: '#2A3E5F',      // Lighter background
            card: '#243A5E',         // Card background
          },
          text: {
            primary: '#E0E8F7',      // Primary text
            secondary: '#A0B4D0',    // Secondary text
            tertiary: '#8A9FB5',     // Tertiary text
            muted: '#556b85',        // Muted text
            accent: '#6CBBFB',       // Accent text
            light: '#A0D8FF',        // Light text
          },
          accent: '#6CBBFB',         // Primary accent
          accentLight: '#A0D8FF',    // Light accent
          border: '#3A4E6F',         // Border color
          divider: '#1A2E52',        // Divider color
        },

        // Category palette colors
        category: {
          purple: '#667eea',         // Purple
          blue: '#6CBBFB',           // Blue
          teal: '#52A69B',           // Teal
          coral: '#D98B8B',          // Coral
          orange: '#E0A96D',         // Orange
          rose: '#D98BAC',           // Rose
          gold: '#D4B86A',           // Gold
        },

        // Pricing model colors
        pricing: {
          fullyFree: '#1A5E3F',      // Fully Free background
          fullyFreeText: '#7FD8BE',  // Fully Free text
          paid: '#8B2C2C',           // Paid background
          paidText: '#FFB3B3',       // Paid text
          freemium: '#8B7C1D',       // Freemium background
          freemiumText: '#FFE66D',   // Freemium text
          freeTrial: '#26547C',      // Free Trial background
          freeTrialText: '#8ECAE6',  // Free Trial text
        },

        // Alert/Status colors
        alert: {
          success: '#1B4332',        // Success background
          successText: '#95D5B2',    // Success text
          error: '#6A1B1B',          // Error background
          errorText: '#FC8181',      // Error text
          info: '#0c5460',           // Info background
          infoText: '#1dd1a1',       // Info text
        },

        // Button/Form colors
        btn: {
          primary: '#1E4976',        // Primary button
          hover: '#2A5A8A',          // Primary button hover
          secondary: '#1A2E52',      // Secondary button
          danger: '#8B3A3A',         // Danger button
          dangerHover: '#A85252',    // Danger button hover
        },

        // Additional utility colors
        error: {
          light: '#3D1F1F',          // Light error background
          lighter: '#4D2929',        // Lighter error background
          text: '#E57373',           // Error text
          textLight: '#FF8A8A',      // Light error text
        },

        warning: {
          light: '#FF6B6B',          // Warning text
        },

        success: {
          bg: '#1a472a',             // Success background
          text: '#6ee7b7',           // Success text
          border: '#6ee7b7',         // Success border
        },

        danger: {
          bg: '#472025',             // Danger background
          text: '#f87171',           // Danger text
          border: '#f87171',         // Danger border
        },
      },
      backgroundImage: {
        'gradient-app': 'linear-gradient(135deg, #050a30 0%, #0F1E3D 100%)',
        'gradient-card': 'linear-gradient(135deg, #0F1E3D 0%, #1A2E52 100%)',
        'gradient-dark': 'linear-gradient(135deg, #0F1E3D 0%, #1a0a0a 100%)',
      }
    }
  },
  plugins: []
};