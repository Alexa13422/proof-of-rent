export function parseFeePayerSecretKey(raw: string): Uint8Array {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("FEE_PAYER_SECRET_KEY is not valid JSON");
  }

  if (!Array.isArray(parsed) || parsed.length !== 64) {
    throw new Error(
      "FEE_PAYER_SECRET_KEY must be a JSON array of exactly 64 integers"
    );
  }

  const bytes = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    const n = parsed[i];
    if (!Number.isInteger(n) || n < 0 || n > 255) {
      throw new Error(
        `FEE_PAYER_SECRET_KEY[${i}] must be an integer in [0, 255]`
      );
    }
    bytes[i] = n;
  }
  return bytes;
}
