import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { AdvisoryClass, Student } from '../lib/types';

interface StudentEditorProps {
  advisoryClass: AdvisoryClass | null;
  schoolId: string;
  studentToEdit: Student | null;
  onClose: () => void;
  onSaved: (student: Student) => void;
}

const postSecondaryOptions = ['Straight to Work', 'Military', 'Trade School / Vocational', '2-Year College', '4-Year College'];

export default function StudentEditor({ advisoryClass, schoolId, studentToEdit, onClose, onSaved }: StudentEditorProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [externalId, setExternalId] = useState('');
  const [targetGpa, setTargetGpa] = useState('');
  const [postSecondaryPlans, setPostSecondaryPlans] = useState<string[]>([]);
  const [interests, setInterests] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (studentToEdit) {
      setFirstName(studentToEdit.first_name);
      setLastName(studentToEdit.last_name);
      setExternalId(studentToEdit.student_id_external ?? '');
      setTargetGpa(studentToEdit.target_gpa?.toFixed(2) ?? '');
      setPostSecondaryPlans(studentToEdit.post_secondary_plans ?? []);
      setInterests(studentToEdit.interests ?? '');
    } else {
      setFirstName('');
      setLastName('');
      setExternalId('');
      setTargetGpa('');
      setPostSecondaryPlans([]);
      setInterests('');
    }
    setError(null);
  }, [studentToEdit]);

  const handleSubmit = async () => {
    setError(null);
    if (!firstName.trim() || !lastName.trim()) {
      setError('First name and last name are required.');
      return;
    }

    const payload = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      student_id_external: externalId.trim() || null,
      target_gpa: targetGpa.trim() === '' ? null : Number(targetGpa),
      post_secondary_plans: postSecondaryPlans.length > 0 ? postSecondaryPlans : null,
      interests: interests.trim() || null,
      school_id: schoolId,
      advisory_class_id: advisoryClass?.id ?? null,
      status: 'active'
    };

    try {
      setSaving(true);
      const response = studentToEdit
        ? await supabase.from('students').update(payload).eq('id', studentToEdit.id).select().single()
        : await supabase.from('students').insert(payload).select().single();

      if (response.error) {
        throw response.error;
      }

      if (response.data) {
        onSaved(response.data as Student);
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to save student details.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{studentToEdit ? 'Edit student' : 'Add student'}</h2>
          <p className="mt-2 text-sm text-slate-500">Update the roster row and target GPA for this student.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>

      {error ? (
        <div className="mb-4 rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm text-slate-700">
          <span>First name</span>
          <input
            type="text"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-slate-300 focus:outline-none"
          />
        </label>
        <label className="space-y-2 text-sm text-slate-700">
          <span>Last name</span>
          <input
            type="text"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-slate-300 focus:outline-none"
          />
        </label>
        <label className="space-y-2 text-sm text-slate-700">
          <span>External ID</span>
          <input
            type="text"
            value={externalId}
            onChange={(event) => setExternalId(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-slate-300 focus:outline-none"
          />
        </label>
        <label className="space-y-2 text-sm text-slate-700">
          <span>Target GPA</span>
          <input
            type="text"
            inputMode="decimal"
            value={targetGpa}
            onChange={(event) => setTargetGpa(event.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="0.00"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-slate-300 focus:outline-none"
          />
        </label>
      </div>

      <div className="mt-4 space-y-2 text-sm text-slate-700">
        <span className="block font-medium">Post-secondary plans</span>
        <div className="grid gap-2 sm:grid-cols-2">
          {postSecondaryOptions.map((option) => (
            <label key={option} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={postSecondaryPlans.includes(option)}
                onChange={(event) => {
                  if (event.target.checked) {
                    setPostSecondaryPlans([...postSecondaryPlans, option]);
                  } else {
                    setPostSecondaryPlans(postSecondaryPlans.filter((p) => p !== option));
                  }
                }}
                className="rounded border border-slate-300"
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      </div>

      <label className="mt-4 block space-y-2 text-sm text-slate-700">
        <span>Interests and hobbies</span>
        <textarea
          value={interests}
          onChange={(event) => setInterests(event.target.value)}
          placeholder="e.g., Loves basketball, wants to study medicine, interested in video games"
          rows={3}
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-slate-300 focus:outline-none"
        />
      </label>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          disabled={saving}
          onClick={handleSubmit}
          className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save student'}
        </button>
      </div>
    </div>
  );
}
