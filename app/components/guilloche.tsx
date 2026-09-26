// Security-print pattern like on passports and banknotes: interleaved sine ropes.
// Deterministic, so it renders identically on the server and the client.
export function Guilloche({
  className,
  lines = 16,
}: {
  className?: string;
  lines?: number;
}) {
  const w = 600;
  const h = 240;
  const paths = Array.from({ length: lines }, (_, i) => {
    const p = (i / lines) * Math.PI * 2;
    let d = "";
    for (let x = 0; x <= w; x += 5) {
      const y =
        h / 2 +
        72 * Math.sin(x / 46 + p) * Math.cos(x / 170 - p / 2) +
        16 * Math.sin(x / 17 + 2 * p);
      d += `${x ? "L" : "M"}${x} ${y.toFixed(1)}`;
    }
    return d;
  });

  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      fill="none"
      stroke="currentColor"
      className={className}
    >
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          strokeWidth={0.8}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}
