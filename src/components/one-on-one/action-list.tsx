"use client";

import { useTransition } from "react";
import { CheckCircle2Icon, CircleIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { deleteOneOnOneAction, toggleOneOnOneAction } from "@/lib/one-on-one/actions";
import { ACTION_OWNER_LABEL, type ActionOwner } from "@/lib/one-on-one/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ActionItem = { id: number; title: string; owner: ActionOwner; done: boolean; meetingDate?: string };

type Props = {
  actions: ActionItem[];
  /** Whose actions the viewer may toggle: all (leader), member-owned only (the member), or none. */
  toggle: "all" | "member" | "none";
  canDelete?: boolean;
  empty?: string;
};

export function ActionList({ actions, toggle, canDelete, empty }: Props) {
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>, fallback: string) =>
    start(async () => {
      try {
        const r = await fn();
        if (!r.ok) toast.error(r.error);
      } catch {
        toast.error(fallback);
      }
    });

  if (actions.length === 0) return empty ? <p className="text-sm text-muted-foreground">{empty}</p> : null;

  return (
    <ul className="grid gap-1">
      {actions.map((x) => {
        const toggleable = toggle === "all" || (toggle === "member" && x.owner === "member");
        const Icon = x.done ? CheckCircle2Icon : CircleIcon;
        return (
          <li key={x.id} className="group flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-muted/50">
            <button
              type="button"
              disabled={!toggleable || pending}
              onClick={() => run(() => toggleOneOnOneAction(x.id, !x.done), "변경에 실패했습니다.")}
              aria-label={x.done ? "미완료로 변경" : "완료로 변경"}
              className={cn("shrink-0 rounded-full disabled:cursor-default", x.done ? "text-success" : "text-muted-foreground", toggleable && "hover:text-brand")}
            >
              <Icon className="size-4" />
            </button>
            <span className={cn("min-w-0 flex-1 text-sm", x.done && "text-muted-foreground line-through")}>{x.title}</span>
            {x.meetingDate && <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{x.meetingDate.slice(5).replace("-", "/")}</span>}
            <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold", x.owner === "leader" ? "bg-slate-100 text-slate-700" : "bg-brand-soft text-accent-foreground")}>{ACTION_OWNER_LABEL[x.owner]}</span>
            {canDelete && (
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="삭제"
                disabled={pending}
                className="text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                onClick={() => run(() => deleteOneOnOneAction(x.id), "삭제에 실패했습니다.")}
              >
                <Trash2Icon />
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
