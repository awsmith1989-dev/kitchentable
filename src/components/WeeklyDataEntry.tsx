import { useEffect, useMemo, useState } from 'react';
import Papa from 'papaparse';
import { AdvisoryClass, ClassRecord, School, Student, WeeklyAttendance, WeeklyClassGrade, WeeklyGpaSnapshot } from '../lib/types';
import { supabase } from '../lib/supabaseClient';

interface WeeklyDataEntryProps {
  advisoryClass: AdvisoryClass | null;
  school: School;
  students: Student[];
  classes: ClassRecord[];
  weeklyGpa: WeeklyGpaSnapshot[];
  weeklyAttendance: WeeklyAttendance[];
  weeklyGrades: WeeklyClassGrade[];
  activeYear: string;
  onWeeklyDataSaved: (
    updatedGpa: WeeklyGpaSnapshot[],
    updatedAttendance: WeeklyAttendance[],
    updatedGrades: WeeklyClassGrade[]
  ) => void;
  onClose: () => void;
}

interface CsvPreviewRow {
  rowIndex: number;
  raw: Record<string, string>;
  studentIdExternal: string;
  weekNumber: string;
  gpa: string;
  absentDays: string;
  grades: Record<string, string>;
  errors: string[];
}

const parseNumber = (value: string) => {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeNumberInput = (value: string) => value.replace(/[^0-9.]/g, '');

const calculateCurrentWeekNumber = (startDate: string, semesterWeeks: number) => {
  const start = new Date(startDate);
  const today = new Date();
  if (Number.isNaN(start.getTime())) return 1;
  const diff = Math.floor((today.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return Math.min(Math.max(diff + 1, 1), semesterWeeks);
};

const buildGradeColumns = (classes: ClassRecord[]) => {
  return classes.map((cls) => ({
    key: `grade_${cls.id}`,
    label: cls.subject || cls.name,
    classId: cls.id
  }));
};

export default function WeeklyDataEntry({
  advisoryClass,
  school,
  students,
  classes,
  weeklyGpa,
  weeklyAttendance,
  weeklyGrades,
  activeYear,
  onWeeklyDataSaved,
  onClose
}: WeeklyDataEntryProps) {
  const csvGradeColumns = useMemo(() => buildGradeColumns(classes), [classes]);
  const weekOptions = useMemo(
    () => Array.from({ length: school.semester_weeks }, (_, index) => index + 1),
    [school.semester_weeks]
  );

  const defaultWeek = useMemo(
    () => calculateCurrentWeekNumber(school.semester_start_date, school.semester_weeks),
    [school.semester_start_date, school.semester_weeks]
  );
  const [selectedWeek, setSelectedWeek] = useState<number>(defaultWeek);
  const [activeTab, setActiveTab] = useState<'manual' | 'csv'>('manual');

  useEffect(() => {
    setSelectedWeek(defaultWeek);
  }, [defaultWeek]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [gpaInputs, setGpaInputs] = useState<Record<string, string>>({});
  const [attendanceInputs, setAttendanceInputs] = useState<Record<string, string>>({});
  const [gradeInputs, setGradeInputs] = useState<Record<string, Record<string, string>>>({});

  const [csvPreviewRows, setCsvPreviewRows] = useState<CsvPreviewRow[]>([]);
  const [csvValidationSummary, setCsvValidationSummary] = useState<string | null>(null);
  const [csvCommitResult, setCsvCommitResult] = useState<string | null>(null);
  const [csvUploadError, setCsvUploadError] = useState<string | null>(null);

  const schoolYear = activeYear || new Date().getFullYear().toString();

  const studentByExternal = useMemo(
    () => new Map(students.map((student) => [student.student_id_external?.trim() ?? '', student])),
    [students]
  );

  const existingWeeklyGpa = useMemo(
    () => new Map(weeklyGpa.filter((row) => row.school_year === schoolYear && row.week_number === selectedWeek).map((row) => [row.student_id, String(row.gpa)])),
    [weeklyGpa, schoolYear, selectedWeek]
  );

  const existingWeeklyAttendance = useMemo(
    () => new Map(weeklyAttendance.filter((row) => row.school_year === schoolYear && row.week_number === selectedWeek).map((row) => [row.student_id, String(row.absent_days)])),
    [weeklyAttendance, schoolYear, selectedWeek]
  );

  const existingWeeklyGrades = useMemo(
    () => {
      const map = new Map<string, Record<string, string>>();
      weeklyGrades
        .filter((row) => row.school_year === schoolYear && row.week_number === selectedWeek)
        .forEach((row) => {
          const rowMap = map.get(row.student_id) ?? {};
          rowMap[row.class_id] = row.grade ?? '';
          map.set(row.student_id, rowMap);
        });
      return map;
    },
    [weeklyGrades, schoolYear, selectedWeek]
  );

  useEffect(() => {
    setGpaInputs(
      students.reduce((acc, student) => {
        acc[student.id] = existingWeeklyGpa.get(student.id) ?? '';
        return acc;
      }, {} as Record<string, string>)
    );
    setAttendanceInputs(
      students.reduce((acc, student) => {
        acc[student.id] = existingWeeklyAttendance.get(student.id) ?? '';
        return acc;
      }, {} as Record<string, string>)
    );
    setGradeInputs(
      students.reduce((acc, student) => {
        acc[student.id] = existingWeeklyGrades.get(student.id) ?? {};
        return acc;
      }, {} as Record<string, Record<string, string>>)
    );
    setSuccessMessage(null);
    setSubmitError(null);
  }, [selectedWeek, existingWeeklyGpa, existingWeeklyAttendance, existingWeeklyGrades, students]);

  const handleGpaChange = (studentId: string, value: string) => {
    setGpaInputs((prev) => ({ ...prev, [studentId]: normalizeNumberInput(value) }));
  };

  const handleAttendanceChange = (studentId: string, value: string) => {
    setAttendanceInputs((prev) => ({ ...prev, [studentId]: value.replace(/[^0-9]/g, '') }));
  };

  const handleGradeChange = (studentId: string, classId: string, value: string) => {
    setGradeInputs((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [classId]: value.replace(/[^0-9.]/g, '')
      }
    }));
  };

  const handleSubmitWeeklyData = async () => {
    setSubmitError(null);
    setSuccessMessage(null);
    if (!advisoryClass) {
      setSubmitError('Advisory class is not loaded yet.');
      return;
    }

    const gpaUpdates: Array<{ student_id: string; school_year: string; week_number: number; gpa: number }> = [];
    const attendanceUpdates: Array<{ student_id: string; school_year: string; week_number: number; present_days: number; absent_days: number; tardies: number; excused_days: number; advisory_class_id: string }> = [];
    const classGradeUpdates: Array<{ student_id: string; class_id: string; school_year: string; week_number: number; grade: string; grade_points: number | null }> = [];

    students.forEach((student) => {
      const rawGpa = gpaInputs[student.id]?.trim() ?? '';
      const parsedGpa = parseNumber(rawGpa);
      if (parsedGpa !== null && parsedGpa >= 0 && parsedGpa <= 4) {
        gpaUpdates.push({ student_id: student.id, school_year: schoolYear, week_number: selectedWeek, gpa: parsedGpa });
      }

      const rawAbsent = attendanceInputs[student.id]?.trim() ?? '';
      const parsedAbsent = rawAbsent === '' ? null : Number(rawAbsent);
      if (parsedAbsent !== null && Number.isFinite(parsedAbsent) && parsedAbsent >= 0) {
        attendanceUpdates.push({
          student_id: student.id,
          school_year: schoolYear,
          week_number: selectedWeek,
          present_days: 0,
          absent_days: parsedAbsent,
          tardies: 0,
          excused_days: 0,
          advisory_class_id: advisoryClass?.id ?? undefined
        });
      }

      const classGradesForStudent = gradeInputs[student.id] ?? {};
      classes.forEach((cls) => {
        const rawGrade = classGradesForStudent[cls.id]?.trim() ?? '';
        const parsedGrade = parseNumber(rawGrade);
        if (parsedGrade !== null && parsedGrade >= 0 && parsedGrade <= 100) {
          classGradeUpdates.push({
            student_id: student.id,
            class_id: cls.id,
            school_year: schoolYear,
            week_number: selectedWeek,
            grade: String(parsedGrade),
            grade_points: null
          });
        }
      });
    });

    if (gpaUpdates.length === 0 && attendanceUpdates.length === 0 && classGradeUpdates.length === 0) {
      setSubmitError('Enter at least one value before saving.');
      return;
    }

    try {
      const [gpaResult, attendanceResult, gradesResult] = await Promise.all([
        gpaUpdates.length > 0
          ? supabase.from('weekly_gpa_snapshots').upsert(gpaUpdates, { onConflict: ['student_id', 'school_year', 'week_number'] })
          : Promise.resolve({ data: [] as WeeklyGpaSnapshot[] }),
        attendanceUpdates.length > 0
          ? supabase.from('weekly_attendance').upsert(attendanceUpdates, { onConflict: ['student_id', 'school_year', 'week_number'] })
          : Promise.resolve({ data: [] as WeeklyAttendance[] }),
        classGradeUpdates.length > 0
          ? supabase.from('weekly_class_grades').upsert(classGradeUpdates, { onConflict: ['student_id', 'class_id', 'school_year', 'week_number'] })
          : Promise.resolve({ data: [] as WeeklyClassGrade[] })
      ]);

      if (gpaResult.error) throw gpaResult.error;
      if (attendanceResult.error) throw attendanceResult.error;
      if (gradesResult.error) throw gradesResult.error;

      onWeeklyDataSaved(
        (gpaResult.data as WeeklyGpaSnapshot[]) ?? [],
        (attendanceResult.data as WeeklyAttendance[]) ?? [],
        (gradesResult.data as WeeklyClassGrade[]) ?? []
      );
      setSuccessMessage('Weekly data saved successfully.');
    } catch (err: any) {
      setSubmitError(err?.message || 'Unable to save weekly data.');
    }
  };

  const handleDownloadTemplate = () => {
    const templateRows = students.map((student) => {
      const row: Record<string, string> = {
        student_id_external: student.student_id_external ?? '',
        week_number: String(defaultWeek),
        gpa: '',
        absent_days: ''
      };
      csvGradeColumns.forEach((column) => {
        row[column.label] = '';
      });
      return row;
    });

    const csv = Papa.unparse(templateRows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'weekly-data-template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const validateCsvPreviewRow = (raw: Record<string, string>, rowIndex: number): CsvPreviewRow => {
    const studentIdExternal = (raw.student_id_external ?? '').trim();
    const weekNumber = (raw.week_number ?? '').trim();
    const gpa = (raw.gpa ?? '').trim();
    const absentDays = (raw.absent_days ?? '').trim();
    const errors: string[] = [];

    const student = studentByExternal.get(studentIdExternal);
    if (!student) {
      errors.push('Student ID external not found.');
    }

    const parsedWeek = Number(weekNumber);
    if (!Number.isInteger(parsedWeek) || parsedWeek < 1 || parsedWeek > school.semester_weeks) {
      errors.push(`Week must be an integer between 1 and ${school.semester_weeks}.`);
    }

    if (gpa !== '') {
      const parsedGpa = Number(gpa);
      if (Number.isNaN(parsedGpa) || parsedGpa < 0 || parsedGpa > 4) {
        errors.push('GPA must be a number between 0.00 and 4.00.');
      }
    }

    if (absentDays !== '') {
      const parsedAbsentDays = Number(absentDays);
      if (!Number.isInteger(parsedAbsentDays) || parsedAbsentDays < 0) {
        errors.push('Absences must be a whole number 0 or higher.');
      }
    }

    const grades: Record<string, string> = {};
    csvGradeColumns.forEach((column) => {
      const rawValue = (raw[column.label] ?? '').trim();
      grades[column.classId] = rawValue;
      if (rawValue !== '') {
        const parsedGrade = Number(rawValue);
        if (Number.isNaN(parsedGrade) || parsedGrade < 0 || parsedGrade > 100) {
          errors.push(`${column.label} must be a number between 0 and 100.`);
        }
      }
    });

    return {
      rowIndex,
      raw,
      studentIdExternal,
      weekNumber,
      gpa,
      absentDays,
      grades,
      errors
    };
  };

  const handleCsvFile = (file: File | null) => {
    setCsvUploadError(null);
    setCsvValidationSummary(null);
    setCsvCommitResult(null);
    setCsvPreviewRows([]);
    if (!file) return;

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const rows = result.data.map((raw, index) => validateCsvPreviewRow(raw, index + 1));
        setCsvPreviewRows(rows);
        const validCount = rows.filter((row) => row.errors.length === 0).length;
        const invalidCount = rows.length - validCount;
        setCsvValidationSummary(`${validCount} valid row(s), ${invalidCount} invalid row(s)`);
      },
      error: (error) => {
        setCsvUploadError(error.message || 'Unable to parse the CSV file.');
      }
    });
  };

  const handleCommitCsv = async () => {
    setCsvUploadError(null);
    setCsvCommitResult(null);
    setCsvValidationSummary(null);

    const validRows = csvPreviewRows.filter((row) => row.errors.length === 0);
    const skippedRows = csvPreviewRows.length - validRows.length;

    if (validRows.length === 0) {
      setCsvUploadError('There are no valid rows to commit.');
      return;
    }

    const gpaUpdates: Array<{ student_id: string; school_year: string; week_number: number; gpa: number }> = [];
    const attendanceUpdates: Array<{ student_id: string; school_year: string; week_number: number; present_days: number; absent_days: number; tardies: number; excused_days: number; advisory_class_id: string }> = [];
    const classGradeUpdates: Array<{ student_id: string; class_id: string; school_year: string; week_number: number; grade: string; grade_points: number | null }> = [];

    validRows.forEach((preview) => {
      const student = studentByExternal.get(preview.studentIdExternal);
      if (!student) return;
      const week = Number(preview.weekNumber);
      if (preview.gpa !== '') {
        gpaUpdates.push({
          student_id: student.id,
          school_year: schoolYear,
          week_number: week,
          gpa: Number(preview.gpa)
        });
      }
      if (preview.absentDays !== '') {
        attendanceUpdates.push({
          student_id: student.id,
          school_year: schoolYear,
          week_number: week,
          present_days: 0,
          absent_days: Number(preview.absentDays),
          tardies: 0,
          excused_days: 0,
          advisory_class_id: advisoryClass?.id ?? undefined
        });
      }
      Object.entries(preview.grades).forEach(([classId, rawGrade]) => {
        if (rawGrade.trim() === '') return;
        classGradeUpdates.push({
          student_id: student.id,
          class_id: classId,
          school_year: schoolYear,
          week_number: week,
          grade: String(Number(rawGrade)),
          grade_points: null
        });
      });
    });

    try {
      const [gpaResult, attendanceResult, gradesResult] = await Promise.all([
        gpaUpdates.length > 0
          ? supabase.from('weekly_gpa_snapshots').upsert(gpaUpdates, { onConflict: ['student_id', 'school_year', 'week_number'] })
          : Promise.resolve({ data: [] as WeeklyGpaSnapshot[] }),
        attendanceUpdates.length > 0
          ? supabase.from('weekly_attendance').upsert(attendanceUpdates, { onConflict: ['student_id', 'school_year', 'week_number'] })
          : Promise.resolve({ data: [] as WeeklyAttendance[] }),
        classGradeUpdates.length > 0
          ? supabase.from('weekly_class_grades').upsert(classGradeUpdates, { onConflict: ['student_id', 'class_id', 'school_year', 'week_number'] })
          : Promise.resolve({ data: [] as WeeklyClassGrade[] })
      ]);

      if (gpaResult.error) throw gpaResult.error;
      if (attendanceResult.error) throw attendanceResult.error;
      if (gradesResult.error) throw gradesResult.error;

      onWeeklyDataSaved(
        (gpaResult.data as WeeklyGpaSnapshot[]) ?? [],
        (attendanceResult.data as WeeklyAttendance[]) ?? [],
        (gradesResult.data as WeeklyClassGrade[]) ?? []
      );
      setCsvCommitResult(`${validRows.length} row(s) committed, ${skippedRows} row(s) skipped.`);
      setCsvValidationSummary(`${validRows.length} valid row(s), ${skippedRows} invalid row(s)`);
    } catch (err: any) {
      setCsvUploadError(err?.message || 'Unable to commit CSV data.');
    }
  };

  const csvHeaders = ['student_id_external', 'week_number', 'gpa', 'absent_days', ...csvGradeColumns.map((column) => column.label)];

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Weekly data entry</h2>
          <p className="mt-2 text-sm text-slate-500">Fill data manually or upload a roster CSV for the advisory class.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${activeTab === 'manual' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}
          >
            Manual entry
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('csv')}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${activeTab === 'csv' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}
          >
            CSV upload
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl bg-slate-50 p-4">
            <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Current year</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{schoolYear}</p>
          </div>
          <div className="rounded-3xl bg-slate-50 p-4">
            <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Selected week</p>
            <div className="mt-2">
              <select
                value={selectedWeek}
                onChange={(event) => setSelectedWeek(Number(event.target.value))}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-300 focus:outline-none"
              >
                {weekOptions.map((week) => (
                  <option key={week} value={week}>Week {week}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {successMessage ? (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            <div>{successMessage}</div>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Return to dashboard
            </button>
          </div>
        ) : null}

        {submitError ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{submitError}</div>
        ) : null}

        {activeTab === 'manual' ? (
          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-600">Enter or edit weekly GPA, absent days, and per-class grade values for each student. Fields are optional and can be saved partially.</p>
            </div>
            <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm text-slate-700">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Student</th>
                    <th className="px-4 py-3 font-semibold">GPA</th>
                    <th className="px-4 py-3 font-semibold">Absences</th>
                    {classes.map((cls) => (
                      <th key={cls.id} className="px-4 py-3 font-semibold">{cls.subject || cls.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {students.map((student) => (
                    <tr key={student.id}>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {student.preferred_name || student.first_name} {student.last_name}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={gpaInputs[student.id] ?? ''}
                          onChange={(event) => handleGpaChange(student.id, event.target.value)}
                          placeholder="0.00"
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-slate-300 focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={attendanceInputs[student.id] ?? ''}
                          onChange={(event) => handleAttendanceChange(student.id, event.target.value)}
                          placeholder="0"
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-slate-300 focus:outline-none"
                        />
                      </td>
                      {classes.map((cls) => (
                        <td key={cls.id} className="px-4 py-3">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={gradeInputs[student.id]?.[cls.id] ?? ''}
                            onChange={(event) => handleGradeChange(student.id, cls.id, event.target.value)}
                            placeholder="0-100"
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-slate-300 focus:outline-none"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">Save weekly snapshots for the selected week. Missing values will be skipped.</p>
              <button
                type="button"
                onClick={handleSubmitWeeklyData}
                className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Save weekly data
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm uppercase tracking-[0.3em] text-slate-500">CSV template</p>
                <p className="mt-2 text-sm text-slate-600">Download a starter template with your student roster and subject columns.</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Upload guide</p>
                <p className="mt-2 text-sm text-slate-600">Use the template, keep headers unchanged, and fix invalid rows before committing.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Download template
              </button>
              <label className="inline-flex cursor-pointer items-center rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
                <span>Select CSV file</span>
                <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => handleCsvFile(event.target.files?.[0] ?? null)} />
              </label>
            </div>

            {csvUploadError ? (
              <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{csvUploadError}</div>
            ) : null}
            {csvValidationSummary ? (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">{csvValidationSummary}</div>
            ) : null}
            {csvCommitResult ? (
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{csvCommitResult}</div>
            ) : null}

            {csvPreviewRows.length > 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-slate-900">Preview parsed rows</h3>
                  <button
                    type="button"
                    onClick={handleCommitCsv}
                    className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    Commit valid rows
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-left text-sm text-slate-700">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Row</th>
                        <th className="px-4 py-3 font-semibold">Student ID</th>
                        <th className="px-4 py-3 font-semibold">Week</th>
                        <th className="px-4 py-3 font-semibold">GPA</th>
                        <th className="px-4 py-3 font-semibold">Absences</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 font-semibold">Errors</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {csvPreviewRows.map((row) => (
                        <tr key={row.rowIndex} className={row.errors.length > 0 ? 'bg-rose-50' : ''}>
                          <td className="px-4 py-3">{row.rowIndex}</td>
                          <td className="px-4 py-3">{row.studentIdExternal}</td>
                          <td className="px-4 py-3">{row.weekNumber}</td>
                          <td className="px-4 py-3">{row.gpa}</td>
                          <td className="px-4 py-3">{row.absentDays}</td>
                          <td className="px-4 py-3 text-slate-900">{row.errors.length === 0 ? 'Valid' : 'Invalid'}</td>
                          <td className="px-4 py-3 text-sm text-rose-700">
                            {row.errors.map((error, index) => (
                              <div key={index}>{error}</div>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
