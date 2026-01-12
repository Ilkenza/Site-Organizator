/**
// Synchronize data between Supabase and local database
// Pulls all data from Supabase and saves it as JSON files
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Error: SUPABASE_URL and SUPABASE_ANON_KEY must be defined');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const BACKUP_DIR = path.join(__dirname, 'backups');
const DATA_DIR = path.join(__dirname, 'data');

// Create directories if they don't exist
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

async function syncData() {

    try {
        // Pull all data
        const [sitesResult, categoriesResult, tagsResult, visitsResult] = await Promise.all([
            supabase.from('sites').select('*'),
            supabase.from('categories').select('*'),
            supabase.from('tags').select('*'),
            supabase.from('site_visits').select('*')
        ]);

        // Check for errors
        if (sitesResult.error) throw new Error(`Sites error: ${sitesResult.error.message}`);
        if (categoriesResult.error) throw new Error(`Categories error: ${categoriesResult.error.message}`);
        if (tagsResult.error) throw new Error(`Tags error: ${tagsResult.error.message}`);
        if (visitsResult.error) throw new Error(`Visits error: ${visitsResult.error.message}`);

        const sites = sitesResult.data || [];
        const categories = categoriesResult.data || [];
        const tags = tagsResult.data || [];
        const visits = visitsResult.data || [];

        // Create timestamp for backup
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

        // Save data to DATA directory (current)
        const dataFiles = {
            'sites.json': sites,
            'categories.json': categories,
            'tags.json': tags,
            'site_visits.json': visits,
            'metadata.json': {
                timestamp: new Date().toISOString(),
                record_counts: {
                    sites: sites.length,
                    categories: categories.length,
                    tags: tags.length,
                    site_visits: visits.length
                }
            }
        };

        for (const [filename, data] of Object.entries(dataFiles)) {
            const filePath = path.join(DATA_DIR, filename);
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        }

        // Create backup
        const backupDir = path.join(BACKUP_DIR, timestamp);
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        for (const [filename, data] of Object.entries(dataFiles)) {
            const backupPath = path.join(backupDir, filename);
            fs.writeFileSync(backupPath, JSON.stringify(data, null, 2));
        }

        // Display statistics
        // Statistics:
        // Sites: ${sites.length}
        // Categories: ${categories.length}
        // Tags: ${tags.length}
        // Visitors: ${visits.length}

        // Analysis by category
        const sitesByCategory = {};
        sites.forEach(site => {
            const cat = site.category || 'No category';
            sitesByCategory[cat] = (sitesByCategory[cat] || 0) + 1;
        });

        if (Object.keys(sitesByCategory).length > 0) {
        }

        return true;

    } catch (error) {
        console.error('\n❌ Synchronization error:', error.message);
        console.error(error);
        return false;
    }
}

// Start synchronization
syncData().then(success => {
    process.exit(success ? 0 : 1);
});
