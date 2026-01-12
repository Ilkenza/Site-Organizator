Supabase UMD for Chrome extension (MV3)

Chrome MV3 blocks loading remote scripts due to Content Security Policy (CSP). To use the official Supabase JS in the extension popup, download the UMD/minified build and place it in this folder as `supabase.umd.js` (or `supabase.umd.min.js`).

How to get it:
- Visit https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/ and download the UMD file (or use the exact URL you previously had).
- Save the file as `vendor/supabase.umd.js` (or `vendor/supabase.umd.min.js`) in this extension folder.

Note: I downloaded `dist/umd/supabase.js` from the CDN and saved it here as `vendor/supabase.umd.js` so the popup can load it locally.

After placing the file (or if it already exists), reload the extension and open the popup. The script tag in `popup.html` references `vendor/supabase.umd.js`.

If you'd rather bundle dependencies, add Supabase to your build process (webpack/rollup/vite) and ship a bundled popup script.
