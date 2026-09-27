// Upload a statement with photos. Returns the sha256 of the manifest JSON;
// that hash goes on-chain (create_offer, propose_settlement, open_dispute,
// submit_evidence) and is what the manifest is served under.
import { NextRequest, NextResponse } from "next/server";
import { AuthError, resolveUserWallet } from "@/app/lib/server/privy";
import { IMAGE_TYPES, put } from "@/app/lib/server/evidence-store";
import type { EvidenceManifest } from "@/app/lib/evidence";

const MAX_PHOTOS = 10;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const MAX_TEXT = 4000;

export async function POST(request: NextRequest) {
  try {
    const wallet = await resolveUserWallet(request.headers.get("authorization"));
    const form = await request.formData();

    const text = String(form.get("text") ?? "").trim().slice(0, MAX_TEXT);
    const kind = String(form.get("kind") ?? "");
    if (!["checkin", "proposal", "dispute", "statement"].includes(kind)) {
      return NextResponse.json({ error: "Unknown evidence type" }, { status: 400 });
    }
    const prev = String(form.get("prev") ?? "");
    const files = form.getAll("photos").filter((f): f is File => f instanceof File);
    if (files.length > MAX_PHOTOS) {
      return NextResponse.json({ error: `Up to ${MAX_PHOTOS} photos` }, { status: 400 });
    }
    if (!text && files.length === 0) {
      return NextResponse.json({ error: "Add a description or photos" }, { status: 400 });
    }

    const photos: string[] = [];
    for (const file of files) {
      const ext = IMAGE_TYPES[file.type];
      if (!ext) {
        return NextResponse.json({ error: "Photos must be JPEG, PNG or WebP" }, { status: 400 });
      }
      if (file.size > MAX_PHOTO_BYTES) {
        return NextResponse.json({ error: "Each photo must be under 8 MB" }, { status: 400 });
      }
      photos.push(await put(new Uint8Array(await file.arrayBuffer()), ext));
    }

    const manifest: EvidenceManifest = {
      v: 1,
      kind: kind as EvidenceManifest["kind"],
      author: wallet.address,
      text,
      photos,
      createdAt: new Date().toISOString(),
      ...(/^[0-9a-f]{64}$/.test(prev) ? { prev } : {}),
    };
    const name = await put(new TextEncoder().encode(JSON.stringify(manifest)), "json");
    return NextResponse.json({ hash: name.slice(0, 64) });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("evidence upload failed", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
