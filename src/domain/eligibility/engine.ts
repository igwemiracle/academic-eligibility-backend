import {
  CourseData,
  DegreeClassItem,
  EntryMode,
  GradeScaleItem,
  ProgressSummary,
  Requirements,
  ResultData,
  StudentData,
  SessionBlock,
  SemesterBlock,
  FormattedResult,
  Check,
  OutstandingCompulsory,
  Carryover,
  LevelSummary,
} from "./types.js";

export function roundToTwo(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Computes letter grade and grade point based on the department's grade scale.
 */
export function computeGradeAndPoint(
  score: number,
  gradeScale: GradeScaleItem[],
): { grade: string; gradePoint: number } {
  // Sort descending by minScore
  const sorted = [...gradeScale].sort((a, b) => b.minScore - a.minScore);
  for (const item of sorted) {
    if (score >= item.minScore) {
      return { grade: String(item.grade), gradePoint: item.point };
    }
  }
  return { grade: "F", gradePoint: 0 };
}

/**
 * Policy: Every registration counts toward the CGPA (cumulative credit points earned / cumulative credit units carried).
 * Failed attempts stay in the record and in the CGPA even after passed on a re-sit.
 */
export function calculateCgpaPolicy(results: ResultData[]): {
  totalUnitsCarried: number;
  totalPointsEarned: number;
  cgpa: number;
} {
  let totalUnitsCarried = 0;
  let totalPointsEarned = 0;

  for (const r of results) {
    const units = r.course.units;
    totalUnitsCarried += units;
    totalPointsEarned += units * r.gradePoint;
  }

  const cgpa = totalUnitsCarried === 0 ? 0 : roundToTwo(totalPointsEarned / totalUnitsCarried);

  return {
    totalUnitsCarried,
    totalPointsEarned,
    cgpa,
  };
}

/**
 * Determines class of degree from CGPA.
 */
export function determineClassOfDegree(
  cgpa: number,
  totalUnitsCarried: number,
  degreeClasses: DegreeClassItem[],
): string | null {
  if (totalUnitsCarried === 0) {
    return null;
  }

  const sorted = [...degreeClasses].sort((a, b) => b.minCgpa - a.minCgpa);
  for (const band of sorted) {
    if (cgpa >= band.minCgpa) {
      return band.label;
    }
  }

  return "Below Pass";
}

/**
 * Pure evaluation function for graduation eligibility.
 */
export function evaluateEligibility(params: {
  student: StudentData;
  results: ResultData[];
  courses: CourseData[];
  requirements: Requirements;
}): ProgressSummary {
  const { student, results, courses, requirements } = params;
  const isDirectEntry = student.entryMode === "DIRECT_ENTRY";

  // 1. Filter applicable courses and results
  // Direct entry students are exempt from level 100 courses
  const applicableCourses = courses.filter((c) => !isDirectEntry || c.level > 100);
  const applicableResults = results.filter((r) => !isDirectEntry || r.course.level > 100);

  // 2. CGPA and CCC / CPE
  const { totalUnitsCarried, totalPointsEarned, cgpa } = calculateCgpaPolicy(applicableResults);

  // 3. Units Earned (CCE): Distinct passed courses
  const passedCoursesMap = new Map<string, CourseData>();
  for (const r of applicableResults) {
    if (r.score >= requirements.passMark) {
      if (!passedCoursesMap.has(r.course.code)) {
        passedCoursesMap.set(r.course.code, r.course);
      }
    }
  }

  const totalUnitsEarned = Array.from(passedCoursesMap.values()).reduce(
    (sum, c) => sum + c.units,
    0,
  );

  const totalUnitsRequired =
    requirements.minTotalUnits[student.entryMode] ?? (isDirectEntry ? 121 : 166);

  // 4. Outstanding Compulsory Courses
  const outstandingCompulsory: OutstandingCompulsory[] = [];
  const compulsoryCourses = applicableCourses.filter((c) => c.isCompulsory);

  // Group attempts by course code
  const attemptsByCourseCode = new Map<string, ResultData[]>();
  for (const r of applicableResults) {
    const list = attemptsByCourseCode.get(r.course.code) || [];
    list.push(r);
    attemptsByCourseCode.set(r.course.code, list);
  }

  for (const course of compulsoryCourses) {
    const hasPassed = passedCoursesMap.has(course.code);
    if (!hasPassed) {
      const attempts = attemptsByCourseCode.get(course.code) || [];
      const reason: "NOT_TAKEN" | "FAILED" = attempts.length === 0 ? "NOT_TAKEN" : "FAILED";
      outstandingCompulsory.push({
        code: course.code,
        title: course.title,
        units: course.units,
        reason,
      });
    }
  }

  // 5. Carryovers: Every course, core or elective, that has attempts but was never passed
  const carryovers: Carryover[] = [];
  for (const [code, attempts] of attemptsByCourseCode.entries()) {
    const hasPassed = passedCoursesMap.has(code);
    if (!hasPassed && attempts.length > 0) {
      // Find the last score (by createdAt or array sequence)
      const lastAttempt = attempts[attempts.length - 1];
      carryovers.push({
        code,
        title: lastAttempt.course.title,
        units: lastAttempt.course.units,
        lastScore: lastAttempt.score,
      });
    }
  }

  // 6. Three checks (always in this exact order)
  const unitsDiff = totalUnitsRequired - totalUnitsEarned;
  const unitsCheckPassed = totalUnitsEarned >= totalUnitsRequired;
  const unitsCheck: Check = {
    key: "TOTAL_UNITS",
    label: "Total Credit Units",
    passed: unitsCheckPassed,
    required: totalUnitsRequired,
    actual: totalUnitsEarned,
    detail: unitsCheckPassed
      ? `Requirement met: ${totalUnitsEarned} of ${totalUnitsRequired} credit units earned.`
      : `You need ${unitsDiff} more credit unit${unitsDiff > 1 ? "s" : ""}.`,
  };

  const cgpaCheckPassed = cgpa >= requirements.minCgpa;
  const cgpaCheck: Check = {
    key: "CGPA",
    label: "Cumulative Grade Point Average (CGPA)",
    passed: cgpaCheckPassed,
    required: requirements.minCgpa,
    actual: cgpa,
    detail: cgpaCheckPassed
      ? `Requirement met: CGPA of ${cgpa.toFixed(2)} satisfies the minimum required ${requirements.minCgpa.toFixed(2)}.`
      : `Your CGPA of ${cgpa.toFixed(2)} is below the minimum required ${requirements.minCgpa.toFixed(2)}.`,
  };

  const outstandingCount = outstandingCompulsory.length;
  const compulsoryCheckPassed = outstandingCount <= requirements.maxOutstandingCompulsory;
  const compulsoryCheck: Check = {
    key: "COMPULSORY_COURSES",
    label: "Outstanding Compulsory Courses",
    passed: compulsoryCheckPassed,
    required: requirements.maxOutstandingCompulsory,
    actual: outstandingCount,
    detail: compulsoryCheckPassed
      ? `Requirement met: 0 compulsory courses outstanding.`
      : `${outstandingCount} compulsory course${outstandingCount > 1 ? "s" : ""} outstanding: ${outstandingCompulsory.map((c) => c.code).join(", ")}.`,
  };

  const checks: Check[] = [unitsCheck, cgpaCheck, compulsoryCheck];

  // 7. Status
  const status: "ELIGIBLE" | "NOT_YET_ELIGIBLE" =
    unitsCheckPassed && cgpaCheckPassed && compulsoryCheckPassed ? "ELIGIBLE" : "NOT_YET_ELIGIBLE";

  // 8. Class of degree
  const classOfDegree = determineClassOfDegree(cgpa, totalUnitsCarried, requirements.degreeClasses);

  // 9. byLevel
  const levels = isDirectEntry ? [200, 300, 400] : [100, 200, 300, 400];
  const byLevel: LevelSummary[] = levels.map((lvl) => {
    const levelResults = applicableResults.filter((r) => r.course.level === lvl);
    let unitsCarried = 0;
    let points = 0;
    const levelPassedCourses = new Set<string>();

    for (const r of levelResults) {
      unitsCarried += r.course.units;
      points += r.course.units * r.gradePoint;
      if (r.score >= requirements.passMark) {
        levelPassedCourses.add(r.course.code);
      }
    }

    // Sum distinct units passed at this level
    let unitsEarned = 0;
    for (const code of levelPassedCourses) {
      const course = applicableCourses.find((c) => c.code === code && c.level === lvl);
      if (course) {
        unitsEarned += course.units;
      }
    }

    const levelGpa = unitsCarried === 0 ? 0 : roundToTwo(points / unitsCarried);

    return {
      level: lvl,
      unitsCarried,
      unitsEarned,
      gpa: levelGpa,
    };
  });

  return {
    student: {
      id: student.id,
      fullName: student.fullName,
      matricNumber: student.matricNumber,
      level: student.level,
      entryYear: student.entryYear,
      entryMode: student.entryMode,
      department: student.department,
    },
    cgpa,
    classOfDegree,
    totalUnitsCarried,
    totalPointsEarned,
    totalUnitsEarned,
    totalUnitsRequired,
    status,
    checks,
    outstandingCompulsory,
    carryovers,
    byLevel,
  };
}

/**
 * Groups results by academic session and semester, calculating tcc, tce, tpe, gpa.
 */
export function groupSemesterResults(results: ResultData[], passMark = 40): SessionBlock[] {
  // Map by session id
  const sessionMap = new Map<
    string,
    {
      session: { id: string; name: string };
      results: ResultData[];
    }
  >();

  for (const r of results) {
    const sId = r.sessionId;
    const sName = r.session?.name || "Unknown Session";
    if (!sessionMap.has(sId)) {
      sessionMap.set(sId, {
        session: { id: sId, name: sName },
        results: [],
      });
    }
    sessionMap.get(sId)!.results.push(r);
  }

  const sessionBlocks: SessionBlock[] = [];

  for (const { session, results: sessionResults } of sessionMap.values()) {
    const semesters: SemesterBlock[] = [];

    for (const sem of [1, 2] as (1 | 2)[]) {
      const semResults = sessionResults.filter((r) => r.course.semester === sem);
      if (semResults.length === 0) continue;

      let tcc = 0;
      let tce = 0;
      let tpe = 0;

      const formattedResults: FormattedResult[] = [];
      const passedCodesInSemester = new Set<string>();

      for (const r of semResults) {
        const units = r.course.units;
        const passed = r.score >= passMark;
        tcc += units;
        tpe += units * r.gradePoint;
        if (passed && !passedCodesInSemester.has(r.course.code)) {
          tce += units;
          passedCodesInSemester.add(r.course.code);
        }

        formattedResults.push({
          id: r.id,
          course: {
            code: r.course.code,
            title: r.course.title,
            units: r.course.units,
            isCompulsory: r.course.isCompulsory,
          },
          score: r.score,
          grade: r.grade,
          gradePoint: r.gradePoint,
          passed,
        });
      }

      const gpa = tcc === 0 ? 0 : roundToTwo(tpe / tcc);

      semesters.push({
        semester: sem,
        results: formattedResults,
        tcc,
        tce,
        tpe,
        gpa,
      });
    }

    sessionBlocks.push({
      session,
      semesters,
    });
  }

  return sessionBlocks;
}
