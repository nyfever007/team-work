import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { SubNav } from "@/components/layout/sub-nav";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/my/today");
  return (
    <div className="grid gap-6">
      <SubNav
        title="관리"
        items={[
          { href: "/admin/members", label: "구성원" },
          { href: "/admin/teams", label: "팀" },
        ]}
      />
      {children}
    </div>
  );
}
