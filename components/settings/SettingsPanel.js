import { useState, useEffect } from 'react';
import { useAuth, supabase } from '../../context/AuthContext';
import { fetchAPI } from '../../lib/supabase';
// export/import helpers are loaded dynamically in client-only code
import { useDashboard } from '../../context/DashboardContext';
import Modal from '../ui/Modal';

export default function SettingsPanel() {
    const { user, signOut, refreshUser } = useAuth();
    const { fetchData, showToast, activeTab, stats, sites } = useDashboard();

    const [avatar, setAvatar] = useState(null);
    const [avatarFile, setAvatarFile] = useState(null);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [avatarMessage, setAvatarMessage] = useState(null);

    // Name state
    const [displayName, setDisplayName] = useState('');
    const [editingName, setEditingName] = useState(false);
    const [savingName, setSavingName] = useState(false);
    const [nameMessage, setNameMessage] = useState(null);

    // Import/Export state
    const [importFile, setImportFile] = useState(null);
    const [importPreview, setImportPreview] = useState(null);
    const [importMessage, setImportMessage] = useState(null);
    const [importLoading, setImportLoading] = useState(false);

    // Password change state
    const [passwordModalOpen, setPasswordModalOpen] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordMessage, setPasswordMessage] = useState(null);
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [mfaCodeForPassword, setMfaCodeForPassword] = useState('');
    const [needsMfaForPassword, setNeedsMfaForPassword] = useState(false);
    const [passwordVerified, setPasswordVerified] = useState(false);

    // Email change state
    const [newEmail, setNewEmail] = useState('');
    const [emailModalOpen, setEmailModalOpen] = useState(false);
    const [emailMessage, setEmailMessage] = useState(null);
    const [emailLoading, setEmailLoading] = useState(false);
    const [mfaCodeForEmail, setMfaCodeForEmail] = useState('');
    const [needsMfaForEmail, setNeedsMfaForEmail] = useState(false);

    // 2FA state
    const [mfaEnabled, setMfaEnabled] = useState(false);
    const [mfaLoading, setMfaLoading] = useState(false);
    const [mfaQrCode, setMfaQrCode] = useState(null);
    const [mfaSecret, setMfaSecret] = useState(null);
    const [mfaFactorId, setMfaFactorId] = useState(null);
    const [mfaModalOpen, setMfaModalOpen] = useState(false);
    const [mfaVerifyCode, setMfaVerifyCode] = useState('');
    const [mfaMessage, setMfaMessage] = useState(null);
    const [mfaStep, setMfaStep] = useState('initial'); // 'initial', 'scanning', 'verifying'

    // Session/Device info
    const [sessionInfo, setSessionInfo] = useState(null);
    const [signOutOthersModalOpen, setSignOutOthersModalOpen] = useState(false);
    const [signOutOthersLoading, setSignOutOthersLoading] = useState(false);

    // Initialize avatar and display name
    useEffect(() => {
        if (user?.avatar_url) {
            setAvatar(user.avatar_url);
        } else if (user?.avatarUrl) {
            setAvatar(user.avatarUrl);
        }
        if (user?.displayName) {
            setDisplayName(user.displayName);
        }
    }, [user?.avatar_url, user?.avatarUrl, user?.displayName]);

    // Load fresh avatar/name from database when Settings opens
    useEffect(() => {
        const loadProfileData = async () => {
            if (!user?.id) {
                console.log('[SettingsPanel] Cannot load profile - missing user:', { userId: user?.id });
                return;
            }

            try {
                console.log('[SettingsPanel] Fetching profile via API for user:', user.id);

                // Use our API endpoint instead of Supabase SDK (which can timeout)
                const response = await fetch('/api/profile', {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('sb-' + (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/^"|"$/g, '').split('//')[1]?.split('.')[0] + '-auth-token') ? JSON.parse(localStorage.getItem('sb-' + (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/^"|"$/g, '').split('//')[1]?.split('.')[0] + '-auth-token'))?.access_token : ''}`
                    }
                });

                const result = await response.json();
                console.log('[SettingsPanel] Profile fetch result:', result);

                if (!result.success || !result.data) {
                    console.warn('[SettingsPanel] Profile fetch failed:', result.error);
                    return;
                }

                const profile = result.data;
                console.log('[SettingsPanel] Setting avatar and name from profile');
                if (profile.avatar_url) {
                    setAvatar(profile.avatar_url);
                }
                if (profile.name) {
                    setDisplayName(profile.name);
                }
            } catch (err) {
                console.error('[SettingsPanel] Error loading profile:', err);
            }
        };

        loadProfileData();
    }, [user?.id]);

    // Load session info
    useEffect(() => {
        const loadSessionInfo = async () => {
            if (!supabase) return;

            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                if (error || !session) return;

                // Parse user agent for device info
                const ua = navigator.userAgent;
                let browser = 'Unknown Browser';
                let os = 'Unknown OS';

                // Detect browser
                if (ua.includes('Firefox')) browser = 'Firefox';
                else if (ua.includes('Edg')) browser = 'Edge';
                else if (ua.includes('Chrome')) browser = 'Chrome';
                else if (ua.includes('Safari')) browser = 'Safari';
                else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'Opera';

                // Detect OS
                if (ua.includes('Windows')) os = 'Windows';
                else if (ua.includes('Mac OS')) os = 'macOS';
                else if (ua.includes('Linux')) os = 'Linux';
                else if (ua.includes('Android')) os = 'Android';
                else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

                setSessionInfo({
                    browser,
                    os,
                    createdAt: session.user?.last_sign_in_at,
                    expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : null
                });
            } catch (err) {
                console.error('Error loading session info:', err);
            }
        };

        loadSessionInfo();
    }, [activeTab, supabase, user?.id]);

    // Check MFA status on load
    useEffect(() => {
        const checkMfaStatus = async () => {
            if (!supabase) return;

            try {
                // Add timeout to prevent SDK hang
                const factorsPromise = supabase.auth.mfa.listFactors();
                const factorsTimeout = new Promise((resolve) =>
                    setTimeout(() => resolve({ data: null, timedOut: true }), 3000)
                );
                const result = await Promise.race([factorsPromise, factorsTimeout]);

                if (result?.timedOut) {
                    console.warn('listFactors timed out in SettingsPanel');
                    return;
                }

                const { data, error } = result;
                if (error) {
                    console.warn('Error checking MFA status:', error.message);
                    return;
                }

                // Check if there's a verified TOTP factor
                const verifiedFactor = data?.totp?.find(f => f.status === 'verified');
                if (verifiedFactor) {
                    setMfaEnabled(true);
                    setMfaFactorId(verifiedFactor.id);
                    return;
                }

                // Check for unverified factor (needs to complete setup)
                const unverifiedFactor = data?.totp?.find(f => f.status === 'unverified');
                if (unverifiedFactor) {
                    setMfaFactorId(unverifiedFactor.id);
                    // We'll handle this in the modal - show option to complete or remove
                }
            } catch (err) {
                console.error('Error checking MFA:', err);
            }
        };

        checkMfaStatus();
    }, [activeTab, supabase, user?.id]);

    // Handle MFA enrollment
    const handleEnrollMfa = async () => {
        setMfaLoading(true);
        setMfaMessage(null);

        try {
            // First, check if there's an existing unverified factor and remove it
            const { data: factors } = await supabase.auth.mfa.listFactors();
            const existingUnverified = factors?.totp?.find(f => f.status === 'unverified');

            if (existingUnverified) {
                try {
                    await supabase.auth.mfa.unenroll({ factorId: existingUnverified.id });
                    // Wait a moment for the unenroll to complete
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (unenrollErr) {
                    console.warn('Failed to unenroll existing factor:', unenrollErr);
                }
            }

            const { data, error } = await supabase.auth.mfa.enroll({
                factorType: 'totp',
                friendlyName: 'Authenticator App'
            });

            if (error) throw error;

            setMfaQrCode(data.totp.qr_code);
            setMfaSecret(data.totp.secret);
            setMfaFactorId(data.id);
            setMfaStep('scanning');
        } catch (err) {
            console.error('MFA enrollment error:', err);
            setMfaMessage({ type: 'error', text: err.message || 'Failed to start MFA enrollment' });
        } finally {
            setMfaLoading(false);
        }
    };

    // Verify MFA code and complete enrollment
    const handleVerifyMfa = async () => {
        if (!mfaVerifyCode || mfaVerifyCode.length !== 6) {
            setMfaMessage({ type: 'error', text: 'Please enter a 6-digit code' });
            return;
        }

        setMfaLoading(true);
        setMfaMessage(null);

        try {
            // Create timeout promise
            const timeoutPromise = new Promise((resolve) => {
                setTimeout(() => {
                    resolve({ data: null, error: null, timedOut: true });
                }, 5000);
            });

            // Race between challengeAndVerify and timeout
            const result = await Promise.race([
                supabase.auth.mfa.challengeAndVerify({
                    factorId: mfaFactorId,
                    code: mfaVerifyCode
                }),
                timeoutPromise
            ]);

            if (result.error) throw result.error;

            setMfaEnabled(true);
            setMfaStep('initial');
            setMfaMessage({ type: 'success', text: '2FA enabled successfully!' });
            setMfaVerifyCode('');
            setMfaQrCode(null);
            setMfaSecret(null);

            // Close modal after delay
            setTimeout(() => {
                setMfaModalOpen(false);
                setMfaMessage(null);
            }, 2000);
        } catch (err) {
            console.error('MFA verification error:', err);
            setMfaMessage({ type: 'error', text: err.message || 'Invalid code. Please try again.' });
        } finally {
            setMfaLoading(false);
        }
    };

    // Unenroll MFA
    const handleUnenrollMfa = async () => {
        if (!confirm('Are you sure you want to disable 2FA? This will make your account less secure.')) {
            return;
        }

        setMfaLoading(true);
        setMfaMessage(null);

        try {
            const { error } = await supabase.auth.mfa.unenroll({
                factorId: mfaFactorId
            });

            if (error) throw error;

            setMfaEnabled(false);
            setMfaFactorId(null);
            setMfaMessage({ type: 'success', text: '2FA disabled successfully' });

            setTimeout(() => {
                setMfaModalOpen(false);
                setMfaMessage(null);
            }, 2000);
        } catch (err) {
            console.error('MFA unenroll error:', err);
            setMfaMessage({ type: 'error', text: err.message || 'Failed to disable 2FA' });
        } finally {
            setMfaLoading(false);
        }
    };

    // Handle avatar upload
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

        setAvatarFile(file);

        // Show preview
        const reader = new FileReader();
        reader.onload = (event) => {
            setAvatar(event.target?.result);
        };
        reader.readAsDataURL(file);

        setAvatarMessage({ type: 'success', text: 'Image selected. Click Save to upload.' });
    };

    const handleSaveName = async () => {
        if (!displayName.trim() || !user?.id) {
            setNameMessage({ type: 'error', text: 'Please enter a name' });
            return;
        }

        setSavingName(true);
        try {
            // Get access token from localStorage
            const supabaseUrlEnv = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
            const storageKey = `sb-${supabaseUrlEnv.replace(/^"|"$/g, '').split('//')[1]?.split('.')[0]}-auth-token`;
            const storedTokens = localStorage.getItem(storageKey);
            const accessToken = storedTokens ? JSON.parse(storedTokens)?.access_token : null;

            if (!accessToken) {
                throw new Error('Not authenticated');
            }

            // Update user name via our API
            const response = await fetch('/api/profile', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify({ name: displayName.trim() })
            });

            const result = await response.json();
            if (!result.success) throw new Error(result.error || 'Failed to update name');

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

    // Password Change
    const handleChangePassword = async () => {
        setPasswordMessage(null);

        if (!currentPassword || !newPassword || !confirmPassword) {
            setPasswordMessage({ type: 'error', text: 'Please fill in all fields' });
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordMessage({ type: 'error', text: 'New passwords do not match' });
            return;
        }

        if (newPassword.length < 6) {
            setPasswordMessage({ type: 'error', text: 'Password must be at least 6 characters' });
            return;
        }

        // Check if supabase is initialized
        if (!supabase) {
            setPasswordMessage({ type: 'error', text: 'Authentication service not available. Please refresh the page.' });
            return;
        }

        // Check if user email exists
        if (!user?.email) {
            setPasswordMessage({ type: 'error', text: 'User session not found. Please sign in again.' });
            return;
        }

        setPasswordLoading(true);

        try {
            // For MFA-enabled accounts: verify BOTH current password AND MFA code
            // For non-MFA accounts: verify current password only
            if (mfaEnabled) {

                // Verify current password using a separate client with isolated storage
                // This prevents the temp client from affecting the main session
                const { createClient } = await import('@supabase/supabase-js');
                const tempStorage = {};
                const tempClient = createClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL,
                    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
                    {
                        auth: {
                            storage: {
                                getItem: (key) => tempStorage[key] || null,
                                setItem: (key, value) => { tempStorage[key] = value; },
                                removeItem: (key) => { delete tempStorage[key]; }
                            },
                            storageKey: 'temp-password-check',
                            autoRefreshToken: false,
                            persistSession: false
                        }
                    }
                );

                const { error: passwordCheckError } = await tempClient.auth.signInWithPassword({
                    email: user.email,
                    password: currentPassword
                });

                // signInWithPassword returns error only if password is wrong
                // For MFA accounts, it returns data with session needing MFA, not an error
                if (passwordCheckError && passwordCheckError.message !== 'Invalid login credentials') {
                    // Some other error
                }

                if (passwordCheckError) {
                    setPasswordMessage({ type: 'error', text: 'Current password is incorrect' });
                    setPasswordLoading(false);
                    return;
                }

                // Now check MFA code

                if (!mfaCodeForPassword || mfaCodeForPassword.length !== 6) {
                    setNeedsMfaForPassword(true);
                    setPasswordMessage({ type: 'info', text: 'Password verified. Please enter your 2FA code to continue.' });
                    setPasswordLoading(false);
                    return;
                }

                // Check if already at AAL2 level
                const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

                if (aalData?.currentLevel !== 'aal2') {

                    try {
                        const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();

                        if (factorsError) {
                            throw factorsError;
                        }

                        const totpFactor = factors?.totp?.[0];

                        if (!totpFactor) {
                            setPasswordMessage({ type: 'error', text: 'MFA factor not found' });
                            setPasswordLoading(false);
                            return;
                        }
                        const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
                            factorId: totpFactor.id
                        });

                        if (challengeError) {
                            setPasswordMessage({ type: 'error', text: 'Failed to create MFA challenge: ' + challengeError.message });
                            setPasswordLoading(false);
                            return;
                        }
                        const { data: verifyData, error: verifyError } = await supabase.auth.mfa.verify({
                            factorId: totpFactor.id,
                            challengeId: challengeData.id,
                            code: mfaCodeForPassword
                        });

                        if (verifyError) {
                            setPasswordMessage({ type: 'error', text: 'Invalid 2FA code: ' + verifyError.message });
                            setPasswordLoading(false);
                            return;
                        }
                    } catch (mfaErr) {
                        console.error('handleChangePassword: MFA error:', mfaErr);
                        setPasswordMessage({ type: 'error', text: mfaErr.message || 'MFA verification failed' });
                        setPasswordLoading(false);
                        return;
                    }
                } else {
                }
            } else {
                // No MFA - verify current password by re-authenticating

                const { error: signInError } = await supabase.auth.signInWithPassword({
                    email: user.email,
                    password: currentPassword
                });

                if (signInError) {
                    setPasswordMessage({ type: 'error', text: 'Current password is incorrect' });
                    setPasswordLoading(false);
                    return;
                }
            }

            // Step 2: Update to new password (with timeout fallback)

            // Create timeout promise
            const timeoutPromise = new Promise((resolve) => {
                setTimeout(() => {
                    resolve({ data: null, error: null, timedOut: true });
                }, 5000);
            });

            // Race between updateUser and timeout
            const updateResult = await Promise.race([
                supabase.auth.updateUser({ password: newPassword }),
                timeoutPromise
            ]);

            // Check for error (only if we got a real response, not timeout)
            if (updateResult.error) {
                throw updateResult.error;
            }

            // Success!
            setPasswordMessage({ type: 'success', text: 'Password changed successfully!' });
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setMfaCodeForPassword('');
            setNeedsMfaForPassword(false);
            setPasswordVerified(false);

            // Close modal after delay
            setTimeout(() => {
                setPasswordModalOpen(false);
                setPasswordMessage(null);
            }, 2000);
        } catch (err) {
            setPasswordMessage({ type: 'error', text: err.message || 'Failed to change password' });
        } finally {
            setPasswordLoading(false);
        }
    };

    // Email Change
    const handleChangeEmail = async () => {
        if (!newEmail || !newEmail.includes('@')) {
            setEmailMessage({ type: 'error', text: 'Please enter a valid email address' });
            return;
        }

        if (newEmail === user?.email) {
            setEmailMessage({ type: 'error', text: 'New email is the same as current email' });
            return;
        }

        setEmailLoading(true);
        setEmailMessage(null);

        try {
            // Check if MFA is enabled and verify AAL level
            if (mfaEnabled) {
                const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

                if (aalData?.currentLevel !== 'aal2') {
                    // Need MFA verification
                    if (!mfaCodeForEmail || mfaCodeForEmail.length !== 6) {
                        setNeedsMfaForEmail(true);
                        setEmailMessage({ type: 'info', text: 'Please enter your 2FA code to continue' });
                        setEmailLoading(false);
                        return;
                    }

                    // Verify MFA code
                    const { data: factors } = await supabase.auth.mfa.listFactors();
                    const totpFactor = factors?.totp?.[0];

                    if (!totpFactor) {
                        setEmailMessage({ type: 'error', text: 'MFA factor not found' });
                        setEmailLoading(false);
                        return;
                    }

                    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
                        factorId: totpFactor.id
                    });

                    if (challengeError) {
                        setEmailMessage({ type: 'error', text: 'Failed to create MFA challenge' });
                        setEmailLoading(false);
                        return;
                    }

                    const { error: verifyError } = await supabase.auth.mfa.verify({
                        factorId: totpFactor.id,
                        challengeId: challengeData.id,
                        code: mfaCodeForEmail
                    });

                    if (verifyError) {
                        setEmailMessage({ type: 'error', text: 'Invalid 2FA code' });
                        setEmailLoading(false);
                        return;
                    }
                }
            }

            const { error } = await supabase.auth.updateUser({ email: newEmail });

            if (error) throw error;

            setEmailMessage({
                type: 'success',
                text: 'Verification email sent! Please check your inbox and confirm the new email address.'
            });
            setNewEmail('');
            setMfaCodeForEmail('');
            setNeedsMfaForEmail(false);

        } catch (err) {
            setEmailMessage({ type: 'error', text: err.message || 'Failed to update email' });
        } finally {
            setEmailLoading(false);
        }
    };

    // Export
    const handleExport = async (format = 'json') => {
        try {
            const { exportSites } = await import('../../lib/exportImport.js');
            const result = await exportSites(user?.id, format);
            if (!result.success) {
                setImportMessage({ type: 'error', text: `Export failed: ${result.error}` });
            }
        } catch (err) {
            console.error('Export failed:', err);
            setImportMessage({ type: 'error', text: `Export error: ${err.message}` });
        }
    };

    // Import
    const handleFileSelect = async (file) => {
        if (!file) {
            return;
        }

        console.log('File selected for import:', {
            name: file.name,
            size: file.size,
            type: file.type
        });

        try {
            const { parseImportFile } = await import('../../lib/exportImport.js');
            const data = await parseImportFile(file);
            console.log('File parsed successfully:', {
                sitesCount: data?.sites?.length || 0,
                sites: data?.sites
            });

            if (data?.sites?.length) {
                setImportPreview(data);
                setImportFile(file);
                setImportMessage({ type: 'info', text: `Ready to import ${data.sites.length} site(s)` });
            } else {
                setImportMessage({ type: 'error', text: 'Invalid file format or no sites found' });
                setImportFile(null);
            }
        } catch (err) {
            console.error('Parse error:', err);
            setImportMessage({ type: 'error', text: err.message });
            setImportFile(null);
        }
    };

    const handleImport = async () => {
        if (!importPreview?.sites) {
            setImportMessage({ type: 'error', text: 'Please select a valid file first' });
            return;
        }

        console.log('Starting import:', {
            sitesCount: importPreview.sites.length,
            userId: user?.id,
            sites: importPreview.sites
        });

        setImportLoading(true);
        try {
            const { importSites } = await import('../../lib/exportImport.js');
            await importSites(importPreview.sites, user?.id);
            setImportMessage({ type: 'success', text: 'Sites imported successfully!' });
            setImportFile(null);
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

    // ---------- Link Checker (broken link detection) ----------
    const [linkCheckLoading, setLinkCheckLoading] = useState(false);
    const [linkCheckResult, setLinkCheckResult] = useState(null);

    const handleRunLinkCheck = async () => {
        setLinkCheckLoading(true);
        setLinkCheckResult(null);
        try {
            const payload = { sites: (sites || []).map(s => ({ id: s.id, url: s.url, name: s.name })) };
            const result = await fetchAPI('/links/check', { method: 'POST', body: JSON.stringify(payload) });
            setLinkCheckResult(result);
        } catch (err) {
            setLinkCheckResult({ error: err.message });
        } finally {
            setLinkCheckLoading(false);
        }
    };

    const brokenCount = linkCheckResult?.brokenCount ?? null;

    return (
        <div className="p-3 sm:p-6">
            <div>
                {/* Profile Section */}
                <div className="bg-app-bg-light border border-app-border rounded-lg p-6 mb-6">
                    <h2 className="text-lg font-semibold text-app-text-primary mb-4">Profile</h2>

                    <div className="flex items-center gap-4 mb-6">
                        <div className="relative">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-2xl font-medium">
                                {avatar ? (
                                    <img
                                        src={avatar}
                                        alt="Avatar preview"
                                        className="w-16 h-16 rounded-full object-cover"
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

                    {/* Email section */}
                    <div className="mb-4 pb-4 border-b border-app-border">
                        <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-2">
                            <div className="min-w-0">
                                <p className="text-sm text-app-text-secondary">Email</p>
                                <p className="text-app-text-primary font-medium truncate">{user?.email}</p>
                            </div>
                            <button
                                onClick={() => setEmailModalOpen(true)}
                                className="w-full xs:w-auto px-3 py-1.5 xs:py-1 bg-app-bg-secondary border border-app-border text-app-text-primary rounded-lg hover:bg-app-bg-light transition-colors text-sm text-center"
                            >
                                Change
                            </button>
                        </div>
                    </div>

                    {/* Name section */}
                    <div className="mb-4 pb-4 border-b border-app-border">
                        {editingName ? (
                            <div>
                                <label className="block text-sm text-app-text-secondary mb-2">Display Name</label>
                                <input
                                    type="text"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    placeholder="Enter your name"
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
                    {/* Password section */}
                    <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-2">
                        <div>
                            <p className="text-sm text-app-text-secondary">Password</p>
                            <p className="text-app-text-primary font-medium">••••••••</p>
                        </div>
                        <button
                            onClick={() => setPasswordModalOpen(true)}
                            className="w-full xs:w-auto px-3 py-1.5 xs:py-1 bg-app-bg-secondary border border-app-border text-app-text-primary rounded-lg hover:bg-app-bg-light transition-colors text-sm text-center"
                        >
                            Change
                        </button>
                    </div>
                </div>

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
                        Upload a previously exported file (JSON, CSV, or HTML) to restore or transfer sites. Categories and tags will be automatically created if they don't exist. Duplicate categories and tags are automatically detected and reused.
                    </p>

                    {/* File Input with Icon Button */}
                    {!importPreview ? (
                        <div className="mb-4">
                            <input
                                type="file"
                                accept=".json,.csv,.html"
                                onChange={(e) => {
                                    handleFileSelect(e.target.files?.[0]);
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
                                    setImportFile(null);
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
                            onClick={() => {
                                handleImport();
                            }}
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
                {/* Link Checker & Statistics Section */}
                <div className="bg-app-bg-light border border-app-border rounded-lg p-4 sm:p-6 mb-6">
                    <h2 className="text-lg font-semibold text-app-text-primary mb-2">Link Checker & Statistics</h2>
                    <p className="text-sm text-app-text-secondary mb-4">Run a quick check to find unreachable links. Results are not saved automatically.</p>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between p-3 sm:p-4 bg-app-bg-secondary rounded-lg border border-app-border mb-3">
                        <div>
                            <h3 className="text-app-text-primary font-medium text-sm sm:text-base">Quick Stats</h3>
                            <div className="text-sm text-app-text-secondary mt-1">
                                <div>Sites: <strong className="text-app-text-primary">{stats?.sites ?? 0}</strong></div>
                                <div>Categories: <strong className="text-app-text-primary">{stats?.categories ?? 0}</strong></div>
                                <div>Tags: <strong className="text-app-text-primary">{stats?.tags ?? 0}</strong></div>
                                <div>Broken links: <strong className="text-app-text-primary">{linkCheckResult?.brokenCount ?? '—'}</strong></div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleRunLinkCheck}
                                disabled={linkCheckLoading}
                                className="px-3 py-1.5 bg-[#1E4976] border border-[#2A5A8A] text-[#6CBBFB] rounded-lg hover:bg-[#2A5A8A] hover:text-[#8DD0FF] font-medium transition-colors text-sm"
                            >
                                {linkCheckLoading ? 'Checking...' : 'Run Link Checker'}
                            </button>
                        </div>
                    </div>

                    {linkCheckResult?.broken && linkCheckResult.broken.length > 0 && (
                        <div className="p-3 bg-app-bg-primary rounded-lg border border-app-border">
                            <h4 className="text-sm font-medium text-app-text-primary mb-2">Broken links ({linkCheckResult.broken.length})</h4>
                            <ul className="text-sm text-app-text-secondary list-disc list-inside space-y-1 max-h-40 overflow-auto">
                                {linkCheckResult.broken.map(b => (
                                    <li key={b.id}>
                                        <a className="underline text-app-accent" href={b.url} target="_blank" rel="noreferrer">{b.name || b.url}</a>
                                        <span className="text-xs text-app-text-muted ml-2">{b.status}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {/* Security Section */}
                <div className="bg-app-bg-light border border-app-border rounded-lg p-4 sm:p-6 mb-6">
                    <h2 className="text-lg font-semibold text-app-text-primary mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        Security
                    </h2>

                    <div className="space-y-4">
                        {/* Two-Factor Authentication */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between p-3 sm:p-4 bg-app-bg-secondary rounded-lg border border-app-border">
                            <div className="flex items-center gap-3">
                                {mfaEnabled && (
                                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                )}
                                {!mfaEnabled && mfaFactorId && (
                                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                                )}
                                <div>
                                    <h3 className="text-app-text-primary font-medium text-sm sm:text-base">Two-Factor Authentication</h3>
                                    <p className="text-sm text-app-text-secondary mt-1">
                                        {mfaEnabled
                                            ? 'Your account is protected with 2FA'
                                            : mfaFactorId
                                                ? 'Setup incomplete - click to finish'
                                                : 'Add an extra layer of security to your account'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                {mfaEnabled && (
                                    <button
                                        onClick={handleUnenrollMfa}
                                        disabled={mfaLoading}
                                        className="px-4 py-2 rounded-lg transition-colors font-medium text-sm bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500/30 disabled:opacity-50"
                                    >
                                        {mfaLoading ? 'Disabling...' : 'Disable'}
                                    </button>
                                )}
                                <button
                                    onClick={() => setMfaModalOpen(true)}
                                    className={`px-4 py-2 rounded-lg transition-colors font-medium text-sm ${mfaEnabled
                                        ? 'bg-app-bg-secondary border border-app-border text-app-text-primary hover:bg-app-bg-light'
                                        : 'bg-[#1E4976] border border-[#2A5A8A] text-[#6CBBFB] hover:bg-[#2A5A8A] hover:text-[#8DD0FF]'
                                        }`}
                                >
                                    {mfaEnabled ? 'Manage' : mfaFactorId ? 'Continue Setup' : 'Enable'}
                                </button>
                            </div>
                        </div>

                        {/* Sign Out All Devices */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between p-3 sm:p-4 bg-app-bg-secondary rounded-lg border border-app-border">
                            <div>
                                <h3 className="text-app-text-primary font-medium text-sm sm:text-base">Sign Out All Devices</h3>
                                <p className="text-sm text-app-text-secondary mt-1">
                                    Sign out from all devices including this one
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setSignOutOthersModalOpen(true);
                                }}
                                className="px-4 py-2 bg-app-bg-secondary border border-app-border text-app-text-primary rounded-lg hover:bg-app-bg-light transition-colors font-medium text-sm"
                            >
                                Sign Out All
                            </button>
                        </div>

                        {/* Active Sessions */}
                        <div className="p-3 sm:p-4 bg-app-bg-secondary rounded-lg border border-app-border">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0 mb-3">
                                <h3 className="text-app-text-primary font-medium text-sm sm:text-base">Active Sessions</h3>
                                <span className="text-xs text-app-text-tertiary">Current device shown</span>
                            </div>

                            {sessionInfo ? (
                                <div className="space-y-3">
                                    {/* Current Device */}
                                    <div className="flex flex-col xs:flex-row items-start xs:items-center gap-2 xs:gap-3 p-2 sm:p-3 bg-app-bg-primary rounded-lg border border-app-border">
                                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-app-accent/20 rounded-lg flex items-center justify-center flex-shrink-0">
                                            <svg className="w-5 h-5 text-app-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                                <p className="text-app-text-primary font-medium text-sm sm:text-base">{sessionInfo.browser} on {sessionInfo.os}</p>
                                                <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full w-fit\">This device</span>
                                            </div>
                                            <p className="text-xs text-app-text-tertiary mt-1">
                                                Last sign in: {sessionInfo.createdAt ? new Date(sessionInfo.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Unknown'}
                                            </p>
                                        </div>
                                    </div>

                                    <p className="text-xs text-app-text-tertiary">
                                        <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        Other active sessions are not visible from the browser for security reasons. Use "Sign Out Others" to end all other sessions.
                                    </p>
                                </div>
                            ) : (
                                <div className="text-sm text-app-text-secondary">Loading session info...</div>
                            )}
                        </div>
                    </div>
                </div>
                {/* Sign Out Section */}
                <div className="bg-app-bg-light border border-app-border rounded-lg p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-app-text-primary font-medium">Sign Out</h3>
                                <p className="text-sm text-app-text-secondary">Sign out from this device</p>
                            </div>
                        </div>
                        <button
                            onClick={signOut}
                            className="px-3 sm:px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg font-medium transition-colors"
                        >
                            Sign Out
                        </button>
                    </div>
                </div>
            </div>

            {/* Password Change Modal */}
            <Modal isOpen={passwordModalOpen} onClose={() => setPasswordModalOpen(false)} title="Change Password">
                <div className="space-y-4 mb-6">
                    <p className="text-sm text-app-text-secondary">
                        Change password for <span className="font-semibold text-app-text-primary">{user?.email}</span>
                    </p>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-app-text-secondary mb-2">Current Password</label>
                            <div className="relative">
                                <input
                                    type={showCurrentPassword ? 'text' : 'password'}
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    placeholder="Enter current password"
                                    className="w-full px-3 py-2 pr-12 bg-app-bg-secondary border border-app-border rounded-lg text-app-text-primary placeholder-app-text-tertiary focus:outline-none focus:ring-2 focus:ring-app-accent"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-app-text-tertiary hover:text-app-text-primary transition-colors"
                                >
                                    {showCurrentPassword ? (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                        </svg>
                                    ) : (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-app-text-secondary mb-2">New Password</label>
                            <div className="relative">
                                <input
                                    type={showNewPassword ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Enter new password"
                                    className="w-full px-3 py-2 pr-12 bg-app-bg-secondary border border-app-border rounded-lg text-app-text-primary placeholder-app-text-tertiary focus:outline-none focus:ring-2 focus:ring-app-accent"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-app-text-tertiary hover:text-app-text-primary transition-colors"
                                >
                                    {showNewPassword ? (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                        </svg>
                                    ) : (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-app-text-secondary mb-2">Confirm New Password</label>
                            <div className="relative">
                                <input
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm new password"
                                    className="w-full px-3 py-2 pr-12 bg-app-bg-secondary border border-app-border rounded-lg text-app-text-primary placeholder-app-text-tertiary focus:outline-none focus:ring-2 focus:ring-app-accent"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-app-text-tertiary hover:text-app-text-primary transition-colors"
                                >
                                    {showConfirmPassword ? (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                        </svg>
                                    ) : (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* MFA Code Input (shown when MFA is enabled) */}
                {needsMfaForPassword && (
                    <div className="mb-4 p-4 bg-app-bg-light border border-app-border rounded-lg">
                        <label className="block text-sm font-medium text-app-text-secondary mb-2">
                            🔐 Enter your 2FA code to continue
                        </label>
                        <input
                            type="text"
                            value={mfaCodeForPassword}
                            onChange={(e) => setMfaCodeForPassword(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="000000"
                            maxLength={6}
                            className="w-full px-3 py-2 bg-app-bg-secondary border border-app-border rounded-lg text-app-text-primary text-center text-xl tracking-widest font-mono placeholder-app-text-tertiary focus:outline-none focus:ring-2 focus:ring-app-accent"
                        />
                    </div>
                )}

                {/* Message */}
                {passwordMessage && (
                    <div
                        className={`mb-4 p-3 rounded-lg text-sm ${passwordMessage.type === 'success'
                            ? 'bg-green-500/20 text-green-400'
                            : passwordMessage.type === 'error'
                                ? 'bg-red-500/20 text-red-400'
                                : 'bg-blue-500/20 text-blue-400'
                            }`}
                    >
                        {passwordMessage.text}
                    </div>
                )}

                {/* Buttons */}
                <div className="flex gap-3">
                    <button
                        onClick={() => {
                            setPasswordModalOpen(false);
                            setCurrentPassword('');
                            setNewPassword('');
                            setConfirmPassword('');
                            setPasswordMessage(null);
                            setMfaCodeForPassword('');
                            setNeedsMfaForPassword(false);
                            setPasswordVerified(false);
                        }}
                        className="flex-1 px-4 py-2 bg-app-bg-secondary border border-app-border text-app-text-primary rounded-lg hover:bg-app-bg-light transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleChangePassword}
                        disabled={passwordLoading}
                        className="flex-1 px-4 py-2 bg-app-accent hover:bg-app-accentLight text-app-bg-primary rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                        {passwordLoading ? 'Changing...' : 'Change Password'}
                    </button>
                </div>
            </Modal>

            {/* Email Change Modal */}
            <Modal isOpen={emailModalOpen} onClose={() => { setEmailModalOpen(false); setEmailMessage(null); setNewEmail(''); setMfaCodeForEmail(''); setNeedsMfaForEmail(false); }} title="Change Email Address">
                <div className="space-y-4">
                    <p className="text-sm text-app-text-secondary">
                        Current email: <span className="text-app-text-primary font-medium">{user?.email}</span>
                    </p>

                    <div>
                        <label className="block text-sm font-medium text-app-text-secondary mb-2">New Email Address</label>
                        <input
                            type="email"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            placeholder="Enter new email address"
                            className="w-full px-4 py-2 bg-app-bg-secondary border border-app-border rounded-lg text-app-text-primary placeholder-app-text-tertiary focus:outline-none focus:ring-2 focus:ring-app-accent"
                        />
                    </div>

                    {/* MFA Code Input (shown when MFA is enabled) */}
                    {needsMfaForEmail && (
                        <div className="p-4 bg-app-bg-light border border-app-border rounded-lg">
                            <label className="block text-sm font-medium text-app-text-secondary mb-2">
                                🔐 Enter your 2FA code to continue
                            </label>
                            <input
                                type="text"
                                value={mfaCodeForEmail}
                                onChange={(e) => setMfaCodeForEmail(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="000000"
                                maxLength={6}
                                className="w-full px-3 py-2 bg-app-bg-secondary border border-app-border rounded-lg text-app-text-primary text-center text-xl tracking-widest font-mono placeholder-app-text-tertiary focus:outline-none focus:ring-2 focus:ring-app-accent"
                            />
                        </div>
                    )}

                    {emailMessage && (
                        <div className={`p-3 rounded-lg text-sm ${emailMessage.type === 'success' ? 'bg-green-500/20 text-green-400' : emailMessage.type === 'info' ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'
                            }`}>
                            {emailMessage.text}
                        </div>
                    )}

                    <p className="text-xs text-app-text-tertiary">
                        A verification link will be sent to your new email address. You'll need to confirm it before the change takes effect.
                    </p>

                    <div className="flex gap-3">
                        <button
                            onClick={() => { setEmailModalOpen(false); setEmailMessage(null); setNewEmail(''); setMfaCodeForEmail(''); setNeedsMfaForEmail(false); }}
                            className="flex-1 px-4 py-2 bg-app-bg-secondary border border-app-border text-app-text-primary rounded-lg hover:bg-app-bg-light transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleChangeEmail}
                            disabled={emailLoading || !newEmail}
                            className="flex-1 px-4 py-2 bg-app-accent hover:bg-app-accentLight text-app-bg-primary rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                            {emailLoading ? 'Sending...' : 'Send Verification'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* 2FA Modal */}
            <Modal isOpen={mfaModalOpen} onClose={() => { setMfaModalOpen(false); setMfaMessage(null); setMfaStep('initial'); setMfaVerifyCode(''); setMfaQrCode(null); }} title="Two-Factor Authentication">
                <div className="space-y-4">
                    {mfaEnabled ? (
                        // Already enabled - show disable option
                        <>
                            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-3">
                                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                                <p className="text-sm text-green-400 font-medium">
                                    Two-Factor Authentication is enabled
                                </p>
                            </div>

                            <p className="text-sm text-app-text-secondary">
                                Your account is protected with an authenticator app. You'll need to enter a code from your app when signing in.
                            </p>

                            {mfaMessage && (
                                <div className={`p-3 rounded-lg text-sm ${mfaMessage.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                    }`}>
                                    {mfaMessage.text}
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setMfaModalOpen(false)}
                                    className="flex-1 px-4 py-2 bg-app-bg-secondary border border-app-border text-app-text-primary rounded-lg hover:bg-app-bg-light transition-colors"
                                >
                                    Close
                                </button>
                                <button
                                    onClick={handleUnenrollMfa}
                                    disabled={mfaLoading}
                                    className="flex-1 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg transition-colors disabled:opacity-50"
                                >
                                    {mfaLoading ? 'Disabling...' : 'Disable 2FA'}
                                </button>
                            </div>
                        </>
                    ) : mfaStep === 'scanning' ? (
                        // Show QR code and verification
                        <>
                            <p className="text-sm text-app-text-secondary">
                                Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                            </p>

                            {mfaQrCode && (
                                <div className="flex justify-center p-4 bg-white rounded-lg">
                                    <img src={mfaQrCode} alt="2FA QR Code" className="w-48 h-48" />
                                </div>
                            )}

                            {mfaSecret && (
                                <div className="p-3 bg-app-bg-secondary rounded-lg border border-app-border">
                                    <p className="text-xs text-app-text-tertiary mb-1">Or enter this code manually:</p>
                                    <code className="text-sm text-app-accent font-mono break-all">{mfaSecret}</code>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-app-text-secondary mb-2">Enter 6-digit code</label>
                                <input
                                    type="text"
                                    value={mfaVerifyCode}
                                    onChange={(e) => setMfaVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    placeholder="000000"
                                    maxLength={6}
                                    className="w-full px-4 py-3 bg-app-bg-secondary border border-app-border rounded-lg text-app-text-primary placeholder-app-text-tertiary focus:outline-none focus:ring-2 focus:ring-app-accent text-center text-2xl tracking-widest font-mono"
                                />
                            </div>

                            {mfaMessage && (
                                <div className={`p-3 rounded-lg text-sm ${mfaMessage.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                    }`}>
                                    {mfaMessage.text}
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button
                                    onClick={() => { setMfaStep('initial'); setMfaQrCode(null); setMfaSecret(null); setMfaVerifyCode(''); setMfaMessage(null); }}
                                    className="flex-1 px-4 py-2 bg-app-bg-secondary border border-app-border text-app-text-primary rounded-lg hover:bg-app-bg-light transition-colors"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={handleVerifyMfa}
                                    disabled={mfaLoading || mfaVerifyCode.length !== 6}
                                    className="flex-1 px-4 py-2 bg-app-accent hover:bg-app-accentLight text-app-bg-primary rounded-lg font-medium transition-colors disabled:opacity-50"
                                >
                                    {mfaLoading ? 'Verifying...' : 'Verify & Enable'}
                                </button>
                            </div>
                        </>
                    ) : (
                        // Initial state - show info and enable button
                        <>
                            <p className="text-sm text-app-text-secondary">
                                Two-factor authentication adds an extra layer of security by requiring a code from your authenticator app in addition to your password.
                            </p>

                            <div className="space-y-2">
                                <h4 className="font-medium text-app-text-primary">To enable 2FA:</h4>
                                <ol className="list-decimal list-inside text-sm text-app-text-secondary space-y-1">
                                    <li>Download an authenticator app (Google Authenticator, Authy, etc.)</li>
                                    <li>Click "Set Up 2FA" below</li>
                                    <li>Scan the QR code with your app</li>
                                    <li>Enter the 6-digit code to verify</li>
                                </ol>
                            </div>

                            {mfaMessage && (
                                <div className={`p-3 rounded-lg text-sm ${mfaMessage.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                    }`}>
                                    {mfaMessage.text}
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setMfaModalOpen(false)}
                                    className="flex-1 px-4 py-2 bg-app-bg-secondary border border-app-border text-app-text-primary rounded-lg hover:bg-app-bg-light transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleEnrollMfa}
                                    disabled={mfaLoading}
                                    className="flex-1 px-4 py-2 bg-app-accent hover:bg-app-accentLight text-app-bg-primary rounded-lg font-medium transition-colors disabled:opacity-50"
                                >
                                    {mfaLoading ? 'Loading...' : 'Set Up 2FA'}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </Modal>

            {/* Sign Out Others Modal */}
            <Modal isOpen={signOutOthersModalOpen} onClose={() => setSignOutOthersModalOpen(false)} title="Sign Out All Devices">
                <div className="space-y-4">
                    <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-3">
                        <svg className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div>
                            <h4 className="text-amber-400 font-medium">Are you sure?</h4>
                            <p className="text-sm text-app-text-secondary mt-1">
                                This will sign out ALL devices and browsers including this one. You will need to sign in again.
                            </p>
                        </div>
                    </div>

                    <p className="text-sm text-app-text-tertiary">
                        Use this if you've logged in on a public computer or if you suspect unauthorized access to your account.
                    </p>

                    <div className="flex gap-3">
                        <button
                            onClick={() => setSignOutOthersModalOpen(false)}
                            className="flex-1 px-4 py-2 bg-app-bg-secondary border border-app-border text-app-text-primary rounded-lg hover:bg-app-bg-light transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={async () => {
                                setSignOutOthersLoading(true);
                                try {
                                    await supabase.auth.signOut({ scope: 'global' });
                                    // This will redirect to login since current session is also signed out
                                } catch (err) {
                                    console.error('Sign out others error:', err);
                                }
                                setSignOutOthersLoading(false);
                            }}
                            disabled={signOutOthersLoading}
                            className="flex-1 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 rounded-lg transition-colors disabled:opacity-50"
                        >
                            {signOutOthersLoading ? 'Signing out...' : 'Sign Out All Devices'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div >
    );
}
