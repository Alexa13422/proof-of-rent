import { NextResponse } from "next/server";
import { get } from "@/app/lib/server/evidence-store";

// Public read: anyone can review a dispute. Content never changes for a
// given name (it is its own hash), so it caches forever.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const file = await get((await params).name);
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
