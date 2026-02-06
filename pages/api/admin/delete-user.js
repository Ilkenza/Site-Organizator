/**
 * @fileoverview Admin API endpoint for deleting a user
 * Deletes user's data (sites, categories, tags) and then the auth user
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
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { error: 'Missing authorization', status: HTTP_STATUS.UNAUTHORIZED };
    }

    try {
        const token = authHeader.slice(7);
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'));
        const userId = payload?.sub;
        if (!userId) return { error: 'Invalid token', status: HTTP_STATUS.UNAUTHORIZED };

        const { data: userData, error } = await supabase.auth.admin.getUserById(userId);
        if (error || !userData?.user?.email) {
            return { error: 'User not found', status: HTTP_STATUS.UNAUTHORIZED };
        }

        const email = userData.user.email.toLowerCase();
        const adminEmails = getAdminEmails();

        if (!adminEmails.includes(email)) {
            return { error: 'Access denied', status: HTTP_STATUS.FORBIDDEN };
        }

        return { userId, email };
    } catch {
        return { error: 'Token decode failed', status: HTTP_STATUS.UNAUTHORIZED };
    }
}

export default async function handler(req, res) {
    if (req.method !== 'DELETE') {
        return res.status(HTTP_STATUS.METHOD_NOT_ALLOWED).json({ error: 'Method not allowed' });
    }

    const supabase = getAdminClient();
    if (!supabase) {
        return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: 'Server configuration error' });
    }

    const auth = await verifyAdmin(req, supabase);
    if (auth.error) {
        return res.status(auth.status).json({ error: auth.error });
    }

    const { userId } = req.body || {};
    if (!userId) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'userId is required' });
    }

    // Prevent self-deletion
    if (userId === auth.userId) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Cannot delete your own account from admin' });
    }

    try {
        // 1. Get user's site IDs first
        const { data: userSites } = await supabase.from('sites').select('id').eq('user_id', userId);
        const siteIds = (userSites || []).map(s => s.id);

        // 2. Delete site relations
        if (siteIds.length > 0) {
            await supabase.from('site_categories').delete().in('site_id', siteIds);
            await supabase.from('site_tags').delete().in('site_id', siteIds);
        }

        // 3. Delete user's data
        await supabase.from('sites').delete().eq('user_id', userId);
        await supabase.from('categories').delete().eq('user_id', userId);
        await supabase.from('tags').delete().eq('user_id', userId);

        // 4. Try deleting profile (may not exist)
        try { await supabase.from('profiles').delete().eq('id', userId); } catch { }

        // 5. Delete auth user
        const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
        if (deleteError) throw deleteError;

        return res.status(HTTP_STATUS.OK).json({ success: true });
    } catch (error) {
        console.error('Delete user error:', error);
        return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
            error: error.message || 'Failed to delete user'
        });
    }
}
