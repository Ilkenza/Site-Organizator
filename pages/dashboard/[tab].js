import { useState, useEffect, Component } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { DashboardProvider, useDashboard } from '../../context/DashboardContext';
import { useAuth } from '../../context/AuthContext';
import Sidebar from '../../components/layout/Sidebar';
import Header from '../../components/layout/Header';
import MobileToolbar from '../../components/layout/MobileToolbar';
import SitesList from '../../components/sites/SitesList';
import FavoritesList from '../../components/sites/FavoritesList';
import SiteModal from '../../components/sites/SiteModal';
import CategoriesList from '../../components/categories/CategoriesList';
import CategoryModal from '../../components/categories/CategoryModal';
import TagsList from '../../components/tags/TagsList';
import TagModal from '../../components/tags/TagModal';
import SettingsPanel from '../../components/settings/SettingsPanel';
import { ConfirmModal } from '../../components/ui/Modal';
import Toast from '../../components/ui/Toast';
import CommandMenu from '../../components/ui/CommandMenu';
import UndoToast from '../../components/ui/UndoToast';
import OnboardingTour from '../../components/ui/OnboardingTour';

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-300">
                    <p className="font-medium">Something went wrong.</p>
                </div>
            );
        }
        return this.props.children;
    }
}

function DashboardContent() {
    const router = useRouter();
    const { tab } = router.query;

    const {
        activeTab,
        setActiveTab,
        fetchData,
        _loading,
        error,
        deleteSite,
        deleteCategory,
        deleteTag,
        toast,
        selectedCategory,
        selectedTag,
        multiSelectMode,
        setMultiSelectMode,
        sites,
        categories,
        tags,
        selectedSites: _selectedSites,
        setSelectedSites,
        selectedCategories: _selectedCategories,
        setSelectedCategories,
        selectedTags: _selectedTags,
        setSelectedTags,
        setSites,
        setCategories,
        setTags
    } = useDashboard();

    // Sync activeTab with URL
    useEffect(() => {
        if (tab && ['sites', 'categories', 'tags', 'favorites', 'settings'].includes(tab)) {
            setActiveTab(tab);
        }
    }, [tab, setActiveTab]);

    // Modal states
    const [siteModalOpen, setSiteModalOpen] = useState(false);
    const [categoryModalOpen, setCategoryModalOpen] = useState(false);
    const [tagModalOpen, setTagModalOpen] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [editingSite, setEditingSite] = useState(null);
    const [editingCategory, setEditingCategory] = useState(null);
    const [editingTag, setEditingTag] = useState(null);
    const [commandMenuOpen, setCommandMenuOpen] = useState(false);
    const [undoToast, setUndoToast] = useState(null);

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

    // Keyboard shortcuts - Command menu (Ctrl+/)
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Just N key - opens appropriate modal based on active tab
            if (e.key === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
                // Only if not typing in input/textarea
                const activeElement = document.activeElement;
                if (activeElement?.tagName !== 'INPUT' && activeElement?.tagName !== 'TEXTAREA') {
                    e.preventDefault();

                    if (activeTab === 'sites' || activeTab === 'favorites') {
                        setEditingSite(null);
                        setSiteModalOpen(true);
                    } else if (activeTab === 'categories') {
                        setEditingCategory(null);
                        setCategoryModalOpen(true);
                    } else if (activeTab === 'tags') {
                        setEditingTag(null);
                        setTagModalOpen(true);
                    }
                    // Do nothing in settings tab
                }
            }

            // Command menu toggle
            if (e.ctrlKey && e.key === '/') {
                e.preventDefault();
                setCommandMenuOpen(prev => !prev);
            }
            // Search (Ctrl+K)
            if (e.ctrlKey && e.key === 'k') {
                e.preventDefault();
                // Focus main search input in Header
                const headerSearch = document.querySelector('input[placeholder*="Search sites"], input[placeholder*="Search categories"], input[placeholder*="Search tags"]');
                if (headerSearch) {
                    headerSearch.focus();
                    headerSearch.select?.();
                }
            }
            // Multi-select mode (M)
            if (e.key === 'm' && !e.ctrlKey && !e.metaKey && !e.altKey) {
                const activeElement = document.activeElement;
                if (activeElement?.tagName !== 'INPUT' && activeElement?.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    setMultiSelectMode(prev => !prev);
                }
            }
            // Select all (Ctrl+A) in multi-select mode
            if (e.ctrlKey && e.key === 'a' && multiSelectMode) {
                e.preventDefault();
                if (activeTab === 'sites' || activeTab === 'favorites') {
                    const allSiteIds = new Set(sites.map(s => s.id));
                    setSelectedSites(allSiteIds);
                } else if (activeTab === 'categories') {
                    const allCategoryIds = new Set(categories.map(c => c.id));
                    setSelectedCategories(allCategoryIds);
                } else if (activeTab === 'tags') {
                    const allTagIds = new Set(tags.map(t => t.id));
                    setSelectedTags(allTagIds);
                }
            }
            // Deselect all (Ctrl+D)
            if (e.ctrlKey && e.key === 'd') {
                e.preventDefault();
                setSelectedSites(new Set());
                setSelectedCategories(new Set());
                setSelectedTags(new Set());
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [multiSelectMode, activeTab, sites, categories, tags, setMultiSelectMode, setSelectedSites, setSelectedCategories, setSelectedTags]);



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

    // Confirm delete with undo support
    const handleConfirmDelete = async () => {
        setDeleting(true);
        // Deep clone the entire item with all nested arrays and properties
        const deletedItem = JSON.parse(JSON.stringify(deleteConfirm.item));
        const deletedType = deleteConfirm.type;
        const deletedId = deleteConfirm.item.id;

        try {
            // Remove from UI immediately (optimistic update)
            // Item stays in Supabase until timer expires or toast is closed
            switch (deletedType) {
                case 'site':
                    setSites(prev => prev.filter(s => s.id !== deletedId));
                    break;
                case 'category':
                    setCategories(prev => prev.filter(c => c.id !== deletedId));
                    break;
                case 'tag':
                    setTags(prev => prev.filter(t => t.id !== deletedId));
                    break;
            }

            // Set up timeout for actual Supabase deletion (after 5 seconds)
            const deleteTimeout = setTimeout(async () => {
                try {
                    switch (deletedType) {
                        case 'site':
                            await deleteSite(deletedId);
                            break;
                        case 'category':
                            await deleteCategory(deletedId);
                            break;
                        case 'tag':
                            await deleteTag(deletedId);
                            break;
                    }
                } catch (err) {
                    console.error('Failed to delete from database:', err);
                    await fetchData();
                }
            }, 5000);

            // Show undo toast
            setUndoToast({
                message: `${deletedType.charAt(0).toUpperCase() + deletedType.slice(1)} deleted`,
                onUndo: async () => {
                    // Cancel the deletion timeout and restore item
                    clearTimeout(deleteTimeout);
                    // Item is still in Supabase, just restore to UI
                    switch (deletedType) {
                        case 'site':
                            setSites(prev => [...prev, deletedItem].sort((a, b) => a.name.localeCompare(b.name)));
                            break;
                        case 'category':
                            setCategories(prev => [...prev, deletedItem].sort((a, b) => a.name.localeCompare(b.name)));
                            break;
                        case 'tag':
                            setTags(prev => [...prev, deletedItem].sort((a, b) => a.name.localeCompare(b.name)));
                            break;
                    }
                    setUndoToast(null);
                },
                onClose: async () => {
                    // User manually closed toast - delete from Supabase immediately
                    clearTimeout(deleteTimeout);
                    try {
                        switch (deletedType) {
                            case 'site':
                                await deleteSite(deletedId);
                                break;
                            case 'category':
                                await deleteCategory(deletedId);
                                break;
                            case 'tag':
                                await deleteTag(deletedId);
                                break;
                        }
                    } catch (err) {
                        console.error('Failed to delete from database:', err);
                        await fetchData();
                    }
                }
            });

            setDeleteConfirm({ open: false, type: null, item: null });
        } catch (err) {
            alert('Failed to delete: ' + err.message);
        } finally {
            setDeleting(false);
        }
    };

    // Command menu action handler
    const handleCommandMenuAction = (action) => {
        switch (action) {
            case 'new-site':
                setEditingSite(null);
                setSiteModalOpen(true);
                setCommandMenuOpen(false);
                break;
            case 'new-category':
                setEditingCategory(null);
                setCategoryModalOpen(true);
                setCommandMenuOpen(false);
                break;
            case 'new-tag':
                setEditingTag(null);
                setTagModalOpen(true);
                setCommandMenuOpen(false);
                break;
            default:
                break;
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
                return (
                    <ErrorBoundary>
                        <SettingsPanel key="settings-panel" />
                    </ErrorBoundary>
                );
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

                {/* Mobile Toolbar - Search and Add button on mobile only */}
                <MobileToolbar onAddClick={handleAddClick} />

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

            {/* Command Menu */}
            <CommandMenu
                isOpen={commandMenuOpen}
                onClose={() => setCommandMenuOpen(false)}
                onAction={handleCommandMenuAction}
            />

            {/* Undo Toast */}
            {undoToast && (
                <UndoToast
                    message={undoToast.message}
                    onUndo={undoToast.onUndo}
                    onClose={() => setUndoToast(null)}
                />
            )}
        </div>
    );
}

export default function Dashboard() {
    const { user, loading, supabase } = useAuth();
    const [authChecked, setAuthChecked] = useState(false);
    const [hasTokens, setHasTokens] = useState(false);
    const [redirecting, setRedirecting] = useState(false);

    // CRITICAL: Check MFA flag IMMEDIATELY before any rendering
    const mfaInProgress = typeof window !== 'undefined' && (
        sessionStorage.getItem('mfa_verification_in_progress') === 'true' ||
        localStorage.getItem('mfa_verification_in_progress') === 'true'
    );

    // If MFA is in progress, show loading and redirect to login
    useEffect(() => {
        if (mfaInProgress && !redirecting) {
            console.log('[Dashboard] 🔒 MFA in progress detected - redirecting to login');
            setRedirecting(true);
            window.location.replace('/login');
        }
    }, [mfaInProgress, redirecting]);

    // REMOVED: needsMfa check - login page handles MFA flow
    // The login page will show MFA screen if user has MFA enabled

    // REMOVED: Immediate AAL check - now MFA is optional, users without MFA can have AAL1 tokens
    // The AuthContext and later checks handle MFA validation correctly

    // IMMEDIATE check on mount - check localStorage synchronously
    useEffect(() => {
        if (typeof window === 'undefined') return;

        let isMounted = true;

        try {
            const supabaseUrlEnv = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
            const storageKey = `sb-${supabaseUrlEnv.replace(/^"|"$/g, '').split('//')[1].split('.')[0]}-auth-token`;
            const storedTokens = localStorage.getItem(storageKey);
            if (storedTokens) {
                const tokens = JSON.parse(storedTokens);
                if (tokens?.access_token && tokens?.user) {
                    setHasTokens(true);

                    // Try to set session immediately and verify MFA/AAL. If MFA is required but AAL<2, redirect to login.
                    (async () => {
                        try {
                            // CRITICAL: Don't process session if MFA verification is in progress
                            const mfaInProgress = sessionStorage.getItem('mfa_verification_in_progress') === 'true' ||
                                localStorage.getItem('mfa_verification_in_progress') === 'true';

                            if (mfaInProgress) {
                                console.log('[Dashboard] 🔒 MFA verification in progress - redirecting to login page');
                                if (isMounted) setAuthChecked(true);
                                window.location.href = '/login';
                                return;
                            }

                            // Wrap setSession in a timeout to prevent indefinite blocking
                            const SET_SESSION_TIMEOUT = 3000;
                            const setSessionPromise = supabase.auth.setSession({
                                access_token: tokens.access_token,
                                refresh_token: tokens.refresh_token
                            });
                            const timeoutPromise = new Promise((_, reject) =>
                                setTimeout(() => reject(new Error('setSession timeout')), SET_SESSION_TIMEOUT)
                            );

                            await Promise.race([setSessionPromise, timeoutPromise]);

                            try {
                                // REMOVED: AAL check - login page handles MFA flow
                                // Just log for debugging
                                console.log('[Dashboard] Session restored from localStorage');
                            } catch (aalErr) {
                                console.warn('[Dashboard] Error after immediate setSession:', aalErr);
                            }

                            if (isMounted) setAuthChecked(true);
                        } catch (e) {
                            console.warn('[Dashboard] Immediate setSession failed:', e?.message || e);
                            // If it's a timeout, don't clear tokens - just let AuthContext handle it
                            if (e?.message === 'setSession timeout') {
                                if (isMounted) setAuthChecked(true);
                                return;
                            }
                            // If setSession fails with an actual error, clear tokens and redirect to login for safety
                            try {
                                localStorage.removeItem(storageKey);
                            } catch (remErr) { console.warn('[Dashboard] Failed to clear tokens:', remErr); }
                            if (isMounted) setAuthChecked(true);
                            window.location.href = '/login';
                        }
                    })();

                    return;
                }
            }
        } catch (e) {
            console.warn('[Dashboard] Error in immediate token check:', e);
        }

        return () => {
            isMounted = false;
        };
    }, [supabase]);

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
                        // Don't redirect - tokens exist, just wait for AuthContext to catch up
                        // Try to help by calling getSession which may trigger onAuthStateChange
                        try {
                            const { data } = await supabase.auth.getSession();
                            if (!data?.session) {
                                // Try setSession with localStorage tokens as a fallback
                                try {
                                    const supabaseUrlEnv = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
                                    const storageKey = `sb-${supabaseUrlEnv.replace(/^"|"$/g, '').split('//')[1].split('.')[0]}-auth-token`;
                                    const tokens = JSON.parse(localStorage.getItem(storageKey));
                                    if (tokens?.access_token && tokens?.refresh_token) {
                                        await supabase.auth.setSession({
                                            access_token: tokens.access_token,
                                            refresh_token: tokens.refresh_token
                                        });

                                        // After setting session, ensure MFA requirement is met. If the account has enrolled factors
                                        // and the current authenticator assurance level is not 'aal2', redirect to /login
                                        try {
                                            const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

                                            // Only require AAL2 if user has MFA enabled
                                            if (aalData?.currentLevel !== 'aal2') {
                                                try {
                                                    const { data: factorsData } = await supabase.auth.mfa.listFactors();
                                                    const totpFactor = factorsData?.totp?.find(f => f.status === 'verified');
                                                    const hasMFA = !!totpFactor;

                                                    // Only redirect if user HAS MFA but isn't verified
                                                    if (hasMFA) {
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
                                if (isMounted) setAuthChecked(true);
                                return;
                            }
                            if (isMounted) setAuthChecked(true); // Set before redirect
                            window.location.href = '/login';
                            return;
                        }
                        // If session found, AuthContext will update user via onAuthStateChange
                    } catch (e) {
                        console.warn('Final session check failed:', e);
                        // Even on error, check localStorage before redirecting
                        if (hasLocalStorageTokens()) {
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

    // Show loading when:
    // - MFA verification is in progress
    // - we are still checking auth and user is not set (previous behavior)
    // - or we are redirecting
    if (mfaInProgress || redirecting || (!authChecked && !user && !hasTokens)) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderColor: '#6CBBFB' }}></div>
            </div>
        );
    }

    // If no user and no tokens, redirect to login (only once)
    if (!user && !hasTokens && !redirecting) {
        setRedirecting(true);
        window.location.replace('/login');
        return null;
    }

    // At this point, either we have user OR hasTokens is true
    // Render the dashboard - AuthContext will populate user when ready

    return (
        <>
            <Head>
                <title>Dashboard | Site Organizer</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            </Head>
            <DashboardProvider>
                <DashboardContent />
                <OnboardingTour user={user} />
            </DashboardProvider>
        </>
    );
}

export async function getServerSideProps() {
    // Prevent static prerendering for dashboard (client-only auth state)
    return { props: {} };
}
