import { useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import Input from './Input';
import { useAuth } from '../../context/AuthContext';

export default function PasswordResetModal({ isOpen, onClose }) {
    const { user } = useAuth();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleResetPassword = async () => {
        if (!newPassword || !confirmPassword) {
            setMessage({ type: 'error', text: 'Please fill in all fields' });
            return;
        }

        if (newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: 'Passwords do not match' });
            return;
        }

        if (newPassword.length < 6) {
            setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
            return;
        }

        setLoading(true);
        try {
            // TODO: Implement actual password reset via Supabase
            // For now, show a placeholder
            setMessage({ type: 'success', text: 'Password reset feature coming soon' });
            setTimeout(() => {
                onClose();
                setNewPassword('');
                setConfirmPassword('');
                setMessage(null);
            }, 2000);
        } catch (err) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setNewPassword('');
        setConfirmPassword('');
        setMessage(null);
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title="Reset Password"
            size="sm"
            footer={
                <>
                    <Button variant="secondary" onClick={handleClose}>
                        Cancel
                    </Button>
                    <Button onClick={handleResetPassword} loading={loading}>
                        Reset Password
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                <p className="text-sm text-app-text-secondary">
                    Enter a new password for <span className="font-semibold text-app-text-primary">{user?.email}</span>
                </p>

                <Input
                    label="New Password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && newPassword && confirmPassword && !loading) {
                            handleResetPassword();
                        }
                    }}
                    placeholder="Enter new password"
                    autoFocus
                />

                <Input
                    label="Confirm Password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && newPassword && confirmPassword && !loading) {
                            handleResetPassword();
                        }
                    }}
                    placeholder="Confirm new password"
                />

                {/* Message */}
                {message && (
                    <div
                        className={`p-3 rounded-lg text-sm ${message.type === 'success'
                                ? 'bg-success-bg/30 text-success-text'
                                : message.type === 'error'
                                    ? 'bg-btn-danger/30 text-app-text-primary'
                                    : 'bg-app-accent/20 text-app-accent'
                            }`}
                    >
                        {message.text}
                    </div>
                )}
            </div>
        </Modal>
    );
}
