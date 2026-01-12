-- Jednostavne tabele za javni dashboard (bez user_id zahteva)
-- Pokreni ovo u Supabase SQL Editor

-- 1. Obriši stare tabele ako postoje (OPREZNO!)
DROP TABLE IF EXISTS site_visits CASCADE;
DROP TABLE IF EXISTS tags CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS sites CASCADE;

-- 2. Kreiraj tabele JEDNOSTAVNIJE (bez user_id obaveznosti)
CREATE TABLE sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    title TEXT,
    description TEXT,
    category TEXT,
    tags TEXT[],
    rating INTEGER DEFAULT 0,
    is_favorite BOOLEAN DEFAULT false,
    pricing TEXT,
    pricing_model TEXT,
    notes TEXT,
    last_visited TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#667eea',
    icon TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    usage_count INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE site_visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    visited_at TIMESTAMP DEFAULT NOW()
);

-- 3. Kreiraj indekse
CREATE INDEX idx_sites_user_id ON sites(user_id);
CREATE INDEX idx_sites_category ON sites(category);
CREATE INDEX idx_categories_user_id ON categories(user_id);
CREATE INDEX idx_tags_user_id ON tags(user_id);
CREATE INDEX idx_site_visits_user_id ON site_visits(user_id);
CREATE INDEX idx_site_visits_created_at ON site_visits(visited_at);

-- 4. Omogući RLS
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_visits ENABLE ROW LEVEL SECURITY;

-- 5. Kreiraj RLS politike - JAVNO ČITANJE + PRIVATNO PISANJE

-- Sites politike
CREATE POLICY "Anyone can view sites" ON sites FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert sites" ON sites FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update their own sites" ON sites FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users can delete their own sites" ON sites FOR DELETE USING (auth.uid() = user_id OR user_id IS NULL);

-- Categories politike
CREATE POLICY "Anyone can view categories" ON categories FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert categories" ON categories FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update their own categories" ON categories FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users can delete their own categories" ON categories FOR DELETE USING (auth.uid() = user_id OR user_id IS NULL);

-- Tags politike
CREATE POLICY "Anyone can view tags" ON tags FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert tags" ON tags FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update their own tags" ON tags FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users can delete their own tags" ON tags FOR DELETE USING (auth.uid() = user_id OR user_id IS NULL);

-- Site visits politike
CREATE POLICY "Anyone can view visits" ON site_visits FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert visits" ON site_visits FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 6. Dodaj sample podatke
INSERT INTO categories (name, description, color) VALUES
    ('Produktivnost', 'Alati za produktivnost i organizaciju', '#6CBBFB'),
    ('Razvoj', 'Web razvoj i programiranje', '#667eea'),
    ('Dizajn', 'Dizajn alati i resursi', '#764ba2');

INSERT INTO tags (name, usage_count) VALUES
    ('važno', 1),
    ('free', 5),
    ('paid', 2);
