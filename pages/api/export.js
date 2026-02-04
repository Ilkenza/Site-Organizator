/**
 * @fileoverview Export API endpoint for exporting sites in JSON, CSV, or HTML format
 * Supports exporting user's sites with enriched categories and tags data
 */

import { createClient } from '@supabase/supabase-js';

// Constants
const HTTP_STATUS = {
    OK: 200,
    UNAUTHORIZED: 401,
    METHOD_NOT_ALLOWED: 405,
    INTERNAL_ERROR: 500,
};

const ERROR_MESSAGES = {
    METHOD_NOT_ALLOWED: 'Method not allowed',
    MISSING_CONFIG: 'Supabase not configured',
    MISSING_CREDENTIALS: 'Missing API credentials',
    USER_ID_REQUIRED: 'User ID required',
    EXPORT_FAILED: 'Export failed',
};

const EXPORT_FORMATS = {
    JSON: 'json',
    CSV: 'csv',
    HTML: 'html',
};

const CONTENT_TYPES = {
    JSON: 'application/json',
    CSV: 'text/csv; charset=utf-8',
    HTML: 'text/html; charset=utf-8',
};

const CSV_HEADERS = 'Name,URL,Category,Tags,Description,Favorite,Pinned';

const HTML_TABLE_HEADERS = ['Name', 'URL', 'Category', 'Tags', 'Description', 'Favorite', 'Pinned'];

const SUPABASE_TABLES = {
    SITES: 'sites',
    CATEGORIES: 'categories',
    TAGS: 'tags',
    SITE_CATEGORIES: 'site_categories',
    SITE_TAGS: 'site_tags',
};

const EXPORT_VERSION = '1.0';

// Supabase Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

// Prefer service key for server-side requests (bypasses RLS if needed)
const KEY = SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, KEY);

// Helper Functions

/**
 * Escape CSV field value
 * @param {string} value - Value to escape
 * @returns {string} Escaped value
 */
function escapeCsvField(value) {
    return (value || '').replace(/"/g, '""');
}

/**
 * Escape HTML content
 * @param {string} value - Value to escape
 * @returns {string} Escaped value
 */
function escapeHtml(value) {
    return (value || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Extract array of names from categories or tags array
 * @param {Array} items - Array of category or tag objects
 * @returns {string} Joined names separated by semicolon
 */
function extractNames(items) {
    if (!items || !Array.isArray(items)) return '';
    return items.map(item => item?.name || '').join('; ');
}

/**
 * Get site IDs from sites array
 * @param {Array} sites - Sites array
 * @returns {Array} Array of site IDs
 */
function getSiteIds(sites) {
    return (sites || []).map(s => s.id);
}

/**
 * Get unique IDs from relation array
 * @param {Array} relations - Relations array
 * @param {string} field - Field name containing ID
 * @returns {Array} Array of unique IDs
 */
function getUniqueIds(relations, field) {
    return [...new Set((relations || []).map(r => r[field]).filter(Boolean))];
}

/**
 * Build CSV row for a site
 * @param {Object} site - Site object with enriched data
 * @returns {string} CSV row
 */
function buildCsvRow(site) {
    const name = escapeCsvField(site.name);
    const url = escapeCsvField(site.url);
    const cats = escapeCsvField(extractNames(site.categories_array));
    const tags = escapeCsvField(extractNames(site.tags_array));
    const desc = escapeCsvField(site.description);
    const fav = site.is_favorite ? 'Yes' : 'No';
    const pin = site.is_pinned ? 'Yes' : 'No';

    return `"${name}","${url}","${cats}","${tags}","${desc}","${fav}","${pin}"`;
}

/**
 * Build HTML table row for a site
 * @param {Object} site - Site object with enriched data
 * @returns {string} HTML row
 */
function buildHtmlRow(site) {
    const name = escapeHtml(site.name);
    const url = escapeHtml(site.url);
    const cats = extractNames(site.categories_array);
    const tags = extractNames(site.tags_array);
    const desc = escapeHtml(site.description);
    const fav = site.is_favorite ? '⭐' : '';
    const pin = site.is_pinned ? '📌' : '';

    return `<tr><td>${name}</td><td><a href="${url}">${url}</a></td><td>${cats}</td><td>${tags}</td><td>${desc}</td><td>${fav}</td><td>${pin}</td></tr>`;
}

/**
 * Convert sites to CSV format
 * @param {Array} sites - Sites array with enriched data
 * @returns {string} CSV content
 */
const convertToCSV = (sites) => {
    if (!sites || !Array.isArray(sites) || sites.length === 0) {
        return CSV_HEADERS + '\n';
    }

    const rows = sites.map(buildCsvRow);
    return [CSV_HEADERS, ...rows].join('\n');
};

/**
 * Convert sites to HTML format
 * @param {Array} sites - Sites array with enriched data
 * @returns {string} HTML content
 */
const convertToHTML = (sites) => {
    const rows = sites && Array.isArray(sites) && sites.length > 0
        ? sites.map(buildHtmlRow).join('')
        : '<tr><td colspan="7">No sites</td></tr>';

    const timestamp = new Date().toLocaleString();

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
    <p>Exported on: ${timestamp}</p>
    <table>
        <thead>
            <tr>
                ${HTML_TABLE_HEADERS.map(h => `<th>${h}</th>`).join('')}
            </tr>
        </thead>
        <tbody>
            ${rows}
        </tbody>
    </table>
</body>
</html>`;
};

/**
 * Fetch all sites for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Sites array
 */
async function fetchUserSites(userId) {
    const { data, error } = await supabase
        .from(SUPABASE_TABLES.SITES)
        .select('*')
        .eq('user_id', userId);

    if (error) {
        console.error('❌ Sites error:', error.message);
        throw error;
    }

    return data || [];
}

/**
 * Fetch categories used by sites
 * @param {Array} siteIds - Array of site IDs
 * @returns {Promise<Array>} Categories array
 */
async function fetchCategoriesForSites(siteIds) {
    if (!siteIds || siteIds.length === 0) return [];

    // Get category IDs from site_categories
    const { data: scData, error: scError } = await supabase
        .from(SUPABASE_TABLES.SITE_CATEGORIES)
        .select('category_id')
        .in('site_id', siteIds);

    if (scError) {
        console.error('❌ Site categories error:', scError.message);
        throw scError;
    }

    const categoryIds = getUniqueIds(scData, 'category_id');
    if (categoryIds.length === 0) return [];

    // Fetch actual categories
    const { data: categories, error: catError } = await supabase
        .from(SUPABASE_TABLES.CATEGORIES)
        .select('*')
        .in('id', categoryIds);

    if (catError) return [];
    return categories || [];
}

/**
 * Fetch tags used by sites
 * @param {Array} siteIds - Array of site IDs
 * @returns {Promise<Array>} Tags array
 */
async function fetchTagsForSites(siteIds) {
    if (!siteIds || siteIds.length === 0) return [];

    // Get tag IDs from site_tags
    const { data: stData, error: stError } = await supabase
        .from(SUPABASE_TABLES.SITE_TAGS)
        .select('tag_id')
        .in('site_id', siteIds);

    if (stError) {
        console.error('❌ Site tags error:', stError.message);
        throw stError;
    }

    const tagIds = getUniqueIds(stData, 'tag_id');
    if (tagIds.length === 0) return [];

    // Fetch actual tags
    const { data: tags, error: tagError } = await supabase
        .from(SUPABASE_TABLES.TAGS)
        .select('*')
        .in('id', tagIds);

    if (tagError) return [];
    return tags || [];
}

/**
 * Fetch site-category relationships
 * @param {Array} siteIds - Array of site IDs
 * @returns {Promise<Array>} Site-category relationships
 */
async function fetchSiteCategoryRelations(siteIds) {
    if (!siteIds || siteIds.length === 0) return [];

    const { data, error } = await supabase
        .from(SUPABASE_TABLES.SITE_CATEGORIES)
        .select('site_id, category_id')
        .in('site_id', siteIds);

    if (error) {
        console.error('❌ Site categories error:', error.message);
        throw error;
    }

    return data || [];
}

/**
 * Fetch site-tag relationships
 * @param {Array} siteIds - Array of site IDs
 * @returns {Promise<Array>} Site-tag relationships
 */
async function fetchSiteTagRelations(siteIds) {
    if (!siteIds || siteIds.length === 0) return [];

    const { data, error } = await supabase
        .from(SUPABASE_TABLES.SITE_TAGS)
        .select('site_id, tag_id')
        .in('site_id', siteIds);

    if (error) {
        console.error('❌ Site tags error:', error.message);
        throw error;
    }

    return data || [];
}

/**
 * Enrich sites with categories and tags
 * @param {Array} sites - Sites array
 * @param {Array} categories - Categories array
 * @param {Array} tags - Tags array
 * @param {Array} siteCategories - Site-category relationships
 * @param {Array} siteTags - Site-tag relationships
 * @returns {Array} Enriched sites
 */
function enrichSites(sites, categories, tags, siteCategories, siteTags) {
    return (sites || []).map(site => {
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
            tags_array: siteTgs,
        };
    });
}

/**
 * Get timestamp for filename
 * @returns {string} Date string in YYYY-MM-DD format
 */
function getTimestamp() {
    return new Date().toISOString().split('T')[0];
}

/**
 * Send CSV response
 * @param {Object} res - Response object
 * @param {Array} sites - Enriched sites
 */
function sendCsvResponse(res, sites) {
    const csv = convertToCSV(sites);
    const timestamp = getTimestamp();
    res.setHeader('Content-Type', CONTENT_TYPES.CSV);
    res.setHeader('Content-Disposition', `attachment; filename="sites-export-${timestamp}.csv"`);
    res.end(csv);
}

/**
 * Send HTML response
 * @param {Object} res - Response object
 * @param {Array} sites - Enriched sites
 */
function sendHtmlResponse(res, sites) {
    const html = convertToHTML(sites);
    const timestamp = getTimestamp();
    res.setHeader('Content-Type', CONTENT_TYPES.HTML);
    res.setHeader('Content-Disposition', `attachment; filename="sites-export-${timestamp}.html"`);
    res.end(html);
}

/**
 * Send JSON response
 * @param {Object} res - Response object
 * @param {Array} sites - Enriched sites
 * @param {Array} categories - Categories
 * @param {Array} tags - Tags
 */
function sendJsonResponse(res, sites, categories, tags) {
    const exportData = {
        version: EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        sites,
        categories,
        tags,
    };
    res.setHeader('Content-Type', CONTENT_TYPES.JSON);
    res.json(exportData);
}

// Main Handler

/**
 * Export API handler - exports sites in JSON, CSV, or HTML format
 * @param {Object} req - Next.js request
 * @param {Object} res - Next.js response
 */
export default async function handler(req, res) {
    // Check method
    if (req.method !== 'GET') {
        console.error('❌ Wrong method:', req.method);
        return res.status(HTTP_STATUS.METHOD_NOT_ALLOWED).json({
            error: ERROR_MESSAGES.METHOD_NOT_ALLOWED,
        });
    }

    // Check environment
    if (!SUPABASE_URL || !KEY) {
        console.error('❌ Missing Supabase config - URL:', !!SUPABASE_URL, 'Key:', !!KEY);
        return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
            error: ERROR_MESSAGES.MISSING_CONFIG,
            details: ERROR_MESSAGES.MISSING_CREDENTIALS,
        });
    }

    try {
        const userId = req.query.userId || req.headers['x-user-id'];
        const format = (req.query.format || EXPORT_FORMATS.JSON).toLowerCase();

        if (!userId) {
            console.error('❌ No userId provided');
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                error: ERROR_MESSAGES.USER_ID_REQUIRED,
            });
        }

        // Fetch all data
        const sites = await fetchUserSites(userId);
        const siteIds = getSiteIds(sites);

        const [categories, tags, siteCategories, siteTags] = await Promise.all([
            fetchCategoriesForSites(siteIds),
            fetchTagsForSites(siteIds),
            fetchSiteCategoryRelations(siteIds),
            fetchSiteTagRelations(siteIds),
        ]);

        // Enrich sites with relations
        const enrichedSites = enrichSites(sites, categories, tags, siteCategories, siteTags);

        // Send response based on format
        if (format === EXPORT_FORMATS.CSV) {
            return sendCsvResponse(res, enrichedSites);
        }

        if (format === EXPORT_FORMATS.HTML) {
            return sendHtmlResponse(res, enrichedSites);
        }

        // Default to JSON
        return sendJsonResponse(res, enrichedSites, categories, tags);
    } catch (error) {
        console.error('💥 Export error:', error.message);
        console.error('Stack:', error.stack);
        return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
            error: ERROR_MESSAGES.EXPORT_FAILED,
            message: error.message,
            type: error.constructor.name,
        });
    }
}
