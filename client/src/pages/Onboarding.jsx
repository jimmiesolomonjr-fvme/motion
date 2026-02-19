import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import StepRole from '../components/onboarding/StepRole';
import StepProfile from '../components/onboarding/StepProfile';
import StepPhotos from '../components/onboarding/StepPhotos';
import api from '../services/api';

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [step, setStep] = useState(user?.hasProfile ? 3 : 1);
  const [role, setRole] = useState(user?.role || '');
  const [profile, setProfile] = useState({ displayName: '', bio: '', age: '', city: '', lookingFor: '' });

  const handleProfileNext = async () => {
    try {
      await api.post('/users/profile', profile);
      setStep(3);
    } catch (err) {
      console.error('Profile save error:', err);
    }
  };

  const handleComplete = async () => {
    await refreshUser();
    navigate('/feed');
  };

  const steps = [
    { num: 1, label: 'Role' },
    { num: 2, label: 'Profile' },
    { num: 3, label: 'Photos' },
  ];

  return (
    <div className="min-h-screen bg-dark flex flex-col items-center justify-center px-6 py-12">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        {steps.map((s, i) => (
          <div key={s.num} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
              step >= s.num ? 'bg-gold text-dark' : 'bg-dark-50 text-gray-500'
            }`}>
              {s.num}
            </div>
            {i < steps.length - 1 && (
              <div className={`w-8 h-0.5 ${step > s.num ? 'bg-gold' : 'bg-dark-50'}`} />
            )}
          </div>
        ))}
      </div>

      <div className="w-full max-w-sm">
        {step === 1 && (
          <StepRole role={role} setRole={setRole} onNext={() => setStep(2)} />
        )}
        {step === 2 && (
          <StepProfile profile={profile} setProfile={setProfile} onNext={handleProfileNext} onBack={() => setStep(1)} />
        )}
        {step === 3 && (
          <StepPhotos onComplete={handleComplete} />
        )}
      </div>
    </div>
  );
}
