import { prisma } from '../config/prisma';
import type { LoginInput, RegisterInput } from '../validators/auth.validators';
import { AppError } from '../utils/AppError';
import { hashPassword, verifyPassword } from '../utils/password';
import { isUniqueViolation } from '../utils/prismaErrors';
import { SAFE_USER_SELECT, SafeUser } from '../utils/safeUser';
import { signAuthToken } from '../utils/token';

export interface AuthResult {
  user: SafeUser;
  token: string;
}

export const emailTaken = (): AppError =>
  new AppError(409, 'EMAIL_TAKEN', 'An account with this email address already exists', [
    { field: 'email', message: 'This email address is already registered' },
  ]);

export const registerCustomer = async (input: RegisterInput): Promise<AuthResult> => {
  const passwordHash = await hashPassword(input.password);
  try {
    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        role: 'CUSTOMER',
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        drivingLicenseNumber: input.drivingLicenseNumber ?? null,
        lastLoginAt: new Date(),
      },
      select: SAFE_USER_SELECT,
    });
    return { user, token: signAuthToken({ id: user.id, role: user.role }) };
  } catch (error) {
    if (isUniqueViolation(error)) throw emailTaken();
    throw error;
  }
};

export const loginUser = async ({ email, password }: LoginInput): Promise<AuthResult> => {
  const account = await prisma.user.findUnique({ where: { email } });
  const passwordMatches = await verifyPassword(password, account?.passwordHash ?? null);
  if (!account || !passwordMatches) {
    throw new AppError(
      401,
      'INVALID_CREDENTIALS',
      'The email or password you entered is incorrect',
    );
  }
  if (!account.isActive) {
    throw new AppError(403, 'ACCOUNT_DISABLED', 'This account has been deactivated');
  }
  const user = await prisma.user.update({
    where: { id: account.id },
    data: { lastLoginAt: new Date() },
    select: SAFE_USER_SELECT,
  });
  return { user, token: signAuthToken({ id: user.id, role: user.role }) };
};

export const getCurrentUser = async (userId: string): Promise<SafeUser> => {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: SAFE_USER_SELECT });
  if (!user) throw new AppError(401, 'UNAUTHENTICATED', 'Your session is invalid or has expired');
  return user;
};
