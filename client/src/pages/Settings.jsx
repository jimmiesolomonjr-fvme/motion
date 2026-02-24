import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { LogOut, Crown, Shield, Users, ChevronRight, ChevronDown, Lock, Bell, Trash2, Share2, Copy, Check, Sparkles, Moon, Music } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [blocked, setBlocked] = useState([]);

  // Change password state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState({ type: '', text: '' });
  const [changingPassword, setChangingPassword] = useState(false);

  // Notifications state
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Vibe preferences state
  const [showVibeInFeed, setShowVibeInFeed] = useState(true);
  const [afterDarkEnabled, setAfterDarkEnabled] = useState(false);
  const [autoplayMusic, setAutoplayMusic] = useState(true);

  // Referral state
  const [showReferral, setShowReferral] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [referralCount, setReferralCount] = useState(0);
  const [copied, setCopied] = useState(false);

  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api.get('/reports/blocked').then(({ data }) => setBlocked(data)).catch(() => {});
    api.get('/users/notifications').then(({ data }) => setNotificationsEnabled(data.notificationsEnabled)).catch(() => {});
    api.get('/users/preferences').then(({ data }) => {
      setShowVibeInFeed(data.showVibeInFeed);
      setAfterDarkEnabled(data.afterDarkEnabled);
      setAutoplayMusic(data.autoplayMusic ?? true);
    }).catch(() => {});
    api.get('/users/referral').then(({ data }) => {
      setReferralCode(data.referralCode || '');
      setReferralCount(data.referralCount || 0);
    }).catch(() => {});
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleUnblock = async (userId) => {
    await api.delete(`/reports/block/${userId}`);
    setBlocked((prev) => prev.filter((b) => b.id !== userId));
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordMsg({ type: '', text: '' });

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New passwords do not match' });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMsg({ type: 'error', text: 'Password must be at least 8 characters' });
      return;
    }

    setChangingPassword(true);
    try {
      await api.put('/auth/change-password', { currentPassword, newPassword });
      setPasswordMsg({ type: 'success', text: 'Password updated successfully' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordMsg({ type: 'error', text: err.response?.data?.error || 'Failed to change password' });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleToggleNotifications = async () => {
    const newVal = !notificationsEnabled;
    setNotificationsEnabled(newVal);
    try {
      await api.put('/users/notifications', { enabled: newVal });
    } catch {
      setNotificationsEnabled(!newVal);
    }
  };

  const handleToggleShowVibe = async () => {
    const newVal = !showVibeInFeed;
    setShowVibeInFeed(newVal);
    try {
      await api.put('/users/preferences', { showVibeInFeed: newVal });
    } catch {
      setShowVibeInFeed(!newVal);
    }
  };

  const handleToggleAfterDark = async () => {
    const newVal = !afterDarkEnabled;
    setAfterDarkEnabled(newVal);
    try {
      await api.put('/users/preferences', { afterDarkEnabled: newVal });
    } catch {
      setAfterDarkEnabled(!newVal);
    }
  };

  const handleToggleAutoplay = async () => {
    const newVal = !autoplayMusic;
    setAutoplayMusic(newVal);
    try {
      await api.put('/users/preferences', { autoplayMusic: newVal });
    } catch {
      setAutoplayMusic(!newVal);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteError('');
    if (!deletePassword) {
      setDeleteError('Enter your password to confirm');
      return;
    }
    setDeleting(true);
    try {
      await api.delete('/users/account', { data: { password: deletePassword } });
      logout();
      navigate('/');
    } catch (err) {
      setDeleteError(err.response?.data?.error || 'Failed to delete account');
    } finally {
      setDeleting(false);
    }
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/register?ref=${referralCode}`;
    const shareData = { title: 'Join Motion', text: `Join me on Motion! Use my invite code: ${referralCode}`, url: shareUrl };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch { /* ignore */ }
    }
  };

  const menuItems = [
    { icon: Crown, label: 'Premium', to: '/premium', color: 'text-gold' },
    ...(user?.isAdmin ? [{ icon: Shield, label: 'Admin Dashboard', to: '/admin', color: 'text-red-400' }] : []),
  ];

  return (
    <AppLayout>
      <h1 className="text-xl font-bold text-white mb-6">Settings</h1>

      {/* Menu Links */}
      <div className="space-y-1 mb-6">
        {menuItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex items-center justify-between p-4 rounded-xl hover:bg-dark-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <item.icon className={item.color} size={20} />
              <span className="text-white font-medium">{item.label}</span>
            </div>
            <ChevronRight className="text-gray-600" size={18} />
          </Link>
        ))}
      </div>

      {/* Share Motion */}
      {referralCode && (
        <div className="mb-6">
          <button
            onClick={() => setShowReferral(!showReferral)}
            className="flex items-center justify-between w-full p-4 rounded-xl hover:bg-dark-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Share2 className="text-gold" size={20} />
              <span className="text-white font-medium">Share Motion</span>
            </div>
            <ChevronDown className={`text-gray-600 transition-transform ${showReferral ? 'rotate-180' : ''}`} size={18} />
          </button>
          {showReferral && (
            <div className="px-4 pb-4 space-y-3">
              <div className="bg-dark-50 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-400 mb-1">Your Invite Code</p>
                <p className="text-xl font-bold text-gold tracking-wider">{referralCode}</p>
                <p className="text-xs text-gray-500 mt-2">
                  {referralCount > 0
                    ? `${referralCount} ${referralCount === 1 ? 'person' : 'people'} joined with your code`
                    : 'No one has used your code yet'}
                </p>
              </div>
              <button
                onClick={handleShare}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-gold text-dark rounded-xl font-semibold text-sm hover:bg-gold/90 transition-colors"
              >
                {copied ? <><Check size={16} /> Copied!</> : <><Share2 size={16} /> Share Invite Link</>}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Change Password */}
      <div className="mb-6">
        <button
          onClick={() => { setShowPasswordForm(!showPasswordForm); setPasswordMsg({ type: '', text: '' }); }}
          className="flex items-center justify-between w-full p-4 rounded-xl hover:bg-dark-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Lock className="text-gray-400" size={20} />
            <span className="text-white font-medium">Change Password</span>
          </div>
          <ChevronDown className={`text-gray-600 transition-transform ${showPasswordForm ? 'rotate-180' : ''}`} size={18} />
        </button>
        {showPasswordForm && (
          <form onSubmit={handleChangePassword} className="px-4 pb-4 space-y-3">
            <input
              type="password"
              placeholder="Current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="input-field w-full"
              required
            />
            <input
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input-field w-full"
              required
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input-field w-full"
              required
            />
            {passwordMsg.text && (
              <p className={`text-sm ${passwordMsg.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                {passwordMsg.text}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={changingPassword}>
              {changingPassword ? 'Updating...' : 'Update Password'}
            </Button>
          </form>
        )}
      </div>

      {/* Notifications */}
      <div className="mb-6">
        <div className="flex items-center justify-between p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <Bell className="text-gray-400" size={20} />
            <span className="text-white font-medium">Notifications</span>
          </div>
          <button
            onClick={handleToggleNotifications}
            className={`relative w-12 h-7 rounded-full transition-colors ${notificationsEnabled ? 'bg-gold' : 'bg-gray-600'}`}
          >
            <span
              className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                notificationsEnabled ? 'left-[calc(100%-1.625rem)]' : 'left-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Vibe Preferences */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2 px-4">
          <Sparkles size={16} /> Vibe Preferences
        </h2>
        <div className="flex items-center justify-between p-4 rounded-xl">
          <div className="flex-1 mr-3">
            <span className="text-white font-medium">Show Vibe Answers in Feed</span>
            <p className="text-xs text-gray-500 mt-0.5">When off, vibe answers won't appear on anyone's card in your feed</p>
          </div>
          <button
            onClick={handleToggleShowVibe}
            className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${showVibeInFeed ? 'bg-gold' : 'bg-gray-600'}`}
          >
            <span
              className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                showVibeInFeed ? 'left-[calc(100%-1.625rem)]' : 'left-0.5'
              }`}
            />
          </button>
        </div>
        <div className="flex items-center justify-between p-4 rounded-xl">
          <div className="flex-1 mr-3">
            <div className="flex items-center gap-2">
              <Moon size={16} className="text-purple-400" />
              <span className="text-white font-medium">AfterDark Questions</span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">Enable spicier, more intimate vibe questions</p>
          </div>
          <button
            onClick={handleToggleAfterDark}
            className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${afterDarkEnabled ? 'bg-purple-500' : 'bg-gray-600'}`}
          >
            <span
              className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                afterDarkEnabled ? 'left-[calc(100%-1.625rem)]' : 'left-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Music */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2 px-4">
          <Music size={16} /> Music
        </h2>
        <div className="flex items-center justify-between p-4 rounded-xl">
          <div className="flex-1 mr-3">
            <span className="text-white font-medium">Autoplay Profile Songs</span>
            <p className="text-xs text-gray-500 mt-0.5">Automatically play profile songs when browsing</p>
          </div>
          <button
            onClick={handleToggleAutoplay}
            className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${autoplayMusic ? 'bg-gold' : 'bg-gray-600'}`}
          >
            <span
              className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                autoplayMusic ? 'left-[calc(100%-1.625rem)]' : 'left-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Blocked Users */}
      {blocked.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2 px-4">
            <Users size={16} /> Blocked Users
          </h2>
          <div className="space-y-2 px-4">
            {blocked.map((b) => (
              <div key={b.id} className="flex items-center justify-between p-3 bg-dark-50 rounded-xl">
                <span className="text-white text-sm">{b.profile?.displayName || 'Unknown'}</span>
                <Button variant="ghost" className="text-xs text-red-400" onClick={() => handleUnblock(b.id)}>Unblock</Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Danger Zone */}
      <div className="mb-6 mx-4 p-4 border border-red-500/30 rounded-xl">
        <h2 className="text-sm font-semibold text-red-400 mb-2">Danger Zone</h2>
        <p className="text-xs text-gray-500 mb-3">Permanently delete your account and all data. This cannot be undone.</p>
        <button
          onClick={() => { setShowDeleteModal(true); setDeletePassword(''); setDeleteError(''); }}
          className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 rounded-xl text-sm font-medium hover:bg-red-500/20 transition-colors"
        >
          <Trash2 size={16} /> Delete Account
        </button>
      </div>

      {/* Sign Out */}
      <div className="px-4">
        <Button variant="danger" className="w-full" onClick={handleLogout}>
          <LogOut size={16} className="inline mr-2" /> Sign Out
        </Button>
      </div>

      {/* Delete Account Modal */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Account">
        <p className="text-sm text-gray-400 mb-4">
          This will permanently delete your account, matches, messages, and all data. Enter your password to confirm.
        </p>
        <input
          type="password"
          placeholder="Enter your password"
          value={deletePassword}
          onChange={(e) => setDeletePassword(e.target.value)}
          className="input-field w-full mb-3"
        />
        {deleteError && <p className="text-sm text-red-400 mb-3">{deleteError}</p>}
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
          <button
            onClick={handleDeleteAccount}
            disabled={deleting}
            className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-xl font-semibold text-sm hover:bg-red-600 disabled:opacity-50 transition-colors"
          >
            {deleting ? 'Deleting...' : 'Delete Account'}
          </button>
        </div>
      </Modal>
    </AppLayout>
  );
}
