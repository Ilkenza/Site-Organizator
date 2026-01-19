# Site Organizer - Next.js Dashboard

Modern React dashboard for organizing your bookmarks and favorite websites.

## Features

- 🌐 **Sites Management** - Add, edit, delete sites with URLs, descriptions, and ratings
- 📁 **Categories** - Organize sites into color-coded categories
- 🏷️ **Tags** - Add multiple tags to sites for flexible organization
- 🔍 **Search & Filter** - Find sites quickly by name, URL, or description
- ⭐ **Ratings** - Rate your favorite sites from 1-5 stars
- 🌙 **Dark Mode** - Beautiful dark theme by default

## Tech Stack

- **Next.js 14** (Pages Router)
- **React 18**
- **Tailwind CSS 3**
- **Supabase** (PostgreSQL database)

## Getting Started

### 1. Install dependencies

```bash
cd databaza-next
npm install
```

### 2. Configure environment variables

Copy `.env.local.example` to `.env.local` and fill in your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Project Structure

```
databaza-next/
├── components/
│   ├── categories/     # Category list and modal
│   ├── layout/         # Sidebar and Header
│   ├── sites/          # Site cards, list, and modal
│   ├── tags/           # Tag list and modal
│   └── ui/             # Reusable UI components (Button, Modal, Input, Badge)
├── context/
│   └── DashboardContext.js  # Global state management
├── lib/
│   └── supabase.js     # Supabase client helpers
├── pages/
│   ├── api/            # API routes for CRUD operations
│   ├── dashboard.js    # Main dashboard page
│   └── index.js        # Landing page
└── styles/
    └── globals.css     # Tailwind CSS + custom styles
```

## API Routes

| Endpoint               | Methods          | Description                            |
| ---------------------- | ---------------- | -------------------------------------- |
| `/api/sites`           | GET, POST        | List all sites, create new site        |
| `/api/sites/[id]`      | GET, PUT, DELETE | Get, update, delete single site        |
| `/api/categories`      | GET, POST        | List all categories, create new        |
| `/api/categories/[id]` | GET, PUT, DELETE | Get, update, delete category           |
| `/api/tags`            | GET, POST        | List all tags, create new              |
| `/api/tags/[id]`       | GET, PUT, DELETE | Get, update, delete tag                |
| `/api/stats`           | GET              | Get counts for sites, categories, tags |

## License

MIT

- Tailwind CSS is configured; edit `styles/globals.css` and `tailwind.config.js` to customize design.
