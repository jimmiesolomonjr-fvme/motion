import { Crown, Sparkles } from 'lucide-react';

export default function StepRole({ role, setRole, onNext }) {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Choose Your Role</h2>
        <p className="text-gray-400">How do you want to move on Motion?</p>
      </div>

      <div className="space-y-4">
        <button
          onClick={() => setRole('STEPPER')}
          className={`w-full p-6 rounded-2xl border-2 text-left transition-all ${
            role === 'STEPPER'
              ? 'border-gold bg-gold/10 shadow-gold'
              : 'border-dark-50 hover:border-gold/40'
          }`}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-full bg-gradient-gold flex items-center justify-center">
              <Crown className="text-dark" size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Stepper</h3>
              <span className="badge-stepper">Provider</span>
            </div>
          </div>
          <p className="text-gray-400 text-sm">
            You move with intention and success. You plan dates, set the tone, and show up with purpose.
          </p>
        </button>

        <button
          onClick={() => setRole('BADDIE')}
          className={`w-full p-6 rounded-2xl border-2 text-left transition-all ${
            role === 'BADDIE'
              ? 'border-purple-accent bg-purple-accent/10 shadow-purple'
              : 'border-dark-50 hover:border-purple-accent/40'
          }`}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-full bg-gradient-purple flex items-center justify-center">
              <Sparkles className="text-white" size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Baddie</h3>
              <span className="badge-baddie">Confident</span>
            </div>
          </div>
          <p className="text-gray-400 text-sm">
            You&apos;re confident, attractive, and know your worth. You attract intention and choose wisely.
          </p>
        </button>
      </div>

      <button
        onClick={onNext}
        disabled={!role}
        className={`w-full btn-gold ${!role ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        Continue
      </button>
    </div>
  );
}
