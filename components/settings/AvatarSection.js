import { useState, useEffect } from 'react';
import Image from 'next/image';
import { supabase } from '../../lib/supabase';

export default function AvatarSection({ user, refreshUser }) {
    const [avatar, setAvatar] = useState(null);
    const [avatarFile, setAvatarFile] = useState(null);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [avatarMessage, setAvatarMessage] = useState(null);

    // Load avatar from user prop or fetch from database
    useEffect(() => {
        const loadAvatar = async () => {
            // First try to use avatar from user prop
            if (user?.avatar_url) {
                setAvatar(user.avatar_url);
                return;
            } else if (user?.avatarUrl) {
                setAvatar(user.avatarUrl);
                return;
            }

            // If no avatar in prop, fetch from database
            if (!user?.id) return;

            try {
                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token;
                const response = await fetch('/api/profile', {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token ? `Bearer ${token}` : ''
                    }
                });

                const result = await response.json();
                if (result.success && result.data?.avatar_url) {
                    setAvatar(result.data.avatar_url);
                }
            } catch (err) {
                console.error('[AvatarSection] Error loading avatar:', err);
            }
        };

        loadAvatar();
    }, [user?.id, user?.avatar_url, user?.avatarUrl]);

    const handleAvatarChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Check file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            setAvatarMessage({ type: 'error', text: 'File size must be less than 5MB' });
            return;
        }

        // Check file type
        if (!file.type.startsWith('image/')) {
            setAvatarMessage({ type: 'error', text: 'Please select an image file' });
            return;
        }

        // Show preview
        const reader = new FileReader();
        reader.onload = (event) => {
            setAvatar(event.target?.result);
            setAvatarFile(file);
            setAvatarMessage({ type: 'success', text: 'Image selected. Click Save to upload.' });
        };
        reader.readAsDataURL(file);
    };

    const handleSaveAvatar = async () => {
        if (!avatarFile || !user?.id) {
            setAvatarMessage({ type: 'error', text: 'Please select an image first' });
            return;
        }

        setUploadingAvatar(true);

        try {
            // Get auth token
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !session?.access_token) {
                throw new Error('No active session');
            }

            // Convert file to base64
            const reader = new FileReader();
            const base64Promise = new Promise((resolve, reject) => {
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(avatarFile);
            });

            const fileData = await base64Promise;

            // Upload via API endpoint with base64 data
            const response = await fetch('/api/upload-avatar', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    fileData,
                    fileName: avatarFile.name,
                    userId: user.id
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Upload failed');
            }

            // Update local state
            setAvatar(result.avatar_url);
            setAvatarFile(null);
            setAvatarMessage({ type: 'success', text: 'Profile picture updated successfully!' });

            // Refresh user data to update Header
            refreshUser();
        } catch (error) {
            console.error('Avatar upload error:', error);
            setAvatarMessage({ type: 'error', text: error.message });
        } finally {
            setUploadingAvatar(false);
        }
    };

    return (
        <>
            <div className="flex items-center gap-4 mb-6">
                <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-2xl font-medium overflow-hidden">
                        {typeof avatar === 'string' && avatar ? (
                            <Image
                                src={avatar}
                                alt="Avatar preview"
                                width={64}
                                height={64}
                                className="rounded-full object-cover"
                                unoptimized={avatar.startsWith('data:') || avatar.startsWith('blob:') || avatar.startsWith('http')}
                            />
                        ) : (
                            user?.email?.charAt(0).toUpperCase()
                        )}
                    </div>
                    <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className="hidden"
                        id="avatar-input"
                    />
                    <label
                        htmlFor="avatar-input"
                        className="absolute bottom-0 right-0 bg-app-primary hover:bg-app-primary-hover rounded-full p-2 cursor-pointer transition-colors"
                    >
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </label>
                </div>
                <div className="flex-1">
                    <p className="text-sm text-app-text-secondary">Your account</p>
                </div>
            </div>

            {/* Avatar message */}
            {avatarMessage && (
                <div
                    className={`mb-4 p-3 rounded-lg text-sm ${avatarMessage.type === 'success'
                        ? 'bg-green-500/20 text-green-400'
                        : avatarMessage.type === 'error'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-blue-500/20 text-blue-400'
                        }`}
                >
                    {avatarMessage.text}
                </div>
            )}

            {/* Show save button when file is selected */}
            {avatarFile && (
                <div className="mb-4 p-3 bg-app-bg-primary rounded-lg border border-app-border">
                    <p className="text-sm text-app-text-secondary mb-3">Image selected - click Save to upload</p>
                    <button
                        onClick={handleSaveAvatar}
                        disabled={uploadingAvatar}
                        className="px-4 py-2 bg-app-primary hover:bg-app-primary-hover text-white rounded-lg transition-colors disabled:opacity-50 text-sm"
                    >
                        {uploadingAvatar ? 'Uploading...' : 'Save Avatar'}
                    </button>
                </div>
            )}
        </>
    );
}
