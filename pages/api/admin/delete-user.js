/** Admin Delete User — removes all data + auth account */

import { adminGuard } from '../helpers/admin-utils';
import { HTTP, sendError, sendOk } from '../helpers/api-utils';

export default async function handler(req, res) {
    const guard = await adminGuard(req, res, 'DELETE');
    if (!guard) return;
    const { supabase, auth } = guard;

    const { userId } = req.body || {};
    if (!userId) return sendError(res, HTTP.BAD_REQUEST, 'userId is required');
    if (userId === auth.userId) return sendError(res, HTTP.BAD_REQUEST, 'Cannot delete your own account from admin');

    try {
        const { data: userSites } = await supabase.from('sites').select('id').eq('user_id', userId);
        const siteIds = (userSites || []).map(s => s.id);

        if (siteIds.length > 0) {
            await supabase.from('site_categories').delete().in('site_id', siteIds);
            await supabase.from('site_tags').delete().in('site_id', siteIds);
        }

        await supabase.from('sites').delete().eq('user_id', userId);
        await supabase.from('categories').delete().eq('user_id', userId);
        await supabase.from('tags').delete().eq('user_id', userId);
        try { await supabase.from('profiles').delete().eq('id', userId); } catch { }

        const { error } = await supabase.auth.admin.deleteUser(userId);
        if (error) throw error;

        return sendOk(res);
    } catch (err) {
        console.error('Delete user error:', err);
        return sendError(res, HTTP.INTERNAL_ERROR, err.message || 'Failed to delete user');
    }
}
