"use client";

import { useEffect, useMemo } from "react";
import useSWR from "swr";
import { evidenceUrl, fetchManifest, type EvidenceManifest } from "../lib/evidence";
import { formatDateTime } from "../lib/chain";
import { inputClass } from "./site-header";

const MAX_PHOTOS = 10;

/** Text + photo picker (camera on phones). Controlled by the parent. */
export function EvidenceInput({
  text,
  photos,
  onText,
  onPhotos,
  placeholder,
  required,
}: {
  text: string;
  photos: File[];
  onText: (v: string) => void;
  onPhotos: (files: File[]) => void;
  placeholder: string;
  required?: boolean;
}) {
  const previews = useMemo(() => photos.map((f) => URL.createObjectURL(f)), [photos]);
  useEffect(() => () => previews.forEach(URL.revokeObjectURL), [previews]);

  return (
    <div className="space-y-3">
      <textarea
        className={`${inputClass} min-h-24 py-2 leading-6`}
        value={text}
        maxLength={4000}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onText(e.target.value)}
      />
      <div className="flex flex-wrap items-center gap-3">
        {previews.map((src, i) => (
          <div key={src} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="size-20 rounded-md border border-border object-cover" />
            <button
              type="button"
              aria-label="Remove photo"
              onClick={() => onPhotos(photos.filter((_, j) => j !== i))}
              className="absolute -right-2 -top-2 size-6 cursor-pointer rounded-full border border-border bg-card text-xs"
            >
              ×
            </button>
          </div>
        ))}
        {photos.length < MAX_PHOTOS && (
          <label className="flex size-20 cursor-pointer items-center justify-center rounded-md border border-dashed border-input text-center text-xs text-muted hover:border-foreground">
            + Photo
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              multiple
              className="sr-only"
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? []);
                onPhotos([...photos, ...picked].slice(0, MAX_PHOTOS));
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>
    </div>
  );
}

/** Renders a statement by its on-chain hash, following `prev` for history. */
export function EvidenceView({ hash, title }: { hash: string | null; title: string }) {
  const { data, error, isLoading } = useSWR(hash ? ["evidence", hash] : null, async () => {
    const chain: EvidenceManifest[] = [];
    let next: string | undefined = hash!;
    while (next && chain.length < 10) {
      const m = await fetchManifest(next);
      if (!m) break;
      chain.push(m);
      next = m.prev;
    }
    return chain;
  });

  return (
    <section className="rounded-lg border border-border bg-card p-5 sm:p-7">
      <h3 className="font-medium">{title}</h3>
      {!hash ? (
        <p className="mt-2 text-sm text-muted">Nothing submitted.</p>
      ) : isLoading ? (
        <p className="mt-2 text-sm text-muted">Loading…</p>
      ) : error || !data?.length ? (
        <p className="mt-2 text-sm text-destructive">
          Files for this record are unavailable.
        </p>
      ) : (
        <div className="mt-3 space-y-5">
          {data.map((m, i) => (
            <div key={m.createdAt + i} className={i ? "border-t border-border pt-4 opacity-75" : ""}>
              <p className="text-xs text-muted">
                {i ? "Earlier statement · " : ""}
                {formatDateTime(BigInt(Math.floor(Date.parse(m.createdAt) / 1000)))}
              </p>
              {m.text && <p className="mt-2 whitespace-pre-wrap leading-7">{m.text}</p>}
              {m.photos.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {m.photos.map((name) => (
                    <a key={name} href={evidenceUrl(name)} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={evidenceUrl(name)}
                        alt="Evidence photo"
                        className="size-24 rounded-md border border-border object-cover hover:opacity-90"
                      />
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
          <p className="break-all font-mono text-xs text-muted">sha256 on-chain: {hash}</p>
        </div>
      )}
    </section>
  );
}
