import { env } from '../config/env';

type Sink = (line: string) => void;

/** Audit lines go to standard output; the automated tests swap in their own sink or silence it. */
let sink: Sink | null = env.NODE_ENV === 'test' ? null : line => console.log(line);

export const setAuditSink = (next: Sink | null): void => {
  sink = next;
};

/**
 * One JSON line per security-relevant change, written next to the request log.
 * Only identifiers are recorded; request bodies, passwords, tokens and cookies never are.
 */
export const audit = (event: string, details: Record<string, unknown>): void => {
  sink?.(JSON.stringify({ level: 'audit', time: new Date().toISOString(), event, ...details }));
};
