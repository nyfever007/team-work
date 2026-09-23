import { requireUser } from "@/lib/auth/dal";
import { memberById } from "@/lib/members/queries";
import { SubNav } from "@/components/layout/sub-nav";

export default async function TeamLayout({ children }: LayoutProps<"/team">) {
  const user = await requireUser();
  const me = user.memberId != null ? memberById(user.memberId) : undefined;
  const canManage = user.role === "admin" || !!me?.isLeader;
  return (
    <div className="grid gap-6">
      <SubNav
        title="팀"
        items={[
          { href: "/team", label: "현황", exact: true },
          { href: "/team/milestones", label: "마일스톤" },
          ...(user.role === "admin" || me ? [{ href: "/team/report", label: "주간 보고서" }] : []),
          ...(canManage ? [{ href: "/team/manage", label: "관리" }] : []),
        ]}
      />
      {children}
    </div>
  );
}
