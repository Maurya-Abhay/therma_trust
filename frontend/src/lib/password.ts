/**
 * The password policy, shown live while someone types. The server enforces the same rules
 * (server/src/lib/security.js), so what the checklist says is exactly what will be accepted.
 * Signing in is never affected: people with an older, weaker password can still get in.
 */
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

const COMMON = new Set([
  "password", "password1", "password123", "12345678", "123456789", "1234567890", "qwertyui", "qwerty123",
  "qwertyuiop", "iloveyou", "abc12345", "abcd1234", "11111111", "00000000", "admin123", "welcome1",
  "welcome123", "letmein1", "letmein123", "monkey123", "dragon123", "football1", "baseball1", "sunshine1",
  "princess1", "trustno1", "passw0rd", "p@ssw0rd", "changeme", "changeme123", "administrator", "thermatrust",
  "password@123", "password@1234", "password1!", "password123!", "password!123", "welcome@123", "welcome@1234",
  "welcome1!", "admin@123", "admin@1234", "admin@12345", "qwerty@123", "qwerty123!", "qwerty@1234", "abcd@1234",
  "abc@12345", "india@123", "india@1234", "test@1234", "test@12345", "thermatrust@123", "thermatrust1!",
  "p@ssw0rd123", "p@ssw0rd!", "passw0rd!", "passw0rd@123", "letmein@123", "iloveyou@123", "changeme@123",
]);

export interface PasswordRule {
  id: "length" | "case" | "number" | "symbol";
  label: string;
  met: boolean;
}

export interface PasswordReport {
  rules: PasswordRule[];
  common: boolean;
  similar: boolean;
  /** 0 empty, 1 weak, 2 almost there, 3 strong, 4 very strong */
  level: 0 | 1 | 2 | 3 | 4;
  label: string;
  /** True when the server will accept it. */
  ok: boolean;
}

/** `personal` = things the password must not contain (email, first and last name). */
export function checkPassword(password: string, personal: string[] = []): PasswordReport {
  const rules: PasswordRule[] = [
    { id: "length", label: `At least ${PASSWORD_MIN_LENGTH} characters`, met: password.length >= PASSWORD_MIN_LENGTH },
    { id: "case", label: "Upper and lower case letters", met: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { id: "number", label: "A number", met: /\d/.test(password) },
    { id: "symbol", label: "A symbol such as ! @ # ?", met: /[^A-Za-z0-9]/.test(password) },
  ];

  const lowered = password.toLowerCase();
  const common = COMMON.has(lowered);
  const tokens = personal
    .flatMap((value) => [value, value.split("@")[0]])
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length >= 4);
  const similar = tokens.some((token) => lowered.includes(token));

  const met = rules.filter((rule) => rule.met).length;
  const ok = met === rules.length && !common && !similar && password.length <= PASSWORD_MAX_LENGTH;

  let level: PasswordReport["level"] = 0;
  if (password.length > 0) {
    if (ok) level = password.length >= 14 ? 4 : 3;
    else level = met >= 3 || common || similar ? 2 : 1;
  }
  const label = ["", "Weak", "Almost there", "Strong", "Very strong"][level];
  return { rules, common, similar, level, label, ok };
}
