/**
 * Per-account brute-force protection with an escalating delay.
 *
 * After `threshold` consecutive failed sign-ins for one email address the account is locked for
 * `baseDelayMs`, doubling with every further failure up to `maxDelayMs`. A success, or a quiet
 * period of `resetAfterMs`, clears the count. Unknown email addresses are tracked exactly like
 * real ones, so the lock never reveals whether an account exists.
 */
export interface ThrottleOptions {
  threshold?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  resetAfterMs?: number;
  maxTracked?: number;
  now?: () => number;
}

interface Entry {
  failures: number;
  lockedUntil: number;
  lastFailureAt: number;
}

export class LoginThrottle {
  private readonly entries = new Map<string, Entry>();
  private readonly threshold: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly resetAfterMs: number;
  private readonly maxTracked: number;
  private readonly now: () => number;

  constructor(options: ThrottleOptions = {}) {
    this.threshold = options.threshold ?? 5;
    this.baseDelayMs = options.baseDelayMs ?? 30_000;
    this.maxDelayMs = options.maxDelayMs ?? 15 * 60_000;
    this.resetAfterMs = options.resetAfterMs ?? 15 * 60_000;
    this.maxTracked = options.maxTracked ?? 10_000;
    this.now = options.now ?? Date.now;
  }

  /** Milliseconds the account is still locked for, or 0 when sign-in may be attempted. */
  remainingLockMs(key: string): number {
    const entry = this.entries.get(key);
    if (!entry) return 0;
    const now = this.now();
    if (now - entry.lastFailureAt > this.resetAfterMs && entry.lockedUntil <= now) {
      this.entries.delete(key);
      return 0;
    }
    return Math.max(0, entry.lockedUntil - now);
  }

  recordFailure(key: string): void {
    const now = this.now();
    const entry = this.entries.get(key) ?? { failures: 0, lockedUntil: 0, lastFailureAt: now };
    if (now - entry.lastFailureAt > this.resetAfterMs) entry.failures = 0;
    entry.failures += 1;
    entry.lastFailureAt = now;
    if (entry.failures >= this.threshold) {
      const steps = entry.failures - this.threshold;
      entry.lockedUntil = now + Math.min(this.maxDelayMs, this.baseDelayMs * 2 ** steps);
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    this.trim();
  }

  recordSuccess(key: string): void {
    this.entries.delete(key);
  }

  private trim(): void {
    while (this.entries.size > this.maxTracked) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) return;
      this.entries.delete(oldest);
    }
  }
}
