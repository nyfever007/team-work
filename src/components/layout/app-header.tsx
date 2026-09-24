import Link from "next/link";
import { KeyRoundIcon, LogOutIcon } from "lucide-react";
import type { SafeUser } from "@/lib/auth/session";
import { logout } from "@/lib/auth/actions";
import { todayKey } from "@/lib/dates";
import { allMembers } from "@/lib/members/queries";
import { defaultReviewWeek, memberReviewsForWeek, unreadReviewCount } from "@/lib/member-reviews/queries";
import { milestoneAccess } from "@/lib/milestones/permissions";
import { pendingMilestones } from "@/lib/milestones/queries";
import { pendingRequestsFor } from "@/lib/requests/queries";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MainNav } from "./main-nav";

/**
 * 내 업무: unread shared reviews. 팀: for leaders, teammates still to be reviewed this cycle
 * plus milestone proposals waiting for approval (admin: proposals only). 일정: leave requests to approve.
 */
function navBadges(user: SafeUser): Record<string, number> {
  const badges: Record<string, number> = {};
  const approvals = pendingMilestones(milestoneAccess(user).approveTeamIds).length;
  if (approvals) badges["/team"] = approvals;
  const leaveApprovals = pendingRequestsFor(user).length;
  if (leaveApprovals) badges["/schedule"] = leaveApprovals;
  if (user.memberId == null) return badges;
  badges["/my"] = unreadReviewCount(user.memberId);
  const members = allMembers();
  const me = members.find((m) => m.id === user.memberId);
  if (me?.isLeader) {
    const mates = members.filter((m) => m.teamId === me.teamId && m.id !== me.id);
    const shared = new Set(memberReviewsForWeek(mates.map((m) => m.id), defaultReviewWeek(todayKey())).filter((r) => r.status === "shared").map((r) => r.memberId));
    badges["/team"] = approvals + mates.filter((m) => !shared.has(m.id)).length;
  }
  return badges;
}

export function AppHeader({ user }: { user: SafeUser }) {
  const initials = user.name
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-20 border-b border-border/70 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/65">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4 sm:gap-6 sm:px-6">
        <Link href="/my/today" className="flex items-center gap-2 font-bold tracking-tight">
          <span className="grid size-7 place-items-center rounded-lg bg-brand text-sm font-black text-white shadow-sm shadow-brand/30">D</span>
          <span className="hidden md:inline">플랫폼팀</span>
        </Link>
        <MainNav isAdmin={user.role === "admin"} badges={navBadges(user)} />
        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full" aria-label="계정 메뉴">
                <Avatar className="size-8">
                  <AvatarFallback className="bg-brand-soft text-xs font-semibold text-accent-foreground">{initials}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="text-sm font-medium">{user.name}</div>
                <div className="text-xs text-muted-foreground">{user.email ?? `@${user.username}`}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/account">
                  <KeyRoundIcon />
                  비밀번호 변경
                </Link>
              </DropdownMenuItem>
              <form action={logout}>
                <DropdownMenuItem asChild>
                  <button type="submit" className="w-full">
                    <LogOutIcon />
                    로그아웃
                  </button>
                </DropdownMenuItem>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
