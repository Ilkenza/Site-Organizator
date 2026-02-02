import { useState } from 'react';

export default function ImportExportSection({ user, fetchData, showToast }) {
    const [importPreview, setImportPreview] = useState(null);
    const [importMessage, setImportMessage] = useState(null);
    const [importLoading, setImportLoading] = useState(false);

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
    const handleFileSelect = async (file) => {
        if (!file) return;

        try {
            const { parseImportFile } = await import('../../lib/exportImport.js');
            const data = await parseImportFile(file);

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
            await importSites(importPreview.sites, user?.id);
            setImportMessage({ type: 'success', text: 'Sites imported successfully!' });
            setImportPreview(null);
            setTimeout(() => {
                setImportMessage(null);
                fetchData();
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
                    Upload a previously exported file (JSON, CSV, or HTML) to restore or transfer sites. Categories and tags will be automatically created if they don&apos;t exist. Duplicate categories and tags are automatically detected and reused.
                </p>

                {/* File Input with Icon Button */}
                {!importPreview ? (
                    <div className="mb-4">
                        <input
                            type="file"
                            accept=".json,.csv,.html"
                            onChange={(e) => {
                                handleFileSelect(e.target.files?.[0]);
                                e.target.value = ''; // Reset input
                            }}
                            className="hidden"
                            id="import-file-input"
                        />
                        <label
                            htmlFor="import-file-input"
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#1E4976] border border-[#2A5A8A] text-[#6CBBFB] rounded-lg hover:bg-[#2A5A8A] hover:text-[#8DD0FF] cursor-pointer transition-all duration-200 font-semibold text-base"
                        >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                            </svg>
                            <span>Import Sites</span>
                        </label>
                        <p className="text-xs text-app-text-tertiary mt-2">Supported formats: JSON, CSV, HTML</p>
                    </div>
                ) : null}

                {/* Preview */}
                {importPreview && (
                    <div className="mb-4 p-3 bg-app-bg-primary rounded-lg border border-app-border">
                        <p className="text-sm text-app-text-secondary mb-3">
                            <strong>{importPreview.sites?.length || 0}</strong> site{importPreview.sites?.length !== 1 ? 's' : ''} ready to import
                        </p>
                        <button
                            onClick={() => {
                                setImportPreview(null);
                                setImportMessage(null);
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
