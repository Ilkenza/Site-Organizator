import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Modal from '../ui/Modal';

export default function SecuritySection({
    user,
    activeTab,
    signOut,
    onPasswordClick,
    onEmailClick,
    onMfaClick
}) {
    const [mfaEnabled, setMfaEnabled] = useState(false);
    const [mfaLoading, setMfaLoading] = useState(false);
    const [mfaFactorId, setMfaFactorId] = useState(null);
    const [sessionInfo, setSessionInfo] = useState(null);
    const [sessionLoading, setSessionLoading] = useState(true);
    const [signOutOthersModalOpen, setSignOutOthersModalOpen] = useState(false);
    const [signOutOthersLoading, setSignOutOthersLoading] = useState(false);

    // Load session info and check MFA status
    useEffect(() => {
        const loadSecurityData = async () => {
            if (!supabase) {
                setSessionLoading(false);
                return;
            }

            setSessionLoading(true);
            try {
                // Load session info
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();
                if (!sessionError && session) {
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
                }

                // Check MFA status
                const factorsPromise = supabase.auth.mfa.listFactors();
                const factorsTimeout = new Promise((resolve) =>
                    setTimeout(() => resolve({ data: null, timedOut: true }), 3000)
                );
                const result = await Promise.race([factorsPromise, factorsTimeout]);

                if (result?.timedOut) {
                    console.warn('listFactors timed out in SecuritySection');
                    return;
                }

                const { data, error: mfaError } = result;
                if (mfaError) {
                    console.warn('Error checking MFA status:', mfaError.message);
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
                }
            } catch (err) {
                console.error('Error loading security data:', err);
            } finally {
                setSessionLoading(false);
            }
        };

        loadSecurityData();
    }, [activeTab, user?.id]);

    // Unenroll MFA
    const handleUnenrollMfa = async () => {
        if (!confirm('Are you sure you want to disable 2FA? This will make your account less secure.')) {
            return;
        }

        setMfaLoading(true);

        try {
            const { error } = await supabase.auth.mfa.unenroll({
                factorId: mfaFactorId
            });

            if (error) throw error;

            setMfaEnabled(false);
            setMfaFactorId(null);
        } catch (err) {
            console.error('MFA unenroll error:', err);
            alert(`Failed to disable 2FA: ${err.message}`);
        } finally {
            setMfaLoading(false);
        }
    };

    const handleSignOutOthers = async () => {
        setSignOutOthersLoading(true);
        try {
            await supabase.auth.signOut({ scope: 'global' });
            // This will redirect to login since current session is also signed out
        } catch (err) {
            console.error('Sign out others error:', err);
        }
        setSignOutOthersLoading(false);
    };

    // Delete account handler
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [deleteSuccessModal, setDeleteSuccessModal] = useState(false);
    const [deleteErrorModal, setDeleteErrorModal] = useState({ isOpen: false, message: '' });

    const handleDeleteAccount = async () => {
        if (deleteConfirmText !== 'DELETE') {
            setDeleteErrorModal({ isOpen: true, message: 'Please type DELETE to confirm' });
            return;
        }

        setDeleteLoading(true);
        try {
            // Delete user account via Supabase auth admin
            const { error } = await supabase.rpc('delete_user');
            if (error) throw error;

            setDeleteModalOpen(false);
            setDeleteSuccessModal(true);
            // Wait a moment for user to see success message, then sign out
            setTimeout(async () => {
                await signOut();
            }, 2000);
        } catch (err) {
            console.error('Delete account error:', err);
            setDeleteErrorModal({ isOpen: true, message: err.message || 'Failed to delete account' });
            setDeleteLoading(false);
        }
    };

    return (
        <>
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
                                onClick={onMfaClick}
                                className={`px-4 py-2 rounded-lg transition-colors font-medium text-sm ${mfaEnabled
                                    ? 'bg-app-bg-secondary border border-app-border text-app-text-primary hover:bg-app-bg-light'
                                    : 'bg-[#1E4976] border border-[#2A5A8A] text-[#6CBBFB] hover:bg-[#2A5A8A] hover:text-[#8DD0FF]'
                                    }`}
                            >
                                {mfaEnabled ? 'Manage' : mfaFactorId ? 'Continue Setup' : 'Enable'}
                            </button>
                        </div>
                    </div>

                    {/* Change Email */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between p-3 sm:p-4 bg-app-bg-secondary rounded-lg border border-app-border">
                        <div>
                            <h3 className="text-app-text-primary font-medium text-sm sm:text-base">Email Address</h3>
                            <p className="text-sm text-app-text-secondary mt-1">
                                Update your email address
                            </p>
                        </div>
                        <button
                            onClick={onEmailClick}
                            className="px-4 py-2 bg-app-bg-secondary border border-app-border text-app-text-primary rounded-lg hover:bg-app-bg-light transition-colors font-medium text-sm"
                        >
                            Change Email
                        </button>
                    </div>

                    {/* Change Password */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between p-3 sm:p-4 bg-app-bg-secondary rounded-lg border border-app-border">
                        <div>
                            <h3 className="text-app-text-primary font-medium text-sm sm:text-base">Password</h3>
                            <p className="text-sm text-app-text-secondary mt-1">
                                Update your password
                            </p>
                        </div>
                        <button
                            onClick={onPasswordClick}
                            className="px-4 py-2 bg-app-bg-secondary border border-app-border text-app-text-primary rounded-lg hover:bg-app-bg-light transition-colors font-medium text-sm"
                        >
                            Change Password
                        </button>
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
                            onClick={() => setSignOutOthersModalOpen(true)}
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

                        {sessionLoading ? (
                            <div className="text-sm text-app-text-secondary">Loading session info...</div>
                        ) : sessionInfo ? (
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
                                            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full w-fit">This device</span>
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
                                    Other active sessions are not visible from the browser for security reasons. Use &ldquo;Sign Out Others&rdquo; to end all other sessions.
                                </p>
                            </div>
                        ) : (
                            <div className="text-sm text-app-text-secondary">Unable to load session information. Please try refreshing the page.</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Sign Out Section */}
            <div className="bg-app-bg-light border border-app-border rounded-lg p-4 sm:p-6 mb-6">
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

            {/* Delete Account Section */}
            <div className="bg-red-500/5 border border-red-500/30 rounded-lg p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-500/30 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-red-400 font-medium">Delete Account</h3>
                            <p className="text-sm text-app-text-secondary">Permanently delete your account and all data</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setDeleteModalOpen(true)}
                        className="px-3 sm:px-4 py-2 bg-red-500/30 hover:bg-red-500/40 text-red-400 border border-red-500/40 rounded-lg font-medium transition-colors"
                    >
                        Delete Account
                    </button>
                </div>
            </div>

            {/* Sign Out Others Modal */}
            <Modal
                isOpen={signOutOthersModalOpen}
                onClose={() => setSignOutOthersModalOpen(false)}
                title="Sign Out All Devices"
            >
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
                        Use this if you&apos;ve logged in on a public computer or if you suspect unauthorized access to your account.
                    </p>

                    <div className="flex gap-3">
                        <button
                            onClick={() => setSignOutOthersModalOpen(false)}
                            className="flex-1 px-4 py-2 bg-app-bg-secondary border border-app-border text-app-text-primary rounded-lg hover:bg-app-bg-light transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSignOutOthers}
                            disabled={signOutOthersLoading}
                            className="flex-1 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 rounded-lg transition-colors disabled:opacity-50"
                        >
                            {signOutOthersLoading ? 'Signing out...' : 'Sign Out All Devices'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Delete Account Modal */}
            <Modal
                isOpen={deleteModalOpen}
                onClose={() => {
                    setDeleteModalOpen(false);
                    setDeleteConfirmText('');
                }}
                title="Delete Account"
            >
                <div className="space-y-4">
                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
                        <svg className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div>
                            <h4 className="text-red-400 font-medium">This action cannot be undone!</h4>
                            <p className="text-sm text-app-text-secondary mt-1">
                                Deleting your account will permanently remove:
                            </p>
                            <ul className="text-sm text-app-text-secondary mt-2 space-y-1 list-disc list-inside">
                                <li>All your saved sites and bookmarks</li>
                                <li>All categories and tags</li>
                                <li>Your profile and settings</li>
                                <li>All account data</li>
                            </ul>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-app-text-secondary mb-2">
                            Type <span className="text-red-400 font-mono">DELETE</span> to confirm:
                        </label>
                        <input
                            type="text"
                            value={deleteConfirmText}
                            onChange={(e) => setDeleteConfirmText(e.target.value)}
                            placeholder="DELETE"
                            className="w-full px-4 py-2 bg-app-bg-tertiary border border-app-border rounded-lg text-app-text-primary focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => {
                                setDeleteModalOpen(false);
                                setDeleteConfirmText('');
                            }}
                            className="flex-1 px-4 py-2 bg-app-bg-secondary border border-app-border text-app-text-primary rounded-lg hover:bg-app-bg-light transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleDeleteAccount}
                            disabled={deleteLoading || deleteConfirmText !== 'DELETE'}
                            className="flex-1 px-4 py-2 bg-red-500/30 hover:bg-red-500/40 text-red-400 border border-red-500/40 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {deleteLoading ? 'Deleting...' : 'Delete My Account'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Delete Success Modal */}
            <Modal
                isOpen={deleteSuccessModal}
                onClose={() => {}}
                title="Account Deleted"
                showCloseButton={false}
            >
                <div className="text-center py-4">
                    <div className="text-6xl mb-4">✅</div>
                    <p className="text-app-text-primary text-lg mb-2">
                        Your account has been deleted successfully
                    </p>
                    <p className="text-app-text-secondary text-sm">
                        Redirecting to login...
                    </p>
                </div>
            </Modal>

            {/* Delete Error Modal */}
            <Modal
                isOpen={deleteErrorModal.isOpen}
                onClose={() => setDeleteErrorModal({ isOpen: false, message: '' })}
                title="Error"
            >
                <div className="text-center py-4">
                    <div className="text-6xl mb-4">❌</div>
                    <p className="text-app-text-primary mb-2">
                        {deleteErrorModal.message}
                    </p>
                    <button
                        onClick={() => setDeleteErrorModal({ isOpen: false, message: '' })}
                        className="mt-4 px-6 py-2 bg-app-primary text-white rounded-lg hover:bg-app-primary-hover transition-colors"
                    >
                        OK
                    </button>
                </div>
            </Modal>
        </>
    );
}
