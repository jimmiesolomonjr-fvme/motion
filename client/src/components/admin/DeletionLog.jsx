import { useState, useEffect } from 'react';
import api from '../../services/api';
import { Trash2, X } from 'lucide-react';

export default function DeletionLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(null);

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
        <div className="space-y-3">
          {logs.map((log) => {
            const photos = Array.isArray(log.photos) ? log.photos : [];
            return (
              <div key={log.id} className="p-3 bg-dark-100 rounded-xl space-y-2">
                <div className="flex items-center gap-3">
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
                    {log.reason && (
                      <div className="mt-1">
                        <span className="inline-block px-2 py-0.5 text-[10px] font-medium rounded-full bg-orange-500/20 text-orange-400">
                          {log.reason.replace(/_/g, ' ')}
                        </span>
                        {log.reasonText && (
                          <p className="text-xs text-gray-400 mt-1 italic">"{log.reasonText}"</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {photos.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {photos.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt=""
                        onClick={() => setLightbox(url)}
                        className="w-16 h-16 rounded-lg object-cover flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-gold transition-all"
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 text-white/70 hover:text-white">
            <X size={24} />
          </button>
          <img src={lightbox} alt="" className="max-w-full max-h-[85vh] rounded-xl object-contain" />
        </div>
      )}
    </div>
  );
}
