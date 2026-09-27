"use client";

import { useState, useTransition } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { submitPulse } from "@/lib/pulse/actions";
import { PULSE_MIN_RESPONSES, PULSE_MOOD, PULSE_WORKLOAD } from "@/lib/pulse/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Answer = { workload: number; mood: number; comment: string };
type Option = { readonly value: number; readonly label: string; readonly emoji: string };

export function PulseForm({ initial }: { initial: Answer | null }) {
  const [workload, setWorkload] = useState<number | null>(initial?.workload ?? null);
  const [mood, setMood] = useState<number | null>(initial?.mood ?? null);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [pending, start] = useTransition();

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (workload == null || mood == null) return;
        start(async () => {
          try {
            const r = await submitPulse({ workload, mood, comment });
            if (r.ok) toast.success(r.message);
            else toast.error(r.error);
          } catch {
            toast.error("저장에 실패했습니다.");
          }
        });
      }}
    >
      <Scale title="이번 주 업무량" options={PULSE_WORKLOAD} value={workload} onChange={setWorkload} />
      <Scale title="이번 주 기분" options={PULSE_MOOD} value={mood} onChange={setMood} />
      <div className="grid gap-1.5">
        <span className="text-sm font-medium">하고 싶은 말 (선택)</span>
        <Textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={300} rows={2} />
        <span className="text-right text-[11px] text-muted-foreground tabular-nums">{comment.length}/300</span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex-1 text-xs text-muted-foreground">응답은 익명으로 집계되며 {PULSE_MIN_RESPONSES}명 이상 응답한 주만 팀 결과가 보입니다.</p>
        <Button type="submit" disabled={pending || workload == null || mood == null}>
          {pending && <Loader2Icon className="animate-spin" />}
          {initial ? "응답 수정" : "응답 제출"}
        </Button>
      </div>
    </form>
  );
}

function Scale({ title, options, value, onChange }: { title: string; options: readonly Option[]; value: number | null; onChange: (v: number) => void }) {
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">{title}</legend>
      <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label={title}>
        {options.map((o) => {
          const active = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.value)}
              className={cn(
                "grid justify-items-center gap-0.5 rounded-lg border px-1 py-2 transition-colors",
                active ? "border-brand bg-brand-soft font-semibold text-brand" : "bg-card text-muted-foreground hover:border-brand/40 hover:text-foreground",
              )}
            >
              <span className="text-2xl leading-none" aria-hidden>
                {o.emoji}
              </span>
              <span className="text-xs">{o.label}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
