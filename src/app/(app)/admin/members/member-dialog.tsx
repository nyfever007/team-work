"use client";

import { useCallback, useState, type ReactNode } from "react";
import type { Member, Team } from "@/lib/members/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MemberForm } from "./member-form";

type Props = {
  member?: Member;
  teams: Pick<Team, "id" | "name">[];
  trigger: ReactNode;
};

export function MemberDialog({ member, teams, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{member ? "구성원 수정" : "구성원 추가"}</DialogTitle>
          <DialogDescription>
            {member ? `${member.name}님의 정보를 수정합니다.` : "새 구성원의 정보를 입력하세요."}
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open so form state resets each time. */}
        {open && <MemberForm member={member} teams={teams} onSaved={close} />}
      </DialogContent>
    </Dialog>
  );
}
