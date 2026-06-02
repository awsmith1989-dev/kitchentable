import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Line, LineChart, ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import AnimatedDot from './AnimatedDot';
import StudentEditor from './StudentEditor';
import WeeklyDataEntry from './WeeklyDataEntry';
import { AdvisoryClass, ClassRecord, School, Student, WeeklyAttendance, WeeklyClassGrade, WeeklyGpaSnapshot } from '../lib/types';

interface TeacherDashboardProps {
  user: User;
}

interface StudentGrowth extends Student {
  latestGpa: number | null;
  previousGpa: number | null;
  change: number | null;
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


const sortSnapshots = (a: WeeklyGpaSnapshot, b: WeeklyGpaSnapshot) => {
  if (a.school_year !== b.school_year) return b.school_year.localeCompare(a.school_year);
  return b.week_number - a.week_number;
};

export default function TeacherDashboard({ user }: TeacherDashboardProps) {
  const [school, setSchool] = useState<School | null>(null);
  const [advisoryClass, setAdvisoryClass] = useState<AdvisoryClass | null>(null);
  const [students, setStudents] = useState<Student[]>(defaultStudentList);
  const [classes, setClasses] = useState<ClassRecord[]>(defaultClassList);
  const [weeklyGpa, setWeeklyGpa] = useState<WeeklyGpaSnapshot[]>(defaultGpaList);
  const [weeklyAttendance, setWeeklyAttendance] = useState<WeeklyAttendance[]>(defaultAttendanceList);
  const [weeklyGrades, setWeeklyGrades] = useState<WeeklyClassGrade[]>([]);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: advisoryData, error: advisoryError } = await supabase
          .from('advisory_classes')
          .select('*')
          .eq('teacher_id', user.id)
          .limit(1)
          .single();

        if (advisoryError) {
          throw advisoryError;
        }

        if (!advisoryData) {
          throw new Error('No advisory class found for this teacher.');
        }

        setAdvisoryClass(advisoryData as AdvisoryClass);

        const [schoolResponse, studentsResponse, classesResponse] = await Promise.all([
          supabase.from('schools').select('*').eq('id', advisoryData.school_id).single(),
          supabase.from('students').select('*').eq('advisory_class_id', advisoryData.id),
          supabase.from('classes').select('*').eq('advisory_class_id', advisoryData.id)
        ]);

        if (schoolResponse.error) throw schoolResponse.error;
        if (studentsResponse.error) throw studentsResponse.error;
        if (classesResponse.error) throw classesResponse.error;

        if (schoolResponse.data) setSchool(schoolResponse.data as School);
        setStudents((studentsResponse.data ?? []) as Student[]);
        setClasses((classesResponse.data ?? []) as ClassRecord[]);

        const studentIds = (studentsResponse.data ?? []).map((student) => student.id);

        if (studentIds.length > 0) {
          const [gpaResponse, attendanceResponse, gradesResponse] = await Promise.all([
            supabase.from('weekly_gpa_snapshots').select('*').in('student_id', studentIds),
            supabase.from('weekly_attendance').select('*').in('student_id', studentIds),
            supabase.from('weekly_class_grades').select('*').in('student_id', studentIds)
          ]);

          if (gpaResponse.error) throw gpaResponse.error;
          if (attendanceResponse.error) throw attendanceResponse.error;
          if (gradesResponse.error) throw gradesResponse.error;

          setWeeklyGpa((gpaResponse.data ?? []) as WeeklyGpaSnapshot[]);
          setWeeklyAttendance((attendanceResponse.data ?? []) as WeeklyAttendance[]);
          setWeeklyGrades((gradesResponse.data ?? []) as WeeklyClassGrade[]);
        } else {
          setWeeklyGpa(defaultGpaList);
          setWeeklyAttendance(defaultAttendanceList);
          setWeeklyGrades([]);
        }
      } catch (err: any) {
        setError(err.message || 'Unable to load dashboard data.');
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [user.id]);

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
    return students.map((student) => {
      const snapshots = weeklyGpa
        .filter((record) => record.student_id === student.id && record.school_year === activeYear)
        .sort(sortSnapshots);

      const latest = snapshots[0] ?? null;
      const previous = snapshots[1] ?? null;
      const change = latest && previous ? Number(latest.gpa) - Number(previous.gpa) : null;

      return {
        ...student,
        latestGpa: latest ? Number(latest.gpa) : null,
        previousGpa: previous ? Number(previous.gpa) : null,
        change,
        history: snapshots
          .slice(0, 6)
          .sort((a, b) => a.week_number - b.week_number)
          .map((snapshot) => ({ week_number: snapshot.week_number, gpa: Number(snapshot.gpa) }))
      };
    });
  }, [students, weeklyGpa, activeYear]);

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
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">The Kitchen Table</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Advisor dashboard</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">Monitor advisory classes, student progress, weekly attendance, and GPA snapshots.</p>
          </div>
          <div className="flex flex-col gap-4 sm:items-end">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Active school</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{school?.name ?? defaultSchool.name}</p>
              <p className="text-sm text-slate-500">{school?.district ?? ''} · {semesterWeeks} weeks</p>
            </div>
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Signed in as</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{user.email ?? 'Advisor'}</p>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        {error ? (
          <div className="mb-6 rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl bg-slate-900 p-6 text-white shadow-sm">
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Advisory class</p>
            <h2 className="mt-4 text-2xl font-semibold">{advisoryClass?.name ?? defaultClass.name}</h2>
            <p className="mt-2 text-sm text-slate-300">Grade {advisoryClass?.grade_level ?? '--'} · {classes.length} classes</p>
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
                <div key={student.id} className={`rounded-3xl border border-slate-200 p-4 shadow-sm ${growthBackground(student.change)}`}>
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

                  <div className="mt-4 flex flex-wrap gap-2 text-sm">
                    {student.history.length > 0 ? (
                      student.history.map((entry) => (
                        <span key={`${student.id}-${entry.week_number}`} className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                          W{entry.week_number}: {entry.gpa.toFixed(2)}
                        </span>
                      ))
                    ) : (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">No GPA history</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
