import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import { config } from "../config.js";

export const MAX_FILE_BYTES = 1024 * 1024;

/** Parse multipart bodies into memory; `store` below decides what is kept on disk. */
export const multipart = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_BYTES, files: 5 } });

/** `Cert (final).PDF` -> `Cert-final.pdf`: no path characters, bounded length. */
function safeName(original) {
  const ext = path.extname(original || "").toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 8);
  const base = path
    .basename(original || "file", path.extname(original || ""))
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "file"}${ext}`;
}

export const uploadRoot = () => path.resolve(config.uploadDir);

/** Write an uploaded buffer under `folder/` and return the relative path to store in the database. */
export async function storeUpload(folder, file) {
  if (config.imagekit.privateKey && config.imagekit.urlEndpoint) {
    const body = new FormData();
    body.append("file", file.buffer.toString("base64"));
    body.append("fileName", safeName(file.originalname));
    body.append("folder", `/thermatrust/${folder}`);
    body.append("useUniqueFileName", "true");
    const response = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.imagekit.privateKey}:`).toString("base64")}`,
      },
      body,
    });
    if (!response.ok) {
      throw new Error(`ImageKit upload failed with status ${response.status}.`);
    }
    const uploaded = await response.json();
    if (!uploaded.url) throw new Error("ImageKit returned no file URL.");
    return uploaded.url;
  }

  const relative = `${folder}/${crypto.randomUUID()}-${safeName(file.originalname)}`;
  const target = path.join(uploadRoot(), relative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, file.buffer);
  return relative;
}

/** Read a stored file back (null when it is gone, e.g. an ephemeral disk was reset). */
export async function readUpload(relative) {
  if (String(relative).startsWith("https://")) {
    try {
      const response = await fetch(relative);
      return response.ok ? Buffer.from(await response.arrayBuffer()) : null;
    } catch {
      return null;
    }
  }
  try {
    const target = path.resolve(uploadRoot(), relative);
    if (!target.startsWith(uploadRoot() + path.sep)) return null;
    return await fs.readFile(target);
  } catch {
    return null;
  }
}
