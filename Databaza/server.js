/**
 * Site Organizer Database Server
 * Fetches all data from Supabase and makes it available through REST API
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Allowed values for pricing
const ALLOWED_PRICING = ['fully_free', 'paid', 'free_trial', 'freemium'];

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname))); // Serve static files from Database folder

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Error: SUPABASE_URL and SUPABASE_ANON_KEY must be defined in .env file');
    process.exit(1);
}

// Initialize Supabase client with Anon Key (for client side)
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Initialize Service Client (without RLS restrictions) - only for backend
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_KEY || supabaseAnonKey);

// Migration: Add 'categories' column if it doesn't exist
async function ensureCategoriesColumn() {
    try {
        // Try to query the table to see if the column exists
        const { data, error } = await supabaseAdmin
            .from('sites')
            .select('categories')
            .limit(1);

        // If the column is already there, no error
        if (!error) return;

        // If error contains "categories", I need to add the column
        if (error && error.message.includes('categories')) {
            // Use raw SQL through Supabase
            try {
                const { error: alterError } = await supabaseAdmin
                    .rpc('exec_sql', {
                        sql: 'ALTER TABLE sites ADD COLUMN IF NOT EXISTS categories TEXT;'
                    })
                    .catch(() => {
                        // RPC does not exist, skip
                        return { error: null };
                    });

                if (alterError) {
                    // Column may already exist
                }
            } catch (e) {
                // Migration attempt failed, will be done manually
            }
        }
    } catch (e) {
        // Column check failed, will be handled manually
    }
}

// Call migration on server startup
ensureCategoriesColumn();

// Migration: Add 'name' column if it doesn't exist
async function ensureNameColumn() {
    try {
        // Try to query the table to see if the column exists
        const { data, error } = await supabaseAdmin
            .from('sites')
            .select('name')
            .limit(1);

        // If the column is already there, no error
        if (!error) return;

        // If error contains "name", I need to add the column
        if (error && error.message.includes('name')) {
            // Use raw SQL through Supabase
            try {
                const { error: alterError } = await supabaseAdmin
                    .rpc('exec_sql', {
                        sql: 'ALTER TABLE sites ADD COLUMN IF NOT EXISTS name TEXT;'
                    })
                    .catch(() => {
                        // RPC does not exist, skip
                        return { error: null };
                    });

                if (alterError) {
                    // Column may already exist
                }
            } catch (e) {
                // Migration attempt failed, will be done manually
            }
        }
    } catch (e) {
        // Column check failed, will be handled manually
    }
}

// Call migration on server startup
ensureNameColumn();

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Debug endpoint - see what's available
app.get('/api/debug', async (req, res) => {
    try {
        const results = {};

        // Try sites
        try {
            const { data, error } = await supabaseAdmin
                .from('sites')
                .select('*')
                .limit(1);
            results.sites = error ? `❌ ${error.message}` : `✅ ${(data || []).length} rows`;
        } catch (e) {
            results.sites = `❌ ${e.message}`;
        }

        // Try categories
        try {
            const { data, error } = await supabaseAdmin
                .from('categories')
                .select('*')
                .limit(1);
            results.categories = error ? `❌ ${error.message}` : `✅ ${(data || []).length} rows`;
        } catch (e) {
            results.categories = `❌ ${e.message}`;
        }

        // Try tags
        try {
            const { data, error } = await supabaseAdmin
                .from('tags')
                .select('*')
                .limit(1);
            results.tags = error ? `❌ ${error.message}` : `✅ ${(data || []).length} rows`;
        } catch (e) {
            results.tags = `❌ ${e.message}`;
        }

        res.json(results);
    } catch (error) {
        res.json({ error: error.message });
    }
});

// Get all sites with categories and tags
app.get('/api/sites', async (req, res) => {
    try {
        // First load all sites
        const { data: sites, error: sitesError } = await supabaseAdmin
            .from('sites')
            .select('*')
            .order('created_at', { ascending: false });

        if (sitesError) throw sitesError;

        // For each site, load all categories and tags
        const sitesWithRelations = await Promise.all(
            sites.map(async (site) => {
                let categories = [];
                let tags = [];

                // Load all categories via junction table site_categories
                if (site.id) {
                    const { data: siteCategories } = await supabaseAdmin
                        .from('site_categories')
                        .select('categories(id, name, color)')
                        .eq('site_id', site.id);

                    categories = siteCategories?.map(sc => sc.categories).filter(Boolean) || [];
                }

                // Fallback: If no categories from junction table, use directly from JSONB
                if (categories.length === 0 && site.categories && Array.isArray(site.categories) && site.categories.length > 0) {
                    // Map each string to an object with name property
                    categories = site.categories.map(catName => ({ name: catName }));
                }

                // Load tags via junction table site_tags
                if (site.id) {
                    const { data: siteTags } = await supabaseAdmin
                        .from('site_tags')
                        .select('tags(id, name, color)')
                        .eq('site_id', site.id);

                    tags = siteTags?.map(st => st.tags).filter(Boolean) || [];
                }

                // Return site with all relationships
                return {
                    ...site,
                    categories_array: categories,
                    tags_array: tags,
                    category: categories.length > 0 ? categories[0].name : null,
                    tags: tags.length > 0 ? tags.map(t => t.name) : []
                };
            })
        );

        res.json({
            success: true,
            count: sitesWithRelations.length,
            data: sitesWithRelations
        });
    } catch (error) {
        console.error('Error loading sites:', error);
        res.json({
            success: true,
            count: 0,
            data: []
        });
    }
});

// Get all categories
app.get('/api/categories', async (req, res) => {
    try {
        const { data: categories, error } = await supabaseAdmin
            .from('categories')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({
            success: true,
            count: categories.length,
            data: categories || []
        });
    } catch (error) {
        console.error('Error loading categories:', error);
        res.json({ success: true, count: 0, data: [] });
    }
});

// Add new category
app.post('/api/categories', async (req, res) => {
    try {
        const { name, color } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                error: 'Category name is required'
            });
        }

        // Check if category already exists
        const { data: existing } = await supabaseAdmin
            .from('categories')
            .select('id')
            .ilike('name', name)
            .limit(1);

        if (existing && existing.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Category with this name already exists'
            });
        }

        const { data, error } = await supabaseAdmin
            .from('categories')
            .insert({
                name,

                color: color || '#6CBBFB'
            })
            .select();

        if (error) throw error;

        res.json({
            success: true,
            message: 'Category created successfully',
            data: data[0]
        });
    } catch (error) {
        console.error('Error creating category:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Edit category
app.put('/api/categories/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, color } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                error: 'Category name is required'
            });
        }

        const { data, error } = await supabaseAdmin
            .from('categories')
            .update({
                name,
                color: color || '#667eea'
            })
            .eq('id', id)
            .select();

        if (error) throw error;

        res.json({
            success: true,
            message: 'Category updated successfully',
            data: data[0] || {}
        });
    } catch (error) {
        console.error('Error updating category:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Delete category
app.delete('/api/categories/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabaseAdmin
            .from('categories')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({
            success: true,
            message: 'Category deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get all tags
app.get('/api/tags', async (req, res) => {
    try {
        const { data: tags, error } = await supabaseAdmin
            .from('tags')
            .select('*')
            .order('name');

        if (error) throw error;

        res.json({
            success: true,
            count: tags.length,
            data: tags || []
        });
    } catch (error) {
        console.error('Error loading tags:', error);
        res.json({ success: true, count: 0, data: [] });
    }
});

// Add new tag
app.post('/api/tags', async (req, res) => {
    try {
        const { name, color } = req.body;

        if (!name || name.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'Tag name is required'
            });
        }

        // Check if tag already exists
        const { data: existing } = await supabaseAdmin
            .from('tags')
            .select('id')
            .ilike('name', name.trim())
            .limit(1);

        if (existing && existing.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Tag with this name already exists'
            });
        }

        const { data, error } = await supabaseAdmin
            .from('tags')
            .insert({
                name: name.trim(),
                color: color || '#667eea'
            })
            .select();

        if (error) throw error;

        res.json({
            success: true,
            message: 'Tag created successfully',
            data: data[0]
        });
    } catch (error) {
        console.error('Error creating tag:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Edit tag
app.put('/api/tags/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, color } = req.body;

        if (!name || name.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'Tag name is required'
            });
        }

        const { data, error } = await supabaseAdmin
            .from('tags')
            .update({
                name: name.trim(),
                color: color || '#667eea'
            })
            .eq('id', id)
            .select();

        if (error) throw error;

        res.json({
            success: true,
            message: 'Tag updated successfully',
            data: data[0]
        });
    } catch (error) {
        console.error('Error updating tag:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Delete tag
app.delete('/api/tags/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // First delete all site_tags that use this tag
        const { error: tagsError } = await supabaseAdmin
            .from('site_tags')
            .delete()
            .eq('tag_id', id);

        if (tagsError) throw tagsError;

        // Then delete the tag itself
        const { error } = await supabaseAdmin
            .from('tags')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({
            success: true,
            message: 'Tag deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting tag:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Create new site with categories and tags
app.post('/api/sites', async (req, res) => {
    try {
        const { name, url, categories, tag_ids, tags, pricing, user_id } = req.body;

        // Validate user_id - must be valid UUID or null
        const validUserId = user_id && typeof user_id === 'string' && user_id !== 'null' && user_id.length === 36 ? user_id : null;

        // FIRST: If tags not passed, generate from tag_ids from tags table
        let tagsArray = tags;
        if (!tagsArray || !Array.isArray(tagsArray) || tagsArray.length === 0) {
            if (tag_ids && Array.isArray(tag_ids) && tag_ids.length > 0) {
                // Get tag names from tags table
                const { data: tagData } = await supabaseAdmin
                    .from('tags')
                    .select('id, name')
                    .in('id', tag_ids);
                tagsArray = tagData ? tagData.map(t => t.name) : [];
            }
        }



        // Validation
        if (!name || !url || !categories || !Array.isArray(categories) || categories.length === 0 || !tag_ids || !Array.isArray(tag_ids) || tag_ids.length === 0 || !tagsArray || !Array.isArray(tagsArray) || tagsArray.length === 0 || !pricing) {
            return res.status(400).json({
                success: false,
                error: 'Name, URL, categories array, tag_ids array, tags array, and pricing are required'
            });
        }

        if (!Array.isArray(ALLOWED_PRICING) || !ALLOWED_PRICING.includes(pricing)) {
            return res.status(400).json({
                success: false,
                error: `Pricing must be one of: ${ALLOWED_PRICING.join(', ')}`
            });
        }

        // Check if site with same URL already exists (regardless of user)
        const { data: existingSites, error: checkError } = await supabaseAdmin
            .from('sites')
            .select('id, url, pricing')
            .eq('url', url);

        if (checkError) {
            console.error('   Error checking for existing site:', checkError);
            throw checkError;
        }

        if (existingSites && existingSites.length > 0) {
            return res.status(409).json({
                success: false,
                error: 'This site already exists in your database!',
                existing: true
            });
        }

        // If site doesn't exist, create new one
        // Build insert object - only include user_id if it's valid
        const insertData = { name, url, pricing };
        if (validUserId) {
            insertData.user_id = validUserId;
        }

        const { data: site, error: siteError } = await supabaseAdmin
            .from('sites')
            .insert([insertData])
            .select();

        if (siteError) {
            throw siteError;
        }

        const siteId = site[0].id;

        // Find category IDs by names
        const { data: categoryData } = await supabaseAdmin
            .from('categories')
            .select('id, name')
            .in('name', categories);

        // Create site_categories links
        if (categoryData && categoryData.length > 0) {
            const siteCategories = categoryData.map(cat => ({
                site_id: siteId,
                category_id: cat.id
            }));

            const { error: catError } = await supabaseAdmin
                .from('site_categories')
                .insert(siteCategories);

            if (catError) throw catError;
        }

        // Delete old tags for this site if they existed
        const { error: deleteError } = await supabaseAdmin
            .from('site_tags')
            .delete()
            .eq('site_id', siteId);

        if (deleteError) {
            console.warn('Warning when deleting old tags:', deleteError.message);
            // Continue, this is not critical
        }

        // Create links between site and tags

        const siteTagsData = tag_ids.map(tag_id => ({
            site_id: siteId,
            tag_id
        }));

        const { data: tagInsertData, error: tagsError } = await supabaseAdmin
            .from('site_tags')
            .insert(siteTagsData)
            .select();

        if (tagsError) {
            console.error('   ❌ ERROR inserting tags:', tagsError.message);
            throw tagsError;
        }

        // Verify immediately
        const { data: verifyTagsData, error: verifyError } = await supabaseAdmin
            .from('site_tags')
            .select('id')
            .eq('site_id', siteId);

        // Update sites table with categories and tags JSON
        const categoriesJson = categoryData ? categoryData.map(c => c.name) : [];
        const tagsJson = tagsArray && Array.isArray(tagsArray) && tagsArray.length > 0 ? tagsArray : [];

        const { error: updateError } = await supabaseAdmin
            .from('sites')
            .update({
                categories: categoriesJson,
                tags: tagsJson
            })
            .eq('id', siteId);

        if (updateError) {
            console.warn('Warning updating categories/tags in sites table:', updateError.message);
            // Continue, this is not critical
        }

        res.status(201).json({
            success: true,
            message: 'Site created successfully',
            data: site[0]
        });
    } catch (error) {
        console.error('❌ Error creating site:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Delete site
app.delete('/api/sites/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabaseAdmin
            .from('sites')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({
            success: true,
            message: 'Site deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting site:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Edit site
app.put('/api/sites/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, url, tags, categories, pricing } = req.body;



        // Validate pricing value
        if (pricing && !ALLOWED_PRICING.includes(pricing)) {
            return res.status(400).json({
                success: false,
                error: `Invalid pricing value. Allowed values: ${ALLOWED_PRICING.join(', ')}`
            });
        }

        // Update site with name, URL and pricing (not categories, we'll handle that separately)
        const { data, error } = await supabaseAdmin
            .from('sites')
            .update({
                name: name || null,
                url,
                pricing: pricing,
                categories: Array.isArray(categories) && categories.length > 0
                    ? categories  // Save categories as JSONB array
                    : null
            })
            .eq('id', id)
            .select();

        if (error) throw error;

        // Handle categories via site_categories junction table
        if (Array.isArray(categories) && categories.length > 0) {
            // First delete all existing categories for this site
            const { error: deleteError } = await supabaseAdmin
                .from('site_categories')
                .delete()
                .eq('site_id', id);

            if (deleteError && deleteError.code !== 'PGRST116') throw deleteError;

            // Find category IDs by names
            const categoryNames = Array.isArray(categories) ? categories : [];

            const { data: categoryData, error: catSearchError } = await supabaseAdmin
                .from('categories')
                .select('id, name')
                .in('name', categoryNames);

            if (catSearchError) {
                throw catSearchError;
            }

            // Create site_categories links
            if (categoryData && categoryData.length > 0) {
                const siteCategories = categoryData.map(cat => ({
                    site_id: id,
                    category_id: cat.id
                }));

                const { error: catError, data: insertedData } = await supabaseAdmin
                    .from('site_categories')
                    .insert(siteCategories);

                if (catError) {
                    console.error('   ERROR inserting categories:', catError);
                    throw catError;
                }
            }
        } else {
            // If no categories, delete all existing
            const { error: deleteError } = await supabaseAdmin
                .from('site_categories')
                .delete()
                .eq('site_id', id);

            if (deleteError && deleteError.code !== 'PGRST116') throw deleteError;
        }

        // Handle tags via site_tags junction table
        // Instead of DELETE + INSERT, do a MERGE - add new ones, remove unselected ones
        if (Array.isArray(tags) && tags.length > 0) {

            // Get current tags for this site
            const { data: currentTagsData } = await supabaseAdmin
                .from('site_tags')
                .select('tag_id, tags(id, name)')
                .eq('site_id', id);

            const currentTagIds = currentTagsData?.map(st => st.tags?.id).filter(Boolean) || [];
            const currentTagNames = currentTagsData?.map(st => st.tags?.name).filter(Boolean) || [];

            // Log all available tags in database to debug
            const { data: allTagsInDB } = await supabaseAdmin
                .from('tags')
                .select('id, name');

            // Find tags user wants to add
            let tagsToAdd = [];
            if (tags.length > 0) {
                // Try exact match first
                const { data: exactMatch } = await supabaseAdmin
                    .from('tags')
                    .select('id, name')
                    .in('name', tags);

                tagsToAdd = exactMatch || [];

                // For any names not found, try case-insensitive search
                const foundNames = tagsToAdd.map(t => t.name);
                const missingNames = tags.filter(name => !foundNames.includes(name));

                if (missingNames.length > 0) {
                    for (const name of missingNames) {
                        const { data: caseInsensitiveMatch } = await supabaseAdmin
                            .from('tags')
                            .select('id, name')
                            .ilike('name', name)
                            .limit(1);

                        if (caseInsensitiveMatch && caseInsensitiveMatch.length > 0) {
                            tagsToAdd.push(caseInsensitiveMatch[0]);
                        }
                    }
                }
            }

            // Delete tags that are NOT in the new list
            const tagsToRemoveIds = currentTagIds.filter(currentId =>
                !tagsToAdd.some(t => t.id === currentId)
            );

            if (tagsToRemoveIds.length > 0) {
                const { error: removeError } = await supabaseAdmin
                    .from('site_tags')
                    .delete()
                    .eq('site_id', id)
                    .in('tag_id', tagsToRemoveIds);

                if (removeError && removeError.code !== 'PGRST116') {
                    console.error('   ❌ Error removing tags:', removeError);
                    throw removeError;
                }
            }

            // Add new tags that aren't already linked
            const tagsToInsert = tagsToAdd.filter(tag =>
                !currentTagIds.includes(tag.id)
            );

            if (tagsToInsert.length > 0) {
                const siteTags = tagsToInsert.map(tag => ({
                    site_id: id,
                    tag_id: tag.id
                }));

                const { data: insertData, error: tagError, status, statusText } = await supabaseAdmin
                    .from('site_tags')
                    .insert(siteTags)
                    .select();

                if (tagError) {
                    console.error('   ❌ ERROR inserting tags:', tagError.message);
                    console.error('   ❌ Full error details:', JSON.stringify(tagError));
                    throw tagError;
                } else {
                }

                // Double-check immediately after insert
                const { data: checkData, error: checkError } = await supabaseAdmin
                    .from('site_tags')
                    .select('id, site_id, tag_id')
                    .eq('site_id', id);

                if (checkError) {
                    console.error('   ⚠️ Error during verification:', checkError);
                }
            } else {
            }

            // Verify final state
            const { data: finalTags, error: finalError } = await supabaseAdmin
                .from('site_tags')
                .select('tags(id, name)')
                .eq('site_id', id);

            const finalTagNames = finalTags?.map(st => st.tags?.name).filter(Boolean) || [];
            const { error: updateTagsError } = await supabaseAdmin
                .from('sites')
                .update({ tags: finalTagNames })
                .eq('id', id);

            if (updateTagsError) {
                console.error('   ⚠️ Error updating tags in sites table:', updateTagsError);
            } else {
            }
        } else {
            // If no tags, delete all existing
            const { error: deleteError } = await supabaseAdmin
                .from('site_tags')
                .delete()
                .eq('site_id', id);

            if (deleteError && deleteError.code !== 'PGRST116') throw deleteError;
            const { error: updateTagsError } = await supabaseAdmin
                .from('sites')
                .update({ tags: [] })
                .eq('id', id);

            if (updateTagsError) {
                // Error clearing tags - continue anyway
            }
        }

        res.json({
            success: true,
            message: 'Site updated successfully',
            data: data[0] || {}
        });

    } catch (error) {
        console.error('❌ Error updating site:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get all data (complete export)
app.get('/api/export/all', async (req, res) => {
    try {
        const [sitesResult, categoriesResult, tagsResult, visitsResult] = await Promise.all([
            supabaseAdmin.from('sites').select('*'),
            supabaseAdmin.from('categories').select('*'),
            supabaseAdmin.from('tags').select('*'),
            supabaseAdmin.from('site_visits').select('*')
        ]);

        const sites = sitesResult.data || [];
        const categories = categoriesResult.data || [];
        const tags = tagsResult.data || [];
        const visits = visitsResult.data || [];

        const exportData = {
            timestamp: new Date().toISOString(),
            sites: sites,
            categories: categories,
            tags: tags,
            site_visits: visits,
            stats: {
                total_sites: sites.length,
                total_categories: categories.length,
                total_tags: tags.length,
                total_visits: visits.length
            }
        };

        res.json({
            success: true,
            data: exportData
        });
    } catch (error) {
        console.error('Error during data export:', error);
        res.json({
            success: true,
            data: {
                timestamp: new Date().toISOString(),
                sites: [],
                categories: [],
                tags: [],
                site_visits: [],
                stats: {
                    total_sites: 0,
                    total_categories: 0,
                    total_tags: 0,
                    total_visits: 0
                }
            }
        });
    }
});

// Get statistics
app.get('/api/stats', async (req, res) => {
    try {
        const [sites, categories, tags, visits] = await Promise.all([
            supabaseAdmin.from('sites').select('id', { count: 'exact' }),
            supabaseAdmin.from('categories').select('id', { count: 'exact' }),
            supabaseAdmin.from('tags').select('id', { count: 'exact' }),
            supabaseAdmin.from('site_visits').select('id', { count: 'exact' })
        ]);

        res.json({
            success: true,
            stats: {
                sites: sites.count || 0,
                categories: categories.count || 0,
                tags: tags.count || 0,
                visits: visits.count || 0
            }
        });
    } catch (error) {
        console.error('Error loading statistics:', error);
        res.status(500).json({ error: error.message });
    }
});

// Start server

// Show sites for specific category
app.get('/api/category/:name/sites', async (req, res) => {
    try {
        const categoryName = decodeURIComponent(req.params.name);
        // Find the category
        const { data: categoryData, error: categoryError } = await supabase
            .from('categories')
            .select('id, name')
            .eq('name', categoryName)
            .single();

        if (categoryError || !categoryData) {
            return res.status(404).json({
                success: false,
                error: 'Category not found'
            });
        }

        // Find all site_id values for this category from junction table site_categories
        const { data: siteCategories, error: junctionError } = await supabaseAdmin
            .from('site_categories')
            .select('site_id')
            .eq('category_id', categoryData.id);

        if (junctionError) {
            throw junctionError;
        }

        const siteIds = siteCategories?.map(sc => sc.site_id) || [];

        if (siteIds.length === 0) {
            return res.json({
                success: true,
                category: categoryData,
                data: []
            });
        }

        // Find all sites with those IDs
        const { data: sites, error: sitesError } = await supabaseAdmin
            .from('sites')
            .select('*')
            .in('id', siteIds)
            .order('created_at', { ascending: false });

        if (sitesError) {
            throw sitesError;
        }

        // For each site, load all tags and categories
        const sitesWithRelations = await Promise.all(
            (sites || []).map(async (site) => {
                let tags = [];
                let categories = [];

                // Load all tags
                const { data: siteTags } = await supabaseAdmin
                    .from('site_tags')
                    .select('tags(id, name, color)')
                    .eq('site_id', site.id);
                tags = siteTags?.map(st => st.tags).filter(Boolean) || [];

                // Load all categories
                const { data: siteCategories } = await supabaseAdmin
                    .from('site_categories')
                    .select('categories(id, name, color)')
                    .eq('site_id', site.id);
                categories = siteCategories?.map(sc => sc.categories).filter(Boolean) || [];

                return {
                    ...site,
                    tags: tags.map(t => t.name) || [],
                    tags_array: tags,  // Add complete objects with IDs for edit modal
                    categories_array: categories
                };
            })
        );

        const filteredSites = sitesWithRelations;

        res.json({
            success: true,
            category: categoryData,
            data: filteredSites
        });
    } catch (error) {
        console.error('Error fetching category sites:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Redirect /dashboard.html/* to /dashboard.html for category pages  
app.get('/dashboard.html/category/:categoryName', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
