/**
 * Export and Import utilities for sites data
 * Supports JSON, CSV, and HTML formats (including Notion exports)
 */

// Constants
const SUPPORTED_FORMATS = ['json', 'csv', 'html'];
const FILE_EXTENSIONS = {
    json: 'json',
    csv: 'csv',
    html: 'html'
};
const MIME_TYPES = {
    json: 'application/json',
    csv: 'text/csv',
    html: 'text/html'
};

// CSV delimiters
const CSV_DELIMITER = ',';
const MULTI_VALUE_DELIMITER = ';';

// Helper to generate filename with timestamp
function generateFilename(format, prefix = 'sites-export') {
    const timestamp = new Date().toISOString().split('T')[0];
    const ext = FILE_EXTENSIONS[format] || 'json';
    return `${prefix}-${timestamp}.${ext}`;
}

// Helper to download blob
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Export sites as JSON (default)
export async function exportSites(userId, format = 'json') {
    try {
        if (!SUPPORTED_FORMATS.includes(format)) {
            throw new Error(`Unsupported format: ${format}. Use one of: ${SUPPORTED_FORMATS.join(', ')}`);
        }

        const response = await fetch(`/api/export?userId=${userId}&format=${format}`);

        if (!response.ok) {
            throw new Error(`Export failed: ${response.statusText}`);
        }

        const filename = generateFilename(format);

        if (format === 'json') {
            const data = await response.json();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: MIME_TYPES.json });
            downloadBlob(blob, filename);
        } else {
            const blob = await response.blob();
            downloadBlob(blob, filename);
        }

        return { success: true };
    } catch (error) {
        console.error('Export error:', error);
        return { success: false, error: error.message };
    }
}

// Export sites as CSV
export async function exportSitesAsCSV(userId) {
    return exportSites(userId, 'csv');
}

// Export sites as HTML
export async function exportSitesAsHTML(userId) {
    return exportSites(userId, 'html');
}

// Parse import file - handles JSON, CSV, HTML
export async function parseImportFile(file) {
    const text = await file.text();
    const filename = file.name.toLowerCase();

    try {
        if (filename.endsWith('.json')) {
            const json = JSON.parse(text);
            // Handle both direct sites array and wrapped format
            const sites = json.sites || json.data || json;
            return { sites: Array.isArray(sites) ? sites : [sites] };
        } else if (filename.endsWith('.csv')) {
            return parseCSV(text);
        } else if (filename.endsWith('.html')) {
            return parseHTML(text);
        } else {
            throw new Error('Unsupported file format. Please use JSON, CSV, or HTML.');
        }
    } catch (error) {
        console.error('Parse error:', error);
        throw new Error(`Failed to parse file: ${error.message}`);
    }
}

// Helper to split multi-value fields
function splitMultiValue(value, delimiter = MULTI_VALUE_DELIMITER) {
    return value.split(delimiter).map(v => v.trim()).filter(Boolean);
}

// Helper to normalize header names
function normalizeHeader(header) {
    return header.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Parse CSV format
function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) throw new Error('Invalid CSV format - no headers');

    const headers = lines[0].split(CSV_DELIMITER).map(normalizeHeader);
    const sites = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(CSV_DELIMITER).map(v => v.trim());
        const site = {};

        headers.forEach((header, index) => {
            const value = values[index] || '';

            if (header === 'name' || header === 'title') {
                site.name = value;
            } else if (header === 'url' || header === 'link') {
                site.url = value;
            } else if (header === 'category' || header === 'categories') {
                site.categories = splitMultiValue(value).map(v => ({ name: v }));
            } else if (header === 'tags' || header === 'tag') {
                site.tags = splitMultiValue(value).map(v => ({ name: v }));
            } else if (header === 'description' || header === 'desc') {
                site.description = value;
            } else if (header === 'pricing' || header === 'price') {
                site.pricing = value.toLowerCase().replace(/\s+/g, '_');
            } else if (header === 'favorite' || header === 'isfavorite') {
                site.is_favorite = value === 'true' || value === '1' || value === 'yes';
            }
        });

        if (site.name || site.url) {
            sites.push(site);
        }
    }

    return { sites };
}

// Helper to create site object from table cells
function createSiteFromCells(cells, headers = []) {
    const site = {};

    cells.forEach((cell, idx) => {
        const header = headers[idx]?.toLowerCase() || '';
        const text = cell.textContent?.trim() || '';
        const link = cell.querySelector('a');
        const url = link?.href || '';
        const selectedValues = Array.from(cell.querySelectorAll('.selected-value'))
            .map(el => el.textContent?.trim())
            .filter(Boolean);

        if (header.includes('name') || header.includes('title') || idx === 0) {
            site.name = text || link?.textContent?.trim() || '';
            if (url && !site.url) site.url = url;
        } else if (header.includes('url') || header.includes('link')) {
            site.url = url || text;
        } else if (header.includes('categor')) {
            site.categories = selectedValues.length > 0
                ? selectedValues.map(v => ({ name: v }))
                : splitMultiValue(text, /[;,]/).map(v => ({ name: v }));
        } else if (header.includes('tag')) {
            site.tags = selectedValues.length > 0
                ? selectedValues.map(v => ({ name: v }))
                : splitMultiValue(text, /[;,]/).map(v => ({ name: v }));
        } else if (header.includes('pricing') || header.includes('price')) {
            site.pricing = text.toLowerCase().replace(/\s+/g, '_');
        } else if (header.includes('favorite')) {
            site.is_favorite = text === 'true' || text === '1' || text === 'yes' || text === '✓';
        } else if (header.includes('desc')) {
            site.description = text;
        }
    });

    return site;
}

// Parse HTML format (supports standard tables and Notion exports)
function parseHTML(htmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');
    const sites = [];

    // Try standard table format first
    const rows = doc.querySelectorAll('table tbody tr');
    if (rows.length > 0) {
        rows.forEach(row => {
            const cells = Array.from(row.querySelectorAll('td'));
            if (cells.length >= 2) {
                const site = createSiteFromCells(cells);
                if (site.name || site.url) {
                    sites.push(site);
                }
            }
        });

        if (sites.length > 0) return { sites };
    }

    // Try Notion database table format (collection-content)
    const notionRows = doc.querySelectorAll('.collection-content table tr');
    if (notionRows.length > 0) {
        const headerRow = notionRows[0];
        const headers = Array.from(headerRow.querySelectorAll('th, td')).map(cell =>
            cell.textContent?.trim().toLowerCase() || ''
        );

        for (let i = 1; i < notionRows.length; i++) {
            const cells = Array.from(notionRows[i].querySelectorAll('td'));
            if (cells.length >= 2) {
                const site = createSiteFromCells(cells, headers);
                if (site.name || site.url) {
                    sites.push(site);
                }
            }
        }

        if (sites.length > 0) return { sites };
    }

    // Try Notion page links format (when exported as page, not table)
    const pageLinks = doc.querySelectorAll('.link-to-page a, a.link-to-page');
    if (pageLinks.length > 0) {
        pageLinks.forEach(link => {
            const name = link.textContent?.trim();
            const url = link.href;
            if (name && url) {
                sites.push({ name, url });
            }
        });

        if (sites.length > 0) return { sites };
    }

    // Try bookmark format (Notion bookmarks)
    const bookmarks = doc.querySelectorAll('.bookmark');
    if (bookmarks.length > 0) {
        bookmarks.forEach(bookmark => {
            const title = bookmark.querySelector('.bookmark-title')?.textContent?.trim();
            const url = bookmark.href || bookmark.querySelector('a')?.href;
            const description = bookmark.querySelector('.bookmark-description')?.textContent?.trim();

            if (title || url) {
                sites.push({
                    name: title || url,
                    url: url || '',
                    description
                });
            }
        });

        if (sites.length > 0) return { sites };
    }

    // Try any links with valid URLs
    const allLinks = doc.querySelectorAll('a[href]');
    allLinks.forEach(link => {
        const href = link.href;
        // Skip internal/anchor links
        if (href && href.startsWith('http') && !href.includes('notion.so')) {
            const name = link.textContent?.trim() || href;
            if (!sites.some(s => s.url === href)) {
                sites.push({ name, url: href });
            }
        }
    });

    return { sites };
}

// Helper to convert site object to row format for API
function convertSiteToRow(site) {
    return {
        name: site.name || '',
        url: site.url || '',
        pricing: site.pricing || null,
        is_favorite: site.is_favorite || false,
        category: site.categories && Array.isArray(site.categories)
            ? site.categories.map(c => typeof c === 'string' ? c : c.name || '').join(MULTI_VALUE_DELIMITER)
            : (typeof site.categories === 'string' ? site.categories : ''),
        tag: site.tags && Array.isArray(site.tags)
            ? site.tags.map(t => typeof t === 'string' ? t : t.name || '').join(MULTI_VALUE_DELIMITER)
            : (typeof site.tags === 'string' ? site.tags : ''),
        created_at: site.created_at || null
    };
}

// Import sites to database
export async function importSites(sites, userId) {
    try {
        const rows = (sites || []).map(convertSiteToRow);

        // Import fetchAPI helper for authenticated requests
        const { fetchAPI } = await import('./supabase.js');
        
        const result = await fetchAPI('/import', {
            method: 'POST',
            body: JSON.stringify({
                rows,
                userId
            })
        });

        return { success: true, result };
    } catch (error) {
        console.error('Import error:', error);
        throw error;
    }
}
