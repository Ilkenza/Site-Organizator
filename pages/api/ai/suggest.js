/**
 * @fileoverview AI-powered category and tag suggestions for sites
 * Uses GitHub Models API (Copilot Pro+) with GPT-4o-mini
 */

// HTTP Status Codes
const HTTP_STATUS = {
    OK: 200,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    INTERNAL_ERROR: 500
};

// Config
const GITHUB_MODELS_URL = 'https://models.inference.ai.azure.com/chat/completions';
const GITHUB_MODEL = 'gpt-4o-mini';
const FETCH_TIMEOUT_MS = 5000;
const AI_TIMEOUT_MS = 20000;
const MAX_CATEGORIES = 3;
const MAX_TAGS = 8;
const MAX_NEW_CATEGORIES = 2;
const MAX_NEW_TAGS = 5;

/**
 * Extract JWT token from Authorization header
 */
const extractUserToken = (headers) => {
    const authHeader = headers.authorization;
    return authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
};

/**
 * Fetch page metadata (title, description) from a URL
 */
async function fetchPageMeta(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const res = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; SiteOrganizator/1.0)',
                'Accept': 'text/html'
            },
            redirect: 'follow'
        });

        if (!res.ok) return { title: '', description: '' };

        // Only read first 16KB to extract meta
        const reader = res.body?.getReader();
        if (!reader) return { title: '', description: '' };

        let html = '';
        const decoder = new TextDecoder();
        let bytesRead = 0;
        const MAX_BYTES = 16384;

        while (bytesRead < MAX_BYTES) {
            const { done, value } = await reader.read();
            if (done) break;
            html += decoder.decode(value, { stream: true });
            bytesRead += value.length;
        }
        reader.cancel();

        // Extract title
        const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';

        // Extract meta description
        const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["']/i)
            || html.match(/<meta[^>]*content=["']([\s\S]*?)["'][^>]*name=["']description["']/i);
        const description = descMatch ? descMatch[1].replace(/\s+/g, ' ').trim() : '';

        // Extract meta keywords
        const kwMatch = html.match(/<meta[^>]*name=["']keywords["'][^>]*content=["']([\s\S]*?)["']/i)
            || html.match(/<meta[^>]*content=["']([\s\S]*?)["'][^>]*name=["']keywords["']/i);
        const keywords = kwMatch ? kwMatch[1].replace(/\s+/g, ' ').trim() : '';

        // Extract OG description as fallback
        const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([\s\S]*?)["']/i);
        const ogDesc = ogDescMatch ? ogDescMatch[1].replace(/\s+/g, ' ').trim() : '';

        return {
            title,
            description: description || ogDesc || '',
            keywords
        };
    } catch (e) {
        console.warn('Failed to fetch page meta:', e.message);
        return { title: '', description: '', keywords: '' };
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Call GitHub Models API (OpenAI-compatible) for suggestions
 */
async function callAI(token, prompt) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

    try {
        const res = await fetch(GITHUB_MODELS_URL, {
            method: 'POST',
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                model: GITHUB_MODEL,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a website classification expert. Always respond with valid JSON only, no markdown formatting.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 512,
                response_format: { type: 'json_object' }
            })
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`AI API error (${res.status}): ${errText}`);
        }

        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content;
        if (!text) throw new Error('Empty AI response');

        // Extract JSON from response (may be wrapped in ```json ... ```)
        const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;
        return JSON.parse(jsonStr.trim());
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Build the AI prompt (compact — must fit under 8000 tokens)
 */
function buildPrompt(url, siteName, pageMeta, existingCategories, existingTags) {
    // Limit to first 30 category/tag names to stay within token budget
    const catNames = existingCategories.slice(0, 30).map(c => c.name).join(', ');
    const tagNames = existingTags.slice(0, 50).map(t => t.name).join(', ');
    const desc = (pageMeta.description || '').slice(0, 150);

    return `Classify this website for a bookmark manager. Return JSON only.

URL: ${url}
Name: ${siteName || ''}
Title: ${(pageMeta.title || '').slice(0, 100)}
Desc: ${desc}

Existing categories: ${catNames || '(none)'}
Existing tags: ${tagNames || '(none)'}

Return JSON: {"existingCategories":["max 3 from above"],"newCategories":["max 2 new if needed, Capitalized"],"existingTags":["max 5 from above"],"newTags":["max 3 new if needed, lowercase"],"pricing":"fully_free|freemium|free_trial|paid","confidence":0.0-1.0}`;
}

/**
 * Main API handler
 */
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            error: 'Only POST is allowed'
        });
    }

    // Auth check
    const userToken = extractUserToken(req.headers);
    if (!userToken) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
            success: false,
            error: 'Authentication required'
        });
    }

    // Pro check — decode JWT to verify is_pro in user_metadata (admins always pass)
    try {
        const payload = JSON.parse(Buffer.from(userToken.split('.')[1], 'base64').toString('utf8'));
        const isPro = !!payload?.user_metadata?.is_pro;
        const userEmail = payload?.email || '';
        const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
        const isAdmin = adminEmails.includes(userEmail.toLowerCase());
        if (!isPro && !isAdmin) {
            return res.status(403).json({
                success: false,
                error: 'Pro subscription required for AI suggestions'
            });
        }
    } catch {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
            success: false,
            error: 'Invalid token'
        });
    }

    // Check for GitHub token (Copilot Pro+)
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    if (!GITHUB_TOKEN) {
        return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
            success: false,
            error: 'GITHUB_TOKEN is not configured. Add a GitHub PAT with copilot scope to your environment variables.'
        });
    }

    const { url, name, categories = [], tags = [] } = req.body || {};

    if (!url) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            error: 'URL is required'
        });
    }

    try {
        // 1. Fetch page metadata
        const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
        const pageMeta = await fetchPageMeta(normalizedUrl);

        // 2. Build prompt and call AI
        const prompt = buildPrompt(normalizedUrl, name || '', pageMeta, categories, tags);
        const aiResult = await callAI(GITHUB_TOKEN, prompt);

        // 3. Validate and sanitize response
        const result = {
            existingCategories: Array.isArray(aiResult.existingCategories)
                ? aiResult.existingCategories.slice(0, MAX_CATEGORIES) : [],
            newCategories: Array.isArray(aiResult.newCategories)
                ? aiResult.newCategories.slice(0, MAX_NEW_CATEGORIES) : [],
            existingTags: Array.isArray(aiResult.existingTags)
                ? aiResult.existingTags.slice(0, MAX_TAGS) : [],
            newTags: Array.isArray(aiResult.newTags)
                ? aiResult.newTags.slice(0, MAX_NEW_TAGS) : [],
            pricing: ['fully_free', 'freemium', 'free_trial', 'paid'].includes(aiResult.pricing)
                ? aiResult.pricing : null,
            confidence: typeof aiResult.confidence === 'number'
                ? Math.min(1, Math.max(0, aiResult.confidence)) : 0.5,
            pageMeta: {
                title: pageMeta.title || '',
                description: (pageMeta.description || '').slice(0, 200)
            }
        };

        return res.status(HTTP_STATUS.OK).json({
            success: true,
            data: result
        });
    } catch (err) {
        console.error('AI suggest error:', err);
        return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
            success: false,
            error: err.message || 'AI suggestion failed'
        });
    }
}
