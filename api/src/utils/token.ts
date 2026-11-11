import jwt, { SignOptions } from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { env } from '../config/env';
import type { AuthUser } from '../types/auth';

const tokenPayloadSchema = z.object({
  sub: z.string().uuid(),
  role: z.nativeEnum(Role),
});

export const signAuthToken = (user: AuthUser): string =>
  jwt.sign({ role: user.role }, env.JWT_SECRET, {
    subject: user.id,
    algorithm: 'HS256',
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  });

export const verifyAuthToken = (token: string): AuthUser => {
  const payload = tokenPayloadSchema.parse(
    jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }),
  );
  return { id: payload.sub, role: payload.role };
};
