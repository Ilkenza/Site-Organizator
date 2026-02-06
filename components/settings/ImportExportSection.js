import { useState } from 'react';

export default function ImportExportSection({ user, fetchData, showToast }) {
    const [importPreview, setImportPreview] = useState(null);
    const [importMessage, setImportMessage] = useState(null);
    const [importLoading, setImportLoading] = useState(false);
    const [importSource, setImportSource] = useState(null); // 'notion' | 'bookmarks' | null

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

        setImportLoading(true);
        try {
            const { importSites } = await import('../../lib/exportImport.js');
            const result = await importSites(importPreview.sites, user?.id);

            // Show detailed report
            const report = result?.result?.report || {};
            const created = report.created?.length || 0;
            const updated = report.updated?.length || 0;
            const skipped = report.skipped?.length || 0;
            const errors = report.errors?.length || 0;


            if (created > 0 || updated > 0) {
                const parts = [];
                if (created > 0) parts.push(`${created} created`);
                if (updated > 0) parts.push(`${updated} updated`);
                setImportMessage({
                    type: 'success',
                    text: `✅ Import successful: ${parts.join(', ')}. ${errors > 0 ? `${errors} error(s).` : ''}`
                });
            } else if (skipped > 0) {
                setImportMessage({
                    type: 'warning',
                    text: `⚠️ All ${skipped} site(s) skipped. ${errors > 0 ? `${errors} error(s).` : ''}`
                });
            } else {
                setImportMessage({
                    type: 'error',
                    text: `❌ No sites imported. ${errors > 0 ? `${errors} error(s) occurred.` : 'Check console for details.'}`
                });
            }

            setImportPreview(null);
            setTimeout(() => {
                if (created > 0) {
                    fetchData();
                }
            }, 2000);
        } catch (err) {
            console.error('Import error:', err);
            setImportMessage({ type: 'error', text: err.message });
        } finally {
            setImportLoading(false);
        }
    };

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
                                    accept=".html,.htm,.json,.csv"
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
                                    <span className="text-3xl group-hover:scale-110 transition-transform">📝</span>
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
                                    <span className="text-3xl group-hover:scale-110 transition-transform">🔖</span>
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
                                    setImportSource(null);
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
                            {importSource === 'notion' && <span className="text-xs px-2 py-0.5 bg-app-accent/20 text-app-accent rounded-full">📝 Notion</span>}
                            {importSource === 'bookmarks' && <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full">🔖 Bookmarks</span>}
                            {!importSource && <span className="text-xs px-2 py-0.5 bg-app-bg-light text-app-text-muted rounded-full">📄 File</span>}
                        </div>
                        <p className="text-sm text-app-text-secondary mb-3">
                            <strong>{importPreview.sites?.length || 0}</strong> site{importPreview.sites?.length !== 1 ? 's' : ''} ready to import
                        </p>
                        <button
                            onClick={() => {
                                setImportPreview(null);
                                setImportMessage(null);
                                setImportSource(null);
                            }}
                            className="text-sm text-app-accent hover:underline"
                        >
                            Choose different file
                        </button>
                    </div>
                )}

                {/* Message */}
                {importMessage && (
                    <div
                        className={`mb-4 p-3 rounded-lg text-sm ${importMessage.type === 'success'
                            ? 'bg-green-500/20 text-green-400'
                            : importMessage.type === 'error'
                                ? 'bg-red-500/20 text-red-400'
                                : 'bg-blue-500/20 text-blue-400'
                            }`}
                    >
                        {importMessage.text}
                    </div>
                )}

                {/* Import Button */}
                {importPreview && (
                    <button
                        onClick={handleImport}
                        disabled={importLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-[#1E4976] border border-[#2A5A8A] text-[#6CBBFB] rounded-lg hover:bg-[#2A5A8A] hover:text-[#8DD0FF] disabled:opacity-50 font-medium transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        {importLoading ? 'Importing...' : 'Import Sites'}
                    </button>
                )}
            </div>
        </>
    );
}
