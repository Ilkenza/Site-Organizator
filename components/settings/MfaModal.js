import { useState, useEffect } from 'react';
import Image from 'next/image';
import Modal from '../ui/Modal';
import { supabase } from '../../lib/supabase';

export default function MfaModal({ isOpen, onClose, mfaEnabled, mfaFactorId: initialMfaFactorId, onMfaChange }) {
    const [mfaLoading, setMfaLoading] = useState(false);
    const [mfaQrCode, setMfaQrCode] = useState(null);
    const [mfaSecret, setMfaSecret] = useState(null);
    const [mfaFactorId, setMfaFactorId] = useState(initialMfaFactorId);
    const [mfaVerifyCode, setMfaVerifyCode] = useState('');
    const [mfaMessage, setMfaMessage] = useState(null);
    const [mfaStep, setMfaStep] = useState('initial');

    useEffect(() => {
        setMfaFactorId(initialMfaFactorId);
    }, [initialMfaFactorId]);

    const handleEnrollMfa = async () => {
        setMfaLoading(true);
        setMfaMessage(null);

        try {
            const { data: factors } = await supabase.auth.mfa.listFactors();
            const existingUnverified = factors?.totp?.find(f => f.status === 'unverified');

            if (existingUnverified) {
                try {
                    await supabase.auth.mfa.unenroll({ factorId: existingUnverified.id });
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

    const handleVerifyMfa = async () => {
        if (!mfaVerifyCode || mfaVerifyCode.length !== 6) {
            setMfaMessage({ type: 'error', text: 'Please enter a 6-digit code' });
            return;
        }

        setMfaLoading(true);
        setMfaMessage(null);

        try {
            const timeoutPromise = new Promise((resolve) => {
                setTimeout(() => {
                    resolve({ data: null, error: null, timedOut: true });
                }, 5000);
            });

            const result = await Promise.race([
                supabase.auth.mfa.challengeAndVerify({
                    factorId: mfaFactorId,
                    code: mfaVerifyCode
                }),
                timeoutPromise
            ]);

            if (result.error) throw result.error;

            setMfaMessage({ type: 'success', text: '2FA enabled successfully!' });
            setMfaVerifyCode('');
            setMfaQrCode(null);
            setMfaSecret(null);

            onMfaChange && onMfaChange(true, mfaFactorId);

            setTimeout(() => {
                setMfaStep('initial');
                onClose();
                setMfaMessage(null);
            }, 2000);
        } catch (err) {
            console.error('MFA verification error:', err);
            setMfaMessage({ type: 'error', text: err.message || 'Invalid code. Please try again.' });
        } finally {
            setMfaLoading(false);
        }
    };

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

            setMfaMessage({ type: 'success', text: '2FA disabled successfully' });
            onMfaChange && onMfaChange(false, null);

            setTimeout(() => {
                onClose();
                setMfaMessage(null);
            }, 2000);
        } catch (err) {
            console.error('MFA unenroll error:', err);
            setMfaMessage({ type: 'error', text: err.message || 'Failed to disable 2FA' });
        } finally {
            setMfaLoading(false);
        }
    };

    const handleClose = () => {
        setMfaStep('initial');
        setMfaVerifyCode('');
        setMfaQrCode(null);
        setMfaSecret(null);
        setMfaMessage(null);
        onClose();
    };

    const resetScanningStep = () => {
        setMfaStep('initial');
        setMfaQrCode(null);
        setMfaSecret(null);
        setMfaVerifyCode('');
        setMfaMessage(null);
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Two-Factor Authentication">
            <div className="space-y-4">
                {mfaEnabled ? (
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
                            Your account is protected with an authenticator app. You&apos;ll need to enter a code from your app when signing in.
                        </p>

                        {mfaMessage && (
                            <div className={`p-3 rounded-lg text-sm ${mfaMessage.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                }`}>
                                {mfaMessage.text}
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={handleClose}
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
                    <>
                        <p className="text-sm text-app-text-secondary">
                            Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                        </p>

                        {mfaQrCode && (
                            <div className="flex justify-center p-4 bg-white rounded-lg">
                                <Image src={mfaQrCode} alt="2FA QR Code" width={192} height={192} unoptimized className="w-48 h-48" />
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
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && mfaVerifyCode.length === 6 && !mfaLoading) {
                                        handleVerifyMfa();
                                    }
                                }}
                                placeholder="000000"
                                maxLength={6}
                                autoFocus
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
                                onClick={resetScanningStep}
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
                    <>
                        <p className="text-sm text-app-text-secondary">
                            Two-factor authentication adds an extra layer of security by requiring a code from your authenticator app in addition to your password.
                        </p>

                        <div className="space-y-2">
                            <h4 className="font-medium text-app-text-primary">To enable 2FA:</h4>
                            <ol className="list-decimal list-inside text-sm text-app-text-secondary space-y-1">
                                <li>Download an authenticator app (Google Authenticator, Authy, etc.)</li>
                                <li>Click &ldquo;Set Up 2FA&rdquo; below</li>
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
                                onClick={handleClose}
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
    );
}
