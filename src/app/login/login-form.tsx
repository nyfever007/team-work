"use client";

import { useActionState } from "react";
import { Loader2Icon } from "lucide-react";
import { login } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(login, undefined);

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="next" value={next} />
      <div className="grid gap-2">
        <Label htmlFor="username">이메일</Label>
        <Input
          id="username"
          name="username"
          autoComplete="username"
          inputMode="email"
          placeholder="name@company.com"
          defaultValue={state?.username ?? ""}
          autoFocus
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">비밀번호</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending && <Loader2Icon className="size-4 animate-spin" />}
        로그인
      </Button>
    </form>
  );
}
