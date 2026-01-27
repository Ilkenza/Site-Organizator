import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        return res.status(500).json({ error: 'Missing Supabase credentials' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    try {
        // GET - Fetch all favorite sites
        if (req.method === 'GET') {
            const { data, error } = await supabase
                .from('sites')
                .select('id')
                .eq('is_favorite', true);

            if (error) throw error;
            return res.status(200).json(data || []);
        }

        // POST - Toggle favorite status
        if (req.method === 'POST') {
            const { site_id } = req.body;

            if (!site_id) {
                return res.status(400).json({ error: 'site_id is required' });
            }

            try {
                // Get ALL sites first to see what we have
                const { data: allSites, error: allError } = await supabase
                    .from('sites')
                    .select('id');

                if (allError) {
                }

                // Get current favorite status with exact ID
                const { data: siteData, error: fetchError } = await supabase
                    .from('sites')
                    .select('id, is_favorite')
                    .eq('id', site_id);

                if (fetchError) {
                    throw fetchError;
                }

                if (!siteData || siteData.length === 0) {
                    return res.status(404).json({
                        error: 'Site not found',
                        debug: { site_id, totalSites: allSites?.length || 0 }
                    });
                }

                const site = siteData[0];

                // Toggle favorite
                const { error: updateError, data: updatedData } = await supabase
                    .from('sites')
                    .update({ is_favorite: !site.is_favorite })
                    .eq('id', site_id.toString())
                    .select('is_favorite');

                if (updateError) {
                    throw updateError;
                }

                return res.status(200).json({ favorite: !site.is_favorite });
            } catch (err) {
                throw err;
            }
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
