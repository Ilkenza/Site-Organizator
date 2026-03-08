/** Upload user avatar to Supabase Storage and update profile */

import { HTTP, getSupabaseConfig, extractToken, decodeJwt, sendError, methodGuard } from './helpers/api-utils';

const BUCKET = 'avatars';
const CT = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };
const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB

// Magic bytes for image format validation
const MAGIC = {
    png: [0x89, 0x50, 0x4E, 0x47],
    jpg: [0xFF, 0xD8, 0xFF],
    jpeg: [0xFF, 0xD8, 0xFF],
    gif: [0x47, 0x49, 0x46],
    webp: null, // RIFF header checked separately
};

function isValidImage(buffer, ext) {
    if (!buffer?.length) return false;
    if (ext === 'webp') return buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
    const magic = MAGIC[ext];
    if (!magic) return false;
    return magic.every((b, i) => buffer[i] === b);
}

export default async function handler(req, res) {
    if (!methodGuard(req, res, 'POST')) return;

    const cfg = getSupabaseConfig();
    if (!cfg) return sendError(res, HTTP.INTERNAL_ERROR, 'Server not configured');

    const authHeader = req.headers.authorization;
    if (!authHeader) return sendError(res, HTTP.UNAUTHORIZED, 'Missing authorization header');

    const token = extractToken(authHeader);
    const payload = decodeJwt(token);
    if (!payload?.sub) return sendError(res, HTTP.UNAUTHORIZED, 'Invalid token');
    const userId = payload.sub;

    const { fileData, fileName } = req.body || {};
    if (!fileData || !fileName) return sendError(res, HTTP.BAD_REQUEST, 'Missing required fields');

    try {
        const base64 = fileData.split(',')[1] || fileData;
        const buffer = Buffer.from(base64, 'base64');

        // Validate file size
        if (buffer.length > MAX_AVATAR_BYTES) return sendError(res, HTTP.BAD_REQUEST, `File too large (max ${MAX_AVATAR_BYTES / 1024 / 1024}MB)`);

        const ext = fileName.split('.').pop()?.toLowerCase() || 'png';
        const contentType = CT[ext];
        if (!contentType) return sendError(res, HTTP.BAD_REQUEST, 'Unsupported file type. Allowed: png, jpg, jpeg, gif, webp');

        // Validate magic bytes
        if (!isValidImage(buffer, ext)) return sendError(res, HTTP.BAD_REQUEST, 'File content does not match declared type');

        const uploadName = `${userId}-${Date.now()}.${ext}`;

        // Upload to storage
        const uploadUrl = `${cfg.url}/storage/v1/object/${BUCKET}/${uploadName}`;
        const upRes = await fetch(uploadUrl, {
            method: 'POST',
            headers: { apikey: cfg.anonKey, Authorization: `Bearer ${token}`, 'Content-Type': contentType, 'x-upsert': 'true' },
            body: buffer,
        });
        if (!upRes.ok) throw new Error(await upRes.text());

        const publicUrl = `${cfg.url}/storage/v1/object/public/${BUCKET}/${uploadName}`;

        // Upsert profile
        const hdr = { apikey: cfg.anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' };
        const profileRes = await fetch(`${cfg.url}/rest/v1/profiles?id=eq.${userId}&select=id`, { headers: hdr });
        const profiles = await profileRes.json();

        if (profiles?.length > 0) {
            const r = await fetch(`${cfg.url}/rest/v1/profiles?id=eq.${userId}`, { method: 'PATCH', headers: { ...hdr, Prefer: 'return=representation' }, body: JSON.stringify({ avatar_url: publicUrl }) });
            if (!r.ok) throw new Error(await r.text());
        } else {
            const r = await fetch(`${cfg.url}/rest/v1/profiles`, { method: 'POST', headers: { ...hdr, Prefer: 'return=representation' }, body: JSON.stringify({ id: userId, avatar_url: publicUrl }) });
            if (!r.ok) throw new Error(await r.text());
        }

        return res.json({ success: true, avatar_url: publicUrl, message: 'Avatar uploaded successfully' });
    } catch (err) {
        console.error('Upload avatar error:', err);
        return sendError(res, HTTP.INTERNAL_ERROR, err.message);
    }
}
