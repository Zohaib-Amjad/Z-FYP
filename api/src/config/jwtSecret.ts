const KNOWN_PLACEHOLDERS = [
  'super_secret_jwt_key_for_development_purposes_only_min_32_chars',
  'changeme',
  'change-me',
  'secret',
  'your-secret',
  'jwt_secret',
  'replace_me',
];

const MIN_PRODUCTION_LENGTH = 32;
const MIN_DISTINCT_CHARACTERS = 10;

/**
 * Describes why a JWT secret is too weak, or returns null when it is acceptable.
 * Development only needs a non-trivial value; production refuses short, low-variety and
 * published placeholder secrets, because anyone who knows the secret can forge a session.
 */
export const jwtSecretProblem = (secret: string, nodeEnv: string): string | null => {
  if (nodeEnv !== 'production') return null;
  if (secret.length < MIN_PRODUCTION_LENGTH) {
    return `JWT_SECRET must be at least ${MIN_PRODUCTION_LENGTH} characters in production`;
  }
  if (KNOWN_PLACEHOLDERS.some(placeholder => secret.toLowerCase().includes(placeholder))) {
    return 'JWT_SECRET is a published placeholder; generate a random one (for example with `openssl rand -base64 48`)';
  }
  if (new Set(secret).size < MIN_DISTINCT_CHARACTERS) {
    return 'JWT_SECRET has too little variety; generate a random one';
  }
  return null;
};
