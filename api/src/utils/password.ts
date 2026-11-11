import bcrypt from 'bcryptjs';

const BCRYPT_COST = 12;

const DUMMY_HASH = '$2a$12$uG6./vGBLRfxSCWKnSKtXuGEz8AhDrEVxCNOvH4cmJQUbamSPNSh6';

export const hashPassword = (password: string): Promise<string> =>
  bcrypt.hash(password, BCRYPT_COST);

export const verifyPassword = (password: string, hash: string | null): Promise<boolean> =>
  bcrypt.compare(password, hash ?? DUMMY_HASH).then(matches => matches && hash !== null);
