import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/dal";
import { canUseDinner } from "@/lib/dinner/access";
import { myDocuments } from "@/lib/forms/queries";
import { formDef, formsFor, type FormKind } from "@/lib/forms/types";
import { FormIcon } from "@/components/forms/form-icon";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "내 품의 내역" };

export default async function MyDocumentsPage({ searchParams }: PageProps<"/forms/mine">) {
  const user = await requireUser();
  const FORMS = formsFor(canUseDinner(user)); // leader-only forms hidden from other members
  const sp = await searchParams;
  if (user.memberId == null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>구성원과 연결되지 않은 계정입니다</CardTitle>
          <CardDescription>구성원과 연결된 계정만 품의서를 작성할 수 있습니다.</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  const all = myDocuments(user.memberId);
  const years = [...new Set(all.map((d) => d.writtenAt.slice(0, 4)))].sort().reverse();
  const kind = formDef(String(sp.kind ?? ""))?.kind as FormKind | undefined;
  const year = years.includes(String(sp.year)) ? String(sp.year) : undefined;
  const rows = all.filter((d) => (!kind || d.kind === kind) && (!year || d.writtenAt.startsWith(year)));
  const href = (p: { kind?: string | null; year?: string | null }) => {
    const q = new URLSearchParams();
    const k = p.kind === undefined ? kind : p.kind;
    const y = p.year === undefined ? year : p.year;
    if (k) q.set("kind", k);
    if (y) q.set("year", y);
    return `/forms/mine${q.size ? `?${q}` : ""}`;
  };
  const chip = (active: boolean) => cn("rounded-full border px-3 py-1 text-sm transition-colors", active ? "border-brand/40 bg-accent font-semibold text-accent-foreground" : "bg-card text-muted-foreground hover:bg-muted");

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-lg font-bold">내 품의 내역</h2>
        <p className="text-sm text-muted-foreground">내가 올린 모든 품의서입니다. {rows.length}건</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Link href={href({ year: null })} className={chip(!year)}>전체 연도</Link>
        {years.map((y) => (
          <Link key={y} href={href({ year: y })} className={chip(year === y)}>{y}년</Link>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Link href={href({ kind: null })} className={chip(!kind)}>전체</Link>
        {FORMS.map((f) => (
          <Link key={f.kind} href={href({ kind: f.kind })} className={chip(kind === f.kind)}>{f.label}</Link>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">종류</th>
              <th className="px-3 py-2.5 text-left font-medium">내용</th>
              <th className="px-3 py-2.5 text-left font-medium">문서번호</th>
              <th className="px-3 py-2.5 text-left font-medium">작성일</th>
              <th className="px-4 py-2.5 text-left font-medium">상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="h-24 text-center text-muted-foreground">품의 내역이 없습니다.</td>
              </tr>
            )}
            {rows.map((d) => (
              <tr key={`${d.kind}:${d.id}`} className="relative border-b last:border-b-0 hover:bg-accent/40">
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <span className="flex items-center gap-1.5">
                    <FormIcon kind={d.kind} className="size-3.5 text-muted-foreground" />
                    {formDef(d.kind)?.label}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <Link href={d.href} className="hover:underline after:absolute after:inset-0">{d.title}</Link>
                </td>
                <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{d.docNo}</td>
                <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">{d.writtenAt}</td>
                <td className="px-4 py-2.5">
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", d.statusClass)}>{d.statusLabel}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
