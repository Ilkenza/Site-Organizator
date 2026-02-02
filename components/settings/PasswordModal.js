import { useState } from 'react';
import Modal from '../ui/Modal';
import { supabase } from '../../lib/supabase';

export default function PasswordModal({ isOpen, onClose, user, mfaEnabled }) {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [mfaCodeForPassword, setMfaCodeForPassword] = useState('');
    const [needsMfaForPassword, setNeedsMfaForPassword] = useState(false);
    const [passwordMessage, setPasswordMessage] = useState(null);
    const [passwordLoading, setPasswordLoading] = useState(false);

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

        if (!supabase) {
            setPasswordMessage({ type: 'error', text: 'Authentication service not available. Please refresh the page.' });
            return;
        }

        if (!user?.email) {
            setPasswordMessage({ type: 'error', text: 'User session not found. Please sign in again.' });
            return;
        }

        setPasswordLoading(true);

        try {
            if (mfaEnabled) {
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

                if (passwordCheckError) {
                    setPasswordMessage({ type: 'error', text: 'Current password is incorrect' });
                    setPasswordLoading(false);
                    return;
                }

                if (!mfaCodeForPassword || mfaCodeForPassword.length !== 6) {
                    setNeedsMfaForPassword(true);
                    setPasswordMessage({ type: 'info', text: 'Password verified. Please enter your 2FA code to continue.' });
                    setPasswordLoading(false);
                    return;
                }

                const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

                if (aalData?.currentLevel !== 'aal2') {
                    try {
                        const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();

                        if (factorsError) throw factorsError;

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

                        const { error: verifyError } = await supabase.auth.mfa.verify({
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
                }
            } else {
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

            const timeoutPromise = new Promise((resolve) => {
                setTimeout(() => {
                    resolve({ data: null, error: null, timedOut: true });
                }, 5000);
            });

            const updateResult = await Promise.race([
                supabase.auth.updateUser({ password: newPassword }),
                timeoutPromise
            ]);

            if (updateResult.error) throw updateResult.error;

            setPasswordMessage({ type: 'success', text: 'Password changed successfully!' });
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setMfaCodeForPassword('');
            setNeedsMfaForPassword(false);

            setTimeout(() => {
                onClose();
                setPasswordMessage(null);
            }, 2000);
        } catch (err) {
            setPasswordMessage({ type: 'error', text: err.message || 'Failed to change password' });
        } finally {
            setPasswordLoading(false);
        }
    };

    const handleClose = () => {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setPasswordMessage(null);
        setMfaCodeForPassword('');
        setNeedsMfaForPassword(false);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Change Password">
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
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && currentPassword && newPassword && confirmPassword && !passwordLoading) {
                                        handleChangePassword();
                                    }
                                }}
                                placeholder="Enter current password"
                                autoFocus
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
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && currentPassword && newPassword && confirmPassword && !passwordLoading) {
                                        handleChangePassword();
                                    }
                                }}
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
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && currentPassword && newPassword && confirmPassword && !passwordLoading) {
                                        handleChangePassword();
                                    }
                                }}
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

            {needsMfaForPassword && (
                <div className="mb-4 p-4 bg-app-bg-light border border-app-border rounded-lg">
                    <label className="block text-sm font-medium text-app-text-secondary mb-2">
                        🔐 Enter your 2FA code to continue
                    </label>
                    <input
                        type="text"
                        value={mfaCodeForPassword}
                        onChange={(e) => setMfaCodeForPassword(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && mfaCodeForPassword.length === 6 && !passwordLoading) {
                                handleChangePassword();
                            }
                        }}
                        placeholder="000000"
                        maxLength={6}
                        autoFocus
                        className="w-full px-3 py-2 bg-app-bg-secondary border border-app-border rounded-lg text-app-text-primary text-center text-xl tracking-widest font-mono placeholder-app-text-tertiary focus:outline-none focus:ring-2 focus:ring-app-accent"
                    />
                </div>
            )}

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

            <div className="flex gap-3">
                <button
                    onClick={handleClose}
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
    );
}
