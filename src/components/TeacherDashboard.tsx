import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Line, LineChart, ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import AnimatedDot from './AnimatedDot';
import StudentEditor from './StudentEditor';
import WeeklyDataEntry from './WeeklyDataEntry';
import { AdvisoryClass, ClassRecord, School, SelfAssessment, Student, Teacher, WeeklyAttendance, WeeklyClassGrade, WeeklyGpaSnapshot } from '../lib/types';

interface TeacherDashboardProps {
  user: User;
}

interface StudentGrowth extends Student {
  latestGpa: number | null;
  previousGpa: number | null;
  change: number | null;
  callout: string;
  isTopGrower: boolean;
  history: Array<{ week_number: number; gpa: number }>;
}

interface GpaChartPoint {
  week_number: number;
  avg_gpa: number | null;
}

interface AttendanceChartPoint {
  week_number: number;
  avg_absences: number | null;
}

const defaultSchool: School = {
  id: '',
  name: 'Loading school...',
  district: '',
  semester_weeks: 18,
  semester_start_date: new Date().toISOString().slice(0, 10),
  timezone: '',
  created_at: '',
  updated_at: ''
};

const defaultClass: AdvisoryClass = {
  id: '',
  name: 'Loading advisory',
  school_id: '',
  teacher_id: '',
  grade_level: '',
  active: true,
  created_at: '',
  updated_at: ''
};

const defaultStudentList: Student[] = [];
const defaultClassList: ClassRecord[] = [];
const defaultGpaList: WeeklyGpaSnapshot[] = [];
const defaultAttendanceList: WeeklyAttendance[] = [];

const growthBackground = (change: number | null) => {
  if (change === null) return 'bg-white';
  if (change > 0.25) return 'bg-gradient-to-r from-emerald-100 to-emerald-200';
  if (change > 0) return 'bg-gradient-to-r from-emerald-50 to-emerald-100';
  if (change < -0.25) return 'bg-gradient-to-r from-rose-100 to-rose-200';
  if (change < 0) return 'bg-gradient-to-r from-rose-50 to-rose-100';
  return 'bg-slate-50';
};

const stateOptions = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','IA','ID','IL','IN','KS','KY','LA','MA','MD',
  'ME','MI','MN','MO','MS','MT','NC','ND','NE','NH',
  'NJ','NM','NV','NY','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VA','VT','WA','WI','WV','WY','DC'
];

const sortSnapshots = (a: WeeklyGpaSnapshot, b: WeeklyGpaSnapshot) => {
  if (a.school_year !== b.school_year) return b.school_year.localeCompare(a.school_year);
  return b.week_number - a.week_number;
};

export default function TeacherDashboard({ user }: TeacherDashboardProps) {
  const [school, setSchool] = useState<School | null>(null);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [schoolState, setSchoolState] = useState<string>('');
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [fullName, setFullName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accountError, setAccountError] = useState<string | null>(null);
  const [advisoryClass, setAdvisoryClass] = useState<AdvisoryClass | null>(null);
  const [students, setStudents] = useState<Student[]>(defaultStudentList);
  const [classes, setClasses] = useState<ClassRecord[]>(defaultClassList);
  const [weeklyGpa, setWeeklyGpa] = useState<WeeklyGpaSnapshot[]>(defaultGpaList);
  const [weeklyAttendance, setWeeklyAttendance] = useState<WeeklyAttendance[]>(defaultAttendanceList);
  const [weeklyGrades, setWeeklyGrades] = useState<WeeklyClassGrade[]>([]);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [advisoryClasses, setAdvisoryClasses] = useState<AdvisoryClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selfAssessments, setSelfAssessments] = useState<SelfAssessment[]>([]);

  // Load all advisory classes for this teacher once on mount
  useEffect(() => {
    const loadInitial = async () => {
      setLoading(true);
      setError(null);
      try {
        const [advisoryResponse, teacherResponse] = await Promise.all([
          supabase.from('advisory_classes').select('*').eq('teacher_id', user.id).order('name'),
          supabase.from('teachers').select('*').eq('id', user.id).single()
        ]);

        if (advisoryResponse.error) throw advisoryResponse.error;
        if (teacherResponse.error) throw teacherResponse.error;

        const allAdvisoryClasses = (advisoryResponse.data ?? []) as AdvisoryClass[];
        if (allAdvisoryClasses.length === 0) throw new Error('No advisory classes found for this teacher.');

        setAdvisoryClasses(allAdvisoryClasses);

        if (teacherResponse.data) {
          const t = teacherResponse.data as Teacher;
          setTeacher(t);
          setFullName(t.full_name);
        }

        // Triggers the class-data effect below
        setSelectedClassId(allAdvisoryClasses[0].id);
      } catch (err: any) {
        setError(err.message || 'Unable to load dashboard data.');
        setLoading(false);
      }
    };
    loadInitial();
  }, [user.id]);

  // Reload all class-specific data whenever the selected advisory class changes
  useEffect(() => {
    if (!selectedClassId) return;

    const loadClassData = async () => {
      setError(null);
      try {
        const { data: classRecord, error: classError } = await supabase
          .from('advisory_classes')
          .select('*')
          .eq('id', selectedClassId)
          .single();

        if (classError) throw classError;
        if (!classRecord) throw new Error('Advisory class not found.');

        setAdvisoryClass(classRecord as AdvisoryClass);

        const [schoolResponse, studentsResponse, subjectClassesResponse] = await Promise.all([
          supabase.from('schools').select('*').eq('id', classRecord.school_id).single(),
          supabase.from('students').select('*').eq('advisory_class_id', selectedClassId),
          supabase.from('classes').select('*').eq('advisory_class_id', selectedClassId)
        ]);

        if (schoolResponse.error) throw schoolResponse.error;
        if (studentsResponse.error) throw studentsResponse.error;
        if (subjectClassesResponse.error) throw subjectClassesResponse.error;

        if (schoolResponse.data) {
          const s = schoolResponse.data as School;
          setSchool(s);
          setSchoolState(s.state ?? '');
        }
        setStudents((studentsResponse.data ?? []) as Student[]);
        setClasses((subjectClassesResponse.data ?? []) as ClassRecord[]);

        const studentIds = (studentsResponse.data ?? []).map((s: any) => s.id);

        if (studentIds.length > 0) {
          const [gpaResponse, attendanceResponse, gradesResponse, assessmentsResponse] = await Promise.all([
            supabase.from('weekly_gpa_snapshots').select('*').in('student_id', studentIds),
            supabase.from('weekly_attendance').select('*').in('student_id', studentIds),
            supabase.from('weekly_class_grades').select('*').in('student_id', studentIds),
            supabase.from('student_self_assessments').select('*').in('student_id', studentIds)
          ]);

          if (gpaResponse.error) throw gpaResponse.error;
          if (attendanceResponse.error) throw attendanceResponse.error;
          if (gradesResponse.error) throw gradesResponse.error;

          setWeeklyGpa((gpaResponse.data ?? []) as WeeklyGpaSnapshot[]);
          setWeeklyAttendance((attendanceResponse.data ?? []) as WeeklyAttendance[]);
          setWeeklyGrades((gradesResponse.data ?? []) as WeeklyClassGrade[]);
          setSelfAssessments((assessmentsResponse.data ?? []) as SelfAssessment[]);
        } else {
          setWeeklyGpa(defaultGpaList);
          setWeeklyAttendance(defaultAttendanceList);
          setWeeklyGrades([]);
          setSelfAssessments([]);
        }
      } catch (err: any) {
        setError(err.message || 'Unable to load class data.');
      } finally {
        setLoading(false);
      }
    };

    loadClassData();
  }, [selectedClassId]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleWeeklyDataSaved = (
    updatedGpa: WeeklyGpaSnapshot[],
    updatedAttendance: WeeklyAttendance[],
    updatedGrades: WeeklyClassGrade[]
  ) => {
    setWeeklyGpa((prev) => {
      const map = new Map(prev.map((row) => [`${row.student_id}-${row.school_year}-${row.week_number}`, row] as const));
      updatedGpa.forEach((row) => {
        map.set(`${row.student_id}-${row.school_year}-${row.week_number}`, row);
      });
      return Array.from(map.values());
    });

    setWeeklyAttendance((prev) => {
      const map = new Map(prev.map((row) => [`${row.student_id}-${row.school_year}-${row.week_number}`, row]));
      updatedAttendance.forEach((row) => {
        map.set(`${row.student_id}-${row.school_year}-${row.week_number}`, row);
      });
      return Array.from(map.values());
    });

    setWeeklyGrades((prev) => {
      const map = new Map(prev.map((row) => [`${row.student_id}-${row.class_id}-${row.school_year}-${row.week_number}`, row]));
      updatedGrades.forEach((row) => {
        map.set(`${row.student_id}-${row.class_id}-${row.school_year}-${row.week_number}`, row);
      });
      return Array.from(map.values());
    });
  };

  const handleSaveAccountSettings = async () => {
    if (!school) return;
    setAccountError(null);
    setSavingAccount(true);

    if (newPassword && newPassword !== confirmPassword) {
      setAccountError('Passwords do not match.');
      setSavingAccount(false);
      return;
    }

    try {
      if (teacher && fullName !== teacher.full_name) {
        const { data: teacherData, error: teacherError } = await supabase
          .from('teachers')
          .update({ full_name: fullName })
          .eq('id', teacher.id)
          .maybeSingle();

        if (teacherError) {
          throw teacherError;
        }

        if (teacherData) {
          setTeacher(teacherData as Teacher);
        }
      }

      if (schoolState !== (school.state ?? '')) {
        const { data: schoolData, error: schoolError } = await supabase
          .from('schools')
          .update({ state: schoolState })
          .eq('id', school.id)
          .maybeSingle();

        if (schoolError) {
          throw schoolError;
        }

        if (schoolData) {
          setSchool(schoolData as School);
        }
      }

      if (newPassword) {
        const { error: authError } = await supabase.auth.updateUser({ password: newPassword });
        if (authError) {
          throw authError;
        }
      }

      setAccountSettingsOpen(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setAccountError(err.message || 'Unable to save account settings.');
    } finally {
      setSavingAccount(false);
    }
  };

  const handleCancelAccountSettings = () => {
    setFullName(teacher?.full_name ?? '');
    setNewPassword('');
    setConfirmPassword('');
    setAccountError(null);
    setSchoolState(school?.state ?? '');
    setAccountSettingsOpen(false);
  };

  const [panelMode, setPanelMode] = useState<'none' | 'entry' | 'students'>('none');

  const handleOpenStudentEditor = (student: Student | null = null) => {
    setEditingStudent(student);
    setPanelMode('students');
  };

  const handleCloseStudentEditor = () => {
    setEditingStudent(null);
    setPanelMode('none');
  };

  const handleStudentSaved = (student: Student) => {
    setStudents((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === student.id);
      if (existingIndex >= 0) {
        return prev.map((item) => (item.id === student.id ? student : item));
      }
      return [student, ...prev];
    });
    setPanelMode('none');
  };

  const semesterWeeks = school?.semester_weeks ?? defaultSchool.semester_weeks;

  const activeYear = useMemo(() => {
    const allYears = [...new Set([...weeklyGpa, ...weeklyAttendance, ...weeklyGrades].map((record) => record.school_year))];
    return allYears.sort().pop() ?? '';
  }, [weeklyGpa, weeklyAttendance, weeklyGrades]);

  const gpaChartData = useMemo<GpaChartPoint[]>(() => {
    const weekMap = new Map<number, { sum: number; count: number }>();

    weeklyGpa
      .filter((record) => record.school_year === activeYear)
      .forEach((record) => {
        const current = weekMap.get(record.week_number) ?? { sum: 0, count: 0 };
        current.sum += Number(record.gpa);
        current.count += 1;
        weekMap.set(record.week_number, current);
      });

    return Array.from({ length: semesterWeeks }, (_, index) => {
      const week = index + 1;
      const entry = weekMap.get(week);
      return {
        week_number: week,
        avg_gpa: entry ? Number((entry.sum / entry.count).toFixed(2)) : null
      };
    });
  }, [weeklyGpa, activeYear, semesterWeeks]);

  const latestGpaWeek = useMemo(() => {
    const weeks = gpaChartData.filter((point) => point.avg_gpa !== null).map((point) => point.week_number);
    return weeks.length > 0 ? Math.max(...weeks) : 1;
  }, [gpaChartData]);

  const attendanceChartData = useMemo<AttendanceChartPoint[]>(() => {
    const weekMap = new Map<number, { sum: number; count: number }>();

    weeklyAttendance
      .filter((record) => record.school_year === activeYear)
      .forEach((record) => {
        const current = weekMap.get(record.week_number) ?? { sum: 0, count: 0 };
        current.sum += Number(record.absent_days);
        current.count += 1;
        weekMap.set(record.week_number, current);
      });

    return Array.from({ length: semesterWeeks }, (_, index) => {
      const week = index + 1;
      const entry = weekMap.get(week);
      return {
        week_number: week,
        avg_absences: entry ? Number((entry.sum / entry.count).toFixed(2)) : null
      };
    });
  }, [weeklyAttendance, activeYear, semesterWeeks]);

  const latestAttendanceWeek = useMemo(() => {
    const weeks = attendanceChartData.filter((point) => point.avg_absences !== null).map((point) => point.week_number);
    return weeks.length > 0 ? Math.max(...weeks) : 1;
  }, [attendanceChartData]);

  const studentSummaries = useMemo<StudentGrowth[]>(() => {
    const summaries = students.map((student) => {
      const snapshots = weeklyGpa
        .filter((record) => record.student_id === student.id && record.school_year === activeYear)
        .sort(sortSnapshots); // descending: latest first

      const latest = snapshots[0] ?? null;
      const previous = snapshots[1] ?? null;
      const change = latest && previous ? Number(latest.gpa) - Number(previous.gpa) : null;

      const name = student.preferred_name || student.first_name;
      let callout = '';

      if (snapshots.length < 2) {
        callout = snapshots.length === 1
          ? `${name}'s first GPA on record this year.`
          : `No GPA data yet for ${name}.`;
      } else {
        // Streak detection — reverse to chronological order (oldest first)
        const chrono = [...snapshots].reverse();
        const n = chrono.length;
        const latestDir =
          Number(chrono[n - 1].gpa) > Number(chrono[n - 2].gpa) ? 'up' :
          Number(chrono[n - 1].gpa) < Number(chrono[n - 2].gpa) ? 'down' : 'flat';

        let streak = 1;
        if (latestDir !== 'flat') {
          for (let i = n - 2; i > 0; i--) {
            const dir =
              Number(chrono[i].gpa) > Number(chrono[i - 1].gpa) ? 'up' :
              Number(chrono[i].gpa) < Number(chrono[i - 1].gpa) ? 'down' : 'flat';
            if (dir === latestDir) streak++;
            else break;
          }
        }

        // All grade rows for this student this year
        const studentAllGrades = weeklyGrades.filter(
          (g) => g.student_id === student.id && g.school_year === activeYear
        );
        const latestWeek = latest!.week_number;
        const currentGrades = studentAllGrades.filter((g) => g.week_number === latestWeek);
        const prevGrades = studentAllGrades.filter((g) => g.week_number === latestWeek - 1);

        const toPoints = (row: WeeklyClassGrade): number | null => {
          if (row.grade_points != null) return row.grade_points;
          const parsed = parseFloat(row.grade ?? '');
          return Number.isFinite(parsed) ? parsed : null;
        };

        // Week-over-week comparison across all classes
        const comparisons: { subject: string; delta: number }[] = [];
        currentGrades.forEach((row) => {
          const cls = classes.find((c) => c.id === row.class_id);
          const subjectName = cls?.subject || cls?.name;
          if (!subjectName) return;
          const rowPoints = toPoints(row);
          if (rowPoints == null) return;
          const prevRow = prevGrades.find((p) => p.class_id === row.class_id);
          const prevPoints = prevRow ? toPoints(prevRow) : null;
          if (prevPoints == null) return;
          comparisons.push({ subject: subjectName, delta: rowPoints - prevPoints });
        });

        const improved = comparisons.filter((c) => c.delta > 0);
        const declined = comparisons.filter((c) => c.delta < 0);
        const total = comparisons.length;
        const worstSubject = [...declined].sort((a, b) => a.delta - b.delta)[0]?.subject ?? '';
        const bestSubject = [...improved].sort((a, b) => b.delta - a.delta)[0]?.subject ?? '';

        // Per-class multi-week trend detection (requires 3+ data points = 2+ consecutive same-direction changes)
        const uniqueClassIds = [...new Set(studentAllGrades.map((g) => g.class_id))];
        const classTrends: { subject: string; direction: 'up' | 'down'; streak: number }[] = [];

        uniqueClassIds.forEach((classId) => {
          const cls = classes.find((c) => c.id === classId);
          const subjectName = cls?.subject || cls?.name;
          if (!subjectName) return;

          const history = studentAllGrades
            .filter((g) => g.class_id === classId)
            .sort((a, b) => a.week_number - b.week_number);

          if (history.length < 3) return;

          const n = history.length;
          const p1 = toPoints(history[n - 1]);
          const p2 = toPoints(history[n - 2]);
          if (p1 == null || p2 == null) return;

          const dir: 'up' | 'down' | null = p1 > p2 ? 'up' : p1 < p2 ? 'down' : null;
          if (!dir) return;

          let trendStreak = 1;
          for (let i = n - 2; i > 0; i--) {
            const cur = toPoints(history[i]);
            const prev = toPoints(history[i - 1]);
            if (cur == null || prev == null) break;
            const d = cur > prev ? 'up' : cur < prev ? 'down' : null;
            if (d === dir) trendStreak++;
            else break;
          }

          if (trendStreak >= 2) {
            classTrends.push({ subject: subjectName, direction: dir, streak: trendStreak });
          }
        });

        const topClassTrend = [...classTrends].sort((a, b) => b.streak - a.streak)[0] ?? null;
        const gpaDelta = Number(latest!.gpa) - Number(previous!.gpa);

        // Priority order:
        // 1. Every class moved the same direction this week (strongest immediate signal)
        // 2. GPA-level streak ≥ 3
        // 3. A specific class has been trending 2+ weeks
        // 4. Majority of classes moved / single subject driver
        // 5. GPA streak = 2
        // 6. Generic fallbacks
        if (total > 0 && declined.length === total) {
          callout = `${name}'s grades dropped in every class this week.`;
        } else if (total > 0 && improved.length === total) {
          callout = `${name} improved in every class this week.`;
        } else if (streak >= 3) {
          callout = latestDir === 'up'
            ? `${name} is on a ${streak}-week growth streak.`
            : `${name} has dropped for ${streak} weeks in a row.`;
        } else if (topClassTrend) {
          callout = topClassTrend.direction === 'up'
            ? `${name} has been building in ${topClassTrend.subject} for ${topClassTrend.streak} weeks.`
            : `${name} has been slipping in ${topClassTrend.subject} for ${topClassTrend.streak} weeks.`;
        } else if (gpaDelta > 0.05 && total > 0) {
          if (improved.length > total / 2)
            callout = `${name} improved in ${improved.length} of ${total} classes this week.`;
          else if (bestSubject)
            callout = `${name} had a strong week in ${bestSubject}.`;
          else
            callout = `${name} bounced back this week.`;
        } else if (gpaDelta < -0.05 && total > 0) {
          if (declined.length > total / 2)
            callout = `${name} dropped in ${declined.length} of ${total} classes this week.`;
          else if (worstSubject)
            callout = `${name} dropped this week — ${worstSubject} is worth a look.`;
          else
            callout = `${name}'s GPA dipped this week.`;
        } else if (total > 0 && improved.length > 0 && declined.length > 0) {
          callout = bestSubject && worstSubject
            ? `${name} had a mixed week — gains in ${bestSubject} offset a drop in ${worstSubject}.`
            : `${name} had a mixed week across classes.`;
        } else if (streak === 2) {
          callout = latestDir === 'up'
            ? `${name} is trending up two weeks in a row.`
            : `${name} has dropped two weeks in a row — worth a check-in.`;
        } else if (gpaDelta > 0.05) {
          callout = `${name} bounced back this week.`;
        } else if (gpaDelta < -0.05) {
          callout = `${name}'s GPA dipped this week.`;
        } else {
          callout = `${name}'s GPA held steady this week.`;
        }
      }

      return {
        ...student,
        latestGpa: latest ? Number(latest.gpa) : null,
        previousGpa: previous ? Number(previous.gpa) : null,
        change,
        callout,
        isTopGrower: false,
        history: snapshots
          .slice(0, 6)
          .sort((a, b) => a.week_number - b.week_number)
          .map((snapshot) => ({ week_number: snapshot.week_number, gpa: Number(snapshot.gpa) }))
      };
    });

    // Mark the single student with the highest positive change this week
    const maxChange = Math.max(...summaries.filter((s) => (s.change ?? 0) > 0).map((s) => s.change as number));
    if (Number.isFinite(maxChange) && maxChange > 0) {
      const topIdx = summaries.findIndex((s) => s.change === maxChange);
      if (topIdx !== -1) summaries[topIdx] = { ...summaries[topIdx], isTopGrower: true };
    }

    return summaries;
  }, [students, weeklyGpa, weeklyGrades, classes, activeYear]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <div className="flex min-h-screen items-center justify-center px-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-sm font-medium text-slate-700">Loading dashboard data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="text-xs uppercase tracking-[0.28em] text-slate-700">The Kitchen Table</div>
          <div className="flex flex-1 items-center justify-center gap-3 text-sm font-medium text-slate-900">
            <span>{school?.name ?? defaultSchool.name}</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setAccountSettingsOpen((prev) => !prev)}
              className="flex items-center gap-1 text-sm text-slate-500 underline-offset-2 transition hover:text-slate-700 hover:underline"
            >
              {user.email ?? 'Advisor'}
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {accountSettingsOpen ? (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/20"
            onClick={() => setAccountSettingsOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 z-40 flex w-96 flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900">Account settings</h2>
              <button
                type="button"
                onClick={() => setAccountSettingsOpen(false)}
                className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
              <div>
                <label htmlFor="account-full-name" className="block text-sm font-medium text-slate-700">
                  Full name
                </label>
                <input
                  id="account-full-name"
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="mt-1 block w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none"
                />
              </div>
              <div>
                <p className="block text-sm font-medium text-slate-700">Email</p>
                <p className="mt-1 text-sm text-slate-500">{user.email}</p>
              </div>
              <div>
                <label htmlFor="account-school-state" className="block text-sm font-medium text-slate-700">
                  School state
                </label>
                <select
                  id="account-school-state"
                  value={schoolState}
                  onChange={(event) => setSchoolState(event.target.value)}
                  className="mt-1 block w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none"
                >
                  <option value="">Select state</option>
                  {stateOptions.map((code) => (
                    <option key={code} value={code}>{code}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="account-new-password" className="block text-sm font-medium text-slate-700">
                  New password
                </label>
                <input
                  id="account-new-password"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Leave blank to keep current"
                  className="mt-1 block w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="account-confirm-password" className="block text-sm font-medium text-slate-700">
                  Confirm password
                </label>
                <input
                  id="account-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="mt-1 block w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none"
                />
              </div>
              {accountError ? (
                <p className="text-sm text-rose-700">{accountError}</p>
              ) : null}
            </div>
            <div className="flex items-center gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={handleSaveAccountSettings}
                disabled={savingAccount}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingAccount ? 'Saving…' : 'Save changes'}
              </button>
              <button
                type="button"
                onClick={handleCancelAccountSettings}
                disabled={savingAccount}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      ) : null}

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="pb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">The Kitchen Table</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Advisor dashboard</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">Monitor advisory classes, student progress, weekly attendance, and GPA snapshots.</p>
        </div>

        {advisoryClasses.length > 1 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {advisoryClasses.map((cls) => (
              <button
                key={cls.id}
                type="button"
                onClick={() => {
                  setSelectedClassId(cls.id);
                  setPanelMode('none');
                  setEditingStudent(null);
                }}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  selectedClassId === cls.id
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {cls.name}
              </button>
            ))}
          </div>
        )}

        {error ? (
          <div className="mb-6 rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl bg-slate-900 p-6 text-white shadow-sm">
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Advisory class</p>
            <h2 className="mt-4 text-2xl font-semibold">{advisoryClass?.name ?? defaultClass.name}</h2>
          </div>
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Students</p>
            <p className="mt-4 text-3xl font-semibold text-slate-900">{students.length}</p>
            <p className="mt-2 text-sm text-slate-600">Roster count for this advisory class.</p>
          </div>
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Classes</p>
            <p className="mt-4 text-3xl font-semibold text-slate-900">{classes.length}</p>
            <p className="mt-2 text-sm text-slate-600">Active homeroom classes this semester.</p>
          </div>
        </section>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setPanelMode('entry')}
            className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Enter This Week's Data
          </button>
          <button
            type="button"
            onClick={() => handleOpenStudentEditor(null)}
            className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
          >
            Add Student
          </button>
          {panelMode === 'entry' ? (
            <span className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-600">You are in weekly entry mode.</span>
          ) : panelMode === 'students' ? (
            <span className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-600">Editing student roster.</span>
          ) : null}
        </div>

        {panelMode === 'entry' && school && advisoryClass ? (
          <div className="mt-6">
            <WeeklyDataEntry
              advisoryClass={advisoryClass}
              school={school}
              students={students}
              classes={classes}
              weeklyGpa={weeklyGpa}
              weeklyAttendance={weeklyAttendance}
              weeklyGrades={weeklyGrades}
              activeYear={activeYear}
              onWeeklyDataSaved={handleWeeklyDataSaved}
              onClose={() => setPanelMode('none')}
            />
          </div>
        ) : null}

        {panelMode === 'students' && school ? (
          <div className="mt-6">
            <StudentEditor
              advisoryClass={advisoryClass}
              schoolId={school.id}
              studentToEdit={editingStudent}
              onClose={handleCloseStudentEditor}
              onSaved={handleStudentSaved}
            />
          </div>
        ) : null}

        <section className="mt-8 grid gap-4 xl:grid-cols-2">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Class GPA</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">Semester trend</h2>
              </div>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.26em] text-slate-600">{activeYear || 'No year'}</span>
            </div>

            <div className="mt-6 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={gpaChartData}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                  <XAxis dataKey="week_number" tickFormatter={(value) => `W${value}`} />
                  <YAxis domain={[0, 4]} />
                  <Tooltip formatter={(value: any) => (typeof value === 'number' ? value.toFixed(2) : value)} />
                  <Line
                    type="monotone"
                    dataKey="avg_gpa"
                    stroke="#0f766e"
                    strokeWidth={3}
                    dot={(props) => <AnimatedDot {...props} highlightWeek={latestGpaWeek} />}
                    activeDot={{ r: 8 }}
                    connectNulls={false}
                    isAnimationActive={true}
                    name="Avg GPA"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Class absences</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">Average weekly absences</h2>
              </div>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.26em] text-slate-600">Semester width</span>
            </div>

            <div className="mt-6 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={attendanceChartData}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                  <XAxis dataKey="week_number" tickFormatter={(value) => `W${value}`} />
                  <YAxis allowDecimals={false} />
                  <Tooltip formatter={(value: any) => (typeof value === 'number' ? value.toFixed(2) : value)} />
                  <Line
                    type="monotone"
                    dataKey="avg_absences"
                    stroke="#be123c"
                    strokeWidth={3}
                    dot={(props) => <AnimatedDot {...props} highlightWeek={latestAttendanceWeek} />}
                    activeDot={{ r: 8 }}
                    connectNulls={false}
                    isAnimationActive={true}
                    name="Avg absences"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Student growth</h2>
              <p className="mt-2 text-sm text-slate-500">Latest GPA change and recent history for each student in this advisory.</p>
            </div>
          </div>

          <div className="space-y-4">
            {studentSummaries.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
                No students found for this advisory class.
              </div>
            ) : (
              studentSummaries.map((student) => (
                <div key={student.id} className={`rounded-3xl border-2 p-4 shadow-sm ${student.isTopGrower ? 'border-amber-400 bg-gradient-to-br from-amber-50 to-yellow-50 ring-2 ring-amber-200' : `border-slate-200 ${growthBackground(student.change)}`}`}>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <Link to={`/student/${student.id}`} className="text-lg font-semibold text-slate-900 hover:text-slate-700">
                          {student.preferred_name || student.first_name} {student.last_name}
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleOpenStudentEditor(student)}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        {student.isTopGrower && (
                          <span className="rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                            Top grower
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        {student.student_id_external ?? 'No external ID'}
                        {student.grade_level ? ` · Grade ${student.grade_level}` : ''}
                      </p>
                    </div>
                    <div className="space-y-1 text-right">
                      <p className="text-sm text-slate-500">Latest GPA</p>
                      <p className="text-2xl font-semibold text-slate-900">{student.latestGpa?.toFixed(2) ?? '—'}</p>
                      <p className={`text-sm font-semibold ${student.change === null ? 'text-slate-500' : student.change > 0 ? 'text-emerald-700' : student.change < 0 ? 'text-rose-700' : 'text-slate-500'}`}>
                        {student.change === null
                          ? 'No prior data'
                          : student.change > 0
                          ? `+${student.change.toFixed(2)} vs last week`
                          : student.change < 0
                          ? `${student.change.toFixed(2)} vs last week`
                          : 'No change'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <p className="text-sm italic text-slate-600">{student.callout}</p>
                  </div>
                  {(() => {
                    const a = selfAssessments.find(
                      (s) => s.student_id === student.id && s.school_year === activeYear && s.week_number === latestGpaWeek
                    );
                    if (!a) return (
                      <p className="mt-2 text-xs text-slate-400">No check-in yet</p>
                    );
                    const academic = a.academic_self_assessment;
                    const academicChip = academic === 'better'
                      ? { label: '↑ Better', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' }
                      : academic === 'same'
                        ? { label: '→ Same', cls: 'bg-amber-100 text-amber-800 border-amber-200' }
                        : { label: '↓ Tough week', cls: 'bg-rose-100 text-rose-800 border-rose-200' };
                    return (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${academicChip.cls}`}>
                          {academicChip.label}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                          Effort: {a.effort_rating}/5
                        </span>
                      </div>
                    );
                  })()}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
