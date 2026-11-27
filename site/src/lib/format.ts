// Prints a validation output the way it looks in code. JSON.stringify would
// hide what the validators produce: Date and File objects, undefined.
const pad = (depth: number) => "  ".repeat(depth);

const formatKey = (key: string) =>
  /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);

export const formatValue = (value: unknown, depth = 0): string => {
  if (value === undefined) return "undefined";
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? "Invalid Date"
      : `Date(${value.toISOString()})`;
  }
  if (typeof File !== "undefined" && value instanceof File) {
    return `File(${JSON.stringify(value.name)}, ${value.size} bytes)`;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const items = value.map(
      (item) => `${pad(depth + 1)}${formatValue(item, depth + 1)}`,
    );
    return `[\n${items.join(",\n")}\n${pad(depth)}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) return "{}";
    const lines = entries.map(
      ([key, item]) =>
        `${pad(depth + 1)}${formatKey(key)}: ${formatValue(item, depth + 1)}`,
    );
    return `{\n${lines.join(",\n")}\n${pad(depth)}}`;
  }
  return JSON.stringify(value) ?? String(value);
};
