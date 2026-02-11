/** Share Target + Public Share page */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import { fetchAPI } from '../lib/supabase';
import { ArrowLeftIcon, GlobeIcon } from '../components/ui/Icons';

const getFaviconUrl = (url) => {
  try {
    const u = new URL(url);
    if (u.hostname === 'localhost' || !u.hostname.includes('.')) return null;
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=32`;
  } catch {
    return null;
  }
};

function PublicShareView({ token }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [share, setShare] = useState(null);
  const [sites, setSites] = useState([]);
  const [search, setSearch] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [savedIds, setSavedIds] = useState(new Set());

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await fetch(`/api/share?token=${encodeURIComponent(token)}`);
        if (!r.ok) {
          const errJson = await r.json().catch(() => null);
          const message = errJson?.error || errJson?.message || 'Failed to load shared sites';
          throw new Error(message);
        }
        const json = await r.json();
        if (!mounted) return;
        setShare(json.share || null);
        setSites(Array.isArray(json.sites) ? json.sites : []);
      } catch (err) {
        if (!mounted) return;
        setError(err.message || 'Failed to load shared sites');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [token]);

  const handleSave = async (site) => {
    if (!user) return;
    setSavingId(site.id);
    setError(null);
    try {
      await fetchAPI('/sites', {
        method: 'POST',
        body: JSON.stringify({
          name: site.name || 'Untitled',
          url: site.url,
          description: site.description || '',
          pricing: site.pricing || 'fully_free',
          user_id: user.id,
          category_ids: [],
          tag_ids: [],
        })
      });
      setSavedIds(prev => {
        const next = new Set(prev);
        next.add(site.id);
        return next;
      });
    } catch (err) {
      setError(err.message || 'Failed to save site');
    } finally {
      setSavingId(null);
    }
  };

  const filteredSites = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sites;
    return sites.filter(site => {
      const name = (site.name || '').toLowerCase();
      const url = (site.url || '').toLowerCase();
      return name.includes(q) || url.includes(q);
    });
  }, [search, sites]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-[96rem] mx-auto px-4 py-10">
        <div className="flex items-center justify-between gap-3 mb-2">
          <h1 className="text-2xl font-semibold text-app-text-primary">{share?.name || 'Shared Collection'}</h1>
          <Link
            href="/dashboard/sites"
            className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-app-border bg-app-bg-secondary/60 text-app-text-secondary hover:text-app-text-primary"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Back to dashboard
          </Link>
        </div>
        <p className="text-sm text-app-text-secondary mb-6">Readonly list of shared sites.</p>

        {!user && (
          <div className="mb-4 p-3 rounded-lg border border-app-border bg-app-bg-light/50 text-xs text-app-text-secondary">
            Sign in to save these sites to your collection. <Link href="/login" className="text-app-accent">Login</Link>
          </div>
        )}

        {loading && (
          <div className="text-sm text-app-text-secondary">Loading...</div>
        )}
        {error && (
          <div className="text-sm text-red-400 bg-red-900/20 border border-red-700/30 rounded-lg p-3 mb-4">
            {error}
          </div>
        )}

        {!loading && !error && sites.length > 0 && (
          <div className="mb-4">
            <input
              className="w-full sm:max-w-md px-3 py-2 bg-app-bg-secondary border border-app-border rounded text-sm text-app-text-primary"
              placeholder="Search shared sites..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}

        {!loading && !error && filteredSites.length === 0 && (
          <div className="text-sm text-app-text-tertiary">No sites found for this share.</div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-3 sm:gap-4">
          {filteredSites.map(site => (
            <div key={site.id} className="group h-full flex flex-col bg-app-bg-light/50 border-2 border-app-border rounded-xl p-4 transition-all duration-200 hover:shadow-lg hover:shadow-app-accent/5 hover:border-app-accent/30 hover:bg-app-bg-light">
              <div className="flex items-start gap-3 mb-3">
                <div className="relative flex-shrink-0 w-10 h-10 rounded-lg bg-app-bg-card flex items-center justify-center overflow-hidden">
                  <GlobeIcon className="w-5 h-5 text-app-accent/70" />
                  {site.url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={getFaviconUrl(site.url) || ''}
                      alt=""
                      width={24}
                      height={24}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="absolute w-6 h-6"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-app-text-primary truncate">{site.name || site.url}</div>
                  <a
                    href={site.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-app-text-secondary hover:text-app-accent truncate block"
                  >
                    {site.url}
                  </a>
                </div>
              </div>

              {site.description && (
                <p className="text-xs text-app-text-secondary line-clamp-2 mb-3">
                  {site.description}
                </p>
              )}

              <div className="flex flex-wrap gap-1 mb-3">
                {(site.categories || []).slice(0, 6).map(cat => (
                  <span key={cat.id || cat.name} className="text-[10px] px-2 py-0.5 rounded-full bg-app-bg-secondary text-app-text-secondary">
                    {cat.name}
                  </span>
                ))}
                {(site.tags || []).slice(0, 6).map(tag => (
                  <span key={tag.id || tag.name} className="text-[10px] px-2 py-0.5 rounded-full bg-app-bg-secondary text-app-text-tertiary">
                    {tag.name}
                  </span>
                ))}
              </div>

              <div className="mt-auto flex items-center gap-2">
                <a
                  href={site.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs px-2.5 py-1 rounded border border-app-border text-app-text-secondary hover:text-app-text-primary"
                >
                  Open
                </a>
                {user && (
                  <button
                    onClick={() => handleSave(site)}
                    disabled={savingId === site.id || savedIds.has(site.id)}
                    className={`text-xs px-2.5 py-1 rounded border transition-colors ${savedIds.has(site.id)
                      ? 'border-green-700/40 text-green-400'
                      : savingId === site.id
                        ? 'border-app-border text-app-text-tertiary'
                        : 'border-app-accent/30 text-app-accent hover:bg-app-accent/10'
                      }`}
                  >
                    {savedIds.has(site.id) ? 'Saved' : savingId === site.id ? 'Saving...' : 'Save to my sites'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ShareManager() {
  const [name, setName] = useState('');
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState(new Set());
  const [selectedTags, setSelectedTags] = useState(new Set());
  const [categorySearch, setCategorySearch] = useState('');
  const [tagSearch, setTagSearch] = useState('');
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [shareLink, setShareLink] = useState('');

  const origin = useMemo(() => (typeof window !== 'undefined' ? window.location.origin : ''), []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [catsRes, tagsRes, presetsRes] = await Promise.all([
        fetchAPI('/categories'),
        fetchAPI('/tags'),
        fetchAPI('/share'),
      ]);
      setCategories(catsRes?.data || []);
      setTags(tagsRes?.data || []);
      setPresets(presetsRes?.presets || []);
    } catch (err) {
      setError(err.message || 'Failed to load share data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleCategory = (id) => {
    setSelectedCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleTag = (id) => {
    setSelectedTags(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const createShare = async () => {
    setLoading(true);
    setError(null);
    setShareLink('');
    try {
      const res = await fetchAPI('/share', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim() || 'Shared Collection',
          categoryIds: Array.from(selectedCategories),
          tagIds: Array.from(selectedTags),
        })
      });
      const link = res?.link ? `${origin}${res.link}` : '';
      setShareLink(link);
      setName('');
      setSelectedCategories(new Set());
      setSelectedTags(new Set());
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to create share link');
    } finally {
      setLoading(false);
    }
  };

  const deleteShare = async (id) => {
    setLoading(true);
    setError(null);
    try {
      await fetchAPI(`/share?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to delete share');
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async (link) => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // ignore
    }
  };

  const filteredCategories = useMemo(() => {
    const q = categorySearch.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter(cat => (cat.name || '').toLowerCase().includes(q));
  }, [categories, categorySearch]);

  const filteredTags = useMemo(() => {
    const q = tagSearch.trim().toLowerCase();
    if (!q) return tags;
    return tags.filter(tag => (tag.name || '').toLowerCase().includes(q));
  }, [tagSearch, tags]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="mb-4">
          <Link
            href="/dashboard/sites"
            className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-app-border bg-app-bg-secondary/60 text-app-text-secondary hover:text-app-text-primary"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Back to dashboard
          </Link>
        </div>
        <h1 className="text-2xl font-semibold text-app-text-primary mb-2">Public Share</h1>
        <p className="text-sm text-app-text-secondary mb-6">Create a shareable link with selected categories and tags.</p>

        {error && (
          <div className="text-sm text-red-400 bg-red-900/20 border border-red-700/30 rounded-lg p-3 mb-4">
            {error}
          </div>
        )}

        <div className="bg-app-bg-light border border-app-border rounded-lg p-4 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-app-text-tertiary">Name</label>
              <input
                className="mt-1 w-full px-3 py-2 bg-app-bg-secondary border border-app-border rounded text-sm text-app-text-primary"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Design Resources"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={createShare}
                disabled={loading}
                className="w-full px-4 py-2.5 bg-app-accent/20 border border-app-accent/30 text-app-accent hover:bg-app-accent/30 rounded-lg transition-all text-sm font-medium"
              >
                {loading ? 'Creating...' : 'Create Share Link'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div>
              <div className="text-xs text-app-text-tertiary mb-2">Categories</div>
              <input
                className="mb-2 w-full px-2 py-1.5 bg-app-bg-secondary border border-app-border rounded text-xs text-app-text-primary"
                placeholder="Search categories..."
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
              />
              <div className="max-h-40 overflow-auto space-y-1">
                {filteredCategories.map(cat => (
                  <label key={cat.id} className="flex items-center gap-2 text-xs text-app-text-secondary">
                    <input
                      type="checkbox"
                      className="accent-app-accent"
                      checked={selectedCategories.has(cat.id)}
                      onChange={() => toggleCategory(cat.id)}
                    />
                    <span className="truncate">{cat.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs text-app-text-tertiary mb-2">Tags</div>
              <input
                className="mb-2 w-full px-2 py-1.5 bg-app-bg-secondary border border-app-border rounded text-xs text-app-text-primary"
                placeholder="Search tags..."
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
              />
              <div className="max-h-40 overflow-auto space-y-1">
                {filteredTags.map(tag => (
                  <label key={tag.id} className="flex items-center gap-2 text-xs text-app-text-secondary">
                    <input
                      type="checkbox"
                      className="accent-app-accent"
                      checked={selectedTags.has(tag.id)}
                      onChange={() => toggleTag(tag.id)}
                    />
                    <span className="truncate">{tag.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {shareLink && (
            <div className="mt-4 text-xs text-app-text-secondary">
              <div className="mb-1">Share link:</div>
              <div className="flex items-center gap-2">
                <input
                  className="flex-1 px-3 py-2 bg-app-bg-secondary border border-app-border rounded text-xs text-app-text-primary"
                  value={shareLink}
                  readOnly
                />
                <button
                  onClick={() => copyLink(shareLink)}
                  className="px-3 py-2 text-xs border border-app-border rounded text-app-text-secondary hover:text-app-text-primary"
                >
                  Copy
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-app-bg-light border border-app-border rounded-lg p-4">
          <div className="text-sm font-semibold text-app-text-primary mb-2">Your Share Links</div>
          {presets.length === 0 && (
            <div className="text-xs text-app-text-tertiary">No share links created yet.</div>
          )}
          <div className="space-y-2">
            {presets.map(preset => {
              const link = `${origin}/share?token=${preset.token}`;
              return (
                <div key={preset.id} className="flex items-center justify-between gap-3 text-xs text-app-text-secondary">
                  <div className="truncate">
                    <div className="text-app-text-primary font-semibold truncate">{preset.name}</div>
                    <div className="truncate">{link}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyLink(link)}
                      className="px-2 py-1 border border-app-border rounded hover:text-app-text-primary"
                    >
                      Copy
                    </button>
                    <button
                      onClick={() => deleteShare(preset.id)}
                      className="px-2 py-1 border border-red-700/40 text-red-400 rounded hover:text-red-300"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SharePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const { token, url, title, text } = router.query;
  const isPublic = typeof token === 'string' && token.length > 0;
  const isShareTarget = !isPublic && (url || title || text);

  useEffect(() => {
    if (isPublic) return;
    if (loading) return;

    if (isShareTarget) {
      if (!user) {
        const params = new URLSearchParams(window.location.search).toString();
        router.replace(`/login?redirect=/share${params ? `?${params}` : ''}`);
        return;
      }

      let sharedUrl = url || '';
      if (!sharedUrl && text) {
        const urlMatch = String(text).match(/https?:\/\/[^\s]+/);
        if (urlMatch) sharedUrl = urlMatch[0];
      }

      const params = new URLSearchParams();
      if (sharedUrl) params.set('addUrl', sharedUrl);
      if (title) params.set('addTitle', title);

      router.replace(`/dashboard/sites?${params.toString()}`);
    }
  }, [isPublic, isShareTarget, loading, router, text, title, url, user]);

  if (isPublic) return <PublicShareView token={token} />;

  if (isShareTarget || loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-app-accent/30 border-t-app-accent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Saving your link...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-3">Sign in to create share links.</p>
          <Link href="/login" className="px-4 py-2 rounded-lg border border-app-border text-app-text-secondary">Go to login</Link>
        </div>
      </div>
    );
  }

  return <ShareManager />;
}
