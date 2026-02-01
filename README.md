# 🌐 Site Organizer

A modern, full-featured web application for organizing and managing your favorite websites with advanced categorization, tagging, and keyboard-driven navigation.

![Next.js](https://img.shields.io/badge/Next.js-13-black?logo=next.js)
![React](https://img.shields.io/badge/React-18+-61dafb?logo=react)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ecf8e?logo=supabase)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38bdf8?logo=tailwindcss)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## ✨ Features

### Core Functionality

- **📌 Site Management**: Add, edit, delete, and organize websites
- **📁 Categories & Tags**: Multi-level organization with color-coded labels
- **⭐ Favorites & Pinned**: Quick access to your most important sites
- **🔍 Advanced Search**: Real-time search across sites, categories, and tags
- **✅ Bulk Operations**: Multi-select for batch editing and deletion
- **📤 Import/Export**: Full data portability (CSV, JSON, HTML formats)

### User Experience

- **⌨️ Keyboard Navigation**: Complete keyboard shortcuts (see [KEYBOARD_SHORTCUTS.md](KEYBOARD_SHORTCUTS.md))
  - `Ctrl+K` - Command menu / Search
  - `N` - New item (contextual: new site in Sites tab, new category in Categories tab, new tag in Tags tab)
  - `Ctrl+F` - Focus search
  - `M` - Toggle multi-select
  - `Delete` - Delete selected items
  - `Arrow Left/Right` - Navigate pages
  - `Enter` - Modal field navigation
- **📱 Responsive Design**: Optimized for mobile, tablet, and desktop
- **🎨 Dark Theme**: Custom dark UI with app-specific color palette
- **📄 Pagination**: Smooth pagination with keyboard support
- **⚡ Real-time Updates**: Instant sync via Supabase subscriptions
- **↩️ Undo/Redo**: 5-second undo window for deletions

### Security & Authentication

- **🔐 Multi-Factor Authentication (MFA)**: TOTP-based 2FA
- **🛡️ Secure Auth**: Supabase Auth with AAL2 (Authenticator Assurance Level 2)
- **🔑 Session Management**: Automatic token refresh and session restoration
- **🔒 Row Level Security**: PostgreSQL policies enforce user data isolation

### Advanced Features

- **🔗 Link Health Checker**: Verify broken links with automatic retry
- **🤖 Smart Categorization**: AI-powered category suggestions based on URL/domain
- **👤 Profile Management**: Custom avatar upload and display name
- **💰 Pricing Models**: Track site pricing (Free, Freemium, Trial, Paid)
- **📊 Statistics Dashboard**: Real-time overview of sites, categories, and tags
- **🎯 Command Menu**: Quick actions via fuzzy search (`Ctrl+K`)
- **✨ Animated UI**: Smooth animations (star burst, pin bounce, checkbox pop)

## 🚀 Tech Stack

### Frontend

| Technology                               | Version | Purpose                           |
| ---------------------------------------- | ------- | --------------------------------- |
| [Next.js](https://nextjs.org/)           | 13      | React framework with Pages Router |
| [React](https://react.dev/)              | 18+     | UI library with hooks             |
| [Tailwind CSS](https://tailwindcss.com/) | 3       | Utility-first styling             |

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

- **Node.js** 18 or higher
- **npm** or **yarn**
- **Supabase account** ([create one free](https://supabase.com))

### Step-by-Step Setup

#### 1. Clone Repository

```bash
git clone https://github.com/yourusername/site-organizator.git
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
```

**Where to find these values:**

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **Settings** → **API**
4. Copy **URL** → `NEXT_PUBLIC_SUPABASE_URL`
5. Copy **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. Copy **service_role** → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ Keep secret!)

#### 4. Database Setup

Run this SQL in **Supabase SQL Editor** (Dashboard → SQL Editor → New Query):

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES TABLE
-- ============================================
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ============================================
-- SITES TABLE
-- ============================================
CREATE TABLE sites (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  pricing TEXT CHECK (pricing IN ('fully_free', 'freemium', 'free_trial', 'paid')),
  is_favorite BOOLEAN DEFAULT false,
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ============================================
-- CATEGORIES TABLE
-- ============================================
CREATE TABLE categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6b7280',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_id, name)
);

-- ============================================
-- TAGS TABLE
-- ============================================
CREATE TABLE tags (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#5B8DEE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_id, name)
);

-- ============================================
-- JUNCTION TABLES (Many-to-Many)
-- ============================================
CREATE TABLE site_categories (
  site_id UUID REFERENCES sites ON DELETE CASCADE,
  category_id UUID REFERENCES categories ON DELETE CASCADE,
  PRIMARY KEY (site_id, category_id)
);

CREATE TABLE site_tags (
  site_id UUID REFERENCES sites ON DELETE CASCADE,
  tag_id UUID REFERENCES tags ON DELETE CASCADE,
  PRIMARY KEY (site_id, tag_id)
);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_tags ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Sites policies
CREATE POLICY "Users can view own sites" ON sites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sites" ON sites FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sites" ON sites FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sites" ON sites FOR DELETE USING (auth.uid() = user_id);

-- Categories policies
CREATE POLICY "Users can view own categories" ON categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own categories" ON categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own categories" ON categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own categories" ON categories FOR DELETE USING (auth.uid() = user_id);

-- Tags policies
CREATE POLICY "Users can view own tags" ON tags FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tags" ON tags FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tags" ON tags FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tags" ON tags FOR DELETE USING (auth.uid() = user_id);

-- Junction table policies
CREATE POLICY "Users can view own site_categories" ON site_categories FOR SELECT
  USING (EXISTS (SELECT 1 FROM sites WHERE sites.id = site_id AND sites.user_id = auth.uid()));
CREATE POLICY "Users can insert own site_categories" ON site_categories FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM sites WHERE sites.id = site_id AND sites.user_id = auth.uid()));
CREATE POLICY "Users can delete own site_categories" ON site_categories FOR DELETE
  USING (EXISTS (SELECT 1 FROM sites WHERE sites.id = site_id AND sites.user_id = auth.uid()));

CREATE POLICY "Users can view own site_tags" ON site_tags FOR SELECT
  USING (EXISTS (SELECT 1 FROM sites WHERE sites.id = site_id AND sites.user_id = auth.uid()));
CREATE POLICY "Users can insert own site_tags" ON site_tags FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM sites WHERE sites.id = site_id AND sites.user_id = auth.uid()));
CREATE POLICY "Users can delete own site_tags" ON site_tags FOR DELETE
  USING (EXISTS (SELECT 1 FROM sites WHERE sites.id = site_id AND sites.user_id = auth.uid()));

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX sites_user_id_idx ON sites(user_id);
CREATE INDEX categories_user_id_idx ON categories(user_id);
CREATE INDEX tags_user_id_idx ON tags(user_id);
CREATE INDEX site_categories_site_id_idx ON site_categories(site_id);
CREATE INDEX site_categories_category_id_idx ON site_categories(category_id);
CREATE INDEX site_tags_site_id_idx ON site_tags(site_id);
CREATE INDEX site_tags_tag_id_idx ON site_tags(tag_id);

-- ============================================
-- REAL-TIME SUBSCRIPTIONS
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE sites;
ALTER PUBLICATION supabase_realtime ADD TABLE categories;
ALTER PUBLICATION supabase_realtime ADD TABLE tags;
```

#### 5. Enable MFA in Supabase

1. Go to **Authentication** → **Providers**
2. Scroll to **Multi-Factor Authentication**
3. Enable **Time-based One-time Password (TOTP)**
4. Save

#### 6. Storage Setup (Avatar Upload)

Run in **Supabase SQL Editor**:

```sql
-- Create avatars bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true);

-- Allow users to upload their own avatars
CREATE POLICY "Users can upload own avatar" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow users to update their own avatars
CREATE POLICY "Users can update own avatar" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow public read access to all avatars
CREATE POLICY "Public can view avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');
```

#### 7. Run Development Server

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🎯 Usage Guide

### Getting Started

1. **Sign Up**

   - Navigate to [http://localhost:3000](http://localhost:3000)
   - Click "Sign Up"
   - Enter email and password
   - Check your email for verification link

2. **Set Up MFA**

   - After first login, you'll be prompted to set up 2FA
   - Scan QR code with authenticator app (Google Authenticator, Authy, Microsoft Authenticator)
   - Enter the 6-digit code to verify
   - Save backup codes in a safe place

3. **Add Your First Site**
   - Click "Add Site" button (or press `N` when in Sites tab)
   - Fill in site details:
     - **Name**: Site title
     - **URL**: Full URL (e.g., `https://example.com`)
     - **Description**: Optional description
     - **Pricing**: Select pricing model
   - Select categories and tags (or create new ones)
   - Mark as favorite ⭐ or pinned 📌
   - Press `Enter` to navigate fields or `Esc` to cancel

### Organizing Sites

#### Categories

- Create categories with custom colors
- Assign multiple categories to sites
- Filter sites by clicking category in sidebar
- Edit category names inline (double-click)
- Delete categories (will not delete sites)

#### Tags

- Create tags for fine-grained organization
- Combine category + tag filters
- Color-code tags for visual organization
- Sites can have unlimited tags

### Advanced Features

#### Keyboard Navigation

See full list in [KEYBOARD_SHORTCUTS.md](KEYBOARD_SHORTCUTS.md)

**Most Used Shortcuts:**

- `Ctrl+K` - Open command menu / Search
- `N` - New item (context-aware: creates site/category/tag based on active tab)
- `Ctrl+F` - Focus search
- `M` - Toggle multi-select mode
- `Delete` - Delete selected items
- `Arrow Left/Right` - Navigate pages

#### Bulk Operations

1. Press `M` or enable "Multi-select Mode"
2. Select items using checkboxes
3. Use header actions:
   - **Delete Selected** - Bulk delete
   - **Select All** - Select all on current page
   - **Clear Selection** - Deselect all

#### Import/Export

**Export:**

1. Go to Settings tab (⚙️)
2. Click "Export Data"
3. Choose format:
   - **JSON**: Full data with relationships
   - **CSV**: Spreadsheet-compatible
   - **HTML**: Bookmarks for browsers

**Import:**

1. Go to Settings tab
2. Click "Import Data"
3. Drag & drop CSV/JSON file or click to browse
4. Preview data
5. Select options:
   - ✅ Create missing categories
   - ✅ Create missing tags
6. Click "Import"

#### Smart Category Suggestions

When adding a site:

1. Paste URL (e.g., `https://github.com/user/repo`)
2. See suggestions appear (e.g., "Development", "Code")
3. Click `+ Category Name` to apply
4. Suggestions based on domain patterns in [lib/categorySuggestions.js](lib/categorySuggestions.js)

#### Link Health Checker

1. Go to Settings → Link Health
2. Click "Check All Links"
3. See status:
   - 🟢 **Green**: Working (200 OK)
   - 🟡 **Yellow**: Checking...
   - 🔴 **Red**: Broken (404, 500, etc.)
   - 🔁 **Retry**: Automatic retry for failed links

## ⌨️ Keyboard Shortcuts

### Global

| Shortcut | Action                           |
| -------- | -------------------------------- |
| `Ctrl+K` | Open command menu / Search       |
| `Ctrl+F` | Focus search bar                 |
| `Ctrl+A` | Select all (in multi-select)     |
| `Esc`    | Close modals / Exit multi-select |

### Navigation

| Shortcut      | Action        |
| ------------- | ------------- |
| `Arrow Left`  | Previous page |
| `Arrow Right` | Next page     |
| `Home`        | First page    |
| `End`         | Last page     |

**Note**: Navigation shortcuts also work inside Command Menu

### Multi-Select

| Shortcut               | Action                   |
| ---------------------- | ------------------------ |
| `M`                    | Toggle multi-select mode |
| `Delete` / `Backspace` | Delete selected items    |

### Modals

| Shortcut | Action                 |
| -------- | ---------------------- |
| `Enter`  | Navigate to next field |
| `Esc`    | Close modal            |

### Command Menu

| Shortcut  | Action                                                   |
| --------- | -------------------------------------------------------- |
| `N`       | New item (context-aware based on tab: site/category/tag) |
| `↑` / `↓` | Navigate options                                         |
| `Enter`   | Execute command                                          |

**Full reference**: [KEYBOARD_SHORTCUTS.md](KEYBOARD_SHORTCUTS.md)

## 📁 Project Structure

```
site-organizator/
├── components/
│   ├── categories/          # Category components
│   │   ├── CategoriesList.js
│   │   ├── CategoryModal.js
│   │   └── InlineEditableName.js
│   ├── tags/                # Tag components
│   │   ├── TagsList.js
│   │   └── TagModal.js
│   ├── sites/               # Site management
│   │   ├── SitesList.js
│   │   ├── SiteCard.js
│   │   ├── SiteModal.js
│   │   └── FavoritesList.js
│   ├── layout/              # Layout components
│   │   ├── Header.js        # Top navigation + search
│   │   ├── Sidebar.js       # Left sidebar navigation
│   │   ├── MobileToolbar.js # Mobile bottom toolbar
│   │   └── CategoryColorIndicator.js
│   ├── settings/            # Settings panel
│   │   └── SettingsPanel.js
│   └── ui/                  # Reusable UI components
│       ├── Button.js
│       ├── Modal.js
│       ├── Input.js
│       ├── Badge.js
│       ├── Toast.js
│       ├── UndoToast.js
│       ├── CommandMenu.js
│       ├── ServerStatus.js
│       ├── Pagination.js
│       └── ErrorBoundary.js
├── context/
│   ├── AuthContext.js       # Authentication state (MFA, session)
│   └── DashboardContext.js  # Dashboard state (sites, categories, tags)
├── lib/
│   ├── supabase.js          # Supabase client
│   ├── exportImport.js      # Import/Export utilities
│   └── categorySuggestions.js # AI category suggestions
├── pages/
│   ├── _app.js              # App wrapper with contexts
│   ├── index.js             # Landing page
│   ├── login.js             # Login/signup with MFA
│   ├── dashboard.js         # Main dashboard
│   ├── health.js            # Health check endpoint
│   └── api/                 # API routes
│       ├── sites.js         # CRUD for sites
│       ├── sites/[id].js    # Single site operations
│       ├── categories.js    # CRUD for categories
│       ├── categories/[id].js
│       ├── tags.js          # CRUD for tags
│       ├── tags/[id].js
│       ├── stats.js         # Statistics
│       ├── export.js        # Data export
│       ├── import.js        # Data import
│       ├── favorites.js     # Favorites management
│       ├── pinned.js        # Pinned sites
│       ├── profile.js       # User profile
│       ├── upload-avatar.js # Avatar upload
│       └── links/check.js   # Link health checker
├── styles/
│   └── globals.css          # Global styles + Tailwind + animations
├── public/
│   ├── manifest.json        # PWA manifest
│   ├── sw.js                # Service worker
│   └── icons/               # App icons
├── .env.local               # Environment variables (create this)
├── tailwind.config.js       # Tailwind configuration
├── next.config.js           # Next.js configuration
└── package.json             # Dependencies
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

| Variable                        | Description                                  | Required |
| ------------------------------- | -------------------------------------------- | -------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Your Supabase project URL                    | ✅ Yes   |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key                       | ✅ Yes   |
| `SUPABASE_SERVICE_ROLE_KEY`     | Supabase service role key (server-side only) | ✅ Yes   |

## 🚢 Deployment

### Vercel (Recommended)

1. **Push to GitHub**

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/site-organizator.git
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

| Endpoint               | Method  | Description                 |
| ---------------------- | ------- | --------------------------- |
| `/api/sites`           | GET     | List all user sites         |
| `/api/sites`           | POST    | Create new site             |
| `/api/sites/[id]`      | GET     | Get single site             |
| `/api/sites/[id]`      | PUT     | Update site                 |
| `/api/sites/[id]`      | DELETE  | Delete site                 |
| `/api/categories`      | GET     | List all categories         |
| `/api/categories`      | POST    | Create category             |
| `/api/categories/[id]` | PUT     | Update category             |
| `/api/categories/[id]` | DELETE  | Delete category             |
| `/api/tags`            | GET     | List all tags               |
| `/api/tags`            | POST    | Create tag                  |
| `/api/tags/[id]`       | PUT     | Update tag                  |
| `/api/tags/[id]`       | DELETE  | Delete tag                  |
| `/api/stats`           | GET     | Get statistics (counts)     |
| `/api/export`          | GET     | Export data (JSON/CSV/HTML) |
| `/api/import`          | POST    | Import data                 |
| `/api/favorites`       | PUT     | Toggle favorite             |
| `/api/pinned`          | PUT     | Toggle pinned               |
| `/api/profile`         | GET/PUT | Get/update user profile     |
| `/api/upload-avatar`   | POST    | Upload avatar image         |
| `/api/links/check`     | POST    | Check link health           |

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

For bugs or feature requests, please [open an issue](https://github.com/yourusername/site-organizator/issues).

---

**Made with ❤️ using Next.js, React, and Supabase**

**Version**: 1.0.0  
**Last Updated**: January 2025
