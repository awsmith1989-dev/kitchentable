// Shared profile field components — used by OnboardingModal, StudentAccountSettings, StudentEditor
import { useState } from 'react';

export const RIASEC_OPTIONS = [
  { code: 'R', emoji: '🔨', label: 'Building and doing',     description: 'Working with hands, tools, machines, or being outdoors' },
  { code: 'I', emoji: '🔬', label: 'Thinking and discovering', description: 'Researching, experimenting, figuring out how things work' },
  { code: 'A', emoji: '🎨', label: 'Creating and expressing', description: 'Making art, music, writing, designing, or performing' },
  { code: 'S', emoji: '🤝', label: 'Helping and connecting',  description: 'Working with people, teaching, caring, being part of a team' },
  { code: 'E', emoji: '📢', label: 'Leading and persuading',  description: 'Being in charge, starting things, selling ideas, making decisions' },
  { code: 'C', emoji: '📋', label: 'Organizing and planning', description: 'Keeping things in order, working with data, following clear steps' },
];

export function riasecToInterests(codes: string[]): string {
  return codes
    .map(code => RIASEC_OPTIONS.find(o => o.code === code)?.label ?? '')
    .filter(Boolean)
    .join(', ');
}

// ── RiasecCardGrid ────────────────────────────────────────────────────────────

interface RiasecCardGridProps {
  value: string[];           // selected RIASEC codes e.g. ['R', 'S']
  onChange: (codes: string[]) => void;
  maxSelect?: number;
  showCounter?: boolean;
  showInfoButton?: boolean;  // show "What is this?" link (onboarding only)
}

export function RiasecCardGrid({
  value, onChange, maxSelect = 3, showCounter = true, showInfoButton = false,
}: RiasecCardGridProps) {
  const [showInfo, setShowInfo] = useState(false);

  const toggle = (code: string) => {
    if (value.includes(code)) {
      onChange(value.filter(c => c !== code));
    } else if (value.length < maxSelect) {
      onChange([...value, code]);
    }
  };

  return (
    <div>
      {showInfoButton && (
        <div className="relative mb-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowInfo(v => !v)}
            className="text-xs font-medium underline underline-offset-2 transition"
            style={{ color: 'var(--color-text-muted)' }}
          >
            What is this?
          </button>
          {showInfo && (
            <div
              className="absolute left-0 top-6 z-10 max-w-xs rounded-2xl p-4 text-xs leading-relaxed shadow-xl"
              style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
            >
              <p>
                This is based on the <strong>RIASEC model</strong> — a research-backed framework used by career counselors nationwide to match people with careers that fit their natural interests.
              </p>
              <button
                type="button"
                onClick={() => setShowInfo(false)}
                className="mt-2 font-semibold"
                style={{ color: 'var(--color-primary)' }}
              >
                Got it
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {RIASEC_OPTIONS.map(opt => {
          const selected = value.includes(opt.code);
          const atMax = !selected && value.length >= maxSelect;
          return (
            <button
              key={opt.code}
              type="button"
              disabled={atMax}
              onClick={() => toggle(opt.code)}
              className="flex flex-col items-start rounded-2xl border-2 p-4 text-left transition-all disabled:opacity-40"
              style={{
                background: selected ? 'var(--color-primary)' : 'var(--color-card)',
                borderColor: selected ? 'var(--color-primary)' : 'var(--color-border)',
              }}
            >
              <span className="text-2xl leading-none">{opt.emoji}</span>
              <p
                className="mt-2 text-sm font-bold leading-snug"
                style={{ color: selected ? '#fff' : 'var(--color-text-primary)' }}
              >
                {opt.label}
              </p>
              <p
                className="mt-1 text-xs leading-snug"
                style={{ color: selected ? 'rgba(255,255,255,0.8)' : 'var(--color-text-muted)' }}
              >
                {opt.description}
              </p>
            </button>
          );
        })}
      </div>

      {showCounter && (
        <p
          className="mt-2 text-xs font-semibold"
          style={{ color: value.length >= 1 ? 'var(--color-primary)' : 'var(--color-text-muted)' }}
        >
          {value.length === 0 ? `Pick 1–${maxSelect}` : `${value.length} of ${maxSelect} selected`}
        </p>
      )}
    </div>
  );
}

export const POST_SECONDARY_OPTIONS = [
  { value: 'Straight to Work',       emoji: '🔨', label: 'Straight to work' },
  { value: 'Military',               emoji: '🎖️', label: 'Military' },
  { value: 'Trade School / Vocational', emoji: '🔧', label: 'Trade or vocational' },
  { value: '2-Year College',         emoji: '🎓', label: '2-year college' },
  { value: '4-Year College',         emoji: '🏛️', label: '4-year college' },
  { value: 'Not sure yet',           emoji: '🤷', label: 'Not sure yet' },
];

export const STRENGTH_OPTIONS = [
  'Solving problems',
  'Helping others',
  'Working with my hands',
  'Connecting with people',
  'Creating art',
  'Learning new things',
  'Sharing what I know',
  'Exploring and adventuring',
  'Taking care of people',
  'Leading others',
  'Growing and building things',
  'Working with numbers',
];

export const PROXIMITY_OPTIONS = [
  { value: 'close_to_home',     emoji: '🏠', label: 'Close to home',     description: 'I want to stay near my family and community' },
  { value: 'weekend_distance',  emoji: '🚗', label: 'Weekend distance',  description: 'Far enough for independence, close enough to come home' },
  { value: 'ready_to_go_far',   emoji: '✈️', label: 'Ready to go far',   description: 'I want to explore somewhere new' },
];

const PROFANITY_BLOCKLIST = [
  'fuck', 'fuk', 'fck', 'shit', 'sh1t', 'ass', 'bitch', 'cunt', 'bastard',
  'piss', 'dick', 'cock', 'pussy', 'nigga', 'nigger', 'faggot', 'retard',
];

export function hasProfanity(text: string): boolean {
  const lower = text.toLowerCase().replace(/[^a-z0-9]/g, '');
  return PROFANITY_BLOCKLIST.some(w => lower.includes(w));
}

// ── PostSecondaryGrid ─────────────────────────────────────────────────────────

interface PostSecondaryGridProps {
  value: string[];
  onChange: (v: string[]) => void;
  compact?: boolean;
}

export function PostSecondaryGrid({ value, onChange, compact = false }: PostSecondaryGridProps) {
  const toggle = (opt: string) => {
    onChange(value.includes(opt) ? value.filter(p => p !== opt) : [...value, opt]);
  };

  return (
    <div className={`grid gap-2.5 ${compact ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3'}`}>
      {POST_SECONDARY_OPTIONS.map(opt => {
        const selected = value.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            className="relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 transition-all"
            style={{
              padding: compact ? '0.75rem 0.5rem' : '1rem 0.75rem',
              background: selected ? 'var(--color-primary)' : 'var(--color-card)',
              borderColor: selected ? 'var(--color-primary)' : 'var(--color-border)',
              color: selected ? '#fff' : 'var(--color-text-secondary)',
            }}
          >
            {selected && (
              <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-white">
                <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} style={{ color: 'var(--color-primary)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
            )}
            <span className={compact ? 'text-xl' : 'text-2xl'}>{opt.emoji}</span>
            <span className={`font-semibold leading-tight text-center ${compact ? 'text-xs' : 'text-sm'}`}>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── StrengthChipGrid ──────────────────────────────────────────────────────────

interface StrengthChipGridProps {
  value: string[];
  onChange: (v: string[]) => void;
  maxSelect?: number;
  showCounter?: boolean;
}

export function StrengthChipGrid({ value, onChange, maxSelect = 3, showCounter = true }: StrengthChipGridProps) {
  const toggle = (opt: string) => {
    if (value.includes(opt)) {
      onChange(value.filter(s => s !== opt));
    } else if (value.length < maxSelect) {
      onChange([...value, opt]);
    }
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        {STRENGTH_OPTIONS.map(opt => {
          const selected = value.includes(opt);
          const atMax = !selected && value.length >= maxSelect;
          return (
            <button
              key={opt}
              type="button"
              disabled={atMax}
              onClick={() => toggle(opt)}
              className="rounded-2xl border-2 px-3 py-2.5 text-left text-sm font-semibold transition-all disabled:opacity-40"
              style={{
                background: selected ? 'var(--color-primary)' : 'var(--color-card)',
                borderColor: selected ? 'var(--color-primary)' : 'var(--color-border)',
                color: selected ? '#fff' : 'var(--color-text-secondary)',
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {showCounter && (
        <p
          className="mt-2 text-xs font-semibold"
          style={{ color: value.length >= 1 ? 'var(--color-primary)' : 'var(--color-text-muted)' }}
        >
          {value.length === 0 ? `Pick 1–${maxSelect}` : `${value.length} of ${maxSelect} selected`}
        </p>
      )}
    </div>
  );
}

// ── ProximityCardSelector ─────────────────────────────────────────────────────

interface ProximityCardSelectorProps {
  value: string;
  onChange: (v: string) => void;
  compact?: boolean;
}

export function ProximityCardSelector({ value, onChange, compact = false }: ProximityCardSelectorProps) {
  return (
    <div className="flex flex-col gap-3">
      {PROXIMITY_OPTIONS.map(opt => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className="flex items-center gap-4 rounded-2xl border-2 text-left transition-all"
            style={{
              padding: compact ? '0.75rem 1rem' : '1rem 1.25rem',
              background: selected ? 'rgba(28,125,107,0.06)' : 'var(--color-card)',
              borderColor: selected ? 'var(--color-primary)' : 'var(--color-border)',
            }}
          >
            <span className={compact ? 'text-2xl' : 'text-3xl shrink-0'}>{opt.emoji}</span>
            <div className="min-w-0 flex-1">
              <p
                className="font-bold"
                style={{
                  fontSize: compact ? '0.875rem' : '1rem',
                  color: selected ? 'var(--color-primary)' : 'var(--color-text-primary)',
                }}
              >
                {opt.label}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{opt.description}</p>
            </div>
            {selected && (
              <div
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                style={{ background: 'var(--color-primary)' }}
              >
                <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── ProfileTextInput ──────────────────────────────────────────────────────────

interface ProfileTextInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  profanityCheck?: boolean;
  onProfanityDetected?: () => void;
  profanityError?: string | null;
  rows?: number;
}

export function ProfileTextInput({
  value,
  onChange,
  placeholder,
  maxLength = 150,
  profanityCheck = true,
  onProfanityDetected,
  profanityError,
  rows,
}: ProfileTextInputProps) {
  const handleChange = (v: string) => {
    if (v.length > maxLength) return;
    if (profanityCheck && hasProfanity(v) && onProfanityDetected) {
      onProfanityDetected();
      return;
    }
    onChange(v);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    borderRadius: '1rem',
    border: `1px solid ${profanityError ? '#f87171' : 'var(--color-border)'}`,
    background: 'var(--color-card)',
    padding: '0.75rem 1rem',
    fontSize: '0.875rem',
    color: 'var(--color-text-primary)',
    outline: 'none',
    resize: rows ? 'vertical' : undefined,
  };

  return (
    <div>
      {rows ? (
        <textarea
          value={value}
          onChange={e => handleChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          style={inputStyle}
          onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; e.target.style.boxShadow = '0 0 0 2px rgba(28,125,107,0.15)'; }}
          onBlur={e => { e.target.style.borderColor = profanityError ? '#f87171' : 'var(--color-border)'; e.target.style.boxShadow = 'none'; }}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={e => handleChange(e.target.value)}
          placeholder={placeholder}
          style={inputStyle}
          onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; e.target.style.boxShadow = '0 0 0 2px rgba(28,125,107,0.15)'; }}
          onBlur={e => { e.target.style.borderColor = profanityError ? '#f87171' : 'var(--color-border)'; e.target.style.boxShadow = 'none'; }}
        />
      )}
      <div className="mt-1 flex items-center justify-between">
        {profanityError ? (
          <p className="text-xs text-rose-600">{profanityError}</p>
        ) : (
          <span />
        )}
        <p className="text-xs" style={{ color: value.length > maxLength * 0.8 ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
          {value.length}/{maxLength}
        </p>
      </div>
    </div>
  );
}
