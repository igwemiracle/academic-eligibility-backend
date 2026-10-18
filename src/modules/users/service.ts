import bcrypt from "bcrypt";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { BadRequestError, NotFoundError } from "../../lib/errors.js";
import {
  AssignAdviserInput,
  CreateUserInput,
  ListUsersQuery,
  ResetPasswordInput,
  UpdateUserInput,
} from "./schema.js";

const BCRYPT_ROUNDS = 12;

export class UsersService {
  static async listUsers(query: ListUsersQuery) {
    const { role, search, page, pageSize } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.UserWhereInput = {};

    if (role) {
      where.role = role;
    }

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { studentProfile: { matricNumber: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          isActive: true,
          createdAt: true,
          studentProfile: {
            select: {
              id: true,
              matricNumber: true,
              level: true,
              entryYear: true,
              entryMode: true,
              adviserId: true,
              department: { select: { id: true, name: true, code: true } },
            },
          },
        },
      }),
    ]);

    return {
      items: users,
      total,
      page,
      pageSize,
    };
  }

  static async createUser(input: CreateUserInput) {
    const existing = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (existing) {
      throw new BadRequestError("User with this email already exists");
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

    if (input.role === "STUDENT") {
      let deptId = input.departmentId;
      if (!deptId) {
        const defaultDept = await prisma.department.findFirst();
        if (!defaultDept) {
          throw new BadRequestError("Department not found. Please create a department first.");
        }
        deptId = defaultDept.id;
      }

      // Check matric number uniqueness
      const existingMatric = await prisma.studentProfile.findUnique({
        where: { matricNumber: input.matricNumber! },
      });
      if (existingMatric) {
        throw new BadRequestError("Student with this matric number already exists");
      }

      // Check adviser if provided
      if (input.adviserId) {
        const adviser = await prisma.user.findUnique({ where: { id: input.adviserId } });
        if (!adviser || adviser.role !== "ADVISER") {
          throw new BadRequestError("Assigned adviser must exist and have ADVISER role");
        }
      }

      return prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: input.email.toLowerCase(),
            passwordHash,
            fullName: input.fullName,
            role: "STUDENT",
          },
        });

        const profile = await tx.studentProfile.create({
          data: {
            userId: user.id,
            departmentId: deptId!,
            matricNumber: input.matricNumber!,
            level: input.level!,
            entryYear: input.entryYear!,
            entryMode: input.entryMode!,
            adviserId: input.adviserId || null,
          },
        });

        return {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          studentProfile: profile,
        };
      });
    }

    const user = await prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash,
        fullName: input.fullName,
        role: input.role,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return user;
  }

  static async updateUser(id: string, input: UpdateUserInput) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: { studentProfile: true },
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    return prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id },
        data: {
          fullName: input.fullName,
          email: input.email?.toLowerCase(),
          isActive: input.isActive,
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          isActive: true,
        },
      });

      if (user.studentProfile && (input.level !== undefined || input.adviserId !== undefined)) {
        if (input.adviserId) {
          const adv = await tx.user.findUnique({ where: { id: input.adviserId } });
          if (!adv || adv.role !== "ADVISER") {
            throw new BadRequestError("Adviser not found or does not have role ADVISER");
          }
        }

        await tx.studentProfile.update({
          where: { id: user.studentProfile.id },
          data: {
            level: input.level,
            adviserId: input.adviserId,
          },
        });
      }

      return updatedUser;
    });
  }

  static async resetPassword(id: string, input: ResetPasswordInput) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundError("User not found");
    }

    const passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);

    await prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    return { message: "Password reset successfully" };
  }

  static async deactivateUser(id: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundError("User not found");
    }

    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: "User deactivated successfully" };
  }

  static async assignAdviser(studentId: string, input: AssignAdviserInput) {
    // studentId can be studentProfile.id or userId
    let profile = await prisma.studentProfile.findUnique({ where: { id: studentId } });
    if (!profile) {
      profile = await prisma.studentProfile.findUnique({ where: { userId: studentId } });
    }

    if (!profile) {
      throw new NotFoundError("Student profile not found");
    }

    const adviser = await prisma.user.findUnique({ where: { id: input.adviserId } });
    if (!adviser || adviser.role !== "ADVISER") {
      throw new BadRequestError("Adviser not found or user is not an ADVISER");
    }

    const updated = await prisma.studentProfile.update({
      where: { id: profile.id },
      data: { adviserId: input.adviserId },
      include: {
        adviser: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    return {
      message: "Adviser assigned successfully",
      studentProfile: updated,
    };
  }
}
