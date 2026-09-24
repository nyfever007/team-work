import Link from "next/link";
import { ReceiptIcon } from "lucide-react";
import type { DinnerRequest } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";

/** Approved 전산품의 without a 청구품의 yet — the next step for the requester. */
export function AwaitingSettle({ rows }: { rows: DinnerRequest[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="rounded-2xl border border-brand/25 bg-gradient-to-r from-brand-soft to-card p-4">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-bold">
        <ReceiptIcon className="size-4 text-brand" />
        청구 대기 중인 회식비 {rows.length}건
        <span className="font-normal text-muted-foreground">· 회식 후 청구품의를 올려 정산하세요</span>
      </h3>
      <ul className="grid gap-2">
        {rows.map((b) => (
          <li key={b.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-3 py-2 text-sm">
            <Link href={`/forms/dinner/${b.id}`} className="min-w-0 flex-1 hover:underline">
              <span className="font-mono text-xs text-muted-foreground">{b.docNo}</span> · {b.memberName} · {b.headcount} · <b className="tabular-nums">{b.amount.toLocaleString("ko-KR")}원</b>
            </Link>
            <Button size="sm" asChild>
              <Link href={`/forms/dinner/${b.id}/settle`}>청구품의 작성</Link>
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
