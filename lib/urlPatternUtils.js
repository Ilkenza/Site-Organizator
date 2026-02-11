/**
 * Shared URL pattern matching utilities used by categorySuggestions and tagSuggestions.
 */

/**
 * Extract clean domain from URL.
 * @param {string} url
 * @returns {string}
 */
export function extractDomain(url) {
    try {
        const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
        return urlObj.hostname.replace('www.', '');
    } catch {
        const match = url.match(/(?:https?:\/\/)?(?:www\.)?([^/]+)/);
        return match ? match[1] : url;
    }
}

/**
 * Check if a pattern matches as a whole word/segment (not inside another word).
 * Patterns with dots or spaces use substring match; single words use segment-exact match.
 * @param {string} text
 * @param {string} pattern
 * @returns {boolean}
 */
export function matchesPattern(text, pattern) {
    if (pattern.includes('.') || pattern.includes(' ')) return text.includes(pattern);
    return text.split(/[\s/\-_.,:;?&=#+()|[\]{}]+/).some(seg => seg === pattern);
}

/**
 * Generic reverse-matching: check if any existing entity name appears in URL or title.
 * Used by both suggestCategories and suggestTags for user-created entity matching.
 * @param {Set} suggestions - Set to add matched names into
 * @param {Array} entities - Array of {id, name} objects
 * @param {string} domain
 * @param {string} lowerUrl
 * @param {string} lowerName
 */
export function reverseMatch(suggestions, entities, domain, lowerUrl, lowerName) {
    for (const ent of entities) {
        if (!ent?.name) continue;
        const name = ent.name.toLowerCase();
        if (name.length <= 2) continue;
        const words = name.split(/\s+/);
        const patterns = words.length > 1 ? [name, ...words.filter(w => w.length > 2)] : [name];
        for (const p of patterns) {
            if (matchesPattern(domain, p) || matchesPattern(lowerUrl, p) || matchesPattern(lowerName, p)) {
                suggestions.add(name);
                break;
            }
        }
    }
}

/**
 * Match suggestion names to existing entities, returning matched IDs.
 * @param {string[]} suggestionsArray
 * @param {Array} entities - Array of {id, name}
 * @returns {string[]} Array of matched entity IDs
 */
export function matchToExisting(suggestionsArray, entities) {
    return suggestionsArray
        .map(s => entities.find(e => e?.name?.toLowerCase() === s.toLowerCase()))
        .filter(Boolean)
        .map(e => e.id);
}
