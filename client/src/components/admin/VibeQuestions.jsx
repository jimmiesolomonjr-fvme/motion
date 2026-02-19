import { useState, useEffect } from 'react';
import api from '../../services/api';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { Plus, Trash2, Edit3, Check, X, ToggleLeft, ToggleRight } from 'lucide-react';

const CATEGORIES = ['Lifestyle', 'Values', 'Social', 'Romance', 'Fun'];

export default function VibeQuestions() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newQ, setNewQ] = useState({ questionText: '', category: CATEGORIES[0] });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const fetchQuestions = async () => {
    try {
      const { data } = await api.get('/admin/vibe-questions');
      setQuestions(data);
    } catch (err) {
      console.error('Fetch vibe questions error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchQuestions(); }, []);

  const handleCreate = async () => {
    if (!newQ.questionText.trim()) return;
    try {
      await api.post('/admin/vibe-questions', newQ);
      setNewQ({ questionText: '', category: CATEGORIES[0] });
      fetchQuestions();
    } catch (err) {
      console.error('Create error:', err);
    }
  };

  const handleToggle = async (q) => {
    try {
      await api.put(`/admin/vibe-questions/${q.id}`, { isActive: !q.isActive });
      fetchQuestions();
    } catch (err) {
      console.error('Toggle error:', err);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this question? All answers will also be deleted.')) return;
    try {
      await api.delete(`/admin/vibe-questions/${id}`);
      fetchQuestions();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const startEdit = (q) => {
    setEditingId(q.id);
    setEditForm({ questionText: q.questionText, category: q.category });
  };

  const handleSaveEdit = async () => {
    try {
      await api.put(`/admin/vibe-questions/${editingId}`, editForm);
      setEditingId(null);
      fetchQuestions();
    } catch (err) {
      console.error('Edit error:', err);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" /></div>;
  }

  const grouped = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = questions.filter((q) => q.category === cat);
    return acc;
  }, {});
  // Include any categories from data not in our list
  questions.forEach((q) => {
    if (!grouped[q.category]) grouped[q.category] = [];
    if (!grouped[q.category].find((x) => x.id === q.id)) grouped[q.category].push(q);
  });

  return (
    <div className="space-y-6">
      {/* Add new question */}
      <div className="card-elevated space-y-3">
        <h3 className="text-sm font-semibold text-white">Add New Question</h3>
        <Input
          placeholder="Enter question text..."
          value={newQ.questionText}
          onChange={(e) => setNewQ({ ...newQ, questionText: e.target.value })}
        />
        <div className="flex gap-2">
          <select
            value={newQ.category}
            onChange={(e) => setNewQ({ ...newQ, category: e.target.value })}
            className="input-field flex-1"
          >
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <Button variant="gold" onClick={handleCreate} disabled={!newQ.questionText.trim()}>
            <Plus size={16} className="inline mr-1" /> Add
          </Button>
        </div>
      </div>

      {/* Questions grouped by category */}
      {Object.entries(grouped).map(([category, qs]) => (
        qs.length > 0 && (
          <div key={category}>
            <h3 className="text-sm font-semibold text-gold mb-2">{category} ({qs.length})</h3>
            <div className="space-y-2">
              {qs.map((q) => (
                <div key={q.id} className="card-elevated flex items-center gap-3">
                  {editingId === q.id ? (
                    <div className="flex-1 space-y-2">
                      <input
                        value={editForm.questionText}
                        onChange={(e) => setEditForm({ ...editForm, questionText: e.target.value })}
                        className="input-field w-full"
                      />
                      <select
                        value={editForm.category}
                        onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                        className="input-field"
                      >
                        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <div className="flex gap-2">
                        <button onClick={handleSaveEdit} className="text-green-400 hover:text-green-300"><Check size={16} /></button>
                        <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-white"><X size={16} /></button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${q.isActive ? 'text-white' : 'text-gray-500 line-through'}`}>{q.questionText}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{q.answerCount} answers</p>
                      </div>
                      <button onClick={() => handleToggle(q)} className="text-gray-400 hover:text-white" title={q.isActive ? 'Deactivate' : 'Activate'}>
                        {q.isActive ? <ToggleRight size={20} className="text-green-400" /> : <ToggleLeft size={20} />}
                      </button>
                      <button onClick={() => startEdit(q)} className="text-gray-400 hover:text-white"><Edit3 size={16} /></button>
                      <button onClick={() => handleDelete(q.id)} className="text-gray-400 hover:text-red-400"><Trash2 size={16} /></button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      ))}

      {questions.length === 0 && (
        <p className="text-center text-gray-500 py-8">No vibe questions yet. Add one above.</p>
      )}
    </div>
  );
}
