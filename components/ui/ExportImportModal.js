import { useState, useEffect } from 'react';
import Modal from './Modal';
import Button from './Button';

export default function ExportImportModal({ isOpen, onClose, userId, onImportComplete }) {
    const [importing, setImporting] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [importPreview, setImportPreview] = useState(null);
    const [importSource, setImportSource] = useState(null);
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState('info');

    // Reset state when modal closes
    useEffect(() => {
        if (!isOpen) {
            setImportFile(null);
            setImportPreview(null);
            setImportSource(null);
            setMessage('');
            setMessageType('info');
        }
    }, [isOpen]);

    const handleExport = async (format = 'json') => {
        setExporting(true);
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
        }
    };

    const handleFileSelect = async (e, source = 'auto') => {
        const file = e.target?.files?.[0] || e;
        if (!file) return;

        setImportFile(file);
        setImportSource(source !== 'auto' ? source : null);
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

        setImporting(true);
        setMessage('Importing sites...');
        setMessageType('info');

        try {
            const { importSites } = await import('../../lib/exportImport.js');
            const result = await importSites(importPreview.sites, userId);
            if (result.success) {
                setMessage(`Successfully imported ${importPreview.sites.length} site(s)!`);
                setMessageType('success');
                setImportFile(null);
                setImportPreview(null);

                // Notify parent to refresh data
                if (onImportComplete) {
                    setTimeout(() => {
                        onImportComplete();
                    }, 1000);
                }

                setTimeout(() => onClose(), 2000);
            } else {
                setMessage('Import failed: ' + result.error);
                setMessageType('error');
            }
        } catch (error) {
            setMessage('Import error: ' + error.message);
            setMessageType('error');
        } finally {
            setImporting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="📤 Export / 📥 Import Sites">
            <div className="space-y-4">
                {/* Message */}
                {message && (
                    <div className={`p-3 rounded-lg text-sm ${messageType === 'success' ? 'bg-success-bg/30 text-success-text' :
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
                        <Button
                            onClick={() => handleExport('json')}
                            disabled={exporting}
                            variant="primary"
                            className="flex-1"
                        >
                            {exporting ? 'Exporting...' : '📄 JSON'}
                        </Button>
                        <Button
                            onClick={() => handleExport('csv')}
                            disabled={exporting}
                            variant="primary"
                            className="flex-1"
                        >
                            {exporting ? 'Exporting...' : 'CSV'}
                        </Button>
                        <Button
                            onClick={() => handleExport('html')}
                            disabled={exporting}
                            variant="primary"
                            className="flex-1"
                        >
                            {exporting ? 'Exporting...' : 'HTML'}
                        </Button>
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
                                    <input type="file" accept=".html,.htm,.json,.csv"
                                        onChange={(e) => handleFileSelect(e, 'notion')}
                                        disabled={exporting || importing} className="hidden" />
                                    <span className="text-2xl group-hover:scale-110 transition-transform">📝</span>
                                    <span className="text-xs font-semibold text-app-text-primary">From Notion</span>
                                    <span className="text-[9px] text-app-text-muted text-center leading-tight">HTML export</span>
                                </label>
                                <label className="flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 border-dashed border-app-border hover:border-amber-500/50 hover:bg-amber-500/5 cursor-pointer transition-all group">
                                    <input type="file" accept=".html,.htm"
                                        onChange={(e) => handleFileSelect(e, 'bookmarks')}
                                        disabled={exporting || importing} className="hidden" />
                                    <span className="text-2xl group-hover:scale-110 transition-transform">🔖</span>
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
                                {importSource === 'notion' && <span className="text-[10px] px-2 py-0.5 bg-app-accent/20 text-app-accent rounded-full">📝 Notion</span>}
                                {importSource === 'bookmarks' && <span className="text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full">🔖 Bookmarks</span>}
                            </div>
                            <div className="text-sm">
                                <p className="text-app-text-secondary">File: <span className="text-app-text-primary font-medium">{importFile?.name}</span></p>
                                <p className="text-app-text-secondary">Sites to import: <span className="text-app-text-primary font-medium">{importPreview.sites?.length || 0}</span></p>
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    onClick={() => {
                                        setImportFile(null);
                                        setImportPreview(null);
                                        setImportSource(null);
                                        setMessage('');
                                    }}
                                    variant="secondary"
                                    className="flex-1"
                                >
                                    Change File
                                </Button>
                                <Button
                                    onClick={handleImport}
                                    disabled={importing}
                                    variant="primary"
                                    className="flex-1"
                                >
                                    {importing ? 'Importing...' : '� Import Sites'}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
}
