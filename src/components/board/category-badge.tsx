import { POST_CATEGORY_CLASS, POST_CATEGORY_LABEL, type PostCategory } from "@/lib/board/types";
import { cn } from "@/lib/utils";

export function CategoryBadge({ category, className }: { category: PostCategory; className?: string }) {
  return <span className={cn("inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold", POST_CATEGORY_CLASS[category], className)}>{POST_CATEGORY_LABEL[category]}</span>;
}

export function SolvedBadge({ solved }: { solved: boolean }) {
  return <span className={cn("inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold", solved ? "bg-emerald-600 text-white" : "border border-amber-300 text-amber-800")}>{solved ? "해결됨" : "미해결"}</span>;
}
