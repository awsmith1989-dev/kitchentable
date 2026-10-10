import { FormEvent, useState } from 'react';
import { TrendingUp, Sparkles, Compass } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const SERIF = "'Lora', Georgia, 'Times New Roman', serif";

// Organic blob SVG paths — 44×44 viewBox, intentionally irregular
const BLOBS = {
  teal:  'M20,3 C27,1 37,7 39,15 C41,24 37,34 29,38 C21,43 11,40 6,32 C1,23 3,10 10,5 C14,2 17,5 20,3 Z',
  gold:  'M22,2 C30,0 41,8 41,18 C41,28 35,39 25,41 C15,44 5,37 3,27 C0,17 6,7 14,4 C18,2 18,4 22,2 Z',
  coral: 'M24,3 C32,2 41,11 40,21 C39,31 33,39 23,41 C13,44 4,36 2,26 C0,16 6,7 15,4 C19,1 19,4 24,3 Z',
};

const FEATURES = [
  {
    Icon: TrendingUp,
    blob: BLOBS.teal,
    blobFill: 'rgba(28,125,107,0.13)',
    iconColor: '#1C7D6B',
    label: 'See the whole semester',
    desc: 'GPA and attendance trajectories, not snapshots.',
  },
  {
    Icon: Sparkles,
    blob: BLOBS.gold,
    blobFill: 'rgba(247,197,45,0.22)',
    iconColor: '#8a6300',
    label: 'Lead with strengths',
    desc: 'Shoutouts and growth framing built on learning science.',
  },
  {
    Icon: Compass,
    blob: BLOBS.coral,
    blobFill: 'rgba(224,92,56,0.13)',
    iconColor: '#b34830',
    label: "Connect school to what's next",
    desc: 'Career and college matches from live Arkansas labor data.',
  },
];

function BlobIcon({
  Icon, blob, blobFill, iconColor,
}: {
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  blob: string;
  blobFill: string;
  iconColor: string;
}) {
  return (
    <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
      <svg viewBox="0 0 44 44" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-hidden="true">
        <path d={blob} fill={blobFill} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={18} color={iconColor} strokeWidth={2} />
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  borderRadius: 6,
  border: '1px solid #E5EAE8',
  padding: '0 14px',
  height: 48,
  fontSize: 14,
  background: '#ffffff',
  color: '#1B3A5C',
  outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
  fontFamily: "'Inter', sans-serif",
};

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [btnHover, setBtnHover] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
    } else {
      setMessage('Signed in successfully. Redirecting…');
    }
    setLoading(false);
  };

  return (
    <div
      className="flex min-h-screen flex-col md:flex-row"
      style={{ background: '#FEFDF9' }}
    >

      {/* ── Left column — brand ── */}
      <div
        className="flex flex-col md:w-1/2"
        style={{ borderRight: '1px solid #E5EAE8' }}
      >
        {/* Logo */}
        <div style={{ padding: '36px 52px 0' }}>
          <img
            src="/Logo/PerchEd%20Logo%20Design-clear.png"
            alt="PerchEd"
            style={{ height: 28, width: 'auto', objectFit: 'contain' }}
          />
        </div>

        {/* Headline, subhead, feature rows */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '48px 52px 40px' }}>

          {/* Serif headline with gold squiggle */}
          <div style={{ marginBottom: 18 }}>
            <h1 style={{
              fontFamily: SERIF,
              fontSize: 40,
              fontWeight: 600,
              color: '#1B3A5C',
              lineHeight: 1.1,
              margin: 0,
            }}>
              Advisory, with the{' '}
              <span style={{ position: 'relative', display: 'inline' }}>
                full picture.
                {/* Hand-drawn gold squiggle underline */}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 128 10"
                  preserveAspectRatio="none"
                  style={{
                    position: 'absolute',
                    left: 0,
                    bottom: -5,
                    width: '100%',
                    height: 9,
                    overflow: 'visible',
                    display: 'block',
                  }}
                >
                  <path
                    d="M2,6.5 C16,2.5 32,8 50,5 C68,2 86,7.5 104,4.5 C113,3 120,5.5 126,5.5"
                    stroke="#F7C52D"
                    strokeWidth="2.5"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.9"
                  />
                  <path
                    d="M4,7.5 C22,4.5 42,8.5 62,6 C82,3.5 100,8 118,6"
                    stroke="#F7C52D"
                    strokeWidth="1"
                    fill="none"
                    strokeLinecap="round"
                    opacity="0.3"
                  />
                </svg>
              </span>
            </h1>
          </div>

          <p style={{ fontSize: 15, color: '#4A6670', lineHeight: 1.65, margin: '0 0 40px', maxWidth: 400 }}>
            PerchEd turns weekly grades, attendance, and goals into one clear view — so every advisory conversation starts informed.
          </p>

          {/* Feature rows with blob icons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {FEATURES.map(({ Icon, blob, blobFill, iconColor, label, desc }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                <BlobIcon Icon={Icon} blob={blob} blobFill={blobFill} iconColor={iconColor} />
                <div style={{ marginTop: 4 }}>
                  <span style={{ display: 'block', fontWeight: 600, color: '#1B3A5C', fontSize: 14, lineHeight: 1.3 }}>
                    {label}
                  </span>
                  <span style={{ display: 'block', fontSize: 13, color: '#8AA5A0', marginTop: 3, lineHeight: 1.5 }}>
                    {desc}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom — mascot + tagline */}
        <div style={{
          borderTop: '1px solid #E5EAE8',
          padding: '20px 52px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}>
          <img
            src="/mascots/mascots-welcome.png"
            alt=""
            aria-hidden="true"
            style={{
              width: 72,
              height: 72,
              objectFit: 'contain',
              flexShrink: 0,
              mixBlendMode: 'multiply',
            }}
          />
          <p style={{ fontSize: 13, color: '#8AA5A0', lineHeight: 1.5, margin: 0 }}>
            Built by a former advisor in the Arkansas Delta.
          </p>
        </div>
      </div>

      {/* ── Right column — form ── */}
      <div
        className="flex flex-1 items-center justify-center px-8 py-12"
      >
        <div style={{ width: '100%', maxWidth: 380 }}>

          <div style={{ marginBottom: 36 }}>
            <h2 style={{
              fontFamily: SERIF,
              fontSize: 28,
              fontWeight: 600,
              color: '#1B3A5C',
              margin: '0 0 8px',
              lineHeight: 1.2,
            }}>
              Welcome back
            </h2>
            <p style={{ fontSize: 14, color: '#4A6670', margin: 0 }}>
              Sign in to your PerchEd account
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div>
              <label
                htmlFor="email"
                style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#4A6670', marginBottom: 7 }}
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={inputStyle}
                onFocus={(e) => {
                  e.target.style.borderColor = '#1C7D6B';
                  e.target.style.boxShadow = '0 0 0 3px rgba(28,125,107,0.12)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#E5EAE8';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#4A6670', marginBottom: 7 }}
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={inputStyle}
                onFocus={(e) => {
                  e.target.style.borderColor = '#1C7D6B';
                  e.target.style.boxShadow = '0 0 0 3px rgba(28,125,107,0.12)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#E5EAE8';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            {error && (
              <p style={{ fontSize: 14, color: '#be123c', margin: 0 }}>{error}</p>
            )}
            {message && (
              <p style={{ fontSize: 14, fontWeight: 500, color: '#1C7D6B', margin: 0 }}>{message}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              onMouseEnter={() => setBtnHover(true)}
              onMouseLeave={() => setBtnHover(false)}
              style={{
                width: '100%',
                borderRadius: 6,
                padding: '0 16px',
                height: 48,
                fontSize: 14,
                fontWeight: 600,
                color: 'white',
                background: btnHover && !loading ? '#155f4e' : '#1C7D6B',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1,
                transition: 'background 0.18s, opacity 0.15s',
                fontFamily: "'Inter', sans-serif",
              }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p style={{ marginTop: 30, textAlign: 'center', fontSize: 13, color: '#8AA5A0' }}>
            New to PerchEd?{' '}
            <span style={{ fontWeight: 500, color: '#4A6670' }}>
              Contact your school administrator.
            </span>
          </p>

        </div>
      </div>

    </div>
  );
}
