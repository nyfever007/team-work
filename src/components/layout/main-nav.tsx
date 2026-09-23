"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function MainNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = [
    { href: "/my/today", base: "/my", label: "내 업무" },
    { href: "/team", base: "/team", label: "팀" },
    { href: "/schedule", base: "/schedule", label: "일정" },
    ...(isAdmin ? [{ href: "/admin/members", base: "/admin", label: "관리" }] : []),
  ];
  return (
    <nav className="flex items-center gap-1 text-sm">
      {items.map((item) => {
        const active = pathname === item.base || pathname.startsWith(`${item.base}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn("rounded-md px-3 py-1.5 transition-colors hover:bg-accent hover:text-accent-foreground", active ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground")}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
