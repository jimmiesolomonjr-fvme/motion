import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import AuthLayout from '../components/layout/AuthLayout';
import api from '../services/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h1 className="text-3xl font-extrabold text-gradient-gold text-center mb-2">Reset Password</h1>

      {sent ? (
        <div className="text-center mt-8">
          <div className="w-16 h-16 rounded-full bg-gold/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="text-gold" size={32} />
          </div>
          <p className="text-white font-semibold mb-2">Check your email</p>
          <p className="text-gray-400 text-sm mb-6">
            If an account exists for <span className="text-gold">{email}</span>, we sent a password reset link.
          </p>
          <Link to="/login" className="text-sm text-gold hover:underline">Back to Login</Link>
        </div>
      ) : (
        <>
          <p className="text-gray-500 text-center mb-8">Enter your email and we'll send you a reset link</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              required
            />

            {error && <p className="text-red-400 text-sm text-center">{error}</p>}

            <Button variant="gold" type="submit" className="w-full" loading={loading}>
              Send Reset Link
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Remember your password?{' '}
            <Link to="/login" className="text-gold hover:underline">Sign In</Link>
          </p>
        </>
      )}
    </AuthLayout>
  );
}
