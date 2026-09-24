import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/auth/next-path";
import { getCurrentUser } from "@/lib/auth/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "로그인" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(next);

  // DB-backed check: a valid session goes straight in; a stale cookie just sees the form.
  const user = await getCurrentUser();
  if (user) redirect(nextPath);

  return (
    <main className="bg-hero flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/diverse-logo.png" alt="DIVERSE" className="h-5 w-auto self-start" />
          <div className="grid gap-1">
            <CardTitle className="text-xl font-bold">플랫폼팀</CardTitle>
            <CardDescription>출근하면 오늘 목표를, 퇴근 전엔 한 일을. 사내 계정으로 로그인하세요.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <LoginForm next={nextPath} />
        </CardContent>
      </Card>
    </main>
  );
}
