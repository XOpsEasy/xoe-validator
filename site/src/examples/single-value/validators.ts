import xoe, {
  rsRules,
  type XOEIssue,
  type XOEResult,
} from "@x-ops-easy/xoe-validator";

type Entry = {
  label: string;
  /** The code of `validator`, as shown on the page. */
  code: string;
  validator: {
    validate: (value: unknown) => XOEResult<unknown, readonly XOEIssue[]>;
  };
  sample: string;
};

// There's no difference between a schema and a validator: each of these
// validates one value on its own.
export const validators: Entry[] = [
  {
    label: "Email",
    code: "xoe.string().trim().toLowerCase().email()",
    validator: xoe.string().trim().toLowerCase().email(),
    sample: "  Ana@Example.COM",
  },
  {
    label: "Password",
    code: 'xoe.string().minLength(8).regexMatch(/\\d/, "Add a digit.")',
    validator: xoe.string().minLength(8).regexMatch(/\d/, "Add a digit."),
    sample: "secret",
  },
  {
    label: "Page number",
    code: "xoe.coerce.number().integer().between(1, 100)",
    validator: xoe.coerce.number().integer().between(1, 100),
    sample: "250",
  },
  {
    label: "Date of birth",
    code: "xoe.coerce.date().minAge(18)",
    validator: xoe.coerce.date().minAge(18),
    sample: "2024-02-30",
  },
  {
    label: "URL",
    code: "xoe.string().url()",
    validator: xoe.string().url(),
    sample: "javascript:alert(1)",
  },
  {
    label: "IPv4 address",
    code: "xoe.string().ip(4)",
    validator: xoe.string().ip(4),
    sample: "192.168.01.1",
  },
  {
    label: "Postal code",
    code: "xoe.string().digits().length(5)",
    validator: xoe.string().digits().length(5),
    sample: "1100a",
  },
  {
    label: "UUID",
    code: "xoe.string().uuid()",
    validator: xoe.string().uuid(),
    sample: "6f1c0e52-7d0b-4a51-9a6e-2f8a4f0f3b1c",
  },
  {
    label: "Role",
    code: 'xoe.enum(["admin", "user", "guest"])',
    validator: xoe.enum(["admin", "user", "guest"]),
    sample: "owner",
  },
  {
    label: "JMBG (Serbian personal ID)",
    code: "xoe.string().trim().with(rsRules.jmbg())",
    validator: xoe.string().trim().with(rsRules.jmbg()),
    sample: "0101990710009",
  },
];
