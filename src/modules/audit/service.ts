import { prisma } from "../../lib/prisma.js";

export interface LogAuditInput {
  actorId: string;
  action: string;
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}

export class AuditService {
  static async log(input: LogAuditInput) {
    try {
      return await prisma.auditLog.create({
        data: {
          actorId: input.actorId,
          action: input.action,
          entity: input.entity,
          entityId: input.entityId,
          before: input.before ? (JSON.parse(JSON.stringify(input.before)) as any) : undefined,
          after: input.after ? (JSON.parse(JSON.stringify(input.after)) as any) : undefined,
        },
      });
    } catch (err) {
      // Audit log creation failure should not crash the request, but log it
      console.error("Failed to create audit log entry:", err);
      return null;
    }
  }

  static async listLogs(page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;

    const [total, items] = await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.findMany({
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          actor: {
            select: {
              id: true,
              email: true,
              fullName: true,
              role: true,
            },
          },
        },
      }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
    };
  }
}
