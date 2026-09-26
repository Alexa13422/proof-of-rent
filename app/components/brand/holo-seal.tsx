import { useId } from "react";

export type HoloPalette = "signal" | "spectrum" | "silver";

const FOIL: Record<HoloPalette, string> = {
  signal:
    "linear-gradient(115deg,#ffd9c9,#ff4a1c,#ffc98f,#ffe9b8,#ff9ab8,#c3b2ff,#9fe0ff,#ffd9c9,#ff4a1c)",
  spectrum:
    "linear-gradient(115deg,#ff8a8a,#ffd08a,#f4f48a,#8affb8,#8adfff,#a99aff,#ff9ae0,#ff8a8a)",
  silver:
    "linear-gradient(115deg,#e4e4de,#f8f6f0,#cfd8e0,#ece4dc,#d3dcd3,#e4e4de)",
};

const CIRCLES = Array.from({ length: 36 }, (_, index) => index * 10);
const ELLIPSES = Array.from({ length: 24 }, (_, index) => index * 7.5);

type HoloSealProps = {
  size?: number;
  hash?: string;
  label?: string;
  palette?: HoloPalette;
  intensity?: number;
  motion?: boolean;
  embedded?: boolean;
  className?: string;
};

export function HoloSeal({
  size = 216,
  hash = "7xKp…2mQa",
  label = "VERIFIED RECORD",
  palette = "signal",
  intensity = 0.45,
  motion = true,
  embedded = true,
  className = "",
}: HoloSealProps) {
  const ringId = `${useId().replace(/:/g, "")}-ring`;
  const classes = [
    "por-seal",
    motion && "por-seal--live",
    embedded && "por-seal--embedded",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classes}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <div
        className="por-seal__foil"
        style={{ backgroundImage: FOIL[palette], opacity: intensity }}
      />

      <svg className="por-seal__svg" viewBox="0 0 320 320">
        <g className="por-seal__rosette" stroke="var(--muted)" opacity={0.55}>
          {CIRCLES.map((angle) => (
            <circle
              key={`c${angle}`}
              cx={198}
              cy={160}
              r={64}
              transform={`rotate(${angle} 160 160)`}
            />
          ))}
          {ELLIPSES.map((angle) => (
            <ellipse
              key={`e${angle}`}
              cx={160}
              cy={160}
              rx={114}
              ry={30}
              transform={`rotate(${angle} 160 160)`}
            />
          ))}
        </g>

        <g stroke="var(--muted)" opacity={0.8}>
          <circle className="por-seal__ring" cx={160} cy={160} r={156} />
          <circle className="por-seal__ring" cx={160} cy={160} r={131} />
          <circle className="por-seal__dash" cx={160} cy={160} r={126.5} />
        </g>

        <path
          id={ringId}
          d="M 18 160 A 142 142 0 1 1 302 160 A 142 142 0 1 1 18 160"
          fill="none"
        />
        <text className="por-seal__ring-text">
          <textPath href={`#${ringId}`} textLength={880} lengthAdjust="spacing">
            PROOF OF RENT · VERIFIED RECORD · TENANT PASSPORT · PROOF OF RENT ·
            VERIFIED RECORD · TENANT PASSPORT ·
          </textPath>
        </text>

        <circle
          cx={160}
          cy={160}
          r={40}
          fill="var(--card)"
          fillOpacity={0.55}
          stroke="var(--muted)"
          strokeWidth={0.8}
        />
        <g
          className="por-seal__glyph"
          transform="translate(136 136) scale(2)"
          stroke="var(--foreground)"
          strokeWidth={1.5}
        >
          <path d="M13 21H6.5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1H14l4.5 4.5V12" />
          <path d="M14 3v4.5h4.5" />
          <path d="M8.5 11.5h6" />
          <path d="M8.5 15h3" />
          <circle cx={17.5} cy={17.5} r={3.75} stroke="var(--primary-ink)" />
          <path
            d="M15.9 17.6l1.1 1.1 2.1-2.3"
            stroke="var(--primary-ink)"
          />
        </g>

        <text className="por-seal__hash" x={160} y={110}>
          {hash}
        </text>
        <text className="por-seal__label" x={160} y={222}>
          {label}
        </text>
      </svg>
    </div>
  );
}
