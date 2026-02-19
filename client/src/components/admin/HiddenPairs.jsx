import { useState, useEffect } from 'react';
import api from '../../services/api';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { EyeOff, Trash2, Search } from 'lucide-react';

export default function HiddenPairs() {
  const [pairs, setPairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search1, setSearch1] = useState('');
  const [search2, setSearch2] = useState('');
  const [results1, setResults1] = useState([]);
  const [results2, setResults2] = useState([]);
  const [selected1, setSelected1] = useState(null);
  const [selected2, setSelected2] = useState(null);
  const [reason, setReason] = useState('');

  const fetchPairs = async () => {
    try {
      const { data } = await api.get('/admin/hidden-pairs');
      setPairs(data);
    } catch (err) {
      console.error('Fetch hidden pairs error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPairs(); }, []);

  const searchUsers = async (query, setResults) => {
    if (query.length < 2) { setResults([]); return; }
    try {
      const { data } = await api.get(`/admin/users?search=${query}`);
      setResults(data.users || []);
    } catch {
      setResults([]);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => searchUsers(search1, setResults1), 300);
    return () => clearTimeout(t);
  }, [search1]);

  useEffect(() => {
    const t = setTimeout(() => searchUsers(search2, setResults2), 300);
    return () => clearTimeout(t);
  }, [search2]);

  const handleCreate = async () => {
    if (!selected1 || !selected2) return;
    try {
      await api.post('/admin/hidden-pairs', { user1Id: selected1.id, user2Id: selected2.id, reason: reason || null });
      setSelected1(null);
      setSelected2(null);
      setSearch1('');
      setSearch2('');
      setReason('');
      setResults1([]);
      setResults2([]);
      fetchPairs();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create hidden pair');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/admin/hidden-pairs/${id}`);
      fetchPairs();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" /></div>;
  }

  const UserPicker = ({ label, search, setSearch, results, selected, setSelected }) => (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-300">{label}</label>
      {selected ? (
        <div className="flex items-center gap-2 p-2 bg-dark-100 rounded-lg">
          <span className="text-sm text-white flex-1">{selected.profile?.displayName || selected.email}</span>
          <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-white text-xs">change</button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {results.length > 0 && (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {results.slice(0, 5).map((u) => (
                <button
                  key={u.id}
                  onClick={() => { setSelected(u); setSearch(''); setResults([]); }}
                  className="w-full text-left p-2 rounded-lg bg-dark-100 hover:bg-dark-50 text-sm text-white"
                >
                  {u.profile?.displayName || u.email} <span className="text-gray-500 text-xs">({u.email})</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="card-elevated space-y-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <EyeOff size={16} /> Hide Users From Each Other
        </h3>
        <UserPicker label="User 1" search={search1} setSearch={setSearch1} results={results1} selected={selected1} setSelected={setSelected1} setResults={setResults1} />
        <UserPicker label="User 2" search={search2} setSearch={setSearch2} results={results2} selected={selected2} setSelected={setSelected2} setResults={setResults2} />
        <Input placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <Button variant="gold" onClick={handleCreate} disabled={!selected1 || !selected2} className="w-full">
          Hide From Each Other
        </Button>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-400 mb-2">Active Hidden Pairs ({pairs.length})</h3>
        {pairs.length === 0 ? (
          <p className="text-center text-gray-500 py-4">No hidden pairs</p>
        ) : (
          <div className="space-y-2">
            {pairs.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-3 bg-dark-100 rounded-xl">
                <EyeOff size={14} className="text-gray-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white">
                    <span className="font-medium">{p.user1.displayName || p.user1.email}</span>
                    <span className="text-gray-500 mx-2">&harr;</span>
                    <span className="font-medium">{p.user2.displayName || p.user2.email}</span>
                  </p>
                  {p.reason && <p className="text-xs text-gray-500">{p.reason}</p>}
                </div>
                <button onClick={() => handleDelete(p.id)} className="text-gray-400 hover:text-red-400">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
