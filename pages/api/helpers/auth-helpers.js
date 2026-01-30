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
        // Decode JWT to extract user information
        // JWT structure: header.payload.signature
        const parts = token.split('.');
        if (parts.length !== 3) {
            console.error('Invalid JWT format');
            return null;
        }

        // Decode the payload (second part)
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        
        // Verify token hasn't expired
        if (payload.exp && payload.exp * 1000 < Date.now()) {
            console.error('Token has expired');
            return null;
        }

        // Extract user ID from payload
        const userId = payload.sub || payload.user_id;
        if (!userId) {
            console.error('No user ID found in token');
            return null;
        }

        return {
            user: {
                id: userId,
                email: payload.email,
                ...payload
            },
            token
        };
    } catch (error) {
        console.error('Error verifying JWT token:', error);
        return null;
    }
}
