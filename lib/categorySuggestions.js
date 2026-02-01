/**
 * Smart category suggestions based on URL domain and title
 */

const domainPatterns = {
    // Work & Professional
    'work': ['slack', 'notion', 'asana', 'trello', 'monday', 'jira', 'confluence', 'teams', 'zoom', 'meet', 'calendar', 'docs', 'sheets', 'drive'],

    // Development & Tech
    'development': ['github', 'gitlab', 'bitbucket', 'stackoverflow', 'stackexchange', 'npmjs', 'pypi', 'docker', 'kubernetes', 'aws', 'azure', 'vercel', 'netlify', 'heroku', 'digitalocean', 'codepen', 'codesandbox', 'replit'],

    // Education & Learning
    'education': ['udemy', 'coursera', 'edx', 'khanacademy', 'skillshare', 'pluralsight', 'linkedin learning', 'masterclass', 'brilliant', 'duolingo', 'memrise', 'quizlet', 'codecademy', 'freecodecamp'],

    // Social Media
    'social': ['twitter', 'facebook', 'instagram', 'linkedin', 'reddit', 'pinterest', 'tiktok', 'snapchat', 'discord', 'telegram', 'whatsapp', 'mastodon'],

    // Entertainment
    'entertainment': ['youtube', 'netflix', 'spotify', 'twitch', 'hulu', 'disney', 'hbo', 'amazon prime', 'soundcloud', 'bandcamp', 'vimeo', 'dailymotion'],

    // Shopping & E-commerce
    'shopping': ['amazon', 'ebay', 'etsy', 'shopify', 'aliexpress', 'walmart', 'target', 'bestbuy', 'newegg', 'zalando', 'asos'],

    // News & Media
    'news': ['medium', 'substack', 'news', 'bbc', 'cnn', 'reuters', 'techcrunch', 'theverge', 'wired', 'ars technica', 'hackernews'],

    // Finance
    'finance': ['paypal', 'stripe', 'bank', 'investing', 'robinhood', 'coinbase', 'binance', 'revolut', 'wise', 'mint', 'personal capital'],

    // Design & Creative
    'design': ['figma', 'sketch', 'adobe', 'canva', 'dribbble', 'behance', 'unsplash', 'pexels', 'flaticon', 'fontawesome', 'google fonts'],

    // Documentation
    'documentation': ['docs', 'wiki', 'documentation', 'readme', 'guide', 'manual', 'reference'],

    // Tools & Utilities
    'tools': ['google', 'translate', 'calendar', 'maps', 'analytics', 'search', 'mail', 'gmail', 'outlook', 'proton'],
};

const titleKeywords = {
    'work': ['work', 'job', 'office', 'professional', 'business', 'corporate', 'enterprise'],
    'development': ['code', 'programming', 'developer', 'api', 'framework', 'library', 'tutorial', 'documentation', 'repo', 'git'],
    'education': ['learn', 'course', 'tutorial', 'education', 'training', 'study', 'lesson', 'class', 'school', 'university'],
    'social': ['social', 'community', 'forum', 'chat', 'messaging', 'network'],
    'entertainment': ['video', 'music', 'stream', 'watch', 'listen', 'play', 'game', 'gaming'],
    'shopping': ['shop', 'buy', 'store', 'market', 'cart', 'product', 'deal', 'sale'],
    'news': ['news', 'article', 'blog', 'post', 'read', 'story', 'magazine'],
    'finance': ['finance', 'money', 'payment', 'crypto', 'invest', 'trading', 'stock'],
    'design': ['design', 'creative', 'art', 'graphic', 'ui', 'ux', 'icon', 'font'],
    'tools': ['tool', 'utility', 'converter', 'generator', 'calculator', 'helper'],
};

/**
 * Suggest categories based on URL and title
 * @param {string} url - The site URL
 * @param {string} name - The site name/title
 * @param {Array} existingCategories - Array of existing categories with {id, name} structure
 * @returns {Array} Array of suggested category IDs
 */
export function suggestCategories(url, name = '', existingCategories = []) {
    if (!url) return [];

    const suggestions = new Set();
    const lowerUrl = url.toLowerCase();
    const lowerName = name.toLowerCase();

    // Extract domain
    let domain = '';
    try {
        const urlObj = new URL(url);
        domain = urlObj.hostname.replace('www.', '');
    } catch (e) {
        domain = lowerUrl;
    }

    // Check domain patterns
    for (const [category, patterns] of Object.entries(domainPatterns)) {
        for (const pattern of patterns) {
            if (domain.includes(pattern) || lowerUrl.includes(pattern)) {
                suggestions.add(category);
                break;
            }
        }
    }

    // Check title keywords
    if (name) {
        for (const [category, keywords] of Object.entries(titleKeywords)) {
            for (const keyword of keywords) {
                if (lowerName.includes(keyword)) {
                    suggestions.add(category);
                    break;
                }
            }
        }
    }

    // Match suggestions with existing categories (case-insensitive)
    const matchedCategories = [];
    const suggestionsArray = Array.from(suggestions);

    for (const suggestion of suggestionsArray) {
        const matchedCategory = existingCategories.find(
            cat => cat.name.toLowerCase() === suggestion.toLowerCase()
        );
        if (matchedCategory) {
            matchedCategories.push(matchedCategory.id);
        }
    }

    return {
        categoryIds: matchedCategories,
        suggestions: suggestionsArray, // Raw category names for creating new ones
    };
}

/**
 * Get category name suggestions (for creating new categories)
 * @param {string} url - The site URL
 * @param {string} name - The site name/title
 * @returns {Array} Array of suggested category names
 */
export function getCategoryNameSuggestions(url, name = '') {
    if (!url) return [];

    const suggestions = new Set();
    const lowerUrl = url.toLowerCase();
    const lowerName = name.toLowerCase();

    // Extract domain
    let domain = '';
    try {
        const urlObj = new URL(url);
        domain = urlObj.hostname.replace('www.', '');
    } catch (e) {
        domain = lowerUrl;
    }

    // Check domain patterns
    for (const [category, patterns] of Object.entries(domainPatterns)) {
        for (const pattern of patterns) {
            if (domain.includes(pattern) || lowerUrl.includes(pattern)) {
                suggestions.add(category);
                break;
            }
        }
    }

    // Check title keywords
    if (name) {
        for (const [category, keywords] of Object.entries(titleKeywords)) {
            for (const keyword of keywords) {
                if (lowerName.includes(keyword)) {
                    suggestions.add(category);
                    break;
                }
            }
        }
    }

    // Capitalize suggestions
    return Array.from(suggestions).map(s =>
        s.charAt(0).toUpperCase() + s.slice(1)
    );
}
