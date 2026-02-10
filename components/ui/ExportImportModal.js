import { useState, useEffect } from 'react';
import Modal from './Modal';
import Button from './Button';
import { SpinnerIcon, TextLinesIcon, BookmarkIcon, DocumentIcon, ArrowLeftIcon } from './Icons';
import { useDashboard } from '../../context/DashboardContext';

export default function ExportImportModal({ isOpen, onClose, userId, onImportComplete }) {
    // Local state for file handling and export
    const [exporting, setExporting] = useState(false);
    const [exportingFormat, setExportingFormat] = useState(null);
    const [importFile, setImportFile] = useState(null);
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState('info');
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

    // Reset state when modal closes
    useEffect(() => {
        if (!isOpen) {
            setImportFile(null);
            clearImportPreview();
            setMessage('');
            setMessageType('info');
            setShowDuplicates(false);
            clearImportResult();
        }
    }, [isOpen, clearImportResult, clearImportPreview]);

    const handleExport = async (format = 'json') => {
        setExporting(true);
        setExportingFormat(format);
        setMessage(`Exporting sites as ${format.toUpperCase()}...`);
        setMessageType('info');

        try {
            const { exportSites } = await import('../../lib/exportImport.js');
            const result = await exportSites(userId, format);
            if (result.success) {
                setMessage('Sites exported successfully!');
                setMessageType('success');
                setTimeout(() => onClose(), 1500);
            } else {
                setMessage('Export failed: ' + result.error);
                setMessageType('error');
            }
        } catch (error) {
            setMessage('Export error: ' + error.message);
            setMessageType('error');
        } finally {
            setExporting(false);
            setExportingFormat(null);
        }
    };

    const handleFileSelect = async (e, source = 'auto') => {
        const file = e.target?.files?.[0] || e;
        if (!file) return;

        setImportFile(file);
        setImportSource(source !== 'auto' ? source : 'file');
        setMessage('Parsing file...');
        setMessageType('info');

        try {
            const { parseImportFile } = await import('../../lib/exportImport.js');
            const data = await parseImportFile(file, source);
            const sitesCount = data.sites?.length || 0;
            setImportPreview(data);
            setMessage(`File parsed successfully. Found ${sitesCount} site(s).`);
            setMessageType('success');
        } catch (error) {
            setMessage('Error parsing file: ' + error.message);
            setMessageType('error');
            setImportFile(null);
        }
    };

    const handleImport = async () => {
        if (!importPreview?.sites) {
            setMessage('No sites to import');
            setMessageType('error');
            return;
        }

        setMessage('Importing sites...');
        setMessageType('info');

        await runImport(importPreview.sites, { useFoldersAsCategories, importSource: importSource || undefined });
    };

    // Handle import result changes
    useEffect(() => {
        if (!importResult) return;

        if (importResult.cancelled) {
            setMessage(`Import cancelled. ${importResult.created} site(s) imported before cancellation.`);
            setMessageType('warning');
            setImportFile(null);
            clearImportPreview();
            if (importResult.created > 0 && onImportComplete) {
                setTimeout(() => onImportComplete(), 500);
            }
            // Clear message after a delay so user can see cancellation
            setTimeout(() => {
                setMessage('');
                clearImportResult();
            }, 3000);
        } else if (importResult.created > 0 || importResult.updated > 0) {
            const parts = [];
            if (importResult.created > 0) parts.push(`${importResult.created} created`);
            if (importResult.updated > 0) parts.push(`${importResult.updated} already existed (updated)`);
            if (importResult.tierLimited) {
                setMessage(`⚠️ ${importResult.tierMessage}${importResult.errors > 0 ? ` (${importResult.errors} error(s))` : ''}`);
                setMessageType('warning');
            } else {
                setMessage(`✅ Import complete: ${parts.join(', ')}.${importResult.errors > 0 ? ` ${importResult.errors} error(s).` : ''}`);
                setMessageType(importResult.created > 0 ? 'success' : 'warning');
            }
            setImportFile(null);
            clearImportPreview();

            if (onImportComplete) {
                setTimeout(() => onImportComplete(), 1000);
            }
        } else if (importResult.errors > 0) {
            const firstErr = importResult.report?.errors?.[0]?.error || 'Unknown error';
            setMessage(`❌ Import failed: ${importResult.errors} error(s). First error: ${firstErr}`);
            setMessageType('error');
        } else {
            setMessage('Import completed but no sites were created or updated.');
            setMessageType('error');
        }
    }, [importResult, onImportComplete, onClose]);

    useEffect(() => {
        if (importError) {
            setMessage('Import error: ' + importError);
            setMessageType('error');
        }
    }, [importError]);

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="📤 Export / 📥 Import Sites">
            <div className="space-y-4">
                {/* Message */}
                {message && (
                    <div className={`p-3 rounded-lg text-sm mt-2 ${messageType === 'success' ? 'bg-success-bg/30 text-success-text' :
                        messageType === 'error' ? 'bg-btn-danger/30 text-app-text-primary' :
                            'bg-app-accent/20 text-app-accent'
                        }`}>
                        {message}
                    </div>
                )}

                {/* Export Section */}
                <div className="border-b border-app-border pb-4">
                    <h3 className="font-semibold text-app-text-primary mb-3">Export Sites</h3>
                    <p className="text-sm text-app-text-secondary mb-3">
                        Download all your sites in your preferred format for backup or transfer.
                    </p>
                    <div className="flex gap-2">
                        {['json', 'csv', 'html'].map((fmt) => (
                            <Button
                                key={fmt}
                                onClick={() => handleExport(fmt)}
                                disabled={exporting}
                                variant="primary"
                                className="flex-1 inline-flex items-center justify-center gap-1.5"
                            >
                                {exportingFormat === fmt ? (
                                    <SpinnerIcon className="w-4 h-4 animate-spin" />
                                ) : null}
                                {exportingFormat === fmt ? 'Exporting...' : fmt.toUpperCase()}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Import Section */}
                <div>
                    <h3 className="font-semibold text-app-text-primary mb-3">Import Sites</h3>

                    {!importPreview ? (
                        <div className="space-y-3">
                            {/* Notion + Bookmarks buttons */}
                            <div className="grid grid-cols-2 gap-2">
                                <label className="flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 border-dashed border-app-border hover:border-app-accent/50 hover:bg-app-accent/5 cursor-pointer transition-all group">
                                    <input type="file" accept=".html,.htm,.json,.csv,.pdf"
                                        onChange={(e) => handleFileSelect(e, 'notion')}
                                        disabled={exporting || importing} className="hidden" />
                                    <div className="w-10 h-10 rounded-lg bg-app-accent/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <TextLinesIcon className="w-6 h-6 text-app-accent" />
                                    </div>
                                    <span className="text-xs font-semibold text-app-text-primary">From Notion</span>
                                    <span className="text-[9px] text-app-text-muted text-center leading-tight">HTML export</span>
                                </label>
                                <label className="flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 border-dashed border-app-border hover:border-amber-500/50 hover:bg-amber-500/5 cursor-pointer transition-all group">
                                    <input type="file" accept=".html,.htm"
                                        onChange={(e) => handleFileSelect(e, 'bookmarks')}
                                        disabled={exporting || importing} className="hidden" />
                                    <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <BookmarkIcon className="w-6 h-6 text-amber-400" />
                                    </div>
                                    <span className="text-xs font-semibold text-app-text-primary">From Bookmarks</span>
                                    <span className="text-[9px] text-app-text-muted text-center leading-tight">Chrome, Firefox, Edge</span>
                                </label>
                            </div>

                            {/* Divider */}
                            <div className="flex items-center gap-2">
                                <div className="flex-1 h-px bg-app-border/50" />
                                <span className="text-[9px] text-app-text-muted uppercase">or upload a file</span>
                                <div className="flex-1 h-px bg-app-border/50" />
                            </div>

                            {/* Generic file input */}
                            <label className="block">
                                <input
                                    type="file"
                                    accept=".json,.csv,.html,.htm"
                                    onChange={(e) => handleFileSelect(e, 'auto')}
                                    disabled={exporting || importing}
                                    className="block w-full text-sm text-app-text-secondary
                    file:mr-3 file:py-2 file:px-4 file:rounded-lg
                    file:border file:border-app-border
                    file:bg-app-bg-light file:text-app-text-primary
                    file:cursor-pointer file:hover:bg-app-bg-light/80
                    disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                            </label>
                        </div>
                    ) : (
                        <div className="bg-app-bg-light rounded-lg p-4 space-y-3">
                            <div className="flex items-center gap-2 mb-1">
                                {importSource === 'notion' && (
                                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-app-accent/20 text-app-accent rounded-full">
                                        <TextLinesIcon className="w-3 h-3" />
                                        Notion
                                    </span>
                                )}
                                {importSource === 'bookmarks' && (
                                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full">
                                        <BookmarkIcon className="w-3 h-3" />
                                        Bookmarks
                                    </span>
                                )}
                                {importSource === 'file' && (
                                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-full">
                                        <DocumentIcon className="w-3 h-3" />
                                        File
                                    </span>
                                )}
                            </div>
                            <div className="text-sm">
                                <p className="text-app-text-secondary">File: <span className="text-app-text-primary font-medium">{importFile?.name}</span></p>
                                <p className="text-app-text-secondary">Sites to import: <span className="text-app-text-primary font-medium">{importPreview.uniqueCount || importPreview.sites?.length || 0}</span>
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
                            </div>

                            {/* Duplicates list */}
                            {showDuplicates && importPreview.duplicateGroups?.length > 0 && (
                                <div className="mt-3 p-3 bg-app-bg-primary rounded-lg border border-app-border max-h-48 overflow-y-auto">
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
                                <label className="flex items-center gap-2 cursor-pointer select-none py-1">
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
                                <div className="space-y-1.5">
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
                                    <div className="w-full h-2.5 bg-app-bg-primary rounded-full overflow-hidden">
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

                            <div className="flex gap-2">
                                <Button
                                    onClick={() => {
                                        setImportFile(null);
                                        clearImportPreview();
                                        setMessage('');
                                    }}
                                    variant="secondary"
                                    className="flex-1 inline-flex items-center justify-center gap-1.5"
                                    disabled={importing}
                                >
                                    <ArrowLeftIcon className="w-3.5 h-3.5" />
                                    Back
                                </Button>
                                {importing ? (
                                    <Button
                                        onClick={cancelImport}
                                        variant="danger"
                                        className="flex-1"
                                    >
                                        ❌ Cancel Import
                                    </Button>
                                ) : (
                                    <Button
                                        onClick={handleImport}
                                        disabled={importing}
                                        variant="primary"
                                        className="flex-1"
                                    >
                                        📥 Import Sites
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
}
