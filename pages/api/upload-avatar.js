/**
 * @fileoverview API endpoint for uploading user avatars
 * Uploads avatar to Supabase Storage and updates user profile
 */

// HTTP Status Codes
const HTTP_STATUS = {
    OK: 200,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    METHOD_NOT_ALLOWED: 405,
    INTERNAL_ERROR: 500
};

// Error Messages
const ERROR_MESSAGES = {
    METHOD_NOT_ALLOWED: 'Method not allowed',
    MISSING_AUTH: 'Missing authorization header',
    MISSING_ENV: 'Server not configured',
    INVALID_TOKEN_FORMAT: 'Invalid token format',
    INVALID_TOKEN_NO_USER: 'Invalid token - no user ID',
    MISSING_FIELDS: 'Missing required fields',
    UPLOAD_FAILED: 'Failed to upload file',
    PROFILE_CREATE_FAILED: 'Failed to create profile',
    PROFILE_UPDATE_FAILED: 'Failed to update profile'
};

// Configuration
const AVATAR_CONFIG = {
    STORAGE_BUCKET: 'avatars',
    DEFAULT_EXTENSION: 'png',
    SELECT_FIELD: 'id',
    CONTENT_TYPE_MAP: {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        webp: 'image/webp'
    }
};

/**
 * Extract JWT token from Authorization header
 * @param {string} authHeader - Authorization header value
 * @returns {string} JWT token
 */
const extractToken = (authHeader) => {
    return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
};

/**
 * Decode JWT token to extract user ID
 * @param {string} token - JWT token
 * @returns {string} User ID from token payload
 * @throws {Error} If token is invalid or missing user ID
 */
const decodeUserId = (token) => {
    const payload = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64').toString()
    );

    const userId = payload.sub;
    if (!userId) {
        throw new Error(ERROR_MESSAGES.INVALID_TOKEN_NO_USER);
    }

    return userId;
};

/**
 * Build clean Supabase base URL
 * @param {string} url - Raw Supabase URL
 * @returns {string} Clean URL without trailing slash
 */
const buildBaseUrl = (url) => url.replace(/\/$/, '');

/**
 * Extract file extension from filename
 * @param {string} fileName - Original filename
 * @returns {string} File extension (lowercase)
 */
const extractFileExtension = (fileName) => {
    return fileName.split('.').pop()?.toLowerCase() || AVATAR_CONFIG.DEFAULT_EXTENSION;
};

/**
 * Determine content type from file extension
 * @param {string} extension - File extension
 * @returns {string} MIME content type
 */
const getContentType = (extension) => {
    return AVATAR_CONFIG.CONTENT_TYPE_MAP[extension] ||
        AVATAR_CONFIG.CONTENT_TYPE_MAP[AVATAR_CONFIG.DEFAULT_EXTENSION];
};

/**
 * Convert base64 data to Buffer
 * @param {string} fileData - Base64 encoded file data
 * @returns {Buffer} File buffer
 */
const convertBase64ToBuffer = (fileData) => {
    const base64Data = fileData.split(',')[1] || fileData;
    return Buffer.from(base64Data, 'base64');
};

/**
 * Generate unique filename for avatar
 * @param {string} userId - User ID
 * @param {string} extension - File extension
 * @returns {string} Unique filename
 */
const generateFileName = (userId, extension) => {
    return `${userId}-${Date.now()}.${extension}`;
};

/**
 * Upload file to Supabase Storage
 * @param {string} baseUrl - Supabase base URL
 * @param {string} anonKey - Anon key
 * @param {string} userToken - User JWT token
 * @param {string} fileName - Upload filename
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} contentType - Content type
 * @returns {Promise<void>}
 * @throws {Error} If upload fails
 */
const uploadToStorage = async (
    baseUrl,
    anonKey,
    userToken,
    fileName,
    fileBuffer,
    contentType
) => {
    const uploadUrl = `${baseUrl}/storage/v1/object/${AVATAR_CONFIG.STORAGE_BUCKET}/${fileName}`;

    const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
            'apikey': anonKey,
            'Authorization': `Bearer ${userToken}`,
            'Content-Type': contentType,
            'x-upsert': 'true'
        },
        body: fileBuffer
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Upload error:', response.status, errorText);
        throw new Error(errorText);
    }
};

/**
 * Build public URL for uploaded file
 * @param {string} baseUrl - Supabase base URL
 * @param {string} fileName - Upload filename
 * @returns {string} Public URL
 */
const buildPublicUrl = (baseUrl, fileName) => {
    return `${baseUrl}/storage/v1/object/public/${AVATAR_CONFIG.STORAGE_BUCKET}/${fileName}`;
};

/**
 * Check if user profile exists
 * @param {string} baseUrl - Supabase base URL
 * @param {string} anonKey - Anon key
 * @param {string} userToken - User JWT token
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} True if profile exists
 */
const checkProfileExists = async (baseUrl, anonKey, userToken, userId) => {
    const profileUrl = `${baseUrl}/rest/v1/profiles?id=eq.${userId}&select=${AVATAR_CONFIG.SELECT_FIELD}`;

    const response = await fetch(profileUrl, {
        headers: {
            'apikey': anonKey,
            'Authorization': `Bearer ${userToken}`,
            'Accept': 'application/json'
        }
    });

    const profiles = await response.json();
    return profiles && profiles.length > 0;
};

/**
 * Create new user profile with avatar URL
 * @param {string} baseUrl - Supabase base URL
 * @param {string} anonKey - Anon key
 * @param {string} userToken - User JWT token
 * @param {string} userId - User ID
 * @param {string} avatarUrl - Avatar public URL
 * @returns {Promise<void>}
 * @throws {Error} If profile creation fails
 */
const createProfile = async (baseUrl, anonKey, userToken, userId, avatarUrl) => {
    const insertUrl = `${baseUrl}/rest/v1/profiles`;

    const response = await fetch(insertUrl, {
        method: 'POST',
        headers: {
            'apikey': anonKey,
            'Authorization': `Bearer ${userToken}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify({ id: userId, avatar_url: avatarUrl })
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Profile creation error:', errorText);
        throw new Error(errorText);
    }
};

/**
 * Update existing user profile with new avatar URL
 * @param {string} baseUrl - Supabase base URL
 * @param {string} anonKey - Anon key
 * @param {string} userToken - User JWT token
 * @param {string} userId - User ID
 * @param {string} avatarUrl - Avatar public URL
 * @returns {Promise<void>}
 * @throws {Error} If profile update fails
 */
const updateProfile = async (baseUrl, anonKey, userToken, userId, avatarUrl) => {
    const updateUrl = `${baseUrl}/rest/v1/profiles?id=eq.${userId}`;

    const response = await fetch(updateUrl, {
        method: 'PATCH',
        headers: {
            'apikey': anonKey,
            'Authorization': `Bearer ${userToken}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify({ avatar_url: avatarUrl })
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Profile update error:', errorText);
        throw new Error(errorText);
    }
};

/**
 * Update or create user profile with avatar URL
 * @param {string} baseUrl - Supabase base URL
 * @param {string} anonKey - Anon key
 * @param {string} userToken - User JWT token
 * @param {string} userId - User ID
 * @param {string} avatarUrl - Avatar public URL
 * @returns {Promise<void>}
 */
const upsertProfileAvatar = async (baseUrl, anonKey, userToken, userId, avatarUrl) => {
    const profileExists = await checkProfileExists(baseUrl, anonKey, userToken, userId);

    if (profileExists) {
        await updateProfile(baseUrl, anonKey, userToken, userId, avatarUrl);
    } else {
        await createProfile(baseUrl, anonKey, userToken, userId, avatarUrl);
    }
};

/**
 * Build success response
 * @param {string} avatarUrl - Avatar public URL
 * @returns {Object} Success response
 */
const buildSuccessResponse = (avatarUrl) => {
    return {
        success: true,
        avatar_url: avatarUrl,
        message: 'Avatar uploaded successfully'
    };
};

/**
 * Handle POST request - upload avatar
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {string} baseUrl - Supabase base URL
 * @param {string} anonKey - Anon key
 * @returns {Promise<void>}
 */
const handlePostRequest = async (req, res, baseUrl, anonKey) => {
    // Validate auth header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
            error: ERROR_MESSAGES.MISSING_AUTH
        });
    }

    // Extract and decode token
    let userId;
    try {
        const userToken = extractToken(authHeader);
        userId = decodeUserId(userToken);
    } catch (err) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
            error: ERROR_MESSAGES.INVALID_TOKEN_FORMAT
        });
    }

    // Validate request body
    const { fileData, fileName } = req.body;
    if (!fileData || !fileName) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
            error: ERROR_MESSAGES.MISSING_FIELDS
        });
    }

    try {
        // Prepare file upload
        const fileBuffer = convertBase64ToBuffer(fileData);
        const fileExt = extractFileExtension(fileName);
        const contentType = getContentType(fileExt);
        const uploadFileName = generateFileName(userId, fileExt);

        // Upload to storage
        const userToken = extractToken(authHeader);
        await uploadToStorage(
            baseUrl,
            anonKey,
            userToken,
            uploadFileName,
            fileBuffer,
            contentType
        );

        // Get public URL
        const publicUrl = buildPublicUrl(baseUrl, uploadFileName);

        // Update profile
        await upsertProfileAvatar(baseUrl, anonKey, userToken, userId, publicUrl);

        // Return success
        const response = buildSuccessResponse(publicUrl);
        return res.status(HTTP_STATUS.OK).json(response);
    } catch (error) {
        console.error('Upload processing error:', error);
        return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
            error: error.message
        });
    }
};

/**
 * Main API handler for avatar upload
 * @param {Object} req - Next.js request object
 * @param {Object} res - Next.js response object
 * @returns {Promise<void>}
 */
export default async function handler(req, res) {
    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_ANON_KEY =
        process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
            error: ERROR_MESSAGES.MISSING_ENV,
            details: 'Missing Supabase credentials'
        });
    }

    if (req.method !== 'POST') {
        return res.status(HTTP_STATUS.METHOD_NOT_ALLOWED).json({
            error: ERROR_MESSAGES.METHOD_NOT_ALLOWED
        });
    }

    const baseUrl = buildBaseUrl(SUPABASE_URL);

    try {
        return await handlePostRequest(req, res, baseUrl, SUPABASE_ANON_KEY);
    } catch (error) {
        console.error('Upload avatar error:', error);
        return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
            error: error.message
        });
    }
}
