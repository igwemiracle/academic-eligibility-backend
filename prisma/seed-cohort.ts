import crypto from "crypto";
import { PrismaClient, Role, EntryMode } from "@prisma/client";
import bcrypt from "bcrypt";
import { evaluateEligibility, roundToTwo } from "../src/domain/eligibility/engine.js";
import { CourseData, Requirements, ResultData, StudentData } from "../src/domain/eligibility/types.js";

const prisma = new PrismaClient();

// 1. Safety Check: Refuse to run in production
if (process.env.NODE_ENV === "production") {
  console.error("Refusing to run seed:cohort in production environment!");
  process.exit(1);
}

// 2. Mulberry32 pseudo-random number generator
function mulberry32(seed: number) {
  let s = seed >>> 0;
  return function () {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(20261017); // Fixed seed for reproducible generation

// Box-Muller transform for normal distribution
function randomNormal(mean = 58, stdDev = 12): number {
  let u1 = rng();
  let u2 = rng();
  while (u1 === 0) u1 = rng();
  while (u2 === 0) u2 = rng();
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return mean + z * stdDev;
}

// Clamp helper
function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

// Nigerian Names
const FIRST_NAMES = [
  "Adebayo", "Chinedu", "Fatima", "Oluwaseun", "Ngozi", "Ibrahim", "Emeka", "Amina",
  "Kehinde", "Blessing", "Babajide", "Chinwe", "Zainab", "Damilola", "Uche", "Folake",
  "Tunde", "Halima", "Chidi", "Funmilayo", "Kazeem", "Yetunde", "Obinna", "Maryam",
  "Segun", "Adaobi", "Mustapha", "Titilayo", "Femi", "Joy", "Yakubu", "Chiamaka",
  "Suleiman", "Bose", "Chukwuma", "Rashidat", "Kayode", "Onyinye", "Usman", "Bukola",
  "Ayomide", "Ifeoma", "Sodiq", "Simisola", "Tari", "Eunice", "Alhassan", "Eniola",
  "Chibuzor", "Precious", "Jelili", "Kikelomo", "Oladimeji", "Ronke", "Saheed", "Temitope",
];

const LAST_NAMES = [
  "Adeyemi", "Okonkwo", "Bello", "Balogun", "Eze", "Abubakar", "Okafor", "Danjuma",
  "Lawal", "Nwosu", "Suleiman", "Oluwole", "Aliyu", "Igwe", "Ajayi", "Mohammed",
  "Ojo", "Chukwu", "Garba", "Adeleke", "Nnamdi", "Bakare", "Ogunleye", "Ibrahim",
  "Afolabi", "Obi", "Sani", "Oladipo", "Gbadamosi", "Kalu", "Ojo", "Yusuf",
  "Oyelaran", "Anikulapo", "Babatunde", "Mba", "Arowolo", "Falana", "Momoh", "Dada",
];

function getGradeAndPoint(score: number): { grade: string; gradePoint: number } {
  if (score >= 70) return { grade: "A", gradePoint: 5 };
  if (score >= 60) return { grade: "B", gradePoint: 4 };
  if (score >= 50) return { grade: "C", gradePoint: 3 };
  if (score >= 45) return { grade: "D", gradePoint: 2 };
  if (score >= 40) return { grade: "E", gradePoint: 1 };
  return { grade: "F", gradePoint: 0 };
}

function getCourseDifficultyOffset(code: string): number {
  if (code.startsWith("MTH") || code.startsWith("PHY")) return -6;
  if (code === "CMP 241" || code === "CMP 332" || code === "CMP 352" || code === "CMP 361") return -5;
  if (code.startsWith("GST") || code.startsWith("ENT") || code.startsWith("BIO")) return 4;
  let hash = 0;
  for (let i = 0; i < code.length; i++) hash = (hash << 5) - hash + code.charCodeAt(i);
  return (Math.abs(hash) % 7) - 3; // -3 to +3
}

async function main() {
  console.log("================ COHORT SEED GENERATOR ================");

  // 1. Fetch prerequisite data (department, requirements, sessions, advisers, courses)
  const dept = await prisma.department.findUnique({ where: { code: "CSC" } });
  if (!dept) {
    throw new Error("Computer Science department not found. Run 'npm run seed' first!");
  }

  const requirementsRaw = await prisma.graduationRequirement.findUnique({
    where: { departmentId: dept.id },
  });
  if (!requirementsRaw) {
    throw new Error("Graduation requirements not found. Run 'npm run seed' first!");
  }

  const requirements: Requirements = {
    departmentId: requirementsRaw.departmentId,
    minTotalUnits: requirementsRaw.minTotalUnits as { UTME: number; DIRECT_ENTRY: number },
    minCgpa: requirementsRaw.minCgpa,
    passMark: requirementsRaw.passMark,
    gradeScale: requirementsRaw.gradeScale as any,
    maxOutstandingCompulsory: requirementsRaw.maxOutstandingCompulsory,
    degreeClasses: requirementsRaw.degreeClasses as any,
  };

  const sessionsRaw = await prisma.academicSession.findMany({
    orderBy: { startYear: "asc" },
  });
  const sessionMap = new Map<string, string>(); // name -> id
  sessionsRaw.forEach((s) => sessionMap.set(s.name, s.id));

  const advisers = await prisma.user.findMany({
    where: { role: Role.ADVISER },
    orderBy: { email: "asc" },
  });
  if (advisers.length < 2) {
    throw new Error("At least two advisers required. Run 'npm run seed' first!");
  }

  const allCourses = await prisma.course.findMany({
    where: { departmentId: dept.id },
    orderBy: [{ level: "asc" }, { semester: "asc" }, { code: "asc" }],
  });

  // 2. Delete earlier cohort (@cohort.example.test)
  console.log("Checking and removing previous cohort records...");
  const oldCohortUsers = await prisma.user.findMany({
    where: { email: { endsWith: "@cohort.example.test" } },
    select: { id: true },
  });

  if (oldCohortUsers.length > 0) {
    const userIds = oldCohortUsers.map((u) => u.id);
    const oldProfiles = await prisma.studentProfile.findMany({
      where: { userId: { in: userIds } },
      select: { id: true },
    });
    const profileIds = oldProfiles.map((p) => p.id);

    await prisma.result.deleteMany({
      where: { studentId: { in: profileIds } },
    });
    await prisma.studentProfile.deleteMany({
      where: { id: { in: profileIds } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: userIds } },
    });
    console.log(`✓ Cleaned up ${oldCohortUsers.length} previous cohort records.`);
  }

  // 3. Hash default password once for performance
  console.log("Preparing credentials...");
  const passwordHash = await bcrypt.hash("Password123!", 10);

  // 4. Student specification breakdown (240 students total)
  // Level 100: 60 UTME (entered 2023)
  // Level 200: 48 UTME (entered 2022), 12 DE (entered 2023)
  // Level 300: 48 UTME (entered 2021), 12 DE (entered 2022)
  // Level 400: 48 UTME (entered 2020), 12 DE (entered 2021)
  // Total: 204 UTME (85%), 36 Direct Entry (15%) = 240 students
  interface StudentPlan {
    level: number;
    entryMode: EntryMode;
    entryYear: number;
  }

  const cohortPlans: StudentPlan[] = [];

  // Level 100
  for (let i = 0; i < 60; i++) cohortPlans.push({ level: 100, entryMode: EntryMode.UTME, entryYear: 2023 });
  // Level 200
  for (let i = 0; i < 48; i++) cohortPlans.push({ level: 200, entryMode: EntryMode.UTME, entryYear: 2022 });
  for (let i = 0; i < 12; i++) cohortPlans.push({ level: 200, entryMode: EntryMode.DIRECT_ENTRY, entryYear: 2023 });
  // Level 300
  for (let i = 0; i < 48; i++) cohortPlans.push({ level: 300, entryMode: EntryMode.UTME, entryYear: 2021 });
  for (let i = 0; i < 12; i++) cohortPlans.push({ level: 300, entryMode: EntryMode.DIRECT_ENTRY, entryYear: 2022 });
  // Level 400
  for (let i = 0; i < 48; i++) cohortPlans.push({ level: 400, entryMode: EntryMode.UTME, entryYear: 2020 });
  for (let i = 0; i < 12; i++) cohortPlans.push({ level: 400, entryMode: EntryMode.DIRECT_ENTRY, entryYear: 2021 });

  console.log(`Generating in-memory data for ${cohortPlans.length} students...`);

  const emailOccurrences = new Map<string, number>();
  let globalStudentNum = 1;

  interface UserRecord {
    id: string;
    email: string;
    fullName: string;
    passwordHash: string;
    role: Role;
  }

  interface ProfileRecord {
    id: string;
    userId: string;
    departmentId: string;
    matricNumber: string;
    level: number;
    entryYear: number;
    entryMode: EntryMode;
    adviserId: string | null;
  }

  interface ResultRecord {
    id: string;
    studentId: string;
    courseId: string;
    sessionId: string;
    score: number;
    grade: string;
    gradePoint: number;
  }

  const usersToInsert: UserRecord[] = [];
  const profilesToInsert: ProfileRecord[] = [];
  const resultsToInsert: ResultRecord[] = [];

  const createdStudentsSummary: {
    studentData: StudentData;
    results: ResultData[];
  }[] = [];

  for (const plan of cohortPlans) {
    // Pick name
    const firstName = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)];
    const lastName = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
    const fullName = `${firstName} ${lastName}`;

    const baseEmailPrefix = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`;
    const count = (emailOccurrences.get(baseEmailPrefix) || 0) + 1;
    emailOccurrences.set(baseEmailPrefix, count);

    const email = count === 1
      ? `${baseEmailPrefix}@cohort.example.test`
      : `${baseEmailPrefix}${count}@cohort.example.test`;

    const matricNumber = `CSC/${plan.entryYear}/C${String(globalStudentNum).padStart(3, "0")}`;
    globalStudentNum++;

    // Assign adviser: ~5% unassigned, otherwise evenly between adviser 1 & 2
    const advChoice = rng();
    const adviserId = advChoice < 0.05 ? null : advChoice < 0.525 ? advisers[0].id : advisers[1].id;

    // Student Ability (mean 58, stdDev 12)
    const ability = clamp(randomNormal(58, 12), 20, 95);

    // Pre-generate IDs
    const userId = crypto.randomUUID();
    const profileId = crypto.randomUUID();

    usersToInsert.push({
      id: userId,
      email,
      fullName,
      passwordHash,
      role: Role.STUDENT,
    });

    profilesToInsert.push({
      id: profileId,
      userId,
      departmentId: dept.id,
      matricNumber,
      level: plan.level,
      entryYear: plan.entryYear,
      entryMode: plan.entryMode,
      adviserId,
    });

    // Determine levels completed so far
    const startLevel = plan.entryMode === EntryMode.DIRECT_ENTRY ? 200 : 100;
    const completedLevels: number[] = [];
    for (let lvl = startLevel; lvl <= plan.level; lvl += 100) {
      completedLevels.push(lvl);
    }

    // Results container for this student
    const studentResults: ResultData[] = [];
    const passedCourses = new Set<string>();

    for (const lvl of completedLevels) {
      const yearOffset = (lvl - startLevel) / 100;
      const sessionYear = plan.entryYear + yearOffset;
      const sessionName = `${sessionYear}/${sessionYear + 1}`;
      const sessionId = sessionMap.get(sessionName) || sessionsRaw[0].id;

      // Select courses for this level
      const coreLevelCourses = allCourses.filter((c) => c.level === lvl && c.isCompulsory);
      const electiveLevelCourses = allCourses.filter((c) => c.level === lvl && !c.isCompulsory);

      // Realistic electives: pick 1 or 2 electives for this level
      const numElectivesToTake = rng() < 0.35 ? 1 : rng() < 0.85 ? 2 : 3;
      const chosenElectives: typeof electiveLevelCourses = [];
      const shuffledElectives = [...electiveLevelCourses].sort(() => rng() - 0.5);
      for (let e = 0; e < Math.min(numElectivesToTake, shuffledElectives.length); e++) {
        chosenElectives.push(shuffledElectives[e]);
      }

      const coursesToTake = [...coreLevelCourses, ...chosenElectives];

      for (const course of coursesToTake) {
        if (passedCourses.has(course.code)) continue;

        const diffOffset = getCourseDifficultyOffset(course.code);
        const noise = randomNormal(0, 5);
        const score = clamp(Math.round(ability + diffOffset + noise), 0, 100);
        const { grade, gradePoint } = getGradeAndPoint(score);

        const resultId = crypto.randomUUID();
        resultsToInsert.push({
          id: resultId,
          studentId: profileId,
          courseId: course.id,
          sessionId,
          score,
          grade,
          gradePoint,
        });

        studentResults.push({
          id: resultId,
          courseId: course.id,
          course: {
            id: course.id,
            code: course.code,
            title: course.title,
            units: course.units,
            level: course.level,
            semester: course.semester,
            isCompulsory: course.isCompulsory,
          },
          sessionId,
          session: { id: sessionId, name: sessionName },
          score,
          grade,
          gradePoint,
        });

        if (score >= requirements.passMark) {
          passedCourses.add(course.code);
        } else {
          // Failed! Handle re-sit in subsequent sessions with 0.8 probability
          let currentScore = score;
          const maxPossibleLevel = plan.level;
          let currentResitLevel = lvl + 100;

          while (currentScore < requirements.passMark && currentResitLevel <= maxPossibleLevel) {
            // 80% chance to re-sit
            const willResit = rng() < 0.8;
            if (!willResit) break;

            const resitYearOffset = (currentResitLevel - startLevel) / 100;
            const resitSessionYear = plan.entryYear + resitYearOffset;
            const resitSessionName = `${resitSessionYear}/${resitSessionYear + 1}`;
            const resitSessionId = sessionMap.get(resitSessionName);

            if (!resitSessionId) break;

            // Retake course: ability + prep bonus + noise
            const prepBonus = 8;
            const resitNoise = randomNormal(0, 4);
            currentScore = clamp(Math.round(ability + diffOffset + prepBonus + resitNoise), 0, 100);
            const resitGrade = getGradeAndPoint(currentScore);
            const resitResultId = crypto.randomUUID();

            resultsToInsert.push({
              id: resitResultId,
              studentId: profileId,
              courseId: course.id,
              sessionId: resitSessionId,
              score: currentScore,
              grade: resitGrade.grade,
              gradePoint: resitGrade.gradePoint,
            });

            studentResults.push({
              id: resitResultId,
              courseId: course.id,
              course: {
                id: course.id,
                code: course.code,
                title: course.title,
                units: course.units,
                level: course.level,
                semester: course.semester,
                isCompulsory: course.isCompulsory,
              },
              sessionId: resitSessionId,
              session: { id: resitSessionId, name: resitSessionName },
              score: currentScore,
              grade: resitGrade.grade,
              gradePoint: resitGrade.gradePoint,
            });

            if (currentScore >= requirements.passMark) {
              passedCourses.add(course.code);
              break;
            }

            currentResitLevel += 100;
          }
        }
      }
    }

    createdStudentsSummary.push({
      studentData: {
        id: profileId,
        fullName,
        matricNumber,
        level: plan.level,
        entryYear: plan.entryYear,
        entryMode: plan.entryMode,
        department: dept.name,
      },
      results: studentResults,
    });
  }

  // 5. Bulk database insertions
  console.log(`Writing ${usersToInsert.length} users to database...`);
  await prisma.user.createMany({ data: usersToInsert });

  console.log(`Writing ${profilesToInsert.length} student profiles to database...`);
  await prisma.studentProfile.createMany({ data: profilesToInsert });

  console.log(`Writing ${resultsToInsert.length} academic results to database in batches...`);
  const BATCH_SIZE = 1000;
  for (let i = 0; i < resultsToInsert.length; i += BATCH_SIZE) {
    const chunk = resultsToInsert.slice(i, i + BATCH_SIZE);
    await prisma.result.createMany({
      data: chunk,
      skipDuplicates: true,
    });
  }
  console.log(`✓ All records successfully saved.`);

  // 6. Compute statistics across the cohort using pure eligibility engine
  console.log("Analyzing cohort eligibility and progress...");
  const courseDataList: CourseData[] = allCourses.map((c) => ({
    id: c.id,
    code: c.code,
    title: c.title,
    units: c.units,
    level: c.level,
    semester: c.semester,
    isCompulsory: c.isCompulsory,
  }));

  const byLevelCounts: Record<number, number> = { 100: 0, 200: 0, 300: 0, 400: 0 };
  const byEntryModeCounts: Record<string, number> = { UTME: 0, DIRECT_ENTRY: 0 };
  const byStatusCounts = { ELIGIBLE: 0, NOT_YET_ELIGIBLE: 0 };
  let totalCgpa = 0;
  let studentsWithCarryoversCount = 0;

  for (const s of createdStudentsSummary) {
    byLevelCounts[s.studentData.level] = (byLevelCounts[s.studentData.level] || 0) + 1;
    byEntryModeCounts[s.studentData.entryMode] = (byEntryModeCounts[s.studentData.entryMode] || 0) + 1;

    const summary = evaluateEligibility({
      student: s.studentData,
      results: s.results,
      courses: courseDataList,
      requirements,
    });

    if (summary.status === "ELIGIBLE") {
      byStatusCounts.ELIGIBLE++;
    } else {
      byStatusCounts.NOT_YET_ELIGIBLE++;
    }

    totalCgpa += summary.cgpa;
    if (summary.carryovers.length > 0) {
      studentsWithCarryoversCount++;
    }
  }

  const avgCgpa = roundToTwo(totalCgpa / createdStudentsSummary.length);

  // 7. Output Final Statistics Report
  console.log("\n================ COHORT GENERATION REPORT ================");
  console.log(`Total Students Generated:       ${createdStudentsSummary.length}`);
  console.log(`Total Result Records:           ${resultsToInsert.length}`);
  console.log("----------------------------------------------------------");
  console.log("Breakdown by Level:");
  console.log(`  - 100 Level:                  ${byLevelCounts[100]} students`);
  console.log(`  - 200 Level:                  ${byLevelCounts[200]} students`);
  console.log(`  - 300 Level:                  ${byLevelCounts[300]} students`);
  console.log(`  - 400 Level:                  ${byLevelCounts[400]} students`);
  console.log("----------------------------------------------------------");
  console.log("Breakdown by Entry Mode:");
  console.log(`  - UTME:                       ${byEntryModeCounts.UTME} (${Math.round((byEntryModeCounts.UTME / createdStudentsSummary.length) * 100)}%)`);
  console.log(`  - Direct Entry:               ${byEntryModeCounts.DIRECT_ENTRY} (${Math.round((byEntryModeCounts.DIRECT_ENTRY / createdStudentsSummary.length) * 100)}%)`);
  console.log("----------------------------------------------------------");
  console.log("Graduation Status (Handbook Requirements):");
  console.log(`  - ELIGIBLE:                   ${byStatusCounts.ELIGIBLE}`);
  console.log(`  - NOT_YET_ELIGIBLE:           ${byStatusCounts.NOT_YET_ELIGIBLE}`);
  console.log("----------------------------------------------------------");
  console.log(`Average CGPA:                   ${avgCgpa}`);
  console.log(`Students with Carryovers:       ${studentsWithCarryoversCount} (${Math.round((studentsWithCarryoversCount / createdStudentsSummary.length) * 100)}%)`);
  console.log("==========================================================\n");
}

main()
  .catch((e) => {
    console.error("Error generating cohort:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
