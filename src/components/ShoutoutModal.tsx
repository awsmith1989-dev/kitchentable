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
    gradient: 'from-amber-400 to-orange-400',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    ring: 'ring-amber-200 dark:ring-amber-800/50',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300',
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
    gradient: 'from-emerald-400 to-teal-500',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    ring: 'ring-emerald-200 dark:ring-emerald-800/50',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300',
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
    gradient: 'from-violet-400 to-purple-500',
    bg: 'bg-violet-50 dark:bg-violet-950/40',
    ring: 'ring-violet-200 dark:ring-violet-800/50',
    badge: 'bg-violet-100 text-violet-800 dark:bg-violet-900/60 dark:text-violet-300',
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
  const textareaCls = 'w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none dark:border-slate-600 dark:bg-slate-700/60 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-slate-500';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-800">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-700">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Give a shoutout</p>
            <h2 className="mt-0.5 text-lg font-semibold text-slate-900 dark:text-slate-100">{name}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-6 py-2.5 dark:border-slate-700 dark:bg-slate-800/80">
          {([1, 2, 3] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-1.5">
              <div className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold transition ${step >= s ? 'bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                {step > s ? '✓' : s}
              </div>
              <span className={`text-xs font-medium transition ${step === s ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500'}`}>
                {stepLabels[i]}
              </span>
              {s < 3 && <span className="text-slate-300 dark:text-slate-600">›</span>}
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
                className="flex w-full items-center gap-4 rounded-2xl border-2 border-slate-100 bg-white p-4 text-left transition hover:border-slate-200 hover:bg-slate-50 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600 dark:hover:bg-slate-700"
              >
                <span className="text-3xl">{c.emoji}</span>
                <div>
                  <p className="text-base font-bold text-slate-900 dark:text-slate-100">{c.label}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{c.sublabel}</p>
                </div>
                <svg className="ml-auto h-4 w-4 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
              <p className="mb-4 text-sm font-medium text-slate-700 dark:text-slate-300">
                What would you like to recognize {name} for?
              </p>
              <div className="flex flex-wrap gap-2">
                {config.chips.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setSelectedChip(selectedChip === chip ? null : chip)}
                    className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
                      selectedChip === chip
                        ? 'bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900'
                        : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-300 dark:hover:bg-slate-600'
                    }`}
                  >
                    {chip}
                  </button>
                ))}
              </div>

              <div className="mt-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
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
                  className={textareaCls}
                />
              </div>

              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                  Personal note (optional)
                </p>
                <textarea
                  value={personalNote}
                  onChange={(e) => setPersonalNote(e.target.value)}
                  placeholder={`Add a personal message for ${name}...`}
                  rows={2}
                  className={textareaCls}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 border-t border-slate-100 bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!shoutoutText}
                onClick={() => setStep(3)}
                className="flex-1 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-slate-300"
              >
                Preview →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Preview + send */}
        {step === 3 && selectedType && config && (
          <div className="p-6">
            <p className="mb-4 text-sm font-medium text-slate-600 dark:text-slate-400">
              Here's what {name} will see:
            </p>

            <div className={`rounded-2xl ${config.bg} p-5 ring-1 ${config.ring}`}>
              <span className={`mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${config.badge}`}>
                <span>{config.emoji}</span>
                <span>{config.label}</span>
              </span>
              <p className="text-base font-bold text-slate-900 dark:text-slate-100">{shoutoutText}</p>
              {personalNote.trim() && (
                <p className="mt-2 text-sm italic text-slate-600 dark:text-slate-400">"{personalNote.trim()}"</p>
              )}
              <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">Week {weekNumber} · From your advisor</p>
            </div>

            {error && <p className="mt-3 text-sm text-rose-700 dark:text-rose-400">{error}</p>}

            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
              >
                Back
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSend}
                className={`flex-1 rounded-full bg-gradient-to-r ${config.gradient} px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40`}
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
