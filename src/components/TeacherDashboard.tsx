import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Line, LineChart, ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import AnimatedDot from './AnimatedDot';
import StudentEditor from './StudentEditor';
import WeeklyDataEntry from './WeeklyDataEntry';
import { AdvisoryClass, ClassRecord, School, SelfAssessment, Student, StudentCareerFavorite, StudentShoutout, Teacher, WeeklyAttendance, WeeklyClassGrade, WeeklyGpaSnapshot } from '../lib/types';
import ShoutoutModal from './ShoutoutModal';

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
  favorites: StudentCareerFavorite[];
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

const growthBackground = (change: number | null, index: number) => {
  if (change !== null && change > 0) return 'bg-[var(--color-green-highlight)]';
  if (change !== null && change < 0) return 'bg-[var(--color-red-highlight)]';
  return index % 2 === 0 ? '' : 'bg-[var(--color-card-tint)]';
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

const chartColors = {
  grid: 'var(--color-border)',
  axis: 'var(--color-text-muted)',
  tooltipBg: 'var(--color-card)',
  tooltipBorder: 'var(--color-border)',
  tooltipText: 'var(--color-text-primary)',
  tooltipItem: 'var(--color-text-secondary)',
};

const acctInputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  borderRadius: '1rem',
  border: '1px solid var(--color-border)',
  background: 'var(--color-card)',
  padding: '0.5rem 0.75rem',
  fontSize: '0.875rem',
  color: 'var(--color-text-primary)',
  marginTop: '0.25rem',
  outline: 'none',
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
  const [studentEditorOpen, setStudentEditorOpen] = useState(false);
  const [shoutoutTarget, setShoutoutTarget] = useState<Student | null>(null);
  const [openCheckins, setOpenCheckins] = useState<Set<string>>(new Set());
  const [shoutouts, setShoutouts] = useState<StudentShoutout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [advisoryClasses, setAdvisoryClasses] = useState<AdvisoryClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selfAssessments, setSelfAssessments] = useState<SelfAssessment[]>([]);
  const [studentFavorites, setStudentFavorites] = useState<Map<string, StudentCareerFavorite[]>>(new Map());

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

        setSelectedClassId(allAdvisoryClasses[0].id);
      } catch (err: any) {
        setError(err.message || 'Unable to load dashboard data.');
        setLoading(false);
      }
    };
    loadInitial();
  }, [user.id]);

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
          const [gpaResponse, attendanceResponse, gradesResponse, assessmentsResponse, shoutoutsResponse, favoritesResponse] = await Promise.all([
            supabase.from('weekly_gpa_snapshots').select('*').in('student_id', studentIds),
            supabase.from('weekly_attendance').select('*').in('student_id', studentIds),
            supabase.from('weekly_class_grades').select('*').in('student_id', studentIds),
            supabase.from('student_self_assessments').select('*').in('student_id', studentIds),
            supabase.from('student_shoutouts').select('*').in('student_id', studentIds).order('created_at', { ascending: false }),
            supabase.from('student_career_favorites').select('*').in('student_id', studentIds).order('favorited_at', { ascending: true }),
          ]);

          if (gpaResponse.error) throw gpaResponse.error;
          if (attendanceResponse.error) throw attendanceResponse.error;
          if (gradesResponse.error) throw gradesResponse.error;

          setWeeklyGpa((gpaResponse.data ?? []) as WeeklyGpaSnapshot[]);
          setWeeklyAttendance((attendanceResponse.data ?? []) as WeeklyAttendance[]);
          setWeeklyGrades((gradesResponse.data ?? []) as WeeklyClassGrade[]);
          setSelfAssessments((assessmentsResponse.data ?? []) as SelfAssessment[]);
          setShoutouts((shoutoutsResponse.data ?? []) as StudentShoutout[]);

          const favMap = new Map<string, StudentCareerFavorite[]>();
          for (const fav of (favoritesResponse.data ?? []) as StudentCareerFavorite[]) {
            const arr = favMap.get(fav.student_id) ?? [];
            arr.push(fav);
            favMap.set(fav.student_id, arr);
          }
          setStudentFavorites(favMap);
        } else {
          setWeeklyGpa(defaultGpaList);
          setWeeklyAttendance(defaultAttendanceList);
          setWeeklyGrades([]);
          setSelfAssessments([]);
          setShoutouts([]);
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

        if (teacherError) throw teacherError;
        if (teacherData) setTeacher(teacherData as Teacher);
      }

      if (schoolState !== (school.state ?? '')) {
        const { data: schoolData, error: schoolError } = await supabase
          .from('schools')
          .update({ state: schoolState })
          .eq('id', school.id)
          .maybeSingle();

        if (schoolError) throw schoolError;
        if (schoolData) setSchool(schoolData as School);
      }

      if (newPassword) {
        const { error: authError } = await supabase.auth.updateUser({ password: newPassword });
        if (authError) throw authError;
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

  const [panelMode, setPanelMode] = useState<'none' | 'entry'>('none');

  const handleOpenStudentEditor = (student: Student | null = null) => {
    setEditingStudent(student);
    setStudentEditorOpen(true);
  };

  const handleCloseStudentEditor = () => {
    setEditingStudent(null);
    setStudentEditorOpen(false);
  };

  const handleStudentSaved = (student: Student) => {
    setStudents((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === student.id);
      if (existingIndex >= 0) {
        return prev.map((item) => (item.id === student.id ? student : item));
      }
      return [student, ...prev];
    });
    setStudentEditorOpen(false);
    setEditingStudent(null);
  };

  const handleShoutoutSaved = (shoutout: StudentShoutout) => {
    setShoutouts((prev) => [shoutout, ...prev]);
    setShoutoutTarget(null);
  };

  const toggleCheckin = (id: string) => {
    setOpenCheckins((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
        .sort(sortSnapshots);

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

          if (trendStreak >= 2) classTrends.push({ subject: subjectName, direction: dir, streak: trendStreak });
        });

        const topClassTrend = [...classTrends].sort((a, b) => b.streak - a.streak)[0] ?? null;
        const gpaDelta = Number(latest!.gpa) - Number(previous!.gpa);

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
        favorites: studentFavorites.get(student.id) ?? [],
        history: snapshots
          .slice(0, 6)
          .sort((a, b) => a.week_number - b.week_number)
          .map((snapshot) => ({ week_number: snapshot.week_number, gpa: Number(snapshot.gpa) }))
      };
    });

    const maxChange = Math.max(...summaries.filter((s) => (s.change ?? 0) > 0).map((s) => s.change as number));
    if (Number.isFinite(maxChange) && maxChange > 0) {
      const topIdx = summaries.findIndex((s) => s.change === maxChange);
      if (topIdx !== -1) summaries[topIdx] = { ...summaries[topIdx], isTopGrower: true };
    }

    return summaries;
  }, [students, weeklyGpa, weeklyGrades, classes, activeYear, studentFavorites]);

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
        <div className="flex min-h-screen items-center justify-center px-4">
          <div className="rounded-3xl p-8 shadow-sm" style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Loading dashboard data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      {/* ── Header ── */}
      <header className="sticky top-0 z-20 shadow-sm" style={{ background: 'var(--color-nav-bg)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <img src="/Logo/PerchEd%20Logo%20Design-clear.png" alt="PerchEd" style={{ height: 22, width: 'auto', objectFit: 'contain' }} />
          <div className="flex flex-1 items-center justify-center gap-3 text-sm font-medium text-white">
            <span>{school?.name ?? defaultSchool.name}</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setAccountSettingsOpen((prev) => !prev)}
              className="flex items-center gap-1 text-sm transition"
              style={{ color: 'rgba(255,255,255,0.8)' }}
            >
              {user.email ?? 'Advisor'}
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-full px-4 py-2 text-sm font-semibold text-white transition"
              style={{ border: '1px solid rgba(255,255,255,0.35)' }}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* ── Account settings panel ── */}
      {accountSettingsOpen ? (
        <>
          <div className="fixed inset-0 z-30 bg-black/20" onClick={() => setAccountSettingsOpen(false)} />
          <div className="fixed inset-y-0 right-0 z-40 flex w-96 flex-col shadow-xl" style={{ background: 'var(--color-card)' }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Account settings</h2>
              <button
                type="button"
                onClick={() => setAccountSettingsOpen(false)}
                className="rounded-full p-1 transition"
                style={{ color: 'var(--color-text-muted)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-card-tint)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
              <div>
                <label htmlFor="account-full-name" className="block text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Full name</label>
                <input
                  id="account-full-name"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={acctInputStyle}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--color-primary)'; e.target.style.boxShadow = '0 0 0 2px rgba(28,125,107,0.15)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
              <div>
                <p className="block text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Email</p>
                <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>{user.email}</p>
              </div>
              <div>
                <label htmlFor="account-school-state" className="block text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>School state</label>
                <select
                  id="account-school-state"
                  value={schoolState}
                  onChange={(e) => setSchoolState(e.target.value)}
                  style={acctInputStyle}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--color-primary)'; e.target.style.boxShadow = '0 0 0 2px rgba(28,125,107,0.15)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none'; }}
                >
                  <option value="">Select state</option>
                  {stateOptions.map((code) => (
                    <option key={code} value={code}>{code}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="account-new-password" className="block text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>New password</label>
                <input
                  id="account-new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Leave blank to keep current"
                  style={acctInputStyle}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--color-primary)'; e.target.style.boxShadow = '0 0 0 2px rgba(28,125,107,0.15)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
              <div>
                <label htmlFor="account-confirm-password" className="block text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Confirm password</label>
                <input
                  id="account-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={acctInputStyle}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--color-primary)'; e.target.style.boxShadow = '0 0 0 2px rgba(28,125,107,0.15)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
              {accountError ? (
                <p className="text-sm text-rose-700">{accountError}</p>
              ) : null}
            </div>
            <div className="flex items-center gap-3 px-6 py-4" style={{ borderTop: '1px solid var(--color-border)' }}>
              <button
                type="button"
                onClick={handleSaveAccountSettings}
                disabled={savingAccount}
                className="rounded-full px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                style={{ background: 'var(--color-primary)' }}
              >
                {savingAccount ? 'Saving…' : 'Save changes'}
              </button>
              <button
                type="button"
                onClick={handleCancelAccountSettings}
                disabled={savingAccount}
                className="rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                style={{ border: '1px solid var(--color-border)', background: 'var(--color-card)', color: 'var(--color-text-secondary)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      ) : null}

      {/* ── Main content ── */}
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="pb-6">
          <img src="/Logo/PerchEd%20Logo%20Design-clear.png" alt="PerchEd" style={{ height: 20, width: 'auto', objectFit: 'contain' }} />
          <div className="mt-2 flex items-center gap-3">
            <img
              src="/mascots/mascot-desk.png"
              alt=""
              aria-hidden="true"
              style={{ width: 48, height: 48, objectFit: 'contain', mixBlendMode: 'multiply', flexShrink: 0 }}
            />
            <h1 className="text-3xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>Advisor dashboard</h1>
          </div>
          <p className="mt-1 max-w-2xl text-sm" style={{ color: 'var(--color-text-secondary)' }}>Monitor advisory classes, student progress, weekly attendance, and GPA snapshots.</p>
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
                className="rounded-full px-4 py-2 text-sm font-semibold transition"
                style={
                  selectedClassId === cls.id
                    ? { background: 'var(--color-primary)', color: '#ffffff' }
                    : { border: '1px solid var(--color-border)', background: 'var(--color-card)', color: 'var(--color-text-secondary)' }
                }
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
          <div className="rounded-3xl p-6 text-white shadow-sm" style={{ background: 'var(--color-primary-dark)' }}>
            <p className="text-sm uppercase tracking-[0.3em]" style={{ color: 'rgba(255,255,255,0.6)' }}>Advisory class</p>
            <h2 className="mt-4 text-2xl font-semibold">{advisoryClass?.name ?? defaultClass.name}</h2>
          </div>
          <div className="rounded-3xl p-6 shadow-sm" style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
            <p className="text-sm uppercase tracking-[0.3em]" style={{ color: 'var(--color-text-muted)' }}>Students</p>
            <p className="mt-4 text-3xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>{students.length}</p>
            <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>Roster count for this advisory class.</p>
          </div>
          <div className="rounded-3xl p-6 shadow-sm" style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
            <p className="text-sm uppercase tracking-[0.3em]" style={{ color: 'var(--color-text-muted)' }}>Classes</p>
            <p className="mt-4 text-3xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>{classes.length}</p>
            <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>Active homeroom classes this semester.</p>
          </div>
        </section>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setPanelMode('entry')}
            className="rounded-full px-5 py-3 text-sm font-semibold text-white transition"
            style={{ background: 'var(--color-primary)' }}
          >
            Enter This Week's Data
          </button>
          <button
            type="button"
            onClick={() => handleOpenStudentEditor(null)}
            className="rounded-full px-5 py-3 text-sm font-semibold transition"
            style={{ border: '1px solid var(--color-border)', background: 'var(--color-card)', color: 'var(--color-text-secondary)' }}
          >
            Add Student
          </button>
          {panelMode === 'entry' && (
            <span className="rounded-full px-4 py-2 text-sm" style={{ background: 'var(--color-card-tint)', color: 'var(--color-text-secondary)' }}>
              You are in weekly entry mode.
            </span>
          )}
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

        {/* ── Charts ── */}
        <section className="mt-8 grid gap-4 xl:grid-cols-2">
          <div className="rounded-3xl p-6 shadow-sm" style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.3em]" style={{ color: 'var(--color-text-muted)' }}>Class GPA</p>
                <h2 className="mt-2 text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>Semester trend</h2>
              </div>
              <span
                className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.26em]"
                style={{ background: 'var(--color-card-tint)', color: 'var(--color-text-secondary)' }}
              >
                {activeYear || 'No year'}
              </span>
            </div>
            <div className="mt-6 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={gpaChartData}>
                  <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="week_number" tickFormatter={(v) => `W${v}`} tick={{ fill: chartColors.axis, fontSize: 12 }} />
                  <YAxis domain={[0, 4]} tick={{ fill: chartColors.axis, fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: any) => (typeof value === 'number' ? value.toFixed(2) : value)}
                    contentStyle={{ backgroundColor: chartColors.tooltipBg, borderColor: chartColors.tooltipBorder, color: chartColors.tooltipText, borderRadius: 12 }}
                    labelStyle={{ color: chartColors.tooltipText }}
                    itemStyle={{ color: chartColors.tooltipItem }}
                  />
                  <Line
                    type="monotone"
                    dataKey="avg_gpa"
                    stroke="var(--color-primary)"
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

          <div className="rounded-3xl p-6 shadow-sm" style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.3em]" style={{ color: 'var(--color-text-muted)' }}>Class absences</p>
                <h2 className="mt-2 text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>Average weekly absences</h2>
              </div>
              <span
                className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.26em]"
                style={{ background: 'var(--color-card-tint)', color: 'var(--color-text-secondary)' }}
              >
                Semester width
              </span>
            </div>
            <div className="mt-6 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={attendanceChartData}>
                  <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="week_number" tickFormatter={(v) => `W${v}`} tick={{ fill: chartColors.axis, fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fill: chartColors.axis, fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: any) => (typeof value === 'number' ? value.toFixed(2) : value)}
                    contentStyle={{ backgroundColor: chartColors.tooltipBg, borderColor: chartColors.tooltipBorder, color: chartColors.tooltipText, borderRadius: 12 }}
                    labelStyle={{ color: chartColors.tooltipText }}
                    itemStyle={{ color: chartColors.tooltipItem }}
                  />
                  <Line
                    type="monotone"
                    dataKey="avg_absences"
                    stroke="var(--color-accent)"
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

        {/* ── Student growth list ── */}
        <section className="mt-8 rounded-3xl p-6 shadow-sm" style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>Student growth</h2>
              <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>Latest GPA change and recent history for each student in this advisory.</p>
            </div>
          </div>

          <div className="space-y-4">
            {studentSummaries.length === 0 ? (
              <div className="rounded-3xl p-6 text-sm" style={{ border: '1px solid var(--color-border)', background: 'var(--color-card-tint)', color: 'var(--color-text-secondary)' }}>
                No students found for this advisory class.
              </div>
            ) : (
              studentSummaries.map((student, idx) => (
                <div
                  key={student.id}
                  className={`rounded-3xl p-4 shadow-sm ${student.isTopGrower ? 'bg-[#FFFBEB]' : growthBackground(student.change, idx)}`}
                  style={
                    student.isTopGrower
                      ? { border: '2px solid var(--color-accent)' }
                      : { border: '1px solid var(--color-border)' }
                  }
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/student/${student.id}`}
                          className="text-lg font-semibold transition"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          {student.preferred_name || student.first_name} {student.last_name}
                        </Link>
                        {student.isTopGrower && (
                          <span
                            className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                            style={{ background: 'var(--color-accent)', color: 'var(--color-accent-dark)', border: '1px solid var(--color-accent)' }}
                          >
                            Top grower
                          </span>
                        )}
                        <div className="ml-1 flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenStudentEditor(student)}
                            title="Edit student"
                            className="rounded-full p-1.5 transition"
                            style={{ border: '1px solid var(--color-border)', background: 'var(--color-card)', color: 'var(--color-text-muted)' }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-card-tint)'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-card)'; }}
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => setShoutoutTarget(student)}
                            title="Give a shoutout"
                            className="rounded-full p-1.5 transition"
                            style={{ border: '1px solid var(--color-accent)', background: 'var(--color-card)', color: 'var(--color-accent-dark)' }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#FFFBEB'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-card)'; }}
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleCheckin(student.id)}
                            title="View check-in"
                            className="rounded-full p-1.5 transition"
                            style={
                              openCheckins.has(student.id)
                                ? { border: '1px solid var(--color-primary)', background: 'var(--color-card-tint)', color: 'var(--color-primary)' }
                                : { border: '1px solid var(--color-border)', background: 'var(--color-card)', color: 'var(--color-text-muted)' }
                            }
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                        {student.student_id_external ?? 'No external ID'}
                        {student.grade_level ? ` · Grade ${student.grade_level}` : ''}
                      </p>
                    </div>
                    <div className="space-y-1 text-right">
                      <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Latest GPA</p>
                      <p className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>{student.latestGpa?.toFixed(2) ?? '—'}</p>
                      <p
                        className="text-sm font-semibold"
                        style={{
                          color: student.change === null ? 'var(--color-text-muted)'
                            : student.change > 0 ? '#1a6b50'
                            : student.change < 0 ? '#9B3535'
                            : 'var(--color-text-muted)'
                        }}
                      >
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
                    <p className="text-sm italic" style={{ color: 'var(--color-text-secondary)' }}>{student.callout}</p>
                  </div>

                  {/* Career favorites */}
                  <div className="mt-2">
                    {student.favorites.length === 0 ? (
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>No career favorites yet</p>
                    ) : (
                      <div>
                        <p className="text-xs font-semibold mb-1" style={{ color: 'var(--color-text-muted)' }}>⭐ Career interests:</p>
                        <ol className="space-y-0.5">
                          {student.favorites.map((fav, fi) => (
                            <li key={fav.id} className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                              {fi + 1}. {fav.career_title}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>

                  {openCheckins.has(student.id) && (() => {
                    const a = selfAssessments.find(
                      (s) => s.student_id === student.id && s.school_year === activeYear && s.week_number === latestGpaWeek
                    );
                    if (!a) return (
                      <p className="mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>No check-in submitted this week.</p>
                    );
                    const academic = a.academic_self_assessment;
                    const academicChip =
                      academic === 'better'
                        ? { label: '↑ Better', bg: 'var(--color-green-highlight)', color: '#1a6b50', border: '#a7f0d8' }
                        : academic === 'same'
                        ? { label: '→ Same', bg: '#FFFBEB', color: 'var(--color-accent-dark)', border: 'var(--color-accent)' }
                        : { label: '↓ Tough week', bg: 'var(--color-red-highlight)', color: '#9B3535', border: '#f5b8b8' };
                    return (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span
                          className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                          style={{ background: academicChip.bg, color: academicChip.color, border: `1px solid ${academicChip.border}` }}
                        >
                          {academicChip.label}
                        </span>
                        <span
                          className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                          style={{ background: 'var(--color-card-tint)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
                        >
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

      {studentEditorOpen && school && (
        <StudentEditor
          advisoryClass={advisoryClass}
          schoolId={school.id}
          teacherId={user.id}
          studentToEdit={editingStudent}
          onClose={handleCloseStudentEditor}
          onSaved={handleStudentSaved}
          school={school}
        />
      )}

      {shoutoutTarget && (
        <ShoutoutModal
          student={shoutoutTarget}
          teacherId={user.id}
          weekNumber={latestGpaWeek}
          schoolYear={activeYear}
          onClose={() => setShoutoutTarget(null)}
          onSaved={handleShoutoutSaved}
        />
      )}
    </div>
  );
}
