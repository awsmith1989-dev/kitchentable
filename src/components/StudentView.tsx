import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Line, LineChart, ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Customized } from 'recharts';
import AnimatedDot from './AnimatedDot';
import AdvisorInsights from './AdvisorInsights';
import CareerCorner from './CareerCorner';
import SelfAssessmentModal from './SelfAssessmentModal';
import OnboardingModal from './OnboardingModal';
import StudentAccountSettings from './StudentAccountSettings';
import { supabase } from '../lib/supabaseClient';
import { ClassRecord, School, SelfAssessment, Student, StudentShoutout, WeeklyAttendance, WeeklyClassGrade, WeeklyGpaSnapshot } from '../lib/types';
import { SHOUTOUT_CONFIG } from './ShoutoutModal';

interface Celebration {
  emoji: string;
  headline: string;
  subtext: string;
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

  const gpaSnapshots = weeklyGpa
    .filter((r) => r.school_year === activeYear)
    .sort((a, b) => a.week_number - b.week_number);

  const absencesByWeek = new Map<number, number>();
  attendance
    .filter((r) => r.school_year === activeYear)
    .forEach((r) => {
      absencesByWeek.set(r.week_number, (absencesByWeek.get(r.week_number) ?? 0) + Number(r.absent_days));
    });

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

  const latestAssessment = selfAssessments
    .filter((a) => a.school_year === activeYear)
    .sort((a, b) => b.week_number - a.week_number)[0] ?? null;

  let gpaStreak = 0;
  for (let i = gpaSnapshots.length - 1; i > 0; i--) {
    if (Number(gpaSnapshots[i].gpa) > Number(gpaSnapshots[i - 1].gpa)) gpaStreak++;
    else break;
  }
  if (gpaStreak >= 3) return {
    emoji: '🔥',
    headline: `${gpaStreak}-week growth streak — you're on a roll, ${name}!`,
    subtext: `Your GPA has gone up ${gpaStreak} weeks in a row. Keep this momentum going.`,
  };

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
  };

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
  };

  const latestGpaSnap = gpaSnapshots[gpaSnapshots.length - 1] ?? null;
  const prevGpaSnap = gpaSnapshots[gpaSnapshots.length - 2] ?? null;

  if (latestGpaSnap && prevGpaSnap && Number(latestGpaSnap.gpa) > Number(prevGpaSnap.gpa)) return {
    emoji: '📊',
    headline: `Your GPA went up this week, ${name}!`,
    subtext: `You moved the needle. That's what this is all about.`,
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
  };

  if (absencesByWeek.get(currentWeekNumber) === 0) return {
    emoji: '✅',
    headline: `Perfect attendance this week!`,
    subtext: `You were here every single day. That matters more than you think.`,
  };

  if (latestAssessment && latestAssessment.week_number === currentWeekNumber && latestAssessment.effort_rating >= 4) return {
    emoji: '💪',
    headline: `You said you gave a lot this week.`,
    subtext: `That effort is going to show up in your grades — keep it going.`,
  };

  const weekOneSnap = gpaSnapshots.find((r) => r.week_number === 1) ?? null;
  if (latestGpaSnap && weekOneSnap && Number(latestGpaSnap.gpa) > Number(weekOneSnap.gpa)) {
    const growth = (Number(latestGpaSnap.gpa) - Number(weekOneSnap.gpa)).toFixed(2);
    return {
      emoji: '📈',
      headline: `You've grown ${growth} points since Week 1, ${name}!`,
      subtext: `That's real progress over real time.`,
    };
  }

  let totalAbsencesCheck = 0;
  absencesByWeek.forEach((v) => { totalAbsencesCheck += v; });
  if (absencesByWeek.size > 0 && totalAbsencesCheck <= 3) return {
    emoji: '⭐',
    headline: `Outstanding attendance this semester!`,
    subtext: `You've barely missed a day — that consistency is a superpower.`,
  };

  for (const { subject, history } of gradesByClass.values()) {
    if (history.length < 2) continue;
    const maxVal = Math.max(...history.map((h) => h.value));
    const thisWeekEntry = history.find((h) => h.week === currentWeekNumber);
    if (thisWeekEntry && thisWeekEntry.value === maxVal) return {
      emoji: '🏆',
      headline: `${subject} is at its best point all semester!`,
      subtext: `Week ${currentWeekNumber} is your personal best in ${subject} — remember this feeling.`,
    };
  }

  const weeksLeft = Math.max(0, semesterWeeks - currentWeekNumber);
  return {
    emoji: '📅',
    headline: `You have ${weeksLeft} weeks left to shape how this semester ends, ${name}.`,
    subtext: `Every week is a chance to move the needle. What will this week be?`,
  };
}

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

// ─── ProjectionLine (Recharts Customized component) ─────────────────────────

function ProjectionLine(props: any) {
  const {
    xAxisMap, yAxisMap, offset,
    lastGpaPoint, semesterWeeks,
    localTargetGpa, isDragging, pendingTargetGpa,
    dragSvgX, dragSvgY,
    saveStatus, isHandleHovering,
    onHandlePointerDown, onHandlePointerEnter, onHandlePointerLeave,
    yScaleRef, chartOffsetRef,
  } = props;

  const yAxis = Object.values(yAxisMap ?? {})[0] as any;
  const xAxis = Object.values(xAxisMap ?? {})[0] as any;
  if (!yAxis?.scale || !xAxis?.scale || !lastGpaPoint) return null;

  yScaleRef.current = yAxis.scale;
  chartOffsetRef.current = offset;

  const bw = xAxis.scale.bandwidth?.() ?? 0;
  const scaleX = (week: number) => {
    const pos = xAxis.scale(week) ?? xAxis.scale(String(week));
    return (typeof pos === 'number' ? pos : NaN) + bw / 2;
  };

  const x0 = scaleX(lastGpaPoint.week_number);
  const y0 = yAxis.scale(lastGpaPoint.gpa);
  if (!Number.isFinite(x0) || !Number.isFinite(y0)) return null;

  const xEnd = scaleX(semesterWeeks);

  const displayTarget = isDragging
    ? (pendingTargetGpa ?? (localTargetGpa > 0 ? localTargetGpa : null))
    : (localTargetGpa > 0 ? localTargetGpa : null);
  const hasTarget = displayTarget !== null;
  const yEnd = hasTarget ? yAxis.scale(displayTarget!) : null;

  return (
    <g>
      {hasTarget && !isDragging && yEnd !== null && (
        <line
          x1={x0} y1={y0} x2={xEnd} y2={yEnd}
          stroke="var(--color-accent)" strokeWidth={2} strokeDasharray="7 4" opacity={0.9}
          style={{ pointerEvents: 'none' }}
        />
      )}

      {isDragging && dragSvgX != null && dragSvgY != null && (
        <line
          x1={x0} y1={y0} x2={dragSvgX} y2={dragSvgY}
          stroke="var(--color-accent)" strokeWidth={2.5} strokeDasharray="7 4"
          style={{ pointerEvents: 'none' }}
        />
      )}

      {hasTarget && !isDragging && yEnd !== null && Number.isFinite(xEnd) && (
        <g
          transform={`translate(${xEnd}, ${yEnd})`}
          style={{ transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
        >
          <circle r={13} fill="var(--color-accent)" />
          <circle r={7} fill="white" />
          <circle r={3} fill="var(--color-accent)" />
          {saveStatus === 'saved' && (
            <circle r={13} fill="none" stroke="var(--color-accent)" strokeWidth={2.5}>
              <animate attributeName="r" values="13;24;13" dur="0.6s" />
              <animate attributeName="opacity" values="0.9;0;0" dur="0.6s" />
            </circle>
          )}
          <rect x={-32} y={-28} width={64} height={18} rx={4} fill="var(--color-accent)" />
          <text x={0} y={-15} fill="var(--color-accent-dark)" fontSize={11} fontWeight="bold" textAnchor="middle">
            Goal: {(localTargetGpa as number).toFixed(1)}
          </text>
        </g>
      )}

      {(isHandleHovering || isDragging) && (
        <circle cx={x0} cy={y0} r={16} fill="var(--color-accent)" opacity={0.15}
          style={{ pointerEvents: 'none' }} />
      )}

      <circle
        cx={x0} cy={y0} r={10}
        fill="transparent"
        stroke={isHandleHovering ? 'var(--color-accent)' : 'transparent'}
        strokeWidth={2}
        style={{ cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
        onPointerDown={onHandlePointerDown}
        onPointerEnter={onHandlePointerEnter}
        onPointerLeave={onHandlePointerLeave}
      />

      {isHandleHovering && !isDragging && (
        <g transform={`translate(${x0}, ${y0 - 28})`}>
          <rect x={-56} y={-16} width={112} height={18} rx={5} fill="var(--color-primary-dark)" />
          <text x={0} y={-3} fill="white" fontSize={11} fontWeight="500" textAnchor="middle">
            Drag to set your goal
          </text>
        </g>
      )}

      {isDragging && pendingTargetGpa != null && dragSvgX != null && dragSvgY != null && (
        <g transform={`translate(${dragSvgX + 12}, ${dragSvgY - 20})`}>
          <rect x={-4} y={-16} width={80} height={20} rx={5} fill="var(--color-accent)" />
          <text x={36} y={-2} fill="var(--color-accent-dark)" fontSize={12} fontWeight="bold" textAnchor="middle">
            Goal: {pendingTargetGpa.toFixed(2)}
          </text>
        </g>
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

const gradeColors = ['#1C7D6B', '#9333ea', '#be123c', '#d97706', '#2563eb', '#047857'];

const parseGrade = (grade: string | null, gradePoints: number | null) => {
  if (!grade && gradePoints !== null) return gradePoints;
  if (!grade) return null;
  const parsed = Number(grade);
  return Number.isFinite(parsed) ? parsed : gradePoints;
};

const chartColors = {
  grid: 'var(--color-border)',
  axis: 'var(--color-text-muted)',
  tooltipBg: 'var(--color-card)',
  tooltipBorder: 'var(--color-border)',
  tooltipText: 'var(--color-text-primary)',
  tooltipItem: 'var(--color-text-secondary)',
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
  const [shoutouts, setShoutouts] = useState<StudentShoutout[]>([]);
  const [showAllHighlights, setShowAllHighlights] = useState(false);
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [advisorRefreshKey, setAdvisorRefreshKey] = useState(0);
  const [careerFavorites, setCareerFavorites] = useState<import('../lib/types').StudentCareerFavorite[]>([]);
  const [localTargetGpa, setLocalTargetGpa] = useState(0);
  const [pendingTargetGpa, setPendingTargetGpa] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'pending' | 'saved'>('idle');
  const [isHandleHovering, setIsHandleHovering] = useState(false);
  const [dragSvgX, setDragSvgX] = useState<number | null>(null);
  const [dragSvgY, setDragSvgY] = useState<number | null>(null);
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
        if (isStudentSelf && !studentRecord.onboarding_completed) setShowOnboarding(true);

        const [schoolResponse, gpaResponse, attendanceResponse, classGradesResponse, shoutoutsResponse] = await Promise.all([
          supabase.from('schools').select('*').eq('id', studentRecord.school_id).maybeSingle(),
          supabase.from('weekly_gpa_snapshots').select('*').eq('student_id', id),
          supabase.from('weekly_attendance').select('*').eq('student_id', id),
          supabase.from('weekly_class_grades').select('*').eq('student_id', id),
          supabase.from('student_shoutouts').select('*').eq('student_id', id).order('created_at', { ascending: false })
        ]);

        if (schoolResponse.error) throw schoolResponse.error;
        if (gpaResponse.error) throw gpaResponse.error;
        if (attendanceResponse.error) throw attendanceResponse.error;
        if (classGradesResponse.error) throw classGradesResponse.error;

        if (schoolResponse.data) setSchool(schoolResponse.data as School);
        setWeeklyGpa((gpaResponse.data ?? []) as WeeklyGpaSnapshot[]);
        setAttendance((attendanceResponse.data ?? []) as WeeklyAttendance[]);
        setWeeklyGrades((classGradesResponse.data ?? []) as WeeklyClassGrade[]);
        setShoutouts((shoutoutsResponse.data ?? []) as StudentShoutout[]);

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

  useEffect(() => {
    if (student?.target_gpa != null) setLocalTargetGpa(student.target_gpa);
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
    setIsHandleHovering(false);
    setSaveStatus('idle');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  }, []);

  const handleHandlePointerEnter = useCallback(() => setIsHandleHovering(true), []);
  const handleHandlePointerLeave = useCallback(() => setIsHandleHovering(false), []);

  const handleChartPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !yScaleRef.current?.invert || !chartOffsetRef.current) return;
    const rect = chartWrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    const offset = chartOffsetRef.current;
    const svgX = Math.max(offset.left, Math.min(offset.left + offset.width, e.clientX - rect.left));
    const svgY = Math.max(offset.top, Math.min(offset.top + offset.height, e.clientY - rect.top));
    setDragSvgX(svgX);
    setDragSvgY(svgY);
    const relY = svgY - offset.top;
    const raw = yScaleRef.current.invert(relY);
    const clamped = Math.max(0, Math.min(4, raw));
    setPendingTargetGpa(Math.round(clamped * 10) / 10);
  }, [isDragging]);

  const handleChartPointerUp = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    setDragSvgX(null);
    setDragSvgY(null);
    const snapped = pendingTargetGpa ?? (localTargetGpa > 0 ? localTargetGpa : null);
    if (snapped == null) return;
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
    const absencesByWeek = new Map<number, number>();
    attendance
      .filter((r) => r.school_year === activeYear)
      .forEach((r) => {
        absencesByWeek.set(r.week_number, (absencesByWeek.get(r.week_number) ?? 0) + Number(r.absent_days));
      });
    return studentGpaSeries.map((point) => {
      const a = selfAssessments.find(
        (s) => s.school_year === activeYear && s.week_number === point.week_number
      );
      const absences = absencesByWeek.has(point.week_number) ? absencesByWeek.get(point.week_number)! : null;
      return { ...point, effort: a?.effort_rating ?? null, absences };
    });
  }, [studentGpaSeries, selfAssessments, activeYear, attendance]);

  const hasEffortData = useMemo(
    () => gpaWithEffortSeries.filter((p) => p.effort !== null).length >= 2,
    [gpaWithEffortSeries]
  );

  const hasAttendanceData = useMemo(
    () => attendance.filter((r) => r.school_year === activeYear).length >= 2,
    [attendance, activeYear]
  );

  const latestAttendanceWeek = useMemo(
    () => attendance.filter((r) => r.school_year === activeYear).reduce((max, r) => Math.max(max, r.week_number), 0),
    [attendance, activeYear]
  );

  const hasAbsenceNote = useMemo(
    () => attendance.some((r) => r.school_year === activeYear && Number(r.absent_days) >= 2),
    [attendance, activeYear]
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
          const parsed = parseGrade(grade.grade ?? null, grade.grade_points ?? null);
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
    const base = 'whitespace-nowrap px-4 py-4';
    if (weekIndex === 0 || grade === null || previousGrade === null) {
      return `${base} text-[var(--color-text-primary)]`;
    }
    const delta = grade - previousGrade;
    if (delta > 0) return `${base} bg-[var(--color-green-highlight)] text-[#1a6b50]`;
    if (delta < 0) return `${base} bg-[var(--color-red-highlight)] text-[#9B3535]`;
    return `${base} text-[var(--color-text-primary)]`;
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
        .map((grade) => ({ week_number: grade.week_number, grade: parseGrade(grade.grade ?? null, grade.grade_points ?? null) }))
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

  // suppress unused warning — gpaGrowth may be used for future features
  void gpaGrowth;

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
        <div className="flex min-h-screen items-center justify-center px-4">
          <div className="rounded-3xl p-8 shadow-sm" style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Loading student view…</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-10 shadow-sm">
            <p className="text-sm font-semibold text-rose-700">Unable to load student details</p>
            <p className="mt-4" style={{ color: 'var(--color-text-primary)' }}>{error}</p>
            <Link
              to="/dashboard"
              className="mt-6 inline-flex rounded-full px-5 py-3 text-sm font-semibold text-white transition"
              style={{ background: 'var(--color-primary)' }}
            >
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

  const handleStudentUpdate = (updatedStudent: Student) => {
    setStudent(updatedStudent);
    setAdvisorRefreshKey(k => k + 1);
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      {/* ── Onboarding modal (student self only, shown before dashboard loads) ── */}
      {showOnboarding && isStudentSelf && (
        <OnboardingModal
          student={student}
          onComplete={(updated) => { handleStudentUpdate(updated); setShowOnboarding(false); }}
        />
      )}

      {/* ── Account settings slide-out ── */}
      {showSettings && isStudentSelf && (
        <StudentAccountSettings
          student={student}
          onClose={() => setShowSettings(false)}
          onSaved={(updated) => { handleStudentUpdate(updated); setShowSettings(false); }}
        />
      )}

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ── Welcome header ── */}
        <div
          className="flex flex-col gap-6 rounded-[2rem] p-8 shadow-sm sm:flex-row sm:items-end sm:justify-between"
          style={{ background: 'var(--color-card-tint)', border: '1px solid var(--color-border)' }}
        >
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em]" style={{ color: 'var(--color-text-muted)' }}>Welcome</p>
            <h1 className="mt-3 text-4xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>Welcome, {student.first_name}!</h1>
            <p className="mt-2 text-base" style={{ color: 'var(--color-text-secondary)' }}>Week {currentWeekNumber} of {semesterWeeks}</p>
          </div>
          <div className="flex items-center gap-3">
            {isStudentSelf ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowSettings(true)}
                  className="inline-flex items-center justify-center rounded-full p-2.5 transition"
                  style={{ border: '1px solid var(--color-border)', background: 'var(--color-card)', color: 'var(--color-text-secondary)' }}
                  aria-label="Account settings"
                  title="Account settings"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => supabase.auth.signOut()}
                  className="inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition"
                  style={{ border: '1px solid var(--color-border)', background: 'var(--color-card)', color: 'var(--color-text-secondary)' }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                to="/"
                className="inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold text-white transition"
                style={{ background: 'var(--color-primary)' }}
              >
                Back to dashboard
              </Link>
            )}
          </div>
        </div>

        {/* ── Celebration banner ── */}
        {celebration && (
          <div
            className="mt-6 rounded-[2rem] px-7 py-8 text-white shadow-xl"
            style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))' }}
          >
            <div className="flex items-start gap-5">
              <span className="text-4xl leading-none" role="img">{celebration.emoji}</span>
              <div>
                <p className="text-xl font-bold leading-snug">{celebration.headline}</p>
                <p className="mt-2 text-sm font-medium opacity-80">{celebration.subtext}</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Highlights panel ── */}
        <div
          className="mt-6 rounded-[2rem] p-6 shadow-sm"
          style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: 'var(--color-text-muted)' }}>Your highlights</p>
            {shoutouts.length > 0 && (
              <span
                className="rounded-full px-2 py-0.5 text-xs font-bold"
                style={{ background: 'var(--color-card-tint)', color: 'var(--color-primary)', border: '1px solid var(--color-border)' }}
              >
                {shoutouts.length}
              </span>
            )}
          </div>
          {shoutouts.length === 0 ? (
            <p className="mt-4 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Your advisor will add highlights here as the semester unfolds.
            </p>
          ) : (
            <>
              <div className="mt-4 space-y-3">
                {(showAllHighlights ? shoutouts : shoutouts.slice(0, 3)).map((s) => {
                  const cfg = SHOUTOUT_CONFIG[s.shoutout_type];
                  const weeksAgo = s.week_number != null ? currentWeekNumber - s.week_number : null;
                  const timeLabel = weeksAgo === null ? ''
                    : weeksAgo <= 0 ? 'This week'
                    : weeksAgo === 1 ? 'Last week'
                    : `Week ${s.week_number}`;
                  return (
                    <div key={s.id} className={`rounded-2xl border ${cfg.bg} ${cfg.border} p-4`}>
                      <div className="flex items-start gap-3">
                        <span className="text-2xl leading-none">{cfg.emoji}</span>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{s.shoutout_text}</p>
                          {s.personal_note && (
                            <p className="mt-1 text-sm italic" style={{ color: 'var(--color-text-secondary)' }}>"{s.personal_note}"</p>
                          )}
                          {timeLabel && (
                            <p className="mt-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>{timeLabel}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {shoutouts.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowAllHighlights((prev) => !prev)}
                  className="mt-4 text-sm font-semibold transition"
                  style={{ color: 'var(--color-primary)' }}
                >
                  {showAllHighlights ? 'Show fewer' : `See all ${shoutouts.length} highlights`}
                </button>
              )}
            </>
          )}
        </div>

        {/* ── Top grower banner ── */}
        {isTopGrower && (
          <div
            className="mt-6 rounded-[2rem] px-6 py-6 shadow-sm"
            style={{ border: '2px solid var(--color-accent)', background: '#FFFBEB' }}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: 'var(--color-accent-dark)' }}>Top grower this week</p>
            <p className="mt-2 text-lg font-semibold" style={{ color: 'var(--color-accent-dark)' }}>
              You had the highest GPA growth in the advisory this week. Keep it up!
            </p>
          </div>
        )}

        {/* ── Three callout cards ── */}
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          <div className="rounded-[2rem] p-6 shadow-sm" style={{ background: 'var(--color-card-tint)', border: '1px solid var(--color-border)' }}>
            <p className="text-sm uppercase tracking-[0.3em]" style={{ color: 'var(--color-text-muted)' }}>Your best class so far</p>
            <p className="mt-4 text-2xl font-semibold" style={{ color: 'var(--color-primary)' }}>{bestClass?.subject ?? 'No data yet'}</p>
            <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>Highest current-week grade across your classes.</p>
          </div>
          <div className="rounded-[2rem] p-6 shadow-sm" style={{ background: '#FFFBEB', border: '1px solid var(--color-accent)' }}>
            <p className="text-sm uppercase tracking-[0.3em]" style={{ color: 'var(--color-accent-dark)' }}>Your biggest growth</p>
            <p className="mt-4 text-2xl font-semibold" style={{ color: '#7a5e00' }}>{biggestGrowth?.subject ?? 'No data yet'}</p>
            <p className="mt-2 text-sm" style={{ color: '#7a5e00', opacity: 0.8 }}>Largest week-over-week grade increase this semester.</p>
          </div>
          <div className="rounded-[2rem] p-6 shadow-sm" style={{ background: '#FFF5F5', border: '1px solid #f5b8b8' }}>
            <p className="text-sm uppercase tracking-[0.3em]" style={{ color: '#9B3535' }}>Your biggest opportunity</p>
            <p className="mt-4 text-2xl font-semibold" style={{ color: '#9B3535' }}>{biggestOpportunity?.subject ?? 'No data yet'}</p>
            <p className="mt-2 text-sm" style={{ color: '#9B3535', opacity: 0.8 }}>Lowest current-week grade to help focus on improvement.</p>
          </div>
        </div>

        {/* ── Advisor insights ── */}
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
          shoutouts={shoutouts}
          refreshKey={advisorRefreshKey}
          favorites={careerFavorites}
        />

        {/* ── GPA chart ── */}
        <div
          className="mt-8 rounded-[2rem] p-6 shadow-sm"
          style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em]" style={{ color: 'var(--color-text-muted)' }}>Weekly GPA</p>
              <h3 className="mt-2 text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>Your GPA trend</h3>
            </div>
            <div className="flex items-center gap-3">
              {saveStatus === 'pending' && (
                <button
                  type="button"
                  onClick={() => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); saveTargetGpa(localTargetGpa); }}
                  className="rounded-full px-4 py-1.5 text-xs font-semibold text-white transition"
                  style={{ background: 'var(--color-accent)', color: 'var(--color-accent-dark)' }}
                >
                  Save goal: {localTargetGpa.toFixed(1)}
                </button>
              )}
              {saveStatus === 'saved' && (
                <span className="text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>Goal saved!</span>
              )}
              {saveStatus === 'idle' && (
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {localTargetGpa > 0
                    ? <>Goal: <span className="font-semibold" style={{ color: 'var(--color-accent-dark)' }}>{localTargetGpa.toFixed(1)}</span></>
                    : <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Drag the endpoint to set your goal</span>
                  }
                </p>
              )}
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
                <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" />
                <XAxis dataKey="week_number" tickFormatter={(value) => `W${value}`} tick={{ fill: chartColors.axis, fontSize: 12 }} />
                <YAxis yAxisId="gpa" domain={[0, 4]} tick={{ fill: chartColors.axis, fontSize: 12 }} />
                {(hasAttendanceData || hasEffortData) && (
                  <YAxis yAxisId="right" orientation="right" domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} tick={{ fill: chartColors.axis, fontSize: 12 }} />
                )}
                <Tooltip
                  formatter={(value: any, name: string) => [
                    typeof value === 'number' ? (name === 'Effort' ? `${value}/5` : value.toFixed(2)) : value,
                    name
                  ]}
                  contentStyle={{ backgroundColor: chartColors.tooltipBg, borderColor: chartColors.tooltipBorder, color: chartColors.tooltipText, borderRadius: 12 }}
                  labelStyle={{ color: chartColors.tooltipText }}
                  itemStyle={{ color: chartColors.tooltipItem }}
                />
                {(hasEffortData || hasAttendanceData) && <Legend />}
                <Customized
                  component={ProjectionLine}
                  lastGpaPoint={latestGpaPoint}
                  semesterWeeks={semesterWeeks}
                  localTargetGpa={localTargetGpa}
                  isDragging={isDragging}
                  pendingTargetGpa={pendingTargetGpa}
                  dragSvgX={dragSvgX}
                  dragSvgY={dragSvgY}
                  saveStatus={saveStatus}
                  isHandleHovering={isHandleHovering}
                  onHandlePointerDown={handleTargetPointerDown}
                  onHandlePointerEnter={handleHandlePointerEnter}
                  onHandlePointerLeave={handleHandlePointerLeave}
                  yScaleRef={yScaleRef}
                  chartOffsetRef={chartOffsetRef}
                />
                <Line
                  yAxisId="gpa"
                  type="monotone"
                  dataKey="gpa"
                  stroke="var(--color-primary)"
                  strokeWidth={3}
                  dot={(props) => <AnimatedDot {...props} highlightWeek={latestGpaPoint?.week_number ?? 1} />}
                  activeDot={{ r: 8 }}
                  connectNulls={false}
                  isAnimationActive={true}
                  name="GPA"
                />
                {hasEffortData && (
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="effort"
                    stroke="var(--color-accent)"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ r: 3, fill: 'var(--color-accent)' }}
                    activeDot={{ r: 6 }}
                    connectNulls={false}
                    isAnimationActive={true}
                    name="Effort"
                  />
                )}
                {hasAttendanceData && (
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="absences"
                    stroke="#E05C38"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={(props) => <AnimatedDot {...props} highlightWeek={latestAttendanceWeek} />}
                    activeDot={{ r: 6 }}
                    connectNulls={false}
                    isAnimationActive={true}
                    name="Weekly absences"
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
          {hasAbsenceNote && (
            <p className="mt-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Attendance and GPA often move together — weeks with more absences can affect your grades.
            </p>
          )}
        </div>

        {/* ── Path to target ── */}
        {pathToTarget && pathToTarget.recommendations.length > 0 && (
          <div
            className="mt-6 rounded-[2rem] p-6 shadow-sm"
            style={{ background: '#FFFBEB', border: '1px solid var(--color-accent)' }}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: 'var(--color-accent-dark)' }}>Your path to {localTargetGpa.toFixed(1)}</p>
            <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Gap to close: <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{Math.abs(pathToTarget.gapToClose).toFixed(2)} GPA points</span>
            </p>
            <div className="mt-4 space-y-3">
              {pathToTarget.recommendations.map((rec, i) => (
                <div
                  key={rec.className}
                  className="flex items-start gap-4 rounded-2xl px-4 py-4 shadow-sm"
                  style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                    style={{ background: 'var(--color-accent)', color: 'var(--color-accent-dark)' }}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{rec.className}</span>
                      <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        {rec.currentGrade} → <span className="font-semibold" style={{ color: 'var(--color-accent-dark)' }}>{rec.targetGrade}</span>
                      </span>
                    </div>
                    <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>{rec.reason}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              If you hit these targets, your GPA will land right where you want it by Week {semesterWeeks}.
            </p>
          </div>
        )}

        {/* ── Grade table ── */}
        <div
          className="mt-8 rounded-[2rem] p-6 shadow-sm"
          style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
        >
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em]" style={{ color: 'var(--color-text-muted)' }}>Class grades</p>
              <h3 className="mt-2 text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>Weekly grade table</h3>
            </div>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Showing Week 1 through Week {Math.max(1, ...weeklyGrades.map((row) => row.week_number))}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm" style={{ borderTop: '1px solid var(--color-border)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <th className="whitespace-nowrap px-4 py-3 font-semibold" style={{ color: 'var(--color-text-primary)' }}>Subject</th>
                  {Array.from({ length: Math.max(1, ...weeklyGrades.map((row) => row.week_number)) }, (_, index) => (
                    <th key={index} className="whitespace-nowrap px-4 py-3 font-semibold" style={{ color: 'var(--color-text-primary)' }}>W{index + 1}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gradeRows.map((row, rowIdx) => (
                  <tr
                    key={row.classId}
                    style={{
                      background: rowIdx % 2 === 0 ? 'var(--color-card)' : 'var(--color-card-tint)',
                      borderBottom: '1px solid var(--color-border)',
                    }}
                  >
                    <td className="whitespace-nowrap px-4 py-4 font-medium" style={{ color: 'var(--color-text-primary)' }}>{row.subject}</td>
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

        {/* ── Class grade trends chart ── */}
        <div
          className="mt-8 rounded-[2rem] p-6 shadow-sm"
          style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em]" style={{ color: 'var(--color-text-muted)' }}>Class grade trends</p>
              <h3 className="mt-2 text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>Subject performance over time</h3>
            </div>
          </div>
          <div className="mt-6 h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={gradeGraphData}>
                <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" />
                <XAxis dataKey="week_number" tickFormatter={(value) => `W${value}`} tick={{ fill: chartColors.axis, fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fill: chartColors.axis, fontSize: 12 }} />
                <Tooltip
                  formatter={(value: any) => (typeof value === 'number' ? value.toFixed(0) : value)}
                  contentStyle={{ backgroundColor: chartColors.tooltipBg, borderColor: chartColors.tooltipBorder, color: chartColors.tooltipText, borderRadius: 12 }}
                  labelStyle={{ color: chartColors.tooltipText }}
                  itemStyle={{ color: chartColors.tooltipItem }}
                />
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

        {/* ── Your Next Chapter ── */}
        <CareerCorner
          student={student}
          weeklyGrades={weeklyGrades}
          classes={classes}
          school={school}
          activeYear={activeYear}
          onOpenProfile={isStudentSelf ? () => setShowSettings(true) : undefined}
          isStudentSelf={isStudentSelf}
          onFavoritesChange={setCareerFavorites}
        />

      </div>
    </div>
  );
}
