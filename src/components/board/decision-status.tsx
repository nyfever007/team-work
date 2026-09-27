"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { setDecisionStatus } from "@/lib/board/actions";
import { DECISION_STATUS_LABEL, type DecisionStatus } from "@/lib/board/types";
import { cn } from "@/lib/utils";

const DECISION_STATUS_CLASS: Record<DecisionStatus, string> = {
  active: "bg-emerald-100 text-emerald-800",
  superseded: "bg-muted text-muted-foreground",
};

/** Status badge; clickable (toggles 유효 ↔ 변경됨) for the author or the team leader. */
export function DecisionStatusBadge({ postId, status, editable }: { postId: number; status: DecisionStatus; editable: boolean }) {
  const [pending, start] = useTransition();
  const cls = cn("inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold", DECISION_STATUS_CLASS[status]);
  if (!editable) return <span className={cls}>{DECISION_STATUS_LABEL[status]}</span>;
  const next: DecisionStatus = status === "active" ? "superseded" : "active";
  return (
    <button
      type="button"
      className={cn(cls, "cursor-pointer ring-offset-1 hover:ring-1 hover:ring-border disabled:opacity-50")}
      title={`${DECISION_STATUS_LABEL[next]}(으)로 바꾸기`}
      disabled={pending}
      onClick={() =>
        start(async () => {
          try {
            const r = await setDecisionStatus(postId, next);
            if (r.ok) toast.success(r.message);
            else toast.error(r.error);
          } catch {
            toast.error("요청에 실패했습니다.");
          }
        })
      }
    >
      {DECISION_STATUS_LABEL[status]}
    </button>
  );
}
