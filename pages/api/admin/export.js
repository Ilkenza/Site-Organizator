/** Admin CSV Export — users or sites */

import { adminGuard } from '../helpers/admin-utils';
import { HTTP, sendError } from '../helpers/api-utils';

const esc = v => { if (v == null) return ''; const s = String(v); return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s; };
const csv = (hdrs, rows) => [hdrs.map(esc).join(','), ...rows.map(r => hdrs.map(h => esc(r[h])).join(','))].join('\n');

export default async function handler(req, res) {
    const guard = await adminGuard(req, res, 'GET');
    if (!guard) return;
    const { supabase } = guard;
    const { type } = req.query;
    const ts = new Date().toISOString().split('T')[0];

    try {
        if (type === 'users') {
            const [{ data: usersData }, { data: profiles }, { data: allSites }] = await Promise.all([
                supabase.auth.admin.listUsers({ perPage: 1000 }),
                supabase.from('profiles').select('id, name, avatar_url'),
                supabase.from('sites').select('user_id'),
            ]);
            const pMap = {}, sCounts = {};
            (profiles || []).forEach(p => { pMap[p.id] = p; });
            (allSites || []).forEach(s => { sCounts[s.user_id] = (sCounts[s.user_id] || 0) + 1; });
            const rows = (usersData?.users || []).map(u => ({ email: u.email, username: pMap[u.id]?.name || u.user_metadata?.display_name || '', sites: sCounts[u.id] || 0, created_at: u.created_at, last_sign_in: u.last_sign_in_at || '', onboarded: u.user_metadata?.onboarding_completed ? 'Yes' : 'No' }));
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="users-${ts}.csv"`);
            return res.send(csv(['email', 'username', 'sites', 'created_at', 'last_sign_in', 'onboarded'], rows));
        }
        if (type === 'sites') {
            const [{ data: allSites }, { data: usersData }] = await Promise.all([
                supabase.from('sites').select('id, name, url, pricing, user_id, created_at'),
                supabase.auth.admin.listUsers({ perPage: 1000 }),
            ]);
            const eMap = {};
            (usersData?.users || []).forEach(u => { eMap[u.id] = u.email; });
            const rows = (allSites || []).map(s => ({ name: s.name, url: s.url, pricing: s.pricing, owner_email: eMap[s.user_id] || '', created_at: s.created_at }));
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="sites-${ts}.csv"`);
            return res.send(csv(['name', 'url', 'pricing', 'owner_email', 'created_at'], rows));
        }
        return sendError(res, HTTP.BAD_REQUEST, 'Invalid type. Use ?type=users or ?type=sites');
    } catch (err) {
        console.error('Export error:', err);
        return sendError(res, HTTP.INTERNAL_ERROR, err.message || 'Export failed');
    }
}
