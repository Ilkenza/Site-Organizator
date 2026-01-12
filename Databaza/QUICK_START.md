# 🚀 Brz početak - Site Organizer Database

## ⚡ 5 minuta do gotove baze podataka

### Korak 1: Instaliraj zavisnosti

```bash
npm install
```

### Korak 1.5: ⚠️ VAŽNO - Dodaj "name" kolonu u Supabase

**Ako je prvi put da koristiš ovu verziju**, trebas:

1. Otvori [Supabase SQL Editor](https://app.supabase.com)
2. Izaberi projekt: `skacyhzljreaitrbgbte`
3. Klikni **SQL Editor** → **New Query**
4. Iskopi i pokreni:

```sql
ALTER TABLE sites ADD COLUMN IF NOT EXISTS name TEXT;
```

Trebalo bi da vidiš: "Success"

### Korak 2: Konfiguruj Supabase kredencijale

Otvori `.env` fajl i popuni:

```env
SUPABASE_URL=https://skacyhzljreaitrbgbte.supabase.co
SUPABASE_ANON_KEY=eyJhbGc... (već popunjeno)
PORT=3000
```

### Korak 3: Pokreni server

```bash
npm start
```

Server je sada dostupan na: **http://localhost:3000**

### Korak 4: Proveri podatke

Otvori u pregledniku: **http://localhost:3000/health**

Trebalo bi da vidiš:

```json
{ "status": "OK", "timestamp": "..." }
```

### Korak 5: Učitaj sve podatke iz Supabase-a

U drugoj terminskoj liniji:

```bash
npm run sync
```

Ovo će:

- Povući sve sajtove, kategorije, tagove i posetilačke podatke
- Spremi ih kao JSON fajlove u `data/` folder
- Kreiraj backup u `backups/` folder

## 📊 Pristup bazama podataka

### REST API

```bash
# Sve sajtove
curl http://localhost:3000/api/sites

# Sve kategorije
curl http://localhost:3000/api/categories

# Sve tagove
curl http://localhost:3000/api/tags

# Statistiku
curl http://localhost:3000/api/stats

# Kompletan izvoz
curl http://localhost:3000/api/export/all
```

### Dashboard (UI)

Otvori u pregledniku: **http://localhost:3000/dashboard.html**

Tamo vidbiš:

- 📊 Statistiku (broj sajtova, kategorija, tagova, posetilačkih sredstava)
- 📥 Dugmadi za učitavanje podataka
- 📋 Tabele sa svim podacima
- 💾 Mogućnost preuzimanja kao JSON

## 📁 Struktura podataka

Nakon `npm run sync`, u `data/` folderu imaš:

```
data/
├── sites.json           # Svi sajtovi
├── categories.json      # Sve kategorije
├── tags.json           # Svi tagovi
├── site_visits.json    # Sve posetilačke stavke
└── metadata.json       # Metadata i statistika
```

## 🔄 Automatska sinhronizacija

Za automatsku sinhronizaciju svakih 5 minuta:

**Linux/Mac:**

```bash
# Dodaj u crontab
*/5 * * * * cd /path/to/Databaza && npm run sync
```

**Windows:**

```bash
# Koristi Task Scheduler
schtasks /create /tn "SiteOrganizer-Sync" /tr "node C:\path\to\Databaza\syncData.js" /sc minute /mo 5
```

## 📡 Primeri zahteva

### Dobij sve sajtove

```javascript
fetch("http://localhost:3000/api/sites")
  .then((r) => r.json())
  .then((data) => console.log(data));
```

### Dodaj novi sajt

```javascript
fetch("http://localhost:3000/api/sites", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    url: "https://example.com",
    title: "Example Site",
    category: "Education",
    tags: ["learning", "web"],
  }),
});
```

### Preuzmi sve podatke kao JSON

```javascript
fetch("http://localhost:3000/api/export/all")
  .then((r) => r.json())
  .then((data) => {
    const blob = new Blob([JSON.stringify(data, null, 2)]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "backup.json";
    a.click();
  });
```

## 🆘 Rešavanje problema

### Error: "Cannot find module '@supabase/supabase-js'"

```bash
npm install
```

### Error: "Port 3000 je već u upotrebi"

Promeni port u `.env`:

```env
PORT=3001
```

### Supabase podaci se ne pojavljuju

1. Proveri `.env` fajl - Supabase kredencijale
2. Provjeri internet konekciju
3. Provjeri da li su tabele kreirane u Supabase-u
4. Pokreni: `node initDatabase.js`

### Tipska greška pri sinhronizaciji

1. Osvežiti page
2. Obrisati `data/` folder
3. Ponovo pokreni: `npm run sync`

## 📚 Više informacija

- [README.md](README.md) - Detaljnog dokumentacija
- [DATABASE_SCHEMA.sql](DATABASE_SCHEMA.sql) - SQL schema
- [Supabase dokumentacija](https://supabase.com/docs)

## ✨ Šta je sledeće?

1. ✅ Instaliraj server
2. ✅ Sinhroniziraj podatke
3. 🔄 Postavi automatsku sinhronizaciju
4. 📊 Prilagodi dashboard
5. 🚀 Distribuiraj aplikaciju

---

**Zadnje ažuriranje:** 6. januar 2026
Sve je spremno! 🎉
