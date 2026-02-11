/** AI-powered category/tag suggestions via GitHub Models GPT-4o-mini */

import { createClient } from '@supabase/supabase-js';
import { HTTP, extractTokenFromReq, decodeJwt, getAdminEmails, sendError, sendOk, methodGuard } from '../helpers/api-utils';

const AI_URL = 'https://models.inference.ai.azure.com/chat/completions';
const MODEL = 'gpt-4o-mini';
const FETCH_MS = 5000, AI_MS = 20000;
const LIMITS = { free: 30, pro: 500, promax: Infinity };

let _admin = null;
function adminClient() {
    if (_admin) return _admin;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    _admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    return _admin;
}

function currentMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }

async function fetchMeta(url) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_MS);
    try {
        const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SiteOrganizator/1.0)', Accept: 'text/html' }, redirect: 'follow' });
        if (!res.ok) return { title: '', description: '' };
        const reader = res.body?.getReader();
        if (!reader) return { title: '', description: '' };
        let html = '', bytes = 0;
        const dec = new TextDecoder();
        while (bytes < 16384) { const { done, value } = await reader.read(); if (done) break; html += dec.decode(value, { stream: true }); bytes += value.length; }
        reader.cancel();
        const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]?.replace(/\s+/g, ' ').trim() || '';
        const desc = (html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["']/i) || html.match(/<meta[^>]*content=["']([\s\S]*?)["'][^>]*name=["']description["']/i) || [])[1]?.trim() || '';
        const ogDesc = (html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([\s\S]*?)["']/i) || [])[1]?.trim() || '';
        const keywords = (html.match(/<meta[^>]*name=["']keywords["'][^>]*content=["']([\s\S]*?)["']/i) || html.match(/<meta[^>]*content=["']([\s\S]*?)["'][^>]*name=["']keywords["']/i) || [])[1]?.trim() || '';
        return { title, description: desc || ogDesc || '', keywords };
    } catch { return { title: '', description: '', keywords: '' }; } finally { clearTimeout(timer); }
}

async function callAI(token, prompt) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), AI_MS);
    try {
        const res = await fetch(AI_URL, { method: 'POST', signal: ctrl.signal, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ model: MODEL, messages: [{ role: 'system', content: 'You are a website classification expert. Always respond with valid JSON only, no markdown formatting.' }, { role: 'user', content: prompt }], temperature: 0.3, max_tokens: 512, response_format: { type: 'json_object' } }) });
        if (!res.ok) throw new Error(`AI API error (${res.status}): ${await res.text()}`);
        const text = (await res.json())?.choices?.[0]?.message?.content;
        if (!text) throw new Error('Empty AI response');
        const m = text.match(/```json\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/);
        return JSON.parse((m ? (m[1] || m[0]) : text).trim());
    } finally { clearTimeout(timer); }
}

export default async function handler(req, res) {
    if (!methodGuard(req, res, 'POST')) return;

    const userToken = extractTokenFromReq(req);
    if (!userToken) return sendError(res, HTTP.UNAUTHORIZED, 'Authentication required');

    const payload = decodeJwt(userToken);
    if (!payload?.sub) return sendError(res, HTTP.UNAUTHORIZED, 'Invalid token');

    const userId = payload.sub;
    const meta = payload.user_metadata || {};
    let tier = meta.tier || (meta.is_pro ? 'pro' : 'free');
    const email = (payload.email || '').toLowerCase();
    const isAdmin = getAdminEmails().includes(email);
    if (isAdmin) tier = 'promax';
    const monthlyLimit = isAdmin ? Infinity : (LIMITS[tier] || LIMITS.free);

    const sb = adminClient();
    const month = currentMonth();
    let usageCount = 0;

    if (sb && monthlyLimit !== Infinity) {
        try {
            const { data } = await sb.from('ai_usage').select('count').eq('user_id', userId).eq('month', month).single();
            usageCount = data?.count || 0;
            if (usageCount >= monthlyLimit) {
                const hint = tier === 'free' ? ' Upgrade to Pro or Pro Max for more AI suggestions.' : tier === 'pro' ? ' Upgrade to Pro Max for more AI suggestions.' : '';
                return sendError(res, HTTP.TOO_MANY, `Monthly AI suggestion limit reached (${usageCount}/${monthlyLimit}). Resets next month.${hint}`, { usage: { used: usageCount, limit: monthlyLimit, month } });
            }
        } catch (e) { console.warn('ai_usage check failed:', e.message); }
    }

    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    if (!GITHUB_TOKEN) return sendError(res, HTTP.INTERNAL_ERROR, 'GITHUB_TOKEN is not configured. Add a GitHub PAT with copilot scope.');

    const { url, name, categories = [], tags = [] } = req.body || {};
    if (!url) return sendError(res, HTTP.BAD_REQUEST, 'URL is required');

    try {
        const normUrl = url.startsWith('http') ? url : `https://${url}`;
        const pageMeta = await fetchMeta(normUrl);

        const catNames = categories.slice(0, 30).map(c => c.name).join(', ');
        const tagNames = tags.slice(0, 50).map(t => t.name).join(', ');
        const prompt = `Classify this website for a bookmark manager. Return JSON only.\n\nURL: ${normUrl}\nName: ${name || ''}\nTitle: ${(pageMeta.title || '').slice(0, 100)}\nDesc: ${(pageMeta.description || '').slice(0, 150)}\n\nExisting categories: ${catNames || '(none)'}\nExisting tags: ${tagNames || '(none)'}\n\nReturn JSON: {"existingCategories":["max 3 from above"],"newCategories":["max 2 new if needed, Capitalized"],"existingTags":["max 5 from above"],"newTags":["max 3 new if needed, lowercase"],"pricing":"fully_free|freemium|free_trial|paid","confidence":0.0-1.0}`;

        const ai = await callAI(GITHUB_TOKEN, prompt);

        const result = {
            existingCategories: (ai.existingCategories || []).slice(0, 3),
            newCategories: (ai.newCategories || []).slice(0, 2),
            existingTags: (ai.existingTags || []).slice(0, 8),
            newTags: (ai.newTags || []).slice(0, 5),
            pricing: ['fully_free', 'freemium', 'free_trial', 'paid'].includes(ai.pricing) ? ai.pricing : null,
            confidence: typeof ai.confidence === 'number' ? Math.min(1, Math.max(0, ai.confidence)) : 0.5,
            pageMeta: { title: pageMeta.title || '', description: (pageMeta.description || '').slice(0, 200) },
        };

        const newCount = usageCount + 1;
        if (sb && monthlyLimit !== Infinity) {
            try { await sb.from('ai_usage').upsert({ user_id: userId, month, count: newCount, updated_at: new Date().toISOString() }, { onConflict: 'user_id,month' }); } catch (e) { console.warn('ai_usage increment failed:', e.message); }
        }

        return sendOk(res, { data: result, usage: { used: newCount, limit: monthlyLimit, month } });
    } catch (err) {
        console.error('AI suggest error:', err);
        return sendError(res, HTTP.INTERNAL_ERROR, err.message || 'AI suggestion failed');
    }
}
