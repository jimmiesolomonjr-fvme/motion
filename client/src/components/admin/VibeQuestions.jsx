import { useState, useEffect } from 'react';
import api from '../../services/api';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { Plus, Trash2, Edit3, Check, X, ToggleLeft, ToggleRight, ChevronDown, ChevronUp, BarChart3 } from 'lucide-react';

const CATEGORIES = ['Lifestyle', 'Values', 'Social', 'Romance', 'Fun'];

export default function VibeQuestions() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newQ, setNewQ] = useState({ questionText: '', category: CATEGORIES[0], resp1: '', resp2: '' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [stats, setStats] = useState(null);
  const [showDistribution, setShowDistribution] = useState(false);

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

  const fetchStats = async () => {
    try {
      const { data } = await api.get('/admin/vibe-stats');
      setStats(data);
    } catch (err) {
      console.error('Fetch vibe stats error:', err);
    }
  };

  useEffect(() => { fetchQuestions(); fetchStats(); }, []);

  const handleCreate = async () => {
    if (!newQ.questionText.trim()) return;
    try {
      const payload = {
        questionText: newQ.questionText,
        category: newQ.category,
        responseOptions: [newQ.resp1 || 'Yes', newQ.resp2 || 'No'],
      };
      await api.post('/admin/vibe-questions', payload);
      setNewQ({ questionText: '', category: CATEGORIES[0], resp1: '', resp2: '' });
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
    setEditForm({
      questionText: q.questionText,
      category: q.category,
      resp1: q.responseOptions?.[0] || 'Yes',
      resp2: q.responseOptions?.[1] || 'No',
    });
  };

  const handleSaveEdit = async () => {
    try {
      await api.put(`/admin/vibe-questions/${editingId}`, {
        questionText: editForm.questionText,
        category: editForm.category,
        responseOptions: [editForm.resp1 || 'Yes', editForm.resp2 || 'No'],
      });
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
      {/* Vibe Stats */}
      {stats && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="card-elevated text-center">
              <p className="text-2xl font-bold text-gold">{stats.activeQuestions}<span className="text-sm text-gray-500">/{stats.totalQuestions}</span></p>
              <p className="text-xs text-gray-400">Questions</p>
            </div>
            <div className="card-elevated text-center">
              <p className="text-2xl font-bold text-purple-glow">{stats.totalAnswers.toLocaleString()}</p>
              <p className="text-xs text-gray-400">Total Answers</p>
            </div>
            <div className="card-elevated text-center">
              <p className="text-2xl font-bold text-green-400">{stats.activeToday}</p>
              <p className="text-xs text-gray-400">Active Today</p>
            </div>
          </div>
          <div className="flex gap-3 text-xs text-gray-500">
            <span>Avg {stats.avgPerUser} answers/user</span>
            <span>·</span>
            <span>Avg streak: {stats.avgStreak}</span>
          </div>

          {/* Per-question distribution */}
          <button
            onClick={() => setShowDistribution(!showDistribution)}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-white"
          >
            <BarChart3 size={14} />
            Answer Distribution
            {showDistribution ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showDistribution && (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {stats.perQuestion.map((q) => (
                <div key={q.id} className="card-elevated p-3">
                  <p className="text-xs text-white mb-1 truncate">{q.questionText}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-3 bg-dark-100 rounded-full overflow-hidden flex">
                      <div
                        className="h-full bg-green-500 transition-all"
                        style={{ width: `${q.truePercent}%` }}
                      />
                      <div
                        className="h-full bg-red-400 transition-all"
                        style={{ width: `${q.falsePercent}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-20 text-right">
                      {q.truePercent}% / {q.falsePercent}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">{q.totalAnswers} answers</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
        <div className="flex gap-2">
          <input
            placeholder="Yes"
            value={newQ.resp1}
            onChange={(e) => setNewQ({ ...newQ, resp1: e.target.value })}
            className="input-field flex-1 text-sm"
          />
          <input
            placeholder="No"
            value={newQ.resp2}
            onChange={(e) => setNewQ({ ...newQ, resp2: e.target.value })}
            className="input-field flex-1 text-sm"
          />
        </div>
        <p className="text-xs text-gray-500">Custom response labels (leave blank for Yes / No)</p>
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
                        <input
                          placeholder="Yes"
                          value={editForm.resp1}
                          onChange={(e) => setEditForm({ ...editForm, resp1: e.target.value })}
                          className="input-field flex-1 text-sm"
                        />
                        <input
                          placeholder="No"
                          value={editForm.resp2}
                          onChange={(e) => setEditForm({ ...editForm, resp2: e.target.value })}
                          className="input-field flex-1 text-sm"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={handleSaveEdit} className="text-green-400 hover:text-green-300"><Check size={16} /></button>
                        <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-white"><X size={16} /></button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${q.isActive ? 'text-white' : 'text-gray-500 line-through'}`}>{q.questionText}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {q.answerCount} answers
                          {q.responseOptions && ` · ${q.responseOptions[0]} / ${q.responseOptions[1]}`}
                        </p>
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
