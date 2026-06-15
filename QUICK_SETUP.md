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

### Deploy to Vercel

1. **Push to GitHub:**

   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Import on Vercel:**

   - Go to [Vercel](https://vercel.com/new)
   - Click **Add New… → Project** and import your GitHub repository
   - Vercel auto-detects Next.js — no build settings needed

3. **Add Environment Variables:**

   - On the import screen (or later under **Settings → Environment Variables**),
     add all variables from `.env.local`
   - After changing env vars later, **redeploy** for them to take effect

4. **Deploy:**
   - Click **Deploy**

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

#### 5. "Build fails on Vercel"

- ✅ Check environment variables are set in the Vercel project (Settings → Environment Variables)
- ✅ Ensure a recent Node.js version is selected in Vercel project settings

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
