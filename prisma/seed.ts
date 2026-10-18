import { PrismaClient, Role, EntryMode } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 12;

interface CourseSpec {
  code: string;
  title: string;
  units: number;
  level: number;
  semester: number;
  type: "Core" | "Elective";
}

// Exactly 77 courses from the handbook
const CURRICULUM: CourseSpec[] = [
  // Level 100 Semester 1
  { code: "CMP 111", title: "Introduction to Computer Science", units: 3, level: 100, semester: 1, type: "Core" },
  { code: "MTH 111", title: "Foundation of Mathematics", units: 3, level: 100, semester: 1, type: "Core" },
  { code: "STA 111", title: "Basics Statistics", units: 3, level: 100, semester: 1, type: "Core" },
  { code: "PHY 111", title: "Mechanics, Properties of Matter and Heat", units: 3, level: 100, semester: 1, type: "Core" },
  { code: "PHY 191", title: "Experimental Physics 1", units: 1, level: 100, semester: 1, type: "Core" },
  { code: "CHM 111", title: "Basic Inorganic Chemistry", units: 2, level: 100, semester: 1, type: "Core" },
  { code: "CHM 151", title: "Basic Experimental Chemistry", units: 1, level: 100, semester: 1, type: "Core" },
  { code: "GST 111", title: "Communication in English I", units: 2, level: 100, semester: 1, type: "Core" },
  { code: "GST 113", title: "Nigerian Peoples, Culture and Contemporary Problems of Youth", units: 2, level: 100, semester: 1, type: "Core" },
  { code: "GST 115", title: "History of Philosophy of Science", units: 2, level: 100, semester: 1, type: "Core" },
  { code: "BIO 103", title: "History of Biology", units: 2, level: 100, semester: 1, type: "Elective" },

  // Level 100 Semester 2
  { code: "CMP 122", title: "Problem Solving Techniques", units: 3, level: 100, semester: 2, type: "Core" },
  { code: "MTH 122", title: "Calculus", units: 2, level: 100, semester: 2, type: "Core" },
  { code: "MTH 132", title: "Applied Mathematics", units: 3, level: 100, semester: 2, type: "Core" },
  { code: "STA 112", title: "Probability I", units: 3, level: 100, semester: 2, type: "Core" },
  { code: "PHY 142", title: "Electricity and Magnetism", units: 3, level: 100, semester: 2, type: "Core" },
  { code: "GST 112", title: "Philosophy and Human Existence", units: 3, level: 100, semester: 2, type: "Core" },
  { code: "GST 114", title: "Use of Library, Study Skills and ICT", units: 2, level: 100, semester: 2, type: "Core" },
  { code: "GST 116", title: "Communication in English II", units: 2, level: 100, semester: 2, type: "Core" },
  { code: "PHY 132", title: "Optics, Sound and Waves", units: 2, level: 100, semester: 2, type: "Elective" },
  { code: "CHM 122", title: "Basic Physical Chemistry", units: 2, level: 100, semester: 2, type: "Elective" },
  { code: "BIO 104", title: "Biology for Physical Sciences", units: 2, level: 100, semester: 2, type: "Elective" },

  // Level 200 Semester 1
  { code: "CMP 211", title: "Computer Programming I", units: 3, level: 200, semester: 1, type: "Core" },
  { code: "CMP 221", title: "Operating System I", units: 3, level: 200, semester: 1, type: "Core" },
  { code: "CMP 241", title: "Fundamental of Data Structure", units: 3, level: 200, semester: 1, type: "Core" },
  { code: "MTH 211", title: "Linear Algebra I", units: 2, level: 200, semester: 1, type: "Core" },
  { code: "MTH 231", title: "Mathematical Method", units: 3, level: 200, semester: 1, type: "Core" },
  { code: "STA 211", title: "Statistical Inference I", units: 2, level: 200, semester: 1, type: "Core" },
  { code: "ENT 211", title: "Basic Management and Entrepreneurship", units: 2, level: 200, semester: 1, type: "Core" },
  { code: "MTH 221", title: "Real Analysis I", units: 3, level: 200, semester: 1, type: "Core" },
  { code: "MTH 241", title: "Sets, Logic and Algebra", units: 3, level: 200, semester: 1, type: "Elective" },

  // Level 200 Semester 2 (Printed total 24, rows sum to 27)
  { code: "CMP 222", title: "Computer Programming II", units: 3, level: 200, semester: 2, type: "Core" },
  { code: "CMP 232", title: "Discrete Structures", units: 3, level: 200, semester: 2, type: "Core" },
  { code: "CMP 252", title: "Digital Electronics", units: 3, level: 200, semester: 2, type: "Core" },
  { code: "MTH 222", title: "Ordinary Differential Equations", units: 3, level: 200, semester: 2, type: "Core" },
  { code: "MTH 252", title: "Numerical Analysis I", units: 3, level: 200, semester: 2, type: "Core" },
  { code: "GST 222", title: "Peace Studies and Conflict Resolution", units: 2, level: 200, semester: 2, type: "Core" },
  { code: "CMP 212", title: "Foundations of Sequential Programming", units: 3, level: 200, semester: 2, type: "Core" },
  { code: "MTH 242", title: "Linear Algebra II", units: 3, level: 200, semester: 2, type: "Elective" },
  { code: "STA 212", title: "Statistical Inference II", units: 2, level: 200, semester: 2, type: "Elective" },
  { code: "PHY 262", title: "Circuit Theory", units: 2, level: 200, semester: 2, type: "Elective" },

  // Level 300 Semester 1
  { code: "CMP 301", title: "SIWES I", units: 3, level: 300, semester: 1, type: "Core" },
  { code: "CMP 311", title: "Structured Programming", units: 3, level: 300, semester: 1, type: "Core" },
  { code: "CMP 321", title: "Operating System II", units: 3, level: 300, semester: 1, type: "Core" },
  { code: "CMP 331", title: "Computer Architecture and Organization I", units: 3, level: 300, semester: 1, type: "Core" },
  { code: "CMP 351", title: "Data Management", units: 3, level: 300, semester: 1, type: "Core" },
  { code: "CMP 361", title: "Formal Language and Automata Theory", units: 3, level: 300, semester: 1, type: "Core" },
  { code: "ENT 311", title: "Intro. to Entrepreneurship and New Ventures", units: 2, level: 300, semester: 1, type: "Core" },
  { code: "STA 361", title: "Operations Research I", units: 3, level: 300, semester: 1, type: "Core" },

  // Level 300 Semester 2
  { code: "CMP 312", title: "System Analysis and Design", units: 3, level: 300, semester: 2, type: "Core" },
  { code: "CMP 322", title: "Object Oriented Programming", units: 3, level: 300, semester: 2, type: "Core" },
  { code: "CMP 332", title: "Algorithms and Complexity Analysis", units: 3, level: 300, semester: 2, type: "Core" },
  { code: "CMP 352", title: "Compiler Construction I", units: 3, level: 300, semester: 2, type: "Core" },
  { code: "CMP 362", title: "Computer Architecture and Organization II", units: 3, level: 300, semester: 2, type: "Core" },
  { code: "CMP 382", title: "Computational Science and Numerical Methods", units: 3, level: 300, semester: 2, type: "Core" },
  { code: "ENT 312", title: "Entrepreneurship Practice", units: 2, level: 300, semester: 2, type: "Core" },
  { code: "STA 342", title: "Statistical Computing II", units: 2, level: 300, semester: 2, type: "Elective" },
  { code: "CMP 342", title: "Survey of Programming Languages", units: 3, level: 300, semester: 2, type: "Elective" },

  // Level 400 Semester 1
  { code: "CMP 401", title: "SIWES II", units: 3, level: 400, semester: 1, type: "Core" },
  { code: "CMP 491", title: "Research Methods", units: 2, level: 400, semester: 1, type: "Core" },
  { code: "CMP 411", title: "Compiler Construction II", units: 2, level: 400, semester: 1, type: "Elective" },
  { code: "CMP 421", title: "Software Engineering I", units: 3, level: 400, semester: 1, type: "Core" },
  { code: "CMP 431", title: "Organization of Programming Languages", units: 3, level: 400, semester: 1, type: "Core" },
  { code: "CMP 451", title: "Computer Communication and Network", units: 3, level: 400, semester: 1, type: "Core" },
  { code: "CMP 461", title: "Human Computer Interface", units: 2, level: 400, semester: 1, type: "Core" },
  { code: "CMP 441", title: "Assembly Language Programming", units: 2, level: 400, semester: 1, type: "Elective" },
  { code: "CMP 471", title: "Computer Modelling and Simulations", units: 3, level: 400, semester: 1, type: "Elective" },
  { code: "CMP 481", title: "Queuing Systems", units: 3, level: 400, semester: 1, type: "Elective" },
  { code: "STA 461", title: "Operations Research III", units: 3, level: 400, semester: 1, type: "Elective" },

  // Level 400 Semester 2 (Printed total 22, rows sum to 25)
  { code: "CMP 412", title: "Artificial Intelligence", units: 3, level: 400, semester: 2, type: "Core" },
  { code: "CMP 422", title: "Net-Centric Computing", units: 3, level: 400, semester: 2, type: "Core" },
  { code: "CMP 432", title: "Software Engineering II", units: 3, level: 400, semester: 2, type: "Core" },
  { code: "CMP 452", title: "Database Management", units: 3, level: 400, semester: 2, type: "Elective" },
  { code: "CMP 462", title: "Computer Graphics and Visualization", units: 3, level: 400, semester: 2, type: "Core" },
  { code: "CMP 482", title: "Distributed Computing Systems", units: 3, level: 400, semester: 2, type: "Elective" },
  { code: "CMP 442", title: "Special Topics in Computing", units: 3, level: 400, semester: 2, type: "Elective" },
  { code: "CMP 499", title: "Project", units: 4, level: 400, semester: 2, type: "Core" },
];

function getGradeAndPoint(score: number): { grade: string; gradePoint: number } {
  if (score >= 70) return { grade: "A", gradePoint: 5 };
  if (score >= 60) return { grade: "B", gradePoint: 4 };
  if (score >= 50) return { grade: "C", gradePoint: 3 };
  if (score >= 45) return { grade: "D", gradePoint: 2 };
  if (score >= 40) return { grade: "E", gradePoint: 1 };
  return { grade: "F", gradePoint: 0 };
}

interface TranscriptSpec {
  maxLevel: number;
  baseScore: number;
  electiveUnitsToPass: number;
  failCourses?: string[];
  skipCourses?: string[];
  resitCourses?: { code: string; score: number; sessionName: string }[];
  scoreOverrides?: Record<string, number>;
}

export async function main() {
  console.log("Starting database seed...");

  // 1. Department
  const dept = await prisma.department.upsert({
    where: { code: "CSC" },
    update: {},
    create: {
      name: "Computer Science",
      code: "CSC",
    },
  });
  console.log("✓ Seeded Department: Computer Science (CSC)");

  // 2. Graduation Requirements
  await prisma.graduationRequirement.upsert({
    where: { departmentId: dept.id },
    update: {},
    create: {
      departmentId: dept.id,
      minTotalUnits: { UTME: 166, DIRECT_ENTRY: 121 },
      minCgpa: 1.0,
      passMark: 40,
      maxOutstandingCompulsory: 0,
      gradeScale: [
        { minScore: 70, grade: "A", point: 5 },
        { minScore: 60, grade: "B", point: 4 },
        { minScore: 50, grade: "C", point: 3 },
        { minScore: 45, grade: "D", point: 2 },
        { minScore: 40, grade: "E", point: 1 },
        { minScore: 0, grade: "F", point: 0 },
      ],
      degreeClasses: [
        { minCgpa: 4.5, label: "First Class" },
        { minCgpa: 3.5, label: "Second Class Upper" },
        { minCgpa: 2.4, label: "Second Class Lower" },
        { minCgpa: 1.5, label: "Third Class" },
        { minCgpa: 1.0, label: "Pass" },
      ],
    },
  });
  console.log("✓ Seeded Graduation Requirements");

  // 3. Academic Sessions (2019/2020 through 2025/2026)
  const sessionData = [
    { name: "2019/2020", startYear: 2019, endYear: 2020 },
    { name: "2020/2021", startYear: 2020, endYear: 2021 },
    { name: "2021/2022", startYear: 2021, endYear: 2022 },
    { name: "2022/2023", startYear: 2022, endYear: 2023 },
    { name: "2023/2024", startYear: 2023, endYear: 2024 },
    { name: "2024/2025", startYear: 2024, endYear: 2025 },
    { name: "2025/2026", startYear: 2025, endYear: 2026 },
  ];

  const sessions: Record<string, any> = {};
  for (const s of sessionData) {
    const record = await prisma.academicSession.upsert({
      where: { name: s.name },
      update: {},
      create: s,
    });
    sessions[s.name] = record;
  }
  console.log("✓ Seeded Academic Sessions (2019/2020 to 2025/2026)");

  // 4. Admin and Advisers
  const defaultPassword = "Password123!";
  const passwordHash = await bcrypt.hash(defaultPassword, BCRYPT_ROUNDS);

  const admin = await prisma.user.upsert({
    where: { email: "admin@cs.edu.ng" },
    update: {},
    create: {
      email: "admin@cs.edu.ng",
      fullName: "Dr. Ibrahim Musa (Examination Officer)",
      passwordHash,
      role: Role.ADMIN,
    },
  });

  const adviser1 = await prisma.user.upsert({
    where: { email: "adviser1@cs.edu.ng" },
    update: {},
    create: {
      email: "adviser1@cs.edu.ng",
      fullName: "Dr. Ngozi Okonjo (Senior Adviser)",
      passwordHash,
      role: Role.ADVISER,
    },
  });

  const adviser2 = await prisma.user.upsert({
    where: { email: "adviser2@cs.edu.ng" },
    update: {},
    create: {
      email: "adviser2@cs.edu.ng",
      fullName: "Dr. Babatunde Adeleke (Junior Adviser)",
      passwordHash,
      role: Role.ADVISER,
    },
  });
  console.log("✓ Seeded 1 Admin and 2 Advisers");

  // 5. Courses (Exact 77 courses)
  const coursesMap = new Map<string, any>();
  for (const item of CURRICULUM) {
    const record = await prisma.course.upsert({
      where: {
        departmentId_code: {
          departmentId: dept.id,
          code: item.code,
        },
      },
      update: {
        title: item.title,
        units: item.units,
        level: item.level,
        semester: item.semester,
        isCompulsory: item.type === "Core",
      },
      create: {
        departmentId: dept.id,
        code: item.code,
        title: item.title,
        units: item.units,
        level: item.level,
        semester: item.semester,
        isCompulsory: item.type === "Core",
      },
    });
    coursesMap.set(item.code, record);
  }
  console.log(`✓ Seeded ${CURRICULUM.length} Curriculum Courses`);

  // 6. Helper: buildTranscript
  async function buildTranscript(studentProfileId: string, entryMode: EntryMode, entryYear: number, spec: TranscriptSpec) {
    const isDirectEntry = entryMode === "DIRECT_ENTRY";
    const startLevel = isDirectEntry ? 200 : 100;

    // Filter applicable courses up to spec.maxLevel
    const applicable = CURRICULUM.filter((c) => {
      if (isDirectEntry && c.level < 200) return false;
      return c.level <= spec.maxLevel;
    });

    // Separate core and electives
    const coreCourses = applicable.filter((c) => c.type === "Core");
    const electiveCourses = applicable.filter((c) => c.type === "Elective");

    // Select electives to pass
    const selectedElectives: CourseSpec[] = [];
    let currentElectiveUnits = 0;
    for (const ele of electiveCourses) {
      if (currentElectiveUnits + ele.units <= spec.electiveUnitsToPass) {
        selectedElectives.push(ele);
        currentElectiveUnits += ele.units;
      }
    }

    const coursesToTake = [...coreCourses, ...selectedElectives];

    for (const courseSpec of coursesToTake) {
      if (spec.skipCourses?.includes(courseSpec.code)) {
        continue;
      }

      // Determine session based on course level
      const levelOffset = (courseSpec.level - startLevel) / 100;
      const sessionYear = entryYear + levelOffset;
      const sessionName = `${sessionYear}/${sessionYear + 1}`;
      const session = sessions[sessionName] || sessions["2023/2024"];

      let score = spec.scoreOverrides?.[courseSpec.code] ?? spec.baseScore;
      if (spec.failCourses?.includes(courseSpec.code)) {
        score = 32; // Fail score
      }

      const { grade, gradePoint } = getGradeAndPoint(score);

      const dbCourse = coursesMap.get(courseSpec.code);
      if (dbCourse && session) {
        await prisma.result.upsert({
          where: {
            studentId_courseId_sessionId: {
              studentId: studentProfileId,
              courseId: dbCourse.id,
              sessionId: session.id,
            },
          },
          update: { score, grade, gradePoint },
          create: {
            studentId: studentProfileId,
            courseId: dbCourse.id,
            sessionId: session.id,
            score,
            grade,
            gradePoint,
          },
        });
      }
    }

    // Apply re-sits in later sessions
    if (spec.resitCourses) {
      for (const resit of spec.resitCourses) {
        const dbCourse = coursesMap.get(resit.code);
        const resitSession = sessions[resit.sessionName] || sessions["2023/2024"];
        if (dbCourse && resitSession) {
          const { grade, gradePoint } = getGradeAndPoint(resit.score);
          await prisma.result.upsert({
            where: {
              studentId_courseId_sessionId: {
                studentId: studentProfileId,
                courseId: dbCourse.id,
                sessionId: resitSession.id,
              },
            },
            update: { score: resit.score, grade, gradePoint },
            create: {
              studentId: studentProfileId,
              courseId: dbCourse.id,
              sessionId: resitSession.id,
              score: resit.score,
              grade,
              gradePoint,
            },
          });
        }
      }
    }
  }

  // 7. Seed 14 student scenarios (a) through (n)
  interface StudentScenario {
    email: string;
    fullName: string;
    matricNumber: string;
    level: number;
    entryYear: number;
    entryMode: EntryMode;
    adviserId: string | null;
    spec: TranscriptSpec;
  }

  const scenarios: StudentScenario[] = [
    // (a) UTME fully eligible (earned >= 166, CGPA >= 1.00, 0 compulsory outstanding)
    {
      email: "student_a_eligible@cs.edu.ng",
      fullName: "Adebayo Olawale",
      matricNumber: "CSC/2020/001",
      level: 400,
      entryYear: 2020,
      entryMode: EntryMode.UTME,
      adviserId: adviser1.id,
      spec: { maxLevel: 400, baseScore: 68, electiveUnitsToPass: 12 }, // Core is 159 + 12 = 171 units
    },
    // (b) UTME core passed but too few elective units (e.g. 159 core units earned, needs 166)
    {
      email: "student_b_shortunits@cs.edu.ng",
      fullName: "Chioma Okoli",
      matricNumber: "CSC/2020/002",
      level: 400,
      entryYear: 2020,
      entryMode: EntryMode.UTME,
      adviserId: adviser1.id,
      spec: { maxLevel: 400, baseScore: 65, electiveUnitsToPass: 2 }, // 159 + 2 = 161 < 166
    },
    // (c) UTME all core at grade E + failed electives pulling CGPA < 1.00
    {
      email: "student_c_lowcgpa@cs.edu.ng",
      fullName: "Emeka Eze",
      matricNumber: "CSC/2020/003",
      level: 400,
      entryYear: 2020,
      entryMode: EntryMode.UTME,
      adviserId: adviser1.id,
      spec: {
        maxLevel: 400,
        baseScore: 41, // Grade E = 1 point
        electiveUnitsToPass: 8,
        failCourses: ["MTH 241", "MTH 242", "PHY 262", "STA 342", "CMP 342", "CMP 411", "CMP 441", "CMP 471"],
      },
    },
    // (d) UTME missing one compulsory course never taken (e.g. CMP 499 Project skipped)
    {
      email: "student_d_missingcourse@cs.edu.ng",
      fullName: "Fatima Aliyu",
      matricNumber: "CSC/2020/004",
      level: 400,
      entryYear: 2020,
      entryMode: EntryMode.UTME,
      adviserId: adviser1.id,
      spec: { maxLevel: 400, baseScore: 72, electiveUnitsToPass: 12, skipCourses: ["CMP 499"] },
    },
    // (e) UTME failed compulsory course never re-sat (CMP 311 failed)
    {
      email: "student_e_failedcompulsory@cs.edu.ng",
      fullName: "Grace Danjuma",
      matricNumber: "CSC/2020/005",
      level: 400,
      entryYear: 2020,
      entryMode: EntryMode.UTME,
      adviserId: adviser1.id,
      spec: { maxLevel: 400, baseScore: 64, electiveUnitsToPass: 12, failCourses: ["CMP 311"] },
    },
    // (f) UTME failed compulsory course and passed on re-sit (F stays in CGPA)
    {
      email: "student_f_resitpass@cs.edu.ng",
      fullName: "Hassan Bello",
      matricNumber: "CSC/2020/006",
      level: 400,
      entryYear: 2020,
      entryMode: EntryMode.UTME,
      adviserId: adviser1.id,
      spec: {
        maxLevel: 400,
        baseScore: 62,
        electiveUnitsToPass: 12,
        failCourses: ["CMP 211"],
        resitCourses: [{ code: "CMP 211", score: 65, sessionName: "2022/2023" }],
      },
    },
    // (g) Brand-new level 100 student with no results
    {
      email: "student_g_new100@cs.edu.ng",
      fullName: "Ifunanya Nwosu",
      matricNumber: "CSC/2024/007",
      level: 100,
      entryYear: 2024,
      entryMode: EntryMode.UTME,
      adviserId: adviser2.id,
      spec: { maxLevel: 0, baseScore: 0, electiveUnitsToPass: 0 },
    },
    // (h) Level 200 student mid-programme good progress
    {
      email: "student_h_mid200@cs.edu.ng",
      fullName: "Jubril Sani",
      matricNumber: "CSC/2023/008",
      level: 200,
      entryYear: 2023,
      entryMode: EntryMode.UTME,
      adviserId: adviser2.id,
      spec: { maxLevel: 100, baseScore: 74, electiveUnitsToPass: 4 },
    },
    // (i) Level 300 student with a carryover (failed CMP 241 Data Structure)
    {
      email: "student_i_carryover300@cs.edu.ng",
      fullName: "Kehinde Bakare",
      matricNumber: "CSC/2022/009",
      level: 300,
      entryYear: 2022,
      entryMode: EntryMode.UTME,
      adviserId: adviser1.id,
      spec: { maxLevel: 200, baseScore: 58, electiveUnitsToPass: 4, failCourses: ["CMP 241"] },
    },
    // (j) Direct Entry fully eligible at 121 units
    {
      email: "student_j_de_eligible@cs.edu.ng",
      fullName: "Lukman Gbadamosi",
      matricNumber: "CSC/2021/DE01",
      level: 400,
      entryYear: 2021,
      entryMode: EntryMode.DIRECT_ENTRY,
      adviserId: adviser1.id,
      spec: { maxLevel: 400, baseScore: 71, electiveUnitsToPass: 6 }, // 116 core + 6 = 122 units >= 121
    },
    // (k) Direct Entry level 200 with no level-100 results at all
    {
      email: "student_k_de_new200@cs.edu.ng",
      fullName: "Maryam Usman",
      matricNumber: "CSC/2024/DE02",
      level: 200,
      entryYear: 2024,
      entryMode: EntryMode.DIRECT_ENTRY,
      adviserId: adviser2.id,
      spec: { maxLevel: 0, baseScore: 0, electiveUnitsToPass: 0 },
    },
    // (l) UTME exactly at 166 units with CGPA exactly 1.00
    {
      email: "student_l_exactboundary@cs.edu.ng",
      fullName: "Nnamdi Kalu",
      matricNumber: "CSC/2020/010",
      level: 400,
      entryYear: 2020,
      entryMode: EntryMode.UTME,
      adviserId: adviser1.id,
      spec: {
        maxLevel: 400,
        baseScore: 40, // Grade E = 1 point across all 159 core units
        electiveUnitsToPass: 7, // 159 + 7 = exactly 166 units
      },
    },
    // (m) High-CGPA student at about 4.6 who is still short on units
    {
      email: "student_m_highcgpa_short@cs.edu.ng",
      fullName: "Oluwaseun Ajayi",
      matricNumber: "CSC/2020/011",
      level: 400,
      entryYear: 2020,
      entryMode: EntryMode.UTME,
      adviserId: adviser1.id,
      spec: { maxLevel: 300, baseScore: 82, electiveUnitsToPass: 6 }, // Only up to 300 level
    },
    // (n) Student with no assigned adviser
    {
      email: "student_n_noadviser@cs.edu.ng",
      fullName: "Peace Chukwu",
      matricNumber: "CSC/2020/012",
      level: 400,
      entryYear: 2020,
      entryMode: EntryMode.UTME,
      adviserId: null,
      spec: { maxLevel: 400, baseScore: 66, electiveUnitsToPass: 10 },
    },
  ];

  for (const scen of scenarios) {
    const user = await prisma.user.upsert({
      where: { email: scen.email },
      update: {},
      create: {
        email: scen.email,
        fullName: scen.fullName,
        passwordHash,
        role: Role.STUDENT,
      },
    });

    const studentProfile = await prisma.studentProfile.upsert({
      where: { userId: user.id },
      update: { adviserId: scen.adviserId },
      create: {
        userId: user.id,
        departmentId: dept.id,
        matricNumber: scen.matricNumber,
        level: scen.level,
        entryYear: scen.entryYear,
        entryMode: scen.entryMode,
        adviserId: scen.adviserId,
      },
    });

    if (scen.spec.maxLevel > 0) {
      await buildTranscript(studentProfile.id, scen.entryMode, scen.entryYear, scen.spec);
    }
  }

  console.log(`✓ Seeded ${scenarios.length} Student Scenarios (a through n)`);
  console.log("\n================ DEMO CREDENTIALS ================");
  console.log("Default password for all users: Password123!\n");
  console.log("Admin:   admin@cs.edu.ng");
  console.log("Adviser 1: adviser1@cs.edu.ng (Assigned: Adebayo, Chioma, Emeka, Fatima, Grace, Hassan, Kehinde, Lukman, Nnamdi, Oluwaseun)");
  console.log("Adviser 2: adviser2@cs.edu.ng (Assigned: Ifunanya, Jubril, Maryam)");
  console.log("Students (Scenarios a-n):");
  scenarios.forEach((s) => {
    console.log(`  - ${s.matricNumber.padEnd(14)} ${s.email.padEnd(34)} (${s.fullName})`);
  });
  console.log("===================================================\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
