import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client.js';
import { useAuth } from '../state/auth.jsx';

export const LoginRegister = () => {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const { setSession } = useAuth();
  const navigate = useNavigate();

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const payload = await apiRequest(`/api/auth/${mode}`, {
        method: 'POST',
        body: form
      });
      setSession(payload);
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <form className="w-full max-w-md rounded-md bg-white p-6 shadow-sm" onSubmit={submit}>
        <h1 className="text-xl font-semibold">Bulk PDF text replacement</h1>
        <p className="mt-1 text-sm text-slate-600">Sign in to process invoice correction batches.</p>
        {mode === 'register' && (
          <input
            className="focus-ring mt-5 w-full rounded-md border border-slate-300 px-3 py-2"
            placeholder="Name"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        )}
        <input
          className="focus-ring mt-3 w-full rounded-md border border-slate-300 px-3 py-2"
          placeholder="Email"
          type="email"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
        />
        <input
          className="focus-ring mt-3 w-full rounded-md border border-slate-300 px-3 py-2"
          placeholder="Password"
          type="password"
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
        />
        {error && <div className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
        <button className="focus-ring mt-5 w-full rounded-md bg-brand px-4 py-2 font-medium text-white">
          {mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
        <button
          type="button"
          className="mt-4 w-full text-sm text-slate-600"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
        >
          {mode === 'login' ? 'Need an account?' : 'Already have an account?'}
        </button>
      </form>
    </main>
  );
};
