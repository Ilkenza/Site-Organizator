# Site Organizer Database

This is the backend database for the **Site Organizer** Chrome extension. The server pulls all data from Supabase and makes it available through a REST API.

## ⚠️ IMPORTANT BEFORE STARTING

If you see an error or problems when adding sites, you need to execute THESE SQL commands:

1. Open [Supabase Dashboard](https://app.supabase.com)
2. Select your project: `skacyhzljreaitrbgbte`
3. Click on **SQL Editor** → **New Query**
4. Copy and run THESE commands:

```sql
-- Add name column if it doesn't exist
ALTER TABLE sites ADD COLUMN IF NOT EXISTS name TEXT;

-- Ensure categories exists as JSONB
ALTER TABLE sites ADD COLUMN IF NOT EXISTS categories JSONB DEFAULT '[]';

-- Ensure tags exists as JSONB
ALTER TABLE sites ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]';

-- OPTIONAL: Delete old columns if they exist
-- ALTER TABLE sites DROP COLUMN IF EXISTS category;     -- Old single category
-- ALTER TABLE sites DROP COLUMN IF EXISTS category_id;  -- Old category ID
```

5. Restart the server (`Ctrl+C` then `npm start`)

## 📁 Project Structure

```
Databaza/
├── server.js              # Main Express server
├── syncData.js           # Data synchronization script
├── package.json          # Node.js dependencies
├── .env.example          # Example .env configuration
├── DATABASE_SCHEMA.sql   # SQL schema for Supabase
├── data/                 # Current data (JSON)
│   ├── sites.json
│   ├── categories.json
│   ├── tags.json
│   ├── site_visits.json
│   └── metadata.json
└── backups/              # Historical backups
    └── YYYY-MM-DD...
```

## 🚀 Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure .env file

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Fill in with your Supabase credentials:

```
SUPABASE_URL=https://skacyhzljreaitrbgbte.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
PORT=3000
```

### 3. Start the server

```bash
npm start
```

The server will be available at `http://localhost:3000`

## ⚙️ Database Migration

When you first start the server, you need to create the following columns in Supabase.

### New: Add 'name' column to sites table

Open **Supabase SQL Editor** and execute:

```sql
ALTER TABLE sites ADD COLUMN IF NOT EXISTS name TEXT;
```

Or use the `migrations.sql` file and copy all commands.

## �📡 API Endpoints

### Health Status

```
GET /health
```

### Sites

```
GET /api/sites              # All sites
POST /api/sites             # Add new site
```

### Categories

```
GET /api/categories         # All categories
```

### Tags

```
GET /api/tags              # All tags
```

### Statistics

```
GET /api/stats             # Count items per table
```

### Complete Export

```
GET /api/export/all        # All data (JSON)
```

## 🔄 Data Synchronization

### Manual synchronization

Pull all data from Supabase and save as JSON:

```bash
npm run sync
```

This will:

- Pull all data from Supabase
- Save current data to `data/` directory
- Create historical backup in `backups/`
- Display detailed statistics

### Automatic synchronization

For automatic synchronization every 5 minutes, add a cron job:

```bash
# Linux/Mac: Add to crontab
*/5 * * * * cd /path/to/Databaza && npm run sync

# Windows: Use Task Scheduler
schtasks /create /tn "SiteOrganizer-Sync" /tr "node C:\path\to\Databaza\syncData.js" /sc minute /mo 5
```

## 📊 Database - Tables

### `sites`

- `id` - UUID
- `user_id` - Site owner
- `url` - Site URL
- `title` - Title
- `category` - Category
- `tags` - Array of tags
- `rating` - Rating (0-5)
- `is_favorite` - Favorite
- `pricing_model` - Type: free, paid, freemium
- `notes` - Notes
- `created_at` - Created
- `updated_at` - Updated

### `categories`

- `id` - UUID
- `user_id` - Owner
- `name` - Category name
- `description` - Description
- `color` - Hex color
- `icon` - Icon

### `tags`

- `id` - UUID
- `user_id` - Owner
- `name` - Tag name
- `usage_count` - Usage count

### `site_visits`

- `id` - UUID
- `site_id` - Related site
- `user_id` - User
- `visited_at` - Visit time

## 🔐 Security

All tables in Supabase have **Row Level Security (RLS)** policies:

- Users can only see their own data
- Complete isolation between users
- Secure operations through REST API

## 🛠️ Development Mode

For development with automatic restart:

```bash
npm run dev
```

Uses `nodemon` to monitor file changes.

## 📈 Monitoring

Check `/health` endpoint for server status:

```bash
curl http://localhost:3000/health
```

## 🐛 Troubleshooting

### Error: "SUPABASE_URL is missing"

- Check `.env` file
- Use `.env.example` as a template

### Error: "Supabase library not loaded"

- Make sure `supabase.umd.js` is in `Extension/vendor/` directory

### Data not synchronizing

- Check internet connection
- Check Supabase credentials
- Run `npm run sync` manually with debug information

## 📝 Logs

All logs are printed to the console. For persistent logs, add:

```javascript
const winston = require("winston");
```

## 🎯 Planned Features

- [ ] WebSocket support for real-time updates
- [ ] GraphQL API
- [ ] Offline synchronization
- [ ] More comprehensive backup system
- [ ] Admin dashboard
- [ ] Email notifications for important sites

## 📞 Support

For issues or questions, check Supabase documentation:
https://supabase.com/docs

---

**Last updated:** January 6, 2026
