/** HTTP errors shaped like the API's clients expect: `{ detail }` or `{ field: [messages] }`. */
export class ApiError extends Error {
  constructor(status, body) {
    super(typeof body === "string" ? body : body?.detail || "Request failed");
    this.status = status;
    this.body = typeof body === "string" ? { detail: body } : body;
  }
}

export const notFound = (detail = "Not found.") => new ApiError(404, { detail });
export const forbidden = (detail = "You do not have permission to perform this action.") => new ApiError(403, { detail });
export const unauthorized = (detail = "Authentication credentials were not provided.") => new ApiError(401, { detail });
export const badRequest = (body) => new ApiError(400, body);
export const conflict = (body) => new ApiError(409, body);

/** `{ field: "message" }` or `{ field: ["m1"] }` -> `{ field: ["m1"] }`. */
export function validationError(errors) {
  const body = {};
  for (const [field, value] of Object.entries(errors)) body[field] = Array.isArray(value) ? value : [value];
  return new ApiError(400, body);
}
