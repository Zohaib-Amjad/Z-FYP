import { env } from '../../src/config/env';
import type { AuthUser } from '../../src/types/auth';
import { signAuthToken } from '../../src/utils/token';

export const authCookie = (user: AuthUser): string => `${env.COOKIE_NAME}=${signAuthToken(user)}`;
