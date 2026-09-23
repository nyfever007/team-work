import type { LeaveBalance } from "@/lib/leaves/balance";
import { LEAVE_LABEL } from "@/lib/leaves/types";
import { formatDays } from "@/lib/requests/calc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function LeaveBalanceCard({ name, balance }: { name: string; balance: LeaveBalance }) {
  const a = balance.annual;
  const s = balance.sick;
  const p = balance.period;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{name}님의 휴가 현황</CardTitle>
        <CardDescription>
          입사일 기준 {p.yearIndex}년차 · 이번 연차 연도 {p.start} ~ {p.end} · 연차는 {a.rule}, 병가는 같은 기간 {s.allowance}일
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <Gauge
          label="휴가 · 연차"
          used={a.used}
          total={a.accrued}
          remaining={a.remaining}
          color="bg-blue-500"
          note={a.accrued < a.total ? `발생 ${formatDays(a.accrued)}일 / 연간 ${formatDays(a.total)}일 (매월 1일 발생)` : `연차 1일, 반차 0.5일 차감${a.mode === "override" ? " · 지정값" : ""}`}
        />
        <Gauge label="병가" used={s.used} total={s.allowance} remaining={s.remaining} color="bg-rose-500" note="공가·청원휴가 등은 차감되지 않음" />
        {balance.others.length > 0 && (
          <p className="text-xs text-muted-foreground sm:col-span-2">이 기간 그 외 사용: {balance.others.map((o) => `${LEAVE_LABEL[o.type]} ${formatDays(o.days)}일`).join(" · ")}</p>
        )}
      </CardContent>
    </Card>
  );
}

function Gauge({ label, used, total, remaining, color, note }: { label: string; used: number; total: number; remaining: number; color: string; note: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  return (
    <div className="grid gap-1.5 rounded-lg border p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className={cn("text-2xl font-semibold tabular-nums", remaining < 0 && "text-destructive")}>
          {formatDays(remaining)}<span className="ml-0.5 text-sm font-normal text-muted-foreground">일 남음</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} /></div>
      <div className="flex flex-wrap justify-between gap-x-3 text-xs text-muted-foreground tabular-nums">
        <span>사용 {formatDays(used)}일 / 가능 {formatDays(total)}일</span>
        <span>{note}</span>
      </div>
    </div>
  );
}
