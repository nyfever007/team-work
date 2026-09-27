import { PULSE_MIN_RESPONSES } from "@/lib/pulse/types";
import { cn } from "@/lib/utils";

export type PulseTrendRow = { weekStart: string; responses: number; workload: number | null; mood: number | null };

const shortWeek = (key: string) => {
  const [, m, d] = key.split("-").map(Number);
  return `${m}/${d}`;
};

/** Aggregates only (no per-person values). Bars are % of the 1–5 scale. */
export function PulseTrend({ rows, teamSize, currentWeek }: { rows: PulseTrendRow[]; teamSize: number; currentWeek: string }) {
  return (
    <div className="grid gap-1">
      <div className="grid grid-cols-[3.5rem_4rem_1fr_1fr] gap-3 px-1 text-[11px] text-muted-foreground">
        <span>주</span>
        <span>응답</span>
        <span>업무량 (5 = 과중)</span>
        <span>기분 (5 = 최고)</span>
      </div>
      <ul className="grid gap-1">
        {[...rows].reverse().map((r) => {
          const enough = r.responses >= PULSE_MIN_RESPONSES;
          return (
            <li key={r.weekStart} className={cn("grid grid-cols-[3.5rem_4rem_1fr_1fr] items-center gap-3 rounded-md px-1 py-1.5 text-sm", r.weekStart === currentWeek && "bg-brand-soft/40")}>
              <span className="text-xs tabular-nums">
                {shortWeek(r.weekStart)}
                {r.weekStart === currentWeek && <span className="ml-1 text-[10px] text-brand">이번 주</span>}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {r.responses}/{teamSize}
              </span>
              {enough ? (
                <>
                  <Bar value={r.workload} className="bg-amber-400" />
                  <Bar value={r.mood} className="bg-brand" />
                </>
              ) : (
                <span className="col-span-2 text-xs text-muted-foreground">응답 부족</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Bar({ value, className }: { value: number | null; className: string }) {
  if (value == null) return <span />;
  return (
    <span className="flex items-center gap-2">
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
        <span className={cn("block h-full rounded-full", className)} style={{ width: `${(value / 5) * 100}%` }} />
      </span>
      <span className="w-7 text-right text-xs font-semibold tabular-nums">{value.toFixed(1)}</span>
    </span>
  );
}
