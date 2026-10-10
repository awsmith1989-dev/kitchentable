import { useEffect, useRef, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabaseClient';
import TeacherDashboard from './components/TeacherDashboard';
import LoginForm from './components/LoginForm';
import StudentView from './components/StudentView';

type Role = 'teacher' | 'student' | 'unknown';

// Calls getSession() first so that any expired token is refreshed before the
// DB queries run. This prevents the stale-token hang that caused the timeout
// when INITIAL_SESSION fired before the auto-refresh completed.
async function resolveRole(uid: string): Promise<{ role: Role; studentId: string | null }> {
  const { error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error(`Session unavailable: ${sessionError.message}`);

  const { data: teacher, error: teacherError } = await supabase
    .from('teachers')
    .select('id')
    .eq('id', uid)
    .maybeSingle();

  if (teacherError) console.error('[role] teacher query:', teacherError.message);
  if (teacher) return { role: 'teacher', studentId: null };

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('id')
    .eq('auth_user_id', uid)
    .maybeSingle();

  if (studentError) console.error('[role] student query:', studentError.message);
  if (student) return { role: 'student', studentId: student.id };

  return { role: 'unknown', studentId: null };
}

// Increased from 5 s — allows time for getSession() to complete a token refresh
// plus two DB round-trips on a slow connection.
const ROLE_TIMEOUT_MS = 10_000;

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  // Tracks whether role has been successfully resolved for the current session.
  // Prevents re-running detection on repeated auth events (e.g. a second
  // INITIAL_SESSION after a TOKEN_REFRESHED cycle) without clearing state.
  const roleResolved = useRef(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, sess) => {
      console.log('[auth]', _event, sess?.user?.id ?? 'no user');
      setSession(sess);

      if (!sess) {
        // Explicit sign-out — reset everything so the next sign-in starts clean.
        setRole(null);
        setStudentId(null);
        roleResolved.current = false;
        setLoading(false);
        return;
      }

      // Token was silently refreshed or user record updated. The session is
      // already current and the role is cached in state — nothing to do.
      if (_event === 'TOKEN_REFRESHED' || _event === 'USER_UPDATED') {
        setLoading(false);
        return;
      }

      // Role already resolved for this session. A duplicate INITIAL_SESSION or
      // SIGNED_IN event (can happen after a refresh cycle) must not re-run
      // detection, which would flash the loading screen and waste queries.
      if (roleResolved.current) {
        setLoading(false);
        return;
      }

      // First genuine session event (INITIAL_SESSION on page load, or SIGNED_IN
      // after a fresh login). resolveRole() calls getSession() internally, which
      // will await any in-progress token refresh before issuing DB queries.
      try {
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('Role detection timed out after 10 seconds')),
            ROLE_TIMEOUT_MS,
          )
        );
        const result = await Promise.race([resolveRole(sess.user.id), timeout]);
        roleResolved.current = true;
        setRole(result.role);
        setStudentId(result.studentId);
      } catch (err: any) {
        console.error('[role] detection failed:', err.message, err);
        setInitError(err.message || 'An unexpected error occurred during sign-in.');
      } finally {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
        <div className="flex min-h-screen items-center justify-center">
          <div className="rounded-3xl border px-6 py-5 shadow-sm" style={{ background: 'var(--color-card)', borderColor: 'var(--color-border)' }}>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Loading…</p>
          </div>
        </div>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
        <div className="flex min-h-screen items-center justify-center px-4">
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center shadow-sm">
            <p className="text-base font-semibold text-rose-900">Sign-in error</p>
            <p className="mt-2 text-sm text-rose-700">{initError}</p>
            <button
              type="button"
              onClick={() => { setInitError(null); supabase.auth.signOut(); }}
              className="mt-6 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition"
              style={{ background: 'var(--color-primary)' }}
            >
              Sign out and try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!session) return <LoginForm />;

  if (role === 'unknown') {
    return (
      <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
        <div className="flex min-h-screen items-center justify-center px-4">
          <div className="rounded-3xl border p-8 text-center shadow-sm" style={{ background: 'var(--color-card)', borderColor: 'var(--color-border)' }}>
            <p className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Account not recognized.</p>
            <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>Please contact your advisor.</p>
            <button
              type="button"
              onClick={() => supabase.auth.signOut()}
              className="mt-6 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition"
              style={{ background: 'var(--color-primary)' }}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (role === 'student' && studentId) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/student/:id" element={<StudentView isStudentSelf />} />
          <Route path="*" element={<Navigate to={`/student/${studentId}`} replace />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<TeacherDashboard user={session.user} />} />
        <Route path="/student/:id" element={<StudentView />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
