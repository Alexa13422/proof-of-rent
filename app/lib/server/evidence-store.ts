import "server-only";

// Content-addressed evidence storage: every file is saved under its sha256,
// so the hash stored on-chain proves a photo or statement was not swapped.
//
// ponytail: local disk (EVIDENCE_DIR, default .data/evidence). Fine for one
// dev/demo server; on Vercel or several instances move to Vercel Blob / S3
// (same names), and for privacy encrypt on the client before upload.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DIR = path.resolve(process.env.EVIDENCE_DIR ?? ".data/evidence");

export const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const CONTENT_TYPE: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  json: "application/json",
};

/** `<64 hex>.<ext>`: the only names we ever read, so no path traversal. */
export const NAME_RE = /^[0-9a-f]{64}\.(jpg|png|webp|json)$/;

export function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function put(bytes: Uint8Array, ext: string): Promise<string> {
  const name = `${sha256(bytes)}.${ext}`;
  await mkdir(DIR, { recursive: true });
  await writeFile(path.join(DIR, name), bytes);
  return name;
}

export async function get(name: string) {
  if (!NAME_RE.test(name)) return null;
  try {
    const bytes = await readFile(path.join(DIR, name));
    return { bytes, contentType: CONTENT_TYPE[name.split(".")[1]] };
  } catch {
    return null;
  }
}
