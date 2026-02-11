/** Admin Platform Statistics */

import { adminGuard } from '../helpers/admin-utils';
import { HTTP, sendError, sendOk } from '../helpers/api-utils';

const PAGE = 1000;

/* ── helpers ────────────────────────────────────────────── */
function countMap(arr, key) {
    const m = {};
    (arr || []).forEach(r => { m[r[key]] = (m[r[key]] || 0) + 1; });
    return m;
}

function topUsage(items, usageMap, idKey, n = 10) {
    const merged = {};
    (items || []).forEach(r => {
        const k = r.name.toLowerCase().trim();
        if (!merged[k]) merged[k] = { name: r.name, color: r.color, usage: 0 };
        merged[k].usage += usageMap[r[idKey]] || 0;
    });
    return Object.values(merged).sort((a, b) => b.usage - a.usage).slice(0, n);
}

async function fetchAllSites(supabase) {
    let all = [], from = 0;
    while (true) {
        const { data } = await supabase.from('sites').select('id, url, pricing, user_id, created_at').range(from, from + PAGE - 1);
        if (!data?.length) break;
        all = all.concat(data);
        if (data.length < PAGE) break;
        from += PAGE;
    }
    return all;
}

function growthSlice(sites, start, end) {
    const inRange = sites.filter(s => { const d = new Date(s.created_at); return d >= start && d <= end; });
    const upTo = sites.filter(s => new Date(s.created_at) <= end);
    return {
        users: new Set(inRange.map(s => s.user_id)).size,
        sites: inRange.length,
        totalUsers: new Set(upTo.map(s => s.user_id)).size,
        totalSites: upTo.length,
    };
}

function buildGrowthData(sites, now) {
    const hourly = [], daily = [], monthly = [], yearly = [];
    for (let i = 23; i >= 0; i--) {
        const s = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() - i, 0, 0, 0);
        const e = new Date(s.getFullYear(), s.getMonth(), s.getDate(), s.getHours(), 59, 59, 999);
        hourly.push({ label: `${String(s.getHours()).padStart(2, '0')}:00`, ...growthSlice(sites, s, e) });
    }
    for (let i = 29; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const e = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
        daily.push({ label: `${d.getDate()} ${d.toLocaleString('en', { month: 'short' })}`, ...growthSlice(sites, s, e) });
    }
    for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const e = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
        const inMonth = sites.filter(s => { const c = new Date(s.created_at); return c.getMonth() === d.getMonth() && c.getFullYear() === d.getFullYear(); });
        const upTo = sites.filter(s => new Date(s.created_at) <= e);
        monthly.push({ label: d.toLocaleString('en', { month: 'short', year: '2-digit' }), users: new Set(inMonth.map(s => s.user_id)).size, sites: inMonth.length, totalUsers: new Set(upTo.map(s => s.user_id)).size, totalSites: upTo.length });
    }
    for (let y = now.getFullYear() - 9; y <= now.getFullYear(); y++) {
        const e = new Date(y, 11, 31, 23, 59, 59, 999);
        const inY = sites.filter(s => new Date(s.created_at).getFullYear() === y);
        const upTo = sites.filter(s => new Date(s.created_at) <= e);
        yearly.push({ label: String(y), users: new Set(inY.map(s => s.user_id)).size, sites: inY.length, totalUsers: new Set(upTo.map(s => s.user_id)).size, totalSites: upTo.length });
    }
    return { hourly, daily, monthly, yearly };
}

function median(arr) {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b), m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : +((s[m - 1] + s[m]) / 2).toFixed(1);
}

function safeDomain(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } }

/* ── handler ────────────────────────────────────────────── */
export default async function handler(req, res) {
    const guard = await adminGuard(req, res, 'GET');
    if (!guard) return;
    const { supabase } = guard;

    try {
        const { data: usersData, error: usersErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        if (usersErr) throw usersErr;
        const users = usersData?.users || [];

        const [{ count: totalSites }, { count: totalCategories }, { count: totalTags }] = await Promise.all([
            supabase.from('sites').select('*', { count: 'exact', head: true }),
            supabase.from('categories').select('*', { count: 'exact', head: true }),
            supabase.from('tags').select('*', { count: 'exact', head: true }),
        ]);

        // Per-user stats (RPC fallback → manual)
        let userStats = {};
        const [r1, r2, r3] = await Promise.all([
            supabase.rpc('count_by_user', { table_name: 'sites' }).then(r => r).catch(() => ({ data: null })),
            supabase.rpc('count_by_user', { table_name: 'categories' }).then(r => r).catch(() => ({ data: null })),
            supabase.rpc('count_by_user', { table_name: 'tags' }).then(r => r).catch(() => ({ data: null })),
        ]);
        if (r1.data) {
            const add = (rows, k) => (rows || []).forEach(r => { userStats[r.user_id] = { ...userStats[r.user_id], [k]: r.count }; });
            add(r1.data, 'sites'); add(r2.data, 'categories'); add(r3.data, 'tags');
        } else {
            const [{ data: aS }, { data: aC }, { data: aT }] = await Promise.all([
                supabase.from('sites').select('user_id'), supabase.from('categories').select('user_id'), supabase.from('tags').select('user_id'),
            ]);
            const inc = (arr, k) => (arr || []).forEach(r => { userStats[r.user_id] = userStats[r.user_id] || { sites: 0, categories: 0, tags: 0 }; userStats[r.user_id][k]++; });
            inc(aS, 'sites'); inc(aC, 'categories'); inc(aT, 'tags');
        }

        // Top categories & tags
        const [{ data: topCats }, { data: topTagsRaw }, { data: siteCats }, { data: siteTagsRaw }, { data: profiles }] = await Promise.all([
            supabase.from('categories').select('id, name, color').limit(50),
            supabase.from('tags').select('id, name, color').limit(50),
            supabase.from('site_categories').select('category_id'),
            supabase.from('site_tags').select('tag_id'),
            supabase.from('profiles').select('id, name, avatar_url'),
        ]);
        const catUsage = countMap(siteCats, 'category_id');
        const tagUsage = countMap(siteTagsRaw, 'tag_id');
        const topCategories = topUsage(topCats, catUsage, 'id');
        const topTags = topUsage(topTagsRaw, tagUsage, 'id');

        // Profile & user list
        const profMap = {};
        (profiles || []).forEach(p => { profMap[p.id] = p; });
        const userList = users.map(u => {
            const p = profMap[u.id];
            return {
                id: u.id, email: u.email,
                username: u.user_metadata?.display_name || u.user_metadata?.full_name || u.user_metadata?.username || p?.name || '—',
                avatar: p?.avatar_url || u.user_metadata?.avatar_url || null,
                created_at: u.created_at, last_sign_in: u.last_sign_in_at,
                sites: userStats[u.id]?.sites || 0, categories: userStats[u.id]?.categories || 0, tags: userStats[u.id]?.tags || 0,
                onboarded: !!u.user_metadata?.onboarding_completed,
                is_pro: !!u.user_metadata?.is_pro,
                tier: u.user_metadata?.tier || (u.user_metadata?.is_pro ? 'pro' : 'free'),
                banned: !!u.banned_until && new Date(u.banned_until) > new Date(),
            };
        }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        const userMap = {};
        userList.forEach(u => { userMap[u.id] = u; });

        // All sites + pricing breakdown + growth data
        const allSites = await fetchAllSites(supabase);
        const pricingBreakdown = { fully_free: 0, freemium: 0, free_trial: 0, paid: 0 };
        allSites.forEach(s => { if (s.pricing in pricingBreakdown) pricingBreakdown[s.pricing]++; });

        const now = new Date();
        const d7 = new Date(now.getTime() - 7 * 864e5);
        const d30 = new Date(now.getTime() - 30 * 864e5);
        const activeUsers = users.filter(u => u.last_sign_in_at && new Date(u.last_sign_in_at) >= d7).length;
        const growthData = buildGrowthData(allSites, now);

        // Sites per user stats
        const spu = userList.map(u => u.sites);
        const sitesPerUserStats = {
            avg: spu.length ? +(spu.reduce((a, b) => a + b, 0) / spu.length).toFixed(1) : 0,
            min: spu.length ? Math.min(...spu) : 0, max: spu.length ? Math.max(...spu) : 0, median: median(spu),
        };

        // Most active (7d), popular domains, duplicates, recent activity
        const recentByUser = {};
        allSites.filter(s => new Date(s.created_at) >= d7).forEach(s => { recentByUser[s.user_id] = (recentByUser[s.user_id] || 0) + 1; });
        const mostActiveUsers = Object.entries(recentByUser)
            .map(([uid, n]) => userMap[uid] ? { ...userMap[uid], recentSites: n } : null)
            .filter(Boolean).sort((a, b) => b.recentSites - a.recentSites).slice(0, 5);

        const domCounts = {};
        allSites.forEach(s => { const d = safeDomain(s.url); if (d) domCounts[d] = (domCounts[d] || 0) + 1; });
        const popularDomains = Object.entries(domCounts).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([domain, count]) => ({ domain, count }));

        const urlSets = {};
        allSites.forEach(s => { try { const n = new URL(s.url).origin + new URL(s.url).pathname.replace(/\/+$/, ''); (urlSets[n] ??= new Set()).add(s.user_id); } catch { } });
        const duplicateSites = Object.entries(urlSets).filter(([, s]) => s.size > 1).map(([url, s]) => ({ url, userCount: s.size })).sort((a, b) => b.userCount - a.userCount).slice(0, 15);

        const recentActivity = allSites.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 20).map(s => {
            const o = userMap[s.user_id];
            return { url: s.url, domain: safeDomain(s.url), created_at: s.created_at, user: o ? { username: o.username, email: o.email, avatar: o.avatar } : null };
        });

        // AI Usage
        let aiUsage = { totalRequests: 0, currentMonth: { month: '', requests: 0 }, topUsers: [], tierBreakdown: { free: 0, pro: 0, promax: 0 } };
        try {
            const cm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            const { data: allUsage } = await supabase.from('ai_usage').select('user_id, month, count');
            if (allUsage?.length) {
                const totals = allUsage.reduce((s, r) => s + (r.count || 0), 0);
                const cmRecs = allUsage.filter(r => r.month === cm);
                const cmTotal = cmRecs.reduce((s, r) => s + (r.count || 0), 0);
                const uTotals = {};
                allUsage.forEach(r => { uTotals[r.user_id] = (uTotals[r.user_id] || 0) + (r.count || 0); });
                const topAi = Object.entries(uTotals).map(([uid, total]) => {
                    const u = userMap[uid]; return u ? { username: u.username, email: u.email, avatar: u.avatar, tier: u.tier, total, currentMonth: cmRecs.find(r => r.user_id === uid)?.count || 0 } : null;
                }).filter(Boolean).sort((a, b) => b.total - a.total).slice(0, 10);
                const tb = { free: 0, pro: 0, promax: 0 };
                cmRecs.forEach(r => { const t = userMap[r.user_id]?.tier || 'free'; tb[t] = (tb[t] || 0) + (r.count || 0); });
                aiUsage = { totalRequests: totals, currentMonth: { month: cm, requests: cmTotal }, topUsers: topAi, tierBreakdown: tb };
                userList.forEach(u => { u.aiUsageMonth = cmRecs.find(r => r.user_id === u.id)?.count || 0; u.aiUsageTotal = uTotals[u.id] || 0; });
            }
        } catch (e) { console.warn('Failed to fetch AI usage:', e.message); }

        return sendOk(res, {
            overview: { totalUsers: users.length, totalSites: totalSites || 0, totalCategories: totalCategories || 0, totalTags: totalTags || 0, activeUsers, newUsersLast30Days: users.filter(u => new Date(u.created_at) >= d30).length },
            pricingBreakdown, topCategories, topTags, users: userList, growthData,
            sitesPerUserStats, mostActiveUsers, popularDomains, duplicateSites,
            emptyAccountsCount: userList.filter(u => u.sites === 0).length, recentActivity, aiUsage,
        });
    } catch (err) {
        console.error('Admin stats error:', err);
        return sendError(res, HTTP.INTERNAL_ERROR, err.message || 'Failed to fetch admin stats');
    }
}
