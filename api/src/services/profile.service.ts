import { prisma } from '../config/prisma';
import type { ChangePasswordInput, UpdateProfileInput } from '../validators/profile.validators';
import { AppError } from '../utils/AppError';
import { hashPassword, verifyPassword } from '../utils/password';
import { SAFE_USER_SELECT, SafeUser } from '../utils/safeUser';

export const updateProfile = (userId: string, input: UpdateProfileInput): Promise<SafeUser> =>
  prisma.user.update({
    where: { id: userId },
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      drivingLicenseNumber: input.drivingLicenseNumber,
    },
    select: SAFE_USER_SELECT,
  });

export const changePassword = async (userId: string, input: ChangePasswordInput): Promise<void> => {
  const account = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!(await verifyPassword(input.currentPassword, account.passwordHash))) {
    throw new AppError(400, 'INVALID_CURRENT_PASSWORD', 'Your current password is incorrect', [
      { field: 'currentPassword', message: 'The password you entered is incorrect' },
    ]);
  }
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(input.newPassword) },
  });
};
