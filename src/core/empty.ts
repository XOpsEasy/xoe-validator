/** Form semantics: undefined, null and "" count as empty values. */
export const isEmpty = (value: unknown): boolean =>
  value === undefined || value === null || value === "";
