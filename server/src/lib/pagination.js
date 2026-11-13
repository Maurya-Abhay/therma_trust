import { notFound } from "./errors.js";

export const PAGE_SIZE = 50;

function pageUrl(req, page) {
  const url = new URL(req.originalUrl, `${req.protocol}://${req.get("host")}`);
  if (page === 1) url.searchParams.delete("page");
  else url.searchParams.set("page", String(page));
  return url.toString();
}

/**
 * Page-number pagination in the shape the web app reads:
 * `{ count, next, previous, results }`, 50 per page, `?page=N`.
 *
 * `build(skip, limit)` returns the query for one page; `present(rows)` turns the
 * lean rows into API objects (it may be async, to load related records in bulk).
 */
export async function paginate(req, { model, filter, build, present }) {
  const requested = Number.parseInt(req.query.page ?? "1", 10);
  const page = Number.isFinite(requested) && requested > 0 ? requested : 1;
  const count = await model.countDocuments(filter);
  const lastPage = Math.max(1, Math.ceil(count / PAGE_SIZE));
  if (page > lastPage) throw notFound("Invalid page.");

  const rows = await build((page - 1) * PAGE_SIZE, PAGE_SIZE);
  return {
    count,
    next: page < lastPage ? pageUrl(req, page + 1) : null,
    previous: page > 1 ? pageUrl(req, page - 1) : null,
    results: await present(rows),
  };
}

/**
 * Turn `?facility=3&status=open` into a Mongo filter from a small spec:
 *   { param: "field" | ["field", "int" | "bool" | "datetime" | "string", "$gte"?] }
 * Values that do not parse are ignored rather than failing the whole request.
 */
export function filtersFrom(req, spec) {
  const filter = {};
  for (const [param, definition] of Object.entries(spec)) {
    const raw = req.query[param];
    if (raw === undefined || raw === "" || typeof raw !== "string") continue;
    const [field, type = "string", operator] = Array.isArray(definition) ? definition : [definition];
    let value = raw;
    if (type === "int") {
      value = Number(raw);
      if (!Number.isInteger(value)) continue;
    } else if (type === "bool") {
      if (/^(true|1)$/i.test(raw)) value = true;
      else if (/^(false|0)$/i.test(raw)) value = false;
      else continue;
    } else if (type === "datetime") {
      value = new Date(raw);
      if (Number.isNaN(value.getTime())) continue;
    }
    if (operator) filter[field] = { ...(filter[field] || {}), [operator]: value };
    else filter[field] = value;
  }
  return filter;
}

/**
 * Combine a role's visibility scope with request filters so neither can override
 * the other: `?technician=7` narrows what a user may see, it never widens it.
 */
export function allOf(...parts) {
  const real = parts.filter((part) => part && Object.keys(part).length > 0);
  if (real.length === 0) return {};
  return real.length === 1 ? real[0] : { $and: real };
}
