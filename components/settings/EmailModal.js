import { useState } from 'react';
import Modal from '../ui/Modal';
import { supabase } from '../../lib/supabase';

export default function EmailModal({ isOpen, onClose, user, mfaEnabled }) {
    const [newEmail, setNewEmail] = useState('');
    const [emailMessage, setEmailMessage] = useState(null);
    const [emailLoading, setEmailLoading] = useState(false);
    const [mfaCodeForEmail, setMfaCodeForEmail] = useState('');
    const [needsMfaForEmail, setNeedsMfaForEmail] = useState(false);

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
            if (mfaEnabled) {
                const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

                if (aalData?.currentLevel !== 'aal2') {
                    if (!mfaCodeForEmail || mfaCodeForEmail.length !== 6) {
                        setNeedsMfaForEmail(true);
                        setEmailMessage({ type: 'info', text: 'Please enter your 2FA code to continue' });
                        setEmailLoading(false);
                        return;
                    }

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

            // Close modal after showing success message
            setTimeout(() => {
                handleClose();
            }, 3000);

        } catch (err) {
            setEmailMessage({ type: 'error', text: err.message || 'Failed to update email' });
        } finally {
            setEmailLoading(false);
        }
    };

    const handleClose = () => {
        setNewEmail('');
        setEmailMessage(null);
        setMfaCodeForEmail('');
        setNeedsMfaForEmail(false);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Change Email Address">
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
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && newEmail && !emailLoading) {
                                handleChangeEmail();
                            }
                        }}
                        placeholder="Enter new email address"
                        className="w-full px-4 py-2 bg-app-bg-secondary border border-app-border rounded-lg text-app-text-primary placeholder-app-text-tertiary focus:outline-none focus:ring-2 focus:ring-app-accent"
                    />
                </div>

                {needsMfaForEmail && (
                    <div className="p-4 bg-app-bg-light border border-app-border rounded-lg">
                        <label className="block text-sm font-medium text-app-text-secondary mb-2">
                            🔐 Enter your 2FA code to continue
                        </label>
                        <input
                            type="text"
                            value={mfaCodeForEmail}
                            onChange={(e) => setMfaCodeForEmail(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && mfaCodeForEmail.length === 6 && !emailLoading) {
                                    handleChangeEmail();
                                }
                            }}
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
                    A verification link will be sent to your new email address. You&apos;ll need to confirm it before the change takes effect.
                </p>

                <div className="flex gap-3">
                    <button
                        onClick={handleClose}
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
    );
}
