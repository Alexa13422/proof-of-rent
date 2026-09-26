type LogoProps = {
  size?: number;
  mark?: boolean;
  tone?: "brand" | "mono";
  className?: string;
};

const TILE = {
  brand: "var(--primary)",
  mono: "#111111",
} as const;

const INK = {
  brand: "var(--primary-foreground)",
  mono: "#FFFFFF",
} as const;

export function Glyph({
  size = 24,
  simplified = false,
  strokeWidth = 1.8,
  color = "currentColor",
}: {
  size?: number;
  simplified?: boolean;
  strokeWidth?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M13 21H6.5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1H14l4.5 4.5V12" />
      {!simplified && <path d="M14 3v4.5h4.5" />}
      {!simplified && <path d="M8.5 11.5h6" />}
      {!simplified && <path d="M8.5 15h3" />}
      <circle cx="17.5" cy="17.5" r="3.75" />
      {!simplified && <path d="M15.9 17.6l1.1 1.1 2.1-2.3" />}
    </svg>
  );
}

export function Logo({
  size = 32,
  mark = false,
  tone = "brand",
  className,
}: LogoProps) {
  const glyphSize = Math.round(size * 0.68);
  const strokeWidth =
    size >= 64 ? 1.8 : size >= 40 ? 2 : size >= 24 ? 2.4 : 2.8;

  return (
    <span
      className={className ?? "inline-flex"}
      style={{
        alignItems: "center",
        gap: size * 0.3,
      }}
    >
      <span
        role={mark ? "img" : undefined}
        aria-label={mark ? "Proof of Rent" : undefined}
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.2,
          background: TILE[tone],
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Glyph
          size={glyphSize}
          simplified={size < 32}
          strokeWidth={strokeWidth}
          color={INK[tone]}
        />
      </span>
      {!mark && (
        <span
          style={{
            fontFamily: "var(--font-plex-sans), system-ui, sans-serif",
            fontWeight: 600,
            fontSize: size * 0.5,
            lineHeight: 1,
            color: "currentColor",
          }}
        >
          Proof of Rent
        </span>
      )}
    </span>
  );
}
