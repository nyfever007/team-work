import { CarTaxiFrontIcon, ClockIcon, FileTextIcon, MonitorIcon, PalmtreeIcon, UtensilsIcon, type LucideIcon } from "lucide-react";
import type { FormKind } from "@/lib/forms/types";

const ICONS: Record<FormKind, LucideIcon> = {
  leave: PalmtreeIcon,
  overtime: ClockIcon,
  taxi: CarTaxiFrontIcon,
  dinner_claim: UtensilsIcon,
  dinner_system: MonitorIcon,
  general: FileTextIcon,
};

export function FormIcon({ kind, className }: { kind: FormKind; className?: string }) {
  const Icon = ICONS[kind];
  return <Icon className={className} />;
}
