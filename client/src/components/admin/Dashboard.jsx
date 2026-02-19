import { useState, useEffect } from 'react';
import { Users, Crown, Sparkles, Heart, AlertTriangle, DollarSign } from 'lucide-react';
import api from '../../services/api';

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/admin/stats').then(({ data }) => setStats(data));
  }, []);

  if (!stats) return <div className="text-gray-500 text-center py-8">Loading...</div>;

  const cards = [
    { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-white' },
    { label: 'Steppers', value: stats.steppers, icon: Crown, color: 'text-gold' },
    { label: 'Baddies', value: stats.baddies, icon: Sparkles, color: 'text-purple-glow' },
    { label: 'Premium', value: stats.premiumUsers, icon: DollarSign, color: 'text-green-400' },
    { label: 'Matches', value: stats.totalMatches, icon: Heart, color: 'text-pink-400' },
    { label: 'Pending Reports', value: stats.pendingReports, icon: AlertTriangle, color: 'text-red-400' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map((card) => (
        <div key={card.label} className="card p-4">
          <card.icon className={`${card.color} mb-2`} size={20} />
          <p className="text-2xl font-bold text-white">{card.value}</p>
          <p className="text-xs text-gray-500">{card.label}</p>
        </div>
      ))}
    </div>
  );
}
