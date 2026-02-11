# Browser Extension - Store Submission Guide

## 📦 Final Setup Steps

### 1. Copy Icons

Copy all icon files from `/public/icons/` to `/Extension/icons/`:

```bash
# From project root
xcopy "public\icons\*.png" "Extension\icons\" /Y
```

Or manually copy these files:

- icon-72x72.png
- icon-96x96.png
- icon-128x128.png
- icon-144x144.png
- icon-152x152.png
- icon-192x192.png
- icon-384x384.png
- icon-512x512.png

### 2. Test Locally

**Chrome:**

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `Extension` folder
5. Test all features (save, categorize, search)

**Firefox:**

1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select `manifest.json` from Extension folder
4. Test all features

**Edge:**

1. Open `edge://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `Extension` folder
5. Test all features

### 3. Create ZIP File

Create a ZIP that includes:

- manifest.json
- popup.html
- popup.js
- background.js
- config.js
- icons/ (entire folder)
- vendor/ (entire folder)

**DO NOT include:**

- EXTENSION_QUICK_REFERENCE.md
- STORE_SUBMISSION.md
- about.txt
- site.webmanifest

### 4. Submit to Stores

#### Chrome Web Store

1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Pay one-time $5 developer fee
3. Click "New Item"
4. Upload ZIP file
5. Fill out store listing:
   - **Name:** Site Organizer
   - **Summary:** Find any bookmark in under 2 seconds
   - **Description:** (See below)
   - **Category:** Productivity
   - **Screenshots:** Capture popup.html in action
6. Submit for review (1-3 days)

#### Firefox Add-ons

1. Go to [Firefox Add-on Developer Hub](https://addons.mozilla.org/developers/)
2. Click "Submit a New Add-on"
3. Upload ZIP file (NO FEE)
4. Fill out listing (similar to Chrome)
5. Submit for review (1-7 days)

#### Edge Add-ons

1. Go to [Microsoft Partner Center](https://partner.microsoft.com/dashboard/microsoftedge/public/login)
2. Register as developer (NO FEE)
3. Click "New extension"
4. Upload ZIP file
5. Fill out listing
6. Submit for review (1-3 days)

## 📝 Store Listing Copy

### Description (Short)

Find any bookmark in under 2 seconds. One-click save, smart categories, and instant search. Your bookmarks. Finally under control.

### Description (Full)

#### Stop Wasting Time Searching for Links

Average person spends 20 minutes per day looking for bookmarks. That's 120 hours per year. Site Organizer gets you there in 2 seconds.

**Features:**
✓ One-Click Save - Add sites from any webpage
✓ Smart Categories - Auto-suggest based on content
✓ Instant Search - Find anything in under 2 seconds
✓ Keyboard Shortcuts - Save without touching mouse
✓ Sync Everywhere - Same bookmarks on all devices
✓ Privacy First - Your data, your control

**How It Works:**

1. Click extension icon while on any webpage
2. Add title, description, tags
3. Auto-categorize or choose your own
4. Done. Saved in under 10 seconds.

**Why Site Organizer?**

- **Fast:** Sub-second search across thousands of links
- **Smart:** AI-powered category suggestions
- **Free:** No trial. No credit card. Free forever.
- **Yours:** Export anytime. You own your data.

**Perfect For:**

- Developers saving documentation
- Researchers organizing sources
- Students collecting study materials
- Anyone with 50+ bookmarks

**Privacy Promise:**
✓ No tracking or analytics
✓ Military-grade encryption
✓ Open source (verify yourself)
✓ Export anytime, no lock-in

Try it free. No
required to test.

### Keywords (for SEO)

bookmark manager, link organizer, productivity, save links, bookmark search, categorize bookmarks, tag bookmarks, organize websites

## 🎨 Required Assets

### Screenshots (Capture These)

1. **Main popup** - Show save form with auto-suggestions
2. **Dashboard view** - Show organized bookmarks with categories
3. **Search in action** - Show search results appearing instantly
4. **Categories view** - Show color-coded categories
5. **Mobile view** - Show responsive design on phone

### Promotional Images

- **Chrome:** 1280x800px (required)
- **Firefox:** 1280x800px (optional but recommended)
- **Edge:** 1366x768px (required)

### Icon Sizes (Already Done ✅)

- 16x16, 48x48, 128x128 (manifest)
- 192x192, 512x512 (stores)

## 🔄 After Approval

Update these links in [index.js](../pages/index.js):

```javascript
// Replace # with actual store URLs
<a href="https://chrome.google.com/webstore/detail/YOUR_EXTENSION_ID">
<a href="https://addons.mozilla.org/firefox/addon/YOUR_ADDON_SLUG">
<a href="https://microsoftedge.microsoft.com/addons/detail/YOUR_EXTENSION_ID">
```

## ⏱️ Timeline

- **Chrome:** 1-3 business days
- **Firefox:** 1-7 business days
- **Edge:** 1-3 business days

## 💰 Costs

- **Chrome:** $5 one-time developer fee
- **Firefox:** FREE
- **Edge:** FREE

Total: $5 to publish on all three stores.

## 📞 Support

After publishing, add support email to manifest.json and store listings.

Good luck! 🚀
