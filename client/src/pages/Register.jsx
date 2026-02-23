import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { Crown, Sparkles } from 'lucide-react';
import AuthLayout from '../components/layout/AuthLayout';

export default function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { register } = useAuth();
  const refParam = searchParams.get('ref') || '';
  const [form, setForm] = useState({ email: '', password: '', confirmPassword: '', role: '', referralCode: refParam });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showReferral, setShowReferral] = useState(!!refParam);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      return setError('Passwords do not match');
    }
    if (!form.role) {
      return setError('Please select a role');
    }

    setLoading(true);
    try {
      await register(form.email, form.password, form.role, form.referralCode.trim() || undefined);
      navigate('/onboarding');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
        <h1 className="text-3xl font-extrabold text-gradient-gold text-center mb-2">Join Motion</h1>
        <p className="text-gray-500 text-center mb-8">Create your account and start moving</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Email" name="email" type="email" value={form.email} onChange={handleChange} placeholder="you@email.com" required />
          <Input label="Password" name="password" type="password" value={form.password} onChange={handleChange} placeholder="At least 8 characters" required />
          <Input label="Confirm Password" name="confirmPassword" type="password" value={form.confirmPassword} onChange={handleChange} placeholder="Confirm your password" required />

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">I am a...</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setForm({ ...form, role: 'STEPPER' })}
                className={`p-4 rounded-xl border-2 text-center transition-all ${
                  form.role === 'STEPPER' ? 'border-gold bg-gold/10' : 'border-dark-50 hover:border-gold/30'
                }`}
              >
                <Crown className={`mx-auto mb-1 ${form.role === 'STEPPER' ? 'text-gold' : 'text-gray-500'}`} size={24} />
                <span className={`text-sm font-bold ${form.role === 'STEPPER' ? 'text-gold' : 'text-gray-400'}`}>Stepper</span>
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, role: 'BADDIE' })}
                className={`p-4 rounded-xl border-2 text-center transition-all ${
                  form.role === 'BADDIE' ? 'border-purple-accent bg-purple-accent/10' : 'border-dark-50 hover:border-purple-accent/30'
                }`}
              >
                <Sparkles className={`mx-auto mb-1 ${form.role === 'BADDIE' ? 'text-purple-glow' : 'text-gray-500'}`} size={24} />
                <span className={`text-sm font-bold ${form.role === 'BADDIE' ? 'text-purple-glow' : 'text-gray-400'}`}>Baddie</span>
              </button>
            </div>
          </div>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <Button variant="gold" type="submit" className="w-full" loading={loading}>
            Create Account
          </Button>

          {!showReferral ? (
            <button
              type="button"
              onClick={() => setShowReferral(true)}
              className="block mx-auto text-sm text-gray-500 hover:text-gold transition-colors"
            >
              Have an invite code?
            </button>
          ) : (
            <Input
              label="Invite Code"
              name="referralCode"
              value={form.referralCode}
              onChange={handleChange}
              placeholder="MOTION-XXXXXX"
            />
          )}
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-gold hover:underline">Sign in</Link>
        </p>
    </AuthLayout>
  );
}
