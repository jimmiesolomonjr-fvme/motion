import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import AuthLayout from '../components/layout/AuthLayout';
import api from '../services/api';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      return setError('Passwords do not match');
    }

    if (form.password.length < 8) {
      return setError('Password must be at least 8 characters');
    }

    setLoading(true);

    try {
      await api.post('/auth/reset-password', { token, newPassword: form.password });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  // Auto-redirect to login after success
  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => navigate('/login'), 3000);
    return () => clearTimeout(timer);
  }, [success, navigate]);

  if (!token) {
    return (
      <AuthLayout>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Invalid Link</h1>
          <p className="text-gray-400 mb-6">This reset link is invalid or has expired.</p>
          <Link to="/forgot-password" className="text-gold hover:underline">Request a new link</Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h1 className="text-3xl font-extrabold text-gradient-gold text-center mb-2">New Password</h1>

      {success ? (
        <div className="text-center mt-8">
          <div className="w-16 h-16 rounded-full bg-gold/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="text-gold" size={32} />
          </div>
          <p className="text-white font-semibold mb-2">Password reset!</p>
          <p className="text-gray-400 text-sm">Redirecting to login...</p>
        </div>
      ) : (
        <>
          <p className="text-gray-500 text-center mb-8">Choose a new password for your account</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="New Password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              placeholder="At least 8 characters"
              required
            />
            <Input
              label="Confirm Password"
              name="confirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={handleChange}
              placeholder="Re-enter your password"
              required
            />

            {error && <p className="text-red-400 text-sm text-center">{error}</p>}

            <Button variant="gold" type="submit" className="w-full" loading={loading}>
              Reset Password
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            <Link to="/login" className="text-gold hover:underline">Back to Login</Link>
          </p>
        </>
      )}
    </AuthLayout>
  );
}
