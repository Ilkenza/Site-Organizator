export const SUPER_CATEGORIES = [
    { key: 'design', label: 'Design', icon: '🎨', color: '#f472b6', keywords: ['design', 'ui', 'ux', 'graphic', 'visual', 'layout', 'typography', 'font', 'color', 'figma', 'sketch', 'adobe', 'creative', 'illustration', 'animation', 'branding', 'logo', 'icon', 'style', 'theme', 'photo', 'image', 'art', 'mockup', 'wireframe', 'prototype'] },
    { key: 'frontend', label: 'Frontend', icon: '🖥️', color: '#60a5fa', keywords: ['frontend', 'front-end', 'react', 'vue', 'angular', 'svelte', 'next', 'nuxt', 'remix', 'html', 'css', 'tailwind', 'sass', 'javascript', 'typescript', 'component', 'spa', 'pwa', 'browser', 'dom', 'state', 'redux', 'zustand', 'responsive'] },
    { key: 'backend', label: 'Backend', icon: '⚙️', color: '#38bdf8', keywords: ['backend', 'back-end', 'server', 'node', 'express', 'api', 'rest', 'graphql', 'python', 'django', 'flask', 'ruby', 'rails', 'php', 'laravel', 'java', 'spring', 'go', 'rust', 'microservice', 'websocket', 'middleware'] },
    { key: 'mobile', label: 'Mobile', icon: '📱', color: '#4ade80', keywords: ['mobile', 'ios', 'android', 'react native', 'flutter', 'swift', 'kotlin', 'capacitor', 'ionic', 'expo', 'native', 'responsive', 'tablet'] },
    { key: 'database', label: 'Database', icon: '🗄️', color: '#2dd4bf', keywords: ['database', 'sql', 'nosql', 'postgres', 'mysql', 'mongo', 'redis', 'supabase', 'firebase', 'prisma', 'orm', 'migration', 'query', 'schema'] },
    { key: 'devops', label: 'DevOps', icon: '🚀', color: '#818cf8', keywords: ['devops', 'deploy', 'hosting', 'docker', 'kubernetes', 'cloud', 'aws', 'azure', 'gcp', 'vercel', 'netlify', 'ci', 'cd', 'pipeline', 'linux', 'nginx', 'terraform', 'infrastructure'] },
    { key: 'ai', label: 'AI', icon: '🧠', color: '#c084fc', keywords: ['ai', 'artificial intelligence', 'machine learning', 'ml', 'chatgpt', 'openai', 'llm', 'gpt', 'neural', 'deep learning', 'nlp', 'computer vision', 'model', 'prompt', 'copilot', 'gemini', 'claude', 'midjourney', 'stable diffusion'] },
    { key: 'data', label: 'Data', icon: '📊', color: '#fbbf24', keywords: ['data', 'analytics', 'statistics', 'visualization', 'chart', 'graph', 'report', 'bi', 'dashboard', 'metrics', 'tracking', 'scraping', 'dataset', 'data science'] },
    { key: 'security', label: 'Security', icon: '🔒', color: '#f87171', keywords: ['security', 'privacy', 'auth', 'authentication', 'encryption', 'password', 'vpn', 'firewall', 'hack', 'cyber', 'ssl', 'certificate', 'oauth', 'token', 'vulnerability', 'pentest'] },
    { key: 'tools', label: 'Tools', icon: '🔧', color: '#fb923c', keywords: ['tool', 'utility', 'productivity', 'automation', 'generator', 'converter', 'editor', 'formatter', 'linter', 'debug', 'profiler', 'cli', 'terminal', 'git', 'vscode', 'ide'] },
    { key: 'testing', label: 'Testing', icon: '🧪', color: '#a3e635', keywords: ['test', 'testing', 'jest', 'cypress', 'playwright', 'selenium', 'unit', 'integration', 'e2e', 'qa', 'mock', 'coverage', 'tdd', 'bdd'] },
    { key: 'learning', label: 'Learning', icon: '📚', color: '#a78bfa', keywords: ['learn', 'education', 'course', 'tutorial', 'documentation', 'reference', 'guide', 'training', 'academy', 'school', 'university', 'study', 'teach', 'book', 'research', 'wiki', 'how-to', 'howto', 'cheatsheet'] },
    { key: 'resources', label: 'Resources', icon: '📦', color: '#6ee7b7', keywords: ['resource', 'asset', 'stock', 'collection', 'inspiration', 'gallery', 'directory', 'list', 'curated', 'awesome', 'bookmark', 'link', 'bundle', 'kit', 'pack', 'library', 'template', 'boilerplate', 'starter'] },
    { key: 'business', label: 'Business', icon: '💼', color: '#fcd34d', keywords: ['business', 'marketing', 'finance', 'sales', 'startup', 'management', 'seo', 'growth', 'brand', 'strategy', 'consulting', 'invest', 'money', 'career', 'job', 'freelance', 'entrepreneur'] },
    { key: 'ecommerce', label: 'Shop', icon: '🛒', color: '#f97316', keywords: ['ecommerce', 'commerce', 'shop', 'store', 'retail', 'payment', 'stripe', 'shopify', 'marketplace', 'buy', 'sell', 'cart', 'checkout', 'pricing', 'saas', 'subscription'] },
    { key: 'content', label: 'Content', icon: '📝', color: '#34d399', keywords: ['content', 'blog', 'news', 'media', 'writing', 'video', 'podcast', 'publish', 'magazine', 'newsletter', 'cms', 'wordpress', 'medium', 'substack'] },
    { key: 'social', label: 'Social', icon: '💬', color: '#f43f5e', keywords: ['social', 'community', 'forum', 'chat', 'messaging', 'twitter', 'reddit', 'discord', 'slack', 'network', 'share', 'follow', 'feed'] },
    { key: 'media', label: 'Media', icon: '🎬', color: '#e879f9', keywords: ['streaming', 'music', 'audio', 'youtube', 'twitch', 'spotify', 'movie', 'film', 'tv', 'anime', 'comic', 'game', 'gaming', 'entertainment'] },
    { key: 'nocode', label: 'No-Code', icon: '🧩', color: '#67e8f9', keywords: ['nocode', 'no-code', 'low-code', 'lowcode', 'drag', 'drop', 'builder', 'webflow', 'bubble', 'airtable', 'notion', 'zapier', 'make', 'integromat', 'workflow'] },
    { key: 'opensource', label: 'Open Src', icon: '🌐', color: '#86efac', keywords: ['open source', 'opensource', 'open-source', 'github', 'gitlab', 'contributing', 'license', 'fork', 'repo', 'community', 'free'] },
];

export function matchSuperCategory(categoryName) {
    if (!categoryName) return null;
    const lower = categoryName.toLowerCase();
    for (const sc of SUPER_CATEGORIES) {
        if (sc.keywords.some(kw => lower.includes(kw))) return sc.key;
    }
    return null;
}

// Build a full groups list (auto + custom from localStorage) for key↔label conversion
export function getAllGroups() {
    let customGroups = [];
    try { customGroups = JSON.parse(localStorage.getItem('siteorg_custom_groups') || '[]'); } catch { /* ignore */ }
    return [...SUPER_CATEGORIES, ...customGroups];
}

export function groupKeyToLabel(key) {
    if (!key) return null;
    if (key === '_other') return 'Other';
    const all = getAllGroups();
    return all.find(g => g.key === key)?.label || key;
}

export function groupLabelToKey(label) {
    if (!label) return null;
    if (label === 'Other') return '_other';
    const all = getAllGroups();
    return all.find(g => g.label === label)?.key || label;
}
