import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeftIcon, FileClockIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { formDef } from "@/lib/forms/types";
import { FormIcon } from "@/components/forms/form-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "품의서" };

/** Placeholder for forms whose template hasn't been built yet. Implemented forms redirect to their own page. */
export default async function FormKindPage({ params }: PageProps<"/forms/[kind]">) {
  await requireUser();
  const { kind } = await params;
  const f = formDef(kind);
  if (!f) notFound();
  if (f.ready && f.newHref) redirect(f.newHref);
  return (
    <div className="grid gap-4">
      <Link href="/forms" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" />
        품의서 목록
      </Link>
      <Card>
        <CardContent className="grid place-items-center gap-3 py-14 text-center">
          <span className={`grid size-14 place-items-center rounded-2xl ${f.tone}`}>
            <FormIcon kind={f.kind} className="size-7" />
          </span>
          <h2 className="text-xl font-bold">{f.label}</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            <FileClockIcon className="mr-1 inline size-4 align-text-bottom" />
            양식을 준비하고 있습니다. 회사 양식이 반영되면 여기서 작성하고 결재를 올릴 수 있습니다.
          </p>
          <Button variant="outline" asChild>
            <Link href="/forms">다른 품의서 보기</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
