# 🚀 Quick Setup Guide - Site Organizator

> **Complete setup guide for the Site Organizator project**

---

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Setup](#environment-setup)
- [Supabase Configuration](#supabase-configuration)
- [Running the Project](#running-the-project)
- [Deployment](#deployment)
- [Features Setup](#features-setup)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before you begin, ensure you have:

- **Node.js** 20.x or higher ([Download](https://nodejs.org/))
- **npm** 10.x or higher (comes with Node.js)
- **Git** ([Download](https://git-scm.com/))
- **Supabase Account** ([Sign up](https://supabase.com/))

---

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/site-organizator.git
cd site-organizator
```

### 2. Install Dependencies

```bash
npm install
```

---

## Environment Setup

### 1. Create Environment File

Create `.env.local` in the project root:

```bash
# Windows (PowerShell)
New-Item -Path .env.local -ItemType File

# macOS/Linux
touch .env.local
```

### 2. Configure Environment Variables

Add the following to `.env.local`:

```env
# ========================================
# Supabase Configuration
# ========================================
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# ========================================
# Next.js Public Variables
# ========================================
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# ========================================
# Application Configuration
# ========================================
PORT=3000
NODE_ENV=development
```

**Where to find Supabase keys:**

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Go to **Settings** → **API**
4. Copy **Project URL**, **anon public** key, and **service_role** key

---

## Supabase Configuration

### 1. Database Schema

Run this SQL in **Supabase SQL Editor**:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sites table
CREATE TABLE sites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  is_pinned BOOLEAN DEFAULT FALSE,
  is_favorite BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categories table
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL UNIQUE,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tags table
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Site-Category junction table
CREATE TABLE site_categories (
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (site_id, category_id)
);

-- Site-Tag junction table
CREATE TABLE site_tags (
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (site_id, tag_id)
);

-- Profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security (RLS)
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can only access their own data)
CREATE POLICY "Users can view their own sites" ON sites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own sites" ON sites FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own sites" ON sites FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own sites" ON sites FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own categories" ON categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own categories" ON categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own categories" ON categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own categories" ON categories FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own tags" ON tags FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own tags" ON tags FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own tags" ON tags FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own tags" ON tags FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own profiles" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profiles" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profiles" ON profiles FOR UPDATE USING (auth.uid() = id);
```

### 2. Storage Setup (Avatar Upload)

1. Go to **Storage** in Supabase Dashboard
2. Click **New bucket**
3. Name: `avatars`
4. Make it **Public**
5. Click **Create bucket**

---

## Running the Project

### Development Mode

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm start
```

---

## Deployment

### Deploy to Netlify

1. **Push to GitHub:**

   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Connect to Netlify:**

   - Go to [Netlify](https://app.netlify.com/)
   - Click **Add new site** → **Import an existing project**
   - Select your GitHub repository

3. **Configure Build Settings:**

   - Build command: `npm run build`
   - Publish directory: `.next`

4. **Add Environment Variables:**

   - Go to **Site settings** → **Environment variables**
   - Add all variables from `.env.local`
   - **Important:** Use **different Supabase keys** for production!

5. **Deploy:**
   - Click **Deploy site**

---

## Features Setup

### Avatar Upload Feature

**What it does:**

- Users can upload profile pictures
- Avatars persist across sessions
- Display name can be set and updated

**Already configured:**

- ✅ Database schema (profiles table)
- ✅ Storage bucket (avatars)
- ✅ Upload API (`/api/upload-avatar`)
- ✅ UI components (SettingsPanel, AvatarSection)

**Testing:**

1. Go to Settings tab ⚙️
2. Click camera icon on avatar
3. Select image < 5MB
4. Click "Save Avatar"
5. See success message
6. Refresh page → avatar still there

### Settings Tab Features

**Implemented:**

- ✅ No search bar on Settings tab
- ✅ No sort button on Settings tab
- ✅ No counts displayed on Settings tab
- ✅ Avatar upload and preview
- ✅ Display name editing
- ✅ Email display (read-only)

---

## Troubleshooting

### Common Issues

#### 1. "Supabase connection failed"

- ✅ Check `.env.local` file exists and has correct keys
- ✅ Verify Supabase project URL is correct
- ✅ Ensure keys are copied without extra spaces

#### 2. "Avatar upload fails"

- ✅ Check `avatars` bucket exists in Supabase Storage
- ✅ Verify bucket is set to **Public**
- ✅ Check image is < 5MB and valid format (jpg, png, gif)

#### 3. "npm install fails"

- ✅ Try: `npm install --legacy-peer-deps`
- ✅ Delete `node_modules` and `package-lock.json`, then reinstall

#### 4. "Page not found after login"

- ✅ Ensure you're redirecting to `/dashboard/sites` (not `/dashboard`)
- ✅ Check `next.config.js` redirect is configured

#### 5. "Build fails on Netlify"

- ✅ Check environment variables are set in Netlify dashboard
- ✅ Verify Node.js version is 20+ in `netlify.toml`

---

## Project Structure

```
site-organizator/
├── components/          # React components
│   ├── categories/     # Category management
│   ├── layout/         # Header, Sidebar
│   ├── settings/       # Settings panel, Avatar
│   ├── sites/          # Site cards, modals
│   ├── tags/           # Tag management
│   └── ui/             # Reusable UI components
├── context/            # React Context (Auth, Dashboard)
├── lib/                # Utilities (Supabase, suggestions)
├── pages/              # Next.js pages
│   ├── api/            # API routes
│   └── dashboard/      # Dashboard pages
├── public/             # Static assets (icons, manifest)
├── scripts/            # Build scripts
├── styles/             # Global CSS
├── .env.local          # Environment variables (local)
├── .eslintrc.json      # ESLint config
├── .gitignore          # Git ignore rules
├── netlify.toml        # Netlify config
├── next.config.js      # Next.js config
├── package.json        # Dependencies
├── postcss.config.js   # PostCSS config
├── tailwind.config.js  # Tailwind config
└── README.md           # Main documentation
```

---

## Next Steps

1. ✅ Create Supabase account and project
2. ✅ Run database schema SQL
3. ✅ Create avatars storage bucket
4. ✅ Configure `.env.local`
5. ✅ Run `npm install`
6. ✅ Run `npm run dev`
7. ✅ Sign up for an account
8. ✅ Start adding sites!

---

## Additional Resources

- 📖 [Full README](README.md)
- ⌨️ [Keyboard Shortcuts](KEYBOARD_SHORTCUTS.md)
- 🔗 [Supabase Documentation](https://supabase.com/docs)
- 🔗 [Next.js Documentation](https://nextjs.org/docs)
- 🔗 [Tailwind CSS Documentation](https://tailwindcss.com/docs)

---

**Last Updated:** February 2, 2026  
**Version:** 2.0.0  
**Project:** Site Organizator
