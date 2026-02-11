/** Admin Ban/Unban User */

import { adminGuard } from '../helpers/admin-utils';
import { HTTP, sendError, sendOk } from '../helpers/api-utils';

export default async function handler(req, res) {
    const guard = await adminGuard(req, res, 'POST');
    if (!guard) return;
    const { supabase, auth } = guard;

    const { userId, ban } = req.body || {};
    if (!userId) return sendError(res, HTTP.BAD_REQUEST, 'userId is required');
    if (typeof ban !== 'boolean') return sendError(res, HTTP.BAD_REQUEST, 'ban must be boolean');
    if (userId === auth.userId) return sendError(res, HTTP.BAD_REQUEST, 'Cannot ban your own account');

    try {
        const { error } = await supabase.auth.admin.updateUserById(userId, { ban_duration: ban ? '876000h' : 'none' });
        if (error) throw error;
        return sendOk(res, { banned: ban, user_id: userId });
    } catch (err) {
        console.error('Ban user error:', err);
        return sendError(res, HTTP.INTERNAL_ERROR, err.message || 'Failed to update user status');
    }
}
