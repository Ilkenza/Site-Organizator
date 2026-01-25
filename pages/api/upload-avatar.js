// API endpoint for uploading user avatars
// Uses user's JWT token with anon key (RLS-compliant)

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Get auth header
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'Missing authorization header' });
        }

        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            return res.status(500).json({
                error: 'Server not configured',
                details: 'Missing Supabase credentials'
            });
        }

        const userToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

        // Decode JWT to get user ID
        let userId;
        try {
            const payload = JSON.parse(Buffer.from(userToken.split('.')[1], 'base64').toString());
            userId = payload.sub;
            if (!userId) {
                return res.status(401).json({ error: 'Invalid token - no user ID' });
            }
        } catch (err) {
            return res.status(401).json({ error: 'Invalid token format' });
        }

        const { fileData, fileName } = req.body;

        if (!fileData || !fileName) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Convert base64 to Buffer
        const base64Data = fileData.split(',')[1] || fileData;
        const fileBuffer = Buffer.from(base64Data, 'base64');

        // Determine content type
        const fileExt = fileName.split('.').pop()?.toLowerCase() || 'png';
        const contentTypeMap = {
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'gif': 'image/gif',
            'webp': 'image/webp'
        };
        const contentType = contentTypeMap[fileExt] || 'image/png';

        const uploadFileName = `${userId}-${Date.now()}.${fileExt}`;

        // Upload to storage using REST API with user's token
        const uploadUrl = `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/avatars/${uploadFileName}`;

        const uploadResponse = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${userToken}`,
                'Content-Type': contentType,
                'x-upsert': 'true'
            },
            body: fileBuffer
        });

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            console.error('Upload error:', uploadResponse.status, errorText);
            return res.status(500).json({ error: 'Failed to upload file', details: errorText });
        }

        // Get public URL
        const publicUrl = `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/avatars/${uploadFileName}`;

        // Update profile with new avatar URL using REST API
        const profileUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/profiles?id=eq.${userId}`;

        // First check if profile exists
        const checkResponse = await fetch(profileUrl + '&select=id', {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${userToken}`,
                'Accept': 'application/json'
            }
        });

        const existingProfiles = await checkResponse.json();

        if (!existingProfiles || existingProfiles.length === 0) {
            // Create new profile
            const insertUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/profiles`;
            const insertResponse = await fetch(insertUrl, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${userToken}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify({ id: userId, avatar_url: publicUrl })
            });

            if (!insertResponse.ok) {
                const errorText = await insertResponse.text();
                console.error('Profile creation error:', errorText);
                return res.status(500).json({ error: 'Failed to create profile', details: errorText });
            }
        } else {
            // Update existing profile
            const updateResponse = await fetch(profileUrl, {
                method: 'PATCH',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${userToken}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify({ avatar_url: publicUrl })
            });

            if (!updateResponse.ok) {
                const errorText = await updateResponse.text();
                console.error('Profile update error:', errorText);
                return res.status(500).json({ error: 'Failed to update profile', details: errorText });
            }
        }

        return res.status(200).json({
            success: true,
            avatar_url: publicUrl,
            message: 'Avatar uploaded successfully'
        });

    } catch (error) {
        console.error('Upload avatar error:', error);
        return res.status(500).json({
            error: error.message
        });
    }
}
