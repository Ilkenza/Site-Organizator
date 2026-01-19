import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

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

        if (!supabaseUrl || !supabaseServiceKey) {
            return res.status(500).json({
                error: 'Server not configured',
                details: 'Missing Supabase credentials'
            });
        }

        const { fileData, fileName, userId } = req.body;

        if (!fileData || !fileName || !userId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Verify user from auth header
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const token = authHeader.replace('Bearer ', '');

        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user || user.id !== userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Convert base64 to Buffer
        const base64Data = fileData.split(',')[1] || fileData;
        const fileBuffer = Buffer.from(base64Data, 'base64');

        // Upload to storage with service key (has permission)
        const fileExt = fileName.split('.').pop() || 'png';
        const uploadFileName = `${userId}-${Date.now()}.${fileExt}`;
        const filePath = uploadFileName;

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, fileBuffer, {
                cacheControl: '3600',
                upsert: true,
                contentType: 'image/*',
            });

        if (uploadError) {
            console.error('Upload error:', uploadError);
            return res.status(500).json({ error: uploadError.message });
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);

        // First, check if profile exists
        const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', userId)
            .maybeSingle();

        // If profile doesn't exist, create it first
        if (!existingProfile) {
            const { error: insertError } = await supabase
                .from('profiles')
                .insert({ id: userId, avatar_url: publicUrl });

            if (insertError) {
                console.error('Profile creation error:', insertError);
                return res.status(500).json({ error: insertError.message });
            }
        } else {
            // Profile exists, update it
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ avatar_url: publicUrl })
                .eq('id', userId);

            if (updateError) {
                console.error('Profile update error:', updateError);
                return res.status(500).json({ error: updateError.message });
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
