/**
 * @fileoverview Admin Broken Links Check API
 * On-demand checks a batch of site URLs for broken links (404, timeout, etc.)
 * Protected by NEXT_PUBLIC_ADMIN_EMAILS environment variable
 */

import { createClient } from '@supabase/supabase-js';

const HTTP_STATUS = {
    OK: 200,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    METHOD_NOT_ALLOWED: 405,
    INTERNAL_ERROR: 500
};

const CHECK_TIMEOUT = 8000; // 8s per URL
const BATCH_SIZE = 10; // Check 10 URLs in parallel

function getAdminEmails() {
    const raw = process.env.NEXT_PUBLIC_ADMIN_EMAILS || '';
    return raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
}

function getAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) return null;
    return createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });
}

async function verifyAdmin(req, supabase) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return { error: 'Missing authorization', status: HTTP_STATUS.UNAUTHORIZED };
    }
    try {
        const token = authHeader.slice(7);
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'));
        const userId = payload?.sub;
        if (!userId) return { error: 'Invalid token', status: HTTP_STATUS.UNAUTHORIZED };

        const { data: userData, error } = await supabase.auth.admin.getUserById(userId);
        if (error || !userData?.user?.email) return { error: 'User not found', status: HTTP_STATUS.UNAUTHORIZED };

        const email = userData.user.email.toLowerCase();
        if (!getAdminEmails().includes(email)) return { error: 'Access denied', status: HTTP_STATUS.FORBIDDEN };

        return { userId, email };
    } catch {
        return { error: 'Token decode failed', status: HTTP_STATUS.UNAUTHORIZED };
    }
}

async function checkUrl(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT);

    try {
        const response = await fetch(url, {
            method: 'HEAD',
            signal: controller.signal,
            redirect: 'follow',
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; SiteOrganizer-LinkChecker/1.0)'
            }
        });
        clearTimeout(timer);

        return {
            status: response.status,
            ok: response.ok,
            error: response.ok ? null : `HTTP ${response.status}`
        };
    } catch (err) {
        clearTimeout(timer);
        const errorMsg = err.name === 'AbortError' ? 'Timeout' :
            err.code === 'ENOTFOUND' ? 'DNS not found' :
                err.message || 'Connection failed';
        return { status: 0, ok: false, error: errorMsg };
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(HTTP_STATUS.METHOD_NOT_ALLOWED).json({ error: 'Method not allowed' });
    }

    const supabase = getAdminClient();
    if (!supabase) return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: 'Server config error' });

    const auth = await verifyAdmin(req, supabase);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    try {
        // Get all sites
        const { data: sites } = await supabase.from('sites').select('id, name, url, user_id');
        if (!sites?.length) {
            return res.status(HTTP_STATUS.OK).json({ success: true, broken: [], checked: 0 });
        }

        // Get user emails for context
        const { data: usersData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        const emailMap = {};
        (usersData?.users || []).forEach(u => { emailMap[u.id] = u.email; });

        // Get profiles for display names
        const { data: profiles } = await supabase.from('profiles').select('id, name');
        const nameMap = {};
        (profiles || []).forEach(p => { nameMap[p.id] = p.name; });

        // Check URLs in batches
        const broken = [];
        for (let i = 0; i < sites.length; i += BATCH_SIZE) {
            const batch = sites.slice(i, i + BATCH_SIZE);
            const results = await Promise.all(
                batch.map(async (site) => {
                    const result = await checkUrl(site.url);
                    return { site, result };
                })
            );

            results.forEach(({ site, result }) => {
                if (!result.ok) {
                    broken.push({
                        siteId: site.id,
                        name: site.name,
                        url: site.url,
                        status: result.status,
                        error: result.error,
                        ownerEmail: emailMap[site.user_id] || 'Unknown',
                        ownerName: nameMap[site.user_id] || ''
                    });
                }
            });
        }

        return res.status(HTTP_STATUS.OK).json({
            success: true,
            checked: sites.length,
            brokenCount: broken.length,
            broken: broken.sort((a, b) => a.status - b.status)
        });
    } catch (error) {
        console.error('Link check error:', error);
        return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
            error: error.message || 'Link check failed'
        });
    }
}
