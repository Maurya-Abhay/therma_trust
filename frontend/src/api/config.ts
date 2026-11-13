/** The single API base URL used by all browser requests. Keep the /api suffix. */
export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api").replace(/\/+$/, "");
