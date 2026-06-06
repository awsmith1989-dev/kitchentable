import { useEffect, useState } from 'react';
import { SelfAssessment, Student, StudentShoutout, WeeklyGpaSnapshot, WeeklyClassGrade, WeeklyAttendance, ClassRecord } from '../lib/types';
import { PathToTargetResult } from './StudentView';

interface AdvisorInsightsProps {
  student: Student;
  weeklyGpa: WeeklyGpaSnapshot[];
  weeklyGrades: WeeklyClassGrade[];
  weeklyAttendance: WeeklyAttendance[];
  classes: ClassRecord[];
  activeYear: string;
  schoolState: string;
  selfAssessment: SelfAssessment | null;
  pathToTarget?: PathToTargetResult | null;
  shoutouts?: StudentShoutout[];
}

export default function AdvisorInsights({
  student,
  weeklyGpa,
  weeklyGrades,
  weeklyAttendance,
  classes,
  activeYear,
  schoolState,
  selfAssessment,
  pathToTarget,
  shoutouts,
}: AdvisorInsightsProps) {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateInsight = async () => {
    setLoading(true);
    setError(null);

    try {
      // GPA trend
      const snapshots = weeklyGpa
        .filter((row) => row.student_id === student.id && row.school_year === activeYear)
        .sort((a, b) => a.week_number - b.week_number);

      const latestGpa = snapshots[snapshots.length - 1]?.gpa ?? null;
      const previousGpa = snapshots[snapshots.length - 2]?.gpa ?? null;
      const gpaTrend =
        latestGpa !== null && previousGpa !== null
          ? latestGpa > previousGpa
            ? 'growing'
            : latestGpa < previousGpa
              ? 'declining'
              : 'stable'
          : 'stable';

      // Attendance — most recent week with data
      const studentAttendance = weeklyAttendance.filter(
        (row) => row.student_id === student.id && row.school_year === activeYear
      );
      const latestAttendanceWeek = studentAttendance.reduce((max, r) => Math.max(max, r.week_number), 0);
      const absencesThisWeek = studentAttendance
        .filter((r) => r.week_number === latestAttendanceWeek)
        .reduce((sum, r) => sum + Number(r.absent_days), 0);
      const attendanceSummary =
        latestAttendanceWeek === 0
          ? 'no attendance data yet'
          : absencesThisWeek >= 5
            ? 'high absences this week'
            : absencesThisWeek === 0
              ? 'near-perfect attendance'
              : 'a few missed days this week';

      // Subject performance — only include if we have real week-over-week data
      const studentGrades = weeklyGrades.filter(
        (g) => g.student_id === student.id && g.school_year === activeYear
      );
      const latestGradeWeek = studentGrades.reduce((max, g) => Math.max(max, g.week_number), 0);
      const subjectNotes: string[] = [];

      if (latestGradeWeek > 0) {
        const currentWeek = studentGrades.filter((g) => g.week_number === latestGradeWeek);
        const prevWeek = studentGrades.filter((g) => g.week_number === latestGradeWeek - 1);

        currentWeek.forEach((row) => {
          const cls = classes.find((c) => c.id === row.class_id);
          const subjectName = cls?.subject || cls?.name;
          if (!subjectName || row.grade_points == null) return;
          const prev = prevWeek.find((p) => p.class_id === row.class_id);
          if (prev?.grade_points == null) return;
          const delta = row.grade_points - prev.grade_points;
          if (delta > 0) subjectNotes.push(`${subjectName} improving`);
          else if (delta < 0) subjectNotes.push(`${subjectName} declining`);
        });
      }

      const postSecondaryPlans = student.post_secondary_plans?.length
        ? student.post_secondary_plans.join(', ')
        : 'not specified';

      const subjectLine = subjectNotes.length > 0
        ? `Subject changes this week: ${subjectNotes.join(', ')}.`
        : '';

      const academicLabel = selfAssessment?.academic_self_assessment === 'better' ? 'better than last week'
        : selfAssessment?.academic_self_assessment === 'same' ? 'about the same as last week'
        : selfAssessment?.academic_self_assessment === 'worse' ? 'not their best week (student self-reported)'
        : null;
      const selfAssessmentLine = selfAssessment
        ? `Student self-assessment (Week ${selfAssessment.week_number}): academic — ${academicLabel}; effort rating — ${selfAssessment.effort_rating}/5.`
        : '';

      const strengthsLine = student.strengths?.length
        ? `Identified strengths: ${student.strengths.join(', ')}.`
        : '';

      // Shoutout history — recent highlights + pattern detection
      const shoutoutLines: string[] = [];
      if (shoutouts && shoutouts.length > 0) {
        shoutoutLines.push('Recent highlights from advisor:');
        shoutouts.slice(0, 5).forEach((s) => {
          const emoji = s.shoutout_type === 'strength' ? '🌟' : s.shoutout_type === 'growth' ? '📈' : '🤝';
          const weekPart = s.week_number ? ` (Week ${s.week_number})` : '';
          shoutoutLines.push(`- ${emoji} ${s.shoutout_type}: "${s.shoutout_text}"${weekPart}`);
        });
        const counts = shoutouts.reduce(
          (acc, s) => { acc[s.shoutout_type] = (acc[s.shoutout_type] ?? 0) + 1; return acc; },
          {} as Record<string, number>
        );
        if ((counts.character ?? 0) >= 3)
          shoutoutLines.push('Pattern: 3+ character recognitions — this student has strong interpersonal qualities; name that specifically.');
        if ((counts.growth ?? 0) >= 3)
          shoutoutLines.push('Pattern: 3+ growth recognitions — this student shows a consistent improvement pattern.');
        if ((counts.strength ?? 0) >= 3)
          shoutoutLines.push('Pattern: 3+ strength recognitions — this student has clear, repeatedly-noted personal strengths.');
      }
      const shoutoutContext = shoutoutLines.join('\n');

      const latestGpaSnap = weeklyGpa
        .filter((r) => r.school_year === activeYear)
        .sort((a, b) => b.week_number - a.week_number)[0];

      const hasTarget = !!(pathToTarget && pathToTarget.gapToClose > 0 && pathToTarget.recommendations.length > 0);

      const pathContext = hasTarget && pathToTarget
        ? [
            `Student's target GPA: ${latestGpaSnap ? (Number(latestGpaSnap.gpa) + pathToTarget.gapToClose).toFixed(2) : 'set'}`,
            `Gap to close: ${pathToTarget.gapToClose.toFixed(2)} GPA points`,
            `Recommended focus classes:`,
            ...pathToTarget.recommendations.map((r, i) =>
              `${i + 1}. ${r.className} — currently ${r.currentGrade}, targeting ${r.targetGrade}. ${r.reason}`
            ),
          ].join('\n')
        : '';

      const prompt = `Write a 3–4 sentence advisor reflection for ${student.first_name}, addressed directly to them in second person. Do not include a title, heading, or any markdown formatting — plain prose only.

${hasTarget
  ? `The student has set a target GPA. Make the insight specifically about their path to that goal. Name the 1–2 classes where focused effort will move the needle most. Be concrete — tell them exactly what moving their grade in a specific class would mean for their overall trajectory. Frame it as achievable and within reach. Never make the goal sound out of reach.`
  : `The reflection has two parts:\n1. A warm, specific observation about their current academic progress this year (GPA trend, attendance, and any notable subject shifts). If a self-assessment is provided, weave it in naturally. If strengths are listed, call out at least one by name.\n2. One or two sentences connecting their interests and strengths to real career paths or post-secondary options in ${schoolState || 'their state'}.`
}

Student data:
- GPA trend this year: ${gpaTrend}
- Attendance: ${attendanceSummary}
${subjectLine}
${selfAssessmentLine}
${strengthsLine}
${shoutoutContext}
${pathContext}
- Interests: ${student.interests || 'not specified'}
- Post-secondary plans: ${postSecondaryPlans}
- School state: ${schoolState || 'not specified'}

Rules:
- Never mention raw GPA numbers or letter grades
- No title, no heading, no bullet points, no markdown — flowing prose only
- Use "you" and "your" throughout
- Name real career fields or institutions in ${schoolState || 'their state'} where relevant
- If highlights are listed, reference at least one specific shoutout by name — quote the exact text naturally in the sentence
- If a pattern is noted in the highlights, make that the emotional anchor of the insight
- 3–4 sentences total`;

      const response = await fetch('/.netlify/functions/advisor-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Advisor insight function error:', response.status, errorText);
        throw new Error('Unable to generate insight');
      }

      const data = await response.json();
      console.log('AdvisorInsight function response:', data);

      const insightText =
        typeof data.insight === 'string' ? data.insight :
        typeof data.content?.[0]?.text === 'string' ? data.content[0].text :
        typeof data.completion === 'string' ? data.completion :
        null;

      // Strip any leading markdown heading the model might add despite instructions
      const cleaned = insightText
        ?.replace(/^#+\s+[^\n]*\n+/, '')
        .trim();

      setInsight(cleaned || 'Unable to generate insight at this time.');
    } catch (err: any) {
      setError(err.message || 'An error occurred while generating the insight.');
      setInsight(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generateInsight();
  }, [student.id, activeYear]);

  return (
    <div className="mt-8 rounded-[2rem] border-2 border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-blue-50 p-6 shadow-sm dark:border-slate-600 dark:from-slate-800/60 dark:to-slate-800/40">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">AI-Generated Insight</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">Advisor Insights</h3>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={generateInsight}
          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
        >
          {loading ? 'Generating…' : 'Refresh insight'}
        </button>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="space-y-2">
            <div className="h-4 w-full animate-pulse rounded bg-slate-200 dark:bg-slate-700"></div>
            <div className="h-4 w-5/6 animate-pulse rounded bg-slate-200 dark:bg-slate-700"></div>
            <div className="h-4 w-4/5 animate-pulse rounded bg-slate-200 dark:bg-slate-700"></div>
          </div>
        ) : error ? (
          <p className="text-sm text-rose-700 dark:text-rose-400">{error}</p>
        ) : insight ? (
          <p className="text-base leading-relaxed text-slate-700 dark:text-slate-300">{insight}</p>
        ) : null}
      </div>

      <p className="mt-4 text-xs text-slate-500 dark:text-slate-500">
        This insight is AI-generated based on your academic progress, attendance, and profile information. It's meant to inspire and encourage, not to replace conversations with your advisor.
      </p>
    </div>
  );
}
