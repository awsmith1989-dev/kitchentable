import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Student, StudentShoutout } from '../lib/types';

type ShoutoutType = 'strength' | 'growth' | 'character';

interface ShoutoutModalProps {
  student: Student;
  teacherId: string;
  weekNumber: number;
  schoolYear: string;
  onClose: () => void;
  onSaved: (shoutout: StudentShoutout) => void;
}

export const SHOUTOUT_CONFIG = {
  strength: {
    emoji: '🌟',
    label: 'Strength',
    sublabel: 'Recognizing who they are',
    bg: 'bg-[var(--color-card-tint)]',
    border: 'border-[var(--color-primary)]',
    badge: 'bg-[var(--color-accent)] text-[var(--color-accent-dark)]',
    chips: [
      'Never gives up', 'Shows up every day', 'Lifts others up', 'Has a big heart',
      'Determined', 'Resilient', 'Hard worker', 'Thinks outside the box',
      'Makes people feel welcome', 'Sees the big picture',
    ],
  },
  growth: {
    emoji: '📈',
    label: 'Growth',
    sublabel: "Recognizing how they've improved",
    bg: 'bg-[#FFFBEB]',
    border: 'border-[var(--color-accent)]',
    badge: 'bg-[var(--color-accent)] text-[var(--color-accent-dark)]',
    chips: [
      'Pushed through something hard', 'Turned a corner this week',
      'Asked for help and used it', 'Improved when it mattered',
      "Didn't give up when it got hard", 'Showed real progress',
      'Bounced back strong', 'Level up moment',
    ],
  },
  character: {
    emoji: '🤝',
    label: 'Character',
    sublabel: 'Recognizing what they did for others',
    bg: 'bg-[#EEF2FF]',
    border: 'border-[#3730A3]',
    badge: 'bg-[#EEF2FF] text-[#3730A3]',
    chips: [
      'Showed up for a classmate', 'Led without being asked',
      'Made someone feel welcome', 'Shared their voice',
      'Lifted the room', 'Stepped up when it counted',
      'Brought people together', 'Set the tone',
    ],
  },
} as const;

export default function ShoutoutModal({
  student, teacherId, weekNumber, schoolYear, onClose, onSaved,
}: ShoutoutModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedType, setSelectedType] = useState<ShoutoutType | null>(null);
  const [selectedChip, setSelectedChip] = useState<string | null>(null);
  const [customText, setCustomText] = useState('');
  const [personalNote, setPersonalNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name = student.preferred_name || student.first_name;
  const config = selectedType ? SHOUTOUT_CONFIG[selectedType] : null;
  const shoutoutText = selectedChip ?? customText.trim();

  const handleSelectType = (type: ShoutoutType) => {
    setSelectedType(type);
    setSelectedChip(null);
    setCustomText('');
    setStep(2);
  };

  const handleSend = async () => {
    if (!selectedType || !shoutoutText) return;
    setSaving(true);
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from('student_shoutouts')
        .insert({
          student_id: student.id,
          teacher_id: teacherId,
          shoutout_type: selectedType,
          shoutout_text: shoutoutText,
          personal_note: personalNote.trim() || null,
          week_number: weekNumber,
          school_year: schoolYear,
        })
        .select()
        .single();
      if (dbError) throw dbError;
      onSaved(data as StudentShoutout);
    } catch (err: any) {
      setError(err.message || 'Failed to send shoutout.');
      setSaving(false);
    }
  };

  const stepLabels = ['What kind', 'Recognition', 'Preview'] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div className="absolute inset-0" style={{ background: 'rgba(27,58,92,0.5)' }} onClick={onClose} />
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl shadow-2xl" style={{ background: 'var(--color-card)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: 'var(--color-text-muted)' }}>Give a shoutout</p>
            <h2 className="mt-0.5 text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>{name}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 transition"
            style={{ color: 'var(--color-text-muted)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-card-tint)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-3 px-6 py-2.5" style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-card-tint)' }}>
          {([1, 2, 3] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-1.5">
              <div
                className="flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold transition"
                style={
                  step >= s
                    ? { background: 'var(--color-primary)', color: '#ffffff' }
                    : { background: 'var(--color-border)', color: 'var(--color-text-muted)' }
                }
              >
                {step > s ? '✓' : s}
              </div>
              <span
                className="text-xs font-medium transition"
                style={{ color: step === s ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}
              >
                {stepLabels[i]}
              </span>
              {s < 3 && <span style={{ color: 'var(--color-text-muted)' }}>›</span>}
            </div>
          ))}
        </div>

        {/* Step 1: Type selector */}
        {step === 1 && (
          <div className="space-y-3 p-6">
            {(Object.entries(SHOUTOUT_CONFIG) as [ShoutoutType, typeof SHOUTOUT_CONFIG[ShoutoutType]][]).map(([type, c]) => (
              <button
                key={type}
                type="button"
                onClick={() => handleSelectType(type)}
                className="flex w-full items-center gap-4 rounded-2xl p-4 text-left transition active:scale-[0.98]"
                style={{ border: '2px solid var(--color-border)', background: 'var(--color-card)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-card-tint)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-card)'; }}
              >
                <span className="text-3xl">{c.emoji}</span>
                <div>
                  <p className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>{c.label}</p>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{c.sublabel}</p>
                </div>
                <svg className="ml-auto h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--color-text-muted)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Chip selector + personal note */}
        {step === 2 && selectedType && config && (
          <div className="flex max-h-[70vh] flex-col">
            <div className="flex-1 overflow-y-auto p-6">
              <p className="mb-4 text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                What would you like to recognize {name} for?
              </p>
              <div className="flex flex-wrap gap-2">
                {config.chips.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setSelectedChip(selectedChip === chip ? null : chip)}
                    className="rounded-full px-3 py-2 text-sm font-semibold transition"
                    style={
                      selectedChip === chip
                        ? { background: 'var(--color-primary)', color: '#ffffff', border: '1px solid var(--color-primary)' }
                        : { background: 'var(--color-card)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }
                    }
                  >
                    {chip}
                  </button>
                ))}
              </div>

              <div className="mt-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--color-text-muted)' }}>
                  Write your own (optional)
                </p>
                <textarea
                  value={customText}
                  onChange={(e) => {
                    setCustomText(e.target.value);
                    if (e.target.value) setSelectedChip(null);
                  }}
                  placeholder="Describe what you want to recognize..."
                  rows={2}
                  className="w-full rounded-2xl px-4 py-3 text-sm outline-none transition"
                  style={{
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-card)',
                    color: 'var(--color-text-primary)',
                    resize: 'vertical',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--color-primary)'; e.target.style.boxShadow = '0 0 0 2px rgba(28,125,107,0.15)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>

              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--color-text-muted)' }}>
                  Personal note (optional)
                </p>
                <textarea
                  value={personalNote}
                  onChange={(e) => setPersonalNote(e.target.value)}
                  placeholder={`Add a personal message for ${name}...`}
                  rows={2}
                  className="w-full rounded-2xl px-4 py-3 text-sm outline-none transition"
                  style={{
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-card)',
                    color: 'var(--color-text-primary)',
                    resize: 'vertical',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--color-primary)'; e.target.style.boxShadow = '0 0 0 2px rgba(28,125,107,0.15)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 px-6 py-4" style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-card)' }}>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-full px-4 py-2 text-sm font-semibold transition"
                style={{ border: '1px solid var(--color-border)', background: 'var(--color-card)', color: 'var(--color-text-secondary)' }}
              >
                Back
              </button>
              <button
                type="button"
                disabled={!shoutoutText}
                onClick={() => setStep(3)}
                className="flex-1 rounded-full px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
                style={{ background: 'var(--color-primary)' }}
              >
                Preview →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Preview + send */}
        {step === 3 && selectedType && config && (
          <div className="p-6">
            <p className="mb-4 text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Here's what {name} will see:
            </p>

            <div className={`rounded-2xl border ${config.bg} ${config.border} p-5`}>
              <span className={`mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${config.badge}`}>
                <span>{config.emoji}</span>
                <span>{config.label}</span>
              </span>
              <p className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>{shoutoutText}</p>
              {personalNote.trim() && (
                <p className="mt-2 text-sm italic" style={{ color: 'var(--color-text-secondary)' }}>"{personalNote.trim()}"</p>
              )}
              <p className="mt-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>Week {weekNumber} · From your advisor</p>
            </div>

            {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}

            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="rounded-full px-4 py-2 text-sm font-semibold transition"
                style={{ border: '1px solid var(--color-border)', background: 'var(--color-card)', color: 'var(--color-text-secondary)' }}
              >
                Back
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSend}
                className="flex-1 rounded-full px-4 py-2.5 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
                style={{ background: 'var(--color-primary)' }}
              >
                {saving ? 'Sending…' : 'Send shoutout 🎉'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
