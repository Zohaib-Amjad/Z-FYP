export const escapeLike = (term: string): string => term.replace(/[\\%_]/g, '\\$&');
