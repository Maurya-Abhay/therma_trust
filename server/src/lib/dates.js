/** Calendar dates are stored and served as "YYYY-MM-DD" strings, so they compare lexicographically. */
export const todayString = () => new Date().toISOString().slice(0, 10);

export function addDaysString(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(fromString, toString) {
  const ms = new Date(`${toString}T00:00:00Z`) - new Date(`${fromString}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** `2026-10-12T19:10:00.123000+00:00`, the shape the audit-log hash chain has always been computed over. */
export function pythonIso(date) {
  const pad = (n, w = 2) => String(n).padStart(w, "0");
  const ms = date.getUTCMilliseconds();
  const fraction = ms ? `.${pad(ms, 3)}000` : "";
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}${fraction}+00:00`
  );
}
