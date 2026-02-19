import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import Button from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { PREMIUM_PRICE, PREMIUM_BENEFITS } from '../utils/constants';
import { Crown, Check, Sparkles } from 'lucide-react';

export default function Premium() {
  const { user, refreshUser } = useAuth();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);

  const success = searchParams.get('success');
  const canceled = searchParams.get('canceled');

  if (success) {
    refreshUser();
  }

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/payments/checkout');
      window.location.href = data.url;
    } catch (err) {
      console.error('Checkout error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="text-center py-4">
        {success ? (
          <div className="mb-8">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <Check className="text-green-400" size={32} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Welcome to Premium!</h2>
            <p className="text-gray-400">Your subscription is now active</p>
          </div>
        ) : canceled ? (
          <div className="mb-8">
            <p className="text-gray-400">Subscription canceled. You can try again anytime.</p>
          </div>
        ) : null}

        <div className="w-20 h-20 rounded-full bg-gradient-gold flex items-center justify-center mx-auto mb-4">
          <Crown className="text-dark" size={36} />
        </div>

        <h1 className="text-3xl font-extrabold text-gradient-gold mb-2">Motion Premium</h1>
        <p className="text-gray-400 mb-8">Unlock the full experience</p>

        <div className="card p-6 mb-6 text-left">
          <div className="space-y-4">
            {PREMIUM_BENEFITS.map((benefit) => (
              <div key={benefit} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-gold/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="text-gold" size={12} />
                </div>
                <span className="text-gray-300 text-sm">{benefit}</span>
              </div>
            ))}
          </div>
        </div>

        {user?.isPremium ? (
          <div className="card p-4">
            <div className="flex items-center justify-center gap-2 text-gold">
              <Sparkles size={18} />
              <span className="font-bold">You&apos;re a Premium member</span>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <span className="text-3xl font-extrabold text-white">{PREMIUM_PRICE}</span>
            </div>
            <Button variant="gold" className="w-full text-lg" onClick={handleSubscribe} loading={loading}>
              Upgrade to Premium
            </Button>
            <p className="text-xs text-gray-600 mt-3">Cancel anytime. Billed monthly.</p>
          </>
        )}
      </div>
    </AppLayout>
  );
}
