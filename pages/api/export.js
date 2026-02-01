import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;



// Prefer service key for server-side requests (bypasses RLS if needed)
const KEY = SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, KEY);

// CSV export helper - SIMPLE AND SAFE
const convertToCSV = (sites) => {
    const headers = 'Name,URL,Category,Tags,Description';
    if (!sites || !Array.isArray(sites) || sites.length === 0) {
        return headers + '\n';
    }

    const rows = sites.map(site => {
        const name = (site.name || '').replace(/"/g, '""');
        const url = (site.url || '').replace(/"/g, '""');
        const cats = site.categories_array && Array.isArray(site.categories_array)
            ? site.categories_array.map(c => c?.name || '').join('; ').replace(/"/g, '""')
            : '';
        const tags = site.tags_array && Array.isArray(site.tags_array)
            ? site.tags_array.map(t => t?.name || '').join('; ').replace(/"/g, '""')
            : '';
        const desc = (site.description || '').replace(/"/g, '""');

        return `"${name}","${url}","${cats}","${tags}","${desc}"`;
    });

    return [headers, ...rows].join('\n');
};

// HTML export helper - SIMPLE AND SAFE
const convertToHTML = (sites) => {
    const rows = sites && Array.isArray(sites) && sites.length > 0
        ? sites.map(site => {
            const name = (site.name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const url = (site.url || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const cats = site.categories_array && Array.isArray(site.categories_array)
                ? site.categories_array.map(c => (c?.name || '')).join('; ')
                : '';
            const tags = site.tags_array && Array.isArray(site.tags_array)
                ? site.tags_array.map(t => (t?.name || '')).join('; ')
                : '';
            const desc = (site.description || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');

            return `<tr><td>${name}</td><td><a href="${url}">${url}</a></td><td>${cats}</td><td>${tags}</td><td>${desc}</td></tr>`;
        }).join('')
        : '<tr><td colspan="5">No sites</td></tr>';

    return `<!DOCTYPE html>
<html>
<head>
    <title>Sites Export</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #4CAF50; color: white; }
        tr:nth-child(even) { background-color: #f2f2f2; }
        a { color: #0066cc; }
    </style>
</head>
<body>
    <h1>Sites Export</h1>
    <p>Exported on: ${new Date().toLocaleString()}</p>
    <table>
        <thead>
            <tr>
                <th>Name</th>
                <th>URL</th>
                <th>Category</th>
                <th>Tags</th>
                <th>Description</th>
            </tr>
        </thead>
        <tbody>
            ${rows}
        </tbody>
    </table>
</body>
</html>`;
};

export default async function handler(req, res) {

    if (req.method !== 'GET') {
        console.error('❌ Wrong method:', req.method);
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Check environment
    if (!SUPABASE_URL || !KEY) {
        console.error('❌ Missing Supabase config - URL:', !!SUPABASE_URL, 'Key:', !!KEY);
        return res.status(500).json({ error: 'Supabase not configured', details: 'Missing API credentials' });
    }

    try {
        const userId = req.query.userId || req.headers['x-user-id'];
        const format = (req.query.format || 'json').toLowerCase();


        if (!userId) {
            console.error('❌ No userId provided');
            return res.status(401).json({ error: 'User ID required' });
        }

        // Fetch sites
        const { data: sites, error: sitesError } = await supabase
            .from('sites')
            .select('*')
            .eq('user_id', userId);

        if (sitesError) {
            console.error('❌ Sites error:', sitesError.message);
            throw sitesError;
        }

        // Fetch categories (all categories used by this user's sites, regardless of user_id)
        const { data: scTmp, error: scError } = await supabase
            .from('site_categories')
            .select('category_id')
            .in('site_id', (sites || []).map(s => s.id));

        if (scError) {
            console.error('❌ Site categories error:', scError.message);
            throw scError;
        }

        const categoryIds = [...new Set((scTmp || []).map(sc => sc.category_id).filter(Boolean))];

        let categories = [];
        if (categoryIds.length > 0) {
            const { data: cats, error: catErr } = await supabase
                .from('categories')
                .select('*')
                .in('id', categoryIds);
            if (!catErr) categories = cats || [];
        }
        // Fetch tags (all tags used by this user's sites, regardless of user_id)
        const { data: stTmp, error: stError } = await supabase
            .from('site_tags')
            .select('tag_id')
            .in('site_id', (sites || []).map(s => s.id));

        if (stError) {
            console.error('❌ Site tags error:', stError.message);
            throw stError;
        }

        const tagIds = [...new Set((stTmp || []).map(st => st.tag_id).filter(Boolean))];

        let tags = [];
        if (tagIds.length > 0) {
            const { data: tgs, error: tagErr } = await supabase
                .from('tags')
                .select('*')
                .in('id', tagIds);
            if (!tagErr) tags = tgs || [];
        }

        // Fetch site-category relationships (only for this user's sites)
        const scData = await supabase
            .from('site_categories')
            .select('site_id, category_id')
            .in('site_id', (sites || []).map(s => s.id));

        if (scData.error) {
            console.error('❌ Site categories error:', scData.error.message);
            throw scData.error;
        }
        const siteCategories = scData.data || [];

        // Fetch site-tag relationships (only for this user's sites)
        const stData = await supabase
            .from('site_tags')
            .select('site_id, tag_id')
            .in('site_id', (sites || []).map(s => s.id));

        if (stData.error) {
            console.error('❌ Site tags error:', stData.error.message);
            throw stData.error;
        }
        const siteTags = stData.data || [];

        // Build enriched sites
        const enrichedSites = (sites || []).map(site => {
            const siteCats = (siteCategories || [])
                .filter(sc => sc.site_id === site.id)
                .map(sc => categories?.find(c => c.id === sc.category_id))
                .filter(c => c);

            const siteTgs = (siteTags || [])
                .filter(st => st.site_id === site.id)
                .map(st => tags?.find(t => t.id === st.tag_id))
                .filter(t => t);

            return {
                ...site,
                categories_array: siteCats,
                tags_array: siteTgs
            };
        });

        const timestamp = new Date().toISOString().split('T')[0];

        // Return format based on request
        if (format === 'csv') {
            const csv = convertToCSV(enrichedSites);
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="sites-export-${timestamp}.csv"`);
            return res.end(csv);
        }

        if (format === 'html') {
            const html = convertToHTML(enrichedSites);
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="sites-export-${timestamp}.html"`);
            return res.end(html);
        }
        // Default to JSON
        const exportData = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            sites: enrichedSites,
            categories,
            tags
        };
        res.setHeader('Content-Type', 'application/json');
        return res.json(exportData);
    } catch (error) {
        console.error('💥 Export error:', error.message);
        console.error('Stack:', error.stack);
        return res.status(500).json({
            error: 'Export failed',
            message: error.message,
            type: error.constructor.name
        });
    }
}
