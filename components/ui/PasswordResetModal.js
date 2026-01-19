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
        <Modal isOpen={isOpen} onClose={handleClose}>
            <div className="p-6 max-w-md w-full">
                <h2 className="text-xl font-semibold text-white mb-4">Reset Password</h2>

                <div className="mb-4">
                    <p className="text-sm text-gray-400 mb-4">
                        Enter a new password for <span className="font-semibold text-gray-300">{user?.email}</span>
                    </p>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">New Password</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Enter new password"
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Confirm Password</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Confirm new password"
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Message */}
                {message && (
                    <div
                        className={`mb-4 p-3 rounded-lg text-sm ${message.type === 'success'
                                ? 'bg-green-500/20 text-green-400'
                                : message.type === 'error'
                                    ? 'bg-red-500/20 text-red-400'
                                    : 'bg-blue-500/20 text-blue-400'
                            }`}
                    >
                        {message.text}
                    </div>
                )}

                {/* Buttons */}
                <div className="flex gap-3">
                    <button
                        onClick={handleClose}
                        className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleResetPassword}
                        disabled={loading}
                        className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                    >
                        {loading ? 'Resetting...' : 'Reset Password'}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
