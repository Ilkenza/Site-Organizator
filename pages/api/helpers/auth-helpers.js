// Helper to verify user from Authorization header
export async function verifyUserFromAuthHeader(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { success: false, error: 'Missing or invalid Authorization header' };
    }

    const token = authHeader.slice(7);

    try {
        // Decode JWT to get user ID (without verification - Supabase will verify on API calls)
        const parts = token.split('.');
        if (parts.length !== 3) {
            return { success: false, error: 'Invalid token format' };
        }

        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));

        if (!payload.sub) {
            return { success: false, error: 'No user ID in token' };
        }

        return {
            success: true,
            user: { id: payload.sub },
            token: token
        };
    } catch (err) {
        console.error('[auth-helpers] Token decode error:', err);
        return { success: false, error: 'Failed to decode token' };
    }
}
