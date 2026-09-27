"use client";

import { useTransition } from "react";
import { CheckIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { toggleTryDone } from "@/lib/retro/actions";
import { cn } from "@/lib/utils";

/** Round done toggle for a Try item (owner or leader; the server re-checks). */
export function TryDoneButton({ itemId, done, disabled, label }: { itemId: number; done: boolean; disabled?: boolean; label: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-label={done ? `${label} 완료 취소` : `${label} 완료`}
      aria-pressed={done}
      disabled={disabled || pending}
      onClick={() =>
        start(async () => {
          try {
            const r = await toggleTryDone(itemId);
            if (r.ok) toast.success(r.message);
            else toast.error(r.error);
          } catch {
            toast.error("변경하지 못했습니다.");
          }
        })
      }
      className={cn(
        "grid size-5 shrink-0 place-items-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        done ? "border-success bg-success text-white" : "border-muted-foreground/40 bg-white hover:border-success",
      )}
    >
      {pending ? <Loader2Icon className="size-3 animate-spin" /> : done && <CheckIcon className="size-3" />}
    </button>
  );
}
