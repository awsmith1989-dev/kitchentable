export interface School {
  id: string;
  name: string;
  district?: string;
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
  target_gpa?: number;
  post_secondary_plans?: string[];
  interests?: string;
  status: string;
  created_at: string;
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
