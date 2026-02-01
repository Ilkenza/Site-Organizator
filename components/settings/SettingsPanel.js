import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import AvatarSection from './AvatarSection';
import ProfileEditSection from './ProfileEditSection';
import ImportExportSection from './ImportExportSection';
import StatsSection from './StatsSection';
import SecuritySection from './SecuritySection';
import PasswordModal from './PasswordModal';
import EmailModal from './EmailModal';
import MfaModal from './MfaModal';

export default function SettingsPanel() {
    const { user, signOut, refreshUser } = useAuth();
    const { fetchData, showToast, activeTab } = useDashboard();

    const [passwordModalOpen, setPasswordModalOpen] = useState(false);
    const [emailModalOpen, setEmailModalOpen] = useState(false);
    const [mfaModalOpen, setMfaModalOpen] = useState(false);
    const [mfaEnabled, setMfaEnabled] = useState(false);
    const [mfaFactorId, setMfaFactorId] = useState(null);

    const handleMfaChange = (enabled, factorId) => {
        setMfaEnabled(enabled);
        setMfaFactorId(factorId);
    };

    return (
        <>
            <div className="p-3 sm:p-6">
                <div>
                    {/* Profile Section */}
                    <div className="bg-app-bg-light border border-app-border rounded-lg p-6 mb-6">
                        <h2 className="text-lg font-semibold text-app-text-primary mb-4">Profile</h2>

                        <AvatarSection user={user} refreshUser={refreshUser} />

                        <ProfileEditSection user={user} refreshUser={refreshUser} />

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

                    <ImportExportSection user={user} fetchData={fetchData} showToast={showToast} />

                    <StatsSection user={user} activeTab={activeTab} showToast={showToast} />
                </div>

                <SecuritySection
                    user={user}
                    activeTab={activeTab}
                    signOut={signOut}
                    onPasswordClick={() => setPasswordModalOpen(true)}
                    onEmailClick={() => setEmailModalOpen(true)}
                    onMfaClick={() => setMfaModalOpen(true)}
                />
            </div>

            <PasswordModal
                isOpen={passwordModalOpen}
                onClose={() => setPasswordModalOpen(false)}
                user={user}
                mfaEnabled={mfaEnabled}
            />

            <EmailModal
                isOpen={emailModalOpen}
                onClose={() => setEmailModalOpen(false)}
                user={user}
                mfaEnabled={mfaEnabled}
            />

            <MfaModal
                isOpen={mfaModalOpen}
                onClose={() => setMfaModalOpen(false)}
                user={user}
                mfaEnabled={mfaEnabled}
                mfaFactorId={mfaFactorId}
                onMfaChange={handleMfaChange}
            />
        </>
    );
}