export type EntryMode = "UTME" | "DIRECT_ENTRY";

export type Grade = "A" | "B" | "C" | "D" | "E" | "F";

export interface GradeScaleItem {
  minScore: number;
  grade: Grade | string;
  point: number;
}

export interface DegreeClassItem {
  minCgpa: number;
  label: string;
}

export interface Requirements {
  departmentId: string;
  minTotalUnits: {
    UTME: number;
    DIRECT_ENTRY: number;
  };
  minCgpa: number; // default 1.00
  passMark: number; // default 40
  gradeScale: GradeScaleItem[];
  maxOutstandingCompulsory: number; // default 0
  degreeClasses: DegreeClassItem[];
}

export interface CourseData {
  id: string;
  code: string;
  title: string;
  units: number;
  level: number;
  semester: number;
  isCompulsory: boolean;
}

export interface ResultData {
  id: string;
  courseId: string;
  course: CourseData;
  sessionId: string;
  session?: {
    id: string;
    name: string;
  };
  score: number;
  grade: Grade | string;
  gradePoint: number;
  createdAt?: Date | string;
}

export interface StudentData {
  id: string;
  fullName: string;
  matricNumber: string;
  level: number;
  entryYear: number;
  entryMode: EntryMode;
  department: string;
}

export interface Check {
  key: "TOTAL_UNITS" | "CGPA" | "COMPULSORY_COURSES";
  label: string;
  passed: boolean;
  required: number | string;
  actual: number | string;
  detail: string;
}

export interface OutstandingCompulsory {
  code: string;
  title: string;
  units: number;
  reason: "NOT_TAKEN" | "FAILED";
}

export interface Carryover {
  code: string;
  title: string;
  units: number;
  lastScore: number;
}

export interface LevelSummary {
  level: number;
  unitsCarried: number;
  unitsEarned: number;
  gpa: number;
}

export interface ProgressSummary {
  student: {
    id: string;
    fullName: string;
    matricNumber: string;
    level: number;
    entryYear: number;
    entryMode: EntryMode;
    department: string;
  };
  cgpa: number;
  classOfDegree: string | null;
  totalUnitsCarried: number; // CCC
  totalPointsEarned: number; // CPE
  totalUnitsEarned: number; // CCE
  totalUnitsRequired: number;
  status: "ELIGIBLE" | "NOT_YET_ELIGIBLE";
  checks: Check[]; // always all three in this exact order
  outstandingCompulsory: OutstandingCompulsory[];
  carryovers: Carryover[];
  byLevel: LevelSummary[];
}

export interface FormattedResult {
  id: string;
  course: {
    code: string;
    title: string;
    units: number;
    isCompulsory: boolean;
  };
  score: number;
  grade: Grade | string;
  gradePoint: number;
  passed: boolean;
}

export interface SemesterBlock {
  semester: 1 | 2;
  results: FormattedResult[];
  tcc: number;
  tce: number;
  tpe: number;
  gpa: number;
}

export interface SessionBlock {
  session: {
    id: string;
    name: string;
  };
  semesters: SemesterBlock[];
}
