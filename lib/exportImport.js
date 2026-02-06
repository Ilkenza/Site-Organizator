/**
 * Export and Import utilities for sites data
 * Supports JSON, CSV, and HTML formats (including Notion exports)
 */

import { fetchAPI } from './supabase.js';

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
// source: 'auto' | 'notion' | 'bookmarks' — hints which parser to prefer
export async function parseImportFile(file, source = 'auto') {
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
        } else if (filename.endsWith('.html') || filename.endsWith('.htm')) {
            if (source === 'bookmarks') {
                return parseBrowserBookmarks(text);
            } else if (source === 'notion') {
                return parseHTML(text);
            }
            // Auto-detect: check if it looks like browser bookmarks
            if (text.includes('NETSCAPE-Bookmark-file') || text.includes('<DL>') || text.includes('<dl>')) {
                return parseBrowserBookmarks(text);
            }
            return parseHTML(text);
        } else {
            throw new Error('Unsupported file format. Please use JSON, CSV, or HTML.');
        }
    } catch (error) {
        console.error('Parse error:', error);
        throw new Error(`Failed to parse file: ${error.message}`);
    }
}

// Valid pricing values (matches DB CHECK constraint)
const VALID_PRICING_MAP = {
    'fully_free': 'fully_free',
    'fullyfree': 'fully_free',
    'free': 'fully_free',
    'besplatno': 'fully_free',
    'freemium': 'freemium',
    'free_trial': 'free_trial',
    'freetrial': 'free_trial',
    'trial': 'free_trial',
    'paid': 'paid',
    'nesto_se_placa': 'paid',
    'nestoseplaca': 'paid',
    'placeno': 'paid',
    'premium': 'paid',
};

/**
 * Normalize pricing value to match DB CHECK constraint.
 * Returns one of: 'fully_free', 'freemium', 'free_trial', 'paid', or null.
 */
function normalizePricing(value) {
    if (!value) return null;
    const raw = value.toString().trim().toLowerCase();
    if (!raw) return null;
    const withUnder = raw.replace(/[\s-]+/g, '_');
    if (VALID_PRICING_MAP[withUnder]) return VALID_PRICING_MAP[withUnder];
    const flat = raw.replace(/[\s_-]+/g, '');
    if (VALID_PRICING_MAP[flat]) return VALID_PRICING_MAP[flat];
    if (/trial/i.test(raw)) return 'free_trial';
    if (/freemium/i.test(raw)) return 'freemium';
    if (/paid|premium|plac|money|cost/i.test(raw)) return 'paid';
    if (/free|besplatn|gratis/i.test(raw)) return 'fully_free';
    return null;
}

// Helper to split multi-value fields
function splitMultiValue(value, delimiter = MULTI_VALUE_DELIMITER) {
    if (!value) return [];
    if (delimiter instanceof RegExp) {
        return value.split(delimiter).map(v => v.trim()).filter(Boolean);
    }
    return value.split(delimiter).map(v => v.trim()).filter(Boolean);
}

// Helper to normalize header names
function normalizeHeader(header) {
    return header.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Proper CSV parser that handles quoted fields with commas, newlines, and escaped quotes.
 * Returns array of arrays (rows of cells).
 */
function parseCSVRows(csvText) {
    const rows = [];
    let current = [];
    let cell = '';
    let inQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
        const ch = csvText[i];
        const next = csvText[i + 1];

        if (inQuotes) {
            if (ch === '"' && next === '"') {
                // Escaped quote
                cell += '"';
                i++;
            } else if (ch === '"') {
                // End of quoted field
                inQuotes = false;
            } else {
                cell += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === ',') {
                current.push(cell.trim());
                cell = '';
            } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
                current.push(cell.trim());
                if (current.some(c => c.length > 0)) {
                    rows.push(current);
                }
                current = [];
                cell = '';
                if (ch === '\r') i++; // skip \n after \r
            } else {
                cell += ch;
            }
        }
    }
    // Last row
    if (cell || current.length > 0) {
        current.push(cell.trim());
        if (current.some(c => c.length > 0)) {
            rows.push(current);
        }
    }

    return rows;
}

// Parse CSV format — handles Notion CSV export and standard CSV
function parseCSV(csvText) {
    const allRows = parseCSVRows(csvText);
    if (allRows.length < 2) throw new Error('Invalid CSV format - no data rows');

    const rawHeaders = allRows[0];
    const headers = rawHeaders.map(normalizeHeader);
    const sites = [];

    for (let i = 1; i < allRows.length; i++) {
        const values = allRows[i];
        const site = {};

        headers.forEach((header, index) => {
            const value = (values[index] || '').trim();
            if (!value) return;

            // Name / Title / Resource (Notion uses "Resource")
            if (header === 'name' || header === 'title' || header === 'resource' || header === 'naziv') {
                site.name = value;
            }
            // URL / Link / Website
            else if (header === 'url' || header === 'link' || header === 'website' || header === 'href' || header === 'sajt') {
                site.url = value;
            }
            // Category / Categories
            else if (header === 'category' || header === 'categories' || header === 'kategorija' || header === 'kategorije') {
                site.categories = splitMultiValue(value, /[;,]/).map(v => ({ name: v }));
            }
            // Tags / Tag
            else if (header === 'tags' || header === 'tag' || header === 'oznake') {
                site.tags = splitMultiValue(value, /[;,]/).map(v => ({ name: v }));
            }
            // Description
            else if (header === 'description' || header === 'desc' || header === 'opis') {
                site.description = value;
            }
            // Pricing — Notion uses "Select" column for this
            else if (header === 'pricing' || header === 'price' || header === 'select' || header === 'cena') {
                site.pricing = normalizePricing(value);
            }
            // Favorite — Notion uses "Favorite?" or "Is Favorited?" with emoji ⭐
            else if (header === 'favorite' || header === 'isfavorite' || header === 'isfavorited' || header === 'omiljeno') {
                site.is_favorite = value === 'true' || value === '1' || value === 'yes' || value === 'Yes' || value === '⭐' || value === 'da';
            }
            // Created time (Notion exports this)
            else if (header === 'createdtime' || header === 'createdat' || header === 'created') {
                try {
                    const d = new Date(value);
                    if (!isNaN(d.getTime())) {
                        site.created_at = d.toISOString();
                    }
                } catch { /* ignore */ }
            }
        });

        // If no URL found, skip the row
        if (site.name || site.url) {
            sites.push(site);
        }
    }

    return { sites };
}

// Helper to detect if a string looks like a URL
function looksLikeUrl(text) {
    if (!text) return false;
    return /^https?:\/\//i.test(text.trim()) || /^www\./i.test(text.trim());
}

// Helper to create site object from table cells
function createSiteFromCells(cells, headers = []) {
    const site = {};
    const hasHeaders = headers.length > 0 && headers.some(h => h.length > 0);

    cells.forEach((cell, idx) => {
        const header = headers[idx]?.toLowerCase() || '';
        const text = cell.textContent?.trim() || '';
        const link = cell.querySelector('a');
        const url = link?.href || link?.getAttribute('href') || '';
        const selectedValues = Array.from(cell.querySelectorAll('.selected-value'))
            .map(el => el.textContent?.trim())
            .filter(Boolean);

        if (hasHeaders) {
            // Header-based mapping
            if (header.includes('name') || header.includes('title') || header.includes('ime') || header.includes('naziv')) {
                site.name = text || link?.textContent?.trim() || '';
                if (url && !site.url) site.url = url;
            } else if (header.includes('url') || header.includes('link') || header.includes('adres') || header.includes('website') || header.includes('sajt') || header.includes('href')) {
                site.url = url || text;
            } else if (header.includes('categor') || header.includes('kategorij')) {
                site.categories = selectedValues.length > 0
                    ? selectedValues.map(v => ({ name: v }))
                    : splitMultiValue(text, /[;,]/).map(v => ({ name: v }));
            } else if (header.includes('tag') || header.includes('oznaka')) {
                site.tags = selectedValues.length > 0
                    ? selectedValues.map(v => ({ name: v }))
                    : splitMultiValue(text, /[;,]/).map(v => ({ name: v }));
            } else if (header.includes('pricing') || header.includes('price') || header.includes('cena') || header.includes('cijena')) {
                site.pricing = text.toLowerCase().replace(/\s+/g, '_');
            } else if (header.includes('favorite') || header.includes('omilj')) {
                site.is_favorite = text === 'true' || text === '1' || text === 'yes' || text === '✓' || text === 'da';
            } else if (header.includes('desc') || header.includes('opis')) {
                site.description = text;
            } else if (!site.url && looksLikeUrl(text)) {
                // Fallback: if cell text looks like a URL, use it
                site.url = text;
            } else if (!site.url && url) {
                // Fallback: if cell has an <a> tag, capture the URL
                site.url = url;
            }
        } else {
            // No headers — use position + heuristic detection
            if (idx === 0) {
                // First column is usually name
                site.name = text || link?.textContent?.trim() || '';
                if (url && !site.url) site.url = url;
            } else if (looksLikeUrl(text)) {
                // Cell text looks like a URL
                site.url = text;
            } else if (url && !site.url) {
                // Cell has a link
                site.url = url;
                if (!site.name && link?.textContent?.trim()) {
                    site.name = link.textContent.trim();
                }
            } else if (idx === 1 && !site.url) {
                // Second column might be URL as text
                site.url = text;
            }
        }
    });

    // Final: if name looks like URL and we have no URL, swap
    if (!site.url && looksLikeUrl(site.name)) {
        site.url = site.name;
    }
    // If we have URL but no name, derive name from URL
    if (site.url && !site.name) {
        try {
            site.name = new URL(site.url).hostname.replace(/^www\./, '');
        } catch {
            site.name = site.url;
        }
    }

    return site;
}

// Extract table headers from a <table> element
function extractTableHeaders(table) {
    // Try <thead> first
    const thead = table.querySelector('thead');
    if (thead) {
        const headerCells = thead.querySelectorAll('th, td');
        if (headerCells.length > 0) {
            return Array.from(headerCells).map(c => c.textContent?.trim()?.toLowerCase() || '');
        }
    }
    // Fallback: first <tr> with <th> elements
    const firstRow = table.querySelector('tr');
    if (firstRow) {
        const ths = firstRow.querySelectorAll('th');
        if (ths.length > 0) {
            return Array.from(ths).map(c => c.textContent?.trim()?.toLowerCase() || '');
        }
    }
    return [];
}

// Parse HTML format (supports standard tables and Notion exports)
function parseHTML(htmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');
    const sites = [];

    // Try standard table format first
    const table = doc.querySelector('table');
    if (table) {
        const headers = extractTableHeaders(table);
        const hasHeaderRow = headers.length > 0;

        // Get data rows (skip header row if detected)
        const allRows = Array.from(table.querySelectorAll('tbody tr, tr'));
        const dataRows = hasHeaderRow ? allRows.filter(row => !row.querySelector('th')) : allRows;

        for (const row of dataRows) {
            const cells = Array.from(row.querySelectorAll('td'));
            if (cells.length >= 1) {
                const site = createSiteFromCells(cells, headers);
                if ((site.name || site.url) && site.url) {
                    sites.push(site);
                }
            }
        }

        if (sites.length > 0) return { sites };
    }

    // Try Notion database table format (collection-content)
    const notionTable = doc.querySelector('.collection-content table');
    const notionRows = notionTable
        ? notionTable.querySelectorAll('tr')
        : doc.querySelectorAll('.collection-content table tr');

    if (notionRows.length > 0) {
        const headerRow = notionRows[0];
        const headers = Array.from(headerRow.querySelectorAll('th, td')).map(cell =>
            cell.textContent?.trim().toLowerCase() || ''
        );

        for (let i = 1; i < notionRows.length; i++) {
            const cells = Array.from(notionRows[i].querySelectorAll('td'));
            if (cells.length >= 1) {
                const site = createSiteFromCells(cells, headers);
                if ((site.name || site.url) && site.url) {
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

// Parse browser bookmarks HTML (Chrome, Firefox, Edge, Safari export format)
// Handles nested <DL><DT><A> structure, maps folders → categories
function parseBrowserBookmarks(htmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');
    const sites = [];

    // Recursive function to walk the DL/DT tree
    function walkBookmarks(dlNode, folderPath = []) {
        if (!dlNode) return;
        const children = dlNode.children;
        let currentFolder = [...folderPath];

        for (let i = 0; i < children.length; i++) {
            const child = children[i];

            if (child.tagName === 'DT') {
                // Check if it's a folder (has H3) or a bookmark (has A)
                const h3 = child.querySelector(':scope > H3, :scope > h3');
                const anchor = child.querySelector(':scope > A, :scope > a');
                const subDL = child.querySelector(':scope > DL, :scope > dl');

                if (h3 && subDL) {
                    // It's a folder — recurse into it
                    const folderName = h3.textContent?.trim();
                    // Skip browser toolbar/menu folders
                    const skipFolders = ['bookmarks bar', 'bookmarks toolbar', 'other bookmarks', 'mobile bookmarks', 'bookmarks menu', 'toolbar', 'menu', 'unfiled bookmarks'];
                    if (folderName && !skipFolders.includes(folderName.toLowerCase())) {
                        walkBookmarks(subDL, [...currentFolder, folderName]);
                    } else {
                        walkBookmarks(subDL, currentFolder);
                    }
                } else if (anchor) {
                    const url = anchor.getAttribute('href') || anchor.href || '';
                    const name = anchor.textContent?.trim() || '';

                    // Skip non-http links (javascript:, place:, chrome:, about:, etc.)
                    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
                        const site = { name: name || url, url };

                        // Map folder path to categories
                        if (currentFolder.length > 0) {
                            site.categories = currentFolder.map(f => ({ name: f }));
                        }

                        // Extract add_date if available
                        const addDate = anchor.getAttribute('add_date');
                        if (addDate) {
                            const ts = parseInt(addDate, 10);
                            if (ts > 0) {
                                // Browser bookmarks use seconds since epoch
                                site.created_at = new Date(ts * 1000).toISOString();
                            }
                        }

                        sites.push(site);
                    }
                }
            } else if (child.tagName === 'DL') {
                // Stray DL without DT parent
                walkBookmarks(child, currentFolder);
            }
        }
    }

    // Start from all top-level DL elements
    const topDLs = doc.querySelectorAll('DL, dl');
    if (topDLs.length > 0) {
        // Usually the first DL is the root
        walkBookmarks(topDLs[0]);
    }

    if (sites.length === 0) {
        // Fallback: try finding any <a> with http links
        const allLinks = doc.querySelectorAll('a[href]');
        allLinks.forEach(link => {
            const href = link.getAttribute('href') || link.href || '';
            if (href.startsWith('http://') || href.startsWith('https://')) {
                const name = link.textContent?.trim() || href;
                if (!sites.some(s => s.url === href)) {
                    sites.push({ name, url: href });
                }
            }
        });
    }

    return { sites };
}

// Helper to convert site object to row format for API
// Default pricing when none is provided (bookmarks, incomplete CSV rows, etc.)
const DEFAULT_IMPORT_PRICING = 'freemium';

function convertSiteToRow(site) {
    // Normalize URL: add https:// if it starts with www.
    let url = (site.url || '').trim();
    if (url && /^www\./i.test(url)) {
        url = 'https://' + url;
    }

    const row = {
        name: site.name || '',
        url: url,
        pricing: site.pricing || DEFAULT_IMPORT_PRICING,
        is_favorite: site.is_favorite || false,
        is_pinned: site.is_pinned || false,
        category: site.categories && Array.isArray(site.categories)
            ? site.categories.map(c => typeof c === 'string' ? c : c.name || '').join(MULTI_VALUE_DELIMITER)
            : (typeof site.categories === 'string' ? site.categories : ''),
        tag: site.tags && Array.isArray(site.tags)
            ? site.tags.map(t => typeof t === 'string' ? t : t.name || '').join(MULTI_VALUE_DELIMITER)
            : (typeof site.tags === 'string' ? site.tags : ''),
        // Also handle categories_array and tags_array from export format
        categories_array: site.categories_array || null,
        tags_array: site.tags_array || null,
    };

    // Only include created_at when it has a value — sending null overrides DB DEFAULT
    if (site.created_at) {
        row.created_at = site.created_at;
    }

    return row;
}

/**
 * Deduplicate rows by URL, merging categories and tags from duplicates.
 * This is important for bookmark imports where the same URL can appear
 * in multiple folders.
 */
function deduplicateRows(rows) {
    const urlMap = new Map();
    for (const row of rows) {
        const key = row.url.toLowerCase().replace(/\/+$/, ''); // normalize trailing slash
        if (urlMap.has(key)) {
            const existing = urlMap.get(key);
            // Merge categories (semicolon-delimited)
            if (row.category) {
                const existingCats = new Set((existing.category || '').split(MULTI_VALUE_DELIMITER).map(s => s.trim()).filter(Boolean));
                const newCats = row.category.split(MULTI_VALUE_DELIMITER).map(s => s.trim()).filter(Boolean);
                newCats.forEach(c => existingCats.add(c));
                existing.category = Array.from(existingCats).join(MULTI_VALUE_DELIMITER);
            }
            // Merge tags
            if (row.tag) {
                const existingTags = new Set((existing.tag || '').split(MULTI_VALUE_DELIMITER).map(s => s.trim()).filter(Boolean));
                const newTags = row.tag.split(MULTI_VALUE_DELIMITER).map(s => s.trim()).filter(Boolean);
                newTags.forEach(t => existingTags.add(t));
                existing.tag = Array.from(existingTags).join(MULTI_VALUE_DELIMITER);
            }
            // Keep the first name if it's better
            if (!existing.name && row.name) existing.name = row.name;
            // Merge favorite/pinned (keep true if any duplicate is true)
            if (row.is_favorite) existing.is_favorite = true;
            if (row.is_pinned) existing.is_pinned = true;
        } else {
            urlMap.set(key, { ...row });
        }
    }
    return Array.from(urlMap.values());
}

// Import sites to database
export async function importSites(sites, userId) {
    try {
        const rows = (sites || [])
            .map(convertSiteToRow)
            .filter(r => r.url && r.url.startsWith('http'));

        // Deduplicate by URL (bookmarks often have same URL in multiple folders)
        const uniqueRows = deduplicateRows(rows);

        if (uniqueRows.length === 0) {
            throw new Error('No valid sites found with URLs. Make sure your file contains URLs.');
        }

        const result = await fetchAPI('/import', {
            method: 'POST',
            body: JSON.stringify({
                rows: uniqueRows,
                userId
            })
        });

        return { success: true, result };
    } catch (error) {
        console.error('Import error:', error);
        throw error;
    }
}
