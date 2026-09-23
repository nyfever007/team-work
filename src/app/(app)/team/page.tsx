import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/dal";
import { isValidKey, todayKey, weekStartOf } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { DayView } from "./day-view";
import { WeekView } from "./week-view";

export const metadata: Metadata = { title: "팀 현황" };

export default async function TeamPage({ searchParams }: PageProps<"/team">) {
  const user = await requireUser();
  const sp = await searchParams;
  const view = sp.view === "week" ? "week" : "day";
  const today = todayKey();
  const date = isValidKey(sp.date) ? sp.date : today;
  const week = isValidKey(sp.week) ? weekStartOf(sp.week) : weekStartOf(today);

  const toggle = (
    <div className="flex rounded-md border p-0.5 text-sm">
      <Button variant={view === "day" ? "secondary" : "ghost"} size="sm" className="h-7" asChild>
        <Link href="/team">하루</Link>
      </Button>
      <Button variant={view === "week" ? "secondary" : "ghost"} size="sm" className="h-7" asChild>
        <Link href="/team?view=week">한 주</Link>
      </Button>
    </div>
  );

  return view === "day" ? <DayView user={user} date={date} today={today} toggle={toggle} /> : <WeekView user={user} weekStart={week} today={today} toggle={toggle} />;
}
