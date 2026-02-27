import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Avatar from '../ui/Avatar';
import Button from '../ui/Button';
import Input from '../ui/Input';
import api from '../../services/api';
import Modal from '../ui/Modal';
import { BadgeCheck, Ban, EyeOff, MessageSquareOff, Trash2 } from 'lucide-react';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deleteModal, setDeleteModal] = useState(null);

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

  const toggleMute = async (userId, currentMuted) => {
    await api.put(`/admin/users/${userId}/mute`, { muted: !currentMuted });
    fetchUsers();
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
    </div>
  );
}
