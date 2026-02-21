import { useState, useEffect } from 'react';
import AppLayout from '../components/layout/AppLayout';
import MoveCard from '../components/moves/MoveCard';
import CreateMove from '../components/moves/CreateMove';
import MoveInterestList from '../components/moves/MoveInterestList';
import MoveFilters from '../components/moves/MoveFilters';
import MoveCountdown from '../components/moves/MoveCountdown';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import { Textarea } from '../components/ui/Input';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Plus, Flame, Trash2, Bookmark, RotateCcw, MapPin, Calendar, Users } from 'lucide-react';
import Input from '../components/ui/Input';
import { formatDate } from '../utils/formatters';

function getTimeFilterDates(time) {
  if (!time) return {};
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (time === 'tonight') {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return { after: now.toISOString(), before: tomorrow.toISOString() };
  }
  if (time === 'weekend') {
    const day = now.getDay();
    const friday = new Date(today);
    friday.setDate(today.getDate() + ((5 - day + 7) % 7));
    const monday = new Date(friday);
    monday.setDate(friday.getDate() + 3);
    return { after: friday.toISOString(), before: monday.toISOString() };
  }
  if (time === 'week') {
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    return { after: now.toISOString(), before: nextWeek.toISOString() };
  }
  return {};
}

export default function Moves() {
  const { user } = useAuth();
  const [moves, setMoves] = useState([]);
  const [myMoves, setMyMoves] = useState([]);
  const [savedMoves, setSavedMoves] = useState([]);
  const [expiredMoves, setExpiredMoves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [interestModal, setInterestModal] = useState(null);
  const [interestMessage, setInterestMessage] = useState('');
  const [counterProposal, setCounterProposal] = useState('');
  const [deleteModal, setDeleteModal] = useState(null);
  const [selectModal, setSelectModal] = useState(null); // { moveId, baddieId, baddieName }
  const [repostModal, setRepostModal] = useState(null); // expired move object
  const [repostDate, setRepostDate] = useState('');
  const [repostAnytime, setRepostAnytime] = useState(false);
  const [clearModal, setClearModal] = useState(false);
  const [tab, setTab] = useState(user?.role === 'STEPPER' ? 'mine' : 'browse');
  const [filters, setFilters] = useState({ time: null, category: null, sort: 'soonest' });

  useEffect(() => { fetchMoves(); }, []);

  useEffect(() => {
    if (tab === 'browse' || (tab === 'saved' && user?.role === 'BADDIE')) {
      fetchBrowseData();
    }
    if (tab === 'expired' && user?.role === 'STEPPER') {
      fetchExpired();
    }
  }, [filters, tab]);

  const fetchMoves = async () => {
    setLoading(true);
    try {
      await fetchBrowseData();
      if (user?.role === 'STEPPER') {
        const { data: mine } = await api.get('/moves/mine');
        setMyMoves(mine);
        const { data: expired } = await api.get('/moves/expired');
        setExpiredMoves(expired);
      }
      if (user?.role === 'BADDIE') {
        const { data: saved } = await api.get('/moves/saved');
        setSavedMoves(saved);
      }
    } catch (err) {
      console.error('Moves error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBrowseData = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.category) params.set('category', filters.category);
      if (filters.sort) params.set('sort', filters.sort);
      const timeDates = getTimeFilterDates(filters.time);
      if (timeDates.after) params.set('after', timeDates.after);
      if (timeDates.before) params.set('before', timeDates.before);
      const { data } = await api.get(`/moves?${params.toString()}`);
      setMoves(data);
    } catch (err) {
      console.error('Browse error:', err);
    }
  };

  const handleInterest = (moveId) => {
    setInterestModal(moveId);
  };

  const submitInterest = async () => {
    if (!interestModal) return;
    try {
      await api.post(`/moves/${interestModal}/interest`, {
        message: interestMessage || null,
        counterProposal: counterProposal || null,
      });
      setInterestModal(null);
      setInterestMessage('');
      setCounterProposal('');
      fetchMoves();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to express interest');
    }
  };

  const startConversation = async (baddieId) => {
    try {
      const { data } = await api.post(`/messages/start/${baddieId}`);
      window.location.href = `/chat/${data.id}`;
    } catch (err) {
      console.error('Start conversation error:', err);
    }
  };

  const handleDeleteMove = async () => {
    if (!deleteModal) return;
    try {
      await api.delete(`/moves/${deleteModal}`);
      setDeleteModal(null);
      setMoves((prev) => prev.filter((m) => m.id !== deleteModal));
      setMyMoves((prev) => prev.filter((m) => m.id !== deleteModal));
    } catch (err) {
      console.error('Delete move error:', err);
    }
  };

  const handleSelect = (baddieId, baddieName, moveId) => {
    setSelectModal({ moveId, baddieId, baddieName });
  };

  const confirmSelect = async () => {
    if (!selectModal) return;
    try {
      await api.put(`/moves/${selectModal.moveId}/select/${selectModal.baddieId}`);
      setSelectModal(null);
      const { data: mine } = await api.get('/moves/mine');
      setMyMoves(mine);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to select');
    }
  };

  const handleSave = async (moveId) => {
    try {
      await api.post(`/moves/${moveId}/save`);
      setMoves((prev) => prev.map((m) => m.id === moveId ? { ...m, isSaved: true } : m));
      const { data: saved } = await api.get('/moves/saved');
      setSavedMoves(saved);
    } catch (err) {
      console.error('Save error:', err);
    }
  };

  const handleUnsave = async (moveId) => {
    try {
      await api.delete(`/moves/${moveId}/save`);
      setMoves((prev) => prev.map((m) => m.id === moveId ? { ...m, isSaved: false } : m));
      setSavedMoves((prev) => prev.filter((m) => m.id !== moveId));
    } catch (err) {
      console.error('Unsave error:', err);
    }
  };

  const fetchExpired = async () => {
    try {
      const { data } = await api.get('/moves/expired');
      setExpiredMoves(data);
    } catch (err) {
      console.error('Expired error:', err);
    }
  };

  const handleRepost = async () => {
    if (!repostModal || !repostDate) return;
    try {
      await api.post(`/moves/${repostModal.id}/repost`, {
        date: repostAnytime ? repostDate : new Date(repostDate).toISOString(),
        isAnytime: repostAnytime,
      });
      setRepostModal(null);
      setRepostDate('');
      setRepostAnytime(false);
      fetchMoves();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to repost');
    }
  };

  const handleClearAll = async () => {
    try {
      await api.delete('/moves/expired/clear');
      setClearModal(false);
      setExpiredMoves([]);
    } catch (err) {
      console.error('Clear expired error:', err);
    }
  };

  const handleMoveUpdate = (updatedMove) => {
    setMyMoves((prev) => prev.map((m) => m.id === updatedMove.id ? { ...m, ...updatedMove } : m));
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  const isStepper = user?.role === 'STEPPER';
  const isBaddie = user?.role === 'BADDIE';

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Flame className="text-gold" size={20} />
          <h1 className="text-xl font-bold text-white">The Move</h1>
        </div>
        {isStepper && (
          <Button variant="gold" className="!px-3 !py-1.5 text-sm" onClick={() => setShowCreate(true)}>
            <Plus size={16} className="inline mr-1" /> New Move
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {isStepper ? (
          <>
            <button
              onClick={() => setTab('mine')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium ${tab === 'mine' ? 'bg-gold text-dark' : 'bg-dark-50 text-gray-400'}`}
            >
              My Moves
            </button>
            <button
              onClick={() => setTab('browse')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium ${tab === 'browse' ? 'bg-gold text-dark' : 'bg-dark-50 text-gray-400'}`}
            >
              All Moves
            </button>
            <button
              onClick={() => setTab('expired')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium ${tab === 'expired' ? 'bg-gold text-dark' : 'bg-dark-50 text-gray-400'}`}
            >
              Expired
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setTab('browse')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium ${tab === 'browse' ? 'bg-gold text-dark' : 'bg-dark-50 text-gray-400'}`}
            >
              Browse
            </button>
            <button
              onClick={() => setTab('saved')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium ${tab === 'saved' ? 'bg-gold text-dark' : 'bg-dark-50 text-gray-400'}`}
            >
              <Bookmark size={14} className="inline mr-1" /> Saved
            </button>
          </>
        )}
      </div>

      {/* Content */}
      {tab === 'mine' && isStepper ? (
        <div className="space-y-4">
          {myMoves.length === 0 ? (
            <div className="text-center py-12">
              <Flame className="text-gray-600 mx-auto mb-3" size={40} />
              <p className="text-gray-400 mb-2">No Moves yet</p>
              <p className="text-gray-500 text-sm mb-4">Create your first Move and make your intentions known</p>
              <Button variant="gold" onClick={() => setShowCreate(true)}>Create a Move</Button>
            </div>
          ) : (
            myMoves.map((move) => (
              <div key={move.id}>
                {move.status === 'CONFIRMED' && move.selectedBaddie ? (
                  <MoveCountdown move={move} currentUserId={user.id} onUpdate={handleMoveUpdate} />
                ) : (
                  <div className="card-elevated">
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-white">{move.title}</h3>
                        {move.status === 'COMPLETED' && (
                          <span className="px-2 py-0.5 bg-gray-500/20 text-gray-400 text-xs font-medium rounded-full">Completed</span>
                        )}
                        {move.category && (
                          <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs font-medium rounded-full">
                            {move.category.charAt(0) + move.category.slice(1).toLowerCase()}
                          </span>
                        )}
                      </div>
                      {move.status === 'OPEN' && (
                        <button
                          onClick={() => setDeleteModal(move.id)}
                          className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
                          title="Delete move"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                    {move.photo && (
                      <img src={move.photo} alt="" className="w-full h-36 object-cover rounded-lg mb-2" />
                    )}
                    <p className="text-gray-400 text-sm mb-2">{move.description}</p>
                    <p className="text-xs text-gray-500 mb-3">{formatDate(move.date)} · {move.location}</p>
                    {move.status !== 'COMPLETED' && (
                      <>
                        <h4 className="text-sm font-semibold text-gray-300 mb-2">Interested ({move.interests.length})</h4>
                        <MoveInterestList
                          interests={move.interests}
                          onStartConversation={startConversation}
                          onSelect={(baddieId, baddieName) => handleSelect(baddieId, baddieName, move.id)}
                          moveStatus={move.status}
                          selectedBaddieId={move.selectedBaddieId}
                        />
                      </>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : tab === 'expired' && isStepper ? (
        <div className="space-y-4">
          {expiredMoves.length > 0 && (
            <div className="flex justify-end">
              <button
                onClick={() => setClearModal(true)}
                className="text-sm text-red-400 hover:text-red-300 transition-colors"
              >
                Clear All Expired
              </button>
            </div>
          )}
          {expiredMoves.length === 0 ? (
            <div className="text-center py-12">
              <RotateCcw className="text-gray-600 mx-auto mb-3" size={40} />
              <p className="text-gray-400 mb-2">No expired Moves</p>
              <p className="text-gray-500 text-sm">Cancelled and completed Moves will appear here</p>
            </div>
          ) : (
            expiredMoves.map((move) => (
              <div key={move.id} className="card-elevated">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white">{move.title}</h3>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      move.status === 'COMPLETED' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {move.status === 'COMPLETED' ? 'Completed' : 'Cancelled'}
                    </span>
                  </div>
                  <button
                    onClick={() => { setRepostModal(move); setRepostDate(''); setRepostAnytime(move.isAnytime || false); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gold/10 text-gold text-sm font-medium rounded-full hover:bg-gold/20 transition-colors"
                  >
                    <RotateCcw size={14} /> Repost
                  </button>
                </div>
                <div className="flex flex-wrap gap-3 text-sm text-gray-400">
                  <span className="flex items-center gap-1">
                    <Calendar size={14} className="text-gold" />
                    {move.isAnytime
                      ? `Anytime ${new Date(move.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                      : formatDate(move.date)}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin size={14} className="text-gold" />
                    {move.location}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users size={14} className="text-gold" />
                    {move.interestCount} interested
                  </span>
                  {move.category && (
                    <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs font-medium rounded-full">
                      {move.category.charAt(0) + move.category.slice(1).toLowerCase()}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : tab === 'saved' && isBaddie ? (
        <div className="space-y-4">
          {savedMoves.length === 0 ? (
            <div className="text-center py-12">
              <Bookmark className="text-gray-600 mx-auto mb-3" size={40} />
              <p className="text-gray-400 mb-2">No saved Moves</p>
              <p className="text-gray-500 text-sm">Bookmark Moves you&apos;re interested in to find them later</p>
            </div>
          ) : (
            savedMoves.map((move) => (
              <MoveCard key={move.id} move={move} onInterest={handleInterest} userRole={user?.role} isAdmin={user?.isAdmin} onDelete={(id) => setDeleteModal(id)} onSave={handleSave} onUnsave={handleUnsave} />
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {isBaddie && <MoveFilters filters={filters} onFilterChange={setFilters} />}
          {moves.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400">No active Moves right now</p>
              <p className="text-gray-500 text-sm">Check back soon</p>
            </div>
          ) : (
            moves.map((move) => (
              <MoveCard key={move.id} move={move} onInterest={handleInterest} userRole={user?.role} isAdmin={user?.isAdmin} onDelete={(id) => setDeleteModal(id)} onSave={handleSave} onUnsave={handleUnsave} />
            ))
          )}
        </div>
      )}

      {/* Create Move Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create a Move">
        <CreateMove onCreated={() => fetchMoves()} onClose={() => setShowCreate(false)} />
      </Modal>

      {/* Interest Modal */}
      <Modal isOpen={!!interestModal} onClose={() => { setInterestModal(null); setCounterProposal(''); setInterestMessage(''); }} title="Express Interest">
        <div className="space-y-4">
          <p className="text-gray-400 text-sm">Leave a message to stand out (optional)</p>
          <Textarea
            placeholder="Hey, I'd love to join..."
            value={interestMessage}
            onChange={(e) => setInterestMessage(e.target.value)}
          />
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Counter-proposal (optional)</label>
            <Textarea
              placeholder="How about a different time or place?"
              value={counterProposal}
              onChange={(e) => setCounterProposal(e.target.value)}
            />
          </div>
          <Button variant="gold" className="w-full" onClick={submitInterest}>
            I&apos;m Interested
          </Button>
        </div>
      </Modal>

      {/* Selection Confirmation Modal */}
      <Modal isOpen={!!selectModal} onClose={() => setSelectModal(null)} title="Confirm Selection">
        <div className="space-y-4">
          <p className="text-gray-300 text-sm">
            Select <span className="text-white font-semibold">{selectModal?.baddieName}</span> for this Move?
          </p>
          <p className="text-gray-500 text-xs">
            This will confirm the Move and notify all interested Baddies.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setSelectModal(null)}>Cancel</Button>
            <Button variant="gold" className="flex-1" onClick={confirmSelect}>Confirm Selection</Button>
          </div>
        </div>
      </Modal>

      {/* Repost Move Modal */}
      <Modal isOpen={!!repostModal} onClose={() => { setRepostModal(null); setRepostDate(''); setRepostAnytime(false); }} title="Repost Move">
        <div className="space-y-4">
          <p className="text-gray-400 text-sm">
            Repost <span className="text-white font-semibold">&ldquo;{repostModal?.title}&rdquo;</span> with a new date.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Timing</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setRepostAnytime(false); setRepostDate(''); }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  !repostAnytime ? 'bg-gold text-dark' : 'bg-dark-50 text-gray-400 hover:text-white'
                }`}
              >
                Specific Time
              </button>
              <button
                type="button"
                onClick={() => { setRepostAnytime(true); setRepostDate(''); }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  repostAnytime ? 'bg-gold text-dark' : 'bg-dark-50 text-gray-400 hover:text-white'
                }`}
              >
                Anytime
              </button>
            </div>
          </div>
          <Input
            label={repostAnytime ? 'Date' : 'Date & Time'}
            name="repostDate"
            type={repostAnytime ? 'date' : 'datetime-local'}
            value={repostDate}
            onChange={(e) => setRepostDate(e.target.value)}
          />
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => { setRepostModal(null); setRepostDate(''); setRepostAnytime(false); }}>Cancel</Button>
            <Button variant="gold" className="flex-1" onClick={handleRepost} disabled={!repostDate}>Repost</Button>
          </div>
        </div>
      </Modal>

      {/* Clear All Expired Modal */}
      <Modal isOpen={clearModal} onClose={() => setClearModal(false)} title="Clear All Expired">
        <p className="text-sm text-gray-400 mb-4">
          Are you sure you want to clear all expired Moves? This will permanently delete all cancelled and completed Moves along with their interest data.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setClearModal(false)} className="flex-1 px-4 py-2.5 bg-dark-100 text-white rounded-xl font-semibold text-sm hover:bg-dark-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleClearAll} className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-xl font-semibold text-sm hover:bg-red-600 transition-colors">
            Clear All
          </button>
        </div>
      </Modal>

      {/* Delete Move Modal */}
      <Modal isOpen={!!deleteModal} onClose={() => setDeleteModal(null)} title="Delete Move">
        <p className="text-sm text-gray-400 mb-4">
          Are you sure you want to delete this move? This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setDeleteModal(null)} className="flex-1 px-4 py-2.5 bg-dark-100 text-white rounded-xl font-semibold text-sm hover:bg-dark-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleDeleteMove} className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-xl font-semibold text-sm hover:bg-red-600 transition-colors">
            Delete
          </button>
        </div>
      </Modal>
    </AppLayout>
  );
}
