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
        const response = await fetch(`/api/export?userId=${userId}&format=${format}`);

        if (!response.ok) {
            throw new Error(`Export failed: ${response.statusText}`);
        }

        const timestamp = new Date().toISOString().split('T')[0];
        const ext = format === 'csv' ? 'csv' : format === 'html' ? 'html' : 'json';
        const filename = `sites-export-${timestamp}.${ext}`;

        if (format === 'json') {
            const data = await response.json();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
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

// Parse CSV format
function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) throw new Error('Invalid CSV format - no headers');

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const sites = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const site = {};

        headers.forEach((header, index) => {
            const value = values[index] || '';
            if (header === 'name' || header === 'title') site.name = value;
            else if (header === 'url' || header === 'link') site.url = value;
            else if (header === 'category') {
                site.categories = value.split(';').map(v => ({ name: v.trim() })).filter(c => c.name);
            }
            else if (header === 'tags' || header === 'tag') {
                site.tags = value.split(';').map(v => ({ name: v.trim() })).filter(t => t.name);
            }
            else if (header === 'description' || header === 'desc') site.description = value;
        });

        if (site.name || site.url) {
            sites.push(site);
        }
    }

    return { sites };
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
            const cells = row.querySelectorAll('td');
            if (cells.length >= 2) {
                const site = {
                    name: cells[0]?.textContent?.trim() || '',
                    url: cells[1]?.textContent?.trim() || '',
                };

                if (cells[2]) {
                    site.categories = cells[2]?.textContent?.trim()
                        .split(';')
                        .map(v => ({ name: v.trim() }))
                        .filter(c => c.name);
                }

                if (cells[3]) {
                    site.tags = cells[3]?.textContent?.trim()
                        .split(';')
                        .map(v => ({ name: v.trim() }))
                        .filter(t => t.name);
                }

                if (cells[4]) {
                    site.description = cells[4]?.textContent?.trim() || '';
                }

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
        // Get headers from first row
        const headerRow = notionRows[0];
        const headers = Array.from(headerRow.querySelectorAll('th, td')).map(cell =>
            cell.textContent?.trim().toLowerCase() || ''
        );

        // Process data rows
        for (let i = 1; i < notionRows.length; i++) {
            const cells = notionRows[i].querySelectorAll('td');
            if (cells.length >= 2) {
                const site = {};

                cells.forEach((cell, idx) => {
                    const header = headers[idx] || '';
                    const text = cell.textContent?.trim() || '';

                    // Get URL from link if exists
                    const link = cell.querySelector('a');
                    const url = link?.href || '';

                    // Get multi-select values (Notion uses .selected-value class)
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
                            : text.split(/[;,]/).map(v => ({ name: v.trim() })).filter(c => c.name);
                    } else if (header.includes('tag')) {
                        site.tags = selectedValues.length > 0
                            ? selectedValues.map(v => ({ name: v }))
                            : text.split(/[;,]/).map(v => ({ name: v.trim() })).filter(t => t.name);
                    } else if (header.includes('pricing') || header.includes('price')) {
                        site.pricing = text.toLowerCase().replace(/\s+/g, '_');
                    } else if (header.includes('desc')) {
                        site.description = text;
                    }
                });

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

// Import sites to database
export async function importSites(sites, userId) {
    try {
        // Convert sites array to rows format expected by /api/import
        // Format: { name, url, pricing, category, tag, created_at }
        const rows = (sites || []).map(site => ({
            name: site.name || '',
            url: site.url || '',
            pricing: site.pricing || null,
            category: site.categories && Array.isArray(site.categories)
                ? site.categories.map(c => typeof c === 'string' ? c : c.name || '').join(';')
                : (typeof site.categories === 'string' ? site.categories : ''),
            tag: site.tags && Array.isArray(site.tags)
                ? site.tags.map(t => typeof t === 'string' ? t : t.name || '').join(';')
                : (typeof site.tags === 'string' ? site.tags : ''),
            created_at: site.created_at || null
        }));

        const response = await fetch('/api/import', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                rows,
                userId
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Import failed');
        }

        const result = await response.json();
        return { success: true, result };
    } catch (error) {
        console.error('Import error:', error);
        throw error;
    }
}
