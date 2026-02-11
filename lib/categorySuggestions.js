/**
 * Smart category suggestions based on URL domain and title
 */

import { extractDomain, matchesPattern, reverseMatch, matchToExisting } from './urlPatternUtils';

const domainPatterns = {
    // Work & Professional
    'work': ['slack', 'notion', 'asana', 'trello', 'monday', 'jira', 'confluence', 'teams', 'zoom', 'meet', 'clickup', 'basecamp', 'airtable', 'coda', 'workday', 'salesforce', 'hubspot', 'zendesk', 'intercom', 'freshworks', 'linear', 'height', 'shortcut', 'twist', 'loom', 'miro', 'figjam'],

    // Development & Tech
    'development': ['github', 'gitlab', 'bitbucket', 'stackoverflow', 'stackexchange', 'npmjs', 'pypi', 'docker', 'kubernetes', 'aws', 'azure', 'vercel', 'netlify', 'heroku', 'digitalocean', 'codepen', 'codesandbox', 'replit', 'railway', 'render', 'fly.io', 'cloudflare', 'linode', 'vultr', 'postman', 'insomnia', 'graphql', 'apollo', 'supabase', 'planetscale', 'mongodb', 'redis', 'postgres', 'dev.to', 'hashnode', 'glitch', 'gitpod', 'codespaces', 'sourcegraph', 'tabnine', 'codeium', 'cursor', 'copilot', 'clerk', 'auth0', 'okta', 'firebase', 'pocketbase', 'appwrite', 'convex', 'neon', 'turso', 'xata'],

    // Education & Learning
    'education': ['udemy', 'coursera', 'edx', 'khanacademy', 'skillshare', 'pluralsight', 'linkedin learning', 'masterclass', 'brilliant', 'duolingo', 'memrise', 'quizlet', 'codecademy', 'freecodecamp', 'scrimba', 'treehouse', 'datacamp', 'frontend masters', 'egghead', 'laracasts', 'levelup', 'educative', 'udacity', 'testdome', 'exercism', 'codewars', 'hackerrank', 'leetcode', 'topcoder', 'codechef', 'codeforces', 'atcoder'],

    // Social Media
    'social': ['twitter', 'facebook', 'instagram', 'linkedin', 'reddit', 'pinterest', 'tiktok', 'snapchat', 'discord', 'telegram', 'whatsapp', 'mastodon', 'bluesky', 'threads', 'x.com', 'clubhouse', 'signal', 'viber', 'wechat', 'line', 'nextdoor', 'meetup', 'eventbrite'],

    // Entertainment
    'entertainment': ['youtube', 'netflix', 'spotify', 'twitch', 'hulu', 'disney', 'hbo', 'amazon prime', 'soundcloud', 'bandcamp', 'vimeo', 'dailymotion', 'crunchyroll', 'funimation', 'peacock', 'paramount', 'apple music', 'tidal', 'deezer', 'pandora', 'steam', 'epic games', 'gog', 'itch.io', 'roblox', 'minecraft', 'fortnite', 'playstation', 'xbox', 'nintendo', 'apple tv', 'plex', 'jellyfin', 'emby', 'kodi'],

    // Shopping & E-commerce
    'shopping': ['amazon', 'ebay', 'etsy', 'shopify', 'aliexpress', 'walmart', 'target', 'bestbuy', 'newegg', 'zalando', 'asos', 'wish', 'shein', 'temu', 'wayfair', 'overstock', 'ikea', 'home depot', 'lowes', 'mercari', 'poshmark', 'depop', 'woocommerce', 'bigcommerce', 'magento', 'prestashop', 'opencart', 'stripe', 'gumroad', 'lemonsqueezy', 'paddle'],

    // News & Media
    'news': ['medium', 'substack', 'news', 'bbc', 'cnn', 'reuters', 'techcrunch', 'theverge', 'wired', 'ars technica', 'hackernews', 'engadget', 'gizmodo', 'cnet', 'mashable', 'venturebeat', 'axios', 'bloomberg', 'forbes', 'wsj', 'nytimes', 'guardian', 'hacker news', 'lobsters', 'slashdot', 'producthunt', 'betalist', 'indie hackers', 'smashing magazine', 'css-tricks', 'a list apart'],

    // Finance
    'finance': ['paypal', 'bank', 'investing', 'robinhood', 'coinbase', 'binance', 'revolut', 'wise', 'mint', 'personal capital', 'kraken', 'gemini', 'crypto.com', 'etoro', 'webull', 'fidelity', 'vanguard', 'schwab', 'cash app', 'venmo', 'square', 'klarna', 'affirm', 'plaid', 'yodlee', 'quickbooks', 'xero', 'freshbooks', 'wave', 'expensify', 'concur', 'ramp', 'brex'],

    // Design & Creative
    'design': ['figma', 'sketch', 'adobe', 'canva', 'dribbble', 'behance', 'unsplash', 'pexels', 'flaticon', 'fontawesome', 'fonts.google', 'google fonts', 'framer', 'webflow', 'invision', 'whimsical', 'lucidchart', 'procreate', 'affinity', 'pixlr', 'remove.bg', 'photopea', 'spline', 'rive', 'lottiefiles', 'iconify', 'heroicons', 'phosphor', 'lucide', 'tabler', 'feather', 'coolors', 'colorhunt', 'uigradients', 'meshgradient'],

    // Fonts & Typography
    'fonts': ['fontawesome', 'fonts.google', 'google fonts', 'fontshare', 'fontsquirrel', 'font squirrel', 'fontsource', 'fontjoy', 'fontpair', 'typewolf', 'fontsinuse', 'myfonts', 'dafont', 'fontspace', 'fontstruct', 'fontbundles', 'fontspring', 'typekit', 'adobe fonts', 'fontcdn', 'typescale', 'fontflame', 'wordmark', 'fontarena', 'befonts', 'unblast'],

    // Documentation
    'documentation': ['docs', 'wiki', 'documentation', 'readme', 'guide', 'manual', 'reference', 'gitbook', 'readme.so', 'docusaurus', 'vuepress', 'docsify', 'mkdocs', 'sphinx', 'swagger', 'openapi', 'mintlify', 'nextra', 'starlight', 'astro', 'mdx', 'notion', 'confluence', 'archbee', 'document360'],

    // Tools & Utilities
    'tools': ['translate', 'calendar', 'maps', 'analytics', 'gmail', 'outlook', 'proton', 'grammarly', 'hemingway', 'pastebin', 'jsonlint', 'regex101', 'crontab', 'carbon', 'ray.so', 'excalidraw', 'tldraw', 'squoosh', 'tinypng', 'convertio', 'notion calendar', 'calendly', 'cal.com', 'doodle', 'when2meet', 'shorturl', 'bitly', 'tinyurl', 'rebrandly', 'buffer', 'hootsuite', 'zapier', 'make', 'n8n', 'ifttt'],

    // Health & Fitness
    'health': ['fitbit', 'myfitnesspal', 'strava', 'nike run club', 'peloton', 'headspace', 'calm', 'meditation', 'yoga', 'noom', 'lose it', 'cronometer', 'whoop', 'garmin', 'polar', 'healthline', 'webmd', 'mayo clinic', 'medscape', 'flo', 'clue', 'apple health', 'google fit', 'samsung health', 'zepp', 'huawei health'],

    // Travel
    'travel': ['airbnb', 'booking', 'expedia', 'tripadvisor', 'kayak', 'skyscanner', 'hotels.com', 'agoda', 'vrbo', 'hostelworld', 'couchsurfing', 'rome2rio', 'seat61', 'atlas obscura', 'lonely planet', 'airbnb experiences', 'viator', 'getyourguide', 'uber', 'lyft', 'bolt', 'grab', 'ola', 'maps.me', 'citymapper'],

    // Food & Cooking
    'food': ['allrecipes', 'food network', 'tasty', 'epicurious', 'serious eats', 'bon appetit', 'cooking', 'baking', 'recipe', 'kitchen', 'chef', 'delicious', 'yummly', 'cookpad', 'food52', 'budgetbytes', 'minimalist baker', 'pinch of yum', 'smitten kitchen', 'doordash', 'ubereats', 'grubhub', 'deliveroo', 'just eat', 'zomato', 'swiggy', 'yelp', 'opentable'],

    // Photography
    'photography': ['500px', 'flickr', 'smugmug', 'photobucket', 'imgur', 'lightroom', 'capture one', 'darktable', 'rawtherapee', 'luminar', 'topaz', 'on1', 'dxo', 'viewbug', 'gurushots', 'photocrowd', 'eyeem', 'shutterstock', 'getty images', 'adobe stock', 'istock', 'depositphotos', 'dreamstime', 'alamy'],

    // AI & Machine Learning
    'ai': ['openai', 'chatgpt', 'claude', 'anthropic', 'midjourney', 'stable diffusion', 'dall-e', 'hugging face', 'replicate', 'runpod', 'together.ai', 'cohere', 'ai21', 'perplexity', 'you.com', 'phind', 'cursor', 'copilot', 'tabnine', 'codeium', 'tensorflow', 'pytorch', 'keras', 'fastai', 'langchain', 'llamaindex', 'weights & biases', 'roboflow', 'scale.ai', 'labelbox'],

    // Security & Privacy
    'security': ['lastpass', '1password', 'bitwarden', 'dashlane', 'keepass', 'nordvpn', 'expressvpn', 'protonvpn', 'mullvad', 'tailscale', 'wireguard', 'openvpn', 'malwarebytes', 'kaspersky', 'bitdefender', 'norton', 'mcafee', 'avast', 'avg', 'eset', 'trend micro', 'cloudflare warp', 'privacytools', 'privacy guides', 'have i been pwned', 'virustotal', 'shodan', 'censys', 'securityheaders', 'ssllabs'],

    // Marketing & SEO
    'marketing': ['mailchimp', 'hubspot', 'marketo', 'pardot', 'activecampaign', 'convertkit', 'sendgrid', 'sendinblue', 'constant contact', 'drip', 'klaviyo', 'omnisend', 'google ads', 'facebook ads', 'linkedin ads', 'twitter ads', 'semrush', 'ahrefs', 'moz', 'screaming frog', 'majestic', 'spyfu', 'similarweb', 'alexa', 'ubersuggest', 'answerthepublic', 'keywordtool', 'google trends', 'google search console', 'bing webmaster'],

    // Writing & Publishing
    'writing': ['medium', 'substack', 'ghost', 'wordpress', 'wix', 'squarespace', 'blogger', 'tumblr', 'write.as', 'bear', 'ulysses', 'scrivener', 'iawriter', 'typora', 'obsidian', 'roam', 'logseq', 'craft', 'notion', 'evernote', 'onenote', 'simplenote', 'standardnotes', 'joplin', 'grammarly', 'hemingway', 'prowritingaid', 'writefull', 'languagetool'],

    // Gaming
    'gaming': ['steam', 'epic games', 'gog', 'origin', 'uplay', 'battle.net', 'itch.io', 'humble bundle', 'green man gaming', 'fanatical', 'g2a', 'kinguin', 'cdkeys', 'twitch', 'youtube gaming', 'kick', 'trovo', 'mixer', 'discord', 'teamspeak', 'mumble', 'ventrilo', 'reddit gaming', 'ign', 'gamespot', 'polygon', 'kotaku', 'eurogamer', 'pcgamer', 'rockpapershotgun'],
};

const titleKeywords = {
    'work': ['work', 'job', 'office', 'professional', 'business', 'corporate', 'enterprise', 'productivity', 'team', 'collaboration', 'project', 'task', 'management'],
    'development': ['code', 'programming', 'developer', 'api', 'framework', 'library', 'tutorial', 'documentation', 'repo', 'git', 'backend', 'frontend', 'fullstack', 'devops', 'cloud', 'database'],
    'education': ['learn', 'course', 'tutorial', 'education', 'training', 'study', 'lesson', 'class', 'school', 'university', 'academy', 'bootcamp', 'workshop', 'certification'],
    'social': ['social', 'community', 'forum', 'chat', 'messaging', 'network', 'connect', 'follow', 'share', 'post'],
    'entertainment': ['video', 'music', 'stream', 'watch', 'listen', 'play', 'game', 'gaming', 'movie', 'show', 'series', 'podcast', 'radio'],
    'shopping': ['shop', 'buy', 'store', 'market', 'cart', 'product', 'deal', 'sale', 'ecommerce', 'retail', 'purchase', 'order'],
    'news': ['news', 'article', 'blog', 'post', 'read', 'story', 'magazine', 'journal', 'press', 'media', 'publication'],
    'finance': ['finance', 'money', 'payment', 'crypto', 'invest', 'trading', 'stock', 'banking', 'wallet', 'currency', 'exchange'],
    'design': ['design', 'creative', 'art', 'graphic', 'ui', 'ux', 'icon', 'font', 'color', 'palette', 'mockup', 'prototype', 'wireframe'],
    'fonts': ['font', 'fonts', 'typeface', 'typefaces', 'typography', 'lettering', 'glyph', 'webfont', 'webfonts'],
    'documentation': ['documentation', 'docs', 'reference', 'api', 'guide', 'manual', 'wiki', 'handbook', 'specification'],
    'tools': ['tool', 'utility', 'converter', 'generator', 'calculator', 'helper', 'validator', 'formatter', 'analyzer'],
    'health': ['health', 'fitness', 'workout', 'exercise', 'diet', 'nutrition', 'wellness', 'meditation', 'mental health', 'tracking', 'calories', 'running', 'cycling', 'yoga', 'medical'],
    'travel': ['travel', 'trip', 'flight', 'hotel', 'booking', 'vacation', 'destination', 'adventure', 'explore', 'tourism', 'airline', 'accommodation', 'itinerary', 'journey'],
    'food': ['food', 'recipe', 'cooking', 'baking', 'kitchen', 'chef', 'cuisine', 'meal', 'dish', 'restaurant', 'delivery', 'takeout', 'dining', 'nutrition', 'ingredients'],
    'photography': ['photo', 'photography', 'camera', 'image', 'picture', 'lens', 'editing', 'gallery', 'portfolio', 'stock', 'photographer', 'shoot', 'capture'],
    'ai': ['ai', 'artificial intelligence', 'machine learning', 'ml', 'deep learning', 'neural network', 'llm', 'language model', 'computer vision', 'nlp', 'chatbot', 'automation', 'model', 'training'],
    'security': ['security', 'privacy', 'password', 'vpn', 'encryption', 'antivirus', 'firewall', 'malware', 'protection', 'safe', 'secure', 'authentication', 'vulnerability'],
    'marketing': ['marketing', 'seo', 'email', 'campaign', 'analytics', 'ads', 'advertising', 'promotion', 'engagement', 'conversion', 'traffic', 'keywords', 'backlinks', 'rank'],
    'writing': ['writing', 'blog', 'publish', 'article', 'post', 'author', 'editor', 'content', 'copywriting', 'journalism', 'notes', 'markdown', 'draft', 'essay'],
    'gaming': ['gaming', 'game', 'gamer', 'play', 'player', 'esports', 'streaming', 'console', 'pc gaming', 'multiplayer', 'rpg', 'fps', 'mmo', 'indie game', 'review'],
};

/**
 * Find category suggestions based on URL and name
 */
function findCategorySuggestions(url, name = '') {
    const suggestions = new Set();
    const lowerUrl = url.toLowerCase();
    const lowerName = name.toLowerCase();
    const domain = extractDomain(lowerUrl);

    // Check domain patterns — check multi-word patterns first (more specific)
    // Sort patterns so longer/multi-word patterns are checked first
    const sortedEntries = Object.entries(domainPatterns).map(([category, patterns]) => [
        category,
        [...patterns].sort((a, b) => b.length - a.length)
    ]);

    for (const [category, patterns] of sortedEntries) {
        for (const pattern of patterns) {
            if (matchesPattern(domain, pattern) || matchesPattern(lowerUrl, pattern)) {
                suggestions.add(category);
                break;
            }
        }
    }

    // Check title keywords
    if (name) {
        for (const [category, keywords] of Object.entries(titleKeywords)) {
            for (const keyword of keywords) {
                if (matchesPattern(lowerName, keyword)) {
                    suggestions.add(category);
                    break;
                }
            }
        }
    }

    return suggestions;
}

/**
 * Suggest categories based on URL and title
 */
export function suggestCategories(url, name = '', existingCategories = []) {
    if (!url) return { categoryIds: [], suggestions: [] };

    const suggestions = findCategorySuggestions(url, name);

    // Reverse matching: check existing category names against URL/title
    if (existingCategories.length > 0) {
        const lowerUrl = url.toLowerCase();
        const domain = extractDomain(lowerUrl);
        reverseMatch(suggestions, existingCategories, domain, lowerUrl, (name || '').toLowerCase());
    }

    const suggestionsArray = Array.from(suggestions);
    return {
        categoryIds: matchToExisting(suggestionsArray, existingCategories),
        suggestions: suggestionsArray,
    };
}

/**
 * Get category name suggestions (for creating new categories)
 * @param {string} url - The site URL
 * @param {string} name - The site name/title
 * @returns {Array} Array of suggested category names (capitalized)
 */
export function getCategoryNameSuggestions(url, name = '') {
    if (!url) return [];

    const suggestions = findCategorySuggestions(url, name);

    // Capitalize first letter of each suggestion
    return Array.from(suggestions).map(s =>
        s.charAt(0).toUpperCase() + s.slice(1)
    );
}
