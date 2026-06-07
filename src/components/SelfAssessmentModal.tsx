import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface Props {
  studentId: string;
  schoolYear: string;
  weekNumber: number;
  onComplete: () => void;
}

type AcademicChoice = 'better' | 'same' | 'worse';

const academicOptions: { value: AcademicChoice; label: string }[] = [
  { value: 'better', label: 'Better than the week before' },
  { value: 'same',   label: 'About the same' },
  { value: 'worse',  label: 'Not my best week' },
];

const effortOptions: { value: number; label: string }[] = [
  { value: 1, label: 'I was going through the motions' },
  { value: 2, label: 'I did what was required' },
  { value: 3, label: 'I tried pretty hard' },
  { value: 4, label: 'I gave a lot' },
  { value: 5, label: 'I gave everything I had' },
];

export default function SelfAssessmentModal({ studentId, schoolYear, weekNumber, onComplete }: Props) {
  const [step, setStep] = useState<1 | 2 | 'done'>(1);
  const [academicChoice, setAcademicChoice] = useState<AcademicChoice | null>(null);
  const [effortRating, setEffortRating] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!academicChoice || effortRating === null) return;
    setSubmitting(true);
    setError(null);
    try {
      const { error: insertError } = await supabase.from('student_self_assessments').insert({
        student_id: studentId,
        school_year: schoolYear,
        week_number: weekNumber,
        academic_self_assessment: academicChoice,
        effort_rating: effortRating,
      });
      // 23505 = unique_violation — already submitted this week, treat as success
      if (insertError && insertError.code !== '23505') throw insertError;
      setStep('done');
    } catch (err: any) {
      setError(err.message || 'Unable to save your response. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(27,58,92,0.5)' }}>
      <div className="w-full max-w-md rounded-[2rem] bg-white p-8 shadow-2xl" style={{ border: '1px solid var(--color-border)' }}>

        {step === 1 && (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: 'var(--color-text-muted)' }}>
              Week {weekNumber} check-in
            </p>
            <h2 className="mt-3 text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              How do you think you did in your classes last week?
            </h2>
            <div className="mt-6 flex flex-col gap-3">
              {academicOptions.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAcademicChoice(value)}
                  className="rounded-2xl border-2 px-5 py-4 text-left text-sm font-semibold transition"
                  style={
                    academicChoice === value
                      ? { borderColor: 'var(--color-primary)', background: 'var(--color-primary)', color: '#ffffff' }
                      : { borderColor: 'var(--color-border)', background: 'var(--color-card)', color: 'var(--color-text-secondary)' }
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={!academicChoice}
              onClick={() => setStep(2)}
              className="mt-6 w-full rounded-full px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: 'var(--color-primary)' }}
            >
              Next
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: 'var(--color-text-muted)' }}>
              Week {weekNumber} check-in
            </p>
            <h2 className="mt-3 text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              How much effort did you put into school last week?
            </h2>
            <div className="mt-6 flex flex-col gap-3">
              {effortOptions.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setEffortRating(value)}
                  className="flex items-center gap-4 rounded-2xl border-2 px-5 py-4 text-left transition"
                  style={
                    effortRating === value
                      ? { borderColor: 'var(--color-primary)', background: 'var(--color-primary)', color: '#ffffff' }
                      : { borderColor: 'var(--color-border)', background: 'var(--color-card)', color: 'var(--color-text-secondary)' }
                  }
                >
                  <span className="text-lg font-bold tabular-nums">{value}</span>
                  <span className="text-sm font-medium">{label}</span>
                </button>
              ))}
            </div>
            {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}
            <button
              type="button"
              disabled={effortRating === null || submitting}
              onClick={handleSubmit}
              className="mt-6 w-full rounded-full px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: 'var(--color-primary)' }}
            >
              {submitting ? 'Saving…' : 'Submit'}
            </button>
          </>
        )}

        {step === 'done' && (
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'var(--color-green-highlight)' }}>
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: 'var(--color-primary)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="mt-5 text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>Thanks for checking in</h2>
            <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>Your advisor will see this.</p>
            <button
              type="button"
              onClick={onComplete}
              className="mt-6 w-full rounded-full px-5 py-3 text-sm font-semibold text-white transition"
              style={{ background: 'var(--color-primary)' }}
            >
              View my dashboard
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
