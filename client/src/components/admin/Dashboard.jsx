import { useState, useEffect } from 'react';
import { Users, Crown, Sparkles, Heart, AlertTriangle, DollarSign, Activity, MessageCircle, Eye, ThumbsUp, TrendingUp, MessagesSquare } from 'lucide-react';
import api from '../../services/api';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [engagement, setEngagement] = useState(null);

  useEffect(() => {
    api.get('/admin/stats').then(({ data }) => setStats(data));
    api.get('/admin/engagement').then(({ data }) => setEngagement(data));
  }, []);

  if (!stats) return <div className="text-gray-500 text-center py-8">Loading...</div>;

  const overviewCards = [
    { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-white' },
    { label: 'Steppers', value: stats.steppers, icon: Crown, color: 'text-gold' },
    { label: 'Baddies', value: stats.baddies, icon: Sparkles, color: 'text-purple-glow' },
    { label: 'Premium', value: stats.premiumUsers, icon: DollarSign, color: 'text-green-400' },
    { label: 'Matches', value: stats.totalMatches, icon: Heart, color: 'text-pink-400' },
    { label: 'Pending Reports', value: stats.pendingReports, icon: AlertTriangle, color: 'text-red-400' },
  ];

  const engagementCards = engagement
    ? [
        { label: 'Daily Active Users', value: engagement.dailyActiveUsers, sub: 'Today', icon: Activity, color: 'text-green-400' },
        { label: 'Weekly Active Users', value: engagement.weeklyActiveUsers, sub: 'Last 7 days', icon: TrendingUp, color: 'text-blue-400' },
        { label: 'Messages Today', value: engagement.messagesToday, sub: 'Today', icon: MessageCircle, color: 'text-gold' },
        { label: 'Messages This Week', value: engagement.messagesThisWeek, sub: 'Last 7 days', icon: MessageCircle, color: 'text-amber-400' },
        { label: 'Profile Views Today', value: engagement.profileViewsToday, sub: 'Today', icon: Eye, color: 'text-purple-400' },
        { label: 'Profile Views This Week', value: engagement.profileViewsThisWeek, sub: 'Last 7 days', icon: Eye, color: 'text-purple-300' },
        { label: 'Likes Today', value: engagement.likesToday, sub: 'Today', icon: ThumbsUp, color: 'text-pink-400' },
        { label: 'Likes This Week', value: engagement.likesThisWeek, sub: 'Last 7 days', icon: ThumbsUp, color: 'text-pink-300' },
        { label: 'Matches This Week', value: engagement.matchesThisWeek, sub: 'Last 7 days', icon: Heart, color: 'text-red-400' },
        { label: 'Active Conversations', value: engagement.activeConversations, sub: 'Last 7 days', icon: MessagesSquare, color: 'text-cyan-400' },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Overview */}
      <div>
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Overview</h3>
        <div className="grid grid-cols-2 gap-3">
          {overviewCards.map((card) => (
            <div key={card.label} className="card p-4">
              <card.icon className={`${card.color} mb-2`} size={20} />
              <p className="text-2xl font-bold text-white">{card.value}</p>
              <p className="text-xs text-gray-500">{card.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Engagement */}
      <div>
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Engagement</h3>
        {engagement ? (
          <div className="grid grid-cols-2 gap-3">
            {engagementCards.map((card) => (
              <div key={card.label} className="card p-4">
                <card.icon className={`${card.color} mb-2`} size={20} />
                <p className="text-2xl font-bold text-white">{card.value}</p>
                <p className="text-xs text-gray-500">{card.label}</p>
                <p className="text-[10px] text-gray-600 mt-0.5">{card.sub}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-gray-500 text-center py-4 text-sm">Loading engagement data...</div>
        )}
      </div>
    </div>
  );
}
