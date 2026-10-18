import { prisma } from "../../lib/prisma.js";
import { NotFoundError } from "../../lib/errors.js";
import { AuditService } from "../audit/service.js";
import { UpdateRequirementsInput } from "./schema.js";

export class RequirementsService {
  static async getRequirements(departmentId?: string) {
    let where = {};
    if (departmentId) {
      where = { departmentId };
    }

    let req = await prisma.graduationRequirement.findFirst({
      where,
    });

    if (!req) {
      // If not yet seeded, look up first department and create defaults
      const dept = await prisma.department.findFirst();
      if (!dept) {
        throw new NotFoundError("Department not found");
      }
      req = await prisma.graduationRequirement.create({
        data: {
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
    }

    return {
      departmentId: req.departmentId,
      minTotalUnits: req.minTotalUnits as { UTME: number; DIRECT_ENTRY: number },
      minCgpa: req.minCgpa,
      passMark: req.passMark,
      gradeScale: req.gradeScale as { minScore: number; grade: string; point: number }[],
      maxOutstandingCompulsory: req.maxOutstandingCompulsory,
      degreeClasses: req.degreeClasses as { minCgpa: number; label: string }[],
    };
  }

  static async updateRequirements(actorId: string, input: UpdateRequirementsInput) {
    let deptId = input.departmentId;
    if (!deptId) {
      const dept = await prisma.department.findFirst();
      if (!dept) {
        throw new NotFoundError("Department not found");
      }
      deptId = dept.id;
    }

    const existing = await prisma.graduationRequirement.findUnique({
      where: { departmentId: deptId },
    });

    const updated = await prisma.graduationRequirement.upsert({
      where: { departmentId: deptId },
      create: {
        departmentId: deptId,
        minTotalUnits: input.minTotalUnits,
        minCgpa: input.minCgpa,
        passMark: input.passMark,
        gradeScale: input.gradeScale,
        maxOutstandingCompulsory: input.maxOutstandingCompulsory,
        degreeClasses: input.degreeClasses,
      },
      update: {
        minTotalUnits: input.minTotalUnits,
        minCgpa: input.minCgpa,
        passMark: input.passMark,
        gradeScale: input.gradeScale,
        maxOutstandingCompulsory: input.maxOutstandingCompulsory,
        degreeClasses: input.degreeClasses,
      },
    });

    await AuditService.log({
      actorId,
      action: "UPDATE_REQUIREMENTS",
      entity: "GraduationRequirement",
      entityId: updated.id,
      before: existing,
      after: updated,
    });

    return {
      departmentId: updated.departmentId,
      minTotalUnits: updated.minTotalUnits as { UTME: number; DIRECT_ENTRY: number },
      minCgpa: updated.minCgpa,
      passMark: updated.passMark,
      gradeScale: updated.gradeScale as { minScore: number; grade: string; point: number }[],
      maxOutstandingCompulsory: updated.maxOutstandingCompulsory,
      degreeClasses: updated.degreeClasses as { minCgpa: number; label: string }[],
    };
  }
}
