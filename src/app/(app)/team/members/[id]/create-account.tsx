"use client";

import { useActionState, useEffect, useState } from "react";
import { KeyRoundIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { linkAccount, type AccountState } from "@/lib/accounts/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Leader/admin: create the login for a member who has none (username = member email). */
export function CreateAccount({ memberId, email }: { memberId: number; email: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<AccountState, FormData>(linkAccount.bind(null, memberId), undefined);

  useEffect(() => {
    if (state?.ok) toast.success(state.message);
    else if (state && !state.ok) toast.error(state.error);
  }, [state]);

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} disabled={!email} title={email ? undefined : "이메일을 먼저 입력하세요"}>
        <KeyRoundIcon />
        로그인 계정 만들기
      </Button>
    );
  }
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="mode" value="new" />
      <span className="text-xs text-muted-foreground">{email}</span>
      <Input name="password" type="password" autoComplete="new-password" minLength={8} required placeholder="초기 비밀번호 (8자 이상)" className="h-8 w-52" aria-label="초기 비밀번호" autoFocus />
      <Button type="submit" size="sm" disabled={pending}>
        {pending && <Loader2Icon className="animate-spin" />}
        만들기
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
        취소
      </Button>
    </form>
  );
}
