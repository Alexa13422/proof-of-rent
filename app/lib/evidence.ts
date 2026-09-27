// Evidence = a statement + photos stored off-chain; the lease keeps the
// sha256 of the manifest JSON. Browser-side helpers.
import { getAccessToken } from "@privy-io/react-auth";
import { ApiError } from "./auth/use-account";

export type EvidenceManifest = {
  v: 1;
  kind: "checkin" | "proposal" | "dispute" | "statement";
  author: string;
  text: string;
  /** File names `<sha256>.<ext>` under /api/evidence/. */
  photos: string[];
  createdAt: string;
  /** Earlier statement by the same side, so updates keep the history. */
  prev?: string;
};

const ZERO = "0".repeat(64);

export function toHex(bytes: ArrayLike<number>): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Hex of an on-chain hash, or null if it was never set (all zeros). */
export function hashOrNull(bytes: ArrayLike<number>): string | null {
  const hex = toHex(bytes);
  return hex === ZERO ? null : hex;
}

export const evidenceUrl = (name: string) => `/api/evidence/${name}`;

export async function fetchManifest(hash: string): Promise<EvidenceManifest | null> {
  const res = await fetch(evidenceUrl(`${hash}.json`));
  return res.ok ? ((await res.json()) as EvidenceManifest) : null;
}

/** Uploads a statement + photos; returns the hex hash to put on-chain. */
export async function uploadEvidence(input: {
  kind: EvidenceManifest["kind"];
  text: string;
  photos: File[];
  prev?: string | null;
}): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new ApiError("Please log in first.");
  const form = new FormData();
  form.set("kind", input.kind);
  form.set("text", input.text);
  if (input.prev) form.set("prev", input.prev);
  for (const photo of input.photos) form.append("photos", photo);
  const res = await fetch("/api/evidence", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(json.error ?? "Upload failed");
  return json.hash as string;
}
