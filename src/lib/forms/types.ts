// Registry of 품의서 kinds (client-safe). Adding a form: set `ready: true`, point `newHref`/`listHref` at its pages,
// and add its rows to `myFormCounts()` / `myDocuments()` in lib/forms/queries.ts.

export const FORM_KINDS = ["leave", "overtime", "taxi", "dinner_system", "dinner_claim", "general"] as const;
export type FormKind = (typeof FORM_KINDS)[number];

export type FormDef = {
  kind: FormKind;
  label: string;
  description: string;
  /** Implemented forms link to their own pages; the rest open a "준비 중" placeholder at /forms/[kind]. */
  ready: boolean;
  newHref?: string;
  listHref?: string;
  /** Tailwind classes for the card's icon chip. */
  tone: string;
  /** Only team leaders (and admin) see and file this form. */
  leaderOnly?: boolean;
};

export const FORMS: FormDef[] = [
  { kind: "leave", label: "휴가 품의", description: "연차·반차·병가 등 휴가 신청", ready: true, newHref: "/schedule/requests/new", listHref: "/schedule/requests", tone: "bg-sky-50 text-sky-700" },
  { kind: "overtime", label: "시간외 근무신청서", description: "야근·휴일 근무 사전 신청", ready: true, newHref: "/forms/overtime/new", listHref: "/forms/overtime", tone: "bg-indigo-50 text-indigo-700" },
  { kind: "taxi", label: "택시비 지급품의", description: "야근·업무상 택시비 청구", ready: true, newHref: "/forms/taxi/new", listHref: "/forms/taxi", tone: "bg-amber-50 text-amber-700" },
  { kind: "dinner_system", label: "회식비 전산품의", description: "① 회식 전 예산 승인 (1인당 5만원)", ready: true, newHref: "/forms/dinner/new", listHref: "/forms/dinner?stage=budget", tone: "bg-pink-50 text-pink-700", leaderOnly: true },
  { kind: "dinner_claim", label: "회식비 청구품의", description: "② 승인된 전산품의로 회식 후 정산", ready: true, newHref: "/forms/dinner/claim", listHref: "/forms/dinner?stage=settle", tone: "bg-rose-50 text-rose-700", leaderOnly: true },
  { kind: "general", label: "일반품의", description: "그 밖의 결재가 필요한 사항", ready: true, newHref: "/forms/general/new", listHref: "/forms/general", tone: "bg-brand-soft text-accent-foreground" },
];

export function formDef(kind: string): FormDef | undefined {
  return FORMS.find((f) => f.kind === kind);
}

/** One submitted document, whatever its kind — used by the unified 내 품의 내역 list. */
export type DocumentRow = {
  kind: FormKind;
  id: number;
  docNo: string;
  title: string;
  writtenAt: string; // YYYY-MM-DD
  statusLabel: string;
  statusClass: string;
  href: string;
};

/** Forms this user may see: leader-only ones only for team leaders / admin. */
export function formsFor(isLeaderOrAdmin: boolean): FormDef[] {
  return FORMS.filter((f) => !f.leaderOnly || isLeaderOrAdmin);
}
