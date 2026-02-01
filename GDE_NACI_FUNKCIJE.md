# 🎯 Gde Naći Sve Funkcionalnosti

## 📍 Category & Tag Suggestions

### Category Suggestions (Smart AI)

**Lokacija:** Pojavljuje se automatski u **SiteModal** (Add Site / Edit Site)

**Kako radi:**

1. Otvori **Add Site** modal (klikni `+` dugme ili pritisni `Ctrl + /` pa `N`)
2. Unesi URL (npr. `https://github.com/username/repo`)
3. **Suggestions se automatski pojavljuju** iznad Category selection polja
4. Vidi predložene kategorije kao "Development", "Work", itd.
5. Klikni `+ Development` da odmah primeniš

**Primer:**

- `github.com` → predlaže "Development"
- `slack.com` → predlaže "Work"
- `youtube.com` → predlaže "Entertainment"
- `udemy.com` → predlaže "Education"

**Fajl:** [components/sites/SiteModal.js](components/sites/SiteModal.js)
**Logika:** [lib/categorySuggestions.js](lib/categorySuggestions.js)

---

### Tag Suggestions

**Status:** Trenutno nisu implementirani

**Planirana funkcionalnost:**

- Slično kao category suggestions
- Predlozi na osnovu URL-a i keywords u naslovu
- Npr: `tutorial`, `documentation`, `inspiration`, `work`, `personal`

**Za implementaciju:**
Dodaj `lib/tagSuggestions.js` sa istom logikom kao kategorije.

---

## ⌨️ Command Menu Shortcuts Objašnjenje

### Kako Koristiti N, C, T Shortcuts

#### 1. **N** - New Site

- **Šta radi:** Otvara modal za dodavanje novog sajta
- **Koristi kada:** Hoćeš brzo da dodaš novi bookmark
- **Alternative:** Klikni `+` dugme ili odaberi "new site" u command meniju

#### 2. **C** - New Category

- **Šta radi:** Otvara modal za kreiranje nove kategorije
- **Koristi kada:** Treba ti nova organizaciona grupa (Work, Personal, etc.)
- **Alternative:** Idi na Categories tab pa klikni `+`

#### 3. **T** - New Tag

- **Šta radi:** Otvara modal za kreiranje novog tag-a
- **Koristi kada:** Treba ti nova labela za dodatnu organizaciju
- **Alternative:** Idi na Tags tab pa klikni `+`

---

## 🎨 Command Menu - Kompletno Uputstvo

### Otvaranje Command Menija

**Shortcut:** `Ctrl + /`

### Navigacija

| Taster  | Akcija                  |
| ------- | ----------------------- |
| `↑`     | Pomeri selekciju gore   |
| `↓`     | Pomeri selekciju dole   |
| `Enter` | Izvrši odabranu komandu |
| `Esc`   | Zatvori meni            |

### Dostupne Komande

#### Actions (Kreiranje)

- **"new site"** ili pritisni `N` → Dodaj novi sajt
- **"new category"** ili pritisni `C` → Kreiraj kategoriju
- **"new tag"** ili pritisni `T` → Kreiraj tag

#### Navigation (Brza navigacija)

- **"go to sites"** → Idi na Sites tab
- **"go to favorites"** → Idi na Favorites
- **"go to categories"** → Idi na Categories
- **"go to tags"** → Idi na Tags
- **"go to settings"** → Idi na Settings

#### Recent Sites (Brzi pristup)

- Poslednje posećene stranice se automatski pojavljuju
- Klikni da otvoriš u novom tabu

---

## 🎭 Sve Animacije na Sajtu

### 1. **Star Burst** (Favorite)

- **Gde:** SiteCard - kada klikneš ⭐
- **Trajanje:** 600ms
- **Efekat:** Zvezda eksplodira sa rotation i scale efektom

### 2. **Pin Bounce** (Pin)

- **Gde:** SiteCard - kada klikneš 📌
- **Trajanje:** 500ms
- **Efekat:** Pin icon se odskakuje

### 3. **Checkbox Pop** (Multi-select)

- **Gde:** TagsList, CategoriesList - kada selektuješ
- **Trajanje:** 300ms (poboljšan sa bounce efektom!)
- **Efekat:** Checkmark se pojavljuje sa scale i rotate efektom

### 4. **Card Hover**

- **Gde:** Svugde (Sites, Tags, Categories)
- **Efekat:**
  - `scale-[1.02]` - blago uvećanje
  - `shadow-lg` - senka
  - Color glow na hover

### 5. **Skeleton Loading**

- **Gde:** Pri učitavanju podataka
- **Efekat:** Stagger animation (50ms delay između kartice)

---

## 🖱️ Hover Boje za Dugmad

### SiteCard Buttons

- **Edit** 🔧: `hover:text-app-accent` + `hover:bg-app-accent/10`
- **Delete** 🗑️: `hover:text-red-400` + `hover:bg-red-500/10`
- **Favorite** ⭐: `hover:text-yellow-400` + `hover:bg-yellow-400/10`
- **Pin** 📌: `hover:text-blue-400` + `hover:bg-blue-400/10`
- **Open** 🔗: `hover:text-app-accent` + `hover:bg-app-accent/10`

### CategoriesList Buttons

- **Edit** 🔧: `hover:text-app-accent` + `hover:bg-app-accent/10`
- **Delete** 🗑️: `hover:text-red-400` + `hover:bg-red-500/10`

### TagsList Buttons

- **Edit** 🔧: `hover:text-app-accent` + `hover:bg-app-accent/10`
- **Delete** 🗑️: `hover:text-red-400` + `hover:bg-red-500/10`

**Focus States:** Sva dugmad imaju focus ring sa odgovarajućim bojama za accessibility

---

## 🎨 Pozadina Command Menija

**Trenutna pozadina:** `bg-app-bg-primary` sa `border-app-border`

**Sklapa se sa:**

- Dashboard pozadinom
- Modal pozadinom
- Sidebar pozadinom

**Overlay:** `bg-black/60` sa `backdrop-blur-sm` za depth efekat

---

## 🔍 Brzi Testovi

### Testiraj Category Suggestions:

1. Pritisni `Ctrl + /`
2. Klikni ili pritisni `N`
3. Unesi URL: `https://stackoverflow.com`
4. Vidi suggestion: "Development"
5. Klikni `+ Development`

### Testiraj Shortcuts:

1. Pritisni `Ctrl + /` → Meni se otvara
2. Pritisni `N` → Site modal se otvara
3. `Esc` → Modal se zatvara
4. Pritisni `Ctrl + /` ponovo
5. Pritisni `C` → Category modal
6. Pritisni `T` → Tag modal

### Testiraj Animacije:

1. Dodaj site
2. Klikni ⭐ (star burst!)
3. Klikni 📌 (pin bounce!)
4. Enable multi-select
5. Klikni checkbox (checkmark pop!)

---

## 📂 Struktura Fajlova

```
components/
  ui/
    CommandMenu.js       ← Command palette
    UndoToast.js         ← Undo delete funkcionalnost
    ServerStatus.js      ← Health status indikator
  sites/
    SiteCard.js          ← Buttons sa hover efektima
    SiteModal.js         ← Category suggestions ovde!
  categories/
    CategoriesList.js    ← Updated button styles
  tags/
    TagsList.js          ← Updated button styles
lib/
  categorySuggestions.js ← Smart AI logika
styles/
  globals.css          ← Sve animacije
```

---

## 💡 Tips & Tricks

1. **Brzo dodavanje:** `Ctrl + /` → `N` → paste URL → suggestions se pojavljuju
2. **Keyboard ninja:** Nauči N, C, T shortcuts - nikad više ne treba miš
3. **Multi-select:** Enable pa klikni checkboxes - vidi animacije!
4. **Undo safety:** Slučajno obrišeš? Klikni "Undo" za 5 sekundi
5. **Recent sites:** Command menu pamti poslednjih 5 sajtova

---

**Sve radi! 🎉**
