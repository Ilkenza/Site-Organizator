# 🌐 Site Organizer

A smart bookmark manager with AI-powered suggestions. Save any link, get category & tag suggestions from AI, and find anything instantly. Free tier with Pro upgrades for power users.

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![React](https://img.shields.io/badge/React-18.2-61dafb?logo=react)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ecf8e?logo=supabase)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4.7-38bdf8?logo=tailwindcss)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js)

## ✨ Features

### 📌 Site Management

- **Add / Edit / Delete** sites with name, URL, description, and pricing model
- **Favorite ⭐ & Pin 📌** sites for quick access (with star burst & pin bounce animations)
- **Inline rename** — double-click any site name to edit it in place
- **Favicon display** — auto-fetched from Google's favicon API
- **Pricing model tracking** — mark sites as Fully Free, Freemium, Free Trial, or Paid
- **Import source badge** — shows where each site came from (Manual, Bookmarks, Notion, File)
- **Responsive card grid** — 1→2→3 columns with skeleton loading placeholders

### 📁 Categories & Tags

- **Color-coded categories** — auto-assigned from a curated color palette
- **Color-coded tags** — fine-grained organization with custom colors
- **Multi-assign** — sites can have multiple categories and multiple tags
- **Inline rename** — double-click to edit names in place
- **Usage counts** — see how many sites use each category/tag
- **Filter by usage** — show All / Used / Unused
- **Search within lists** — filter categories/tags by name
- **Create inline** — create new categories/tags directly from the site modal
- **Bulk delete** — multi-select mode with checkbox selection
- **Delete warnings** — shows how many sites will be affected before deleting

### 🤖 AI Suggestions

- **GPT-4o-mini powered** — suggests categories, tags, and pricing model for any URL
- **Page metadata fetching** — AI reads the target page's title, description, and keywords for context
- **Client-side pattern matching** — instant suggestions from 20+ category patterns and 40+ tag patterns based on domain
- **Reverse matching** — matches suggestions against your existing categories/tags
- **Monthly usage limits** — Free: 30/mo, Pro: 500/mo, Pro Max: unlimited
- **Works in browser extension** — AI suggestions available when saving from extension too

### 🔍 Search & Filtering

- **Global site search** — real-time full-text search across name, URL, and description (debounced 300ms)
- **Category filter** — click any category in sidebar to filter sites
- **Tag filter** — click any tag in sidebar to filter sites
- **Import source filter** — filter by Manual / Bookmarks / Notion / File
- **Cross-filter counts** — sidebar shows intersection counts (how many sites match current combination)
- **Sidebar search** — search within the sidebar's category and tag lists
- **Sort** — sort sites by name, date created, date updated, or pricing; ascending/descending toggle
- **`Ctrl+K`** — focus search from anywhere

### 📄 Pagination

- **Server-side** for sites (30 per page), **client-side** for categories/tags (50 per page)
- **Keyboard navigation** — `←`/`→` prev/next, `Home`/`End` first/last page
- **Scroll-to-top** on page change
- **Navigation cooldown** — 300ms debounce to prevent rapid switching
- **Results counter** — "Showing X–Y of Z sites"

### ⌨️ Keyboard Shortcuts

| Shortcut               | Action                                          |
| ---------------------- | ----------------------------------------------- |
| `Ctrl+K`               | Focus search / Open command menu                |
| `Ctrl+/`               | Toggle command menu                             |
| `N`                    | New item (context-aware: site / category / tag) |
| `M`                    | Toggle multi-select mode                        |
| `Ctrl+A`               | Select all (in multi-select)                    |
| `Ctrl+D`               | Deselect all                                    |
| `Delete` / `Backspace` | Delete selected items                           |
| `←` / `→`              | Previous / next page                            |
| `Home` / `End`         | First / last page                               |
| `Enter`                | Save/confirm in modals, navigate fields         |
| `Esc`                  | Close modals / exit multi-select                |

Full reference: [KEYBOARD_SHORTCUTS.md](KEYBOARD_SHORTCUTS.md)

### 🎯 Command Menu

- **`Ctrl+K` to open** — fuzzy search through all commands
- **Quick actions** — Add site, Create category, Create tag
- **Navigation** — jump to Sites, Favorites, Categories, Tags, Settings
- **Recent sites** — quick access to your 5 most recently saved sites
- **Shortcut reference** — lists all keyboard shortcuts inline

### ✅ Bulk Operations & Undo

- **Multi-select mode** — toggle with `M`, select items with checkboxes
- **Select all / Deselect all** — `Ctrl+A` / `Ctrl+D`
- **Bulk delete** — delete multiple sites, categories, or tags at once
- **5-second undo** — every delete shows an undo toast with countdown; cancel before it's permanent
- **Optimistic UI** — items removed from screen immediately, API call fires after 5s
- **Reset options** — reset all sites, all categories, all tags, or everything (all with undo)

### 📤 Import / Export

**Export formats:**

- **JSON** — full data export with categories, tags, and relationships
- **CSV** — spreadsheet-compatible flat format
- **HTML** — Netscape bookmark format (importable into any browser)

**Import sources:**

- **Browser bookmarks** (HTML) — folders become categories
- **Notion** (CSV/HTML exports)
- **JSON** — re-import previously exported data
- **CSV** — generic CSV import
- **PDF** — extracts URLs from PDF files

**Import features:**

- Preview parsed items before committing
- Chunked import with progress bar and ETA
- Cancellable mid-import
- Duplicate URL detection (skips existing)
- Tier limit enforcement
- Import source tracking per site

### 🔗 Link Health Checker (Pro+)

- **HEAD→GET fallback** with automatic retry (2 attempts)
- **8 concurrent server-side requests** for speed
- **Client-side batching** — 10 URLs per batch, cancellable
- **Progress bar with ETA** — real-time progress during check
- **Results display** — broken count, status codes, error messages
- **Ignore false positives** — dismiss broken links (persisted in localStorage)
- **Pro+ only** — feature-gated for Pro and Pro Max tiers

### 💰 Tier System (Free / Pro / Pro Max)

|                      | **Free** | **Pro** | **Pro Max** |
| -------------------- | -------- | ------- | ----------- |
| Sites                | 1,000    | 10,000  | Unlimited   |
| Categories           | 100      | 500     | Unlimited   |
| Tags                 | 300      | 1,000   | Unlimited   |
| AI suggestions/month | 30       | 500     | Unlimited   |
| Link Health Checker  | ❌       | ✅      | ✅          |

- Tier badge shown in header and settings
- Limits enforced on API routes
- Admin users always get Pro Max access
- Legacy `is_pro` flag backwards-compatible

### 🔐 Security & Authentication

- **Email/password auth** — sign up, sign in, change password, change email
- **MFA / 2FA (TOTP)** — enroll via QR code, challenge on every login
- **AAL2 enforcement** — Authenticator Assurance Level 2 via Supabase
- **Session management** — auto token refresh on window focus, localStorage fallback
- **Emergency recovery** — restores user from localStorage when Supabase session is lost
- **Sign out other sessions** — invalidate all sessions except current
- **Session info** — shows browser, OS, created/expires timestamps in settings
- **Row Level Security** — PostgreSQL policies enforce strict user data isolation

### 👤 Profile & Settings

- **Avatar upload** — profile picture (max 5MB), preview before save
- **Display name** — editable, stored in auth metadata
- **Stats section** — site/category/tag counts + tier info
- **Security section** — password, email, MFA, session management
- **Danger zone** — delete all sites/categories/tags, reset everything, delete account (with type-to-confirm)

### 🛡️ Admin Panel

- **Overview** — total users/sites/categories/tags, active users (7d), new users (30d), empty accounts, sites-per-user stats
- **Growth chart** — 4 time periods (24h, 30d, 12mo, all time); cumulative bar chart
- **Pricing breakdown** — donut chart showing Fully Free / Freemium / Free Trial / Paid distribution
- **Top categories & tags** — most-used across all users
- **Most active users** — users with most activity in past 7 days
- **Popular domains** — most frequently bookmarked domains
- **Users tab** — full user list with search, sort, ban/unban, delete, change tier
- **Content tab** — recent activity, duplicate site detection, CSV exports (users/sites)
- **Tools tab** — AI usage stats (total, this month, by tier, top AI users), global broken links checker, platform health
- **Auto-refresh** — data refreshes every 60 seconds

### 🌐 Browser Extension (Chrome)

- **Manifest V3** Chrome extension
- **Save active tab** — one-click bookmark from any page
- **Login/signup** — auth flow within the popup
- **Remember Me** — persistent token storage
- **Background token refresh** — service worker refreshes every 30 minutes
- **Category & tag picker** — select when saving
- **Pricing model picker** — set pricing when saving
- **AI suggestions** — get AI-suggested categories/tags/pricing in extension
- **Auto-fill** — pre-fills URL and title from current page
- **Recent saves** — dropdown showing last saved sites
- **Badge count** — extension icon shows total saved site count

### 📱 PWA Support

- **Service worker** — precaches key routes (`/`, `/dashboard/sites`, `/login`)
- **Offline fallback** — serves cached pages when offline
- **Web app manifest** — standalone display mode, themed icons (72–512px)
- **Add to Home Screen** — installable on mobile and desktop

### ✨ UI / UX

- **Dark theme** — custom navy-dark palette (`#050a30`) with CSS custom properties
- **Animations** — fadeIn, slideUp, bounceSlow, starBurst, pinBounce, checkPop, fadeInUp, fadeInLeft, fadeInRight, scaleIn, ripple
- **Scroll-triggered animations** — IntersectionObserver with staggered delays
- **Skeleton loading** — pulse-animated placeholders during data fetch
- **Toast notifications** — success/error/info with auto-dismiss
- **Undo toast** — 5-second countdown with undo button
- **Error boundary** — catches React render errors with expandable details
- **Server status indicator** — polls `/api/health` every 30s; shows online/offline dot
- **Responsive layout** — mobile toolbar + sidebar overlay on small screens
- **Onboarding tour** — 13-step guided tour highlighting key features (desktop & mobile variants)
- **Custom scrollbar** — slim styled scrollbar
- **Real-time updates** — Supabase subscriptions on sites, categories, tags, junction tables (2s debounce)

### 🔍 SEO & Landing Page

- **Open Graph & Twitter Card tags** — optimized social sharing
- **JSON-LD structured data** — WebApplication schema with 3-tier pricing
- **Canonical URL, keywords, robots** — full SEO meta
- **Animated hero section** — scroll-triggered with staggered children
- **Feature showcase** — animated cards with icons
- **Pricing comparison table** — Free / Pro / Pro Max side by side
- **FAQ section** — common questions with expandable answers

## 🚀 Tech Stack

### Frontend

| Technology                               | Version | Purpose                           |
| ---------------------------------------- | ------- | --------------------------------- |
| [Next.js](https://nextjs.org/)           | 14.2    | React framework with Pages Router |
| [React](https://react.dev/)              | 18.2    | UI library with hooks             |
| [Tailwind CSS](https://tailwindcss.com/) | 3.4.7   | Utility-first styling             |

### Backend

| Technology                        | Purpose                                               |
| --------------------------------- | ----------------------------------------------------- |
| [Supabase](https://supabase.com/) | PostgreSQL database with Auth, Real-time, and Storage |
| PostgreSQL                        | Primary database with Row Level Security (RLS)        |
| Supabase Auth                     | Authentication with MFA support                       |
| Supabase Storage                  | Avatar image hosting                                  |

### Development

- **Package Manager**: npm/yarn
- **Linting**: ESLint
- **Deployment**: Vercel/Netlify compatible

## 📦 Installation

### Prerequisites

- **Node.js** 20 or higher ([Download](https://nodejs.org/))
- **npm** 10+ or **yarn**
- **Supabase account** ([create one free](https://supabase.com))

### Step-by-Step Setup

#### 1. Clone Repository

```bash
git clone https://github.com/ilkenza/site-organizator.git
cd site-organizator
```

#### 2. Install Dependencies

```bash
npm install
# or
yarn install
```

#### 3. Environment Configuration

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_ADMIN_EMAILS=your-email@example.com
GITHUB_TOKEN=your-github-token          # Optional: enables AI suggestions
```

**Where to find these values:**

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **Settings** → **API**
4. Copy **URL** → `NEXT_PUBLIC_SUPABASE_URL`
5. Copy **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. Copy **service_role** → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ Keep secret!)

#### 4. Run Development Server

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🎯 Quick Start

1. **Sign up** at the login page with email + password → verify via email
2. **Set up MFA** — scan QR code with your authenticator app (Google Authenticator, Authy, etc.)
3. **Add your first site** — press `N` or click "Add Site", paste a URL, and AI will suggest categories & tags
4. **Organize** — click suggested categories/tags to apply, or create your own
5. **Find anything** — use `Ctrl+K` to search across all your bookmarks instantly
6. **Import existing bookmarks** — go to Settings → Import, drop your browser bookmark HTML file
7. **Check link health** (Pro) — Settings → Stats → "Check All Links" to find broken bookmarks

## 📁 Project Structure

```



site-organizator/
├── components/
│ ├── categories/ # Category management
│ │ ├── CategoriesList.js # List with search, filter, multi-select, pagination
│ │ ├── CategoryModal.js # Create/edit category modal
│ │ ├── InlineEditableName.js # Double-click to rename
│ │ └── index.js # Barrel exports
│ ├── tags/ # Tag management
│ │ ├── TagsList.js # List with search, filter, multi-select, pagination
│ │ ├── TagModal.js # Create/edit tag modal
│ │ └── index.js
│ ├── sites/ # Site management
│ │ ├── SitesList.js # Responsive card grid with skeleton loading
│ │ ├── SiteCard.js # Site card with favicon, badges, animations
│ │ ├── SiteModal.js # Create/edit site with AI suggestions
│ │ ├── FavoritesList.js # Favorites-only view
│ │ └── index.js
│ ├── layout/ # Layout components
│ │ ├── Header.js # Top nav, search, tier badge, avatar
│ │ ├── Sidebar.js # Categories, tags, source filters, sort controls
│ │ ├── MobileToolbar.js # Bottom toolbar for mobile
│ │ ├── CategoryColorIndicator.js # Color dot component
│ │ └── index.js
│ ├── settings/ # Settings panel sections
│ │ ├── SettingsPanel.js # Main settings container
│ │ ├── AvatarSection.js # Avatar upload with preview
│ │ ├── ProfileEditSection.js # Display name editor
│ │ ├── StatsSection.js # Stats + link health checker UI
│ │ ├── ImportExportSection.js # Import/export UI with preview
│ │ ├── SecuritySection.js # Password, email, MFA, sessions
│ │ ├── DangerZoneSection.js # Reset/delete options
│ │ ├── PasswordModal.js # Change password modal
│ │ ├── EmailModal.js # Change email modal
│ │ └── MfaModal.js # MFA enrollment modal
│ └── ui/ # Reusable UI components
│ ├── Button.js # Button variants
│ ├── Modal.js # Modal + confirm dialog
│ ├── Input.js # Input component
│ ├── Badge.js # Badge component
│ ├── Icons.js # SVG icon components
│ ├── Toast.js # Toast notifications
│ ├── UndoToast.js # 5-second undo countdown toast
│ ├── CommandMenu.js # Ctrl+K command palette
│ ├── OnboardingTour.js # 13-step guided tour
│ ├── ServerStatus.js # Online/offline health indicator
│ ├── SortButton.js # Sort toggle button
│ ├── Pagination.js # Paginator with keyboard nav
│ ├── ErrorBoundary.js # React error boundary
│ ├── ExportImportModal.js # Export format picker modal
│ ├── PasswordResetModal.js # Password reset flow
│ └── index.js
├── context/
│ ├── AuthContext.js # Auth state, MFA, session, token refresh
│ └── DashboardContext.js # Sites, categories, tags, search, filters, sort, pagination, import, undo
├── lib/
│ ├── supabase.js # Supabase client init
│ ├── sharedColors.js # CATEGORY_COLORS & TAG_COLORS palettes
│ ├── urlPatternUtils.js # Domain extraction, pattern matching, reverse matching
│ ├── categorySuggestions.js # 20+ category patterns for client-side suggestions
│ ├── tagSuggestions.js # 40+ tag patterns for client-side suggestions
│ ├── exportImport.js # Parse/generate JSON, CSV, HTML, PDF imports
│ └── tierConfig.js # Free/Pro/ProMax limits, feature gates, labels
├── pages/
│ ├── \_app.js # App wrapper with AuthProvider + error boundary
│ ├── index.js # Landing page (SEO, hero, features, pricing, FAQ)
│ ├── login.js # Login/signup with MFA flow
│ ├── dashboard.js # Redirect to /dashboard/sites
│ ├── admin.js # Admin panel (overview, users, content, tools)
│ ├── health.js # Health check page
│ ├── dashboard/
│ │ └── [tab].js # Main dashboard (sites/favorites/categories/tags/notes/maps/settings tabs)
│ └── api/
│ ├── sites.js # GET (paginated, filtered, sorted) / POST
│ ├── categories.js # GET / POST (with tier limit)
│ ├── tags.js # GET / POST (with tier limit)
│ ├── courses.js # GET / POST courses (Maps tab, with tier limit)
│ ├── storage-items.js # GET / POST storage items (Maps tab, with tier limit)
│ ├── favorites.js # POST toggle favorite
│ ├── pinned.js # POST toggle pinned
│ ├── bulk-delete.js # POST bulk delete sites
│ ├── reset.js # POST reset all (returns data for undo)
│ ├── restore.js # POST restore deleted data (undo)
│ ├── export.js # GET export as JSON/CSV/HTML
│ ├── import.js # POST bulk import (with tier limit)
│ ├── stats.js # GET dashboard statistics
│ ├── profile.js # GET / PUT / PATCH user profile
│ ├── upload-avatar.js # POST avatar image upload
│ ├── health.js # GET server health check
│ ├── sites/
│ │ └── [id].js # GET / PUT / DELETE single site
│ ├── categories/
│ │ └── [id].js # GET / PUT / DELETE single category
│ ├── category/
│ │ └── [name]/sites.js # GET sites by category name
│ ├── tags/
│ │ └── [id].js # GET / PUT / DELETE single tag
│ ├── ai/
│ │ └── suggest.js # POST AI suggestions (GPT-4o-mini)
│ ├── links/
│ │ └── check.js # POST batch link health check
│ ├── helpers/
│ │ ├── api-utils.js # Shared API helpers (auth, headers, batch ops)
│ │ └── admin-utils.js # Admin guard helper
│ └── admin/
│ ├── stats.js # GET admin overview stats
│ ├── delete-user.js # DELETE user
│ ├── ban-user.js # POST ban/unban user
│ ├── toggle-pro.js # POST change user tier
│ ├── export.js # GET export users/sites CSV
│ └── check-links.js # POST global broken links check
├── Extension/ # Chrome extension (Manifest V3)
│ ├── manifest.json # Extension manifest
│ ├── popup.html # Extension popup UI
│ ├── popup.js # Popup logic (save, auth, AI suggestions)
│ ├── background.js # Service worker (token refresh)
│ ├── config.js # API URL config
│ └── icons/ # Extension icons
├── styles/
│ └── globals.css # Tailwind + custom animations + dark theme
├── public/
│ ├── manifest.json # PWA manifest
│ ├── sw.js # Service worker (offline caching)
│ └── icons/ # PWA icons (72–512px)
├── scripts/ # Build/deploy utility scripts
├── supabase/ # Supabase config
├── tailwind.config.js # Tailwind custom theme
├── next.config.js # Next.js config
├── netlify.toml # Netlify deployment config
└── package.json

```

## 🔧 Configuration

### Tailwind Theme

Custom theme in [tailwind.config.js](tailwind.config.js):

```javascript
colors: {
  // App-specific colors
  'app-bg-primary': '#050a30',      // Main background
  'app-bg-secondary': '#0a1554',    // Secondary background
  'app-bg-tertiary': '#0f1b6b',     // Tertiary background
  'app-accent': '#6CBBFB',          // Accent color (blue)
  'app-text-primary': '#e5e7eb',    // Primary text
  'app-text-secondary': '#9ca3af',  // Secondary text
  'app-border': '#1f2937',          // Border color
  // ... more colors
}
```

### Environment Variables

| Variable                        | Description                                         | Required |
| ------------------------------- | --------------------------------------------------- | -------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Your Supabase project URL                           | ✅ Yes   |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key                              | ✅ Yes   |
| `SUPABASE_SERVICE_ROLE_KEY`     | Supabase service role key (server-side only)        | ✅ Yes   |
| `NEXT_PUBLIC_ADMIN_EMAILS`      | Comma-separated admin emails for /admin page        | No       |
| `GITHUB_TOKEN`                  | GitHub token for AI suggestions (GitHub Models API) | No       |

## 🚢 Deployment

### Vercel (Recommended)

1. **Push to GitHub**

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/ilkenza/site-organizator.git
   git push -u origin main
   ```

2. **Deploy to Vercel**

   - Go to [vercel.com](https://vercel.com)
   - Click "Import Project"
   - Select your GitHub repository
   - Add environment variables:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY`
   - Click "Deploy"

3. **Configure Domain** (optional)
   - Go to project settings → Domains
   - Add your custom domain

### Netlify

1. **Connect Repository**

   - Go to [netlify.com](https://netlify.com)
   - Click "Add new site" → "Import an existing project"
   - Select your repository

2. **Configure Build Settings**

   - Build command: `npm run build`
   - Publish directory: `.next`

3. **Add Environment Variables**

   - Go to Site settings → Environment variables
   - Add all three Supabase variables

4. **Deploy**
   - Click "Deploy site"

### Manual Deployment

```bash
# Build for production
npm run build

# Start production server
npm run start
```

## 🛠️ Development

### Running Locally

```bash
# Install dependencies
npm install

# Run development server with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Lint code
npm run lint
```

### Adding Custom Category Suggestions

Edit [lib/categorySuggestions.js](lib/categorySuggestions.js):

```javascript
const domainPatterns = {
  "your-category": [
    "domain1.com",
    "domain2.com",
    "*.subdomain.com", // Wildcard supported
  ],
};
```

### Custom Animations

Add to [styles/globals.css](styles/globals.css):

```css
@keyframes myAnimation {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
  }
}

.animate-myAnimation {
  animation: myAnimation 0.3s ease-in-out;
}
```

## 📚 API Reference

### Endpoints

| Endpoint                     | Method  | Description                              |
| ---------------------------- | ------- | ---------------------------------------- |
| `/api/sites`                 | GET     | List sites (paginated, filtered, sorted) |
| `/api/sites`                 | POST    | Create new site                          |
| `/api/sites/[id]`            | GET     | Get single site                          |
| `/api/sites/[id]`            | PUT     | Update site                              |
| `/api/sites/[id]`            | DELETE  | Delete site                              |
| `/api/categories`            | GET     | List all categories                      |
| `/api/categories`            | POST    | Create category (tier-limited)           |
| `/api/categories/[id]`       | PUT     | Update category                          |
| `/api/categories/[id]`       | DELETE  | Delete category                          |
| `/api/category/[name]/sites` | GET     | List sites by category name              |
| `/api/tags`                  | GET     | List all tags                            |
| `/api/tags`                  | POST    | Create tag (tier-limited)                |
| `/api/tags/[id]`             | PUT     | Update tag                               |
| `/api/tags/[id]`             | DELETE  | Delete tag                               |
| `/api/favorites`             | POST    | Toggle favorite status                   |
| `/api/pinned`                | POST    | Toggle pinned status                     |
| `/api/bulk-delete`           | POST    | Bulk delete sites by ID array            |
| `/api/reset`                 | POST    | Reset all data (returns for undo)        |
| `/api/restore`               | POST    | Restore deleted data (undo)              |
| `/api/export`                | GET     | Export data (JSON/CSV/HTML)              |
| `/api/import`                | POST    | Bulk import (tier-limited)               |
| `/api/stats`                 | GET     | Dashboard statistics                     |
| `/api/profile`               | GET/PUT | Get/update user profile                  |
| `/api/upload-avatar`         | POST    | Upload avatar image                      |
| `/api/health`                | GET     | Server health check                      |
| `/api/ai/suggest`            | POST    | AI category/tag/pricing suggestions      |
| `/api/links/check`           | POST    | Batch link health check                  |
| `/api/admin/stats`           | GET     | Admin overview statistics                |
| `/api/admin/delete-user`     | DELETE  | Delete a user                            |
| `/api/admin/ban-user`        | POST    | Ban/unban a user                         |
| `/api/admin/toggle-pro`      | POST    | Change user tier                         |
| `/api/admin/export`          | GET     | Export users/sites CSV                   |
| `/api/admin/check-links`     | POST    | Global broken links check                |

### Authentication

All API routes require authentication via Supabase Auth. Include the session token in requests:

```javascript
const {
  data: { session },
} = await supabase.auth.getSession();
const token = session?.access_token;

fetch("/api/sites", {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
```

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Commit your changes**
   ```bash
   git commit -m "Add amazing feature"
   ```
4. **Push to the branch**
   ```bash
   git push origin feature/amazing-feature
   ```
5. **Open a Pull Request**

### Code Style

- Use ES6+ syntax
- Follow React best practices
- Use Tailwind CSS for styling
- Add comments for complex logic

## 📝 License

This project is licensed under the **MIT License**.

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) - React framework
- [Supabase](https://supabase.com/) - Backend as a Service
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS
- [React](https://react.dev/) - UI library

## 📖 Additional Documentation

- [KEYBOARD_SHORTCUTS.md](KEYBOARD_SHORTCUTS.md) - Complete keyboard shortcuts reference
- [UX_IMPROVEMENTS_GUIDE.md](UX_IMPROVEMENTS_GUIDE.md) - UI/UX features and animations
- [GDE_NACI_FUNKCIJE.md](GDE_NACI_FUNKCIJE.md) - Feature locations (Serbian)
- [QUICK_SETUP.md](QUICK_SETUP.md) - Quick setup guide for specific features

## 🐛 Troubleshooting

### Common Issues

**Problem**: Can't login after setting up MFA  
**Solution**: Make sure you're entering the current 6-digit code from your authenticator app. Codes expire every 30 seconds.

**Problem**: Sites not loading  
**Solution**: Check browser console for errors. Verify Supabase credentials in `.env.local` are correct.

**Problem**: Import fails  
**Solution**: Ensure CSV/JSON format matches expected schema. Check file size (max 5MB).

**Problem**: Real-time updates not working  
**Solution**: Verify Supabase real-time is enabled for `sites`, `categories`, and `tags` tables.

### Support

For bugs or feature requests, please [open an issue](https://github.com/ilkenza/site-organizator/issues).

---

---

## 📊 Metadata

**Version**: 2.1.0  
**Last Updated**: February 11, 2026  
**Status**: Active Development  
**License**: MIT  
**Author**: [@ilkenza](https://github.com/ilkenza)  
**Repository**: [https://github.com/Ilkenza/Site-Organizator](https://github.com/Ilkenza/Site-Organizator)

---

**Made with ❤️ using Next.js, React, and Supabase**
