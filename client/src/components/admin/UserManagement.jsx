import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Avatar from '../ui/Avatar';
import Button from '../ui/Button';
import Input from '../ui/Input';
import api from '../../services/api';
import Modal from '../ui/Modal';
import { BadgeCheck, Ban, EyeOff, MessageSquareOff, Trash2, Edit3, Check, X } from 'lucide-react';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deleteModal, setDeleteModal] = useState(null);
  const [muteModal, setMuteModal] = useState(null); // { userId, currentMuted }
  const [muteReason, setMuteReason] = useState('');
  const [editingCode, setEditingCode] = useState(null); // userId being edited
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState('');

  const fetchUsers = async () => {
    const { data } = await api.get(`/admin/users?search=${search}&page=${page}`);
    setUsers(data.users);
    setTotalPages(data.pages);
  };

  useEffect(() => { fetchUsers(); }, [page, search]);

  const toggleBan = async (userId, currentBan) => {
    await api.put(`/admin/users/${userId}/ban`, { banned: !currentBan });
    fetchUsers();
  };

  const toggleVerify = async (userId, currentVerified) => {
    await api.put(`/admin/users/${userId}/verify`, { verified: !currentVerified });
    fetchUsers();
  };

  const toggleHide = async (userId, currentHidden) => {
    await api.put(`/admin/users/${userId}/hide`, { hidden: !currentHidden });
    fetchUsers();
  };

  const toggleMute = (userId, currentMuted) => {
    if (currentMuted) {
      // Unmute immediately — no reason needed
      api.put(`/admin/users/${userId}/mute`, { muted: false }).then(() => fetchUsers());
    } else {
      // Open modal to pick a reason before muting
      setMuteModal({ userId });
      setMuteReason('');
    }
  };

  const handleMuteWithReason = async () => {
    if (!muteModal) return;
    await api.put(`/admin/users/${muteModal.userId}/mute`, { muted: true, reason: muteReason || undefined });
    setMuteModal(null);
    setMuteReason('');
    fetchUsers();
  };

  const startEditCode = (userId, currentCode) => {
    setEditingCode(userId);
    setCodeInput(currentCode || '');
    setCodeError('');
  };

  const saveReferralCode = async (userId) => {
    try {
      setCodeError('');
      await api.put(`/admin/users/${userId}/referral-code`, { code: codeInput });
      setEditingCode(null);
      setCodeInput('');
      fetchUsers();
    } catch (err) {
      setCodeError(err.response?.data?.error || 'Failed to save');
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteModal) return;
    try {
      await api.delete(`/admin/users/${deleteModal}`);
      setDeleteModal(null);
      fetchUsers();
    } catch (err) {
      console.error('Delete user error:', err);
    }
  };

  return (
    <div>
      <Input
        placeholder="Search by name or email..."
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        className="mb-4"
      />

      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.id} className="flex items-center gap-3 p-3 bg-dark-100 rounded-xl">
            <Link to={`/profile/${u.id}`} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity">
              <Avatar src={u.profile?.photos} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-white truncate">{u.profile?.displayName || u.email}</span>
                  <span className={u.role === 'STEPPER' ? 'badge-stepper' : 'badge-baddie'}>{u.role}</span>
                  {u.isVerified && <BadgeCheck size={14} className="text-blue-400" />}
                  {u.isBanned && <span className="text-xs text-red-400 font-bold">BANNED</span>}
                  {u.isMuted && <span className="text-xs text-yellow-400 font-bold">MUTED</span>}
                  {u.isHidden && <span className="text-xs text-orange-400 font-bold">HIDDEN</span>}
                </div>
                <p className="text-xs text-gray-500">{u.email}</p>
                {editingCode === u.id ? (
                  <div className="flex items-center gap-1 mt-0.5" onClick={(e) => e.preventDefault()}>
                    <input
                      value={codeInput}
                      onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                      className="bg-dark-50 text-gold-400 text-xs font-mono px-1.5 py-0.5 rounded w-32 border border-gold-400/30 outline-none focus:border-gold-400/60"
                      placeholder="MOTION-XXXX"
                      onKeyDown={(e) => { if (e.key === 'Enter') saveReferralCode(u.id); if (e.key === 'Escape') setEditingCode(null); }}
                      autoFocus
                    />
                    <button onClick={(e) => { e.preventDefault(); saveReferralCode(u.id); }} className="p-0.5 text-green-400 hover:text-green-300"><Check size={12} /></button>
                    <button onClick={(e) => { e.preventDefault(); setEditingCode(null); }} className="p-0.5 text-gray-500 hover:text-gray-300"><X size={12} /></button>
                    {codeError && <span className="text-xs text-red-400">{codeError}</span>}
                  </div>
                ) : (
                  <div className="flex items-center gap-1 mt-0.5">
                    {u.referralCode && (
                      <span className="text-[10px] font-mono text-gold-400 bg-gold-400/10 px-1.5 py-0.5 rounded">{u.referralCode}</span>
                    )}
                    <button
                      onClick={(e) => { e.preventDefault(); startEditCode(u.id, u.referralCode); }}
                      className="p-0.5 text-gray-600 hover:text-gold-400 transition-colors"
                      title="Edit referral code"
                    >
                      <Edit3 size={10} />
                    </button>
                  </div>
                )}
              </div>
            </Link>
            <div className="flex gap-1">
              <button
                onClick={() => toggleVerify(u.id, u.isVerified)}
                className={`p-1.5 rounded-lg transition-colors ${u.isVerified ? 'bg-blue-500/20 text-blue-400' : 'bg-dark-50 text-gray-500'}`}
                title={u.isVerified ? 'Remove verification' : 'Verify user'}
              >
                <BadgeCheck size={16} />
              </button>
              <button
                onClick={() => toggleMute(u.id, u.isMuted)}
                className={`p-1.5 rounded-lg transition-colors ${u.isMuted ? 'bg-yellow-500/20 text-yellow-400' : 'bg-dark-50 text-gray-500'}`}
                title={u.isMuted ? 'Unmute user' : 'Mute user'}
              >
                <MessageSquareOff size={16} />
              </button>
              <button
                onClick={() => toggleHide(u.id, u.isHidden)}
                className={`p-1.5 rounded-lg transition-colors ${u.isHidden ? 'bg-orange-500/20 text-orange-400' : 'bg-dark-50 text-gray-500'}`}
                title={u.isHidden ? 'Unhide from all' : 'Hide from all'}
              >
                <EyeOff size={16} />
              </button>
              <button
                onClick={() => toggleBan(u.id, u.isBanned)}
                className={`p-1.5 rounded-lg transition-colors ${u.isBanned ? 'bg-red-500/20 text-red-400' : 'bg-dark-50 text-gray-500'}`}
                title={u.isBanned ? 'Unban user' : 'Ban user'}
              >
                <Ban size={16} />
              </button>
              <button
                onClick={() => setDeleteModal(u.id)}
                className="p-1.5 rounded-lg bg-dark-50 text-gray-500 hover:text-red-400 transition-colors"
                title="Delete user"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <Button variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
          <span className="text-gray-400 text-sm py-2">{page} / {totalPages}</span>
          <Button variant="ghost" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}

      <Modal isOpen={!!deleteModal} onClose={() => setDeleteModal(null)} title="Delete User">
        <p className="text-sm text-gray-400 mb-4">
          This will permanently delete this user and all their data (messages, matches, moves, etc). This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setDeleteModal(null)} className="flex-1 px-4 py-2.5 bg-dark-100 text-white rounded-xl font-semibold text-sm hover:bg-dark-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleDeleteUser} className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-xl font-semibold text-sm hover:bg-red-600 transition-colors">
            Delete User
          </button>
        </div>
      </Modal>

      <Modal isOpen={!!muteModal} onClose={() => { setMuteModal(null); setMuteReason(''); }} title="Mute User">
        <p className="text-sm text-gray-400 mb-4">Select a reason for muting this user. They will see this reason when they try to send a message.</p>
        <div className="space-y-2 mb-4">
          {['Harassment', 'Spam', 'Inappropriate Content', 'Other'].map((reason) => (
            <button
              key={reason}
              onClick={() => setMuteReason(reason)}
              className={`w-full text-left px-4 py-2.5 rounded-xl text-sm transition-colors ${
                muteReason === reason
                  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40'
                  : 'bg-dark-100 text-gray-400 border border-transparent hover:bg-dark-50'
              }`}
            >
              {reason}
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={() => { setMuteModal(null); setMuteReason(''); }} className="flex-1 px-4 py-2.5 bg-dark-100 text-white rounded-xl font-semibold text-sm hover:bg-dark-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleMuteWithReason} disabled={!muteReason} className="flex-1 px-4 py-2.5 bg-yellow-500 text-dark rounded-xl font-semibold text-sm hover:bg-yellow-400 transition-colors disabled:opacity-50">
            Mute User
          </button>
        </div>
      </Modal>
    </div>
  );
}
