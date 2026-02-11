/**
 * Authentication helper — JWT token decoding (signature verified by Supabase on API calls).
 */

import { extractToken, decodeJwt } from './api-utils';

export async function verifyUserFromAuthHeader(authHeader) {
    const token = extractToken(authHeader);
    if (!token) return { success: false, error: 'Missing or invalid Authorization header' };

    const payload = decodeJwt(token);
    if (!payload) return { success: false, error: 'Failed to decode token' };

    const userId = payload.sub;
    if (!userId) return { success: false, error: 'No user ID in token' };

    return { success: true, user: { id: userId }, token };
}
