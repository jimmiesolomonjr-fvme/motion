import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await login(form.email, form.password);
      navigate(user.hasProfile ? '/feed' : '/onboarding');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-extrabold text-gradient-gold text-center mb-2">Welcome Back</h1>
        <p className="text-gray-500 text-center mb-8">Sign in to your Motion account</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Email" name="email" type="email" value={form.email} onChange={handleChange} placeholder="you@email.com" required />
          <Input label="Password" name="password" type="password" value={form.password} onChange={handleChange} placeholder="Your password" required />

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <Button variant="gold" type="submit" className="w-full" loading={loading}>
            Sign In
          </Button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="text-gold hover:underline">Join Motion</Link>
        </p>
      </div>
    </div>
  );
}
