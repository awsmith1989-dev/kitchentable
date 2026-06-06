import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { AdvisoryClass, Student, StudentTeacherNotes } from '../lib/types';

interface StudentEditorProps {
  advisoryClass: AdvisoryClass | null;
  schoolId: string;
  teacherId: string;
  studentToEdit: Student | null;
  onClose: () => void;
  onSaved: (student: Student) => void;
}

type Tab = 'profile' | 'advisory' | 'notes';

const postSecondaryOptions = [
  'Straight to Work', 'Military', 'Trade School / Vocational', '2-Year College', '4-Year College',
];

const strengthCategories = [
  { label: 'Character', items: ['Determined', 'Resilient', 'Compassionate', 'Honest', 'Courageous', 'Humble', 'Patient', 'Generous'] },
  { label: 'Academic',  items: ['Creative thinker', 'Strong writer', 'Problem solver', 'Critical thinker', 'Detail oriented', 'Quick learner', 'Great listener', 'Asks great questions'] },
  { label: 'Social',    items: ['Natural leader', 'Team player', 'Peacemaker', 'Great communicator', 'Empathetic', 'Dependable', 'Encouraging', 'Inclusive'] },
  { label: 'Unique',    items: ['Hard worker', 'Never gives up', 'Shows up every day', 'Lifts others up', 'Has a big heart', 'Sees the big picture', 'Thinks outside the box', 'Makes people feel welcome'] },
];

const inputCls = 'w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none dark:border-slate-600 dark:bg-slate-700/60 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-slate-500';

export default function StudentEditor({
  advisoryClass, schoolId, teacherId, studentToEdit, onClose, onSaved,
}: StudentEditorProps) {
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  // Tab 1 — Profile
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [preferredName, setPreferredName] = useState('');
  const [externalId, setExternalId] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [targetGpa, setTargetGpa] = useState('');

  // Tab 2 — Advisory Profile
  const [postSecondaryPlans, setPostSecondaryPlans] = useState<string[]>([]);
  const [interests, setInterests] = useState('');
  const [careerGoals, setCareerGoals] = useState('');
  const [communityAssets, setCommunityAssets] = useState('');
  const [strengths, setStrengths] = useState<string[]>([]);

  // Tab 3 — Teacher Notes
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
      post_secondary_plans: postSecondaryPlans.length > 0 ? postSecondaryPlans : null,
      interests: interests.trim() || null,
      career_goals: careerGoals.trim() || null,
      community_assets: communityAssets.trim() || null,
      strengths: strengths.length > 0 ? strengths : [],
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
    { id: 'profile',  label: 'Profile' },
    { id: 'advisory', label: 'Advisory Profile' },
    { id: 'notes',    label: 'Teacher Notes' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-800">

        {/* Modal header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 dark:border-slate-700">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
              {studentToEdit ? 'Edit student' : 'Add student'}
            </p>
            <h2 className="mt-0.5 text-xl font-semibold text-slate-900 dark:text-slate-100">
              {studentToEdit
                ? `${studentToEdit.preferred_name || studentToEdit.first_name} ${studentToEdit.last_name}`
                : 'New student'}
            </h2>
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

        {/* Tabs */}
        <div className="flex border-b border-slate-100 bg-slate-50 px-6 dark:border-slate-700 dark:bg-slate-800/80">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`mr-6 border-b-2 px-1 py-3 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? 'border-slate-900 text-slate-900 dark:border-slate-200 dark:text-slate-100'
                  : 'border-transparent text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800/50 dark:bg-rose-950/40 dark:text-rose-400">
            {error}
          </div>
        )}

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">

          {/* ── Tab 1: Profile ── */}
          {activeTab === 'profile' && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
                  <span className="font-medium">First name</span>
                  <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} />
                </label>
                <label className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
                  <span className="font-medium">Last name</span>
                  <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} />
                </label>
                <label className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
                  <span className="font-medium">Preferred name</span>
                  <input type="text" value={preferredName} onChange={(e) => setPreferredName(e.target.value)} placeholder="If different from first name" className={inputCls} />
                </label>
                <label className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
                  <span className="font-medium">Student ID</span>
                  <input type="text" value={externalId} onChange={(e) => setExternalId(e.target.value)} className={inputCls} />
                </label>
                <label className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
                  <span className="font-medium">Grade level</span>
                  <input type="text" value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} placeholder="e.g., 10, 11, 12" className={inputCls} />
                </label>
                <label className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
                  <span className="font-medium">Target GPA</span>
                  <input type="text" inputMode="decimal" value={targetGpa} onChange={(e) => setTargetGpa(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0.00" className={inputCls} />
                </label>
              </div>
            </div>
          )}

          {/* ── Tab 2: Advisory Profile ── */}
          {activeTab === 'advisory' && (
            <div className="space-y-6">
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Post-secondary plans</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {postSecondaryOptions.map((option) => (
                    <label key={option} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={postSecondaryPlans.includes(option)}
                        onChange={(e) => {
                          setPostSecondaryPlans(e.target.checked
                            ? [...postSecondaryPlans, option]
                            : postSecondaryPlans.filter((p) => p !== option));
                        }}
                        className="rounded border border-slate-300 dark:border-slate-500"
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </div>

              <label className="block space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
                <span className="font-medium">Interests and hobbies</span>
                <textarea value={interests} onChange={(e) => setInterests(e.target.value)} placeholder="e.g., Basketball, wants to study medicine, interested in video games" rows={3} className={inputCls} />
              </label>

              <label className="block space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
                <span className="font-medium">Career goals</span>
                <textarea value={careerGoals} onChange={(e) => setCareerGoals(e.target.value)} placeholder="What does this student want to do or become?" rows={3} className={inputCls} />
              </label>

              <label className="block space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
                <span className="font-medium">Community assets</span>
                <textarea value={communityAssets} onChange={(e) => setCommunityAssets(e.target.value)} placeholder="Family background, community involvement, cultural strengths..." rows={3} className={inputCls} />
              </label>

              <div>
                <p className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Strengths
                  {strengths.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-slate-400 dark:text-slate-500">{strengths.length} selected</span>
                  )}
                </p>
                <div className="space-y-3">
                  {strengthCategories.map((category) => (
                    <div key={category.label}>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">{category.label}</p>
                      <div className="flex flex-wrap gap-2">
                        {category.items.map((strength) => (
                          <button
                            key={strength}
                            type="button"
                            onClick={() => setStrengths((prev) =>
                              prev.includes(strength) ? prev.filter((s) => s !== strength) : [...prev, strength]
                            )}
                            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                              strengths.includes(strength)
                                ? 'bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900'
                                : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-300 dark:hover:bg-slate-600'
                            }`}
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

          {/* ── Tab 3: Teacher Notes ── */}
          {activeTab === 'notes' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-700/40">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Private notes — not visible to student.</span>
                  {' '}Use this space for observations, context, or anything that should stay between you and the student record.
                </p>
              </div>
              <label className="block space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
                <span className="font-medium">Your notes</span>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observations, family context, IEP notes, check-in history, anything relevant..." rows={10} className={inputCls} />
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSubmit}
            className="rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-slate-300"
          >
            {saving ? 'Saving…' : 'Save student'}
          </button>
        </div>
      </div>
    </div>
  );
}
