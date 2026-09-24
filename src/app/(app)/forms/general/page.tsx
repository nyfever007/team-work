import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { generalFor } from "@/lib/general/queries";
import { amountLine } from "@/lib/general/types";
import { REQUEST_STATUS_CLASS, REQUEST_STATUS_LABEL } from "@/lib/leaves/types";
import { allMembers } from "@/lib/members/queries";
import { requestAccess } from "@/lib/requests/queries";
import { FormIcon } from "@/components/forms/form-icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "일반 품의서" };

export default async function GeneralListPage() {
  const user = await requireUser();
  const access = requestAccess(user);
  const visible = allMembers().filter((m) => access.canView(m));
  const rows = generalFor(visible.map((m) => m.id));

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-accent-foreground">
            <FormIcon kind="general" className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold">일반 품의서</h2>
            <p className="text-sm text-muted-foreground">
              {access.isAdmin ? "전체" : access.me?.isLeader ? "우리 팀" : "내"} 품의서 {rows.length}건
            </p>
          </div>
        </div>
        <Button asChild>
          <Link href="/forms/general/new">
            <PlusIcon />
            품의서 작성
          </Link>
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">문서번호</th>
              <th className="px-3 py-2.5 text-left font-medium">작성자</th>
              <th className="px-3 py-2.5 text-left font-medium">제목</th>
              <th className="px-3 py-2.5 text-left font-medium">거래처</th>
              <th className="px-3 py-2.5 text-right font-medium">금액</th>
              <th className="px-3 py-2.5 text-left font-medium">작성일</th>
              <th className="px-4 py-2.5 text-left font-medium">상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="h-24 text-center text-muted-foreground">아직 품의서가 없습니다.</td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className={cn("relative border-b last:border-b-0 hover:bg-accent/40", (r.status === "cancelled" || r.status === "rejected") && "text-muted-foreground")}>
                <td className="px-4 py-2.5 font-mono text-xs">
                  <Link href={`/forms/general/${r.id}`} className="hover:underline after:absolute after:inset-0">{r.docNo}</Link>
                </td>
                <td className="px-3 py-2.5">
                  <div className="font-medium">{r.memberName}</div>
                  <div className="text-xs text-muted-foreground">{r.teamName}</div>
                </td>
                <td className="max-w-72 truncate px-3 py-2.5" title={r.title}>{r.title}</td>
                <td className="max-w-40 truncate px-3 py-2.5">{r.vendor || "—"}</td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">{amountLine(r.amount, r.currency, r.vat) || "—"}</td>
                <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">{r.writtenAt}</td>
                <td className="px-4 py-2.5">
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", REQUEST_STATUS_CLASS[r.status])}>{REQUEST_STATUS_LABEL[r.status]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
