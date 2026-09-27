// Rubber-stamp mark: outline only (never a filled block, so it can't read as a
// button), double rule, slight tilt and a worn-ink mask. Decorative text;
// the meaning is repeated for screen readers via aria-label.
export function Stamp({
  label = "Verified",
  sub = "Record",
  top = "Proof of Rent",
  size = "md",
  className = "",
}: {
  label?: string;
  sub?: string;
  top?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const sm = size === "sm";
  return (
    <div
      role="img"
      aria-label={`${label} ${sub}`}
      className={`stamp-ink pointer-events-none select-none -rotate-[7deg] rounded-sm border-2 border-current p-[3px] text-primary-ink ${className}`}
    >
      <div
        className={`rounded-[1px] border border-current text-center uppercase leading-none ${sm ? "px-2.5 py-1.5" : "px-3.5 py-2"}`}
      >
        <p
          className={`font-mono font-medium tracking-[0.06em] ${sm ? "text-[0.625rem]" : "text-[0.6875rem]"}`}
        >
          ★ {top} ★
        </p>
        <p
          className={`mt-1 font-mono font-bold tracking-[0.06em] ${sm ? "text-lg" : "text-2xl"}`}
        >
          {label}
        </p>
        <p
          className={`mt-1 border-t border-current pt-1 font-mono font-semibold tracking-[0.06em] ${sm ? "text-[0.625rem]" : "text-xs"}`}
        >
          {sub}
        </p>
      </div>
    </div>
  );
}
