"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export type SubNavItem = { href: string; label: string; exact?: boolean; badge?: number };

export function SubNav({ title, items, right }: { title: string; items: SubNavItem[]; right?: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b">
      <div className="flex min-w-0 flex-wrap items-end gap-x-6 gap-y-1">
        <h1 className="pb-2.5 text-xl font-bold tracking-tight">{title}</h1>
        <nav className="-mb-px flex items-center gap-1 overflow-x-auto text-sm" aria-label={`${title} 탭`}>
          {items.map((it) => {
            const base = it.href.split("?")[0];
            const active = it.exact ? pathname === base : pathname === base || pathname.startsWith(`${base}/`);
            return (
              <Link
                key={it.href}
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={cn("relative flex items-center gap-1.5 whitespace-nowrap px-3 pt-1.5 pb-3 transition-colors", active ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                {it.label}
                {!!it.badge && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white tabular-nums">{it.badge}</span>}
                {active && <motion.span layoutId={`sub-nav-${title}`} className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
              </Link>
            );
          })}
        </nav>
      </div>
      {right && <div className="pb-2">{right}</div>}
    </div>
  );
}
