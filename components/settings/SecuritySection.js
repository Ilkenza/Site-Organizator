import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Modal from '../ui/Modal';
import { ShieldCheckIcon, DesktopIcon, InfoCircleIcon, WarningIcon } from '../ui/Icons';

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
        } catch (err) {
            console.error('Sign out others error:', err);
        }
        setSignOutOthersLoading(false);
    };

    return (
        <>
            {/* Security Section */}
            <div className="bg-app-bg-light border border-app-border rounded-lg p-4 sm:p-6 mb-6">
                <h2 className="text-lg font-semibold text-app-text-primary mb-4 flex items-center gap-2">
                    <ShieldCheckIcon className="w-5 h-5" />
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
                                        <DesktopIcon className="w-5 h-5 text-app-accent" />
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
                                    <InfoCircleIcon className="w-4 h-4 inline mr-1" />
                                    Other active sessions are not visible from the browser for security reasons. Use &ldquo;Sign Out Others&rdquo; to end all other sessions.
                                </p>
                            </div>
                        ) : (
                            <div className="text-sm text-app-text-secondary">Unable to load session information. Please try refreshing the page.</div>
                        )}
                    </div>
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
                        <WarningIcon className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
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
        </>
    );
}
