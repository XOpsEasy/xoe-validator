export type XOESuccess<T> = { type: "success"; value: T };
export type XOEError<E> = { type: "error"; value: E };

/** Either a success with the value or an error. */
export type XOEResult<T, E> = XOESuccess<T> | XOEError<E>;

export type XOEPath = readonly (string | number)[];

/** A validation issue; immutable data. */
export type XOEIssue = {
  /** Machine readable error code, e.g. "string.minLength", "required", "type". */
  readonly code: string;
  /** Default (or user provided) human readable message. */
  readonly message: string;
  /** Rule arguments, useful for translated messages, e.g. { min: 3 }. */
  readonly params?: Readonly<Record<string, unknown>>;
  /** Location of the invalid value, [] for the validated value itself. */
  readonly path: XOEPath;
  /**
   * The invalid value as it was passed in, only with
   * validate(value, { reportInput: true }). May contain sensitive data.
   */
  readonly input?: unknown;
  /**
   * true when the message was passed in (minLength(3, "..."), errorMessage,
   * refine(check, "..."), ...): localizeIssues keeps it.
   */
  readonly customMessage?: true;
};

export type XOEData = Record<string, unknown>;

export type XOEContext = {
  /** The parent object, used by cross-field rules such as sameAs. */
  data?: XOEData;
  path: XOEPath;
};

export type MaybePromise<T> = T | Promise<T>;

export type XOEValidationOutput<T> = XOEResult<T, readonly XOEIssue[]>;
