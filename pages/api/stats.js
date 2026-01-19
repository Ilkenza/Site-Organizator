const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function getCount(table) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?select=id`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'count=exact'
      }
    }
  );

  const count = response.headers.get('content-range');
  if (count) {
    const match = count.match(/\/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  const data = await response.json();
  return Array.isArray(data) ? data.length : 0;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const [sites, categories, tags] = await Promise.all([
      getCount('sites'),
      getCount('categories'),
      getCount('tags')
    ]);

    res.status(200).json({
      success: true,
      stats: { sites, categories, tags }
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stats: { sites: 0, categories: 0, tags: 0 }
    });
  }
}
