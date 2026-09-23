"use client";

import { useState } from "react";
import { WEEKDAY_KO, dayOfWeek, monthOf } from "@/lib/dates";
import type { LeaveType } from "@/lib/leaves/types";
import { LEAVE_BADGE_CLASS, LEAVE_LABEL, LEAVE_SHORT } from "@/lib/leaves/types";
import { cn } from "@/lib/utils";
import { DayDialog } from "./day-dialog";

export type CalendarLeave = { id: number; date: string; memberId: number; memberName: string; type: LeaveType; note: string };
export type CalendarHoliday = { id: number; date: string; name: string };
export type CalendarMember = { id: number; name: string; team: string };
export type Me = { memberId: number | null; isAdmin: boolean };

type Props = {
  month: string;
  today: string;
  grid: string[][];
  leaves: CalendarLeave[];
  holidays: CalendarHoliday[];
  members: CalendarMember[];
  me: Me;
};


export function CalendarGrid({ month, today, grid, leaves, holidays, members, me }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const leavesByDate = new Map<string, CalendarLeave[]>();
  for (const l of leaves) leavesByDate.set(l.date, [...(leavesByDate.get(l.date) ?? []), l]);
  const holidayByDate = new Map(holidays.map((h) => [h.date, h]));

  return (
    <>
      <div className="overflow-hidden rounded-lg border bg-background">
        <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-xs font-medium text-muted-foreground">
          {WEEKDAY_KO.map((d, i) => (
            <div key={d} className={cn("py-2", i === 0 && "text-red-600", i === 6 && "text-blue-600")}>
              {d}
            </div>
          ))}
        </div>
        {grid.map((row, ri) => (
          <div key={ri} className="grid grid-cols-7 border-b last:border-b-0">
            {row.map((date) => {
              const inMonth = monthOf(date) === month;
              const dow = dayOfWeek(date);
              const holiday = holidayByDate.get(date);
              const dayLeaves = leavesByDate.get(date) ?? [];
              const isToday = date === today;
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => setSelected(date)}
                  aria-label={`${date}${holiday ? ` ${holiday.name}` : ""}`}
                  className={cn(
                    "flex min-h-24 flex-col items-stretch gap-1 border-r p-1.5 text-left transition-colors last:border-r-0 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    !inMonth && "bg-muted/20 text-muted-foreground",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "inline-flex size-6 items-center justify-center rounded-full text-sm",
                        (dow === 0 || holiday) && "text-red-600",
                        dow === 6 && !holiday && "text-blue-600",
                        isToday && "bg-primary font-semibold text-primary-foreground",
                      )}
                    >
                      {Number(date.slice(8))}
                    </span>
                    {holiday && <span className="truncate text-[11px] text-red-600">{holiday.name}</span>}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {dayLeaves.slice(0, 3).map((l) => (
                      <span key={l.id} className={cn("truncate rounded px-1 py-0.5 text-[11px] font-medium", LEAVE_BADGE_CLASS[l.type])}>
                        {l.memberName} {LEAVE_SHORT[l.type]}
                      </span>
                    ))}
                    {dayLeaves.length > 3 && <span className="text-[11px] text-muted-foreground">+{dayLeaves.length - 3}명</span>}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <DayDialog
        date={selected}
        onClose={() => setSelected(null)}
        leaves={selected ? leavesByDate.get(selected) ?? [] : []}
        holiday={selected ? holidayByDate.get(selected) ?? null : null}
        members={members}
        me={me}
        leaveLabel={LEAVE_LABEL}
      />
    </>
  );
}
