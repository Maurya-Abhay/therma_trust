/**
 * `json.dumps(value, sort_keys=True)` as Python prints it.
 *
 * The audit log's hash chain was first computed in Python; reproducing its exact
 * serialisation (", " and ": " separators, ASCII-only escapes) lets rows carried
 * over from the old database keep verifying.
 */
export function pyJsonDumps(value, { compact = false } = {}) {
  const itemSep = compact ? "," : ", ";
  const keySep = compact ? ":" : ": ";
  const dump = (inner) => pyJsonDumps(inner, { compact });
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "null";
    return Number.isInteger(value) && Math.abs(value) < 1e21 ? String(value) : pyFloat(value);
  }
  if (typeof value === "string") return pyString(value);
  if (Array.isArray(value)) return `[${value.map(dump).join(itemSep)}]`;
  if (value instanceof Date) return pyString(value.toISOString());
  if (typeof value === "object") {
    if (value.constructor?.name === "Decimal128") return pyString(value.toString());
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${pyString(key)}${keySep}${dump(value[key])}`).join(itemSep)}}`;
  }
  return pyString(String(value));
}

function pyFloat(value) {
  // Python repr keeps ".0" on whole floats; JS drops it.
  const text = String(value);
  return /[.e]/.test(text) ? text : `${text}.0`;
}

function pyString(text) {
  let out = '"';
  for (const char of text) {
    const code = char.codePointAt(0);
    if (char === '"') out += '\\"';
    else if (char === "\\") out += "\\\\";
    else if (char === "\n") out += "\\n";
    else if (char === "\r") out += "\\r";
    else if (char === "\t") out += "\\t";
    else if (char === "\b") out += "\\b";
    else if (char === "\f") out += "\\f";
    else if (code < 0x20 || (code > 0x7e && code <= 0xffff)) out += `\\u${code.toString(16).padStart(4, "0")}`;
    else if (code > 0xffff) {
      const offset = code - 0x10000;
      const high = 0xd800 + (offset >> 10);
      const low = 0xdc00 + (offset & 0x3ff);
      out += `\\u${high.toString(16)}\\u${low.toString(16)}`;
    } else out += char;
  }
  return `${out}"`;
}
