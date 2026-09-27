"use client";

import { useTransition } from "react";
import { Loader2Icon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";
import { suggestOneOnOneAgenda } from "@/lib/one-on-one/actions";
import { Button } from "@/components/ui/button";

/** Asks the AI for agenda lines and hands them to `onInsert`. Nothing is saved. */
export function AiAgendaButton({ memberId, onInsert }: { memberId: number; onInsert: (text: string) => void }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          try {
            const r = await suggestOneOnOneAgenda(memberId);
            if (!r.ok) return void toast.error(r.error);
            onInsert(r.agenda);
            toast.success("AI 제안을 안건에 넣었습니다. 검토 후 저장하세요.");
          } catch {
            toast.error("AI 안건 제안에 실패했습니다.");
          }
        })
      }
    >
      {pending ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
      AI 안건 제안
    </Button>
  );
}

/** Appends `add` below `current` with a blank line in between. */
export function appendText(current: string, add: string) {
  return current.trim() ? `${current.trimEnd()}\n\n${add}` : add;
}
