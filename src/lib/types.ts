export interface School {
  id: string;
  name: string;
  district?: string;
  state?: string;
  semester_weeks: number;
  semester_start_date: string;
  timezone?: string;
  created_at: string;
  updated_at: string;
}

export interface Teacher {
  id: string;
  full_name: string;
  preferred_name?: string;
  school_id: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface AdvisoryClass {
  id: string;
  name: string;
  school_id: string;
  teacher_id: string;
  grade_level?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Student {
  id: string;
  student_id_external?: string;
  first_name: string;
  last_name: string;
  preferred_name?: string;
  grade_level?: string;
  gender?: string;
  birth_date?: string;
  school_id: string;
  advisory_class_id?: string;
  auth_user_id?: string;
  target_gpa?: number;
  post_secondary_plans?: string[];
  interests?: string;
  career_goals?: string;
  community_assets?: string;
  strengths?: string[];
  riasec_codes?: string[];
  onboarding_completed?: boolean;
  college_proximity_preference?: string;
  specific_career_interest?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface StudentShoutout {
  id: string;
  student_id: string;
  teacher_id: string;
  shoutout_type: 'strength' | 'growth' | 'character';
  shoutout_text: string;
  personal_note?: string;
  week_number?: number;
  school_year?: string;
  created_at: string;
}

export interface StudentTeacherNotes {
  id: string;
  student_id: string;
  teacher_id: string;
  notes?: string;
  updated_at: string;
}

export interface ClassRecord {
  id: string;
  advisory_class_id: string;
  teacher_id: string;
  name: string;
  subject?: string;
  period?: string;
  semester?: string;
  created_at: string;
  updated_at: string;
}

export interface WeeklyGpaSnapshot {
  id: string;
  student_id: string;
  school_year: string;
  week_number: number;
  gpa: number;
  created_at: string;
  updated_at: string;
}

export interface WeeklyClassGrade {
  id: string;
  student_id: string;
  class_id: string;
  school_year: string;
  week_number: number;
  grade?: string;
  grade_points?: number;
  created_at: string;
  updated_at: string;
}

export interface SelfAssessment {
  id: string;
  student_id: string;
  school_year: string;
  week_number: number;
  academic_self_assessment: 'better' | 'same' | 'worse';
  effort_rating: number;
  created_at: string;
}

export interface WeeklyAttendance {
  id: string;
  student_id: string;
  class_id?: string;
  advisory_class_id?: string;
  school_year: string;
  week_number: number;
  present_days: number;
  absent_days: number;
  tardies: number;
  excused_days: number;
  created_at: string;
  updated_at: string;
}
