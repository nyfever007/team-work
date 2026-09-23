"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type SubNavItem = { href: string; label: string; exact?: boolean };

export function SubNav({ title, items, right }: { title: string; items: SubNavItem[]; right?: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <nav className="flex items-center gap-1 text-sm" aria-label={`${title} 탭`}>
          {items.map((it) => {
            const base = it.href.split("?")[0];
            const active = it.exact ? pathname === base : pathname === base || pathname.startsWith(`${base}/`);
            return (
              <Link
                key={it.href}
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={cn("rounded-md px-3 py-1.5 transition-colors hover:bg-accent hover:text-accent-foreground", active ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground")}
              >
                {it.label}
              </Link>
            );
          })}
        </nav>
      </div>
      {right}
    </div>
  );
}
