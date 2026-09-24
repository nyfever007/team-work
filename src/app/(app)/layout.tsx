import { requireUser } from "@/lib/auth/dal";
import { AppHeader } from "@/components/layout/app-header";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // Secure, DB-backed check. The proxy only checks that a cookie exists.
  const user = await requireUser();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AppHeader user={user} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
