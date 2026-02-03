import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function ProfileEditSection({ user, refreshUser }) {
    const [displayName, setDisplayName] = useState('');
    const [editingName, setEditingName] = useState(false);
    const [savingName, setSavingName] = useState(false);
    const [nameMessage, setNameMessage] = useState(null);

    // Load name from auth.users metadata
    useEffect(() => {
        const loadName = async () => {
            if (!user?.id) return;

            try {
                const { data: { user: authUser } } = await supabase.auth.getUser();
                const name = authUser?.user_metadata?.display_name || authUser?.user_metadata?.username;

                if (name) {
                    setDisplayName(name);
                } else if (user?.displayName) {
                    // Fallback to user prop
                    setDisplayName(user.displayName);
                }
            } catch (err) {
                console.error('[ProfileEditSection] Error loading name:', err);
                // Fallback to user prop on error
                if (user?.displayName) {
                    setDisplayName(user.displayName);
                }
            }
        };

        loadName();
    }, [user?.id, user?.displayName]);

    const handleSaveName = async () => {
        if (!displayName.trim() || !user?.id) {
            setNameMessage({ type: 'error', text: 'Please enter a name' });
            return;
        }

        setSavingName(true);
        try {
            // Update display_name in auth.users metadata
            const { error } = await supabase.auth.updateUser({
                data: {
                    display_name: displayName.trim()
                }
            });

            if (error) throw error;

            setNameMessage({ type: 'success', text: 'Name updated successfully!' });
            setEditingName(false);

            // Refresh user data
            await refreshUser();
        } catch (error) {
            console.error('Error saving name:', error);
            setNameMessage({ type: 'error', text: error.message });
        } finally {
            setSavingName(false);
        }
    };

    return (
        <>
            {/* Email section */}
            <div className="mb-4 pb-4 border-b border-app-border">
                <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-2">
                    <div className="min-w-0">
                        <p className="text-sm text-app-text-secondary">Email</p>
                        <p className="text-app-text-primary font-medium truncate">{user?.email}</p>
                    </div>
                </div>
            </div>

            {/* Name section */}
            <div className="pb-4 border-b border-app-border">
                {editingName ? (
                    <div>
                        <label className="block text-sm text-app-text-secondary mb-2">Display Name</label>
                        <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && displayName.trim() && !savingName) {
                                    handleSaveName();
                                }
                            }}
                            placeholder="Enter your name"
                            autoFocus
                            className="w-full px-3 py-2 bg-app-bg-secondary border border-app-border rounded-lg text-app-text-primary placeholder-app-text-tertiary focus:outline-none focus:ring-2 focus:ring-app-accent mb-2"
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={handleSaveName}
                                disabled={savingName || !displayName.trim()}
                                className="px-3 py-1 bg-app-primary text-white rounded-lg hover:bg-app-primary-hover disabled:opacity-50 transition-colors text-sm"
                            >
                                {savingName ? 'Saving...' : 'Save'}
                            </button>
                            <button
                                onClick={() => {
                                    setEditingName(false);
                                    setDisplayName(user?.displayName || '');
                                    setNameMessage(null);
                                }}
                                className="px-3 py-1 bg-app-bg-secondary border border-app-border text-app-text-primary rounded-lg hover:bg-app-bg-light transition-colors text-sm"
                            >
                                Cancel
                            </button>
                        </div>
                        {nameMessage && (
                            <div
                                className={`mt-2 p-2 rounded text-sm ${nameMessage.type === 'success'
                                    ? 'bg-green-500/20 text-green-400'
                                    : 'bg-red-500/20 text-red-400'
                                    }`}
                            >
                                {nameMessage.text}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-2">
                        <div>
                            <p className="text-sm text-app-text-secondary">Display Name</p>
                            <p className="text-app-text-primary font-medium">{displayName || 'Not set'}</p>
                        </div>
                        <button
                            onClick={() => setEditingName(true)}
                            className="w-full xs:w-auto px-3 py-1.5 xs:py-1 bg-app-bg-secondary border border-app-border text-app-text-primary rounded-lg hover:bg-app-bg-light transition-colors text-sm text-center"
                        >
                            Edit
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}
