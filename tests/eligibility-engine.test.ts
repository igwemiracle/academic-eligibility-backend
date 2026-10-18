import { describe, it, expect } from "vitest";
import {
  calculateCgpaPolicy,
  computeGradeAndPoint,
  determineClassOfDegree,
  evaluateEligibility,
  groupSemesterResults,
} from "../src/domain/eligibility/engine.js";
import {
  CourseData,
  Requirements,
  ResultData,
  StudentData,
} from "../src/domain/eligibility/types.js";

const defaultRequirements: Requirements = {
  departmentId: "cs-dept-id",
  minTotalUnits: {
    UTME: 166,
    DIRECT_ENTRY: 121,
  },
  minCgpa: 1.0,
  passMark: 40,
  gradeScale: [
    { minScore: 70, grade: "A", point: 5 },
    { minScore: 60, grade: "B", point: 4 },
    { minScore: 50, grade: "C", point: 3 },
    { minScore: 45, grade: "D", point: 2 },
    { minScore: 40, grade: "E", point: 1 },
    { minScore: 0, grade: "F", point: 0 },
  ],
  maxOutstandingCompulsory: 0,
  degreeClasses: [
    { minCgpa: 4.5, label: "First Class" },
    { minCgpa: 3.5, label: "Second Class Upper" },
    { minCgpa: 2.4, label: "Second Class Lower" },
    { minCgpa: 1.5, label: "Third Class" },
    { minCgpa: 1.0, label: "Pass" },
  ],
};

const createMockStudent = (
  entryMode: "UTME" | "DIRECT_ENTRY" = "UTME",
  level = 400,
): StudentData => ({
  id: "student-1",
  fullName: "Test Student",
  matricNumber: "CSC/2020/001",
  level,
  entryYear: 2020,
  entryMode,
  department: "Computer Science",
});

describe("Eligibility Engine", () => {
  describe("Handbook Worked Example (Section 11.1.8)", () => {
    it("reproduces the handbook's worked example exactly", () => {
      // First semester: (3,A) (3,A) (3,A) (3,B) (1,A) (2,A) (1,A) (2,B) (2,A) (2,B)
      const sem1Specs = [
        { units: 3, grade: "A", point: 5, score: 75 },
        { units: 3, grade: "A", point: 5, score: 72 },
        { units: 3, grade: "A", point: 5, score: 70 },
        { units: 3, grade: "B", point: 4, score: 65 },
        { units: 1, grade: "A", point: 5, score: 80 },
        { units: 2, grade: "A", point: 5, score: 78 },
        { units: 1, grade: "A", point: 5, score: 85 },
        { units: 2, grade: "B", point: 4, score: 62 },
        { units: 2, grade: "A", point: 5, score: 74 },
        { units: 2, grade: "B", point: 4, score: 68 },
      ];

      // Second semester: (3,A) (3,B) (3,B) (3,B) (3,A) (2,A) (2,F) (2,A) (2,A)
      const sem2Specs = [
        { units: 3, grade: "A", point: 5, score: 75 },
        { units: 3, grade: "B", point: 4, score: 65 },
        { units: 3, grade: "B", point: 4, score: 64 },
        { units: 3, grade: "B", point: 4, score: 62 },
        { units: 3, grade: "A", point: 5, score: 77 },
        { units: 2, grade: "A", point: 5, score: 71 },
        { units: 2, grade: "F", point: 0, score: 32 },
        { units: 2, grade: "A", point: 5, score: 80 },
        { units: 2, grade: "A", point: 5, score: 73 },
      ];

      const results: ResultData[] = [];

      sem1Specs.forEach((s, idx) => {
        results.push({
          id: `sem1-${idx}`,
          courseId: `c-sem1-${idx}`,
          course: {
            id: `c-sem1-${idx}`,
            code: `TST 11${idx}`,
            title: `Test Course 1-${idx}`,
            units: s.units,
            level: 100,
            semester: 1,
            isCompulsory: true,
          },
          sessionId: "sess-1",
          session: { id: "sess-1", name: "2020/2021" },
          score: s.score,
          grade: s.grade,
          gradePoint: s.point,
        });
      });

      sem2Specs.forEach((s, idx) => {
        results.push({
          id: `sem2-${idx}`,
          courseId: `c-sem2-${idx}`,
          course: {
            id: `c-sem2-${idx}`,
            code: `TST 12${idx}`,
            title: `Test Course 2-${idx}`,
            units: s.units,
            level: 100,
            semester: 2,
            isCompulsory: true,
          },
          sessionId: "sess-1",
          session: { id: "sess-1", name: "2020/2021" },
          score: s.score,
          grade: s.grade,
          gradePoint: s.point,
        });
      });

      // Test semester breakdown
      const sessionBlocks = groupSemesterResults(results, 40);
      expect(sessionBlocks).toHaveLength(1);
      const semBlocks = sessionBlocks[0].semesters;

      // Sem 1 expectations: TCC 22, TCE 22, TPE 103, GPA 4.68
      const sem1 = semBlocks.find((s) => s.semester === 1)!;
      expect(sem1.tcc).toBe(22);
      expect(sem1.tce).toBe(22);
      expect(sem1.tpe).toBe(103);
      expect(sem1.gpa).toBe(4.68);

      // Sem 2 expectations: TCC 23, TCE 21, TPE 96, GPA 4.17
      const sem2 = semBlocks.find((s) => s.semester === 2)!;
      expect(sem2.tcc).toBe(23);
      expect(sem2.tce).toBe(21);
      expect(sem2.tpe).toBe(96);
      expect(sem2.gpa).toBe(4.17);

      // Cumulative expectations: CCC 45, CCE 43, CPE 199, CGPA 4.42
      const cgpaResult = calculateCgpaPolicy(results);
      expect(cgpaResult.totalUnitsCarried).toBe(45);
      expect(cgpaResult.totalPointsEarned).toBe(199);
      expect(cgpaResult.cgpa).toBe(4.42);
    });
  });

  describe("Grade computation", () => {
    it("computes grade and point accurately according to standard scale", () => {
      expect(computeGradeAndPoint(85, defaultRequirements.gradeScale)).toEqual({
        grade: "A",
        gradePoint: 5,
      });
      expect(computeGradeAndPoint(70, defaultRequirements.gradeScale)).toEqual({
        grade: "A",
        gradePoint: 5,
      });
      expect(computeGradeAndPoint(69, defaultRequirements.gradeScale)).toEqual({
        grade: "B",
        gradePoint: 4,
      });
      expect(computeGradeAndPoint(60, defaultRequirements.gradeScale)).toEqual({
        grade: "B",
        gradePoint: 4,
      });
      expect(computeGradeAndPoint(55, defaultRequirements.gradeScale)).toEqual({
        grade: "C",
        gradePoint: 3,
      });
      expect(computeGradeAndPoint(48, defaultRequirements.gradeScale)).toEqual({
        grade: "D",
        gradePoint: 2,
      });
      expect(computeGradeAndPoint(42, defaultRequirements.gradeScale)).toEqual({
        grade: "E",
        gradePoint: 1,
      });
      expect(computeGradeAndPoint(39, defaultRequirements.gradeScale)).toEqual({
        grade: "F",
        gradePoint: 0,
      });
      expect(computeGradeAndPoint(0, defaultRequirements.gradeScale)).toEqual({
        grade: "F",
        gradePoint: 0,
      });
    });
  });

  describe("Graduation Eligibility Scenarios", () => {
    it("Case: Perfectly eligible UTME student", () => {
      const student = createMockStudent("UTME");
      // 166 units of courses, all compulsory passed, grade A (score 80)
      const courses: CourseData[] = [];
      const results: ResultData[] = [];

      for (let i = 1; i <= 56; i++) {
        const units = i <= 54 ? 3 : 2; // 54*3 = 162 + 2*2 = 166 units
        const c: CourseData = {
          id: `c-${i}`,
          code: `CMP ${100 + i}`,
          title: `Course ${i}`,
          units,
          level: i <= 14 ? 100 : i <= 28 ? 200 : i <= 42 ? 300 : 400,
          semester: 1,
          isCompulsory: true,
        };
        courses.push(c);
        results.push({
          id: `res-${i}`,
          courseId: c.id,
          course: c,
          sessionId: "sess-1",
          score: 75,
          grade: "A",
          gradePoint: 5,
        });
      }

      const summary = evaluateEligibility({
        student,
        results,
        courses,
        requirements: defaultRequirements,
      });

      expect(summary.status).toBe("ELIGIBLE");
      expect(summary.totalUnitsEarned).toBe(166);
      expect(summary.totalUnitsCarried).toBe(166);
      expect(summary.cgpa).toBe(5.0);
      expect(summary.classOfDegree).toBe("First Class");
      expect(summary.outstandingCompulsory).toHaveLength(0);
      expect(summary.carryovers).toHaveLength(0);
      expect(summary.checks[0].passed).toBe(true);
      expect(summary.checks[1].passed).toBe(true);
      expect(summary.checks[2].passed).toBe(true);
    });

    it("Case: Short on units only", () => {
      const student = createMockStudent("UTME");
      const courses: CourseData[] = [];
      const results: ResultData[] = [];

      // Only 150 units
      for (let i = 1; i <= 50; i++) {
        const c: CourseData = {
          id: `c-${i}`,
          code: `CMP ${100 + i}`,
          title: `Course ${i}`,
          units: 3,
          level: 200,
          semester: 1,
          isCompulsory: false,
        };
        courses.push(c);
        results.push({
          id: `res-${i}`,
          courseId: c.id,
          course: c,
          sessionId: "sess-1",
          score: 70,
          grade: "A",
          gradePoint: 5,
        });
      }

      const summary = evaluateEligibility({
        student,
        results,
        courses,
        requirements: defaultRequirements,
      });

      expect(summary.status).toBe("NOT_YET_ELIGIBLE");
      expect(summary.checks[0].key).toBe("TOTAL_UNITS");
      expect(summary.checks[0].passed).toBe(false);
      expect(summary.checks[0].detail).toContain("You need 16 more credit units");
      expect(summary.checks[1].passed).toBe(true);
      expect(summary.checks[2].passed).toBe(true);
    });

    it("Case: Low CGPA only (below minCgpa 1.00)", () => {
      const student = createMockStudent("UTME");
      const courses: CourseData[] = [];
      const results: ResultData[] = [];

      // 166 units passed with grade E (point 1), plus several failed courses with point 0
      // 166 units of point 1 -> 166 CPE, 166 CCC
      // Add 20 units of F (point 0) -> CCC = 186, CPE = 166 -> CGPA = 166 / 186 = 0.89 < 1.00
      for (let i = 1; i <= 56; i++) {
        const units = i <= 54 ? 3 : 2; // 166 units
        const c: CourseData = {
          id: `c-${i}`,
          code: `CMP ${100 + i}`,
          title: `Course ${i}`,
          units,
          level: 200,
          semester: 1,
          isCompulsory: true,
        };
        courses.push(c);
        results.push({
          id: `res-${i}`,
          courseId: c.id,
          course: c,
          sessionId: "sess-1",
          score: 41,
          grade: "E",
          gradePoint: 1,
        });
      }

      // Add failed electives
      for (let j = 1; j <= 5; j++) {
        const c: CourseData = {
          id: `fail-${j}`,
          code: `ELE ${100 + j}`,
          title: `Elective Fail ${j}`,
          units: 4,
          level: 200,
          semester: 2,
          isCompulsory: false,
        };
        courses.push(c);
        results.push({
          id: `res-fail-${j}`,
          courseId: c.id,
          course: c,
          sessionId: "sess-1",
          score: 25,
          grade: "F",
          gradePoint: 0,
        });
      }

      const summary = evaluateEligibility({
        student,
        results,
        courses,
        requirements: defaultRequirements,
      });

      expect(summary.status).toBe("NOT_YET_ELIGIBLE");
      expect(summary.totalUnitsEarned).toBe(166);
      expect(summary.checks[0].passed).toBe(true);
      expect(summary.checks[1].passed).toBe(false);
      expect(summary.checks[1].actual).toBeLessThan(1.0);
      expect(summary.classOfDegree).toBe("Below Pass");
    });

    it("Case: Missing compulsory course only", () => {
      const student = createMockStudent("UTME");
      const courses: CourseData[] = [];
      const results: ResultData[] = [];

      for (let i = 1; i <= 55; i++) {
        const units = 3;
        const c: CourseData = {
          id: `c-${i}`,
          code: `CMP ${100 + i}`,
          title: `Course ${i}`,
          units,
          level: 200,
          semester: 1,
          isCompulsory: true,
        };
        courses.push(c);
        results.push({
          id: `res-${i}`,
          courseId: c.id,
          course: c,
          sessionId: "sess-1",
          score: 75,
          grade: "A",
          gradePoint: 5,
        });
      }

      // Add 1 compulsory course never taken
      const missingCompulsory: CourseData = {
        id: "c-missing",
        code: "CMP 499",
        title: "Final Year Project",
        units: 4,
        level: 400,
        semester: 2,
        isCompulsory: true,
      };
      courses.push(missingCompulsory);

      const summary = evaluateEligibility({
        student,
        results,
        courses,
        requirements: defaultRequirements,
      });

      expect(summary.status).toBe("NOT_YET_ELIGIBLE");
      expect(summary.checks[2].passed).toBe(false);
      expect(summary.outstandingCompulsory).toHaveLength(1);
      expect(summary.outstandingCompulsory[0]).toEqual({
        code: "CMP 499",
        title: "Final Year Project",
        units: 4,
        reason: "NOT_TAKEN",
      });
    });

    it("Case: Course failed and later passed on re-sit", () => {
      const student = createMockStudent("UTME");
      const course: CourseData = {
        id: "c-1",
        code: "CMP 211",
        title: "Computer Programming I",
        units: 3,
        level: 200,
        semester: 1,
        isCompulsory: true,
      };

      const results: ResultData[] = [
        {
          id: "res-fail",
          courseId: course.id,
          course,
          sessionId: "sess-1",
          score: 30,
          grade: "F",
          gradePoint: 0,
        },
        {
          id: "res-pass",
          courseId: course.id,
          course,
          sessionId: "sess-2",
          score: 65,
          grade: "B",
          gradePoint: 4,
        },
      ];

      const summary = evaluateEligibility({
        student,
        results,
        courses: [course],
        requirements: defaultRequirements,
      });

      // Course is passed, so NOT in outstanding compulsory and NOT in carryovers
      expect(summary.outstandingCompulsory).toHaveLength(0);
      expect(summary.carryovers).toHaveLength(0);

      // Distinct units earned is 3
      expect(summary.totalUnitsEarned).toBe(3);

      // Both attempts count in CCC: 3 + 3 = 6
      expect(summary.totalUnitsCarried).toBe(6);

      // Points: (3 * 0) + (3 * 4) = 12
      expect(summary.totalPointsEarned).toBe(12);

      // CGPA = 12 / 6 = 2.00
      expect(summary.cgpa).toBe(2.0);
    });

    it("Case: Course failed twice and never passed", () => {
      const student = createMockStudent("UTME");
      const course: CourseData = {
        id: "c-1",
        code: "CMP 311",
        title: "Structured Programming",
        units: 3,
        level: 300,
        semester: 1,
        isCompulsory: true,
      };

      const results: ResultData[] = [
        {
          id: "res-1",
          courseId: course.id,
          course,
          sessionId: "sess-1",
          score: 28,
          grade: "F",
          gradePoint: 0,
        },
        {
          id: "res-2",
          courseId: course.id,
          course,
          sessionId: "sess-2",
          score: 35,
          grade: "F",
          gradePoint: 0,
        },
      ];

      const summary = evaluateEligibility({
        student,
        results,
        courses: [course],
        requirements: defaultRequirements,
      });

      expect(summary.outstandingCompulsory).toHaveLength(1);
      expect(summary.outstandingCompulsory[0].reason).toBe("FAILED");
      expect(summary.carryovers).toHaveLength(1);
      expect(summary.carryovers[0]).toEqual({
        code: "CMP 311",
        title: "Structured Programming",
        units: 3,
        lastScore: 35,
      });
    });

    it("Case: No results at all", () => {
      const student = createMockStudent("UTME", 100);
      const summary = evaluateEligibility({
        student,
        results: [],
        courses: [
          {
            id: "c-1",
            code: "CMP 111",
            title: "Intro",
            units: 3,
            level: 100,
            semester: 1,
            isCompulsory: true,
          },
        ],
        requirements: defaultRequirements,
      });

      expect(summary.status).toBe("NOT_YET_ELIGIBLE");
      expect(summary.cgpa).toBe(0);
      expect(summary.classOfDegree).toBeNull();
      expect(summary.totalUnitsCarried).toBe(0);
      expect(summary.totalUnitsEarned).toBe(0);
    });

    it("Case: Exact boundary values (CGPA exactly 1.00, units exactly 166 UTME, 121 Direct Entry)", () => {
      // UTME boundary
      const studentUtme = createMockStudent("UTME");
      const utmeCourses: CourseData[] = [];
      const utmeResults: ResultData[] = [];

      // Exactly 166 units, all scored with Grade E (1 point) -> CGPA = 166/166 = 1.00
      for (let i = 1; i <= 56; i++) {
        const units = i <= 54 ? 3 : 2; // 166 units
        const c: CourseData = {
          id: `c-${i}`,
          code: `CMP ${100 + i}`,
          title: `Course ${i}`,
          units,
          level: 200,
          semester: 1,
          isCompulsory: true,
        };
        utmeCourses.push(c);
        utmeResults.push({
          id: `res-${i}`,
          courseId: c.id,
          course: c,
          sessionId: "sess-1",
          score: 40,
          grade: "E",
          gradePoint: 1,
        });
      }

      const utmeSummary = evaluateEligibility({
        student: studentUtme,
        results: utmeResults,
        courses: utmeCourses,
        requirements: defaultRequirements,
      });

      expect(utmeSummary.totalUnitsEarned).toBe(166);
      expect(utmeSummary.cgpa).toBe(1.0);
      expect(utmeSummary.classOfDegree).toBe("Pass");
      expect(utmeSummary.status).toBe("ELIGIBLE");

      // Direct Entry boundary
      const studentDe = createMockStudent("DIRECT_ENTRY", 400);
      const deCourses: CourseData[] = [];
      const deResults: ResultData[] = [];

      // Exactly 121 units (e.g. 39 courses of 3 units = 117 + 2 courses of 2 units = 121)
      for (let i = 1; i <= 41; i++) {
        const units = i <= 39 ? 3 : 2;
        const c: CourseData = {
          id: `c-de-${i}`,
          code: `CMP ${200 + i}`,
          title: `DE Course ${i}`,
          units,
          level: 200,
          semester: 1,
          isCompulsory: true,
        };
        deCourses.push(c);
        deResults.push({
          id: `res-de-${i}`,
          courseId: c.id,
          course: c,
          sessionId: "sess-1",
          score: 40,
          grade: "E",
          gradePoint: 1,
        });
      }

      const deSummary = evaluateEligibility({
        student: studentDe,
        results: deResults,
        courses: deCourses,
        requirements: defaultRequirements,
      });

      expect(deSummary.totalUnitsEarned).toBe(121);
      expect(deSummary.totalUnitsRequired).toBe(121);
      expect(deSummary.cgpa).toBe(1.0);
      expect(deSummary.classOfDegree).toBe("Pass");
      expect(deSummary.status).toBe("ELIGIBLE");
    });

    it("Case: Direct Entry student with no level-100 results does NOT show level-100 courses as outstanding", () => {
      const student = createMockStudent("DIRECT_ENTRY", 200);
      const courses: CourseData[] = [
        {
          id: "c-100",
          code: "CMP 111",
          title: "Level 100 Course",
          units: 3,
          level: 100,
          semester: 1,
          isCompulsory: true,
        },
        {
          id: "c-200",
          code: "CMP 211",
          title: "Level 200 Course",
          units: 3,
          level: 200,
          semester: 1,
          isCompulsory: true,
        },
      ];

      const results: ResultData[] = [
        {
          id: "res-200",
          courseId: "c-200",
          course: courses[1],
          sessionId: "sess-1",
          score: 75,
          grade: "A",
          gradePoint: 5,
        },
      ];

      const summary = evaluateEligibility({
        student,
        results,
        courses,
        requirements: defaultRequirements,
      });

      // Level 100 course must not be in outstandingCompulsory
      expect(summary.outstandingCompulsory).toHaveLength(0);
      // byLevel should only contain 200, 300, 400
      expect(summary.byLevel.map((l) => l.level)).toEqual([200, 300, 400]);
    });

    it("Case: Class of degree at each band edge", () => {
      const classes = defaultRequirements.degreeClasses;
      expect(determineClassOfDegree(5.0, 10, classes)).toBe("First Class");
      expect(determineClassOfDegree(4.5, 10, classes)).toBe("First Class");
      expect(determineClassOfDegree(4.49, 10, classes)).toBe("Second Class Upper");
      expect(determineClassOfDegree(3.5, 10, classes)).toBe("Second Class Upper");
      expect(determineClassOfDegree(3.49, 10, classes)).toBe("Second Class Lower");
      expect(determineClassOfDegree(2.4, 10, classes)).toBe("Second Class Lower");
      expect(determineClassOfDegree(2.39, 10, classes)).toBe("Third Class");
      expect(determineClassOfDegree(1.5, 10, classes)).toBe("Third Class");
      expect(determineClassOfDegree(1.49, 10, classes)).toBe("Pass");
      expect(determineClassOfDegree(1.0, 10, classes)).toBe("Pass");
      expect(determineClassOfDegree(0.99, 10, classes)).toBe("Below Pass");
      expect(determineClassOfDegree(3.5, 0, classes)).toBeNull();
    });
  });
});
