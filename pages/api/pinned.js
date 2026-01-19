import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        return res.status(500).json({ error: 'Missing Supabase credentials' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    try {
        // GET - Fetch all pinned sites sorted by position
        if (req.method === 'GET') {
            const { data, error } = await supabase
                .from('sites')
                .select('id')
                .eq('is_pinned', true)
                .order('pin_position', { ascending: true });

            if (error) throw error;
            return res.status(200).json(data || []);
        }

        // POST - Toggle pinned status
        if (req.method === 'POST') {
            const { site_id } = req.body;

            if (!site_id) {
                return res.status(400).json({ error: 'site_id is required' });
            }

            try {
                // Get current pinned status
                const { data: siteData, error: fetchError } = await supabase
                    .from('sites')
                    .select('id, is_pinned, pin_position')
                    .eq('id', site_id.toString());

                if (fetchError) {
                    console.error('Fetch error:', fetchError);
                    throw fetchError;
                }

                if (!siteData || siteData.length === 0) {
                    return res.status(404).json({ error: 'Site not found', query: { site_id, received_type: typeof site_id } });
                }

                const site = siteData[0];

                if (site.is_pinned) {
                    // Unpinned - just set is_pinned to false
                    const { error: updateError } = await supabase
                        .from('sites')
                        .update({ is_pinned: false, pin_position: 0 })
                        .eq('id', site_id.toString());

                    if (updateError) throw updateError;
                    return res.status(200).json({ pinned: false });
                } else {
                    // Pinned - set is_pinned to true and find next position
                    const { data: maxPositionData, error: maxError } = await supabase
                        .from('sites')
                        .select('pin_position')
                        .eq('is_pinned', true)
                        .order('pin_position', { ascending: false })
                        .limit(1);

                    const maxPos = maxPositionData && maxPositionData.length > 0 ? maxPositionData[0].pin_position : -1;
                    const nextPosition = maxPos + 1;

                    const { error: updateError } = await supabase
                        .from('sites')
                        .update({ is_pinned: true, pin_position: nextPosition })
                        .eq('id', site_id.toString());

                    if (updateError) throw updateError;
                    return res.status(200).json({ pinned: true });
                }
            } catch (err) {
                console.error('Pinned toggle error:', err);
                throw err;
            }
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (err) {
        console.error('Pinned API error:', err);
        return res.status(500).json({ error: err.message });
    }
}
