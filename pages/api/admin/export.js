/**
 * @fileoverview Admin CSV Export API
 * Exports all users or all sites as CSV
 * Protected by NEXT_PUBLIC_ADMIN_EMAILS environment variable
 */

import { createClient } from '@supabase/supabase-js';

const HTTP_STATUS = {
    OK: 200,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    METHOD_NOT_ALLOWED: 405,
    INTERNAL_ERROR: 500
};

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

function escapeCsv(val) {
    if (val == null) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

function buildCsv(headers, rows) {
    const lines = [headers.map(escapeCsv).join(',')];
    rows.forEach(row => {
        lines.push(headers.map(h => escapeCsv(row[h])).join(','));
    });
    return lines.join('\n');
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(HTTP_STATUS.METHOD_NOT_ALLOWED).json({ error: 'Method not allowed' });
    }

    const supabase = getAdminClient();
    if (!supabase) return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: 'Server config error' });

    const auth = await verifyAdmin(req, supabase);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { type } = req.query; // 'users' or 'sites'

    try {
        if (type === 'users') {
            const { data: usersData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
            const users = usersData?.users || [];
            const { data: profiles } = await supabase.from('profiles').select('id, name, avatar_url');
            const profileMap = {};
            (profiles || []).forEach(p => { profileMap[p.id] = p; });

            // Get per-user site counts
            const { data: allSites } = await supabase.from('sites').select('user_id');
            const siteCounts = {};
            (allSites || []).forEach(s => { siteCounts[s.user_id] = (siteCounts[s.user_id] || 0) + 1; });

            const rows = users.map(u => ({
                email: u.email,
                username: profileMap[u.id]?.name || u.user_metadata?.display_name || '',
                sites: siteCounts[u.id] || 0,
                created_at: u.created_at,
                last_sign_in: u.last_sign_in_at || '',
                onboarded: u.user_metadata?.onboarding_completed ? 'Yes' : 'No'
            }));

            const csv = buildCsv(['email', 'username', 'sites', 'created_at', 'last_sign_in', 'onboarded'], rows);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="users-${new Date().toISOString().split('T')[0]}.csv"`);
            return res.status(HTTP_STATUS.OK).send(csv);

        } else if (type === 'sites') {
            const { data: allSites } = await supabase.from('sites').select('id, name, url, pricing, user_id, created_at');
            const { data: usersData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
            const emailMap = {};
            (usersData?.users || []).forEach(u => { emailMap[u.id] = u.email; });

            const rows = (allSites || []).map(s => ({
                name: s.name,
                url: s.url,
                pricing: s.pricing,
                owner_email: emailMap[s.user_id] || '',
                created_at: s.created_at
            }));

            const csv = buildCsv(['name', 'url', 'pricing', 'owner_email', 'created_at'], rows);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="sites-${new Date().toISOString().split('T')[0]}.csv"`);
            return res.status(HTTP_STATUS.OK).send(csv);

        } else {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Invalid type. Use ?type=users or ?type=sites' });
        }
    } catch (error) {
        console.error('Export error:', error);
        return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: error.message || 'Export failed' });
    }
}
