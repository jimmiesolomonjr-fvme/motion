import { useState, useEffect } from 'react';
import AppLayout from '../components/layout/AppLayout';
import MoveCard from '../components/moves/MoveCard';
import CreateMove from '../components/moves/CreateMove';
import MoveInterestList from '../components/moves/MoveInterestList';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input, { Textarea } from '../components/ui/Input';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Plus, Flame, Trash2 } from 'lucide-react';
import { formatDate } from '../utils/formatters';

export default function Moves() {
  const { user } = useAuth();
  const [moves, setMoves] = useState([]);
  const [myMoves, setMyMoves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [interestModal, setInterestModal] = useState(null);
  const [interestMessage, setInterestMessage] = useState('');
  const [deleteModal, setDeleteModal] = useState(null);
  const [tab, setTab] = useState(user?.role === 'STEPPER' ? 'mine' : 'browse');

  useEffect(() => { fetchMoves(); }, []);

  const fetchMoves = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/moves');
      setMoves(data);
      if (user?.role === 'STEPPER') {
        const { data: mine } = await api.get('/moves/mine');
        setMyMoves(mine);
      }
    } catch (err) {
      console.error('Moves error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInterest = (moveId) => {
    setInterestModal(moveId);
  };

  const submitInterest = async () => {
    if (!interestModal) return;
    try {
      await api.post(`/moves/${interestModal}/interest`, { message: interestMessage });
      setInterestModal(null);
      setInterestMessage('');
      fetchMoves();
    } catch (err) {
      console.error('Interest error:', err);
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

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Flame className="text-gold" size={20} />
          <h1 className="text-xl font-bold text-white">The Move</h1>
        </div>
        {user?.role === 'STEPPER' && (
          <Button variant="gold" className="!px-3 !py-1.5 text-sm" onClick={() => setShowCreate(true)}>
            <Plus size={16} className="inline mr-1" /> New Move
          </Button>
        )}
      </div>

      {/* Tabs for Steppers */}
      {user?.role === 'STEPPER' && (
        <div className="flex gap-2 mb-4">
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
        </div>
      )}

      {/* Content */}
      {tab === 'mine' && user?.role === 'STEPPER' ? (
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
              <div key={move.id} className="card-elevated">
                <div className="flex items-start justify-between mb-1">
                  <h3 className="font-bold text-white">{move.title}</h3>
                  <button
                    onClick={() => setDeleteModal(move.id)}
                    className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
                    title="Delete move"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <p className="text-gray-400 text-sm mb-2">{move.description}</p>
                <p className="text-xs text-gray-500 mb-3">{formatDate(move.date)} · {move.location}</p>
                <h4 className="text-sm font-semibold text-gray-300 mb-2">Interested ({move.interests.length})</h4>
                <MoveInterestList interests={move.interests} onStartConversation={startConversation} />
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {moves.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400">No active Moves right now</p>
              <p className="text-gray-500 text-sm">Check back soon</p>
            </div>
          ) : (
            moves.map((move) => (
              <MoveCard key={move.id} move={move} onInterest={handleInterest} userRole={user?.role} isAdmin={user?.isAdmin} onDelete={(id) => setDeleteModal(id)} />
            ))
          )}
        </div>
      )}

      {/* Create Move Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create a Move">
        <CreateMove onCreated={() => fetchMoves()} onClose={() => setShowCreate(false)} />
      </Modal>

      {/* Interest Modal */}
      <Modal isOpen={!!interestModal} onClose={() => setInterestModal(null)} title="Express Interest">
        <div className="space-y-4">
          <p className="text-gray-400 text-sm">Leave a message to stand out (optional)</p>
          <Textarea
            placeholder="Hey, I'd love to join..."
            value={interestMessage}
            onChange={(e) => setInterestMessage(e.target.value)}
          />
          <Button variant="gold" className="w-full" onClick={submitInterest}>
            I&apos;m Interested
          </Button>
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
