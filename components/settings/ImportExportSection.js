import { useState, useEffect } from 'react';
import { useDashboard } from '../../context/DashboardContext';

export default function ImportExportSection({ user, fetchData, showToast }) {
    const [importMessage, setImportMessage] = useState(null);
    const [showDuplicates, setShowDuplicates] = useState(false);

    // Import state from context (persists across tab changes)
    const {
        importing, importProgress, importResult, importError,
        runImport, cancelImport, clearImportResult,
        importPreview, setImportPreview,
        importSource, setImportSource,
        useFoldersAsCategories, setUseFoldersAsCategories,
        clearImportPreview
    } = useDashboard();

    // Export
    const handleExport = async (format = 'json') => {
        try {
            const { exportSites } = await import('../../lib/exportImport.js');
            const result = await exportSites(user?.id, format);
            if (!result.success) {
                setImportMessage({ type: 'error', text: `Export failed: ${result.error}` });
            } else {
                showToast?.(`Sites exported successfully as ${format.toUpperCase()}`, 'success');
            }
        } catch (err) {
            console.error('Export failed:', err);
            setImportMessage({ type: 'error', text: `Export error: ${err.message}` });
        }
    };

    // Import
    const handleFileSelect = async (file, source = 'auto') => {
        if (!file) return;

        try {
            const { parseImportFile } = await import('../../lib/exportImport.js');
            const data = await parseImportFile(file, source);

            if (data?.sites?.length) {
                setImportPreview(data);
                setImportMessage({ type: 'info', text: `Ready to import ${data.sites.length} site(s)` });
            } else {
                setImportMessage({ type: 'error', text: 'Invalid file format or no sites found' });
            }
        } catch (err) {
            console.error('Parse error:', err);
            setImportMessage({ type: 'error', text: err.message });
        }
    };

    const handleImport = async () => {
        if (!importPreview?.sites) {
            setImportMessage({ type: 'error', text: 'Please select a valid file first' });
            return;
        }

        await runImport(importPreview.sites, { useFoldersAsCategories, importSource: importSource || undefined });
    };

    // Handle import result changes
    useEffect(() => {
        if (!importResult) return;

        if (importResult.cancelled) {
            setImportMessage({ type: 'warning', text: `Import cancelled. ${importResult.created} site(s) imported before cancellation.` });
            setImportPreview(null);
            setImportSource(null);
            if (importResult.created > 0) setTimeout(() => fetchData(), 500);
        } else if (importResult.created > 0 || importResult.updated > 0) {
            const parts = [];
            if (importResult.created > 0) parts.push(`${importResult.created} created`);
            if (importResult.updated > 0) parts.push(`${importResult.updated} already existed (updated)`);
            setImportMessage({
                type: importResult.created > 0 ? 'success' : 'warning',
                text: `${importResult.created > 0 ? '✅' : '⚠️'} Import complete: ${parts.join(', ')}. ${importResult.errors > 0 ? `${importResult.errors} error(s).` : ''}`
            });
            setImportPreview(null);
            setTimeout(() => {
                if (importResult.created > 0) {
                    fetchData();
                }
            }, 2000);
        } else if (importResult.errors > 0) {
            setImportMessage({
                type: 'error',
                text: `❌ No sites imported. ${importResult.errors} error(s) occurred.`
            });
        }
    }, [importResult, fetchData]);

    useEffect(() => {
        if (importError) {
            setImportMessage({ type: 'error', text: importError });
        }
    }, [importError]);

    return (
        <>
            {/* Export Section */}
            <div className="bg-app-bg-light border border-app-border rounded-lg p-4 sm:p-6 mb-6">
                <h2 className="text-lg font-semibold text-app-text-primary mb-2">Export Sites</h2>
                <p className="text-sm text-app-text-secondary mb-4">
                    Download all your sites in your preferred format.
                </p>

                <div className="flex flex-col xs:flex-row flex-wrap gap-2 xs:gap-3">
                    <button
                        onClick={() => handleExport('json')}
                        className="flex-1 xs:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-[#1E4976] border border-[#2A5A8A] text-[#6CBBFB] rounded-lg hover:bg-[#2A5A8A] hover:text-[#8DD0FF] font-medium transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        JSON
                    </button>
                    <button
                        onClick={() => handleExport('csv')}
                        className="flex-1 xs:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-[#1E4976] border border-[#2A5A8A] text-[#6CBBFB] rounded-lg hover:bg-[#2A5A8A] hover:text-[#8DD0FF] font-medium transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7 20H5a2 2 0 01-2-2V9a2 2 0 012-2h6a2 2 0 012 2v10a2 2 0 01-2 2z" />
                        </svg>
                        CSV
                    </button>
                    <button
                        onClick={() => handleExport('html')}
                        className="flex-1 xs:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-[#1E4976] border border-[#2A5A8A] text-[#6CBBFB] rounded-lg hover:bg-[#2A5A8A] hover:text-[#8DD0FF] font-medium transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20v-6m4 6v-6m5-10H5a2 2 0 00-2 2v12a2 2 0 002 2h14a2 2 0 002-2V4a2 2 0 00-2-2z" />
                        </svg>
                        HTML
                    </button>
                </div>
            </div>

            {/* Import Section */}
            <div className="bg-app-bg-light border border-app-border rounded-lg p-4 sm:p-6 mb-6">
                <h2 className="text-lg font-semibold text-app-text-primary mb-2">Import Sites</h2>
                <p className="text-sm text-app-text-secondary mb-4">
                    Import your sites from Notion, browser bookmarks, or any exported file.
                    Categories and tags will be automatically created if they don&apos;t exist.
                </p>

                {/* Import source buttons */}
                {!importPreview ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
                            {/* Import from Notion */}
                            <div className="relative">
                                <input
                                    type="file"
                                    accept=".html,.htm,.json,.csv,.pdf"
                                    onChange={(e) => {
                                        handleFileSelect(e.target.files?.[0], 'notion');
                                        setImportSource('notion');
                                        e.target.value = '';
                                    }}
                                    className="hidden"
                                    id="import-notion-input"
                                />
                                <label
                                    htmlFor="import-notion-input"
                                    className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-app-border hover:border-app-accent/50 hover:bg-app-accent/5 cursor-pointer transition-all duration-200 group"
                                >
                                    <div className="w-12 h-12 rounded-lg bg-app-accent/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <svg className="w-7 h-7 text-app-accent" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M4 4h16v2H4zm0 4h16v2H4zm0 4h16v2H4zm0 4h10v2H4z" />
                                        </svg>
                                    </div>
                                    <span className="text-sm font-semibold text-app-text-primary">Import from Notion</span>
                                    <span className="text-[10px] text-app-text-muted text-center">Export your Notion page as HTML and upload it here</span>
                                </label>
                            </div>

                            {/* Import from Bookmarks */}
                            <div className="relative">
                                <input
                                    type="file"
                                    accept=".html,.htm"
                                    onChange={(e) => {
                                        handleFileSelect(e.target.files?.[0], 'bookmarks');
                                        setImportSource('bookmarks');
                                        e.target.value = '';
                                    }}
                                    className="hidden"
                                    id="import-bookmarks-input"
                                />
                                <label
                                    htmlFor="import-bookmarks-input"
                                    className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-app-border hover:border-amber-500/50 hover:bg-amber-500/5 cursor-pointer transition-all duration-200 group"
                                >
                                    <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <svg className="w-7 h-7 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                                        </svg>
                                    </div>
                                    <span className="text-sm font-semibold text-app-text-primary">Import from Bookmarks</span>
                                    <span className="text-[10px] text-app-text-muted text-center">Chrome, Firefox, Edge, Safari — export bookmarks as HTML</span>
                                </label>
                            </div>
                        </div>

                        {/* Or import a generic file */}
                        <div className="flex items-center gap-3">
                            <div className="flex-1 h-px bg-app-border/50" />
                            <span className="text-[10px] text-app-text-muted uppercase tracking-wider">or import a file</span>
                            <div className="flex-1 h-px bg-app-border/50" />
                        </div>
                        <div>
                            <input
                                type="file"
                                accept=".json,.csv,.html,.htm"
                                onChange={(e) => {
                                    handleFileSelect(e.target.files?.[0], 'auto');
                                    setImportSource('file');
                                    e.target.value = '';
                                }}
                                className="hidden"
                                id="import-file-input"
                            />
                            <label
                                htmlFor="import-file-input"
                                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-app-bg-primary border border-app-border text-app-text-secondary rounded-lg hover:text-app-text-primary cursor-pointer transition-colors text-sm"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                </svg>
                                Upload File (JSON, CSV, HTML)
                            </label>
                        </div>
                    </div>
                ) : null}

                {/* Preview */}
                {importPreview && (
                    <div className="mb-4 p-3 bg-app-bg-primary rounded-lg border border-app-border">
                        <div className="flex items-center gap-2 mb-2">
                            {importSource === 'notion' && (
                                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-app-accent/20 text-app-accent rounded-full">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M4 4h16v2H4zm0 4h16v2H4zm0 4h16v2H4zm0 4h10v2H4z" />
                                    </svg>
                                    Notion
                                </span>
                            )}
                            {importSource === 'bookmarks' && (
                                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                                    </svg>
                                    Bookmarks
                                </span>
                            )}
                            {importSource === 'file' && (
                                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-full">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                    File
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-app-text-secondary mb-3">
                            <strong>{importPreview.uniqueCount || importPreview.sites?.length || 0}</strong> site{(importPreview.uniqueCount || importPreview.sites?.length) !== 1 ? 's' : ''} ready to import
                            {importPreview.duplicates > 0 && (
                                <>
                                    <span className="text-app-text-muted text-xs ml-1">({importPreview.duplicates} duplicate{importPreview.duplicates !== 1 ? 's' : ''} removed)</span>
                                    <button
                                        onClick={() => setShowDuplicates(!showDuplicates)}
                                        className="ml-2 text-xs text-app-accent hover:underline"
                                    >
                                        {showDuplicates ? 'Hide' : 'Show'} duplicates
                                    </button>
                                </>
                            )}
                        </p>

                        {/* Duplicates list */}
                        {showDuplicates && importPreview.duplicateGroups?.length > 0 && (
                            <div className="mb-3 p-3 bg-app-bg-secondary rounded-lg border border-app-border max-h-48 overflow-y-auto">
                                <p className="text-xs font-semibold text-app-text-primary mb-2">Duplicate URLs (will be merged):</p>
                                <div className="space-y-2">
                                    {importPreview.duplicateGroups.map((group, idx) => (
                                        <div key={idx} className="text-xs">
                                            <p className="text-app-text-secondary truncate">
                                                <span className="text-app-accent font-medium">{group.count}×</span> {group.name}
                                            </p>
                                            <p className="text-app-text-muted truncate text-[10px]">{group.url}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Use folders as categories checkbox */}
                        {importSource === 'bookmarks' && (
                            <label className="flex items-center gap-2 cursor-pointer select-none py-1 mb-3">
                                <input
                                    type="checkbox"
                                    checked={useFoldersAsCategories}
                                    onChange={(e) => setUseFoldersAsCategories(e.target.checked)}
                                    disabled={importing}
                                    className="w-4 h-4 rounded border-app-border text-app-accent focus:ring-app-accent/50 bg-app-bg-primary"
                                />
                                <span className="text-sm text-app-text-secondary">
                                    📁 Use bookmark folders as categories
                                </span>
                            </label>
                        )}

                        {/* Progress bar */}
                        {importing && importProgress && (
                            <div className="space-y-1.5 mb-3">
                                <div className="flex justify-between text-xs text-app-text-muted">
                                    <span>{importProgress.created} created{importProgress.errors > 0 ? `, ${importProgress.errors} errors` : ''}</span>
                                    <span>
                                        {importProgress.etaMs > 0
                                            ? importProgress.etaMs >= 60000
                                                ? `~${Math.ceil(importProgress.etaMs / 60000)} min left`
                                                : `~${Math.ceil(importProgress.etaMs / 1000)}s left`
                                            : importProgress.current >= importProgress.total
                                                ? 'Finishing...'
                                                : 'Calculating...'}
                                    </span>
                                </div>
                                <div className="w-full h-2.5 bg-app-bg-light rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-app-accent rounded-full transition-all duration-500 ease-out"
                                        style={{ width: `${Math.round((importProgress.current / importProgress.total) * 100)}%` }}
                                    />
                                </div>
                                <div className="text-center text-[10px] text-app-text-muted">
                                    {Math.round((importProgress.current / importProgress.total) * 100)}% — {importProgress.current}/{importProgress.total} processed
                                </div>
                            </div>
                        )}

                        <button
                            onClick={() => {
                                clearImportPreview();
                                setImportMessage(null);
                                clearImportResult();
                            }}
                            className="inline-flex items-center gap-1 text-sm text-app-accent hover:underline disabled:opacity-50"
                            disabled={importing}
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            Back to import options
                        </button>
                    </div>
                )}

                {/* Message */}
                {importMessage && (
                    <div
                        className={`mb-4 mt-2 p-3 rounded-lg text-sm ${importMessage.type === 'success'
                            ? 'bg-green-500/20 text-green-400'
                            : importMessage.type === 'error'
                                ? 'bg-red-500/20 text-red-400'
                                : importMessage.type === 'warning'
                                    ? 'bg-amber-500/20 text-amber-400'
                                    : 'bg-blue-500/20 text-blue-400'
                            }`}
                    >
                        {importMessage.text}
                    </div>
                )}

                {/* Import / Cancel Buttons */}
                {importPreview && (
                    <div className="flex gap-2">
                        {importing ? (
                            <button
                                onClick={cancelImport}
                                className="flex items-center gap-2 px-4 py-2 bg-red-900/40 border border-red-700/50 text-red-400 hover:bg-red-900/60 hover:text-red-300 rounded-lg font-medium transition-colors"
                            >
                                ❌ Cancel Import
                            </button>
                        ) : (
                            <button
                                onClick={handleImport}
                                disabled={importing}
                                className="flex items-center gap-2 px-4 py-2 bg-[#1E4976] border border-[#2A5A8A] text-[#6CBBFB] rounded-lg hover:bg-[#2A5A8A] hover:text-[#8DD0FF] disabled:opacity-50 font-medium transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Import Sites
                            </button>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}
