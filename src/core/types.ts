/** Registry for validator types without type specific rules. */
export type NoRules = Record<never, never>;

/** Flattens intersections so inferred types read as one object. */
// `& {}` makes editors show the flattened object instead of the alias.
// oxlint-disable-next-line typescript/no-empty-object-type
export type Simplify<T> = { [K in keyof T]: T[K] } & {};
