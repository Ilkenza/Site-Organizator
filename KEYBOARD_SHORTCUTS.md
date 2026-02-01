# ⌨️ Keyboard Shortcuts & Commands

Quick reference for all keyboard shortcuts in Site Organizator.

## Global Shortcuts

| Shortcut   | Action            | Description                          |
| ---------- | ----------------- | ------------------------------------ |
| `Ctrl + K` | Open Command Menu | Quick access to all commands         |
| `Esc`      | Close Modal/Menu  | Close any open modal or command menu |

---

## Command Menu Actions

### Creating New Items

Type these in the command menu or use context-aware shortcut:

| Command        | Shortcut | Description                                      |
| -------------- | -------- | ------------------------------------------------ |
| "new site"     | `N`      | Create new site (when in Sites or Favorites tab) |
| "new category" | `N`      | Create new category (when in Categories tab)     |
| "new tag"      | `N`      | Create new tag (when in Tags tab)                |

**Note:** `N` is a context-aware shortcut that creates different items based on your active tab.

### Navigation

| Command            | Action                 |
| ------------------ | ---------------------- |
| "go to sites"      | Navigate to Sites tab  |
| "go to favorites"  | Navigate to Favorites  |
| "go to categories" | Navigate to Categories |
| "go to tags"       | Navigate to Tags       |
| "go to settings"   | Navigate to Settings   |

### Recent Sites

- Last 5 visited sites appear in command menu
- Click to open in new tab

---

## Command Menu Navigation

| Key           | Action                   |
| ------------- | ------------------------ |
| `↑`           | Move selection up        |
| `↓`           | Move selection down      |
| `Enter`       | Execute selected command |
| `Esc`         | Close command menu       |
| `Arrow Left`  | Previous page            |
| `Arrow Right` | Next page                |
| `Home`        | First page               |
| `End`         | Last page                |
| Type anything | Filter commands          |

**Note:** Arrow keys and Home/End work for both command navigation and page navigation.

---

## Interactive Animations

### Favorite Sites

- Click ⭐ to favorite
- **Animation:** Star burst effect
- Duration: 600ms

### Pin Sites

- Click 📌 to pin
- **Animation:** Pin bounce
- Duration: 500ms

### Multi-Select Checkboxes

- Click checkbox in multi-select mode
- **Animation:** Checkmark pop
- Duration: 300ms

---

## Undo Actions

### Delete with Undo

1. Delete any item (site, category, tag)
2. Toast appears at bottom with "Undo" button
3. Click "Undo" within 5 seconds to restore
4. Progress bar shows remaining time

---

## Server Status

### Status Indicator (Top Right Header)

- 🟢 **Green:** Server online
- 🔴 **Red:** Server offline
- 🟡 **Yellow (pulsing):** Checking...
- Hover to see last check time
- Updates every 30 seconds

---

## Smart Category Suggestions

### Auto-Suggest Categories

1. Open "Add Site" modal
2. Enter URL (e.g., `https://github.com/username/repo`)
3. System suggests category: "Development"
4. Click `+ Development` to apply instantly

### Recognized Domains

| Category          | Example Domains                           |
| ----------------- | ----------------------------------------- |
| **Work**          | slack.com, notion.so, teams.microsoft.com |
| **Development**   | github.com, stackoverflow.com, npmjs.com  |
| **Education**     | udemy.com, coursera.org, khanacademy.org  |
| **Social**        | twitter.com, facebook.com, linkedin.com   |
| **Entertainment** | youtube.com, netflix.com, spotify.com     |
| **Shopping**      | amazon.com, ebay.com, etsy.com            |
| **News**          | medium.com, techcrunch.com, theverge.com  |
| **Finance**       | paypal.com, stripe.com, coinbase.com      |
| **Design**        | figma.com, dribbble.com, behance.net      |
| **Tools**         | google.com, gmail.com, outlook.com        |

Full list in `lib/categorySuggestions.js`

---

## Tips & Tricks

### Productivity Boosters

- Use `Ctrl + K` frequently for quick actions
- Recent sites in command menu = instant access
- Smart suggestions = less manual categorization
- Undo safety net = confident deletions
- Server status = peace of mind

### Workflow Examples

#### Quick Add Site

```
1. Ctrl+K (or just press N in Sites tab)
2. Paste URL
3. Suggestions appear
4. Click suggestion
5. Done!
```

#### Bulk Delete with Confidence

```
1. Enable multi-select
2. Select items
3. Delete
4. Undo within 5s if needed
```

#### Navigate Fast

```
1. Ctrl+K
2. Type "fav"
3. Enter (goes to favorites)
```

---

## Accessibility

### Keyboard Navigation

- All actions accessible via keyboard
- Focus states on all interactive elements
- ARIA labels for screen readers

### Visual Feedback

- Every action has visual feedback
- Animations can be reduced via OS settings
- High contrast color indicators

---

## Advanced Usage

### Command Menu Power User

- Type partial matches (e.g., "cat" finds "Categories")
- Arrow keys for quick selection
- Enter executes instantly
- Recent sites update dynamically

### Category Suggestions

- Suggestions based on URL **and** title
- Multiple categories can match
- Only shows if category exists in your database
- Won't auto-apply when editing existing sites

---

## Browser Extension Integration

If using the browser extension:

- All shortcuts work the same
- Extension popup has quick add
- Right-click → "Add to Site Organizer"
- Syncs with dashboard in real-time

---

## Troubleshooting

### Command Menu Not Opening

- Check if `Ctrl + K` conflicts with other software
- Try closing and reopening browser tab
- Ensure JavaScript is enabled

### Undo Not Working

- Check console for errors
- Undo only works immediately after delete
- Toast auto-closes after 5 seconds

### Suggestions Not Appearing

- Ensure URL is valid and complete
- Category must exist in your database
- Only works for new sites (not editing)

### Server Status Stuck on "Checking"

- Check `/api/health` endpoint exists
- Check browser console for errors
- Network may be blocking requests

---

## Developer Notes

### Adding New Commands

Edit `components/ui/CommandMenu.js`:

```javascript
{
    id: 'my-command',
    label: 'My Custom Command',
    icon: '🚀',
    shortcut: 'M',
    action: () => onAction('my-command'),
    category: 'Actions'
}
```

### Custom Animations

Add to `styles/globals.css`:

```css
@keyframes myAnimation {
  0% {
    /* start state */
  }
  100% {
    /* end state */
  }
}

.animate-myAnimation {
  animation: myAnimation 0.3s ease-in-out;
}
```

### Custom Suggestions

Edit `lib/categorySuggestions.js`:

```javascript
const domainPatterns = {
  "my-category": ["domain1.com", "domain2.com"],
};
```

---

**Last Updated:** January 31, 2026
**Version:** 1.0.0
