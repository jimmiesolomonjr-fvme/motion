import { useState, useEffect } from 'react';
import api from '../../services/api';
import { Trash2 } from 'lucide-react';

export default function DeletionLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/deletion-log')
      .then(({ data }) => setLogs(data))
      .catch((err) => console.error('Deletion log error:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-400">Deleted Accounts ({logs.length})</h3>
      {logs.length === 0 ? (
        <p className="text-center text-gray-500 py-8">No deleted accounts</p>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div key={log.id} className="flex items-center gap-3 p-3 bg-dark-100 rounded-xl">
              <Trash2 size={14} className="text-red-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white font-medium">{log.displayName || 'Unknown'}</span>
                  <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${
                    log.role === 'STEPPER' ? 'bg-blue-500/20 text-blue-400' : 'bg-pink-500/20 text-pink-400'
                  }`}>
                    {log.role}
                  </span>
                </div>
                <p className="text-xs text-gray-500">{log.email}</p>
                <div className="flex gap-3 mt-1 text-xs text-gray-500">
                  {log.city && <span>{log.city}</span>}
                  <span>Joined {new Date(log.signedUpAt).toLocaleDateString()}</span>
                  <span className="text-red-400">Deleted {new Date(log.deletedAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
