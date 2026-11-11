import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api';
import { applyServerErrors } from '@/lib/forms';
import {
  PASSWORD_RULES,
  changePasswordSchema,
  loginSchema,
  profileSchema,
  registerSchema,
} from '@/lib/schemas';
import { vi } from 'vitest';

const validRegistration = {
  firstName: 'Amelia',
  lastName: 'Hart',
  email: 'amelia@example.com',
  phone: '+44 7700 900111',
  drivingLicenseNumber: '',
  password: 'Prestige2026',
  confirmPassword: 'Prestige2026',
};

const messagesFor = (result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) =>
  Object.fromEntries(
    (result.error?.issues ?? [])
      .map(issue => [String(issue.path[0]), issue.message] as const)
      .reverse(),
  );

describe('registerSchema', () => {
  it('accepts a complete registration with an empty optional licence', () => {
    expect(registerSchema.safeParse(validRegistration).success).toBe(true);
  });

  it('rejects weak passwords with a specific message', () => {
    const base = { ...validRegistration, confirmPassword: 'x' };
    expect(
      messagesFor(
        registerSchema.safeParse({ ...base, password: 'short1', confirmPassword: 'short1' }),
      ).password,
    ).toMatch(/at least 8/);
    expect(
      messagesFor(
        registerSchema.safeParse({ ...base, password: '12345678', confirmPassword: '12345678' }),
      ).password,
    ).toMatch(/letter/);
    expect(
      messagesFor(
        registerSchema.safeParse({ ...base, password: 'abcdefgh', confirmPassword: 'abcdefgh' }),
      ).password,
    ).toMatch(/number/);
  });

  it('flags a mismatching confirmation on the confirm field', () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      confirmPassword: 'Different2026',
    });
    expect(messagesFor(result).confirmPassword).toBe('Passwords do not match');
  });

  it('rejects bad email, phone and licence values', () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      email: 'nope',
      phone: 'call me',
      drivingLicenseNumber: '!!',
    });
    const messages = messagesFor(result);
    expect(messages.email).toBe('Enter a valid email address');
    expect(messages.phone).toBe('Enter a valid phone number');
    expect(messages.drivingLicenseNumber).toBe('Enter a valid driving licence number');
  });

  it('requires names and phone', () => {
    const messages = messagesFor(
      registerSchema.safeParse({ ...validRegistration, firstName: ' ', phone: '' }),
    );
    expect(messages.firstName).toBe('This field is required');
    expect(messages.phone).toBe('Enter your phone number');
  });
});

describe('other schemas', () => {
  it('login needs an email and a password', () => {
    const messages = messagesFor(loginSchema.safeParse({ email: '', password: '' }));
    expect(messages.email).toBe('Enter your email address');
    expect(messages.password).toBe('Enter your password');
  });

  it('profile allows clearing the licence number but not the phone', () => {
    const base = {
      firstName: 'A',
      lastName: 'B',
      phone: '+44 20 7946 1000',
      drivingLicenseNumber: '',
    };
    expect(profileSchema.safeParse(base).success).toBe(true);
    expect(profileSchema.safeParse({ ...base, phone: '' }).success).toBe(false);
  });

  it('change password checks the new password rules and the confirmation', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'old',
      newPassword: 'Newpass2026',
      confirmPassword: 'Newpass2027',
    });
    expect(messagesFor(result).confirmPassword).toBe('Passwords do not match');
    expect(
      changePasswordSchema.safeParse({
        currentPassword: 'old',
        newPassword: 'weak',
        confirmPassword: 'weak',
      }).success,
    ).toBe(false);
  });
});

describe('PASSWORD_RULES', () => {
  const met = (value: string) =>
    PASSWORD_RULES.filter(rule => rule.test(value)).map(rule => rule.id);

  it('reports which rules a password satisfies', () => {
    expect(met('')).toEqual([]);
    expect(met('abc')).toEqual(['letter']);
    expect(met('abcdefg1')).toEqual(['length', 'letter', 'number']);
  });
});

describe('applyServerErrors with code mapping', () => {
  it('pins EMAIL_TAKEN to the email field and shows no banner', () => {
    const setError = vi.fn();
    const error = new ApiError(409, 'EMAIL_TAKEN', 'An account with this email already exists');

    const banner = applyServerErrors(error, setError, ['email', 'password'], {
      EMAIL_TAKEN: 'email',
    });

    expect(setError).toHaveBeenCalledWith('email', {
      type: 'server',
      message: 'An account with this email already exists',
    });
    expect(banner).toBeNull();
  });

  it('falls back to the banner when the pinned field is not on the form', () => {
    const error = new ApiError(409, 'EMAIL_TAKEN', 'Taken');
    expect(applyServerErrors(error, vi.fn(), ['password'], { EMAIL_TAKEN: 'email' })).toBe('Taken');
  });
});
