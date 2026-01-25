import { useState, useEffect } from 'react';
import Head from 'next/head';
import { DashboardProvider, useDashboard } from '../context/DashboardContext';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/layout/Sidebar';
import Header from '../components/layout/Header';
import SitesList from '../components/sites/SitesList';
import FavoritesList from '../components/sites/FavoritesList';
import SiteModal from '../components/sites/SiteModal';
import CategoriesList from '../components/categories/CategoriesList';
import CategoryModal from '../components/categories/CategoryModal';
import TagsList from '../components/tags/TagsList';
import TagModal from '../components/tags/TagModal';
import SettingsPanel from '../components/settings/SettingsPanel';
import { ConfirmModal } from '../components/ui/Modal';
import Toast from '../components/ui/Toast';

function DashboardContent() {
  const {
    activeTab,
    fetchData,
    loading,
    error,
    deleteSite,
    deleteCategory,
    deleteTag,
    toast,
    selectedCategory,
    selectedTag
  } = useDashboard();

  // Modal states
  const [siteModalOpen, setSiteModalOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingSite, setEditingSite] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingTag, setEditingTag] = useState(null);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, type: null, item: null });
  const [deleting, setDeleting] = useState(false);

  // Listen for openAddSiteModal event from Sidebar
  useEffect(() => {
    const handleOpenAddModal = () => {
      setSiteModalOpen(true);
    };
    window.addEventListener('openAddSiteModal', handleOpenAddModal);
    return () => window.removeEventListener('openAddSiteModal', handleOpenAddModal);
  }, []);

  // Fetch data on mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle add button click
  const handleAddClick = () => {
    switch (activeTab) {
      case 'sites':
        setEditingSite(null);
        setSiteModalOpen(true);
        break;
      case 'favorites':
        setEditingSite(null);
        setSiteModalOpen(true);
        break;
      case 'categories':
        setEditingCategory(null);
        setCategoryModalOpen(true);
        break;
      case 'tags':
        setEditingTag(null);
        setTagModalOpen(true);
        break;
    }
  };

  // Site handlers
  const handleEditSite = (site) => {
    setEditingSite(site);
    setSiteModalOpen(true);
  };

  const handleDeleteSite = (site) => {
    setDeleteConfirm({ open: true, type: 'site', item: site });
  };

  // Category handlers
  const handleEditCategory = (category) => {
    setEditingCategory(category);
    setCategoryModalOpen(true);
  };

  // Tag handlers
  const handleEditTag = (tag) => {
    setEditingTag(tag);
    setTagModalOpen(true);
  };

  // Confirm delete
  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      switch (deleteConfirm.type) {
        case 'site':
          await deleteSite(deleteConfirm.item.id);
          break;
        case 'category':
          await deleteCategory(deleteConfirm.item.id);
          break;
        case 'tag':
          await deleteTag(deleteConfirm.item.id);
          break;
      }
      setDeleteConfirm({ open: false, type: null, item: null });
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  // Render content based on active tab
  const renderContent = () => {
    switch (activeTab) {
      case 'sites':
        return <SitesList onEdit={handleEditSite} onDelete={handleDeleteSite} />;
      case 'favorites':
        return <FavoritesList onEdit={handleEditSite} onDelete={handleDeleteSite} />;
      case 'categories':
        return <CategoriesList onEdit={handleEditCategory} />;
      case 'tags':
        return <TagsList onEdit={handleEditTag} />;
      case 'settings':
        return <SettingsPanel key="settings-panel" />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      {/* Toast notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => { }}
        />
      )}
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <Header onAddClick={handleAddClick} onMenuClick={() => setSidebarOpen(true)} />

        {/* Content area */}
        <main className="flex-1 overflow-y-auto">
          {error && (
            <div className="m-3 sm:m-6 p-3 sm:p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-300">
              <p className="font-medium">Error loading data</p>
              <p className="text-sm mt-1">{error}</p>
              <button
                onClick={fetchData}
                className="mt-2 text-sm text-red-400 hover:text-red-300 underline"
              >
                Try again
              </button>
            </div>
          )}

          {renderContent()}
        </main>
      </div>

      {/* Modals */}
      <SiteModal
        isOpen={siteModalOpen}
        onClose={() => {
          setSiteModalOpen(false);
          setEditingSite(null);
        }}
        site={editingSite}
        defaultFavorite={activeTab === 'favorites'}
        defaultCategoryId={selectedCategory}
        defaultTagId={selectedTag}
      />

      <CategoryModal
        isOpen={categoryModalOpen}
        onClose={() => {
          setCategoryModalOpen(false);
          setEditingCategory(null);
        }}
        category={editingCategory}
      />

      <TagModal
        isOpen={tagModalOpen}
        onClose={() => {
          setTagModalOpen(false);
          setEditingTag(null);
        }}
        tag={editingTag}
      />

      <ConfirmModal
        isOpen={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, type: null, item: null })}
        onConfirm={handleConfirmDelete}
        title={`Delete ${deleteConfirm.type}?`}
        message={`Are you sure you want to delete "${deleteConfirm.item?.name || ''}"? This action cannot be undone.`}
        confirmText="Delete"
        loading={deleting}
      />
    </div>
  );
}

export default function Dashboard() {
  const { user, loading, supabase } = useAuth();
  const [authChecked, setAuthChecked] = useState(false);
  const [hasTokens, setHasTokens] = useState(false);

  // IMMEDIATE check on mount - check localStorage synchronously
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const supabaseUrlEnv = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const storageKey = `sb-${supabaseUrlEnv.replace(/^"|"$/g, '').split('//')[1].split('.')[0]}-auth-token`;
      const storedTokens = localStorage.getItem(storageKey);
      if (storedTokens) {
        const tokens = JSON.parse(storedTokens);
        if (tokens?.access_token && tokens?.user) {
          console.log('[Dashboard] Immediate token check: FOUND valid tokens');
          setHasTokens(true);
          setAuthChecked(true); // Tokens exist, so we're "checked"
          return;
        }
      }
      console.log('[Dashboard] Immediate token check: NO valid tokens found');
    } catch (e) {
      console.warn('[Dashboard] Error in immediate token check:', e);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let isMounted = true;

    // Helper to check if tokens exist in localStorage (indicates valid session even if SDK doesn't see it yet)
    const hasLocalStorageTokens = () => {
      try {
        const supabaseUrlEnv = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const storageKey = `sb-${supabaseUrlEnv.replace(/^"|"$/g, '').split('//')[1].split('.')[0]}-auth-token`;
        const storedTokens = localStorage.getItem(storageKey);
        if (storedTokens) {
          const tokens = JSON.parse(storedTokens);
          // Check if tokens have user and access_token (valid session)
          if (tokens?.access_token && tokens?.user) {
            console.log('[Dashboard] Found valid tokens in localStorage');
            return true;
          }
        }
      } catch (e) {
        console.warn('[Dashboard] Error checking localStorage tokens:', e);
      }
      return false;
    };

    // Timeout fallback: ensure authChecked is set after max 3 seconds
    // This prevents infinite loading if auth check hangs
    const timeoutFallback = setTimeout(() => {
      if (isMounted && !authChecked) {
        console.warn('[Dashboard] Auth check timed out after 3s, forcing authChecked to true');
        setAuthChecked(true);
        // If tokens exist, trust them
        if (hasLocalStorageTokens()) {
          setHasTokens(true);
        }
      }
    }, 3000);

    // Add a small delay to allow session to propagate after redirect
    const checkAuth = async () => {
      if (!loading) {
        if (!user && supabase) {
          // CRITICAL: Check localStorage FIRST before redirecting
          // After MFA login, tokens are in localStorage but SDK may not have processed them yet
          if (hasLocalStorageTokens()) {
            console.log('[Dashboard] Tokens exist in localStorage, waiting for AuthContext to process...');
            // Don't redirect - tokens exist, just wait for AuthContext to catch up
            // Try to help by calling getSession which may trigger onAuthStateChange
            try {
              const { data } = await supabase.auth.getSession();
              if (data?.session) {
                console.log('[Dashboard] Session recovered via getSession');
              } else {
                // Try setSession with localStorage tokens as a fallback
                try {
                  const supabaseUrlEnv = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
                  const storageKey = `sb-${supabaseUrlEnv.replace(/^"|"$/g, '').split('//')[1].split('.')[0]}-auth-token`;
                  const tokens = JSON.parse(localStorage.getItem(storageKey));
                  if (tokens?.access_token && tokens?.refresh_token) {
                    console.log('[Dashboard] Attempting setSession with localStorage tokens...');
                    await supabase.auth.setSession({
                      access_token: tokens.access_token,
                      refresh_token: tokens.refresh_token
                    });

                    // After setting session, ensure MFA requirement is met. If the account has enrolled factors
                    // and the current authenticator assurance level is not 'aal2', redirect to /login
                    try {
                      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
                      console.log('[Dashboard] AAL status after setSession:', aalData);

                      if (aalData?.currentLevel !== 'aal2') {
                        try {
                          const { data: factors } = await supabase.auth.mfa.listFactors();
                          const hasFactors = Array.isArray(factors) && factors.length > 0;
                          console.log('[Dashboard] MFA factors found:', hasFactors);
                          if (hasFactors) {
                            console.warn('[Dashboard] Account requires MFA but current level is not AAL2 — redirecting to /login');
                            if (isMounted) setAuthChecked(true);
                            window.location.href = '/login';
                            return;
                          }
                        } catch (fErr) {
                          console.warn('[Dashboard] Error checking MFA factors:', fErr);
                        }
                      }
                    } catch (aalErr) {
                      console.warn('[Dashboard] Error checking AAL after setSession:', aalErr);
                    }
                  }
                } catch (setSessionErr) {
                  console.warn('[Dashboard] setSession fallback failed:', setSessionErr);
                }
              }
            } catch (e) {
              console.warn('[Dashboard] getSession during token wait failed:', e);
            }
            // Set authChecked but don't redirect - let AuthContext handle it
            if (isMounted) setAuthChecked(true);
            return;
          }

          // No tokens in localStorage - do final SDK check before redirecting
          try {
            const { data } = await supabase.auth.getSession();
            if (!data?.session) {
              // Double-check localStorage one more time (race condition)
              if (hasLocalStorageTokens()) {
                console.log('[Dashboard] Late localStorage token found, not redirecting');
                if (isMounted) setAuthChecked(true);
                return;
              }
              console.log('No session found after final check, redirecting to login');
              if (isMounted) setAuthChecked(true); // Set before redirect
              window.location.href = '/login';
              return;
            }
            // If session found, AuthContext will update user via onAuthStateChange
          } catch (e) {
            console.warn('Final session check failed:', e);
            // Even on error, check localStorage before redirecting
            if (hasLocalStorageTokens()) {
              console.log('[Dashboard] localStorage tokens exist despite SDK error, not redirecting');
              if (isMounted) setAuthChecked(true);
              return;
            }
            if (isMounted) setAuthChecked(true); // Set before redirect
            window.location.href = '/login';
            return;
          }
        }
        if (isMounted) setAuthChecked(true);
      } else {
        // If still loading, try again after a short delay (but respect the 5s timeout)
        setTimeout(() => {
          if (isMounted && !authChecked) {
            checkAuth();
          }
        }, 200);
      }
    };

    // Longer delay after MFA to allow session to propagate (300ms instead of 100ms)
    const timer = setTimeout(checkAuth, 300);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      clearTimeout(timeoutFallback);
    };
  }, [user, loading, supabase, authChecked]);

  // Show loading ONLY if:
  // 1. We're still checking auth AND
  // 2. We don't have user AND
  // 3. We don't have tokens in localStorage (hasTokens state)
  if (!authChecked && !user && !hasTokens) {
    console.log('[Dashboard] Showing loading: authChecked=', authChecked, ', user=', !!user, ', hasTokens=', hasTokens);
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderColor: '#6CBBFB' }}></div>
      </div>
    );
  }

  // If no user and no tokens, redirect to login
  if (!user && !hasTokens) {
    console.log('[Dashboard] No user and no tokens, returning null (will redirect)');
    return null;
  }

  // At this point, either we have user OR hasTokens is true
  // Render the dashboard - AuthContext will populate user when ready
  console.log('[Dashboard] Rendering dashboard: user=', !!user, ', hasTokens=', hasTokens);

  return (
    <>
      <Head>
        <title>Dashboard | Site Organizer</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <DashboardProvider>
        <DashboardContent />
      </DashboardProvider>
    </>
  );
}

export async function getServerSideProps() {
  // Prevent static prerendering for dashboard (client-only auth state)
  return { props: {} };
}
