import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        return res.status(500).json({ error: 'Missing Supabase credentials' });
    }

    // Extract user's JWT token from Authorization header
    const authHeader = req.headers.authorization;
    const userToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: {
            headers: userToken ? { Authorization: `Bearer ${userToken}` } : {}
        }
    });
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
                console.log('[FAVORITES] site_id:', site_id, 'type:', typeof site_id);

                // Get ALL sites first to see what we have
                const { data: allSites, error: allError } = await supabase
                    .from('sites')
                    .select('id');

                console.log('[FAVORITES] Total sites in DB:', allSites?.length || 0);
                console.log('[FAVORITES] Sample IDs:', allSites?.slice(0, 3).map(s => ({ id: s.id, type: typeof s.id })));

                if (allError) {
                    console.error('Error fetching all sites:', allError);
                }

                // Get current favorite status with exact ID
                const { data: siteData, error: fetchError } = await supabase
                    .from('sites')
                    .select('id, is_favorite')
                    .eq('id', site_id);

                console.log('[FAVORITES] Query result for', site_id, ':', siteData?.length || 0, 'matches');

                if (fetchError) {
                    console.error('[FAVORITES] Fetch error:', fetchError);
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
                    console.error('Update error:', updateError);
                    throw updateError;
                }

                return res.status(200).json({ favorite: !site.is_favorite });
            } catch (err) {
                console.error('Favorites toggle error:', err);
                throw err;
            }
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (err) {
        console.error('Favorites API error:', err);
        return res.status(500).json({ error: err.message });
    }
}
