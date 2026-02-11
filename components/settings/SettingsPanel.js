import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import AvatarSection from './AvatarSection';
import ProfileEditSection from './ProfileEditSection';
import ImportExportSection from './ImportExportSection';
import DuplicateDetectionSection from './DuplicateDetectionSection';
import StatsSection from './StatsSection';
import SecuritySection from './SecuritySection';
import PasswordModal from './PasswordModal';
import EmailModal from './EmailModal';
import MfaModal from './MfaModal';
import DangerZoneSection from './DangerZoneSection';
import BulkOrganizeSection from './BulkOrganizeSection';

export default function SettingsPanel({ onDeleteComplete }) {
    const { user, signOut, refreshUser } = useAuth();
    const { fetchData, showToast, activeTab } = useDashboard();

    const [passwordModalOpen, setPasswordModalOpen] = useState(false);
    const [emailModalOpen, setEmailModalOpen] = useState(false);
    const [mfaModalOpen, setMfaModalOpen] = useState(false);

    return (
        <>
            <div className="p-3 sm:p-6">
                <div>
                    {/* Profile Section */}
                    <div className="bg-app-bg-light border border-app-border rounded-lg p-6 mb-6">
                        <h2 className="text-lg font-semibold text-app-text-primary mb-4">Profile</h2>

                        <AvatarSection user={user} refreshUser={refreshUser} />

                        <ProfileEditSection user={user} refreshUser={refreshUser} />
                    </div>

                    <ImportExportSection user={user} fetchData={fetchData} showToast={showToast} />

                    <div className="bg-app-bg-light border border-app-border rounded-lg p-4 sm:p-6 mb-6">
                        <h2 className="text-lg font-semibold text-app-text-primary mb-2">Public Share</h2>
                        <p className="text-sm text-app-text-secondary mb-4">
                            Create shareable links for selected categories and tags.
                        </p>
                        <a
                            href="/share"
                            className="inline-flex px-4 py-2.5 bg-app-accent/20 border border-app-accent/30 text-app-accent hover:bg-app-accent/30 rounded-lg transition-all text-sm font-medium"
                        >
                            Open Share Manager
                        </a>
                    </div>

                    <BulkOrganizeSection user={user} fetchData={fetchData} showToast={showToast} />

                    <DuplicateDetectionSection />

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

                <DangerZoneSection onDeleteComplete={onDeleteComplete} signOut={signOut} />
            </div>

            <PasswordModal
                isOpen={passwordModalOpen}
                onClose={() => setPasswordModalOpen(false)}
                user={user}
            />

            <EmailModal
                isOpen={emailModalOpen}
                onClose={() => setEmailModalOpen(false)}
                user={user}
            />

            <MfaModal
                isOpen={mfaModalOpen}
                onClose={() => setMfaModalOpen(false)}
                user={user}
            />
        </>
    );
}