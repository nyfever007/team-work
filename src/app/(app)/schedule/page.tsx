import type { Metadata } from "next";
import Link from "next/link";
import { and, gte, lte } from "drizzle-orm";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { allMembers } from "@/lib/members/queries";
import { addMonths, daysInMonth, formatKoMonth, isValidMonth, monthGrid, monthOf, todayKey } from "@/lib/dates";
import { db, schema } from "@/lib/db";
import { LEAVE_BADGE_CLASS, LEAVE_LABEL } from "@/lib/leaves/types";
import { Button } from "@/components/ui/button";
import { CalendarGrid } from "./calendar-grid";

export const metadata: Metadata = { title: "달력" };

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const user = await requireUser();
  const { month: monthParam } = await searchParams;
  const today = todayKey();
  const month = isValidMonth(monthParam) ? monthParam : monthOf(today);
  const grid = monthGrid(month);
  const from = grid[0][0];
  const to = grid[grid.length - 1][6];

  const members = allMembers();
  const nameById = new Map(members.map((m) => [m.id, m.name]));
  const leaves = db
    .select()
    .from(schema.leaves)
    .where(and(gte(schema.leaves.date, from), lte(schema.leaves.date, to)))
    .orderBy(schema.leaves.date, schema.leaves.id)
    .all()
    .map((l) => ({ id: l.id, date: l.date, memberId: l.memberId, memberName: nameById.get(l.memberId) ?? "?", type: l.type, note: l.note }));
  const holidays = db
    .select()
    .from(schema.holidays)
    .where(and(gte(schema.holidays.date, from), lte(schema.holidays.date, to)))
    .all();

  const monthDays = new Set(daysInMonth(month));
  const monthLeaves = leaves.filter((l) => monthDays.has(l.date));

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{formatKoMonth(month)}</h2>
          <p className="text-sm text-muted-foreground">
            이달 휴가 {monthLeaves.length}건 · 날짜를 클릭하면 상세를 보고 품의서를 작성할 수 있습니다.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" asChild aria-label="이전 달">
            <Link href={`/schedule?month=${addMonths(month, -1)}`}>
              <ChevronLeftIcon className="size-4" />
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/schedule">이번 달</Link>
          </Button>
          <Button variant="outline" size="icon" asChild aria-label="다음 달">
            <Link href={`/schedule?month=${addMonths(month, 1)}`}>
              <ChevronRightIcon className="size-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {(Object.keys(LEAVE_LABEL) as (keyof typeof LEAVE_LABEL)[]).map((t) => (
          <span key={t} className={`rounded px-1.5 py-0.5 font-medium ${LEAVE_BADGE_CLASS[t]}`}>
            {LEAVE_LABEL[t]}
          </span>
        ))}
        <span className="rounded bg-red-100 px-1.5 py-0.5 font-medium text-red-800">공휴일·휴무일</span>
      </div>

      <CalendarGrid
        month={month}
        today={today}
        grid={grid}
        leaves={leaves}
        holidays={holidays}
        members={members.map((m) => ({ id: m.id, name: m.name, team: m.team }))}
        me={{ memberId: user.memberId, isAdmin: user.role === "admin" }}
      />
    </div>
  );
}
