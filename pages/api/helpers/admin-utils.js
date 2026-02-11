/**
 * Shared admin utilities — used by all admin API endpoints.
 */

import { createClient } from '@supabase/supabase-js';
import { HTTP, extractToken, decodeJwt, getAdminEmails, sendError } from './api-utils';

let _client = null;

export function getAdminClient() {
    if (_client) return _client;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) return null;
    _client = createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });
    return _client;
}

export async function verifyAdmin(req, supabase) {
    const token = extractToken(req.headers.authorization);
    if (!token) return { error: 'Missing authorization', status: HTTP.UNAUTHORIZED };

    const payload = decodeJwt(token);
    if (!payload?.sub) return { error: 'Invalid token', status: HTTP.UNAUTHORIZED };

    const { data, error } = await supabase.auth.admin.getUserById(payload.sub);
    if (error || !data?.user?.email) return { error: 'User not found', status: HTTP.UNAUTHORIZED };

    const email = data.user.email.toLowerCase();
    if (!getAdminEmails().includes(email)) return { error: 'Access denied', status: HTTP.FORBIDDEN };

    return { userId: payload.sub, email };
}

/** Standard admin route guard — checks method, client, and admin auth. Returns { supabase, auth } or null (already sent error). */
export async function adminGuard(req, res, method = 'POST') {
    if (req.method !== method) {
        sendError(res, HTTP.METHOD_NOT_ALLOWED, 'Method not allowed');
        return null;
    }
    const supabase = getAdminClient();
    if (!supabase) {
        sendError(res, HTTP.INTERNAL_ERROR, 'Server configuration error');
        return null;
    }
    const auth = await verifyAdmin(req, supabase);
    if (auth.error) {
        sendError(res, auth.status, auth.error);
        return null;
    }
    return { supabase, auth };
}
