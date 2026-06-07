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

interface StudentAccountSettingsProps {
  student: Student;
  onClose: () => void;
  onSaved: (updatedStudent: Student) => void;
}

type Tab = 'profile' | 'account';

export default function StudentAccountSettings({ student, onClose, onSaved }: StudentAccountSettingsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  // Profile fields
  const [plans, setPlans] = useState<string[]>(student.post_secondary_plans ?? []);
  const [riasecCodes, setRiasecCodes] = useState<string[]>(student.riasec_codes ?? []);
  const [strengths, setStrengths] = useState<string[]>(student.strengths ?? []);
  const [careerInterest, setCareerInterest] = useState(student.specific_career_interest ?? '');
  const [proximity, setProximity] = useState(student.college_proximity_preference ?? '');
  const [careerProfanityError, setCareerProfanityError] = useState<string | null>(null);

  // Account fields
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState('');

  const name = student.preferred_name || student.first_name;

  // ── Profile save ────────────────────────────────────────────────────────────

  const saveProfile = async () => {
    if (careerInterest.trim() && hasProfanity(careerInterest)) {
      setCareerProfanityError('Please keep your answer school-appropriate.');
      return;
    }
    setSaving(true);
    try {
      const updates = {
        post_secondary_plans: plans.length > 0 ? plans : null,
        riasec_codes: riasecCodes.length > 0 ? riasecCodes : null,
        interests: riasecCodes.length > 0 ? riasecToInterests(riasecCodes) : null,
        strengths: strengths.length > 0 ? strengths : null,
        specific_career_interest: careerInterest.trim() || null,
        college_proximity_preference: proximity || null,
        onboarding_completed: true,
      };
      const { data, error } = await supabase
        .from('students')
        .update(updates)
        .eq('id', student.id)
        .select()
        .single();
      if (error) throw error;
      setSaveStatus('saved');
      setSaveMessage('Changes saved!');
      setTimeout(() => setSaveStatus('idle'), 2500);
      onSaved(data as Student);
    } catch (err: any) {
      setSaveStatus('error');
      setSaveMessage(err.message ?? 'Unable to save changes.');
    } finally {
      setSaving(false);
    }
  };

  // ── Password save ───────────────────────────────────────────────────────────

  const savePassword = async () => {
    if (!newPassword.trim()) { setSaveStatus('error'); setSaveMessage('New password is required.'); return; }
    if (newPassword.length < 6) { setSaveStatus('error'); setSaveMessage('Password must be at least 6 characters.'); return; }
    if (newPassword !== confirmPassword) { setSaveStatus('error'); setSaveMessage('Passwords do not match.'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword('');
      setConfirmPassword('');
      setSaveStatus('saved');
      setSaveMessage('Password updated!');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (err: any) {
      setSaveStatus('error');
      setSaveMessage(err.message ?? 'Unable to update password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(15,23,42,0.4)' }}
        onClick={onClose}
      />

      {/* Slide-out panel */}
      <div
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col shadow-2xl"
        style={{ background: 'var(--color-card)', borderLeft: '1px solid var(--color-border)' }}
      >
        {/* Panel header — warmer tint + mascot */}
        <div
          className="flex items-center gap-4 px-6 py-5"
          style={{ background: 'rgba(247,197,45,0.10)', borderBottom: '1px solid var(--color-border)' }}
        >
          <img
            src="/png-mascots/mascot-welcome.png"
            alt=""
            aria-hidden="true"
            style={{ width: 48, height: 48, objectFit: 'contain', flexShrink: 0 }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.28em]" style={{ color: 'var(--color-text-muted)' }}>Account</p>
            <h2 className="mt-0.5 text-lg font-bold truncate" style={{ color: 'var(--color-text-primary)' }}>
              {name}'s settings
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 transition"
            style={{ color: 'var(--color-text-muted)' }}
            onMouseEnter={e => { (e.currentTarget).style.background = 'var(--color-card-tint)'; }}
            onMouseLeave={e => { (e.currentTarget).style.background = 'transparent'; }}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-6" style={{ borderBottom: '1px solid var(--color-border)' }}>
          {(['profile', 'account'] as Tab[]).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => { setActiveTab(tab); setSaveStatus('idle'); }}
              className="mr-6 border-b-2 px-1 py-3 text-sm font-semibold capitalize transition"
              style={
                activeTab === tab
                  ? { borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }
                  : { borderColor: 'transparent', color: 'var(--color-text-muted)' }
              }
            >
              {tab === 'profile' ? 'My Profile' : 'Account'}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">

          {/* ── My Profile tab ── */}
          {activeTab === 'profile' && (
            <div className="space-y-7">
              <section>
                <Label>What are you thinking about after high school?</Label>
                <div className="mt-3">
                  <PostSecondaryGrid value={plans} onChange={setPlans} compact />
                </div>
              </section>

              <section>
                <Label>What kind of activities feel most natural to you?</Label>
                <p className="mb-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>Pick up to 3 — most people are a mix of a few.</p>
                <RiasecCardGrid value={riasecCodes} onChange={setRiasecCodes} />
              </section>

              <section>
                <Label>What do you like doing?</Label>
                <div className="mt-3">
                  <StrengthChipGrid value={strengths} onChange={setStrengths} />
                </div>
              </section>

              <section>
                <Label>Specific career interest</Label>
                <p className="mb-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>No pressure if you're not sure yet.</p>
                <ProfileTextInput
                  value={careerInterest}
                  onChange={v => { setCareerInterest(v); setCareerProfanityError(null); }}
                  placeholder="e.g. nurse, electrician, teacher..."
                  profanityCheck
                  onProfanityDetected={() => { setCareerInterest(''); setCareerProfanityError('Please keep your answer school-appropriate.'); }}
                  profanityError={careerProfanityError}
                />
              </section>

              <section>
                <Label>If you go to college, where do you want to be?</Label>
                <div className="mt-3">
                  <ProximityCardSelector value={proximity} onChange={setProximity} compact />
                </div>
              </section>
            </div>
          )}

          {/* ── Account tab ── */}
          {activeTab === 'account' && (
            <div className="space-y-6">
              <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--color-card-tint)', border: '1px solid var(--color-border)' }}>
                <InfoRow label="Display name" value={`${student.preferred_name || student.first_name} ${student.last_name}`} />
                <InfoRow label="Grade" value={student.grade_level ?? '—'} />
              </div>

              <div className="space-y-4">
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Change password</p>
                <PasswordInput
                  label="New password"
                  value={newPassword}
                  onChange={setNewPassword}
                  placeholder="At least 6 characters"
                />
                <PasswordInput
                  label="Confirm new password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder="Re-enter new password"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderTop: '1px solid var(--color-border)' }}>
          {saveStatus === 'saved' && (
            <p className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>✓ {saveMessage}</p>
          )}
          {saveStatus === 'error' && (
            <p className="text-sm text-rose-600">{saveMessage}</p>
          )}
          {saveStatus === 'idle' && <span />}

          <button
            type="button"
            disabled={saving}
            onClick={activeTab === 'profile' ? saveProfile : savePassword}
            className="rounded-full px-6 py-2.5 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: 'var(--color-primary)' }}
          >
            {saving ? 'Saving…' : activeTab === 'profile' ? 'Save changes' : 'Save password'}
          </button>
        </div>
      </div>
    </>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>{children}</p>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{value}</span>
    </div>
  );
}

function PasswordInput({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <label className="block space-y-1.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
      <span className="font-medium">{label}</span>
      <input
        type="password"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', borderRadius: '1rem', border: '1px solid var(--color-border)',
          background: 'var(--color-card)', padding: '0.75rem 1rem',
          fontSize: '0.875rem', color: 'var(--color-text-primary)', outline: 'none',
        }}
        onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; e.target.style.boxShadow = '0 0 0 2px rgba(28,125,107,0.15)'; }}
        onBlur={e => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none'; }}
      />
    </label>
  );
}
