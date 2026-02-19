import { useState, useEffect } from 'react';
import Avatar from '../ui/Avatar';
import Button from '../ui/Button';
import api from '../../services/api';
import { timeAgo } from '../../utils/formatters';

export default function ReportsList() {
  const [reports, setReports] = useState([]);
  const [filter, setFilter] = useState('PENDING');

  useEffect(() => {
    api.get(`/admin/reports?status=${filter}`).then(({ data }) => setReports(data));
  }, [filter]);

  const handleAction = async (reportId, status) => {
    await api.put(`/admin/reports/${reportId}`, { status });
    setReports((prev) => prev.filter((r) => r.id !== reportId));
  };

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {['PENDING', 'REVIEWED', 'ACTIONED'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              filter === s ? 'bg-gold text-dark' : 'bg-dark-100 text-gray-400'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {reports.map((report) => (
          <div key={report.id} className="card p-4">
            <div className="flex items-start gap-3 mb-3">
              <Avatar src={report.reported?.profile?.photos} size="sm" />
              <div className="flex-1">
                <p className="text-sm text-white">
                  <span className="font-bold">{report.reported?.profile?.displayName || 'Unknown'}</span>
                  <span className="text-gray-500"> reported by </span>
                  <span className="font-bold">{report.reporter?.profile?.displayName || 'Unknown'}</span>
                </p>
                <p className="text-xs text-gold mt-1">{report.reason.replace('_', ' ')}</p>
                {report.details && <p className="text-xs text-gray-400 mt-1">{report.details}</p>}
                <p className="text-xs text-gray-500 mt-1">{timeAgo(report.createdAt)}</p>
              </div>
            </div>
            {filter === 'PENDING' && (
              <div className="flex gap-2">
                <Button variant="ghost" className="text-xs" onClick={() => handleAction(report.id, 'REVIEWED')}>Dismiss</Button>
                <Button variant="danger" className="text-xs !px-3 !py-1.5" onClick={() => handleAction(report.id, 'ACTIONED')}>Take Action</Button>
              </div>
            )}
          </div>
        ))}
        {reports.length === 0 && <p className="text-gray-500 text-sm text-center py-8">No {filter.toLowerCase()} reports</p>}
      </div>
    </div>
  );
}
