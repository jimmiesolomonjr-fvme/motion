import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { LogOut, Crown, Shield, Users, ChevronRight, ChevronDown, Lock, Bell, Mail, Trash2, Share2, Copy, Check, Sparkles, Moon, Music, Zap, EyeOff, UserX, HeartCrack, BellOff, ShieldAlert, PauseCircle, MessageSquare, ArrowLeft, DollarSign, ExternalLink, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [blocked, setBlocked] = useState([]);
  const [hiddenUsers, setHiddenUsers] = useState([]);

  // Tips / Stripe Connect state
  const [connectStatus, setConnectStatus] = useState({ connected: false, chargesEnabled: false });
  const [connectLoading, setConnectLoading] = useState(false);

  // Change password state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState({ type: '', text: '' });
  const [changingPassword, setChangingPassword] = useState(false);

  // Notifications state
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(true);

  // Vibe preferences state
  const [showVibeInFeed, setShowVibeInFeed] = useState(true);
  const [afterDarkEnabled, setAfterDarkEnabled] = useState(false);
  const [autoplayMusic, setAutoplayMusic] = useState(true);

  // Referral state
  const [showReferral, setShowReferral] = useState(true);
  const [referralCode, setReferralCode] = useState('');
  const [referralCount, setReferralCount] = useState(0);
  const [copied, setCopied] = useState(false);

  // Delete account / churn-save state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteStep, setDeleteStep] = useState('reason'); // 'reason' | 'save' | 'confirm'
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteReasonText, setDeleteReasonText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/reports/blocked').then(({ data }) => setBlocked(data)).catch(() => {});
    api.get('/reports/hidden').then(({ data }) => setHiddenUsers(data)).catch(() => {});
    api.get('/users/notifications').then(({ data }) => {
      setNotificationsEnabled(data.notificationsEnabled);
      setEmailNotificationsEnabled(data.emailNotificationsEnabled ?? true);
    }).catch(() => {});
    api.get('/users/preferences').then(({ data }) => {
      setShowVibeInFeed(data.showVibeInFeed);
      setAfterDarkEnabled(data.afterDarkEnabled);
      setAutoplayMusic(data.autoplayMusic ?? true);
    }).catch(() => {});
    api.get('/users/referral').then(({ data }) => {
      setReferralCode(data.referralCode || '');
      setReferralCount(data.referralCount || 0);
    }).catch(() => {});
    api.get('/payments/connect/status').then(({ data }) => {
      setConnectStatus(data);
    }).catch(() => {});
  }, []);

  // Re-fetch connect status when returning from Stripe onboarding
  useEffect(() => {
    if (searchParams.get('connect') === 'success' || searchParams.get('connect') === 'refresh') {
      api.get('/payments/connect/status').then(({ data }) => {
        setConnectStatus(data);
      }).catch(() => {});
    }
  }, [searchParams]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleUnblock = async (userId) => {
    await api.delete(`/reports/block/${userId}`);
    setBlocked((prev) => prev.filter((b) => b.id !== userId));
  };

  const handleUnhide = async (userId) => {
    await api.delete(`/reports/hide/${userId}`);
    setHiddenUsers((prev) => prev.filter((h) => h.id !== userId));
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

  const handleToggleEmailNotifications = async () => {
    const newVal = !emailNotificationsEnabled;
    setEmailNotificationsEnabled(newVal);
    try {
      await api.put('/users/notifications', { emailEnabled: newVal });
    } catch {
      setEmailNotificationsEnabled(!newVal);
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

  const handleSetupTips = async () => {
    setConnectLoading(true);
    try {
      const { data } = await api.post('/payments/connect/onboard');
      if (data.url) window.location.href = data.url;
    } catch {
      setConnectLoading(false);
    }
  };

  const handleOpenDashboard = async () => {
    try {
      const { data } = await api.get('/payments/connect/dashboard');
      if (data.url) window.open(data.url, '_blank');
    } catch {}
  };

  const DELETE_REASONS = [
    { key: 'not_enough_users', label: 'Not enough users', icon: UserX, color: 'text-blue-400', bg: 'bg-blue-500/20' },
    { key: 'not_enough_matches', label: "I'm not getting enough matches", icon: HeartCrack, color: 'text-pink-400', bg: 'bg-pink-500/20' },
    { key: 'too_many_notifications', label: 'Too many notifications', icon: BellOff, color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
    { key: 'unwanted_attention', label: "I'm getting unwanted attention", icon: ShieldAlert, color: 'text-red-400', bg: 'bg-red-500/20' },
    { key: 'not_my_vibe', label: 'This is not my vibe', icon: PauseCircle, color: 'text-purple-400', bg: 'bg-purple-500/20' },
    { key: 'other', label: 'Other', icon: MessageSquare, color: 'text-gray-400', bg: 'bg-gray-500/20' },
  ];

  const SAVE_OFFERS = {
    not_enough_users: {
      title: "We're growing fast",
      message: "New people join Motion every day. Instead of deleting, you can pause your profile and come back when there are more people in your area.",
      action: 'Pause My Profile',
      actionType: 'pause',
    },
    not_enough_matches: {
      title: "Let's fix that",
      message: "A complete profile gets way more attention. Try adding more photos, updating your bio, or answering Vibe questions before you go.",
      action: 'Edit My Profile',
      actionType: 'edit_profile',
    },
    too_many_notifications: {
      title: 'We can fix that right now',
      message: "You don't have to leave — we'll turn off all email notifications so you only hear from us when you open the app.",
      action: 'Turn Off Notifications & Stay',
      actionType: 'disable_notifications',
    },
    unwanted_attention: {
      title: 'Your safety matters',
      message: "You can hide your profile from discovery so no one new can find you, while keeping your existing matches and conversations.",
      action: 'Hide My Profile',
      actionType: 'pause',
    },
    not_my_vibe: {
      title: 'We hear you',
      message: "Motion isn't for everyone — but your data doesn't have to go. Pause your profile and if things change, everything will be right where you left it.",
      action: 'Pause My Profile',
      actionType: 'pause',
    },
  };

  const openDeleteFlow = () => {
    setShowDeleteModal(true);
    setDeleteStep('reason');
    setDeleteReason('');
    setDeleteReasonText('');
    setDeletePassword('');
    setDeleteError('');
  };

  const handleReasonSelect = (key) => {
    setDeleteReason(key);
    if (key === 'other') {
      setDeleteStep('confirm');
    } else {
      setDeleteStep('save');
    }
  };

  const handleSaveAction = async (actionType) => {
    setSaving(true);
    try {
      if (actionType === 'pause') {
        await api.put('/users/pause', { paused: true });
        setShowDeleteModal(false);
        navigate('/feed');
      } else if (actionType === 'disable_notifications') {
        await api.put('/users/notifications', { enabled: false, emailEnabled: false });
        setNotificationsEnabled(false);
        setEmailNotificationsEnabled(false);
        setShowDeleteModal(false);
      } else if (actionType === 'edit_profile') {
        setShowDeleteModal(false);
        navigate('/profile');
      }
    } catch {
      // If save action fails, let them continue to delete
      setDeleteStep('confirm');
    } finally {
      setSaving(false);
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
      await api.delete('/users/account', {
        data: {
          password: deletePassword,
          reason: deleteReason || undefined,
          reasonText: deleteReasonText || undefined,
        },
      });
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
                <div className="mt-3 flex items-center justify-center gap-2">
                  {referralCount >= 3 ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs font-semibold">
                      <Zap size={12} /> Plug Badge Earned!
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">
                      Invite {3 - referralCount} more {3 - referralCount === 1 ? 'friend' : 'friends'} to earn the <span className="text-amber-400 font-semibold">Plug</span> badge
                    </span>
                  )}
                </div>
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
        <div className="flex items-center justify-between p-4 rounded-xl">
          <div className="flex-1 mr-3">
            <div className="flex items-center gap-2">
              <Mail size={18} className="text-gray-400" />
              <span className="text-white font-medium">Email Notifications</span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5 ml-7">Receive emails when someone views, likes, or messages you</p>
          </div>
          <button
            onClick={handleToggleEmailNotifications}
            className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${emailNotificationsEnabled ? 'bg-gold' : 'bg-gray-600'}`}
          >
            <span
              className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                emailNotificationsEnabled ? 'left-[calc(100%-1.625rem)]' : 'left-0.5'
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

      {/* Tips */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2 px-4">
          <DollarSign size={16} /> Tips
        </h2>
        {connectStatus.connected && connectStatus.chargesEnabled ? (
          <div className="px-4">
            <div className="flex items-center justify-between p-4 bg-dark-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                  <DollarSign size={16} className="text-green-400" />
                </div>
                <div>
                  <span className="text-white font-medium">Tips Enabled</span>
                  <p className="text-xs text-gray-500">You can receive tips on your stories</p>
                </div>
              </div>
              <button
                onClick={handleOpenDashboard}
                className="flex items-center gap-1 text-sm text-green-400 hover:text-green-300 transition-colors"
              >
                Dashboard <ExternalLink size={14} />
              </button>
            </div>
          </div>
        ) : (
          <div className="px-4">
            <div className="p-4 bg-dark-50 rounded-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <DollarSign size={20} className="text-green-400" />
                </div>
                <div>
                  <p className="text-white font-medium">Earn tips on your stories</p>
                  <p className="text-xs text-gray-500">Set up Stripe to receive tips directly to your bank account</p>
                </div>
              </div>
              <button
                onClick={handleSetupTips}
                disabled={connectLoading}
                className="w-full py-2.5 bg-green-500 text-white font-semibold rounded-xl text-sm hover:bg-green-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {connectLoading ? (
                  <><Loader2 size={16} className="animate-spin" /> Redirecting...</>
                ) : (
                  'Set Up Tips'
                )}
              </button>
            </div>
          </div>
        )}
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

      {/* Hidden Users */}
      {hiddenUsers.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2 px-4">
            <EyeOff size={16} /> Hidden Users
          </h2>
          <div className="space-y-2 px-4">
            {hiddenUsers.map((h) => (
              <div key={h.id} className="flex items-center justify-between p-3 bg-dark-50 rounded-xl">
                <span className="text-white text-sm">{h.profile?.displayName || 'Unknown'}</span>
                <Button variant="ghost" className="text-xs text-gold" onClick={() => handleUnhide(h.id)}>Unhide</Button>
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
          onClick={openDeleteFlow}
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

      {/* Delete Account — Churn Save Flow */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title={
        deleteStep === 'reason' ? 'Why are you leaving?' :
        deleteStep === 'save' ? 'Before you go...' : 'Delete Account'
      }>
        {/* Step 1: Reason Picker */}
        {deleteStep === 'reason' && (
          <div className="space-y-2">
            <p className="text-sm text-gray-400 mb-3">We'd love to know why so we can improve Motion.</p>
            {DELETE_REASONS.map(({ key, label, icon: Icon, color, bg }) => (
              <button
                key={key}
                onClick={() => handleReasonSelect(key)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-dark-100 hover:bg-dark-50 transition-colors text-left"
              >
                <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon size={16} className={color} />
                </div>
                <span className="text-sm text-white font-medium">{label}</span>
                <ChevronRight size={16} className="text-gray-600 ml-auto" />
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Save Offer (tailored to reason) */}
        {deleteStep === 'save' && SAVE_OFFERS[deleteReason] && (
          <div>
            <div className="text-center mb-5">
              <div className="w-14 h-14 rounded-full bg-gold/20 flex items-center justify-center mx-auto mb-3">
                {(() => { const r = DELETE_REASONS.find(r => r.key === deleteReason); const Icon = r?.icon; return Icon ? <Icon size={24} className="text-gold" /> : null; })()}
              </div>
              <h4 className="text-white font-bold text-base mb-2">{SAVE_OFFERS[deleteReason].title}</h4>
              <p className="text-sm text-gray-400 leading-relaxed">{SAVE_OFFERS[deleteReason].message}</p>
            </div>
            <button
              onClick={() => handleSaveAction(SAVE_OFFERS[deleteReason].actionType)}
              disabled={saving}
              className="w-full py-3 bg-gold text-dark font-bold rounded-xl text-sm hover:bg-gold/90 disabled:opacity-50 transition-colors mb-3"
            >
              {saving ? 'Saving...' : SAVE_OFFERS[deleteReason].action}
            </button>
            <button
              onClick={() => setDeleteStep('confirm')}
              className="w-full py-2.5 text-gray-500 text-sm hover:text-gray-300 transition-colors"
            >
              I still want to delete my account
            </button>
          </div>
        )}

        {/* Step 3: Password Confirmation */}
        {deleteStep === 'confirm' && (
          <div>
            <button
              onClick={() => setDeleteStep(deleteReason === 'other' ? 'reason' : 'save')}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 mb-3 transition-colors"
            >
              <ArrowLeft size={14} /> Back
            </button>
            {deleteReason === 'other' && (
              <div className="mb-4">
                <p className="text-xs text-gray-400 mb-2">Tell us why you're leaving (optional)</p>
                <textarea
                  value={deleteReasonText}
                  onChange={(e) => setDeleteReasonText(e.target.value)}
                  placeholder="What could we have done better?"
                  rows={3}
                  className="w-full bg-dark-100 text-white text-sm rounded-xl px-3 py-2.5 border border-dark-50 focus:border-gold/50 outline-none resize-none"
                />
              </div>
            )}
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
          </div>
        )}
      </Modal>
    </AppLayout>
  );
}
