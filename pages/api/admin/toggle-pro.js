/** Admin Toggle Pro/Tier Status */

import { adminGuard } from '../helpers/admin-utils';
import { HTTP, sendError, sendOk } from '../helpers/api-utils';

const VALID_TIERS = ['free', 'pro', 'promax'];

export default async function handler(req, res) {
    const guard = await adminGuard(req, res, 'POST');
    if (!guard) return;
    const { supabase } = guard;

    const { userId, isPro, tier } = req.body || {};
    if (!userId) return sendError(res, HTTP.BAD_REQUEST, 'userId is required');

    let newTier;
    if (tier !== undefined) {
        if (!VALID_TIERS.includes(tier)) return sendError(res, HTTP.BAD_REQUEST, `tier must be one of: ${VALID_TIERS.join(', ')}`);
        newTier = tier;
    } else if (typeof isPro === 'boolean') {
        newTier = isPro ? 'pro' : 'free';
    } else {
        return sendError(res, HTTP.BAD_REQUEST, 'tier or isPro is required');
    }

    try {
        const { data: existing, error: fetchErr } = await supabase.auth.admin.getUserById(userId);
        if (fetchErr) throw fetchErr;

        const { error } = await supabase.auth.admin.updateUserById(userId, {
            user_metadata: { ...(existing?.user?.user_metadata || {}), tier: newTier, is_pro: newTier !== 'free' }
        });
        if (error) throw error;

        return sendOk(res, { tier: newTier, is_pro: newTier !== 'free', user_id: userId });
    } catch (err) {
        console.error('Toggle pro error:', err);
        return sendError(res, HTTP.INTERNAL_ERROR, err.message || 'Failed to update pro status');
    }
}
