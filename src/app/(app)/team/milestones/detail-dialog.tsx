"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export function DetailDialog({ open, closeHref, children }: { open: boolean; closeHref: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && router.push(closeHref, { scroll: false })}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">{children}</DialogContent>
    </Dialog>
  );
}
