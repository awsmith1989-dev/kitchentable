import { FormEvent, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

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
    <div className="flex min-h-screen flex-col md:flex-row">

      {/* ── Left panel — brand ── */}
      <div className="flex flex-col md:w-1/2" style={{ background: '#1B3A5C' }}>

        {/* Wordmark — always visible */}
        <div className="flex items-center px-6 py-5 md:px-10 md:py-8">
          <img
            src="/Logo/PerchEd%20Logo%20Design-clear.png"
            alt="PerchEd"
            style={{ height: 28, width: 'auto', objectFit: 'contain' }}
          />
        </div>

        {/* Mobile-only: compact headline */}
        <div className="px-6 pb-7 md:hidden">
          <p className="text-lg font-semibold leading-snug text-white">
            Every student has a story worth knowing.
          </p>
        </div>

        {/* Desktop-only: mascot + headline + subheadline */}
        <div className="hidden flex-1 flex-col items-center justify-center px-10 pb-6 md:flex">
          <div style={{ width: 280, height: 280, background: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <img
              src="/mascots/mascots-welcome.png"
              alt="The Kitchen Table mascot"
              style={{ width: 260, objectFit: 'contain' }}
            />
          </div>
          <h1 className="mt-8 text-center text-[2rem] font-bold leading-snug text-white">
            Every student has a story worth knowing.
          </h1>
          <p className="mt-4 max-w-sm text-center text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
            PerchEd gives advisory teachers the data and conversations that help students thrive.
          </p>
        </div>

        {/* Desktop-only: proof points */}
        <div
          className="hidden px-10 py-6 md:block"
          style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}
        >
          <div className="flex justify-between gap-4">
            {[
              { icon: '/Icons/semester-long-trajectory.png', label: 'Semester-long trajectory' },
              { icon: '/Icons/Asset-based-advising.png',     label: 'Asset-based advising' },
              { icon: '/Icons/AI-powered-insights .png',     label: 'AI-powered insights' },
            ].map(({ icon, label }) => (
              <div key={label} className="flex flex-1 flex-col items-center gap-1.5 text-center">
                <img src={icon} alt="" aria-hidden="true" style={{ width: 32, height: 32, objectFit: 'contain' }} />
                <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex flex-1 flex-col" style={{ background: '#FEFDF9' }}>

        {/* Form — vertically centered */}
        <div className="flex flex-1 items-center justify-center px-8 py-12">
          <div className="w-full max-w-sm">
            <div className="mb-8">
              <h2 className="text-2xl font-semibold" style={{ color: '#1B3A5C' }}>Welcome back</h2>
              <p className="mt-1.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Sign in to your account
              </p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="email" className="block text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="mt-2 block w-full rounded-2xl px-4 py-3 text-sm outline-none transition"
                  style={{
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-card)',
                    color: 'var(--color-text-primary)',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--color-primary)'; e.target.style.boxShadow = '0 0 0 2px rgba(28,125,107,0.15)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="mt-2 block w-full rounded-2xl px-4 py-3 text-sm outline-none transition"
                  style={{
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-card)',
                    color: 'var(--color-text-primary)',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--color-primary)'; e.target.style.boxShadow = '0 0 0 2px rgba(28,125,107,0.15)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>

              {error && <p className="text-sm text-rose-600">{error}</p>}
              {message && <p className="text-sm font-medium" style={{ color: 'var(--color-primary)' }}>{message}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                style={{ background: 'var(--color-primary)' }}
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <p className="mt-7 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
              New to PerchEd?{' '}
              <span className="font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                Contact your school administrator.
              </span>
            </p>
          </div>
        </div>

        {/* Bottom tagline */}
        <div className="px-8 pb-5 pt-2 text-center">
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Trusted by advisory teachers across Arkansas.
          </p>
        </div>
      </div>

    </div>
  );
}
