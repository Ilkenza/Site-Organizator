/**
 * Verify and extract user information from Authorization header
 * @param {string} authHeader - The Authorization header value (e.g., "Bearer <token>")
 * @returns {Promise<{user: {id: string}, token: string} | null>} User info if valid, null otherwise
 */
export async function verifyUserFromAuthHeader(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.slice(7); // Remove 'Bearer ' prefix
    
    try {
        // For proper JWT verification, we should verify the signature using Supabase's auth API
        // This is more secure than just decoding the JWT payload
        const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            console.error('Missing Supabase environment variables');
            return null;
        }

        // Verify token using Supabase's auth endpoint
        const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'apikey': SUPABASE_ANON_KEY
            }
        });

        if (!response.ok) {
            console.error('Token verification failed:', response.status);
            return null;
        }

        const user = await response.json();
        
        if (!user || !user.id) {
            console.error('Invalid user data from token verification');
            return null;
        }

        return {
            user: {
                id: user.id,
                email: user.email,
                ...user
            },
            token
        };
    } catch (error) {
        console.error('Error verifying JWT token:', error);
        return null;
    }
}
