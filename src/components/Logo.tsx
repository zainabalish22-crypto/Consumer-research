/** The platform's mark: a rounded tile with four bars (data, in either language). */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" aria-hidden="true" className={className}>
      <rect width="44" height="44" rx="12" fill="var(--color-accent)" />
      <path d="M12 30V20M19 30V14M26 30V23M33 30V17" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}
