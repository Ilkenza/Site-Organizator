# UX Improvements Guide

All new UX features implemented in Site Organizator.

## ✨ New Features

### 1. **Undo Delete**

Delete sites, categories, or tags with a 5-second undo window.

**How it works:**

- When you delete something, a toast appears at the bottom
- Click "Undo" within 5 seconds to restore
- Automatic timer shows progress

**Files:**

- `components/ui/UndoToast.js` - Toast component
- `pages/dashboard.js` - Undo logic in `handleConfirmDelete`

---

### 2. **Command Menu (Ctrl+/)**

Quick access to all actions like Notion/Linear.

**Keyboard Shortcut:** `Ctrl + /`

**Features:**

- Quick navigation (Sites, Favorites, Categories, Tags, Settings)
- Create new items (N for new site, C for category, T for tag)
- Recent sites quick access
- Fuzzy search
- Keyboard navigation (↑↓ to move, Enter to select, Esc to close)

**Files:**

- `components/ui/CommandMenu.js` - Command palette component
- `pages/dashboard.js` - Keyboard listener and action handler

---

### 3. **Animated Icons**

#### Star Burst Animation (Favorite)

When you favorite a site, the star bursts with a satisfying animation.

**CSS Animation:** `.animate-starBurst`

#### Pin Bounce Animation

When you pin a site, the pin icon bounces.

**CSS Animation:** `.animate-pinBounce`

#### Checkbox Pop Animation

When you select items in multi-select mode, checkmark pops with animation.

**CSS Animation:** `.animate-checkPop`

**Files:**

- `components/sites/SiteCard.js` - Star and pin animations
- `components/tags/TagsList.js` - Animated checkboxes
- `components/categories/CategoriesList.js` - Animated checkboxes (needs manual update)
- `styles/globals.css` - Animation keyframes

---

### 4. **Smart Category Suggestions**

AI-powered category suggestions based on URL domain and title.

**How it works:**

1. Enter a URL in the "Add Site" modal
2. System analyzes the domain (e.g., github.com → Development)
3. Suggests matching categories
4. Click suggestion to auto-apply

**Patterns recognized:**

- **Work:** slack, notion, teams, zoom, etc.
- **Development:** github, stackoverflow, npm, docker, etc.
- **Education:** udemy, coursera, khan academy, etc.
- **Social:** twitter, facebook, linkedin, reddit, etc.
- **Entertainment:** youtube, netflix, spotify, twitch, etc.
- ...and many more!

**Files:**

- `lib/categorySuggestions.js` - Suggestion logic
- `components/sites/SiteModal.js` - Integration in site modal

---

### 5. **Server Status Indicator**

Real-time server health monitoring in the header.

**Features:**

- 🟢 **Green dot:** Server is online
- 🔴 **Red dot:** Server is offline
- 🟡 **Yellow (pulsing):** Checking status
- Checks every 30 seconds
- Hover to see last check time

**Files:**

- `components/ui/ServerStatus.js` - Status component
- `components/layout/Header.js` - Integrated in header
- `pages/api/health.js` - Health check endpoint (if exists)

---

## 🎨 Animation Reference

### CSS Animations in `styles/globals.css`

```css
/* Star burst for favorites */
@keyframes starBurst {
  0% {
    transform: scale(1) rotate(0deg);
    opacity: 1;
  }
  50% {
    transform: scale(1.3) rotate(72deg);
    opacity: 0.8;
  }
  100% {
    transform: scale(1) rotate(144deg);
    opacity: 1;
  }
}

/* Pin bounce */
@keyframes pinBounce {
  0%,
  100% {
    transform: translateY(0) rotate(-45deg);
  }
  50% {
    transform: translateY(-4px) rotate(-45deg);
  }
}

/* Checkbox checkmark pop */
@keyframes checkPop {
  0% {
    transform: scale(0) rotate(-45deg);
    opacity: 0;
  }
  50% {
    transform: scale(1.2) rotate(0deg);
    opacity: 1;
  }
  100% {
    transform: scale(1) rotate(0deg);
    opacity: 1;
  }
}
```

---

## 🎯 Usage Examples

### Using Command Menu

```
1. Press Ctrl+/
2. Type "new site" or "create category"
3. Or navigate with arrow keys
4. Press Enter to execute
```

### Undo Delete

```javascript
// Automatic - just delete normally
// Toast appears with undo button
// Click "Undo" within 5 seconds
```

### Smart Category Suggestions

```
1. Open "Add Site" modal
2. Paste URL: https://github.com/user/repo
3. See suggestion: "Development"
4. Click "+ Development" to apply
```

---

## 🚀 Performance Notes

- **Animations:** Hardware-accelerated CSS transforms
- **Command Menu:** Debounced search for performance
- **Server Status:** 30s interval, low network overhead
- **Undo Toast:** Auto-dismisses after 5s, no memory leaks

---

## 📦 Component Exports

Update `components/ui/index.js`:

```javascript
export { default as UndoToast } from "./UndoToast";
export { default as ServerStatus } from "./ServerStatus";
export { default as CommandMenu } from "./CommandMenu";
```

---

## 🔧 Manual Fixes Needed

### CategoriesList.js Animated Checkboxes

The automated update failed. Manually apply these changes:

1. **Add state** (after line 22):

```javascript
const [checkAnimations, setCheckAnimations] = useState(new Set());
```

2. **Update handleSelectCategory** (line 32):

```javascript
const handleSelectCategory = (e, categoryId) => {
  e.stopPropagation();
  const newSelected = new Set(selectedCategories);
  if (newSelected.has(categoryId)) {
    newSelected.delete(categoryId);
  } else {
    newSelected.add(categoryId);
    // Trigger check animation
    setCheckAnimations((prev) => new Set(prev).add(categoryId));
    setTimeout(() => {
      setCheckAnimations((prev) => {
        const next = new Set(prev);
        next.delete(categoryId);
        return next;
      });
    }, 300);
  }
  setSelectedCategories(newSelected);
};
```

3. **Wrap checkbox** (around line 147):

```javascript
{
  multiSelectMode && (
    <div className="relative flex-shrink-0">
      <input
        type="checkbox"
        checked={selectedCategories.has(category.id)}
        onChange={(e) => handleSelectCategory(e, category.id)}
        className="w-4 h-4 rounded-full border-2 border-app-accent/50 bg-app-bg-card cursor-pointer accent-app-accent flex-shrink-0 transition-transform hover:scale-110 focus:ring-2 focus:ring-app-accent focus:ring-offset-2"
        title="Select category for bulk actions"
        aria-label={`Select ${category.name}`}
      />
      {checkAnimations.has(category.id) && (
        <svg
          className="absolute inset-0 w-4 h-4 text-app-accent pointer-events-none animate-checkPop"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={3}
            d="M5 13l4 4L19 7"
          />
        </svg>
      )}
    </div>
  );
}
```

---

## 🎨 Design Tokens

### Animation Timing

- **Fast:** 200ms (hover states)
- **Medium:** 300ms (checkboxes)
- **Slow:** 500-600ms (star burst, pin bounce)
- **Toast:** 5000ms (undo window)

### Colors

- **Accent:** Primary blue (#5B8DEE or from theme)
- **Success:** Green (#10b981)
- **Warning:** Yellow (#f59e0b)
- **Danger:** Red (#ef4444)

---

## 📝 Testing Checklist

- [ ] Command menu opens with Ctrl+/
- [ ] Undo toast appears after delete
- [ ] Undo button restores deleted item
- [ ] Star burst plays when favoriting
- [ ] Pin bounce plays when pinning
- [ ] Checkbox pop animation works in multi-select
- [ ] Server status updates every 30s
- [ ] Category suggestions appear for known URLs
- [ ] Suggested categories can be applied with one click

---

## 🐛 Known Issues

1. **CategoriesList checkboxes:** Animation not applied (manual fix required)
2. **Undo restore:** Doesn't preserve original ID (creates new item with same data)
3. **Server status:** Requires `/api/health` endpoint to exist

---

## 🔮 Future Improvements

- Persistent undo history (localStorage)
- Undo for bulk actions
- More keyboard shortcuts (N, /, Esc, etc.)
- Command menu search history
- AI-powered category creation from suggestions
- Server status notifications
