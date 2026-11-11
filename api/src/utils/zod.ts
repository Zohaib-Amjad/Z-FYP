import type { ZodError, ZodIssue } from 'zod';
import type { ErrorDetail } from './response';

const issueToDetails = (issue: ZodIssue): ErrorDetail[] => {
  if (issue.code === 'unrecognized_keys') {
    return issue.keys.map(key => ({
      field: [...issue.path, key].join('.'),
      message: 'This field is not allowed',
    }));
  }
  return [{ field: issue.path.join('.'), message: issue.message }];
};

export const zodIssuesToDetails = (error: ZodError): ErrorDetail[] =>
  error.issues.flatMap(issueToDetails);
