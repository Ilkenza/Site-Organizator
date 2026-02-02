/**
 * @fileoverview Authentication helper utilities for JWT token handling
 */

// Constants
const AUTH_CONSTANTS = {
    BEARER_PREFIX: 'Bearer ',
    BEARER_PREFIX_LENGTH: 7,
    JWT_PARTS_COUNT: 3,
    JWT_PAYLOAD_INDEX: 1,
    ENCODING: 'base64',
    CHARSET: 'utf8',
};

const ERROR_MESSAGES = {
    MISSING_HEADER: 'Missing or invalid Authorization header',
    INVALID_FORMAT: 'Invalid token format',
    NO_USER_ID: 'No user ID in token',
    DECODE_FAILED: 'Failed to decode token',
};

// Helper Functions

/**
 * Extract token from Authorization header
 * @param {string} authHeader - Authorization header value
 * @returns {string|null} Extracted token or null
 */
function extractToken(authHeader) {
    if (!authHeader || !authHeader.startsWith(AUTH_CONSTANTS.BEARER_PREFIX)) {
        return null;
    }
    return authHeader.slice(AUTH_CONSTANTS.BEARER_PREFIX_LENGTH);
}

/**
 * Parse JWT token parts
 * @param {string} token - JWT token string
 * @returns {Array<string>|null} Token parts or null if invalid
 */
function parseTokenParts(token) {
    const parts = token.split('.');
    return parts.length === AUTH_CONSTANTS.JWT_PARTS_COUNT ? parts : null;
}

/**
 * Decode JWT payload from base64
 * @param {string} payloadPart - Base64 encoded payload
 * @returns {Object|null} Decoded payload or null
 */
function decodePayload(payloadPart) {
    try {
        const decoded = Buffer.from(
            payloadPart,
            AUTH_CONSTANTS.ENCODING
        ).toString(AUTH_CONSTANTS.CHARSET);
        return JSON.parse(decoded);
    } catch (err) {
        return null;
    }
}

/**
 * Extract user ID from JWT payload
 * @param {Object} payload - Decoded JWT payload
 * @returns {string|null} User ID or null
 */
function extractUserId(payload) {
    return payload?.sub || null;
}

/**
 * Create error response
 * @param {string} error - Error message
 * @returns {Object} Error response object
 */
function createErrorResponse(error) {
    return { success: false, error };
}

/**
 * Create success response
 * @param {string} userId - User ID
 * @param {string} token - JWT token
 * @returns {Object} Success response object
 */
function createSuccessResponse(userId, token) {
    return {
        success: true,
        user: { id: userId },
        token,
    };
}

// Main Export

/**
 * Verify user from Authorization header by decoding JWT token
 * Note: This does NOT verify the token signature - Supabase will verify on API calls
 * @param {string} authHeader - Authorization header value (e.g., "Bearer xyz...")
 * @returns {Promise<Object>} Result object with success, user, token, or error
 */
export async function verifyUserFromAuthHeader(authHeader) {
    // Extract token
    const token = extractToken(authHeader);
    if (!token) {
        return createErrorResponse(ERROR_MESSAGES.MISSING_HEADER);
    }

    // Parse JWT parts
    const parts = parseTokenParts(token);
    if (!parts) {
        return createErrorResponse(ERROR_MESSAGES.INVALID_FORMAT);
    }

    // Decode payload
    const payload = decodePayload(parts[AUTH_CONSTANTS.JWT_PAYLOAD_INDEX]);
    if (!payload) {
        console.error('[auth-helpers] Failed to decode JWT payload');
        return createErrorResponse(ERROR_MESSAGES.DECODE_FAILED);
    }

    // Extract user ID
    const userId = extractUserId(payload);
    if (!userId) {
        return createErrorResponse(ERROR_MESSAGES.NO_USER_ID);
    }

    return createSuccessResponse(userId, token);
}
