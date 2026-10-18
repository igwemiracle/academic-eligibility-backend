import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, TokenPayload } from "../lib/jwt.js";
import { UnauthorizedError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { Role } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        fullName: string;
        role: Role;
        studentProfileId?: string;
      };
    }
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const bearerToken =
      authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null;
    const token = req.cookies?.access_token || bearerToken;
    if (!token) {
      throw new UnauthorizedError("Authentication required: access token missing");
    }

    let payload: TokenPayload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new UnauthorizedError("Invalid or expired access token");
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { studentProfile: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedError("Account is inactive or does not exist");
    }

    req.user = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      studentProfileId: user.studentProfile?.id,
    };

    next();
  } catch (error) {
    next(error);
  }
}
