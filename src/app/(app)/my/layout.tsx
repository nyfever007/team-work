import { requireUser } from "@/lib/auth/dal";
import { memberById } from "@/lib/members/queries";
import { unreadReviewCount } from "@/lib/member-reviews/queries";
import { SubNav } from "@/components/layout/sub-nav";

export default async function MyLayout({ children }: LayoutProps<"/my">) {
  const user = await requireUser();
  const me = user.memberId != null ? memberById(user.memberId) : undefined;
  const canMeet = user.role === "admin" || !!me?.isLeader;
  return (
    <div className="grid gap-6">
      <SubNav
        title="내 업무"
        items={[
          { href: "/my/today", label: "오늘" },
          { href: "/my/week", label: "이번 주" },
          { href: "/my/month", label: "이번 달" },
          ...(me ? [{ href: "/my/feedback", label: "피드백", badge: unreadReviewCount(me.id) }] : []),
          { href: "/my/history", label: "기록" },
          ...(canMeet ? [{ href: "/my/meeting", label: "미팅 노트" }] : []),
        ]}
      />
      {children}
    </div>
  );
}
