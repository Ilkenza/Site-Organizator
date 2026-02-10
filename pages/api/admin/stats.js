/**
 * @fileoverview Admin API endpoint for platform-wide statistics
 * Returns user counts, site counts, top categories/tags, and user list
 * Protected by NEXT_PUBLIC_ADMIN_EMAILS environment variable
 */

import { createClient } from '@supabase/supabase-js';

// HTTP Status Codes
const HTTP_STATUS = {
    OK: 200,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    METHOD_NOT_ALLOWED: 405,
    INTERNAL_ERROR: 500
};

/**
 * Get admin emails from environment variable
 * @returns {string[]} Array of admin email addresses
 */
function getAdminEmails() {
    const raw = process.env.NEXT_PUBLIC_ADMIN_EMAILS || '';
    return raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
}

/**
 * Create Supabase admin client with service role key
 */
function getAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) return null;
    return createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });
}

/**
 * Verify the requesting user is an admin
 */
async function verifyAdmin(req, supabase) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { error: 'Missing authorization', status: HTTP_STATUS.UNAUTHORIZED };
    }

    const token = authHeader.slice(7);

    // Decode JWT to get user ID
    try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'));
        const userId = payload?.sub;
        if (!userId) return { error: 'Invalid token', status: HTTP_STATUS.UNAUTHORIZED };

        // Get user email from Supabase
        const { data: userData, error } = await supabase.auth.admin.getUserById(userId);
        if (error || !userData?.user?.email) {
            return { error: 'User not found', status: HTTP_STATUS.UNAUTHORIZED };
        }

        const email = userData.user.email.toLowerCase();
        const adminEmails = getAdminEmails();

        if (adminEmails.length === 0) {
            return { error: 'No admin emails configured', status: HTTP_STATUS.FORBIDDEN };
        }

        if (!adminEmails.includes(email)) {
            return { error: 'Access denied', status: HTTP_STATUS.FORBIDDEN };
        }

        return { userId, email };
    } catch {
        return { error: 'Token decode failed', status: HTTP_STATUS.UNAUTHORIZED };
    }
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(HTTP_STATUS.METHOD_NOT_ALLOWED).json({ error: 'Method not allowed' });
    }

    const supabase = getAdminClient();
    if (!supabase) {
        return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: 'Server configuration error' });
    }

    // Verify admin access
    const auth = await verifyAdmin(req, supabase);
    if (auth.error) {
        return res.status(auth.status).json({ error: auth.error });
    }

    try {
        // 1. Get all users from Supabase Auth
        const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        if (usersError) throw usersError;

        const users = usersData?.users || [];

        // 2. Get total counts
        const [
            { count: totalSites },
            { count: totalCategories },
            { count: totalTags }
        ] = await Promise.all([
            supabase.from('sites').select('*', { count: 'exact', head: true }),
            supabase.from('categories').select('*', { count: 'exact', head: true }),
            supabase.from('tags').select('*', { count: 'exact', head: true })
        ]);

        // 3. Get per-user stats
        const [
            { data: siteCounts },
            { data: categoryCounts },
            { data: tagCounts }
        ] = await Promise.all([
            supabase.rpc('count_by_user', { table_name: 'sites' }).select('*').then(r => r).catch(() => ({ data: null })),
            supabase.rpc('count_by_user', { table_name: 'categories' }).select('*').then(r => r).catch(() => ({ data: null })),
            supabase.rpc('count_by_user', { table_name: 'tags' }).select('*').then(r => r).catch(() => ({ data: null }))
        ]);

        // If RPC doesn't exist, fall back to manual count per user
        let userStats = {};

        if (siteCounts) {
            // RPC approach worked
            siteCounts.forEach(r => { userStats[r.user_id] = { ...userStats[r.user_id], sites: r.count }; });
            categoryCounts?.forEach(r => { userStats[r.user_id] = { ...userStats[r.user_id], categories: r.count }; });
            tagCounts?.forEach(r => { userStats[r.user_id] = { ...userStats[r.user_id], tags: r.count }; });
        } else {
            // Fallback: fetch all data and count manually
            const [
                { data: allSites },
                { data: allCats },
                { data: allTags }
            ] = await Promise.all([
                supabase.from('sites').select('user_id'),
                supabase.from('categories').select('user_id'),
                supabase.from('tags').select('user_id')
            ]);

            (allSites || []).forEach(s => {
                userStats[s.user_id] = userStats[s.user_id] || { sites: 0, categories: 0, tags: 0 };
                userStats[s.user_id].sites++;
            });
            (allCats || []).forEach(c => {
                userStats[c.user_id] = userStats[c.user_id] || { sites: 0, categories: 0, tags: 0 };
                userStats[c.user_id].categories++;
            });
            (allTags || []).forEach(t => {
                userStats[t.user_id] = userStats[t.user_id] || { sites: 0, categories: 0, tags: 0 };
                userStats[t.user_id].tags++;
            });
        }

        // 4. Get top categories and tags
        const [
            { data: topCats },
            { data: topTags }
        ] = await Promise.all([
            supabase.from('categories').select('id, name, color').limit(50),
            supabase.from('tags').select('id, name, color').limit(50)
        ]);

        // Count how many sites use each category/tag
        const [
            { data: siteCats },
            { data: siteTags }
        ] = await Promise.all([
            supabase.from('site_categories').select('category_id'),
            supabase.from('site_tags').select('tag_id')
        ]);

        const catUsage = {};
        (siteCats || []).forEach(sc => {
            catUsage[sc.category_id] = (catUsage[sc.category_id] || 0) + 1;
        });

        const tagUsage = {};
        (siteTags || []).forEach(st => {
            tagUsage[st.tag_id] = (tagUsage[st.tag_id] || 0) + 1;
        });

        const topCategories = Object.values(
            (topCats || []).reduce((acc, c) => {
                const key = c.name.toLowerCase().trim();
                if (!acc[key]) {
                    acc[key] = { name: c.name, color: c.color, usage: catUsage[c.id] || 0 };
                } else {
                    acc[key].usage += catUsage[c.id] || 0;
                }
                return acc;
            }, {})
        ).sort((a, b) => b.usage - a.usage).slice(0, 10);

        const topTen = Object.values(
            (topTags || []).reduce((acc, t) => {
                const key = t.name.toLowerCase().trim();
                if (!acc[key]) {
                    acc[key] = { name: t.name, color: t.color, usage: tagUsage[t.id] || 0 };
                } else {
                    acc[key].usage += tagUsage[t.id] || 0;
                }
                return acc;
            }, {})
        ).sort((a, b) => b.usage - a.usage).slice(0, 10);

        // 5. Fetch profiles from profiles table (name, avatar_url)
        const { data: profiles } = await supabase.from('profiles').select('id, name, avatar_url');
        const profileMap = {};
        (profiles || []).forEach(p => { profileMap[p.id] = p; });

        // 6. Build user list with stats + profile data
        const userList = users.map(u => {
            const profile = profileMap[u.id];
            return {
                id: u.id,
                email: u.email,
                username: u.user_metadata?.display_name || u.user_metadata?.full_name || u.user_metadata?.username || profile?.name || '—',
                avatar: profile?.avatar_url || u.user_metadata?.avatar_url || null,
                created_at: u.created_at,
                last_sign_in: u.last_sign_in_at,
                sites: userStats[u.id]?.sites || 0,
                categories: userStats[u.id]?.categories || 0,
                tags: userStats[u.id]?.tags || 0,
                onboarded: !!u.user_metadata?.onboarding_completed,
                is_pro: !!u.user_metadata?.is_pro,
                tier: u.user_metadata?.tier || (u.user_metadata?.is_pro ? 'pro' : 'free'),
                banned: !!u.banned_until && new Date(u.banned_until) > new Date()
            };
        }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        // 7. Count sites by pricing model — fetch ALL sites (Supabase default limit is 1000)
        let allSitesFull = [];
        let from = 0;
        const PAGE_SIZE = 1000;
        let hasMoreData = true;
        while (hasMoreData) {
            const { data: batch } = await supabase.from('sites').select('id, url, pricing, user_id, created_at').range(from, from + PAGE_SIZE - 1);
            if (!batch || batch.length === 0) {
                hasMoreData = false;
                break;
            }
            allSitesFull = allSitesFull.concat(batch);
            if (batch.length < PAGE_SIZE) {
                hasMoreData = false;
            } else {
                from += PAGE_SIZE;
            }
        }

        const pricingBreakdown = { fully_free: 0, freemium: 0, free_trial: 0, paid: 0 };
        allSitesFull.forEach(s => {
            if (Object.prototype.hasOwnProperty.call(pricingBreakdown, s.pricing)) {
                pricingBreakdown[s.pricing]++;
            }
        });

        // Active users (signed in within last 7 days)
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const activeUsers = users.filter(u => u.last_sign_in_at && new Date(u.last_sign_in_at) >= sevenDaysAgo).length;

        // 8x. Hourly growth data (last 24 hours)
        const growthHourly = [];
        for (let i = 23; i >= 0; i--) {
            const hStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() - i, 0, 0, 0);
            const hEnd = new Date(hStart.getFullYear(), hStart.getMonth(), hStart.getDate(), hStart.getHours(), 59, 59, 999);
            const label = `${String(hStart.getHours()).padStart(2, '0')}:00`;
            const sitesInRange = allSitesFull.filter(s => {
                const cd = new Date(s.created_at);
                return cd >= hStart && cd <= hEnd;
            });
            const sitesCount = sitesInRange.length;
            const usersAddingSites = new Set(sitesInRange.map(s => s.user_id)).size;
            const sitesUpTo = allSitesFull.filter(s => new Date(s.created_at) <= hEnd);
            const totalSitesUpTo = sitesUpTo.length;
            const totalUsersUpTo = new Set(sitesUpTo.map(s => s.user_id)).size;
            growthHourly.push({ label, users: usersAddingSites, sites: sitesCount, totalUsers: totalUsersUpTo, totalSites: totalSitesUpTo });
        }

        // 8a. Monthly growth data (last 12 months)
        const growthMonthly = [];
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
            const label = d.toLocaleString('en', { month: 'short', year: '2-digit' });
            const sitesInMonth = allSitesFull.filter(s => {
                const cd = new Date(s.created_at);
                return cd.getMonth() === d.getMonth() && cd.getFullYear() === d.getFullYear();
            });
            const sitesCount = sitesInMonth.length;
            const usersAddingSites = new Set(sitesInMonth.map(s => s.user_id)).size;
            const sitesUpTo = allSitesFull.filter(s => new Date(s.created_at) <= monthEnd);
            const totalSitesUpTo = sitesUpTo.length;
            const totalUsersUpTo = new Set(sitesUpTo.map(s => s.user_id)).size;
            growthMonthly.push({ label, users: usersAddingSites, sites: sitesCount, totalUsers: totalUsersUpTo, totalSites: totalSitesUpTo });
        }

        // 8b. Daily growth data (last 30 days)
        const growthDaily = [];
        for (let i = 29; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
            const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
            const label = `${d.getDate()} ${d.toLocaleString('en', { month: 'short' })}`;
            const sitesInDay = allSitesFull.filter(s => {
                const cd = new Date(s.created_at);
                return cd >= dayStart && cd <= dayEnd;
            });
            const sitesCount = sitesInDay.length;
            const usersAddingSites = new Set(sitesInDay.map(s => s.user_id)).size;
            const sitesUpTo = allSitesFull.filter(s => new Date(s.created_at) <= dayEnd);
            const totalSitesUpTo = sitesUpTo.length;
            const totalUsersUpTo = new Set(sitesUpTo.map(s => s.user_id)).size;
            growthDaily.push({ label, users: usersAddingSites, sites: sitesCount, totalUsers: totalUsersUpTo, totalSites: totalSitesUpTo });
        }

        // 8c. Yearly growth data (all years with data)
        const maxYear = now.getFullYear();
        const minYear = maxYear - 9;
        const growthYearly = [];
        for (let y = minYear; y <= maxYear; y++) {
            const yearEnd = new Date(y, 11, 31, 23, 59, 59, 999);
            const sitesInYear = allSitesFull.filter(s => new Date(s.created_at).getFullYear() === y);
            const sitesCount = sitesInYear.length;
            const usersAddingSites = new Set(sitesInYear.map(s => s.user_id)).size;
            const sitesUpTo = allSitesFull.filter(s => new Date(s.created_at) <= yearEnd);
            const totalSitesUpTo = sitesUpTo.length;
            const totalUsersUpTo = new Set(sitesUpTo.map(s => s.user_id)).size;
            growthYearly.push({ label: String(y), users: usersAddingSites, sites: sitesCount, totalUsers: totalUsersUpTo, totalSites: totalSitesUpTo });
        }

        // 9. Sites per user stats
        const sitesPerUser = userList.map(u => u.sites);
        const sitesPerUserStats = {
            avg: sitesPerUser.length > 0 ? +(sitesPerUser.reduce((a, b) => a + b, 0) / sitesPerUser.length).toFixed(1) : 0,
            min: sitesPerUser.length > 0 ? Math.min(...sitesPerUser) : 0,
            max: sitesPerUser.length > 0 ? Math.max(...sitesPerUser) : 0,
            median: (() => {
                if (sitesPerUser.length === 0) return 0;
                const sorted = [...sitesPerUser].sort((a, b) => a - b);
                const mid = Math.floor(sorted.length / 2);
                return sorted.length % 2 ? sorted[mid] : +((sorted[mid - 1] + sorted[mid]) / 2).toFixed(1);
            })()
        };

        // 10. Most active users (last 7 days by sites created)
        const recentSitesByUser = {};
        allSitesFull.filter(s => new Date(s.created_at) >= sevenDaysAgo).forEach(s => {
            recentSitesByUser[s.user_id] = (recentSitesByUser[s.user_id] || 0) + 1;
        });
        const mostActiveUsers = Object.entries(recentSitesByUser)
            .map(([uid, count]) => {
                const u = userList.find(u => u.id === uid);
                return u ? { ...u, recentSites: count } : null;
            })
            .filter(Boolean)
            .sort((a, b) => b.recentSites - a.recentSites)
            .slice(0, 5);

        // 11. Popular domains
        const domainCounts = {};
        allSitesFull.forEach(s => {
            try {
                const domain = new URL(s.url).hostname.replace(/^www\./, '');
                domainCounts[domain] = (domainCounts[domain] || 0) + 1;
            } catch { }
        });
        const popularDomains = Object.entries(domainCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15)
            .map(([domain, count]) => ({ domain, count }));

        // 12. Duplicate sites (same URL across different users)
        const urlMap = {};
        allSitesFull.forEach(s => {
            try {
                const normalized = new URL(s.url).origin + new URL(s.url).pathname.replace(/\/+$/, '');
                if (!urlMap[normalized]) urlMap[normalized] = new Set();
                urlMap[normalized].add(s.user_id);
            } catch { }
        });
        const duplicateSites = Object.entries(urlMap)
            .filter(([, userSet]) => userSet.size > 1)
            .map(([url, userSet]) => ({ url, userCount: userSet.size }))
            .sort((a, b) => b.userCount - a.userCount)
            .slice(0, 15);

        // 13. Empty accounts (users with 0 sites)
        const emptyAccounts = userList.filter(u => u.sites === 0);

        // 14. Recent activity (last 20 created sites)
        const recentActivity = allSitesFull
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 20)
            .map(s => {
                const owner = userList.find(u => u.id === s.user_id);
                let domain = '';
                try { domain = new URL(s.url).hostname.replace(/^www\./, ''); } catch { }
                return {
                    url: s.url,
                    domain,
                    created_at: s.created_at,
                    user: owner ? { username: owner.username, email: owner.email, avatar: owner.avatar } : null
                };
            });

        // 15. AI Usage stats
        let aiUsage = { totalRequests: 0, currentMonth: { month: '', requests: 0 }, topUsers: [], tierBreakdown: { free: 0, pro: 0, promax: 0 } };
        try {
            const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

            // All usage records
            const { data: allUsage } = await supabase.from('ai_usage').select('user_id, month, count');

            if (allUsage && allUsage.length > 0) {
                // Total requests all time
                const totalRequests = allUsage.reduce((sum, r) => sum + (r.count || 0), 0);

                // Current month total
                const currentMonthRecords = allUsage.filter(r => r.month === currentMonth);
                const currentMonthRequests = currentMonthRecords.reduce((sum, r) => sum + (r.count || 0), 0);

                // Top users by total usage
                const userTotals = {};
                allUsage.forEach(r => {
                    userTotals[r.user_id] = (userTotals[r.user_id] || 0) + (r.count || 0);
                });
                const topAiUsers = Object.entries(userTotals)
                    .map(([uid, total]) => {
                        const u = userList.find(u => u.id === uid);
                        return u ? { username: u.username, email: u.email, avatar: u.avatar, tier: u.tier, total, currentMonth: currentMonthRecords.find(r => r.user_id === uid)?.count || 0 } : null;
                    })
                    .filter(Boolean)
                    .sort((a, b) => b.total - a.total)
                    .slice(0, 10);

                // Per-tier breakdown (current month)
                const tierBreakdown = { free: 0, pro: 0, promax: 0 };
                currentMonthRecords.forEach(r => {
                    const u = userList.find(u => u.id === r.user_id);
                    const t = u?.tier || 'free';
                    tierBreakdown[t] = (tierBreakdown[t] || 0) + (r.count || 0);
                });

                aiUsage = { totalRequests, currentMonth: { month: currentMonth, requests: currentMonthRequests }, topUsers: topAiUsers, tierBreakdown };

                // Attach per-user AI usage to userList
                userList.forEach(u => {
                    u.aiUsageMonth = currentMonthRecords.find(r => r.user_id === u.id)?.count || 0;
                    u.aiUsageTotal = userTotals[u.id] || 0;
                });
            }
        } catch (err) {
            console.warn('Failed to fetch AI usage:', err.message);
        }

        return res.status(HTTP_STATUS.OK).json({
            success: true,
            overview: {
                totalUsers: users.length,
                totalSites: totalSites || 0,
                totalCategories: totalCategories || 0,
                totalTags: totalTags || 0,
                activeUsers,
                newUsersLast30Days: users.filter(u => new Date(u.created_at) >= thirtyDaysAgo).length
            },
            pricingBreakdown,
            topCategories,
            topTags: topTen,
            users: userList,
            growthData: { hourly: growthHourly, daily: growthDaily, monthly: growthMonthly, yearly: growthYearly },
            sitesPerUserStats,
            mostActiveUsers,
            popularDomains,
            duplicateSites,
            emptyAccountsCount: emptyAccounts.length,
            recentActivity,
            aiUsage
        });
    } catch (error) {
        console.error('Admin stats error:', error);
        return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
            error: error.message || 'Failed to fetch admin stats'
        });
    }
}
