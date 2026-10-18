import bcrypt from "bcrypt";
import { prisma } from "../../lib/prisma.js";
import { signAccessToken } from "../../lib/jwt.js";
import { BadRequestError, NotFoundError, UnauthorizedError } from "../../lib/errors.js";
import { ChangePasswordInput, LoginInput } from "./schema.js";

const BCRYPT_ROUNDS = 12;

export class AuthService {
  static async login(input: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      include: { studentProfile: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const isValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const token = signAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      studentProfileId: user.studentProfile?.id,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }

  static async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
      },
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    return { user };
  }

  static async changePassword(userId: string, input: ChangePasswordInput) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    const isMatch = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new BadRequestError("Current password is incorrect");
    }

    const newHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    return { message: "Password updated successfully" };
  }
}
