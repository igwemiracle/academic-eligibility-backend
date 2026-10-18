import { prisma } from "../../lib/prisma.js";
import { BadRequestError, NotFoundError } from "../../lib/errors.js";
import { CreateSessionInput, UpdateSessionInput } from "./schema.js";

export class SessionsService {
  static async listSessions() {
    return prisma.academicSession.findMany({
      orderBy: { startYear: "asc" },
      select: {
        id: true,
        name: true,
        startYear: true,
        endYear: true,
      },
    });
  }

  static async createSession(input: CreateSessionInput) {
    const existing = await prisma.academicSession.findUnique({
      where: { name: input.name },
    });

    if (existing) {
      throw new BadRequestError(`Academic session ${input.name} already exists`);
    }

    return prisma.academicSession.create({
      data: {
        name: input.name,
        startYear: input.startYear,
        endYear: input.endYear,
      },
      select: {
        id: true,
        name: true,
        startYear: true,
        endYear: true,
      },
    });
  }

  static async updateSession(id: string, input: UpdateSessionInput) {
    const session = await prisma.academicSession.findUnique({ where: { id } });
    if (!session) {
      throw new NotFoundError("Academic session not found");
    }

    if (input.name && input.name !== session.name) {
      const existing = await prisma.academicSession.findUnique({
        where: { name: input.name },
      });
      if (existing) {
        throw new BadRequestError(`Academic session ${input.name} already exists`);
      }
    }

    return prisma.academicSession.update({
      where: { id },
      data: {
        name: input.name,
        startYear: input.startYear,
        endYear: input.endYear,
      },
      select: {
        id: true,
        name: true,
        startYear: true,
        endYear: true,
      },
    });
  }
}
