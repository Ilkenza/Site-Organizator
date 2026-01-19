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
  const { user, loading } = useAuth();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!loading && !user) {
      window.location.href = '/login';
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderColor: '#6CBBFB' }}></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

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
