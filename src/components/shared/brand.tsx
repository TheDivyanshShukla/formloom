import Link from "next/link";

/** Wordmark: a woven square (warp and weft) and the name. */
/** `compact` keeps only the mark below the sm breakpoint, for crowded app headers on phones. */
export function Logo({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
      <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
        <rect x="1" y="1" width="22" height="22" rx="6.5" className="fill-primary" />
        <path d="M7.5 5.5v13M12 5.5v13M16.5 5.5v13" className="stroke-primary-foreground/35" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M5.5 9.5h13M5.5 14.5h8" className="stroke-highlight" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
      <span className={compact ? "text-[17px] font-semibold tracking-[-0.01em] max-sm:sr-only" : "text-[17px] font-semibold tracking-[-0.01em]"}>formloom</span>
    </Link>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed px-6 py-14 text-center">
      <div className="mb-3 text-muted-foreground [&_svg]:size-7">{icon}</div>
      <h3 className="text-base font-semibold">{title}</h3>
      {children && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
