# 🔧 Postavljanje Javnog Dashboard-a

Trebam da pokrenem SQL u Supabase da kreiram tabele sa javnim čitanjem.

## ⚡ Brz setup (3 minuta)

### Korak 1: Otvori Supabase SQL Editor

1. Idi na https://supabase.com/dashboard
2. Odaberi svoj projekat
3. Klikni na **SQL Editor** u levoj sidebaru

### Korak 2: Pokreni SQL

1. Kopiraj sadržaj fajla: **SETUP_PUBLIC_DASHBOARD.sql**
2. Zalepi u SQL editor
3. Klikni **Run** (ili Ctrl+Enter)

```sql
-- Site Organizer Setup - Copy paste entire SETUP_PUBLIC_DASHBOARD.sql content here
```

### Korak 3: Verifikuj

Posle izvršavanja trebalo bi da vidiš:

- ✅ 3 tabele kreirane: `sites`, `categories`, `tags`, `site_visits`
- ✅ 3 kategorije sa sample podacima
- ✅ 2 tagova sa sample podacima

### Korak 4: Osvežavaj dashboard

1. Osvežaj preglednik (F5)
2. Klikni na "Učitaj podatke" u dashboard-u
3. **Sada bi trebalo da vidiš kategorije i tagove!** ✨

## 📋 Šta se promenilo?

User_id je sada **nullable** što znači:

- ✅ Javni pristup za čitanje (SELECT)
- ✅ Service Key može da piše bez user_id
- ✅ RLS politike dozvoljavaju dashboard da radi

## Ako se javlja greška:

### "Could not find the table"

- Ponovi SQL setup

### "RLS policy violation"

- Testiraj sa `/api/debug` endpoint-om
- Trebalo bi da vidiš `✅ N redova` za sve tabele

### "user_id REFERENCES auth.users"

- Neke kategorije/tagove možda imaju nevalidne user_id
- To je OK - RLS politike dozvoljavaju `user_id IS NULL`

---

**Server ✅ pokrenut na**: http://localhost:3000
**Dashboard ✅ dostupan na**: http://localhost:3000/dashboard.html
**SQL sadržaj**: Kopiraj iz SETUP_PUBLIC_DASHBOARD.sql
