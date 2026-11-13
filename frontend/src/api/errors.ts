import axios from "axios";

/** Flattens a DRF error response ({field: [msg]}, {detail: msg}, [msg], ...) into one string. */
export function getErrorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (!axios.isAxiosError(err)) return fallback;
  const data = err.response?.data;
  if (!data) return fallback;
  if (typeof data === "string") return data;
  if (typeof data.detail === "string") return data.detail;
  if (Array.isArray(data)) return data.join(" ");
  if (typeof data === "object") {
    const parts = Object.entries(data).map(([field, value]) => {
      const text = Array.isArray(value) ? value.join(" ") : String(value);
      return field === "non_field_errors" || field === "detail" ? text : `${field}: ${text}`;
    });
    if (parts.length) return parts.join(" · ");
  }
  return fallback;
}
