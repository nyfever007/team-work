import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRightIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { formatKoDate, todayKey } from "@/lib/dates";
import { teamScope } from "@/lib/teams/scope";
import { MS_TASK_CLASS, MS_TASK_LABEL } from "@/lib/milestones/task-types";
import { OVERDUE_BADGE } from "@/lib/milestones/types";
import { formatHours } from "@/lib/overtime/types";
import { PULSE_MIN_RESPONSES } from "@/lib/pulse/types";
import {
  LEAVE_WINDOW_DAYS,
  OPEN_TASK_STATUSES,
  OVERTIME_WINDOW_DAYS,
  workloadFor,
  type MemberWorkload,
  type OpenTaskStatus,
  type PulseWeek,
  type WorkloadFlagKind,
} from "@/lib/team/workload";
import { TeamSwitcher } from "@/components/team-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LeaderBadge } from "@/components/leader-badge";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "업무량" };

const SEGMENT: Record<OpenTaskStatus, string> = {
  todo: "bg-slate-300",
  in_progress: "bg-amber-400",
  review: "bg-brand",
};

const FLAG: Record<WorkloadFlagKind, { label: string; className: string }> = {
  overload: { label: "과부하", className: "bg-red-100 text-red-800" },
  overdue: { label: "지연", className: "bg-amber-100 text-amber-900" },
  idle: { label: "여유", className: "bg-slate-100 text-slate-700" },
  leave: { label: "휴가 예정", className: "bg-blue-100 text-blue-800" },
};

const shortDate = (key: string) => `${Number(key.slice(5, 7))}/${Number(key.slice(8, 10))}`;
const hours = (h: number) => (h > 0 ? formatHours(h) : "0");

export default async function WorkloadPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const scope = teamScope(user, sp.team);
  if (scope.teamId == null || !scope.canLead(scope.teamId)) redirect("/team");

  const team = scope.teams.find((t) => t.id === scope.teamId);
  const data = workloadFor(scope.teamId, todayKey());
  const { summary } = data;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">업무량</h2>
          <p className="text-sm text-muted-foreground">
            {team?.name} · 구성원 {data.members.length}명 · 기준일 {formatKoDate(data.today)}
          </p>
        </div>
        {scope.isAdmin && <TeamSwitcher teams={scope.teams} value={scope.teamId} />}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="진행 작업" value={`${summary.open}건`} hint={`팀 중앙값 ${data.median}건`} />
        <Stat label="기한 지남" value={`${summary.overdue}건`} tone={summary.overdue ? "warn" : undefined} />
        <Stat label="과부하" value={`${summary.overloaded}명`} hint={`작업 ${data.overloadThreshold}건 이상 또는 시간외 12시간 이상`} tone={summary.overloaded ? "warn" : undefined} />
        <Stat
          label={`시간외 (${OVERTIME_WINDOW_DAYS}일)`}
          value={hours(summary.overtime)}
          hint={summary.pendingOvertime ? `승인 대기 ${formatHours(summary.pendingOvertime)}` : "승인 기준"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle>구성원별</CardTitle>
            <Legend />
          </CardHeader>
          <CardContent className="grid gap-2">
            {data.members.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">구성원이 없습니다.</p>
            ) : (
              data.members.map((w) => <MemberRow key={w.member.id} w={w} maxOpen={data.maxOpen} />)
            )}
          </CardContent>
        </Card>

        <PulseCard weeks={data.pulse} />
      </div>
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "warn" }) {
  return (
    <div className={cn("rounded-xl border bg-card px-4 py-3 shadow-xs", tone === "warn" && "border-amber-200 bg-amber-50/60")}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      {OPEN_TASK_STATUSES.map((s) => (
        <span key={s} className="inline-flex items-center gap-1">
          <span className={cn("size-2.5 rounded-sm", SEGMENT[s])} />
          {MS_TASK_LABEL[s]}
        </span>
      ))}
    </div>
  );
}

function MemberRow({ w, maxOpen }: { w: MemberWorkload; maxOpen: number }) {
  const m = w.member;
  const scale = Math.max(maxOpen, 1);
  const flagged = w.flags.some((f) => f.kind === "overload");
  return (
    <details className={cn("group rounded-lg border bg-card", flagged && "border-red-200")}>
      <summary className="grid cursor-pointer list-none gap-2 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
          <Link href={`/team/members/${m.id}`} className="font-semibold hover:underline">
            {m.name}
          </Link>
          {m.isLeader && <LeaderBadge />}
          <span className="text-xs text-muted-foreground">{m.rank || m.position}</span>
          {w.overdue > 0 && <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", OVERDUE_BADGE)}>지연 {w.overdue}</span>}
          <span className="ml-auto flex flex-wrap gap-1">
            {w.flags.map((f) => (
              <span key={f.kind} title={f.reason} className={cn("cursor-help rounded-full px-2 py-0.5 text-xs font-medium", FLAG[f.kind].className)}>
                {FLAG[f.kind].label}
              </span>
            ))}
          </span>
        </div>

        <div className="flex items-center gap-3 pl-6">
          <div className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-muted" aria-label={`진행 작업 ${w.openTotal}건`}>
            {OPEN_TASK_STATUSES.map((s) =>
              w.open[s] > 0 ? (
                <div key={s} className={SEGMENT[s]} style={{ width: `${(w.open[s] / scale) * 100}%` }} title={`${MS_TASK_LABEL[s]} ${w.open[s]}`} />
              ) : null,
            )}
          </div>
          <span className="w-12 shrink-0 text-right text-sm font-semibold tabular-nums">{w.openTotal}건</span>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 pl-6 text-xs sm:grid-cols-3 xl:grid-cols-6">
          <Metric label="담당 마일스톤" value={`${w.ownedMilestones.length}`} />
          <Metric label="7일 내 마감" value={`${w.dueSoon}`} />
          <Metric label="이번 주 목표" value={`${w.week.done}/${w.week.total}`} />
          <Metric label="지난주 완료율" value={w.lastWeekRate == null ? "–" : `${w.lastWeekRate}%`} />
          <Metric
            label="시간외"
            value={hours(w.overtime.approved)}
            sub={w.overtime.pending ? `대기 ${formatHours(w.overtime.pending)}` : undefined}
          />
          <Metric
            label={`휴가 (${LEAVE_WINDOW_DAYS}일)`}
            value={w.leave.dates.length ? `${w.leave.days}일` : "–"}
            sub={w.leave.dates.length ? w.leave.dates.map((d) => shortDate(d.date)).join(", ") : undefined}
          />
        </dl>
      </summary>

      <div className="grid gap-3 border-t px-3 py-3 pl-9 text-sm">
        {w.ownedMilestones.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">담당</span>
            {w.ownedMilestones.map((ms) => (
              <Link key={ms.id} href={`/team/milestones?m=${ms.id}`} className="rounded-md bg-brand-soft px-2 py-0.5 text-xs text-accent-foreground hover:underline">
                {ms.title} · {shortDate(ms.dueDate)}
              </Link>
            ))}
          </div>
        )}
        {w.tasks.length === 0 ? (
          <p className="text-xs text-muted-foreground">진행 중인 작업이 없습니다.</p>
        ) : (
          <ul className="grid gap-1">
            {w.tasks.map((t) => (
              <li key={t.id}>
                <Link href={`/team/milestones?m=${t.milestoneId}`} className="flex flex-wrap items-center gap-2 rounded-md px-1.5 py-1 hover:bg-muted/60">
                  <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-xs", MS_TASK_CLASS[t.status])}>{MS_TASK_LABEL[t.status]}</span>
                  <span className="min-w-0 flex-1 truncate">{t.title}</span>
                  <span className="max-w-40 truncate text-xs text-muted-foreground">{t.milestoneTitle}</span>
                  <span className={cn("w-12 shrink-0 text-right text-xs tabular-nums", t.overdue ? "font-semibold text-red-700" : "text-muted-foreground")}>
                    {t.dueDate ? shortDate(t.dueDate) : "–"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium tabular-nums" title={sub}>
        {value}
        {sub && <span className="ml-1 font-normal text-muted-foreground">{sub}</span>}
      </dd>
    </div>
  );
}

function PulseCard({ weeks }: { weeks: PulseWeek[] }) {
  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>팀 펄스 (익명)</CardTitle>
        <p className="text-xs text-muted-foreground">최근 6주 평균 (1–5) · 응답 {PULSE_MIN_RESPONSES}명 이상인 주만 표시</p>
      </CardHeader>
      <CardContent className="grid gap-4">
        <PulseSeries title="업무 부담" weeks={weeks} pick={(w) => w.workload} barClass="bg-amber-400" />
        <PulseSeries title="컨디션" weeks={weeks} pick={(w) => w.mood} barClass="bg-brand" />
      </CardContent>
    </Card>
  );
}

function PulseSeries({ title, weeks, pick, barClass }: { title: string; weeks: PulseWeek[]; pick: (w: PulseWeek) => number | null; barClass: string }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium">{title}</div>
      <div className="grid grid-cols-6 items-end gap-1.5">
        {weeks.map((w) => {
          const v = pick(w);
          return (
            <div key={w.weekStart} className="grid gap-1 text-center" title={v == null ? `${shortDate(w.weekStart)} 주 · 응답 부족` : `${shortDate(w.weekStart)} 주 · ${v} (${w.responses}명)`}>
              <span className="text-[11px] font-medium tabular-nums">{v ?? ""}</span>
              <div className="flex h-16 items-end rounded bg-muted/60">
                {v == null ? (
                  <span className="w-full pb-1 text-[10px] leading-tight text-muted-foreground">응답 부족</span>
                ) : (
                  <div className={cn("w-full rounded", barClass)} style={{ height: `${(v / 5) * 100}%` }} />
                )}
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums">{shortDate(w.weekStart)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
