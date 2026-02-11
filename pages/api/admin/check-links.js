/** Admin Broken Links Check */

import { adminGuard } from '../helpers/admin-utils';
import { HTTP, sendError, sendOk } from '../helpers/api-utils';

const TIMEOUT = 8000, BATCH = 10;

async function checkUrl(url) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
    try {
        const r = await fetch(url, { method: 'HEAD', signal: ctrl.signal, redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SiteOrganizer-LinkChecker/1.0)' } });
        clearTimeout(timer);
        return { status: r.status, ok: r.ok, error: r.ok ? null : `HTTP ${r.status}` };
    } catch (err) {
        clearTimeout(timer);
        return { status: 0, ok: false, error: err.name === 'AbortError' ? 'Timeout' : err.code === 'ENOTFOUND' ? 'DNS not found' : err.message || 'Connection failed' };
    }
}

export default async function handler(req, res) {
    const guard = await adminGuard(req, res, 'POST');
    if (!guard) return;
    const { supabase } = guard;

    try {
        const { data: sites } = await supabase.from('sites').select('id, name, url, user_id');
        if (!sites?.length) return sendOk(res, { broken: [], checked: 0 });

        const [{ data: usersData }, { data: profiles }] = await Promise.all([
            supabase.auth.admin.listUsers({ perPage: 1000 }),
            supabase.from('profiles').select('id, name'),
        ]);
        const emailMap = {}, nameMap = {};
        (usersData?.users || []).forEach(u => { emailMap[u.id] = u.email; });
        (profiles || []).forEach(p => { nameMap[p.id] = p.name; });

        const broken = [];
        for (let i = 0; i < sites.length; i += BATCH) {
            const results = await Promise.all(sites.slice(i, i + BATCH).map(async s => ({ site: s, result: await checkUrl(s.url) })));
            results.forEach(({ site, result }) => {
                if (!result.ok) broken.push({ siteId: site.id, name: site.name, url: site.url, status: result.status, error: result.error, ownerEmail: emailMap[site.user_id] || 'Unknown', ownerName: nameMap[site.user_id] || '' });
            });
        }

        return sendOk(res, { checked: sites.length, brokenCount: broken.length, broken: broken.sort((a, b) => a.status - b.status) });
    } catch (err) {
        console.error('Link check error:', err);
        return sendError(res, HTTP.INTERNAL_ERROR, err.message || 'Link check failed');
    }
}
