import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Line, LineChart, ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip, ReferenceLine, Legend, Customized } from 'recharts';
import AnimatedDot from './AnimatedDot';
import AdvisorInsights from './AdvisorInsights';
import SelfAssessmentModal from './SelfAssessmentModal';
import { supabase } from '../lib/supabaseClient';
import { ClassRecord, School, SelfAssessment, Student, WeeklyAttendance, WeeklyClassGrade, WeeklyGpaSnapshot } from '../lib/types';

type ColorScheme = 'streak' | 'attendance' | 'gpa' | 'fallback';

interface Celebration {
  emoji: string;
  headline: string;
  subtext: string;
  colorScheme: ColorScheme;
}

interface CelebrationInput {
  student: Student;
  weeklyGpa: WeeklyGpaSnapshot[];
  attendance: WeeklyAttendance[];
  weeklyGrades: WeeklyClassGrade[];
  classes: ClassRecord[];
  selfAssessments: SelfAssessment[];
  activeYear: string;
  currentWeekNumber: number;
  semesterWeeks: number;
}

function toGradeValue(row: WeeklyClassGrade): number | null {
  if (row.grade_points != null) return row.grade_points;
  const parsed = parseFloat(row.grade ?? '');
  return Number.isFinite(parsed) ? parsed : null;
}

function getCelebration({
  student,
  weeklyGpa,
  attendance,
  weeklyGrades,
  classes,
  selfAssessments,
  activeYear,
  currentWeekNumber,
  semesterWeeks,
}: CelebrationInput): Celebration {
  const name = student.preferred_name || student.first_name;

  // --- GPA snapshots sorted chronologically ---
  const gpaSnapshots = weeklyGpa
    .filter((r) => r.school_year === activeYear)
    .sort((a, b) => a.week_number - b.week_number);

  // --- Absences by week ---
  const absencesByWeek = new Map<number, number>();
  attendance
    .filter((r) => r.school_year === activeYear)
    .forEach((r) => {
      absencesByWeek.set(r.week_number, (absencesByWeek.get(r.week_number) ?? 0) + Number(r.absent_days));
    });

  // --- Grades by class, sorted chronologically ---
  const gradesByClass = new Map<string, { subject: string; history: { week: number; value: number }[] }>();
  weeklyGrades
    .filter((g) => g.school_year === activeYear)
    .forEach((g) => {
      const val = toGradeValue(g);
      if (val === null) return;
      const cls = classes.find((c) => c.id === g.class_id);
      const subject = cls?.subject || cls?.name;
      if (!subject) return;
      if (!gradesByClass.has(g.class_id)) gradesByClass.set(g.class_id, { subject, history: [] });
      gradesByClass.get(g.class_id)!.history.push({ week: g.week_number, value: val });
    });
  gradesByClass.forEach((entry) => entry.history.sort((a, b) => a.week - b.week));

  // --- Latest self-assessment ---
  const latestAssessment = selfAssessments
    .filter((a) => a.school_year === activeYear)
    .sort((a, b) => b.week_number - a.week_number)[0] ?? null;

  // ── TIER 1: Streaks ──────────────────────────────────────────

  // GPA streak
  let gpaStreak = 0;
  for (let i = gpaSnapshots.length - 1; i > 0; i--) {
    if (Number(gpaSnapshots[i].gpa) > Number(gpaSnapshots[i - 1].gpa)) gpaStreak++;
    else break;
  }
  if (gpaStreak >= 3) return {
    emoji: '🔥',
    headline: `${gpaStreak}-week growth streak — you're on a roll, ${name}!`,
    subtext: `Your GPA has gone up ${gpaStreak} weeks in a row. Keep this momentum going.`,
    colorScheme: 'streak',
  };

  // Perfect attendance streak
  let attendanceStreak = 0;
  for (let w = currentWeekNumber; w >= 1; w--) {
    const absences = absencesByWeek.get(w);
    if (absences === undefined) break;
    if (absences === 0) attendanceStreak++;
    else break;
  }
  if (attendanceStreak >= 3) return {
    emoji: '⭐',
    headline: `${attendanceStreak} weeks of perfect attendance!`,
    subtext: `Showing up is the foundation of everything else — and you're nailing it.`,
    colorScheme: 'attendance',
  };

  // Subject improvement streak
  let bestSubjectStreak = { subject: '', streak: 0 };
  for (const { subject, history } of gradesByClass.values()) {
    let streak = 0;
    for (let i = history.length - 1; i > 0; i--) {
      if (history[i].value > history[i - 1].value) streak++;
      else break;
    }
    if (streak > bestSubjectStreak.streak) bestSubjectStreak = { subject, streak };
  }
  if (bestSubjectStreak.streak >= 3) return {
    emoji: '📈',
    headline: `${bestSubjectStreak.subject} is on fire — ${bestSubjectStreak.streak} weeks of improvement!`,
    subtext: `Something is clicking in ${bestSubjectStreak.subject}. Keep doing what you're doing.`,
    colorScheme: 'streak',
  };

  // ── TIER 2: This week's wins ──────────────────────────────────

  const latestGpaSnap = gpaSnapshots[gpaSnapshots.length - 1] ?? null;
  const prevGpaSnap = gpaSnapshots[gpaSnapshots.length - 2] ?? null;

  if (latestGpaSnap && prevGpaSnap && Number(latestGpaSnap.gpa) > Number(prevGpaSnap.gpa)) return {
    emoji: '📊',
    headline: `Your GPA went up this week, ${name}!`,
    subtext: `You moved the needle. That's what this is all about.`,
    colorScheme: 'gpa',
  };

  let bigMove: { subject: string; delta: number } | null = null;
  for (const { subject, history } of gradesByClass.values()) {
    const thisWeek = history.find((h) => h.week === currentWeekNumber);
    const prevWeek = history.find((h) => h.week === currentWeekNumber - 1);
    if (!thisWeek || !prevWeek) continue;
    const delta = thisWeek.value - prevWeek.value;
    if (delta >= 5 && (!bigMove || delta > bigMove.delta)) bigMove = { subject, delta };
  }
  if (bigMove) return {
    emoji: '🎯',
    headline: `Big move in ${bigMove.subject} this week!`,
    subtext: `You jumped ${Math.round(bigMove.delta)} points in ${bigMove.subject} — that kind of progress adds up fast.`,
    colorScheme: 'gpa',
  };

  if (absencesByWeek.get(currentWeekNumber) === 0) return {
    emoji: '✅',
    headline: `Perfect attendance this week!`,
    subtext: `You were here every single day. That matters more than you think.`,
    colorScheme: 'attendance',
  };

  if (latestAssessment && latestAssessment.week_number === currentWeekNumber && latestAssessment.effort_rating >= 4) return {
    emoji: '💪',
    headline: `You said you gave a lot this week.`,
    subtext: `That effort is going to show up in your grades — keep it going.`,
    colorScheme: 'streak',
  };

  // ── TIER 3: Semester wins ─────────────────────────────────────

  const weekOneSnap = gpaSnapshots.find((r) => r.week_number === 1) ?? null;
  if (latestGpaSnap && weekOneSnap && Number(latestGpaSnap.gpa) > Number(weekOneSnap.gpa)) {
    const growth = (Number(latestGpaSnap.gpa) - Number(weekOneSnap.gpa)).toFixed(2);
    return {
      emoji: '📈',
      headline: `You've grown ${growth} points since Week 1, ${name}!`,
      subtext: `That's real progress over real time.`,
      colorScheme: 'gpa',
    };
  }

  let totalAbsences = 0;
  absencesByWeek.forEach((v) => { totalAbsences += v; });
  if (absencesByWeek.size > 0 && totalAbsences <= 3) return {
    emoji: '⭐',
    headline: `Outstanding attendance this semester!`,
    subtext: `You've barely missed a day — that consistency is a superpower.`,
    colorScheme: 'attendance',
  };

  for (const { subject, history } of gradesByClass.values()) {
    if (history.length < 2) continue;
    const maxVal = Math.max(...history.map((h) => h.value));
    const thisWeekEntry = history.find((h) => h.week === currentWeekNumber);
    if (thisWeekEntry && thisWeekEntry.value === maxVal) return {
      emoji: '🏆',
      headline: `${subject} is at its best point all semester!`,
      subtext: `Week ${currentWeekNumber} is your personal best in ${subject} — remember this feeling.`,
      colorScheme: 'gpa',
    };
  }

  // ── TIER 4: Fallback ──────────────────────────────────────────

  const weeksLeft = Math.max(0, semesterWeeks - currentWeekNumber);
  return {
    emoji: '📅',
    headline: `You have ${weeksLeft} weeks left to shape how this semester ends, ${name}.`,
    subtext: `Every week is a chance to move the needle. What will this week be?`,
    colorScheme: 'fallback',
  };
}

const celebrationStyles: Record<ColorScheme, string> = {
  streak:     'from-amber-500 to-orange-500',
  attendance: 'from-teal-500 to-cyan-600',
  gpa:        'from-emerald-500 to-teal-600',
  fallback:   'from-slate-600 to-slate-700',
};

// ─── calculatePathToTarget ───────────────────────────────────────────────────

interface ClassGradeInput {
  name: string;
  currentGrade: number;
  recentGrades?: number[];
}

export interface ClassRecommendation {
  className: string;
  currentGrade: number;
  targetGrade: number;
  reason: string;
}

export interface PathToTargetResult {
  gapToClose: number;
  achievable: boolean;
  recommendations: ClassRecommendation[];
}

export function calculatePathToTarget(
  classes: ClassGradeInput[],
  targetGpa: number,
  weeksRemaining: number,
  currentGpa: number
): PathToTargetResult {
  const gapToClose = Math.round((targetGpa - currentGpa) * 100) / 100;

  if (gapToClose <= 0 || classes.length === 0) {
    return { gapToClose, achievable: true, recommendations: [] };
  }

  const scored = classes
    .filter((c) => c.currentGrade > 0)
    .map((cls) => {
      const grade = cls.currentGrade;
      const nextThreshold = Math.min(100, Math.ceil((grade + 1) / 10) * 10);
      const distanceToThreshold = nextThreshold - grade;

      const recent = cls.recentGrades ?? [];
      const hasUpwardMomentum = recent.length >= 2 &&
        recent[recent.length - 1] > recent[recent.length - 2];

      let reason: string;
      if (distanceToThreshold <= 3) {
        reason = `Only ${distanceToThreshold} point${distanceToThreshold === 1 ? '' : 's'} from a ${nextThreshold} — the highest-leverage move you can make.`;
      } else if (hasUpwardMomentum && distanceToThreshold <= 7) {
        reason = `You've been trending up here and you're ${distanceToThreshold} points from a ${nextThreshold}.`;
      } else if (distanceToThreshold <= 7) {
        reason = `${distanceToThreshold} points from a ${nextThreshold} — steady progress here will pay off.`;
      } else {
        reason = `With ${100 - grade} points of room to grow, this class has real potential to lift your GPA.`;
      }

      return {
        className: cls.name,
        currentGrade: grade,
        targetGrade: nextThreshold,
        reason,
        _sort: [distanceToThreshold, hasUpwardMomentum ? 0 : 1, grade] as [number, number, number],
      };
    });

  scored.sort((a, b) => {
    for (let i = 0; i < 3; i++) {
      if (a._sort[i] !== b._sort[i]) return a._sort[i] - b._sort[i];
    }
    return 0;
  });

  return {
    gapToClose,
    achievable: gapToClose <= 0.6 && weeksRemaining >= 3,
    recommendations: scored.slice(0, 3).map(({ className, currentGrade, targetGrade, reason }) => ({
      className, currentGrade, targetGrade, reason,
    })),
  };
}

// ─── DraggableTargetLine (Recharts Customized component) ─────────────────────

function DraggableTargetLine(props: any) {
  const {
    yAxisMap, offset,
    displayGpa, isDragging, saveStatus,
    onPointerDown, yScaleRef, chartOffsetRef,
  } = props;

  const yAxis = Object.values(yAxisMap ?? {})[0] as any;
  if (!yAxis?.scale) return null;

  // Side-effect during render: expose scale + offset to parent pointer handlers
  yScaleRef.current = yAxis.scale;
  chartOffsetRef.current = offset;

  const y = yAxis.scale(displayGpa);
  if (!Number.isFinite(y)) return null;

  const x1 = offset.left;
  const x2 = offset.left + offset.width;

  return (
    <g>
      {/* Line + handle group, CSS-transitioned for spring snap on release */}
      <g
        transform={`translate(0, ${y})`}
        style={{ transition: isDragging ? 'none' : 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
      >
        <line
          x1={x1} y1={0} x2={x2} y2={0}
          stroke="#f59e0b" strokeWidth={isDragging ? 2.5 : 2}
          strokeDasharray="6 4"
          style={{ pointerEvents: 'none' }}
        />
        {/* Floating label while dragging */}
        {isDragging && (
          <g>
            <rect x={x1 + 4} y={-20} width={54} height={17} rx={4} fill="#f59e0b" />
            <text x={x1 + 31} y={-7} fill="white" fontSize={11} fontWeight="bold" textAnchor="middle">
              {displayGpa.toFixed(2)}
            </text>
          </g>
        )}
        {/* Bullseye drag handle */}
        <g
          style={{ cursor: 'ns-resize', touchAction: 'none' }}
          onPointerDown={onPointerDown}
        >
          <circle cx={x2 + 18} cy={0} r={14} fill="#fbbf24" />
          <circle cx={x2 + 18} cy={0} r={7} fill="white" />
          <circle cx={x2 + 18} cy={0} r={3} fill="#f59e0b" />
        </g>
      </g>
      {/* Pulse ring on successful save */}
      {saveStatus === 'saved' && (
        <circle cx={x2 + 18} cy={y} r={14} fill="none" stroke="#f59e0b" strokeWidth={3}>
          <animate attributeName="r" values="14;26;14" dur="0.55s" />
          <animate attributeName="opacity" values="0.9;0;0" dur="0.55s" />
        </circle>
      )}
    </g>
  );
}

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

export default function StudentView({ isStudentSelf = false }: { isStudentSelf?: boolean }) {
  const { id } = useParams();
  const [student, setStudent] = useState<Student | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [weeklyGpa, setWeeklyGpa] = useState<WeeklyGpaSnapshot[]>([]);
  const [weeklyGrades, setWeeklyGrades] = useState<WeeklyClassGrade[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [attendance, setAttendance] = useState<WeeklyAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTopGrower, setIsTopGrower] = useState(false);
  const [selfAssessments, setSelfAssessments] = useState<SelfAssessment[]>([]);
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [localTargetGpa, setLocalTargetGpa] = useState(0);
  const [pendingTargetGpa, setPendingTargetGpa] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'pending' | 'saved'>('idle');
  const chartWrapperRef = useRef<HTMLDivElement>(null);
  const yScaleRef = useRef<any>(null);
  const chartOffsetRef = useRef<any>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const loadStudentView = async () => {
      if (!id) {
        setError('Student ID is missing.');
        setLoading(false);
        return;
      }

      try {
        const studentResponse = await supabase.from('students').select('*').eq('id', id).maybeSingle();
        if (studentResponse.error) throw studentResponse.error;
        if (!studentResponse.data) throw new Error('Student record not found. The account may not be linked correctly — contact your advisor.');
        const studentRecord = studentResponse.data as Student;
        setStudent(studentRecord);

        const [schoolResponse, gpaResponse, attendanceResponse, classGradesResponse] = await Promise.all([
          supabase.from('schools').select('*').eq('id', studentRecord.school_id).maybeSingle(),
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

        if (studentRecord.advisory_class_id) {
          const classResponse = await supabase
            .from('classes')
            .select('*')
            .eq('advisory_class_id', studentRecord.advisory_class_id);
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

  useEffect(() => {
    if (!student?.advisory_class_id || !activeYear) return;

    const checkTopGrower = async () => {
      const { data: peers } = await supabase
        .from('students')
        .select('id')
        .eq('advisory_class_id', student.advisory_class_id!);

      if (!peers || peers.length < 2) return;

      const peerIds = peers.map((p: { id: string }) => p.id);
      const { data: gpaRows } = await supabase
        .from('weekly_gpa_snapshots')
        .select('student_id, week_number, gpa')
        .in('student_id', peerIds)
        .eq('school_year', activeYear);

      if (!gpaRows || gpaRows.length === 0) return;

      const latestWeek = Math.max(...gpaRows.map((r: { week_number: number }) => r.week_number));

      let maxChange = 0;
      let topId = '';
      peerIds.forEach((sid: string) => {
        const latest = gpaRows.find((r: { student_id: string; week_number: number }) => r.student_id === sid && r.week_number === latestWeek);
        const prev = gpaRows.find((r: { student_id: string; week_number: number }) => r.student_id === sid && r.week_number === latestWeek - 1);
        if (!latest || !prev) return;
        const change = Number(latest.gpa) - Number(prev.gpa);
        if (change > maxChange) { maxChange = change; topId = sid; }
      });

      setIsTopGrower(topId === student.id && maxChange > 0);
    };

    checkTopGrower();
  }, [student?.id, student?.advisory_class_id, activeYear]);

  // Sync localTargetGpa when student record loads
  useEffect(() => {
    if (student?.target_gpa != null) setLocalTargetGpa(student.target_gpa);
    else setLocalTargetGpa(3.0);
  }, [student?.target_gpa]);

  const saveTargetGpa = useCallback(async (value: number) => {
    if (!student) return;
    const { error } = await supabase.from('students').update({ target_gpa: value }).eq('id', student.id);
    if (!error) {
      setSaveStatus('saved');
      setPendingTargetGpa(null);
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  }, [student]);

  const handleTargetPointerDown = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    setSaveStatus('idle');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  }, []);

  const handleChartPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !yScaleRef.current?.invert || !chartOffsetRef.current) return;
    const rect = chartWrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    const relY = e.clientY - rect.top - chartOffsetRef.current.top;
    const raw = yScaleRef.current.invert(relY);
    const clamped = Math.max(0, Math.min(4, raw));
    setPendingTargetGpa(Math.round(clamped * 10) / 10);
  }, [isDragging]);

  const handleChartPointerUp = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    const snapped = pendingTargetGpa ?? localTargetGpa;
    setLocalTargetGpa(snapped);
    setSaveStatus('pending');
    saveTimerRef.current = setTimeout(() => saveTargetGpa(snapped), 2000);
  }, [isDragging, pendingTargetGpa, localTargetGpa, saveTargetGpa]);

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

  // Load self-assessments and show the modal if the student hasn't submitted this week
  useEffect(() => {
    if (!student?.id || !activeYear || currentWeekNumber === 0) return;

    const loadAssessments = async () => {
      const { data } = await supabase
        .from('student_self_assessments')
        .select('*')
        .eq('student_id', student.id)
        .order('week_number', { ascending: true });

      const rows = (data ?? []) as SelfAssessment[];
      setSelfAssessments(rows);

      const hasThisWeek = rows.some(
        (a) => a.school_year === activeYear && a.week_number === currentWeekNumber
      );
      if (!hasThisWeek) setShowAssessmentModal(true);
    };

    loadAssessments();
  }, [student?.id, activeYear, currentWeekNumber]);

  const gpaGrowth = useMemo(() => {
    if (weekOneGpa === null || latestGpaPoint?.gpa === null) return null;
    return Number((latestGpaPoint.gpa - weekOneGpa).toFixed(2));
  }, [weekOneGpa, latestGpaPoint]);

  const gpaWithEffortSeries = useMemo(() => {
    return studentGpaSeries.map((point) => {
      const a = selfAssessments.find(
        (s) => s.school_year === activeYear && s.week_number === point.week_number
      );
      return { ...point, effort: a?.effort_rating ?? null };
    });
  }, [studentGpaSeries, selfAssessments, activeYear]);

  const hasEffortData = useMemo(
    () => gpaWithEffortSeries.filter((p) => p.effort !== null).length >= 2,
    [gpaWithEffortSeries]
  );

  const celebration = useMemo<Celebration | null>(() => {
    if (!student) return null;
    return getCelebration({
      student, weeklyGpa, attendance, weeklyGrades, classes,
      selfAssessments, activeYear, currentWeekNumber, semesterWeeks,
    });
  }, [student, weeklyGpa, attendance, weeklyGrades, classes, selfAssessments, activeYear, currentWeekNumber, semesterWeeks]);

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

  const pathToTarget = useMemo<PathToTargetResult | null>(() => {
    if (!student || localTargetGpa === 0) return null;
    const currentGpa = latestGpaPoint?.gpa ?? 0;
    if (currentGpa === 0) return null;
    const latestWeek = weeklyGrades.reduce((max, g) => Math.max(max, g.week_number), 0);
    if (latestWeek === 0) return null;
    const classIds = [...new Set(weeklyGrades.filter((g) => g.school_year === activeYear).map((g) => g.class_id))];
    const classInputs: ClassGradeInput[] = [];
    classIds.forEach((classId) => {
      const cls = classes.find((c) => c.id === classId);
      const name = cls?.subject || cls?.name;
      if (!name) return;
      const row = weeklyGrades.find((g) => g.class_id === classId && g.school_year === activeYear && g.week_number === latestWeek);
      if (!row) return;
      const val = row.grade_points ?? (row.grade ? parseFloat(row.grade) : NaN);
      if (!Number.isFinite(val) || val <= 0) return;
      classInputs.push({ name, currentGrade: val });
    });
    if (classInputs.length === 0) return null;
    return calculatePathToTarget(classInputs, localTargetGpa, Math.max(0, semesterWeeks - currentWeekNumber), currentGpa);
  }, [student, localTargetGpa, latestGpaPoint, weeklyGrades, classes, activeYear, semesterWeeks, currentWeekNumber]);

  const getGradeCellClasses = (grade: number | null, previousGrade: number | null, weekIndex: number) => {
    const baseClasses = 'whitespace-nowrap px-4 py-4';
    if (weekIndex === 0 || grade === null || previousGrade === null) {
      return `${baseClasses} text-slate-700`;
    }

    const delta = grade - previousGrade;
    if (delta > 0) {
      if (delta <= 4) {
        return `${baseClasses} bg-green-50 text-green-700`;
      }
      if (delta <= 9) {
        return `${baseClasses} bg-green-100 text-green-800`;
      }
      return `${baseClasses} bg-green-200 text-green-900 font-semibold`;
    }

    if (delta < 0) {
      return `${baseClasses} bg-red-50 text-red-700`;
    }

    return `${baseClasses} text-slate-700`;
  };

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

  if (showAssessmentModal) {
    return (
      <SelfAssessmentModal
        studentId={student.id}
        schoolYear={activeYear}
        weekNumber={currentWeekNumber}
        onComplete={() => setShowAssessmentModal(false)}
      />
    );
  }


  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 rounded-[2rem] bg-amber-50 p-8 shadow-sm ring-1 ring-amber-200 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-amber-700">Welcome</p>
            <h1 className="mt-3 text-4xl font-semibold text-slate-900">Welcome, {student.first_name}!</h1>
            <p className="mt-2 text-base text-slate-700">Week {currentWeekNumber} of {semesterWeeks}</p>
          </div>
          {isStudentSelf ? (
            <button
              type="button"
              onClick={() => supabase.auth.signOut()}
              className="inline-flex items-center justify-center rounded-full border border-amber-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-amber-100"
            >
              Sign out
            </button>
          ) : (
            <Link to="/" className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
              Back to dashboard
            </Link>
          )}
        </div>

        {celebration && (
          <div className={`mt-6 rounded-[2rem] bg-gradient-to-r ${celebrationStyles[celebration.colorScheme]} px-7 py-8 text-white shadow-xl`}>
            <div className="flex items-start gap-5">
              <span className="text-4xl leading-none" role="img">{celebration.emoji}</span>
              <div>
                <p className="text-xl font-bold leading-snug">{celebration.headline}</p>
                <p className="mt-2 text-sm font-medium opacity-80">{celebration.subtext}</p>
              </div>
            </div>
          </div>
        )}

        {student.strengths && student.strengths.length > 0 && (
          <div className="mt-6 rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-amber-100">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-700">Your strengths</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {student.strengths.map((strength) => (
                <span
                  key={strength}
                  className="rounded-full bg-gradient-to-r from-amber-100 to-orange-100 px-4 py-2 text-sm font-semibold text-amber-900 ring-1 ring-amber-200"
                >
                  {strength}
                </span>
              ))}
            </div>
          </div>
        )}

        {isTopGrower && (
          <div className="mt-6 rounded-[2rem] border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-50 px-6 py-6 shadow-sm ring-2 ring-amber-200">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-600">Top grower this week</p>
            <p className="mt-2 text-lg font-semibold text-amber-900">
  You had the highest GPA growth in the advisory this week. Keep it up!
            </p>
          </div>
        )}

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
          schoolState={school?.state ?? ''}
          selfAssessment={selfAssessments.filter((a) => a.school_year === activeYear).sort((a, b) => b.week_number - a.week_number)[0] ?? null}
          pathToTarget={pathToTarget}
        />

        <div className="mt-8 rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Weekly GPA</p>
              <h3 className="mt-2 text-2xl font-semibold text-slate-900">Your GPA trend</h3>
            </div>
            <div className="flex items-center gap-3">
              {saveStatus === 'pending' && (
                <button
                  type="button"
                  onClick={() => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); saveTargetGpa(localTargetGpa); }}
                  className="rounded-full bg-amber-500 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-600"
                >
                  Set goal: {localTargetGpa.toFixed(1)}
                </button>
              )}
              {saveStatus === 'saved' && (
                <span className="text-xs font-semibold text-emerald-600">Goal saved!</span>
              )}
              <p className="text-sm text-slate-500">
                Target: <span className="font-semibold text-amber-600">{localTargetGpa.toFixed(2)}</span>
                <span className="ml-1 text-xs text-slate-400">— drag the bullseye to adjust</span>
              </p>
            </div>
          </div>

          <div
            ref={chartWrapperRef}
            className="mt-6 h-80 select-none"
            onPointerMove={handleChartPointerMove}
            onPointerUp={handleChartPointerUp}
            style={{ touchAction: 'none' }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={gpaWithEffortSeries} margin={{ top: 5, right: 48, bottom: 5, left: 5 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="week_number" tickFormatter={(value) => `W${value}`} />
                <YAxis yAxisId="gpa" domain={[0, 4]} />
                {hasEffortData && (
                  <YAxis yAxisId="effort" orientation="right" domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tickFormatter={(v) => `${v}`} />
                )}
                <Tooltip formatter={(value: any, name: string) => [
                  typeof value === 'number' ? (name === 'Effort' ? `${value}/5` : value.toFixed(2)) : value,
                  name
                ]} />
                {hasEffortData && <Legend />}
                <Customized
                  component={DraggableTargetLine}
                  displayGpa={isDragging ? (pendingTargetGpa ?? localTargetGpa) : localTargetGpa}
                  isDragging={isDragging}
                  saveStatus={saveStatus}
                  onPointerDown={handleTargetPointerDown}
                  yScaleRef={yScaleRef}
                  chartOffsetRef={chartOffsetRef}
                />
                <Line
                  yAxisId="gpa"
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
                {hasEffortData && (
                  <Line
                    yAxisId="effort"
                    type="monotone"
                    dataKey="effort"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ r: 3, fill: '#f59e0b' }}
                    activeDot={{ r: 6 }}
                    connectNulls={false}
                    isAnimationActive={true}
                    name="Effort"
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {pathToTarget && pathToTarget.recommendations.length > 0 && (
          <div className="mt-6 rounded-[2rem] bg-gradient-to-br from-amber-50 to-orange-50 p-6 shadow-sm ring-1 ring-amber-200">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-700">Your path to {localTargetGpa.toFixed(1)}</p>
            <p className="mt-1 text-sm text-slate-600">
              Gap to close: <span className="font-semibold text-slate-800">{Math.abs(pathToTarget.gapToClose).toFixed(2)} GPA points</span>
            </p>
            <div className="mt-4 space-y-3">
              {pathToTarget.recommendations.map((rec, i) => (
                <div key={rec.className} className="flex items-start gap-4 rounded-2xl bg-white px-4 py-4 shadow-sm ring-1 ring-amber-100">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-800">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-semibold text-slate-900">{rec.className}</span>
                      <span className="text-sm text-slate-500">
                        {rec.currentGrade} → <span className="font-semibold text-amber-700">{rec.targetGrade}</span>
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{rec.reason}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-slate-500">
              If you hit these targets, your GPA will land right where you want it by Week {semesterWeeks}.
            </p>
          </div>
        )}

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
                    {row.weekGrades.map((grade, index) => {
                      const previousGrade = index > 0 ? row.weekGrades[index - 1] : null;
                      return (
                        <td key={index} className={getGradeCellClasses(grade, previousGrade, index)}>
                          {grade === null ? ' ' : grade.toFixed(0)}
                        </td>
                      );
                    })}
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
