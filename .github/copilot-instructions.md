# Site Organizer — Copilot Instructions

## Project Overview

Next.js 14 (Pages Router) + Supabase + Tailwind CSS site bookmarking app with categories, tags, MFA, and admin panel.

## Architecture

- **Frontend**: `pages/` (Pages Router), `components/` (React), `context/` (AuthContext, DashboardContext)
- **API Routes**: `pages/api/` — all use shared helpers from `pages/api/helpers/api-utils.js` and `pages/api/helpers/admin-utils.js`
- **Shared Libs**: `lib/` — supabase client, sharedColors, urlPatternUtils, tierConfig, exportImport, suggestion engines
- **Styling**: Tailwind CSS (`styles/globals.css`), dark theme only (`bg-gray-950`, `text-white`)

## Coding Conventions

- API routes: use `configGuard`, `methodGuard`, `sendError`, `sendOk`, `buildHeaders`, `restUrl` from `api-utils.js`
- Admin routes: use `adminGuard` from `admin-utils.js` (handles method check + client init + auth verification)
- Colors: import from `lib/sharedColors.js` — never duplicate `CATEGORY_COLORS` or `TAG_COLORS`
- URL utils: import from `lib/urlPatternUtils.js` — `extractDomain`, `matchesPattern`, `reverseMatch`, `matchToExisting`
- Components wrapped in `React.memo` when list-rendered (e.g. `SiteCard`)
- Use `useMemo` for expensive derived state in context providers
- Tier system: free/pro/promax — resolved via `resolveTier(token)` from api-utils

## Key Patterns

- **Auth**: Supabase Auth with MFA (TOTP). Token extracted via `extractToken()`/`extractTokenFromReq()`. JWT decoded via `decodeJwt()`.
- **RLS**: All user data filtered by `user_id`. Service key used for junction tables (`site_categories`, `site_tags`).
- **Error responses**: Always `{ success: false, error: "message" }` via `sendError()`
- **Success responses**: Always `{ success: true, ...data }` via `sendOk()`
- **Batch operations**: Use `batchInsert()` and `batchDelete()` from api-utils (100-row batches)

## File Naming

- Components: PascalCase (`SiteCard.js`, `CategoryModal.js`)
- API routes: kebab-case (`bulk-delete.js`, `upload-avatar.js`)
- Utilities: camelCase (`api-utils.js`, `sharedColors.js`)
- Dynamic routes: `[id].js`, `[tab].js`, `[name]/index.js`

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY)
NEXT_PUBLIC_ADMIN_EMAILS (comma-separated)
GITHUB_TOKEN (for AI suggestions via GitHub Models API)
```

## Don't

- Don't add verbose JSDoc blocks to API routes — keep comments minimal
- Don't duplicate HTTP status constants — import `HTTP` from api-utils
- Don't inline `getSupabaseConfig()` or header building — use shared helpers
- Don't create new color arrays — import from sharedColors.js
- Don't use `@supabase/supabase-js` client in regular API routes — use raw fetch + REST URL (client only in admin-utils)
