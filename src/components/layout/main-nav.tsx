"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { CalendarDaysIcon, FileSignatureIcon, ListTodoIcon, SettingsIcon, UsersIcon, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Item = { href: string; base: string; label: string; icon: LucideIcon };

/** `badges` maps an area base path ("/my", "/team") to a count shown as a dot on that tab. */
export function MainNav({ isAdmin, badges = {} }: { isAdmin: boolean; badges?: Record<string, number> }) {
  const pathname = usePathname();
  const items: Item[] = [
    { href: "/my/today", base: "/my", label: "내 업무", icon: ListTodoIcon },
    { href: "/team", base: "/team", label: "팀", icon: UsersIcon },
    { href: "/schedule", base: "/schedule", label: "일정", icon: CalendarDaysIcon },
    { href: "/forms", base: "/forms", label: "품의", icon: FileSignatureIcon },
    ...(isAdmin ? [{ href: "/admin/members", base: "/admin", label: "관리", icon: SettingsIcon }] : []),
  ];
  return (
    <nav className="flex items-center gap-0.5 text-sm" aria-label="주 메뉴">
      {items.map((item) => {
        const active = pathname === item.base || pathname.startsWith(`${item.base}/`);
        const count = badges[item.base] ?? 0;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn("relative flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors", active ? "text-accent-foreground font-medium" : "text-muted-foreground hover:text-foreground")}
          >
            {active && <motion.span layoutId="main-nav-pill" className="absolute inset-0 rounded-full bg-accent" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
            <Icon className="relative size-4" />
            <span className="relative hidden sm:inline">{item.label}</span>
            {count > 0 && (
              <span className="relative -mr-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white tabular-nums" aria-label={`새 항목 ${count}개`}>
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
