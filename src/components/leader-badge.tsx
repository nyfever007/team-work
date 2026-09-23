import { CrownIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function LeaderBadge({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800", className)}>
      <CrownIcon className="size-3" />
      팀장
    </span>
  );
}
