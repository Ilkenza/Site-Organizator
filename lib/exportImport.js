/**
 * Export and Import utilities for sites data
 * Supports JSON, CSV, and HTML formats (including Notion exports)
 */

import { fetchAPI, getAccessToken } from './supabase.js';
import { extractDomain } from './urlPatternUtils.js';

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

        const token = getAccessToken();
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`/api/export?format=${format}`, { headers });

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
    const filename = file.name.toLowerCase();

    // PDF files need special handling (binary, not text)
    if (filename.endsWith('.pdf')) {
        const result = await parsePDFFile(file);
        return addUniqueStats(result);
    }

    const text = await file.text();

    try {
        let result;
        if (filename.endsWith('.json')) {
            const json = JSON.parse(text);
            // Handle both direct sites array and wrapped format
            const sites = json.sites || json.data || json;
            result = { sites: Array.isArray(sites) ? sites : [sites] };
        } else if (filename.endsWith('.csv')) {
            result = parseCSV(text);
        } else if (filename.endsWith('.html') || filename.endsWith('.htm')) {
            if (source === 'bookmarks') {
                result = parseBrowserBookmarks(text);
            } else if (source === 'notion') {
                result = parseHTML(text);
            } else {
                // Auto-detect: check if it looks like browser bookmarks
                if (text.includes('NETSCAPE-Bookmark-file') || text.includes('<DL>') || text.includes('<dl>')) {
                    result = parseBrowserBookmarks(text);
                } else {
                    result = parseHTML(text);
                }
            }
        } else {
            throw new Error('Unsupported file format. Please use JSON, CSV, HTML, or PDF.');
        }
        return addUniqueStats(result);
    } catch (error) {
        console.error('Parse error:', error);
        throw new Error(`Failed to parse file: ${error.message}`);
    }
}

// Add unique count and duplicates count to parse result
function addUniqueStats(result) {
    const sites = result.sites || [];
    const urlMap = new Map();
    const duplicateGroups = []; // Track which URLs are duplicated

    for (const site of sites) {
        const url = site.url?.trim();
        if (url && url.startsWith('http')) {
            const key = url.toLowerCase().replace(/\/+$/, '');
            if (!urlMap.has(key)) {
                urlMap.set(key, [site]);
            } else {
                urlMap.get(key).push(site);
            }
        }
    }

    // Find URLs with duplicates
    for (const [url, siteGroup] of urlMap.entries()) {
        if (siteGroup.length > 1) {
            duplicateGroups.push({
                url: siteGroup[0].url, // Original URL
                name: siteGroup[0].name || siteGroup[0].url,
                count: siteGroup.length,
                sites: siteGroup
            });
        }
    }

    const uniqueCount = urlMap.size;
    const duplicates = sites.length - uniqueCount;

    return { ...result, uniqueCount, duplicates, duplicateGroups };
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
            // Category / Categories - skip if it's a Notion date field
            else if ((header === 'category' || header === 'categories' || header === 'kategorija' || header === 'kategorije') &&
                !/^\w+\s+\d+,\s+\d{4}/.test(value)) {  // Skip dates like "November 29, 2024"
                site.categories = splitMultiValue(value, /[;,]/).map(v => ({ name: v }));
            }
            // Tags / Tag - Notion often uses comma-separated values in quotes
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
            // Skip Created time/Last edited time - these should not be used as name
            else if (header === 'createdtime' || header === 'createdat' || header === 'created' || header === 'lasteditedtime') {
                // Only use if it's a valid timestamp and not already set
                if (!site.created_at) {
                    try {
                        const d = new Date(value);
                        if (!isNaN(d.getTime())) {
                            site.created_at = d.toISOString();
                        }
                    } catch { /* ignore */ }
                }
            }
        });

        // Validate and ensure required fields
        // Skip rows without URL (likely Notion relation links, not actual sites)
        if (!site.url) {
            continue;
        }

        // If no name, try to extract from URL
        if (!site.name) {
            site.name = extractDomain(site.url) || site.url;
        }

        sites.push(site);
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
        site.name = extractDomain(site.url) || site.url;
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

// Parse PDF file — extract URLs from text content using pdf.js CDN
// Works for Notion PDF exports which contain clickable links
async function parsePDFFile(file) {
    // Dynamically load pdf.js from CDN
    if (typeof window !== 'undefined' && !window.pdfjsLib) {
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            script.onload = resolve;
            script.onerror = () => reject(new Error('Failed to load PDF parser library'));
            document.head.appendChild(script);
        });
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    const pdfjsLib = window.pdfjsLib;
    if (!pdfjsLib) throw new Error('PDF parser library not available');

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const sites = [];
    const urlRegex = /https?:\/\/[^\s,)>\]"']+/g;

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);

        // Try to extract links from annotations (clickable links)
        try {
            const annotations = await page.getAnnotations();
            for (const annot of annotations) {
                if (annot.subtype === 'Link' && annot.url) {
                    const url = annot.url.trim();
                    if (url.startsWith('http') && !sites.some(s => s.url === url)) {
                        sites.push({ name: url, url });
                    }
                }
            }
        } catch (_e) { /* ignore annotation errors */ }

        // Also extract URLs from text content
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');

        // Find all URLs in text
        const matches = pageText.match(urlRegex) || [];
        for (const rawUrl of matches) {
            // Clean trailing punctuation
            const url = rawUrl.replace(/[.,;:!?)]+$/, '');
            if (url.startsWith('http') && !sites.some(s => s.url === url)) {
                // Try to find a name — check if there's text before the URL
                sites.push({ name: url, url });
            }
        }
    }

    if (sites.length === 0) {
        throw new Error('No URLs found in the PDF. Make sure the PDF contains clickable links or URLs.');
    }

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
                    const skipFolders = ['bookmarks', 'bookmarks bar', 'bookmarks toolbar', 'other bookmarks', 'mobile bookmarks', 'bookmarks menu', 'toolbar', 'menu', 'unfiled bookmarks', 'favorites', 'favorites bar'];
                    if (folderName && !skipFolders.includes(folderName.toLowerCase())) {
                        walkBookmarks(subDL, [...currentFolder, folderName]);
                    } else {
                        walkBookmarks(subDL, currentFolder);
                    }
                } else if (h3 && !subDL) {
                    // HTML5 parser may place <DL> as next sibling of <DT> rather than child.
                    // Look for a sibling DL immediately following this DT.
                    const nextSib = child.nextElementSibling;
                    if (nextSib && nextSib.tagName === 'DL') {
                        const folderName = h3.textContent?.trim();
                        const skipFolders = ['bookmarks', 'bookmarks bar', 'bookmarks toolbar', 'other bookmarks', 'mobile bookmarks', 'bookmarks menu', 'toolbar', 'menu', 'unfiled bookmarks', 'favorites', 'favorites bar'];
                        if (folderName && !skipFolders.includes(folderName.toLowerCase())) {
                            walkBookmarks(nextSib, [...currentFolder, folderName]);
                        } else {
                            walkBookmarks(nextSib, currentFolder);
                        }
                        // Mark sibling DL as handled so the stray-DL handler skips it
                        nextSib._handled = true;
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
                // Stray DL without DT parent (skip if already handled as sibling fallback)
                if (!child._handled) {
                    walkBookmarks(child, currentFolder);
                }
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

            // Merge categories (semicolon-delimited string)
            if (row.category) {
                const existingCats = new Set((existing.category || '').split(MULTI_VALUE_DELIMITER).map(s => s.trim()).filter(Boolean));
                const newCats = row.category.split(MULTI_VALUE_DELIMITER).map(s => s.trim()).filter(Boolean);
                newCats.forEach(c => existingCats.add(c));
                existing.category = Array.from(existingCats).join(MULTI_VALUE_DELIMITER);
            }

            // Merge categories_array (from export format)
            if (row.categories_array && Array.isArray(row.categories_array)) {
                if (!existing.categories_array) existing.categories_array = [];
                const catMap = new Map();
                [...existing.categories_array, ...row.categories_array].forEach(cat => {
                    const key = (cat?.name || '').toLowerCase();
                    if (key && !catMap.has(key)) {
                        catMap.set(key, cat);
                    }
                });
                existing.categories_array = Array.from(catMap.values());
            }

            // Merge tags (semicolon-delimited string)
            if (row.tag) {
                const existingTags = new Set((existing.tag || '').split(MULTI_VALUE_DELIMITER).map(s => s.trim()).filter(Boolean));
                const newTags = row.tag.split(MULTI_VALUE_DELIMITER).map(s => s.trim()).filter(Boolean);
                newTags.forEach(t => existingTags.add(t));
                existing.tag = Array.from(existingTags).join(MULTI_VALUE_DELIMITER);
            }

            // Merge tags_array (from export format)
            if (row.tags_array && Array.isArray(row.tags_array)) {
                if (!existing.tags_array) existing.tags_array = [];
                const tagMap = new Map();
                [...existing.tags_array, ...row.tags_array].forEach(tag => {
                    const key = (tag?.name || '').toLowerCase();
                    if (key && !tagMap.has(key)) {
                        tagMap.set(key, tag);
                    }
                });
                existing.tags_array = Array.from(tagMap.values());
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
// Sends rows in chunks to avoid serverless function timeouts (Netlify 10-26s limit).
// Each chunk is a separate API call; results are accumulated across all chunks.
// Optional onProgress callback receives { current, total, created, errors, elapsedMs, etaMs }.
// options.useFoldersAsCategories — when false, strip categories from bookmark rows.
// options.importSource — 'bookmarks' | 'notion' | null — attaches source tag to sites.
export async function importSites(sites, userId, onProgress = null, options = {}) {
    const { useFoldersAsCategories = true, importSource = null, signal = null } = options;

    try {
        let rows = (sites || [])
            .map(convertSiteToRow)
            .filter(r => r.url && r.url.startsWith('http'));

        // When user opted out of folders→categories, clear category fields
        if (!useFoldersAsCategories) {
            rows = rows.map(r => ({ ...r, category: '', categories_array: null }));
        }

        // Deduplicate by URL (bookmarks often have same URL in multiple folders)
        const uniqueRows = deduplicateRows(rows);

        if (uniqueRows.length === 0) {
            throw new Error('No valid sites found with URLs. Make sure your file contains URLs.');
        }

        // Split into chunks and send each as a separate API call
        const CHUNK_SIZE = 200;
        const totalChunks = Math.ceil(uniqueRows.length / CHUNK_SIZE);
        const mergedReport = { created: [], updated: [], skipped: [], errors: [], categoriesCreated: 0, tagsCreated: 0 };
        const startTime = Date.now();

        for (let c = 0; c < totalChunks; c++) {
            // Check if import was cancelled
            if (signal?.aborted) {
                return { success: true, cancelled: true, result: { report: mergedReport } };
            }

            const chunk = uniqueRows.slice(c * CHUNK_SIZE, (c + 1) * CHUNK_SIZE);

            try {
                const result = await fetchAPI('/import', {
                    method: 'POST',
                    body: JSON.stringify({
                        rows: chunk,
                        userId,
                        importSource: importSource || undefined
                    }),
                    signal: signal || undefined
                });

                const report = result?.report || {};
                if (report.created) mergedReport.created.push(...report.created);
                if (report.updated) mergedReport.updated.push(...report.updated);
                if (report.skipped) mergedReport.skipped.push(...report.skipped);
                if (report.errors) mergedReport.errors.push(...report.errors);
                if (report.categoriesCreated) mergedReport.categoriesCreated += report.categoriesCreated;
                if (report.tagsCreated) mergedReport.tagsCreated += report.tagsCreated;

                // Propagate tier limit info
                if (report.tierLimited) {
                    mergedReport.tierLimited = true;
                    mergedReport.tierLabel = report.tierLabel;
                    // Accumulate tier message (first one wins, or last for sites)
                    if (report.tierMessage) {
                        mergedReport.tierMessage = report.tierMessage;
                    }
                    // Only stop sending chunks if SITE limit was hit
                    if (report.siteLimitReached) {
                        break;
                    }
                }
            } catch (chunkErr) {
                // If aborted, return immediately with partial results
                if (chunkErr.name === 'AbortError') {
                    return { success: true, cancelled: true, result: { report: mergedReport } };
                }
                // Record chunk-level error but continue with remaining chunks
                mergedReport.errors.push({
                    row: c * CHUNK_SIZE,
                    error: `Chunk ${c + 1}/${totalChunks} failed: ${chunkErr.message}`
                });
            }

            // Report progress with time estimation
            if (onProgress) {
                const elapsedMs = Date.now() - startTime;
                const msPerChunk = elapsedMs / (c + 1);
                const remainingChunks = totalChunks - (c + 1);
                const etaMs = Math.round(msPerChunk * remainingChunks);

                onProgress({
                    current: c + 1,
                    total: totalChunks,
                    created: mergedReport.created.length,
                    errors: mergedReport.errors.length,
                    elapsedMs,
                    etaMs
                });
            }
        }

        return { success: true, result: { report: mergedReport } };
    } catch (error) {
        console.error('Import error:', error);
        throw error;
    }
}
