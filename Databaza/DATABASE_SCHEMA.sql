-- Site Organizer Database Schema
-- Tabela za organizovane sajtove

CREATE TABLE IF NOT EXISTS sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    title TEXT,
    description TEXT,
    category TEXT,
    categories JSONB, -- Array of category names for display/search
    tags TEXT[], -- Array of tags
    rating INTEGER DEFAULT 0,
    is_favorite BOOLEAN DEFAULT false,
    pricing_model TEXT, -- free, paid, freemium
    notes TEXT,
    last_visited TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, url)
);

CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT, -- hex color code
    icon TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    usage_count INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS site_visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    visited_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS site_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(site_id, tag_id)
);

CREATE TABLE IF NOT EXISTS site_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(site_id, category_id)
);

-- Indeksi za bolje performanse
CREATE INDEX IF NOT EXISTS idx_sites_user_id ON sites(user_id);
CREATE INDEX IF NOT EXISTS idx_sites_category ON sites(category);
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
CREATE INDEX IF NOT EXISTS idx_site_visits_user_id ON site_visits(user_id);
CREATE INDEX IF NOT EXISTS idx_site_visits_created_at ON site_visits(visited_at);
CREATE INDEX IF NOT EXISTS idx_site_tags_site_id ON site_tags(site_id);
CREATE INDEX IF NOT EXISTS idx_site_tags_tag_id ON site_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_site_categories_site_id ON site_categories(site_id);
CREATE INDEX IF NOT EXISTS idx_site_categories_category_id ON site_categories(category_id);

-- RLS politike (Row Level Security)
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_visits ENABLE ROW LEVEL SECURITY;

-- Korisnik može videti samo svoje sajtove
CREATE POLICY "Users can view their own sites"
    ON sites FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sites"
    ON sites FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sites"
    ON sites FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sites"
    ON sites FOR DELETE
    USING (auth.uid() = user_id);

-- Iste politike za kategorije
CREATE POLICY "Users can view their own categories"
    ON categories FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own categories"
    ON categories FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own categories"
    ON categories FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own categories"
    ON categories FOR DELETE
    USING (auth.uid() = user_id);

-- Iste politike za tagove
CREATE POLICY "Users can view their own tags"
    ON tags FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tags"
    ON tags FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tags"
    ON tags FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tags"
    ON tags FOR DELETE
    USING (auth.uid() = user_id);

-- Iste politike za posetilačke podatke
CREATE POLICY "Users can view their own visits"
    ON site_visits FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own visits"
    ON site_visits FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- RLS za site_tags
ALTER TABLE site_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view site_tags of their sites"
    ON site_tags FOR SELECT
    USING (
        site_id IN (
            SELECT id FROM sites WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert site_tags for their sites"
    ON site_tags FOR INSERT
    WITH CHECK (
        site_id IN (
            SELECT id FROM sites WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete site_tags from their sites"
    ON site_tags FOR DELETE
    USING (
        site_id IN (
            SELECT id FROM sites WHERE user_id = auth.uid()
        )
    );

-- RLS za site_categories
ALTER TABLE site_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view site_categories of their sites"
    ON site_categories FOR SELECT
    USING (
        site_id IN (
            SELECT id FROM sites WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert site_categories for their sites"
    ON site_categories FOR INSERT
    WITH CHECK (
        site_id IN (
            SELECT id FROM sites WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete site_categories from their sites"
    ON site_categories FOR DELETE
    USING (
        site_id IN (
            SELECT id FROM sites WHERE user_id = auth.uid()
        )
    );
