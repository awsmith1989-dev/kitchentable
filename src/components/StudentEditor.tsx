import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { AdvisoryClass, School, Student, StudentCareerFavorite, StudentTeacherNotes } from '../lib/types';
import {
  PostSecondaryGrid,
  RiasecCardGrid,
  StrengthChipGrid,
  ProximityCardSelector,
  ProfileTextInput,
  riasecToInterests,
} from './StudentProfileFields';

interface StudentEditorProps {
  advisoryClass: AdvisoryClass | null;
  schoolId: string;
  teacherId: string;
  studentToEdit: Student | null;
  onClose: () => void;
  onSaved: (student: Student) => void;
  school?: School | null;
}

type Tab = 'profile' | 'advisory' | 'notes' | 'student-profile';

const postSecondaryOptions = [
  'Straight to Work', 'Military', 'Trade School / Vocational', '2-Year College', '4-Year College',
];

const strengthCategories = [
  { label: 'Character', items: ['Determined', 'Resilient', 'Compassionate', 'Honest', 'Courageous', 'Humble', 'Patient', 'Generous'] },
  { label: 'Academic',  items: ['Creative thinker', 'Strong writer', 'Problem solver', 'Critical thinker', 'Detail oriented', 'Quick learner', 'Great listener', 'Asks great questions'] },
  { label: 'Social',    items: ['Natural leader', 'Team player', 'Peacemaker', 'Great communicator', 'Empathetic', 'Dependable', 'Encouraging', 'Inclusive'] },
  { label: 'Unique',    items: ['Hard worker', 'Never gives up', 'Shows up every day', 'Lifts others up', 'Has a big heart', 'Sees the big picture', 'Thinks outside the box', 'Makes people feel welcome'] },
];

const inputStyle: React.CSSProperties = {
  width: '100%',
  borderRadius: '1rem',
  border: '1px solid var(--color-border)',
  background: 'var(--color-card)',
  padding: '0.75rem 1rem',
  fontSize: '0.875rem',
  color: 'var(--color-text-primary)',
  outline: 'none',
};

function StyledInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{ ...inputStyle, ...(props.style ?? {}) }}
      onFocus={(e) => { e.target.style.borderColor = 'var(--color-primary)'; e.target.style.boxShadow = '0 0 0 2px rgba(28,125,107,0.15)'; props.onFocus?.(e); }}
      onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none'; props.onBlur?.(e); }}
    />
  );
}

function StyledTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      style={{ ...inputStyle, resize: 'vertical', ...(props.style ?? {}) }}
      onFocus={(e) => { e.target.style.borderColor = 'var(--color-primary)'; e.target.style.boxShadow = '0 0 0 2px rgba(28,125,107,0.15)'; props.onFocus?.(e); }}
      onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none'; props.onBlur?.(e); }}
    />
  );
}

export default function StudentEditor({
  advisoryClass, schoolId, teacherId, studentToEdit, onClose, onSaved, school,
}: StudentEditorProps) {
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [preferredName, setPreferredName] = useState('');
  const [externalId, setExternalId] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [targetGpa, setTargetGpa] = useState('');

  const [postSecondaryPlans, setPostSecondaryPlans] = useState<string[]>([]);
  const [interests, setInterests] = useState('');
  const [careerGoals, setCareerGoals] = useState('');
  const [communityAssets, setCommunityAssets] = useState('');
  const [strengths, setStrengths] = useState<string[]>([]);

  // Student Profile tab (onboarding fields — editable by advisor)
  const [spPlans, setSpPlans] = useState<string[]>([]);
  const [spRiasecCodes, setSpRiasecCodes] = useState<string[]>([]);
  const [spStrengths, setSpStrengths] = useState<string[]>([]);
  const [spCareerInterest, setSpCareerInterest] = useState('');
  const [spProximity, setSpProximity] = useState('');
  const [spCareerProfanityErr, setSpCareerProfanityErr] = useState<string | null>(null);
  const [spFavorites, setSpFavorites] = useState<StudentCareerFavorite[]>([]);

  const [notes, setNotes] = useState('');
  const [notesId, setNotesId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (studentToEdit) {
      setFirstName(studentToEdit.first_name);
      setLastName(studentToEdit.last_name);
      setPreferredName(studentToEdit.preferred_name ?? '');
      setExternalId(studentToEdit.student_id_external ?? '');
      setGradeLevel(studentToEdit.grade_level ?? '');
      setTargetGpa(studentToEdit.target_gpa?.toFixed(2) ?? '');
      setPostSecondaryPlans(studentToEdit.post_secondary_plans ?? []);
      setInterests(studentToEdit.interests ?? '');
      setCareerGoals(studentToEdit.career_goals ?? '');
      setCommunityAssets(studentToEdit.community_assets ?? '');
      setStrengths(studentToEdit.strengths ?? []);

      setSpPlans(studentToEdit.post_secondary_plans ?? []);
      setSpRiasecCodes(studentToEdit.riasec_codes ?? []);
      setSpStrengths(studentToEdit.strengths ?? []);
      setSpCareerInterest(studentToEdit.specific_career_interest ?? '');
      setSpProximity(studentToEdit.college_proximity_preference ?? '');

      supabase
        .from('student_career_favorites')
        .select('*')
        .eq('student_id', studentToEdit.id)
        .order('favorited_at', { ascending: true })
        .then(({ data }) => setSpFavorites((data ?? []) as StudentCareerFavorite[]));

      supabase
        .from('student_teacher_notes')
        .select('*')
        .eq('student_id', studentToEdit.id)
        .eq('teacher_id', teacherId)
        .maybeSingle()
        .then(({ data }) => {
          const row = data as StudentTeacherNotes | null;
          setNotes(row?.notes ?? '');
          setNotesId(row?.id ?? null);
        });
    } else {
      setFirstName(''); setLastName(''); setPreferredName(''); setExternalId('');
      setGradeLevel(''); setTargetGpa('');
      setPostSecondaryPlans([]); setInterests(''); setCareerGoals('');
      setCommunityAssets(''); setStrengths([]);
      setSpPlans([]); setSpRiasecCodes([]); setSpStrengths([]); setSpCareerInterest(''); setSpProximity('');
      setSpFavorites([]);
      setNotes(''); setNotesId(null);
    }
    setError(null);
    setActiveTab('profile');
  }, [studentToEdit, teacherId]);

  const handleSubmit = async () => {
    setError(null);
    if (!firstName.trim() || !lastName.trim()) {
      setError('First name and last name are required.');
      setActiveTab('profile');
      return;
    }

    const studentPayload = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      preferred_name: preferredName.trim() || null,
      student_id_external: externalId.trim() || null,
      grade_level: gradeLevel.trim() || null,
      target_gpa: targetGpa.trim() === '' ? null : Number(targetGpa),
      post_secondary_plans: spPlans.length > 0 ? spPlans : (postSecondaryPlans.length > 0 ? postSecondaryPlans : null),
      riasec_codes: spRiasecCodes.length > 0 ? spRiasecCodes : null,
      interests: spRiasecCodes.length > 0 ? riasecToInterests(spRiasecCodes) : (interests.trim() || null),
      career_goals: careerGoals.trim() || null,
      community_assets: communityAssets.trim() || null,
      strengths: spStrengths.length > 0 ? spStrengths : (strengths.length > 0 ? strengths : []),
      specific_career_interest: spCareerInterest.trim() || null,
      college_proximity_preference: spProximity || null,
      school_id: schoolId,
      advisory_class_id: advisoryClass?.id ?? null,
      status: 'active',
    };

    try {
      setSaving(true);
      const studentResponse = studentToEdit
        ? await supabase.from('students').update(studentPayload).eq('id', studentToEdit.id).select().single()
        : await supabase.from('students').insert(studentPayload).select().single();

      if (studentResponse.error) throw studentResponse.error;
      const savedStudent = studentResponse.data as Student;

      if (studentToEdit) {
        const notesPayload = {
          student_id: savedStudent.id,
          teacher_id: teacherId,
          notes: notes.trim() || null,
        };
        if (notesId) {
          await supabase.from('student_teacher_notes').update(notesPayload).eq('id', notesId);
        } else {
          await supabase.from('student_teacher_notes').insert(notesPayload);
        }
      }

      onSaved(savedStudent);
    } catch (err: any) {
      setError(err?.message || 'Unable to save student details.');
    } finally {
      setSaving(false);
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'profile',         label: 'Profile' },
    { id: 'advisory',        label: 'Advisory Profile' },
    { id: 'notes',           label: 'Teacher Notes' },
    { id: 'student-profile', label: 'Student Profile' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: 'rgba(27,58,92,0.5)' }} onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl shadow-2xl" style={{ background: 'var(--color-card)' }}>

        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: 'var(--color-text-muted)' }}>
              {studentToEdit ? 'Edit student' : 'Add student'}
            </p>
            <h2 className="mt-0.5 text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              {studentToEdit
                ? `${studentToEdit.preferred_name || studentToEdit.first_name} ${studentToEdit.last_name}`
                : 'New student'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 transition"
            style={{ color: 'var(--color-text-muted)' }}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.background = 'var(--color-card-tint)'; }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'transparent'; }}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-6" style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-card-tint)' }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="mr-6 border-b-2 px-1 py-3 text-sm font-semibold transition"
              style={
                activeTab === tab.id
                  ? { borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }
                  : { borderColor: 'transparent', color: 'var(--color-text-muted)' }
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">

          {activeTab === 'profile' && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { label: 'First name', value: firstName, onChange: setFirstName, placeholder: '' },
                  { label: 'Last name', value: lastName, onChange: setLastName, placeholder: '' },
                  { label: 'Preferred name', value: preferredName, onChange: setPreferredName, placeholder: 'If different from first name' },
                  { label: 'Student ID', value: externalId, onChange: setExternalId, placeholder: '' },
                  { label: 'Grade level', value: gradeLevel, onChange: setGradeLevel, placeholder: 'e.g., 10, 11, 12' },
                ].map(({ label, value, onChange, placeholder }) => (
                  <label key={label} className="space-y-1.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    <span className="font-medium">{label}</span>
                    <StyledInput type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
                  </label>
                ))}
                <label className="space-y-1.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  <span className="font-medium">Target GPA</span>
                  <StyledInput
                    type="text"
                    inputMode="decimal"
                    value={targetGpa}
                    onChange={(e) => setTargetGpa(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder="0.00"
                  />
                </label>
              </div>
            </div>
          )}

          {activeTab === 'advisory' && (
            <div className="space-y-6">
              <div>
                <p className="mb-2 text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Post-secondary plans</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {postSecondaryOptions.map((option) => (
                    <label key={option} className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      <input
                        type="checkbox"
                        checked={postSecondaryPlans.includes(option)}
                        onChange={(e) => {
                          setPostSecondaryPlans(e.target.checked
                            ? [...postSecondaryPlans, option]
                            : postSecondaryPlans.filter((p) => p !== option));
                        }}
                        className="rounded"
                        style={{ borderColor: 'var(--color-border)', accentColor: 'var(--color-primary)' }}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </div>

              <label className="block space-y-1.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                <span className="font-medium">Interests and hobbies</span>
                <StyledTextarea value={interests} onChange={(e) => setInterests(e.target.value)} placeholder="e.g., Basketball, wants to study medicine, interested in video games" rows={3} />
              </label>

              <label className="block space-y-1.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                <span className="font-medium">Career goals</span>
                <StyledTextarea value={careerGoals} onChange={(e) => setCareerGoals(e.target.value)} placeholder="What does this student want to do or become?" rows={3} />
              </label>

              <label className="block space-y-1.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                <span className="font-medium">Community assets</span>
                <StyledTextarea value={communityAssets} onChange={(e) => setCommunityAssets(e.target.value)} placeholder="Family background, community involvement, cultural strengths..." rows={3} />
              </label>

              <div>
                <p className="mb-3 text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  Strengths
                  {strengths.length > 0 && (
                    <span className="ml-2 text-xs font-normal" style={{ color: 'var(--color-text-muted)' }}>{strengths.length} selected</span>
                  )}
                </p>
                <div className="space-y-3">
                  {strengthCategories.map((category) => (
                    <div key={category.label}>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--color-text-muted)' }}>{category.label}</p>
                      <div className="flex flex-wrap gap-2">
                        {category.items.map((strength) => (
                          <button
                            key={strength}
                            type="button"
                            onClick={() => setStrengths((prev) =>
                              prev.includes(strength) ? prev.filter((s) => s !== strength) : [...prev, strength]
                            )}
                            className="rounded-full px-3 py-1.5 text-xs font-semibold transition"
                            style={
                              strengths.includes(strength)
                                ? { background: 'var(--color-primary)', color: '#ffffff', border: '1px solid var(--color-primary)' }
                                : { background: 'var(--color-card)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }
                            }
                          >
                            {strength}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'student-profile' && (
            <div className="space-y-7">
              <div className="rounded-2xl px-4 py-3 text-sm" style={{ background: 'rgba(247,197,45,0.08)', border: '1px solid rgba(247,197,45,0.3)' }}>
                <p style={{ color: 'var(--color-text-secondary)' }}>
                  <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>These answers were set by the student during onboarding.</span>
                  {' '}Edit carefully.
                </p>
              </div>

              <section>
                <p className="mb-3 text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Post-secondary plans</p>
                <PostSecondaryGrid value={spPlans} onChange={setSpPlans} compact />
              </section>

              <section>
                <p className="mb-3 text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>What kind of activities feel most natural to them?</p>
                <RiasecCardGrid value={spRiasecCodes} onChange={setSpRiasecCodes} />
              </section>

              <section>
                <p className="mb-3 text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>What they like doing</p>
                <StrengthChipGrid value={spStrengths} onChange={setSpStrengths} />
              </section>

              <section>
                <p className="mb-2 text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Specific career interest</p>
                <ProfileTextInput
                  value={spCareerInterest}
                  onChange={v => { setSpCareerInterest(v); setSpCareerProfanityErr(null); }}
                  placeholder="e.g. nurse, electrician, teacher..."
                  onProfanityDetected={() => { setSpCareerInterest(''); setSpCareerProfanityErr('Please keep this school-appropriate.'); }}
                  profanityError={spCareerProfanityErr}
                />
              </section>

              <section>
                <p className="mb-3 text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>College proximity preference</p>
                <ProximityCardSelector value={spProximity} onChange={setSpProximity} compact />
              </section>

              <section>
                <p className="mb-2 text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Student's favorited careers</p>
                {spFavorites.length === 0 ? (
                  <p className="text-sm italic" style={{ color: 'var(--color-text-muted)' }}>
                    Student hasn't chosen favorites yet — encourage them to explore the Career Matches list.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {spFavorites.map((fav) => {
                      const semesterStart = school?.semester_start_date ? new Date(school.semester_start_date) : null;
                      let weekLabel = '';
                      if (semesterStart) {
                        const favDate = new Date(fav.favorited_at);
                        const diffDays = Math.floor((favDate.getTime() - semesterStart.getTime()) / (1000 * 60 * 60 * 24));
                        const weekNum = Math.max(1, Math.ceil((diffDays + 1) / 7));
                        weekLabel = `favorited Week ${weekNum}`;
                      } else {
                        weekLabel = `favorited ${new Date(fav.favorited_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
                      }
                      return (
                        <div key={fav.id} className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'var(--color-card-tint)', border: '1px solid var(--color-border)' }}>
                          <span style={{ color: 'var(--color-primary)' }}>⭐</span>
                          <span className="flex-1 text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{fav.career_title}</span>
                          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{weekLabel}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-2xl px-4 py-3" style={{ border: '1px solid var(--color-border)', background: 'var(--color-card-tint)' }}>
                <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--color-text-muted)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>Private notes — not visible to student.</span>
                  {' '}Use this space for observations, context, or anything that should stay between you and the student record.
                </p>
              </div>
              <label className="block space-y-1.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                <span className="font-medium">Your notes</span>
                <StyledTextarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observations, family context, IEP notes, check-in history, anything relevant..." rows={10} />
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderTop: '1px solid var(--color-border)' }}>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm font-semibold transition"
            style={{ border: '1px solid var(--color-border)', background: 'var(--color-card)', color: 'var(--color-text-secondary)' }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSubmit}
            className="rounded-full px-6 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: 'var(--color-primary)' }}
          >
            {saving ? 'Saving…' : 'Save student'}
          </button>
        </div>
      </div>
    </div>
  );
}
