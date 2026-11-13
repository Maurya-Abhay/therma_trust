import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { todayString } from "../lib/dates.js";

/**
 * AI-assisted reading of credential documents (EPA 608 cards, licences, ...).
 *
 * Two separate jobs, deliberately kept apart:
 *  - extractCredentialFields asks Claude to read the document into structured
 *    fields. A convenience for the technician (pre-fill) and a second opinion
 *    for the admin; it never approves anything.
 *  - compareExtraction turns disagreements between what the document says and
 *    what the technician typed / who they are into reviewable flags. Plain
 *    code, no model, so the same inputs always give the same flags.
 */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const PDF = "application/pdf";

const SYSTEM_PROMPT =
  "You read photos and scans of professional credentials (certification cards, licences, " +
  "training certificates) for a refrigeration compliance platform. Transcribe only what is " +
  "printed on the document. Never guess or infer a value that is not visible: use null for " +
  "anything missing or illegible and say so in `notes`. Dates must be ISO format YYYY-MM-DD. " +
  "If the file is not a credential document at all, set is_credential_document to false.";

const TOOL = {
  name: "record_credential",
  description: "Record the details read from the credential document.",
  input_schema: {
    type: "object",
    properties: {
      is_credential_document: { type: "boolean", description: "False if the file is not a certificate, licence or ID-style card" },
      holder_name: { type: ["string", "null"], description: "Full name of the person the credential was issued to" },
      credential_name: { type: ["string", "null"], description: "Title, e.g. 'EPA Section 608 Universal Certification'" },
      issuer_name: { type: ["string", "null"], description: "Organisation that issued it" },
      credential_number: { type: ["string", "null"], description: "Certificate / licence / card number" },
      issue_date: { type: ["string", "null"], description: "Issue date as YYYY-MM-DD" },
      expiry_date: { type: ["string", "null"], description: "Expiry date as YYYY-MM-DD, null if it does not expire" },
      notes: { type: ["string", "null"], description: "Anything illegible, ambiguous or unusual about the document" },
    },
    required: [
      "is_credential_document", "holder_name", "credential_name", "issuer_name", "credential_number",
      "issue_date", "expiry_date", "notes",
    ],
  },
};

export class OcrUnavailable extends Error {}
export class OcrFailed extends Error {}

/** Sniff the real type from magic bytes: the client-supplied content type is not trusted. */
export function detectMediaType(buffer) {
  const startsWith = (...bytes) => bytes.every((b, i) => buffer[i] === b);
  if (startsWith(0x25, 0x50, 0x44, 0x46)) return PDF;
  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (startsWith(0xff, 0xd8, 0xff)) return "image/jpeg";
  const head = buffer.subarray(0, 6).toString("latin1");
  if (head === "GIF87a" || head === "GIF89a") return "image/gif";
  if (buffer.subarray(0, 4).toString("latin1") === "RIFF" && buffer.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

let client = null;
let override = null;

/** Tests inject a fake reader; production uses the Anthropic API. */
export function setExtractor(fn) {
  override = fn;
}

export async function extractCredentialFields(buffer, mediaType) {
  if (override) return override(buffer, mediaType);
  if (!config.anthropicApiKey) throw new OcrUnavailable("AI document reading isn't configured on this server.");

  client ??= new Anthropic({ apiKey: config.anthropicApiKey, timeout: 60_000 });
  const data = buffer.toString("base64");
  const sourceBlock =
    mediaType === PDF
      ? { type: "document", source: { type: "base64", media_type: PDF, data } }
      : { type: "image", source: { type: "base64", media_type: mediaType, data } };

  let response;
  try {
    response = await client.messages.create({
      model: config.ocrModel,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: [TOOL],
      tool_choice: { type: "tool", name: TOOL.name },
      messages: [
        { role: "user", content: [sourceBlock, { type: "text", text: "Extract the credential details from this document." }] },
      ],
    });
  } catch {
    throw new OcrFailed("The document reader is temporarily unavailable.");
  }

  const block = response.content?.find((item) => item.type === "tool_use");
  if (!block?.input || typeof block.input.is_credential_document !== "boolean") {
    throw new OcrFailed("The document reader couldn't produce a result for this file.");
  }
  const input = block.input;
  return {
    is_credential_document: input.is_credential_document,
    holder_name: input.holder_name ?? null,
    credential_name: input.credential_name ?? null,
    issuer_name: input.issuer_name ?? null,
    credential_number: input.credential_number ?? null,
    issue_date: input.issue_date ?? null,
    expiry_date: input.expiry_date ?? null,
    notes: input.notes ?? null,
  };
}

// ---- comparison (no model involved) ------------------------------------------

const tokens = (text) => new Set((String(text || "").toLowerCase().match(/[a-z0-9]+/g)) || []);
const alnum = (text) => String(text || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

function issuersAgree(typed, read) {
  const typedWords = typed.toLowerCase().match(/[a-z0-9]+/g) || [];
  const readWords = read.toLowerCase().match(/[a-z0-9]+/g) || [];
  const long = (words) => new Set(words.filter((w) => w.length >= 3));
  const readLong = long(readWords);
  if ([...long(typedWords)].some((w) => readLong.has(w))) return true;

  // An acronym on one side and the full name on the other ("EPA" vs
  // "Environmental Protection Agency") is the normal way issuers get typed.
  const typedInitials = typedWords.map((w) => w[0]).join("");
  const readInitials = readWords.map((w) => w[0]).join("");
  return (
    typedWords.some((w) => w.length >= 3 && readInitials.includes(w)) ||
    readWords.some((w) => w.length >= 3 && typedInitials.includes(w))
  );
}

const parseDate = (value) => (/^\d{4}-\d{2}-\d{2}$/.test(value || "") && !Number.isNaN(Date.parse(value)) ? value : null);
const flag = (code, severity, message) => ({ code, severity, message });

/** Flags where the document disagrees with the account or the typed-in fields. */
export function compareExtraction(extracted, credential, holderName, today = todayString()) {
  const flags = [];

  if (!extracted.is_credential_document) {
    return [flag("not_a_credential", "warning", "The uploaded file doesn't look like a credential document.")];
  }

  if (!extracted.holder_name) {
    flags.push(flag("unreadable_name", "info", "The holder's name couldn't be read from the document."));
  } else {
    const docTokens = tokens(extracted.holder_name);
    const accountTokens = tokens(holderName);
    const [shorter, longer] = docTokens.size <= accountTokens.size ? [docTokens, accountTokens] : [accountTokens, docTokens];
    // every word of the shorter name must appear in the longer one, which
    // tolerates a middle name or initial on one side but not a different person
    if (!shorter.size || ![...shorter].every((word) => longer.has(word))) {
      flags.push(flag(
        "holder_name_mismatch", "warning",
        `The document is issued to '${extracted.holder_name}', but this account belongs to '${holderName}'.`
      ));
    }
  }

  if (credential.credential_number && extracted.credential_number) {
    const typed = alnum(credential.credential_number);
    const read = alnum(extracted.credential_number);
    if (typed && read && !read.includes(typed) && !typed.includes(read)) {
      flags.push(flag(
        "number_mismatch", "warning",
        `Entered number '${credential.credential_number}' differs from '${extracted.credential_number}' on the document.`
      ));
    }
  }

  if (credential.issuer_name && extracted.issuer_name && !issuersAgree(credential.issuer_name, extracted.issuer_name)) {
    flags.push(flag(
      "issuer_mismatch", "info",
      `Entered issuer '${credential.issuer_name}' differs from '${extracted.issuer_name}' on the document.`
    ));
  }

  const documentExpiry = parseDate(extracted.expiry_date);
  if (documentExpiry) {
    if (documentExpiry < today) {
      flags.push(flag("document_expired", "warning", `The document itself shows it expired on ${documentExpiry}.`));
    }
    if (credential.expiry_date && credential.expiry_date !== documentExpiry) {
      flags.push(flag(
        "expiry_mismatch", "warning",
        `Entered expiry ${credential.expiry_date} differs from ${documentExpiry} on the document.`
      ));
    }
  }
  return flags;
}
