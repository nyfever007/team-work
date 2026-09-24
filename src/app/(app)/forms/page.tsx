import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon, ListIcon, PlusIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { canUseDinner } from "@/lib/dinner/access";
import { todayKey } from "@/lib/dates";
import { myFormCounts } from "@/lib/forms/queries";
import { formsFor } from "@/lib/forms/types";
import { FormIcon } from "@/components/forms/form-icon";
import { FadeIn } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "품의" };

export default async function FormsPage() {
  const user = await requireUser();
  const FORMS = formsFor(canUseDinner(user)); // leader-only forms hidden from other members
  const year = todayKey().slice(0, 4);
  const counts = user.memberId != null ? myFormCounts(user.memberId) : {};
  // Years with any document, newest first (always include this year).
  const years = [...new Set([year, ...Object.values(counts).flatMap((c) => Object.keys(c ?? {}))])].sort().reverse();
  const totalOf = (y: string) => Object.values(counts).reduce((n, c) => n + (c?.[y] ?? 0), 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="grid content-start gap-4">
        <div>
          <h2 className="text-lg font-bold">품의서</h2>
          <p className="text-sm text-muted-foreground">작성할 품의서를 고르세요. 카드의 숫자는 내가 올린 품의 건수입니다(취소 제외).</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {FORMS.map((f, i) => {
            const c = counts[f.kind] ?? {};
            const past = years.filter((y) => y !== year && c[y]).slice(0, 3);
            const href = f.ready ? f.newHref! : `/forms/${f.kind}`;
            return (
              <FadeIn key={f.kind} delay={Math.min(i, 8) * 0.03} className="h-full">
                <div className={cn("group relative flex h-full flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs transition-all", f.ready ? "hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md" : "opacity-80")}>
                  <div className="flex items-start gap-3">
                    <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", f.tone)}>
                      <FormIcon kind={f.kind} className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link href={href} className="font-semibold after:absolute after:inset-0">
                        {f.label}
                      </Link>
                      <p className="text-xs text-muted-foreground">{f.description}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold tabular-nums">{c[year] ?? 0}</div>
                      <div className="text-[10px] text-muted-foreground">{year}년</div>
                    </div>
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground tabular-nums">{past.length ? past.map((y) => `${y}년 ${c[y]}건`).join(" · ") : " "}</span>
                    {f.ready ? (
                      <span className="flex items-center gap-1 font-medium text-accent-foreground">
                        작성하기 <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    ) : (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">양식 준비 중</span>
                    )}
                  </div>
                  {f.ready && f.listHref && (
                    <Link href={f.listHref} className="relative z-10 -mt-1 flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline">
                      <ListIcon className="size-3" />
                      목록 보기
                    </Link>
                  )}
                </div>
              </FadeIn>
            );
          })}
        </div>
      </div>

      <aside className="grid content-start gap-4">
        <Card size="sm">
          <CardHeader>
            <CardTitle>연도별 내 품의</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {years.map((y) => (
              <div key={y} className="grid gap-1.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold">{y}년</span>
                  <span className="text-sm font-bold tabular-nums">{totalOf(y)}건</span>
                </div>
                <ul className="grid gap-0.5 text-xs">
                  {FORMS.filter((f) => counts[f.kind]?.[y]).map((f) => (
                    <li key={f.kind} className="flex items-center justify-between text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <FormIcon kind={f.kind} className="size-3" />
                        {f.label}
                      </span>
                      <span className="tabular-nums text-foreground">{counts[f.kind]![y]}건</span>
                    </li>
                  ))}
                  {totalOf(y) === 0 && <li className="text-muted-foreground">아직 올린 품의가 없습니다.</li>}
                </ul>
              </div>
            ))}
            <Button variant="outline" size="sm" asChild>
              <Link href="/forms/mine">내 품의 내역 보기</Link>
            </Button>
          </CardContent>
        </Card>
        <Button asChild>
          <Link href="/schedule/requests/new">
            <PlusIcon />
            휴가 품의 작성
          </Link>
        </Button>
      </aside>
    </div>
  );
}
