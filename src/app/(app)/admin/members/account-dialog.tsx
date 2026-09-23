"use client";

import { useActionState, useState, useTransition, type ReactNode } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { linkAccount, resetPassword, unlinkAccount, type AccountState } from "@/lib/accounts/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";

export type UnlinkedUser = { id: number; username: string; email: string | null; name: string };
export type LinkedAccount = { id: number; username: string; role: "admin" | "member" };

type Props = {
  memberId: number;
  memberName: string;
  memberEmail?: string;
  account: LinkedAccount | null;
  unlinkedUsers: UnlinkedUser[];
  trigger: ReactNode;
};

export function AccountDialog({ memberId, memberName, memberEmail = "", account, unlinkedUsers, trigger }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{account ? "계정 관리" : "계정 연결"}</DialogTitle>
          <DialogDescription>
            {account ? `${memberName}님의 로그인 계정 ${account.username}` : `${memberName}님이 로그인할 계정을 만들거나 연결합니다.`}
          </DialogDescription>
        </DialogHeader>
        {open &&
          (account ? (
            <ManageAccount account={account} onDone={() => setOpen(false)} />
          ) : (
            <LinkForm memberId={memberId} memberEmail={memberEmail} unlinkedUsers={unlinkedUsers} onDone={() => setOpen(false)} />
          ))}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Success handling lives inside the action wrapper, not in an effect: a successful
 * link swaps this form for <ManageAccount> in the same commit, so an effect on the
 * unmounting form would never run.
 */
function withDone(
  fn: (prev: AccountState, fd: FormData) => Promise<AccountState>,
  onDone: () => void,
) {
  return async (prev: AccountState, fd: FormData) => {
    const r = await fn(prev, fd);
    if (r?.ok) {
      toast.success(r.message);
      onDone();
    }
    return r;
  };
}

function LinkForm({ memberId, memberEmail, unlinkedUsers, onDone }: { memberId: number; memberEmail: string; unlinkedUsers: UnlinkedUser[]; onDone: () => void }) {
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [state, action, pending] = useActionState(withDone(linkAccount.bind(null, memberId), onDone), undefined);

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="mode" value={mode} />
      <div className="grid gap-1.5">
        <Label htmlFor="mode">방법</Label>
        <NativeSelect id="mode" value={mode} onChange={(e) => setMode(e.target.value as "new" | "existing")} className="w-full">
          <NativeSelectOption value="new">새 계정 만들기</NativeSelectOption>
          <NativeSelectOption value="existing" disabled={unlinkedUsers.length === 0}>
            기존 계정 연결{unlinkedUsers.length === 0 ? " (연결 가능한 계정 없음)" : ""}
          </NativeSelectOption>
        </NativeSelect>
      </div>
      {mode === "new" ? (
        <>
          <div className="grid gap-1.5">
            <Label>로그인 이메일</Label>
            {memberEmail ? (
              <Input value={memberEmail} disabled aria-label="로그인 이메일" />
            ) : (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">구성원 정보에 이메일이 없습니다. 먼저 구성원 수정에서 이메일을 입력하세요.</p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="password">초기 비밀번호</Label>
            <Input id="password" name="password" type="text" autoComplete="off" minLength={8} required disabled={!memberEmail} />
            <p className="text-xs text-muted-foreground">8자 이상. 본인에게 전달 후 비밀번호 변경을 안내하세요.</p>
          </div>
        </>
      ) : (
        <div className="grid gap-1.5">
          <Label htmlFor="userId">계정</Label>
          <NativeSelect id="userId" name="userId" required defaultValue={unlinkedUsers[0]?.id} className="w-full">
            {unlinkedUsers.map((u) => (
              <NativeSelectOption key={u.id} value={u.id}>
                @{u.username} ({u.name})
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      )}
      {state && !state.ok && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          취소
        </Button>
        <Button type="submit" disabled={pending || (mode === "new" && !memberEmail)}>
          {pending && <Loader2Icon className="size-4 animate-spin" />}
          {mode === "new" ? "계정 만들기" : "연결"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function ManageAccount({ account, onDone }: { account: LinkedAccount; onDone: () => void }) {
  const [state, action, pending] = useActionState(withDone(resetPassword.bind(null, account.id), onDone), undefined);
  const [unlinking, startUnlink] = useTransition();

  return (
    <div className="grid gap-4">
      <form action={action} className="grid gap-3">
        <div className="text-sm font-medium">비밀번호 재설정</div>
        <div className="grid gap-1.5">
          <Label htmlFor="password">새 비밀번호</Label>
          <Input id="password" name="password" type="text" autoComplete="off" minLength={8} required />
          <p className="text-xs text-muted-foreground">재설정하면 해당 계정은 모든 기기에서 로그아웃됩니다.</p>
        </div>
        {state && !state.ok && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending && <Loader2Icon className="size-4 animate-spin" />}
            재설정
          </Button>
        </div>
      </form>
      <Separator />
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">계정 연결을 해제합니다. 계정과 구성원 정보는 남습니다.</p>
        <Button
          type="button"
          variant="outline"
          disabled={unlinking || account.role === "admin"}
          onClick={() =>
            startUnlink(async () => {
              const r = await unlinkAccount(account.id);
              if (r.ok) {
                toast.success("연결을 해제했습니다.");
                onDone();
              } else toast.error(r.error ?? "실패했습니다.");
            })
          }
        >
          연결 해제
        </Button>
      </div>
    </div>
  );
}
