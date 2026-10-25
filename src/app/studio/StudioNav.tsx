"use client";
/**
 * Studio side menu. On wide screens it sits on the side; on narrow screens it
 * folds into a top bar with a menu button, so links never wrap into a column.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "@/components/Logo";
import { cx } from "@/components/ui";

type Item = { href: string; label: string; icon: React.ReactNode; exact?: boolean };

const icon = (d: React.ReactNode) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);

export const NAV_ICONS = {
  dashboard: icon(<path d="M4 4h7v7H4zM13 4h7v4h-7zM13 11h7v9h-7zM4 14h7v6H4z" />),
  library: icon(<path d="M4 19V5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2zM8 7h6" />),
  templates: icon(
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>,
  ),
  assistant: icon(
    <>
      <path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4z" />
      <path d="M18 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
    </>,
  ),
  media: icon(
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 15l5-5 4 4 3-3 6 6" />
    </>,
  ),
  settings: icon(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z" />
    </>,
  ),
};

export function StudioNav({
  platformName,
  label,
  menuLabel,
  items,
  workspace,
  footer,
}: {
  platformName: string;
  label: string;
  menuLabel: string;
  items: { href: string; label: string; icon: keyof typeof NAV_ICONS; exact?: boolean }[];
  workspace: React.ReactNode;
  footer: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  const links: Item[] = items.map((i) => ({ ...i, icon: NAV_ICONS[i.icon] }));
  const active = (i: Item) => (i.exact ? pathname === i.href : pathname === i.href || pathname.startsWith(`${i.href}/`));

  return (
    <aside className="z-30 border-b border-line bg-surface lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-60 lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-e">
      <div className="flex items-center gap-2.5 px-4 py-3 lg:px-5 lg:pt-5">
        <Link href="/studio" className="flex items-center gap-2.5 font-bold">
          <LogoMark size={30} />
          <span>{platformName}</span>
        </Link>
        <span className="flex-1" />
        <button
          type="button"
          className="rounded-lg border border-line px-3 py-1.5 text-sm lg:hidden"
          aria-expanded={open}
          aria-controls="studio-menu"
          onClick={() => setOpen((o) => !o)}
        >
          {menuLabel}
        </button>
      </div>
      <div id="studio-menu" className={cx("flex-col gap-5 px-3 pb-4 lg:flex lg:flex-1 lg:overflow-y-auto", open ? "flex" : "hidden")}>
        <div className="px-2">{workspace}</div>
        <nav aria-label={label} className="flex flex-col gap-0.5">
          {links.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              aria-current={active(i) ? "page" : undefined}
              className={cx(
                "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[15px]",
                active(i) ? "bg-accent-soft font-semibold text-accent-strong" : "text-ink/85 hover:bg-paper",
              )}
            >
              {i.icon}
              {i.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-2 border-t border-line px-2 pt-4 text-sm">{footer}</div>
      </div>
    </aside>
  );
}
