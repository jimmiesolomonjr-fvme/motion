import { useState, useEffect } from 'react';
import Avatar from '../ui/Avatar';
import Button from '../ui/Button';
import Input from '../ui/Input';
import api from '../../services/api';
import { BadgeCheck, Ban, EyeOff } from 'lucide-react';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

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
            <Avatar src={u.profile?.photos} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-white truncate">{u.profile?.displayName || u.email}</span>
                <span className={u.role === 'STEPPER' ? 'badge-stepper' : 'badge-baddie'}>{u.role}</span>
                {u.isVerified && <BadgeCheck size={14} className="text-blue-400" />}
                {u.isBanned && <span className="text-xs text-red-400 font-bold">BANNED</span>}
                {u.isHidden && <span className="text-xs text-orange-400 font-bold">HIDDEN</span>}
              </div>
              <p className="text-xs text-gray-500">{u.email}</p>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => toggleVerify(u.id, u.isVerified)}
                className={`p-1.5 rounded-lg transition-colors ${u.isVerified ? 'bg-blue-500/20 text-blue-400' : 'bg-dark-50 text-gray-500'}`}
                title={u.isVerified ? 'Remove verification' : 'Verify user'}
              >
                <BadgeCheck size={16} />
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
    </div>
  );
}
