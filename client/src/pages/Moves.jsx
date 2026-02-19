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
import { Plus, Flame } from 'lucide-react';
import { formatDate } from '../utils/formatters';

export default function Moves() {
  const { user } = useAuth();
  const [moves, setMoves] = useState([]);
  const [myMoves, setMyMoves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [interestModal, setInterestModal] = useState(null);
  const [interestMessage, setInterestMessage] = useState('');
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
                <h3 className="font-bold text-white mb-1">{move.title}</h3>
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
              <MoveCard key={move.id} move={move} onInterest={handleInterest} userRole={user?.role} />
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
    </AppLayout>
  );
}
