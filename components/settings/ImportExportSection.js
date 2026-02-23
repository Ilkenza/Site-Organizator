import { useState, useEffect } from 'react';
import { SpinnerIcon, TextLinesIcon, BookmarkIcon, DocumentIcon, UploadIcon, DownloadIcon, ArrowLeftIcon, CheckCircleIcon, FolderIcon, TagIcon, GlobeIcon, WarningIcon } from '../ui/Icons';
import { useDashboard } from '../../context/DashboardContext';

export default function ImportExportSection({ user, fetchData, showToast }) {
    const [importMessage, setImportMessage] = useState(null);
    const [showDuplicates, setShowDuplicates] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [exportingFormat, setExportingFormat] = useState(null);
    // Export modal state
    const [exportModalFormat, setExportModalFormat] = useState(null); // null = closed, 'json'|'csv'|'html' = open
    const [exportIncludes, setExportIncludes] = useState({ sites: true, categories: true, tags: true });
    const toggleExportInclude = (key) => setExportIncludes(prev => ({ ...prev, [key]: !prev[key] }));
    const hasAnyExportInclude = exportIncludes.sites || exportIncludes.categories || exportIncludes.tags;

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
        setExporting(true);
        setExportingFormat(format);
        try {
            const { exportSites } = await import('../../lib/exportImport.js');
            const includes = Object.entries(exportIncludes).filter(([, v]) => v).map(([k]) => k);
            const result = await exportSites(user?.id, format, includes);
            if (!result.success) {
                setImportMessage({ type: 'error', text: `Export failed: ${result.error}` });
            } else {
                showToast?.(`Exported successfully as ${format.toUpperCase()}`, 'success');
                setExportModalFormat(null);
            }
        } catch (err) {
            console.error('Export failed:', err);
            setImportMessage({ type: 'error', text: `Export error: ${err.message}` });
        } finally {
            setExporting(false);
            setExportingFormat(null);
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
            if (importResult.tierLimited) {
                setImportMessage({
                    type: 'warning',
                    detail: true,
                    created: importResult.created,
                    updated: importResult.updated,
                    errors: importResult.errors,
                    categoriesCreated: importResult.categoriesCreated || 0,
                    tagsCreated: importResult.tagsCreated || 0,
                    tierMessage: importResult.tierMessage
                });
            } else {
                setImportMessage({
                    type: 'success',
                    detail: true,
                    created: importResult.created,
                    updated: importResult.updated,
                    errors: importResult.errors,
                    categoriesCreated: importResult.categoriesCreated || 0,
                    tagsCreated: importResult.tagsCreated || 0
                });
            }
            setImportPreview(null);
            setTimeout(() => {
                if (importResult.created > 0) {
                    fetchData();
                }
            }, 2000);
        } else if (importResult.tierLimited) {
            setImportMessage({
                type: 'warning',
                text: `⚠️ ${importResult.tierMessage}`
            });
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
                <h2 className="text-lg font-semibold text-app-text-primary mb-2">Export Data</h2>
                <p className="text-sm text-app-text-secondary mb-4">
                    Download your data in your preferred format.
                </p>

                <div className="flex flex-col xs:flex-row flex-wrap gap-2 xs:gap-3">
                    {[
                        { fmt: 'json', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
                        { fmt: 'csv', icon: 'M9 12l2 2 4-4M7 20H5a2 2 0 01-2-2V9a2 2 0 012-2h6a2 2 0 012 2v10a2 2 0 01-2 2z' },
                        { fmt: 'html', icon: 'M10 20v-6m4 6v-6m5-10H5a2 2 0 00-2 2v12a2 2 0 002 2h14a2 2 0 002-2V4a2 2 0 00-2-2z' },
                    ].map(({ fmt, icon }) => (
                        <button
                            key={fmt}
                            onClick={() => { setExportModalFormat(fmt); setExportIncludes({ sites: true, categories: true, tags: true }); }}
                            disabled={exporting}
                            className="flex-1 xs:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-[#1E4976] border border-[#2A5A8A] text-[#6CBBFB] rounded-lg hover:bg-[#2A5A8A] hover:text-[#8DD0FF] disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
                            </svg>
                            {fmt.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            {/* Export Options Modal */}
            {exportModalFormat && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => !exporting && setExportModalFormat(null)}>
                    <div className="bg-app-bg-primary border border-app-border rounded-xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
                        <div className="p-5">
                            <h3 className="text-base font-semibold text-app-text-primary mb-1">Export as {exportModalFormat.toUpperCase()}</h3>
                            <p className="text-xs text-app-text-secondary mb-4">Pick what you want in the file:</p>

                            <div className="space-y-2 mb-5">
                                {[
                                    { key: 'sites', label: 'Sites', desc: 'All your saved sites with details', icon: <GlobeIcon className="w-5 h-5" /> },
                                    { key: 'categories', label: 'Categories', desc: 'Include category data in sites & as list', icon: <FolderIcon className="w-5 h-5" /> },
                                    { key: 'tags', label: 'Tags', desc: 'Include tag data in sites & as list', icon: <TagIcon className="w-5 h-5" /> },
                                ].map(({ key, label, desc, icon }) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => toggleExportInclude(key)}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left ${exportIncludes[key]
                                                ? 'bg-app-accent/10 border-app-accent/40'
                                                : 'bg-app-bg-light border-app-border hover:border-app-accent/30'
                                            }`}
                                    >
                                        <span className={exportIncludes[key] ? 'text-app-accent' : 'text-app-text-muted'}>{icon}</span>
                                        <div className="flex-1 min-w-0">
                                            <span className={`text-sm font-medium ${exportIncludes[key] ? 'text-app-accent' : 'text-app-text-secondary'}`}>{label}</span>
                                            <p className="text-[10px] text-app-text-muted leading-tight">{desc}</p>
                                        </div>
                                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${exportIncludes[key]
                                                ? 'bg-app-accent border-app-accent'
                                                : 'border-app-border'
                                            }`}>
                                            {exportIncludes[key] && (
                                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>

                            {/* Filename preview */}
                            <div className="text-[10px] text-app-text-muted mb-4 bg-app-bg-light rounded px-2.5 py-1.5 border border-app-border font-mono truncate">
                                {[exportIncludes.sites && 'sites', exportIncludes.categories && 'categories', exportIncludes.tags && 'tags'].filter(Boolean).join('-') || '...'}-export-{new Date().toISOString().split('T')[0]}.{exportModalFormat}
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => setExportModalFormat(null)}
                                    disabled={exporting}
                                    className="flex-1 px-3 py-2 rounded-lg text-sm font-medium border border-app-border text-app-text-secondary hover:bg-app-bg-light transition-colors disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleExport(exportModalFormat)}
                                    disabled={exporting || !hasAnyExportInclude}
                                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-app-accent text-white hover:bg-app-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {exporting ? (
                                        <><SpinnerIcon className="w-4 h-4 animate-spin" /> Exporting...</>
                                    ) : (
                                        <><DownloadIcon className="w-4 h-4" /> Export</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
                                        <TextLinesIcon className="w-7 h-7 text-app-accent" />
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
                                        <BookmarkIcon className="w-7 h-7 text-amber-400" />
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
                                <UploadIcon className="w-4 h-4" />
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
                                    <TextLinesIcon className="w-3 h-3" />
                                    Notion
                                </span>
                            )}
                            {importSource === 'bookmarks' && (
                                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full">
                                    <BookmarkIcon className="w-3 h-3" />
                                    Bookmarks
                                </span>
                            )}
                            {importSource === 'file' && (
                                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-full">
                                    <DocumentIcon className="w-3 h-3" />
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
                        {importing && (
                            <div className="space-y-1.5 mb-3">
                                <div className="flex justify-between text-xs text-app-text-muted">
                                    <span>{importProgress ? `${importProgress.created} created${importProgress.errors > 0 ? `, ${importProgress.errors} errors` : ''}` : 'Starting import...'}</span>
                                    <span>
                                        {importProgress
                                            ? importProgress.etaMs > 0
                                                ? importProgress.etaMs >= 60000
                                                    ? `~${Math.ceil(importProgress.etaMs / 60000)} min left`
                                                    : `~${Math.ceil(importProgress.etaMs / 1000)}s left`
                                                : importProgress.current >= importProgress.total
                                                    ? 'Finishing...'
                                                    : 'Calculating...'
                                            : 'Preparing...'}
                                    </span>
                                </div>
                                <div className="w-full h-2.5 bg-app-bg-light rounded-full overflow-hidden">
                                    {importProgress ? (
                                        <div
                                            className="h-full bg-app-accent rounded-full transition-all duration-500 ease-out"
                                            style={{ width: `${Math.round((importProgress.current / importProgress.total) * 100)}%` }}
                                        />
                                    ) : (
                                        <div className="h-full bg-app-accent/60 rounded-full animate-pulse" style={{ width: '15%' }} />
                                    )}
                                </div>
                                <div className="text-center text-[10px] text-app-text-muted">
                                    {importProgress
                                        ? `${Math.round((importProgress.current / importProgress.total) * 100)}% — ${importProgress.current}/${importProgress.total} processed`
                                        : 'Processing sites...'}
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
                            <ArrowLeftIcon className="w-3.5 h-3.5" />
                            Back to import options
                        </button>
                    </div>
                )}

                {/* Message */}
                {importMessage && (
                    importMessage.detail ? (
                        <div className={`mb-4 mt-2 rounded-lg border overflow-hidden ${importMessage.type === 'success'
                            ? 'border-green-500/30'
                            : 'border-amber-500/30'
                            }`}>
                            {/* Header */}
                            <div className={`flex items-center gap-2 px-4 py-3 ${importMessage.type === 'success'
                                ? 'bg-green-500/15'
                                : 'bg-amber-500/15'
                                }`}>
                                {importMessage.type === 'success' ? (
                                    <CheckCircleIcon className="w-5 h-5 text-green-400 flex-shrink-0" />
                                ) : (
                                    <WarningIcon className="w-5 h-5 text-amber-400 flex-shrink-0" />
                                )}
                                <span className={`text-sm font-semibold ${importMessage.type === 'success' ? 'text-green-400' : 'text-amber-400'
                                    }`}>
                                    {importMessage.type === 'success' ? 'Import Successful' : 'Import Complete (with limits)'}
                                </span>
                            </div>
                            {/* Breakdown */}
                            <div className="px-4 py-3 bg-app-bg-primary space-y-2">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {importMessage.created > 0 && (
                                        <div className="flex items-center gap-2 text-sm">
                                            <GlobeIcon className="w-4 h-4 text-green-400 flex-shrink-0" />
                                            <span className="text-app-text-secondary">
                                                <span className="font-semibold text-green-400">{importMessage.created}</span> site{importMessage.created !== 1 ? 's' : ''} created
                                            </span>
                                        </div>
                                    )}
                                    {importMessage.updated > 0 && (
                                        <div className="flex items-center gap-2 text-sm">
                                            <GlobeIcon className="w-4 h-4 text-blue-400 flex-shrink-0" />
                                            <span className="text-app-text-secondary">
                                                <span className="font-semibold text-blue-400">{importMessage.updated}</span> site{importMessage.updated !== 1 ? 's' : ''} updated
                                            </span>
                                        </div>
                                    )}
                                    {importMessage.categoriesCreated > 0 && (
                                        <div className="flex items-center gap-2 text-sm">
                                            <FolderIcon className="w-4 h-4 text-purple-400 flex-shrink-0" />
                                            <span className="text-app-text-secondary">
                                                <span className="font-semibold text-purple-400">{importMessage.categoriesCreated}</span> categor{importMessage.categoriesCreated !== 1 ? 'ies' : 'y'} created
                                            </span>
                                        </div>
                                    )}
                                    {importMessage.tagsCreated > 0 && (
                                        <div className="flex items-center gap-2 text-sm">
                                            <TagIcon className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                                            <span className="text-app-text-secondary">
                                                <span className="font-semibold text-cyan-400">{importMessage.tagsCreated}</span> tag{importMessage.tagsCreated !== 1 ? 's' : ''} created
                                            </span>
                                        </div>
                                    )}
                                    {importMessage.errors > 0 && (
                                        <div className="flex items-center gap-2 text-sm">
                                            <span className="w-4 h-4 text-red-400 flex-shrink-0">✗</span>
                                            <span className="text-app-text-secondary">
                                                <span className="font-semibold text-red-400">{importMessage.errors}</span> error{importMessage.errors !== 1 ? 's' : ''}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                {importMessage.tierMessage && (
                                    <p className="text-xs text-amber-400/80 border-t border-app-border pt-2 mt-1">
                                        ⚠️ {importMessage.tierMessage}
                                    </p>
                                )}
                            </div>
                        </div>
                    ) : (
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
                    )
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
                                <DownloadIcon className="w-4 h-4" />
                                Import Sites
                            </button>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}
