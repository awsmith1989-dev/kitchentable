import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Student } from '../lib/types';
import {
  PostSecondaryGrid,
  RiasecCardGrid,
  StrengthChipGrid,
  ProximityCardSelector,
  ProfileTextInput,
  hasProfanity,
  riasecToInterests,
} from './StudentProfileFields';

interface OnboardingModalProps {
  student: Student;
  onComplete: (updatedStudent: Student) => void;
}

type Screen = 'welcome' | 'q1' | 'q2' | 'q3' | 'q4' | 'q5' | 'done';

// ── Progress dots ─────────────────────────────────────────────────────────────

function ProgressDots({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {[1, 2, 3, 4, 5].map(n => (
        <span
          key={n}
          className={`rounded-full transition-all ${
            n < current
              ? 'h-2.5 w-2.5'
              : n === current
              ? 'h-3 w-3 animate-pulse'
              : 'h-2 w-2'
          }`}
          style={{
            background:
              n < current
                ? 'var(--color-primary)'
                : n === current
                ? 'var(--color-primary)'
                : 'var(--color-border)',
          }}
        />
      ))}
    </div>
  );
}

// ── Nav buttons ───────────────────────────────────────────────────────────────

function NavRow({ children }: { children: React.ReactNode }) {
  return <div className="mt-8 flex items-center justify-between gap-3">{children}</div>;
}

function PrimaryBtn({ onClick, disabled, children }: {
  onClick: () => void; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-full px-6 py-3 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
      style={{ background: 'var(--color-primary)' }}
    >
      {children}
    </button>
  );
}

function GhostBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-4 py-2 text-sm font-semibold transition"
      style={{ color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', background: 'var(--color-card)' }}
    >
      {children}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OnboardingModal({ student, onComplete }: OnboardingModalProps) {
  const [screen, setScreen] = useState<Screen>('welcome');
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedStudent, setSavedStudent] = useState<Student | null>(null);

  // Answers
  const [plans, setPlans] = useState<string[]>(student.post_secondary_plans ?? []);
  const [riasecCodes, setRiasecCodes] = useState<string[]>(student.riasec_codes ?? []);
  const [strengths, setStrengths] = useState<string[]>(student.strengths ?? []);
  const [careerInterest, setCareerInterest] = useState(student.specific_career_interest ?? '');
  const [proximity, setProximity] = useState(student.college_proximity_preference ?? '');

  // Profanity error per field
  const [careerProfanityError, setCareerProfanityError] = useState<string | null>(null);

  const name = student.preferred_name || student.first_name;
  const qNum = screen === 'q1' ? 1 : screen === 'q2' ? 2 : screen === 'q3' ? 3 : screen === 'q4' ? 4 : screen === 'q5' ? 5 : 0;

  const skipOnboarding = async () => {
    await supabase.from('students').update({ onboarding_completed: true }).eq('id', student.id);
    onComplete({ ...student, onboarding_completed: true });
  };

  const handleFinish = async () => {
    setSubmitting(true);
    setSaveError(null);
    try {
      const updates = {
        onboarding_completed: true,
        post_secondary_plans: plans.length > 0 ? plans : null,
        riasec_codes: riasecCodes.length > 0 ? riasecCodes : null,
        interests: riasecCodes.length > 0 ? riasecToInterests(riasecCodes) : null,
        strengths: strengths.length > 0 ? strengths : null,
        specific_career_interest: careerInterest.trim() || null,
        college_proximity_preference: proximity || null,
      };
      const { data, error } = await supabase
        .from('students')
        .update(updates)
        .eq('id', student.id)
        .select()
        .single();
      if (error) throw error;
      setSavedStudent(data as Student);
      setScreen('done');
    } catch (err: any) {
      setSaveError(err.message ?? 'Unable to save. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Welcome ────────────────────────────────────────────────────────────────

  if (screen === 'welcome') {
    return (
      <Overlay>
        <div className="flex flex-col items-center text-center">
          <img
            src="/png-mascots/mascot-welcome.png"
            alt=""
            aria-hidden="true"
            style={{ width: 180, height: 180, objectFit: 'contain' }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <h2 className="mt-6 text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Let's get to know you
          </h2>
          <p className="mt-3 max-w-sm text-base leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            5 quick questions so PerchEd can give you advice that actually fits your life. Your advisor can see your answers.
          </p>
          <button
            type="button"
            onClick={() => setScreen('q1')}
            className="mt-8 rounded-full px-8 py-3.5 text-base font-bold text-white transition"
            style={{ background: 'var(--color-primary)' }}
          >
            Let's go →
          </button>
          <button
            type="button"
            onClick={skipOnboarding}
            className="mt-4 text-sm transition"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Skip for now
          </button>
        </div>
      </Overlay>
    );
  }

  // ── Done ───────────────────────────────────────────────────────────────────

  if (screen === 'done') {
    return (
      <Overlay>
        <div className="flex flex-col items-center text-center">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full"
            style={{ background: 'rgba(28,125,107,0.12)' }}
          >
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: 'var(--color-primary)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="mt-6 text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            You're all set, {name}! 🎉
          </h2>
          <p className="mt-3 max-w-sm text-base leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            Your advisor can now give you advice that actually fits your goals. Check out{' '}
            <strong>Your Next Chapter</strong> on your dashboard to see your personalized career and college matches.
          </p>
          <button
            type="button"
            onClick={() => onComplete(savedStudent ?? { ...student, onboarding_completed: true })}
            className="mt-8 rounded-full px-8 py-3.5 text-base font-bold text-white transition"
            style={{ background: 'var(--color-primary)' }}
          >
            See my dashboard →
          </button>
        </div>
      </Overlay>
    );
  }

  // ── Question screens ────────────────────────────────────────────────────────

  return (
    <Overlay>
      {/* Question header */}
      <div className="mb-6 flex items-center gap-3">
        <img
          src="/png-mascots/mascot-advisor-clear.png"
          alt=""
          aria-hidden="true"
          style={{ width: 36, height: 36, objectFit: 'contain', flexShrink: 0 }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: 'var(--color-text-muted)' }}>
            Question {qNum} of 5
          </p>
          <ProgressDots current={qNum} />
        </div>
      </div>

      {/* Q1 ── Post-secondary plans */}
      {screen === 'q1' && (
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            What are you thinking about doing after high school?
          </h2>
          <p className="mt-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Choose everything that sounds interesting — you can always change your mind.
          </p>
          <div className="mt-6">
            <PostSecondaryGrid value={plans} onChange={setPlans} />
          </div>
          <NavRow>
            <span />
            <PrimaryBtn
              onClick={() => setScreen('q2')}
              disabled={plans.length === 0}
            >
              Next →
            </PrimaryBtn>
          </NavRow>
        </div>
      )}

      {/* Q2 ── RIASEC interest type */}
      {screen === 'q2' && (
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            What kind of activities feel most natural to you?
          </h2>
          <p className="mt-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Pick everything that sounds like you — most people are a mix of a few.
          </p>
          <div className="mt-6">
            <RiasecCardGrid
              value={riasecCodes}
              onChange={setRiasecCodes}
              showInfoButton
            />
          </div>
          <NavRow>
            <GhostBtn onClick={() => setScreen('q1')}>← Back</GhostBtn>
            <PrimaryBtn
              onClick={() => setScreen('q3')}
              disabled={riasecCodes.length === 0}
            >
              Next →
            </PrimaryBtn>
          </NavRow>
        </div>
      )}

      {/* Q3 ── Strengths */}
      {screen === 'q3' && (
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            What's something you like doing?
          </h2>
          <p className="mt-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Pick everything that sounds like you — there are no wrong answers.
          </p>
          <div className="mt-6">
            <StrengthChipGrid value={strengths} onChange={setStrengths} />
          </div>
          <NavRow>
            <GhostBtn onClick={() => setScreen('q2')}>← Back</GhostBtn>
            <PrimaryBtn
              onClick={() => setScreen('q4')}
              disabled={strengths.length === 0}
            >
              Next →
            </PrimaryBtn>
          </NavRow>
        </div>
      )}

      {/* Q4 ── Career interest */}
      {screen === 'q4' && (
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Is there a specific job or career you've thought about?
          </h2>
          <p className="mt-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            No pressure if you're not sure — that's what advisors are for.
          </p>
          <div className="mt-6">
            <ProfileTextInput
              value={careerInterest}
              onChange={v => { setCareerInterest(v); setCareerProfanityError(null); }}
              placeholder="e.g. nurse, electrician, own my own business, teacher..."
              profanityCheck
              onProfanityDetected={() => {
                setCareerInterest('');
                setCareerProfanityError('Please keep your answer school-appropriate.');
              }}
              profanityError={careerProfanityError}
            />
          </div>
          <NavRow>
            <GhostBtn onClick={() => setScreen('q3')}>← Back</GhostBtn>
            <div className="flex items-center gap-3">
              <GhostBtn onClick={() => { setCareerInterest(''); setScreen('q5'); }}>Skip this question</GhostBtn>
              <PrimaryBtn
                onClick={() => {
                  if (careerInterest.trim() && hasProfanity(careerInterest)) {
                    setCareerInterest('');
                    setCareerProfanityError('Please keep your answer school-appropriate.');
                    return;
                  }
                  setScreen('q5');
                }}
              >
                Next →
              </PrimaryBtn>
            </div>
          </NavRow>
        </div>
      )}

      {/* Q5 ── College proximity */}
      {screen === 'q5' && (
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            If you go to college, where do you want to be?
          </h2>
          <p className="mt-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Think about how far from home feels right for you.
          </p>
          <div className="mt-6">
            <ProximityCardSelector value={proximity} onChange={setProximity} />
          </div>
          {saveError && (
            <p className="mt-3 text-sm text-rose-600">{saveError}</p>
          )}
          <NavRow>
            <GhostBtn onClick={() => setScreen('q4')}>← Back</GhostBtn>
            <div className="flex items-center gap-3">
              <GhostBtn onClick={handleFinish}>Skip this question</GhostBtn>
              <PrimaryBtn onClick={handleFinish} disabled={submitting}>
                {submitting ? 'Saving…' : 'Finish →'}
              </PrimaryBtn>
            </div>
          </NavRow>
        </div>
      )}
    </Overlay>
  );
}

// ── Overlay wrapper ───────────────────────────────────────────────────────────

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="w-full max-w-lg overflow-y-auto rounded-[2.5rem] p-8 shadow-2xl"
        style={{
          background: 'var(--color-card)',
          border: '1px solid var(--color-border)',
          maxHeight: 'calc(100vh - 2rem)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
