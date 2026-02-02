/**
 * @fileoverview Health check API endpoint for service availability monitoring
 * Returns server status, timestamp, and uptime information
 */

// HTTP Status Codes
const HTTP_STATUS = {
    OK: 200,
    METHOD_NOT_ALLOWED: 405,
};

// Error Messages
const ERROR_MESSAGES = {
    METHOD_NOT_ALLOWED: 'Method not allowed',
};

// Response Field Names
const RESPONSE_FIELDS = {
    STATUS: 'status',
    TIMESTAMP: 'timestamp',
    UPTIME: 'uptime',
    ERROR: 'error',
};

// Health Status Values
const HEALTH_STATUS = {
    OK: 'ok',
    DEGRADED: 'degraded',
    ERROR: 'error',
};

/**
 * Get current server uptime in seconds
 * @returns {number} Server uptime in seconds
 */
function getServerUptime() {
    return process.uptime();
}

/**
 * Get current ISO timestamp
 * @returns {string} Current timestamp in ISO 8601 format
 */
function getCurrentTimestamp() {
    return new Date().toISOString();
}

/**
 * Build health check success response
 * @param {number} uptime - Server uptime in seconds
 * @param {string} timestamp - Current timestamp
 * @returns {Object} Health check response object
 */
function buildHealthResponse(uptime, timestamp) {
    return {
        [RESPONSE_FIELDS.STATUS]: HEALTH_STATUS.OK,
        [RESPONSE_FIELDS.TIMESTAMP]: timestamp,
        [RESPONSE_FIELDS.UPTIME]: uptime,
    };
}

/**
 * Build error response for invalid HTTP methods
 * @returns {Object} Error response object
 */
function buildMethodNotAllowedResponse() {
    return {
        [RESPONSE_FIELDS.ERROR]: ERROR_MESSAGES.METHOD_NOT_ALLOWED,
    };
}

/**
 * Validate HTTP method is GET
 * @param {string} method - HTTP request method
 * @returns {boolean} True if method is GET
 */
function isValidMethod(method) {
    return method === 'GET';
}

/**
 * Health check endpoint handler
 * @param {Object} req - Next.js request object
 * @param {Object} res - Next.js response object
 * @returns {void}
 */
export default function handler(req, res) {
    // Validate request method
    if (!isValidMethod(req.method)) {
        return res
            .status(HTTP_STATUS.METHOD_NOT_ALLOWED)
            .json(buildMethodNotAllowedResponse());
    }

    // Gather health metrics
    const uptime = getServerUptime();
    const timestamp = getCurrentTimestamp();

    // Return health status
    return res
        .status(HTTP_STATUS.OK)
        .json(buildHealthResponse(uptime, timestamp));
}
