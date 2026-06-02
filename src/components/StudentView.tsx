import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Line, LineChart, ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip, ReferenceLine, Legend } from 'recharts';
import AnimatedDot from './AnimatedDot';
import AdvisorInsights from './AdvisorInsights';
import { supabase } from '../lib/supabaseClient';
import { ClassRecord, School, Student, WeeklyAttendance, WeeklyClassGrade, WeeklyGpaSnapshot } from '../lib/types';

interface GradeSeries {
  classId: string;
  subject: string;
  data: Array<{ week_number: number; grade: number | null }>;
  latestWeek: number;
}

const gradeColors = ['#0f766e', '#9333ea', '#be123c', '#d97706', '#2563eb', '#047857'];

const parseGrade = (grade: string | null, gradePoints: number | null) => {
  if (!grade && gradePoints !== null) return gradePoints;
  if (!grade) return null;
  const parsed = Number(grade);
  return Number.isFinite(parsed) ? parsed : gradePoints;
};

export default function StudentView() {
  const { id } = useParams();
  const [student, setStudent] = useState<Student | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [weeklyGpa, setWeeklyGpa] = useState<WeeklyGpaSnapshot[]>([]);
  const [weeklyGrades, setWeeklyGrades] = useState<WeeklyClassGrade[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [attendance, setAttendance] = useState<WeeklyAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadStudentView = async () => {
      if (!id) {
        setError('Student ID is missing.');
        setLoading(false);
        return;
      }

      try {
        const studentResponse = await supabase.from('students').select('*').eq('id', id).single();
        if (studentResponse.error || !studentResponse.data) {
          throw studentResponse.error ?? new Error('Student not found');
        }
        const studentRecord = studentResponse.data as Student;
        setStudent(studentRecord);

        const [schoolResponse, gpaResponse, attendanceResponse, classGradesResponse] = await Promise.all([
          supabase.from('schools').select('*').eq('id', studentRecord.school_id).single(),
          supabase.from('weekly_gpa_snapshots').select('*').eq('student_id', id),
          supabase.from('weekly_attendance').select('*').eq('student_id', id),
          supabase.from('weekly_class_grades').select('*').eq('student_id', id)
        ]);

        if (schoolResponse.error) throw schoolResponse.error;
        if (gpaResponse.error) throw gpaResponse.error;
        if (attendanceResponse.error) throw attendanceResponse.error;
        if (classGradesResponse.error) throw classGradesResponse.error;

        if (schoolResponse.data) setSchool(schoolResponse.data as School);
        setWeeklyGpa((gpaResponse.data ?? []) as WeeklyGpaSnapshot[]);
        setAttendance((attendanceResponse.data ?? []) as WeeklyAttendance[]);
        setWeeklyGrades((classGradesResponse.data ?? []) as WeeklyClassGrade[]);

        const classIds = Array.from(new Set((classGradesResponse.data ?? []).map((row: any) => row.class_id)));
        if (classIds.length > 0) {
          const classResponse = await supabase.from('classes').select('*').in('id', classIds);
          if (classResponse.error) throw classResponse.error;
          setClasses((classResponse.data ?? []) as ClassRecord[]);
        }
      } catch (err: any) {
        setError(err.message ?? 'Unable to load student data.');
      } finally {
        setLoading(false);
      }
    };

    loadStudentView();
  }, [id]);

  const semesterWeeks = school?.semester_weeks ?? 18;

  const activeYear = useMemo(() => {
    const years = new Set<string>([...weeklyGpa, ...attendance].map((row) => row.school_year));
    const sorted = Array.from(years).sort();
    return sorted.pop() ?? '';
  }, [weeklyGpa, attendance]);

  const studentGpaSeries = useMemo(() => {
    const weekMap = new Map<number, number>();
    weeklyGpa
      .filter((row) => row.school_year === activeYear)
      .forEach((row) => {
        weekMap.set(row.week_number, Number(row.gpa));
      });
    return Array.from({ length: semesterWeeks }, (_, index) => {
      const week = index + 1;
      return {
        week_number: week,
        gpa: weekMap.has(week) ? weekMap.get(week)! : null
      };
    });
  }, [weeklyGpa, activeYear, semesterWeeks]);

  const latestGpaPoint = useMemo(() => {
    return studentGpaSeries.filter((point) => point.gpa !== null).slice(-1)[0] ?? null;
  }, [studentGpaSeries]);

  const weekOneGpa = useMemo(() => {
    return studentGpaSeries.find((point) => point.week_number === 1)?.gpa ?? null;
  }, [studentGpaSeries]);

  const currentWeekNumber = latestGpaPoint?.week_number ?? weeklyGpa.reduce((max, row) => Math.max(max, row.week_number), 1);

  const gpaGrowth = useMemo(() => {
    if (weekOneGpa === null || latestGpaPoint?.gpa === null) return null;
    return Number((latestGpaPoint.gpa - weekOneGpa).toFixed(2));
  }, [weekOneGpa, latestGpaPoint]);

  const gradeRows = useMemo(() => {
    const currentWeek = Math.max(1, ...weeklyGrades.map((row) => row.week_number));
    const subjects = classes.map((cls) => ({ classId: cls.id, subject: cls.subject || cls.name }));

    return subjects.map((subjectRow) => {
      const rows = weeklyGrades
        .filter((grade) => grade.class_id === subjectRow.classId)
        .reduce((acc, grade) => {
          const parsed = parseGrade(grade.grade, grade.grade_points ?? null);
          if (parsed !== null) acc.set(grade.week_number, parsed);
          return acc;
        }, new Map<number, number>());

      return {
        ...subjectRow,
        currentWeek,
        weekGrades: Array.from({ length: currentWeek }, (_, index) => rows.get(index + 1) ?? null),
        latestGrade: rows.get(currentWeek) ?? null,
        previousGrade: rows.get(currentWeek - 1) ?? null,
        allWeeks: rows
      };
    });
  }, [classes, weeklyGrades]);

  const gradeGraphData = useMemo(() => {
    const weekCount = Math.max(semesterWeeks, ...weeklyGrades.map((row) => row.week_number));
    const subjects = classes.map((cls) => ({ classId: cls.id, subject: cls.subject || cls.name }));
    return Array.from({ length: weekCount }, (_, index) => {
      const week = index + 1;
      const row: any = { week_number: week };
      subjects.forEach((subjectRow) => {
        const gradeRecord = weeklyGrades.find((g) => g.class_id === subjectRow.classId && g.week_number === week);
        row[`subject_${subjectRow.classId}`] = parseGrade(gradeRecord?.grade ?? null, gradeRecord?.grade_points ?? null);
      });
      return row;
    });
  }, [classes, weeklyGrades, semesterWeeks]);

  const gradeSeries: GradeSeries[] = useMemo(() => {
    return classes.map((cls) => {
      const classGrades = weeklyGrades
        .filter((grade) => grade.class_id === cls.id)
        .map((grade) => ({ week_number: grade.week_number, grade: parseGrade(grade.grade, grade.grade_points ?? null) }))
        .sort((a, b) => a.week_number - b.week_number);
      const latestWeek = classGrades.reduce((max, row) => Math.max(max, row.week_number), 0);
      const data = Array.from({ length: semesterWeeks }, (_, index) => {
        const week = index + 1;
        const found = classGrades.find((row) => row.week_number === week);
        return { week_number: week, grade: found?.grade ?? null };
      });
      return {
        classId: cls.id,
        subject: cls.subject || cls.name,
        data,
        latestWeek
      };
    });
  }, [classes, weeklyGrades, semesterWeeks]);

  const bestClass = useMemo(() => {
    return gradeRows
      .filter((row) => row.latestGrade !== null)
      .sort((a, b) => (b.latestGrade! - a.latestGrade!))[0];
  }, [gradeRows]);

  const biggestGrowth = useMemo(() => {
    return gradeRows
      .map((row) => ({
        ...row,
        growth: row.latestGrade !== null && row.previousGrade !== null ? row.latestGrade - row.previousGrade : null
      }))
      .filter((row) => row.growth !== null)
      .sort((a, b) => (b.growth! - a.growth!))[0];
  }, [gradeRows]);

  const biggestOpportunity = useMemo(() => {
    return gradeRows
      .filter((row) => row.latestGrade !== null)
      .sort((a, b) => (a.latestGrade! - b.latestGrade!))[0];
  }, [gradeRows]);

  const totalAbsences = useMemo(() => {
    return attendance.reduce((sum, row) => sum + Number(row.absent_days), 0);
  }, [attendance]);

  const currentWeekAbsences = useMemo(() => {
    const latest = attendance.reduce((latestRow, row) => (row.week_number > latestRow.week_number ? row : latestRow), { week_number: 0, absent_days: 0 } as WeeklyAttendance);
    return latest.absent_days ?? 0;
  }, [attendance]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <div className="flex min-h-screen items-center justify-center px-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-sm font-medium text-slate-700">Loading student view…</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-10 shadow-sm ring-1 ring-rose-200">
            <p className="text-sm font-semibold text-rose-700">Unable to load student details</p>
            <p className="mt-4 text-slate-700">{error}</p>
            <Link to="/dashboard" className="mt-6 inline-flex rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800">
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!student) {
    return null;
  }

  const growthMessage = gpaGrowth !== null && gpaGrowth > 0
    ? `Your GPA has grown by ${gpaGrowth.toFixed(2)} points this semester — keep it up!`
    : `You have ${Math.max(semesterWeeks - currentWeekNumber, 0)} weeks left to move the needle — let's talk about a plan.`;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 rounded-[2rem] bg-amber-50 p-8 shadow-sm ring-1 ring-amber-200 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-amber-700">Welcome</p>
            <h1 className="mt-3 text-4xl font-semibold text-slate-900">Welcome, {student.first_name}!</h1>
            <p className="mt-2 text-base text-slate-700">Week {currentWeekNumber} of {semesterWeeks}</p>
          </div>
          <Link to="/" className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
            Back to dashboard
          </Link>
        </div>

        <div className="mt-6 rounded-[2rem] bg-emerald-600 px-6 py-8 text-white shadow-xl ring-1 ring-emerald-400">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-200">GPA growth</p>
          <h2 className="mt-4 text-2xl font-semibold">{growthMessage}</h2>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          <div className="rounded-[2rem] bg-emerald-50 p-6 shadow-sm ring-1 ring-emerald-200">
            <p className="text-sm uppercase tracking-[0.3em] text-emerald-700">Your best class so far</p>
            <p className="mt-4 text-2xl font-semibold text-slate-900">{bestClass?.subject ?? 'No data yet'}</p>
            <p className="mt-2 text-sm text-slate-600">Highest current-week grade across your classes.</p>
          </div>
          <div className="rounded-[2rem] bg-amber-50 p-6 shadow-sm ring-1 ring-amber-200">
            <p className="text-sm uppercase tracking-[0.3em] text-amber-800">Your biggest growth</p>
            <p className="mt-4 text-2xl font-semibold text-slate-900">{biggestGrowth?.subject ?? 'No data yet'}</p>
            <p className="mt-2 text-sm text-slate-600">Largest week-over-week grade increase this semester.</p>
          </div>
          <div className="rounded-[2rem] bg-rose-50 p-6 shadow-sm ring-1 ring-rose-200">
            <p className="text-sm uppercase tracking-[0.3em] text-rose-700">Your biggest opportunity</p>
            <p className="mt-4 text-2xl font-semibold text-slate-900">{biggestOpportunity?.subject ?? 'No data yet'}</p>
            <p className="mt-2 text-sm text-slate-600">Lowest current-week grade to help focus on improvement.</p>
          </div>
        </div>

        <AdvisorInsights
          student={student}
          weeklyGpa={weeklyGpa}
          weeklyGrades={weeklyGrades}
          weeklyAttendance={attendance}
          classes={classes}
          activeYear={activeYear}
        />

        <div className="mt-8 rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Weekly GPA</p>
              <h3 className="mt-2 text-2xl font-semibold text-slate-900">Your GPA trend</h3>
            </div>
            <p className="text-sm text-slate-500">Target GPA: {student.target_gpa?.toFixed(2) ?? '—'}</p>
          </div>

          <div className="mt-6 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={studentGpaSeries}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="week_number" tickFormatter={(value) => `W${value}`} />
                <YAxis domain={[0, 4]} />
                <Tooltip formatter={(value: any) => (typeof value === 'number' ? value.toFixed(2) : value)} />
                {student.target_gpa !== null ? (
                  <ReferenceLine y={student.target_gpa} stroke="#10b981" strokeDasharray="4 4" />
                ) : null}
                <Line
                  type="monotone"
                  dataKey="gpa"
                  stroke="#0f766e"
                  strokeWidth={3}
                  dot={(props) => <AnimatedDot {...props} highlightWeek={latestGpaPoint?.week_number ?? 1} />}
                  activeDot={{ r: 8 }}
                  connectNulls={false}
                  isAnimationActive={true}
                  name="GPA"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="mt-8 rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Class grades</p>
              <h3 className="mt-2 text-2xl font-semibold text-slate-900">Weekly grade table</h3>
            </div>
            <p className="text-sm text-slate-500">Showing Week 1 through Week {Math.max(1, ...weeklyGrades.map((row) => row.week_number))}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead>
                <tr>
                  <th className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700">Subject</th>
                  {Array.from({ length: Math.max(1, ...weeklyGrades.map((row) => row.week_number)) }, (_, index) => (
                    <th key={index} className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700">W{index + 1}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {gradeRows.map((row) => (
                  <tr key={row.classId} className="bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-4 font-medium text-slate-900">{row.subject}</td>
                    {row.weekGrades.map((grade, index) => (
                      <td key={index} className="whitespace-nowrap px-4 py-4 text-slate-700">
                        {grade === null ? ' ' : grade.toFixed(0)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Class grade trends</p>
              <h3 className="mt-2 text-2xl font-semibold text-slate-900">Subject performance over time</h3>
            </div>
          </div>
          <div className="mt-6 h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={gradeGraphData}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="week_number" tickFormatter={(value) => `W${value}`} />
                <YAxis allowDecimals={false} />
                <Tooltip formatter={(value: any) => (typeof value === 'number' ? value.toFixed(0) : value)} />
                <Legend />
                {gradeSeries.map((series, index) => (
                  <Line
                    key={series.classId}
                    type="monotone"
                    dataKey={`subject_${series.classId}`}
                    stroke={gradeColors[index % gradeColors.length]}
                    strokeWidth={3}
                    dot={(props) => <AnimatedDot {...props} highlightWeek={series.latestWeek} />}
                    activeDot={{ r: 8 }}
                    connectNulls={false}
                    isAnimationActive={true}
                    name={series.subject}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="mt-8 rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Attendance summary</p>
              <h3 className="mt-2 text-2xl font-semibold text-slate-900">Absences to date</h3>
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl bg-slate-50 p-6">
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Total absences</p>
              <p className="mt-3 text-4xl font-semibold text-slate-900">{totalAbsences}</p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-6">
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Absences this week</p>
              <p className="mt-3 text-4xl font-semibold text-slate-900">{currentWeekAbsences}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
