"use client";

/** Participant card and main button (light theme, researcher accent). */
export function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-[22px] bg-white p-6 shadow-[0_1px_2px_rgba(22,24,27,0.06)] sm:p-8">{children}</div>;
}

export function PrimaryButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="h-[52px] w-full rounded-[14px] px-6 text-base font-semibold text-white disabled:opacity-40 sm:w-auto" style={{ background: "var(--accent)" }}>
      {children}
    </button>
  );
}

