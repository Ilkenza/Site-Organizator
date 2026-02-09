/**
 * Smart tag suggestions based on site URL and title
 */

/**
 * Extract domain from URL
 * @param {string} url - The URL to extract domain from
 * @returns {string} The domain
 */
function extractDomain(url) {
    try {
        const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
        return urlObj.hostname.replace('www.', '');
    } catch {
        return url.toLowerCase();
    }
}

// Tag patterns - more specific characteristics
const tagPatterns = {
    // Tech stacks
    'JavaScript': ['javascript', 'node.js', 'nodejs', 'react', 'vue', 'angular', 'next.js', 'svelte', 'npm', 'nuxt', 'remix', 'astro', 'solid', 'preact', 'qwik', 'ember', 'backbone', 'meteor', 'aurelia'],
    'Python': ['python', 'django', 'flask', 'fastapi', 'pandas', 'numpy', 'pypi', 'jupyter', 'anaconda', 'pytest', 'sqlalchemy', 'celery', 'scrapy', 'beautifulsoup', 'pillow', 'matplotlib', 'scikit'],
    'TypeScript': ['typescript', 'deno'],
    'Java': ['java', 'spring', 'springboot', 'maven', 'gradle', 'hibernate', 'jakarta', 'struts', 'vaadin', 'grails'],
    'C++': ['c++', 'cpp', 'cplusplus', 'clang', 'cmake', 'boost'],
    'C#': ['csharp', 'dotnet', '.net', 'asp.net', 'blazor', 'xamarin', 'unity', 'maui'],
    'Go': ['golang', 'gin', 'echo', 'fiber', 'beego'],
    'Rust': ['rust', 'cargo', 'actix', 'rocket', 'warp'],
    'PHP': ['php', 'laravel', 'symfony', 'wordpress', 'composer', 'codeigniter', 'yii', 'cakephp', 'phalcon'],
    'Ruby': ['ruby', 'rails', 'ruby on rails', 'sinatra', 'hanami'],
    'Kotlin': ['kotlin', 'jetbrains'],
    'Swift': ['swift', 'swiftui'],
    'Dart': ['dart', 'flutter'],
    'WebAssembly': ['webassembly', 'wasm'],
    'Scala': ['scala', 'akka', 'play framework'],
    'Elixir': ['elixir', 'phoenix', 'ecto'],
    'Clojure': ['clojure', 'clojurescript'],
    'Backend': ['backend', 'rest api', 'graphql', 'server', 'express', 'nestjs', 'fastify', 'koa', 'hapi', 'microservices', 'serverless'],
    'Frontend': ['frontend', 'css', 'html', 'tailwind', 'bootstrap', 'sass', 'scss', 'styled-components', 'emotion', 'chakra', 'mui', 'antd', 'shadcn'],
    'Mobile': ['mobile', 'android', 'ios', 'react native', 'flutter', 'kotlin'],
    'Database': ['database', 'postgresql', 'mysql', 'mongodb', 'redis', 'firebase', 'supabase', 'planetscale', 'cockroachdb', 'cassandra', 'dynamodb', 'elasticsearch', 'sqlite'],

    // Development tools
    'Git': ['github', 'gitlab', 'bitbucket', 'gitea', 'gitpod'],
    'DevOps': ['docker', 'kubernetes', 'k8s', 'ci/cd', 'jenkins', 'terraform', 'ansible', 'circleci', 'github actions', 'travis', 'gitlab ci', 'argo', 'flux', 'helm'],
    'Testing': ['testing', 'jest', 'vitest', 'cypress', 'playwright', 'selenium', 'mocha', 'chai', 'jasmine', 'karma', 'protractor', 'storybook', 'chromatic'],
    'Code': ['coding', 'programming', 'developer', 'vscode', 'vim', 'emacs', 'intellij', 'webstorm'],
    'Open Source': ['open-source', 'open source'],
    'Repository': ['repository', 'github', 'gitlab'],
    'Package Manager': ['npm', 'yarn', 'pnpm', 'pip', 'cargo', 'maven', 'gradle', 'composer', 'bundler'],
    'Linter': ['eslint', 'prettier', 'stylelint', 'rubocop', 'pylint', 'flake8', 'black'],
    'Build Tool': ['webpack', 'vite', 'rollup', 'parcel', 'esbuild', 'turbopack', 'gulp', 'grunt', 'snowpack'],

    // Features
    'Free': ['free', 'open-source', 'oss', 'gratis'],
    'Paid': ['paid', 'premium', 'subscription', 'pro', 'enterprise'],
    'Cloud': ['cloud', 'aws', 'azure', 'gcp', 'vercel', 'netlify', 'heroku', 'railway', 'render', 'fly.io', 'cloudflare', 'digitalocean', 'linode', 'vultr', 'hetzner', 'ovh'],
    'AI': ['ai', 'machine learning', 'ml', 'gpt', 'chatgpt', 'chatbot', 'openai', 'anthropic', 'claude', 'llm', 'deep learning', 'neural network', 'tensorflow', 'pytorch', 'keras', 'huggingface', 'stable diffusion', 'midjourney'],
    'Video': ['video', 'streaming', 'youtube', 'vimeo', 'twitch', 'mp4', 'webm'],
    'Audio': ['audio', 'music', 'podcast', 'spotify', 'soundcloud', 'mp3', 'wav'],
    'Image': ['image', 'photo', 'picture', 'gallery', 'unsplash', 'pexels', 'jpeg', 'png', 'svg', 'webp'],
    'CMS': ['cms', 'wordpress', 'contentful', 'sanity', 'strapi', 'ghost', 'drupal', 'joomla', 'wix', 'squarespace', 'webflow'],
    'Ecommerce': ['ecommerce', 'e-commerce', 'shopify', 'woocommerce', 'magento', 'stripe', 'paypal', 'commerce', 'bigcommerce', 'prestashop'],
    'Realtime': ['realtime', 'websocket', 'socket.io', 'ably', 'pusher', 'live', 'sse'],
    'Monitoring': ['monitoring', 'observability', 'sentry', 'datadog', 'newrelic', 'grafana', 'prometheus', 'logging'],
    'No-Code': ['no-code', 'low-code', 'nocode', 'zapier', 'make', 'airtable', 'bubble'],
    // Usage type
    'Tutorial': ['tutorial', 'learn', 'course', 'guide', 'how-to', 'lesson', 'walkthrough', 'getting started'],
    'Reference': ['reference', 'docs', 'documentation', 'api docs', 'manual', 'readme', 'wiki', 'cheatsheet'],
    'Blog': ['blog', 'article', 'post', 'medium', 'dev.to', 'hashnode', 'substack', 'ghost', 'blogger', 'news'],
    'Portfolio': ['portfolio', 'showcase', 'works', 'projects', 'personal', 'resume', 'cv'],
    'Community': ['community', 'forum', 'discord', 'slack', 'reddit', 'discussion', 'chat', 'support'],
    'Template': ['template', 'boilerplate', 'starter', 'scaffold', 'theme', 'kit'],
    'Plugin': ['plugin', 'extension', 'addon', 'module', 'package', 'library'],

    // Work related
    'Productivity': ['productivity', 'workflow', 'automation', 'task', 'management', 'efficiency'],
    'Collaboration': ['collaboration', 'team', 'teamwork', 'share', 'sharing', 'remote', 'workspace'],
    'Fonts': ['font', 'fonts', 'typeface', 'typography', 'fontawesome', 'fonts.google', 'google fonts', 'fontshare', 'fontsquirrel', 'fontsource', 'fontjoy', 'fontpair', 'typewolf', 'myfonts', 'dafont', 'fontspace', 'webfont', 'typekit', 'adobe fonts', 'fontspring', 'lettering', 'glyph'],
    'Design System': ['design system', 'figma', 'sketch', 'storybook', 'component library', 'ui kit'],
    'Animation': ['animation', 'motion', 'framer motion', 'gsap', 'lottie', 'anime.js', 'three.js', 'webgl'],
    'API': ['rest api', 'graphql api', 'webhook', 'endpoint', 'postman', 'insomnia', 'swagger', 'openapi'],
    'Security': ['security', 'authentication', 'authorization', 'oauth', 'jwt', 'auth0', 'clerk', 'encryption', 'cybersecurity', 'pentesting', 'vulnerability'],
    'Performance': ['performance', 'optimization', 'lighthouse', 'core web vitals', 'caching'],
    'Accessibility': ['accessibility', 'a11y', 'wcag', 'aria', 'screen reader'],
    'Internationalization': ['i18n', 'internationalization', 'localization', 'l10n', 'translation', 'multilingual'],
    'Deployment': ['deployment', 'hosting', 'deploy', 'production', 'staging', 'preview'],
};

/**
 * Check if a pattern matches as a whole word/segment (not inside another word)
 * Splits the text into segments by common delimiters and checks for exact segment match,
 * or uses word-boundary regex for multi-word patterns.
 */
function matchesPattern(text, pattern) {
    // Patterns containing dots (like 'node.js', 'next.js') — use direct substring match
    if (pattern.includes('.')) {
        return text.includes(pattern);
    }
    if (pattern.includes(' ')) {
        // Multi-word pattern: use simple includes
        return text.includes(pattern);
    }
    // Single-word pattern: match as whole segment to avoid "ts" matching inside "fonts"
    // Split by common URL/text delimiters
    const segments = text.split(/[\s/\-_.,:;?&=#+()|[\]{}]+/);
    return segments.some(seg => seg === pattern);
}

/**
 * Find tag suggestions based on URL and name
 * @param {string} url - The site URL
 * @param {string} name - The site name/title
 * @returns {Set} Set of suggested tag names
 */
function findTagSuggestions(url, name = '') {
    const suggestions = new Set();
    const lowerUrl = url.toLowerCase();
    const lowerName = name.toLowerCase();
    const domain = extractDomain(lowerUrl);

    // Check tag patterns using word-boundary matching
    for (const [tag, patterns] of Object.entries(tagPatterns)) {
        for (const pattern of patterns) {
            const lowerPattern = pattern.toLowerCase();
            if (matchesPattern(domain, lowerPattern) || matchesPattern(lowerUrl, lowerPattern) || matchesPattern(lowerName, lowerPattern)) {
                suggestions.add(tag);
                break;
            }
        }
    }

    return suggestions;
}

/**
 * Suggest tags based on URL and title
 * @param {string} url - The site URL
 * @param {string} name - The site name/title
 * @param {Array} existingTags - Array of existing tags with {id, name} structure
 * @returns {Object} Object with tagIds (array of IDs) and suggestions (array of names)
 */
export function suggestTags(url, name = '', existingTags = []) {
    if (!url) {
        return { tagIds: [], suggestions: [] };
    }

    const suggestions = findTagSuggestions(url, name);

    // Reverse matching: check if any existing tag name appears in the URL or title
    // This catches user-created tags like "react", "fonts", "machine learning", etc.
    if (existingTags.length > 0) {
        const lowerUrl = url.toLowerCase();
        const lowerName = (name || '').toLowerCase();
        const domain = extractDomain(lowerUrl);

        for (const tag of existingTags) {
            if (!tag?.name) continue;
            const tagName = tag.name.toLowerCase();
            // Skip very short names (1-2 chars) to avoid false positives
            if (tagName.length <= 2) continue;

            // Check each word in multi-word tag names (e.g. "machine learning" → check "machine", "learning")
            const words = tagName.split(/\s+/);
            // For multi-word names, also check the full name as a phrase
            const patternsToCheck = words.length > 1 ? [tagName, ...words.filter(w => w.length > 2)] : [tagName];

            for (const pattern of patternsToCheck) {
                if (matchesPattern(domain, pattern) || matchesPattern(lowerUrl, pattern) || matchesPattern(lowerName, pattern)) {
                    suggestions.add(tagName);
                    break;
                }
            }
        }
    }

    const suggestionsArray = Array.from(suggestions);

    // Match suggestions with existing tags (case-insensitive)
    const matchedTags = [];
    for (const suggestion of suggestionsArray) {
        const matchedTag = existingTags.find(
            tag => tag?.name?.toLowerCase() === suggestion.toLowerCase()
        );
        if (matchedTag) {
            matchedTags.push(matchedTag.id);
        }
    }

    return {
        tagIds: matchedTags,
        suggestions: suggestionsArray,
    };
}
