// Security-print seal like on agency IDs: a guilloche rosette inside tick and
// text rings, with fine lines bursting outward. Deterministic for SSR.
const SIZE = 1000;
const C = SIZE / 2;

function polar(r: number, a: number) {
  return `${(C + r * Math.cos(a)).toFixed(1)} ${(C + r * Math.sin(a)).toFixed(1)}`;
}

// Closed wavy ring: r(θ) = base + amp·sin(petals·θ + phase).
function rosettePath(base: number, amp: number, petals: number, phase: number) {
  let d = "";
  const steps = 720;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const r = base + amp * Math.sin(petals * a + phase);
    d += `${i ? "L" : "M"}${polar(r, a)}`;
  }
  return d + "Z";
}

export function SealRosette({ className }: { className?: string }) {
  // Burst: 144 rays, every 4th one longer.
  const rays = Array.from({ length: 144 }, (_, i) => {
    const a = (i / 144) * Math.PI * 2;
    const long = i % 4 === 0;
    return `M${polar(232, a)}L${polar(long ? 500 : 380, a)}`;
  });

  // Tick ring like a dial.
  const ticks = Array.from({ length: 120 }, (_, i) => {
    const a = (i / 120) * Math.PI * 2;
    return `M${polar(206, a)}L${polar(i % 5 === 0 ? 222 : 214, a)}`;
  });

  // Inner guilloche: two families of phase-shifted waves.
  const rosette = [
    ...Array.from({ length: 10 }, (_, i) =>
      rosettePath(150, 22, 18, (i / 10) * Math.PI * 2),
    ),
    ...Array.from({ length: 8 }, (_, i) =>
      rosettePath(92, 18, 12, (i / 8) * Math.PI * 2),
    ),
  ];

  const text =
    "PROOF OF RENT · TENANT RECORD · VERIFIED ON-CHAIN · PROOF OF RENT · TENANT RECORD · VERIFIED ON-CHAIN · ";

  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      fill="none"
      stroke="currentColor"
      className={className}
    >
      <defs>
        <path
          id="seal-text-ring"
          d={`M${C - 186} ${C}a186 186 0 1 1 372 0a186 186 0 1 1 -372 0`}
        />
      </defs>

      <g strokeWidth={0.7}>
        {rays.map((d, i) => (
          <path key={`r${i}`} d={d} />
        ))}
      </g>

      <circle cx={C} cy={C} r={232} strokeWidth={1.2} />
      <circle cx={C} cy={C} r={226} strokeWidth={0.6} />
      <g strokeWidth={0.8}>
        {ticks.map((d, i) => (
          <path key={`t${i}`} d={d} />
        ))}
      </g>
      <circle cx={C} cy={C} r={202} strokeWidth={0.6} />

      <text
        fill="currentColor"
        stroke="none"
        fontFamily="var(--font-plex-mono), monospace"
        fontSize={13}
        letterSpacing={2.4}
      >
        <textPath href="#seal-text-ring" textLength={1150}>
          {text}
        </textPath>
      </text>

      <circle cx={C} cy={C} r={174} strokeWidth={0.6} />
      <g strokeWidth={0.6}>
        {rosette.map((d, i) => (
          <path key={`g${i}`} d={d} />
        ))}
      </g>
      <circle cx={C} cy={C} r={58} strokeWidth={1} />
      <circle cx={C} cy={C} r={52} strokeWidth={0.6} strokeDasharray="2 4" />
      <path
        d={`M${C - 30} ${C}H${C + 30}M${C} ${C - 30}V${C + 30}`}
        strokeWidth={0.8}
      />
    </svg>
  );
}
