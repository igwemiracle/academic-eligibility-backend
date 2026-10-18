import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { Role } from "@prisma/client";

export interface TokenPayload {
  userId: string;
  email: string;
  role: Role;
  studentProfileId?: string;
}

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "1h" });
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
}
