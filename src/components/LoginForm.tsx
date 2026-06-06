import { FormEvent, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import ThemeToggle from './ThemeToggle';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
    } else {
      setMessage('Signed in successfully. Redirecting...');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12 dark:bg-slate-950 sm:px-6 lg:px-8">
      <div className="flex justify-end px-2 pb-4">
        <ThemeToggle />
      </div>
      <div className="mx-auto w-full max-w-md rounded-3xl bg-white p-8 shadow-xl ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">The Kitchen Table</p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-900 dark:text-slate-100">Sign in</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Sign in with your school credentials.</p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Email address
            </label>
            <div className="mt-2">
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="block w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-600"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Password
            </label>
            <div className="mt-2">
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="block w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-600"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="flex w-full justify-center rounded-3xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-slate-300 dark:disabled:bg-slate-600 dark:disabled:text-slate-400"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </div>

          {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p> : null}
        </form>
      </div>
    </div>
  );
}
