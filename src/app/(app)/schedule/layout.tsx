import { requireUser } from "@/lib/auth/dal";
import { pendingRequestsFor } from "@/lib/requests/queries";
import { SubNav } from "@/components/layout/sub-nav";

export default async function ScheduleLayout({ children }: LayoutProps<"/schedule">) {
  const user = await requireUser();
  return (
    <div className="grid gap-6">
      <SubNav
        title="일정"
        items={[
          { href: "/schedule", label: "달력", exact: true },
          { href: "/schedule/requests", label: "휴가 품의서", badge: pendingRequestsFor(user).length },
        ]}
      />
      {children}
    </div>
  );
}
