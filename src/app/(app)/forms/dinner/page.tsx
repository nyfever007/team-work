import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon, PlusIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { budgetsAwaitingSettle, dinnerFor } from "@/lib/dinner/queries";
import { DINNER_STAGE_LABEL } from "@/lib/dinner/types";
import { REQUEST_STATUS_CLASS, REQUEST_STATUS_LABEL } from "@/lib/leaves/types";
import { allMembers } from "@/lib/members/queries";
import { requestAccess } from "@/lib/requests/queries";
import { FormIcon } from "@/components/forms/form-icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AwaitingSettle } from "./awaiting";

export const metadata: Metadata = { title: "회식비 품의" };

export default async function DinnerListPage({ searchParams }: PageProps<"/forms/dinner">) {
  const user = await requireUser();
  const sp = await searchParams;
  const access = requestAccess(user);
  const visible = allMembers().filter((m) => access.canView(m));
  const stage = sp.stage === "budget" || sp.stage === "settle" ? sp.stage : null;
  const all = dinnerFor(visible.map((m) => m.id));
  const rows = stage ? all.filter((r) => r.stage === stage) : all;
  const byId = new Map(all.map((r) => [r.id, r]));
  const settleOf = new Map(all.filter((r) => r.stage === "settle" && r.parentId != null && r.status !== "cancelled" && r.status !== "rejected").map((r) => [r.parentId!, r]));
  const awaiting = budgetsAwaitingSettle(visible.filter((m) => access.canCreateFor(m.id)).map((m) => m.id));
  const chip = (active: boolean) => cn("rounded-full border px-3 py-1 text-sm transition-colors", active ? "border-brand/40 bg-accent font-semibold text-accent-foreground" : "bg-card text-muted-foreground hover:bg-muted");

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-pink-50 text-pink-700">
            <FormIcon kind="dinner_system" className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold">회식비 품의</h2>
            <p className="text-sm text-muted-foreground">① 전산품의(회식 전) 승인 → ② 청구품의(회식 후 정산). {access.isAdmin ? "전체" : access.me?.isLeader ? "우리 팀" : "내"} {all.length}건</p>
          </div>
        </div>
        <Button asChild>
          <Link href="/forms/dinner/new">
            <PlusIcon />
            전산품의 작성
          </Link>
        </Button>
      </div>

      <AwaitingSettle rows={awaiting} />

      <div className="flex flex-wrap gap-1.5">
        <Link href="/forms/dinner" className={chip(!stage)}>전체</Link>
        <Link href="/forms/dinner?stage=budget" className={chip(stage === "budget")}>① 전산품의</Link>
        <Link href="/forms/dinner?stage=settle" className={chip(stage === "settle")}>② 청구품의</Link>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">구분</th>
              <th className="px-3 py-2.5 text-left font-medium">문서번호</th>
              <th className="px-3 py-2.5 text-left font-medium">작성자</th>
              <th className="px-3 py-2.5 text-left font-medium">인원</th>
              <th className="px-3 py-2.5 text-right font-medium">금액</th>
              <th className="px-3 py-2.5 text-left font-medium">작성일</th>
              <th className="px-3 py-2.5 text-left font-medium">상태</th>
              <th className="px-4 py-2.5 text-left font-medium">연결</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="h-24 text-center text-muted-foreground">아직 회식비 품의가 없습니다.</td>
              </tr>
            )}
            {rows.map((r) => {
              const linked = r.stage === "budget" ? settleOf.get(r.id) : r.parentId != null ? byId.get(r.parentId) : undefined;
              return (
                <tr key={r.id} className={cn("border-b last:border-b-0 hover:bg-accent/40", (r.status === "cancelled" || r.status === "rejected") && "text-muted-foreground")}>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", r.stage === "budget" ? "bg-pink-50 text-pink-800" : "bg-rose-100 text-rose-800")}>
                      {r.stage === "budget" ? "① " : "② "}
                      {DINNER_STAGE_LABEL[r.stage]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs">
                    <Link href={`/forms/dinner/${r.id}`} className="hover:underline">{r.docNo}</Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium">{r.memberName}</div>
                    <div className="text-xs text-muted-foreground">{r.teamName}</div>
                  </td>
                  <td className="max-w-48 truncate px-3 py-2.5" title={r.headcount}>{r.headcount}</td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">{r.amount.toLocaleString("ko-KR")}원</td>
                  <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">{r.writtenAt}</td>
                  <td className="px-3 py-2.5">
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", REQUEST_STATUS_CLASS[r.status])}>{REQUEST_STATUS_LABEL[r.status]}</span>
                  </td>
                  <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                    {linked ? (
                      <Link href={`/forms/dinner/${linked.id}`} className="inline-flex items-center gap-1 text-accent-foreground hover:underline">
                        {r.stage === "budget" ? "청구" : "전산"} {linked.docNo}
                        <ArrowRightIcon className="size-3" />
                      </Link>
                    ) : r.stage === "budget" && r.status === "approved" ? (
                      <span className="text-brand">청구 대기</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
