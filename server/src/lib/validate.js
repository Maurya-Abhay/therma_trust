import { parsePhoneNumberFromString } from "libphonenumber-js";
import { validationError } from "./errors.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Check a request body against a field spec and return only the cleaned fields.
 * Messages match the wording clients already show, field by field.
 *
 *   field: { type, required, nullable, blank, maxLength, minLength, min, max,
 *            choices, maxDigits, decimalPlaces, default }
 *
 * `partial` (PATCH) skips "required" and defaults for fields that were not sent.
 */
export function validateBody(body, spec, { partial = false } = {}) {
  const errors = {};
  const clean = {};
  const input = body && typeof body === "object" ? body : {};

  for (const [field, rules] of Object.entries(spec)) {
    const present = Object.prototype.hasOwnProperty.call(input, field) && input[field] !== undefined;

    if (!present) {
      if (partial) continue;
      if (rules.default !== undefined) {
        clean[field] = typeof rules.default === "function" ? rules.default() : rules.default;
        continue;
      }
      if (rules.required) errors[field] = ["This field is required."];
      continue;
    }

    const value = input[field];
    if (value === null) {
      if (rules.nullable) clean[field] = null;
      else errors[field] = ["This field may not be null."];
      continue;
    }

    const result = coerce(value, rules);
    if (result.error) errors[field] = [result.error];
    else clean[field] = result.value;
  }

  if (Object.keys(errors).length) throw validationError(errors);
  return clean;
}

function coerce(raw, rules) {
  switch (rules.type) {
    case "string": {
      if (typeof raw !== "string" && typeof raw !== "number") return { error: "Not a valid string." };
      const value = rules.trim === false ? String(raw) : String(raw).trim();
      if (value === "" && !rules.blank) return { error: "This field may not be blank." };
      if (rules.maxLength && value.length > rules.maxLength) {
        return { error: `Ensure this field has no more than ${rules.maxLength} characters.` };
      }
      if (rules.minLength && value.length < rules.minLength) {
        return { error: `Ensure this field has at least ${rules.minLength} characters.` };
      }
      return { value };
    }
    case "email": {
      if (typeof raw !== "string") return { error: "Not a valid string." };
      const value = raw.trim();
      if (value === "") return { error: "This field may not be blank." };
      if (!EMAIL_RE.test(value)) return { error: "Enter a valid email address." };
      if (value.length > 254) return { error: "Ensure this field has no more than 254 characters." };
      return { value };
    }
    case "phone": {
      if (typeof raw !== "string") return { error: "Not a valid string." };
      const text = raw.trim();
      if (text === "") return { value: "" };
      // Numbers are stored in international form (+919876543210) so the country is never ambiguous.
      const parsed = text.startsWith("+") ? parsePhoneNumberFromString(text) : undefined;
      if (!parsed || !parsed.isValid()) {
        return { error: "Enter a valid phone number with its country code, for example +91 98765 43210." };
      }
      return { value: parsed.number };
    }
    case "int":
    case "fk": {
      const value = typeof raw === "string" && /^-?\d+$/.test(raw.trim()) ? Number(raw) : raw;
      if (typeof value !== "number" || !Number.isInteger(value)) {
        return {
          error: rules.type === "fk" ? `Incorrect type. Expected pk value, received ${typeof raw}.` : "A valid integer is required.",
        };
      }
      if (rules.min !== undefined && value < rules.min) return { error: `Ensure this value is greater than or equal to ${rules.min}.` };
      if (rules.max !== undefined && value > rules.max) return { error: `Ensure this value is less than or equal to ${rules.max}.` };
      return { value };
    }
    case "decimal": {
      const text = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : null;
      if (text === null || !/^-?\d+(\.\d+)?$/.test(text)) return { error: "A valid number is required." };
      const [whole, fraction = ""] = text.replace("-", "").split(".");
      const places = rules.decimalPlaces ?? 2;
      if (fraction.length > places) return { error: `Ensure that there are no more than ${places} decimal places.` };
      if (rules.maxDigits && whole.replace(/^0+(?=\d)/, "").length > rules.maxDigits - places) {
        return { error: `Ensure that there are no more than ${rules.maxDigits - places} digits before the decimal point.` };
      }
      const value = Number(text);
      if (rules.min !== undefined && value < rules.min) return { error: `Ensure this value is greater than or equal to ${rules.min}.` };
      return { value };
    }
    case "bool": {
      if (typeof raw === "boolean") return { value: raw };
      if (typeof raw === "string" && /^(true|1|on|yes)$/i.test(raw)) return { value: true };
      if (typeof raw === "string" && /^(false|0|off|no)$/i.test(raw)) return { value: false };
      if (raw === 1 || raw === 0) return { value: raw === 1 };
      return { error: "Must be a valid boolean." };
    }
    case "date": {
      if (typeof raw !== "string" || !DATE_RE.test(raw.trim()) || Number.isNaN(Date.parse(`${raw.trim()}T00:00:00Z`))) {
        return { error: "Date has wrong format. Use one of these formats instead: YYYY-MM-DD." };
      }
      return { value: raw.trim() };
    }
    case "datetime": {
      const date = typeof raw === "string" ? new Date(raw.trim()) : null;
      if (!date || Number.isNaN(date.getTime())) {
        return {
          error: "Datetime has wrong format. Use one of these formats instead: YYYY-MM-DDThh:mm[:ss[.uuuuuu]][+HH:MM|-HH:MM|Z].",
        };
      }
      return { value: date };
    }
    case "choice": {
      if (!rules.choices.includes(raw)) return { error: `"${raw}" is not a valid choice.` };
      return { value: raw };
    }
    case "json": {
      if (typeof raw === "string") {
        try {
          return { value: JSON.parse(raw) };
        } catch {
          return { error: "Value must be valid JSON." };
        }
      }
      return { value: raw };
    }
    default:
      return { value: raw };
  }
}
