import { prisma } from '../config/prisma';
import type { CreateStaffInput } from '../validators/auth.validators';
import { Page, PageParams, buildPage, toSkipTake } from '../utils/pagination';
import { hashPassword } from '../utils/password';
import { SAFE_USER_SELECT, SafeUser } from '../utils/safeUser';
import { isUniqueViolation } from '../utils/prismaErrors';
import { emailTaken } from './auth.service';

export const createStaffAccount = async (input: CreateStaffInput): Promise<SafeUser> => {
  const passwordHash = await hashPassword(input.password);
  try {
    return await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        role: 'STAFF',
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
      },
      select: SAFE_USER_SELECT,
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw emailTaken();
    throw error;
  }
};

export const listStaffAccounts = async (params: PageParams): Promise<Page<SafeUser>> => {
  const where = { role: 'STAFF' } as const;
  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: SAFE_USER_SELECT,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      ...toSkipTake(params),
    }),
    prisma.user.count({ where }),
  ]);
  return buildPage(items, total, params);
};
