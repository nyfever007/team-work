import { requireUser } from "@/lib/auth/dal";
import { SubNav } from "@/components/layout/sub-nav";

export default async function FormsLayout({ children }: LayoutProps<"/forms">) {
  await requireUser();
  return (
    <div className="grid gap-6">
      <SubNav
        title="품의"
        items={[
          { href: "/forms", label: "품의서", exact: true },
          { href: "/forms/mine", label: "내 품의 내역" },
        ]}
      />
      {children}
    </div>
  );
}
