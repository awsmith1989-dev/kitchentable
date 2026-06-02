import { useEffect, useState } from 'react';
import { Student, WeeklyGpaSnapshot, WeeklyClassGrade, WeeklyAttendance, ClassRecord } from '../lib/types';

interface AdvisorInsightsProps {
  student: Student;
  weeklyGpa: WeeklyGpaSnapshot[];
  weeklyGrades: WeeklyClassGrade[];
  weeklyAttendance: WeeklyAttendance[];
  classes: ClassRecord[];
  activeYear: string;
}

export default function AdvisorInsights({
  student,
  weeklyGpa,
  weeklyGrades,
  weeklyAttendance,
  classes,
  activeYear
}: AdvisorInsightsProps) {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateInsight = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Get GPA trend
      const snapshots = weeklyGpa
        .filter((row) => row.school_year === activeYear)
        .sort((a, b) => b.week_number - a.week_number);
      
      const latestGpa = snapshots[0]?.gpa;
      const previousGpa = snapshots[1]?.gpa;
      const gpaTrend = latestGpa && previousGpa 
        ? latestGpa > previousGpa ? 'growing' : latestGpa < previousGpa ? 'declining' : 'stable'
        : 'unknown';

      // Get best and worst subjects
      const gradesByClass = new Map<string, number[]>();
      const currentWeekGrades = weeklyGrades.filter((g) => g.school_year === activeYear);
      const latestWeek = Math.max(0, ...currentWeekGrades.map((g) => g.week_number));

      currentWeekGrades
        .filter((g) => g.week_number === latestWeek)
        .forEach((g) => {
          const subject = classes.find((c) => c.id === g.class_id)?.subject || 'Unknown';
          const grade = g.grade_points ?? 0;
          if (!gradesByClass.has(subject)) gradesByClass.set(subject, []);
          gradesByClass.get(subject)!.push(grade);
        });

      const subjectAverages = Array.from(gradesByClass.entries()).map(([subject, grades]) => ({
        subject,
        avg: grades.reduce((a, b) => a + b, 0) / grades.length
      }));

      const bestSubject = subjectAverages.sort((a, b) => b.avg - a.avg)[0]?.subject || 'a subject';
      const worstSubject = subjectAverages.sort((a, b) => a.avg - b.avg)[0]?.subject || 'an area';

      // Get attendance
      const totalAbsences = weeklyAttendance.reduce((sum, row) => sum + Number(row.absent_days), 0);

      // Build prompt
      const prompt = `Generate a warm, encouraging AI-generated advisor insight for a student. Speak directly to them in second person. Include:

Student Name: ${student.first_name}
Current GPA Trend: ${gpaTrend} (${latestGpa?.toFixed(2) ?? 'N/A'})
Strongest Subject: ${bestSubject}
Biggest Opportunity: ${worstSubject}
Total Absences This Semester: ${totalAbsences}
Post-Secondary Plans: ${student.post_secondary_plans?.join(', ') || 'Not specified yet'}
Interests: ${student.interests || 'Not specified yet'}

Instructions:
- Speak in second person directly to the student (e.g., "You're showing strong growth...")
- Lead with a strength or something to celebrate
- Connect their academic data to their post-secondary plans and interests where relevant
- Use warm, encouraging, asset-based language — never shame or deficit framing
- Give one specific, actionable suggestion
- Keep the response to 3-4 sentences maximum
- Never mention specific grade numbers or GPA values — speak in terms of trends and strengths
- Make it feel personal and supportive

Generate the insight now:`;

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

      setInsight(insightText?.trim() || 'Unable to generate insight at this time.');
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
    <div className="mt-8 rounded-[2rem] border-2 border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-blue-50 p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">AI-Generated Insight</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-900">Advisor Insights</h3>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={generateInsight}
          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Generating…' : 'Refresh insight'}
        </button>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="space-y-2">
            <div className="h-4 w-full animate-pulse rounded bg-slate-200"></div>
            <div className="h-4 w-5/6 animate-pulse rounded bg-slate-200"></div>
            <div className="h-4 w-4/5 animate-pulse rounded bg-slate-200"></div>
          </div>
        ) : error ? (
          <p className="text-sm text-rose-700">{error}</p>
        ) : insight ? (
          <p className="text-base leading-relaxed text-slate-700">{insight}</p>
        ) : null}
      </div>

      <p className="mt-4 text-xs text-slate-500">
        This insight is AI-generated based on your academic progress, attendance, and profile information. It's meant to inspire and encourage, not to replace conversations with your advisor.
      </p>
    </div>
  );
}
