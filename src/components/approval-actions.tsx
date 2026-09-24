"use client";

import { useState, useTransition } from "react";
import { CheckIcon, Loader2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Decide = (decision: "approve" | "reject", note?: string) => Promise<{ ok: true; message: string } | { ok: false; error: string }>;

/**
 * Approve / reject buttons for anything waiting on a leader (milestone proposals, leave requests).
 * `decide` is a server action bound to the item, e.g. `decideMilestone.bind(null, id)`. Reject asks for a reason.
 */
export function ApprovalActions({ decide: decideAction, title, size = "sm", className }: { decide: Decide; title: string; size?: "sm" | "xs"; className?: string }) {
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const decide = (decision: "approve" | "reject") =>
    start(async () => {
      try {
        const r = await decideAction(decision, reason);
        if (r.ok) toast.success(r.message);
        else toast.error(r.error);
      } catch {
        toast.error("처리에 실패했습니다.");
      }
    });

  if (rejecting) {
    return (
      <form
        className={cn("grid w-full gap-2", className)}
        onSubmit={(e) => {
          e.preventDefault();
          decide("reject");
        }}
      >
        <Textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500} placeholder="반려 사유 (제안자에게 보입니다)" aria-label={`${title} 반려 사유`} className="bg-card text-sm" />
        <div className="flex justify-end gap-1.5">
          <Button type="button" variant="ghost" size={size} onClick={() => setRejecting(false)} disabled={pending}>
            취소
          </Button>
          <Button type="submit" variant="destructive" size={size} disabled={pending || !reason.trim()}>
            {pending && <Loader2Icon className="animate-spin" />}
            반려
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className={cn("flex shrink-0 gap-1.5", className)}>
      <Button variant="outline" size={size} onClick={() => setRejecting(true)} disabled={pending} aria-label={`${title} 반려`}>
        <XIcon />
        반려
      </Button>
      <Button size={size} onClick={() => decide("approve")} disabled={pending} aria-label={`${title} 승인`}>
        {pending ? <Loader2Icon className="animate-spin" /> : <CheckIcon />}
        승인
      </Button>
    </div>
  );
}
