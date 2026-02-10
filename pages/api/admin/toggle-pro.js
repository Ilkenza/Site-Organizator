/**
 * @fileoverview Admin Toggle Pro Status API
 * Sets or removes Pro status for a user via user_metadata.is_pro
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

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(HTTP_STATUS.METHOD_NOT_ALLOWED).json({ error: 'Method not allowed' });
    }

    const supabase = getAdminClient();
    if (!supabase) return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: 'Server config error' });

    const auth = await verifyAdmin(req, supabase);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { userId, isPro, tier } = req.body || {};
    if (!userId) return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'userId is required' });

    // Support new tier system: tier can be 'free', 'pro', 'promax'
    // Legacy support: isPro boolean still works (maps to 'pro' / 'free')
    const VALID_TIERS = ['free', 'pro', 'promax'];
    let newTier;
    if (tier !== undefined) {
        if (!VALID_TIERS.includes(tier)) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: `tier must be one of: ${VALID_TIERS.join(', ')}` });
        }
        newTier = tier;
    } else if (typeof isPro === 'boolean') {
        newTier = isPro ? 'pro' : 'free';
    } else {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'tier or isPro is required' });
    }

    try {
        // Get current user metadata to preserve existing fields
        const { data: existingUser, error: fetchError } = await supabase.auth.admin.getUserById(userId);
        if (fetchError) throw fetchError;

        const currentMeta = existingUser?.user?.user_metadata || {};

        // Update user_metadata with tier + legacy is_pro flag
        const { data: _data, error } = await supabase.auth.admin.updateUserById(userId, {
            user_metadata: {
                ...currentMeta,
                tier: newTier,
                is_pro: newTier !== 'free', // legacy compat
            }
        });

        if (error) throw error;

        return res.status(HTTP_STATUS.OK).json({
            success: true,
            tier: newTier,
            is_pro: newTier !== 'free',
            user_id: userId
        });
    } catch (error) {
        console.error('Toggle pro error:', error);
        return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
            error: error.message || 'Failed to update pro status'
        });
    }
}
