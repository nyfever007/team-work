import { requireUser } from "@/lib/auth/dal";
import { weekStartOf, todayKey } from "@/lib/dates";
import { pulseAnswered } from "@/lib/pulse/queries";
import { onboardingOpenCount } from "@/lib/onboarding/queries";
import { SubNav } from "@/components/layout/sub-nav";

/** 라운지: team-only collaboration (게시판, 결정 기록, 회고, 펄스 체크, 온보딩). Pages scope themselves with `teamScope()`. */
export default async function LoungeLayout({ children }: LayoutProps<"/lounge">) {
  const user = await requireUser();
  const memberId = user.memberId;
  const pulseDue = memberId != null && !pulseAnswered(memberId, weekStartOf(todayKey())) ? 1 : 0;
  const onboarding = memberId != null ? onboardingOpenCount(memberId) : 0;
  return (
    <div className="grid gap-6">
      <SubNav
        title="라운지"
        items={[
          { href: "/lounge", label: "게시판", exact: true },
          { href: "/lounge/decisions", label: "결정 기록" },
          { href: "/lounge/retro", label: "회고" },
          { href: "/lounge/pulse", label: "펄스 체크", badge: pulseDue },
          { href: "/lounge/onboarding", label: "온보딩", badge: onboarding },
        ]}
      />
      {children}
    </div>
  );
}
