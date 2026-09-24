import "server-only";
import { and, desc, eq, ne } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { LEAVE_LABEL, REQUEST_STATUS_CLASS, REQUEST_STATUS_LABEL } from "@/lib/leaves/types";
import { formatHours, shortRange } from "@/lib/overtime/types";
import { amountLine } from "@/lib/general/types";
import type { DocumentRow, FormKind } from "./types";

/** kind → year → number of documents the member filed (cancelled ones excluded). */
export function myFormCounts(memberId: number): Partial<Record<FormKind, Record<string, number>>> {
  const out: Partial<Record<FormKind, Record<string, number>>> = {};
  const add = (kind: FormKind, date: string) => {
    const y = date.slice(0, 4);
    const k = (out[kind] ??= {});
    k[y] = (k[y] ?? 0) + 1;
  };
  for (const r of db
    .select({ writtenAt: schema.leaveRequests.writtenAt })
    .from(schema.leaveRequests)
    .where(and(eq(schema.leaveRequests.memberId, memberId), ne(schema.leaveRequests.status, "cancelled")))
    .all())
    add("leave", r.writtenAt);
  for (const r of db
    .select({ writtenAt: schema.overtimeRequests.writtenAt })
    .from(schema.overtimeRequests)
    .where(and(eq(schema.overtimeRequests.memberId, memberId), ne(schema.overtimeRequests.status, "cancelled")))
    .all())
    add("overtime", r.writtenAt);
  for (const r of db
    .select({ writtenAt: schema.generalRequests.writtenAt })
    .from(schema.generalRequests)
    .where(and(eq(schema.generalRequests.memberId, memberId), ne(schema.generalRequests.status, "cancelled")))
    .all())
    add("general", r.writtenAt);
  for (const r of db
    .select({ writtenAt: schema.taxiRequests.writtenAt })
    .from(schema.taxiRequests)
    .where(and(eq(schema.taxiRequests.memberId, memberId), ne(schema.taxiRequests.status, "cancelled")))
    .all())
    add("taxi", r.writtenAt);
  for (const r of db
    .select({ writtenAt: schema.dinnerRequests.writtenAt, stage: schema.dinnerRequests.stage })
    .from(schema.dinnerRequests)
    .where(and(eq(schema.dinnerRequests.memberId, memberId), ne(schema.dinnerRequests.status, "cancelled")))
    .all())
    add(r.stage === "budget" ? "dinner_system" : "dinner_claim", r.writtenAt);
  // New forms: add their rows here.
  return out;
}

/** The member's documents across all kinds, newest first. */
export function myDocuments(memberId: number, limit = 200): DocumentRow[] {
  const rows: DocumentRow[] = db
    .select()
    .from(schema.leaveRequests)
    .where(eq(schema.leaveRequests.memberId, memberId))
    .orderBy(desc(schema.leaveRequests.createdAt))
    .limit(limit)
    .all()
    .map((r) => ({
      kind: "leave" as const,
      id: r.id,
      docNo: r.docNo,
      title: `${LEAVE_LABEL[r.type]} · ${r.startDate === r.endDate ? r.startDate : `${r.startDate} ~ ${r.endDate}`}`,
      writtenAt: r.writtenAt,
      statusLabel: REQUEST_STATUS_LABEL[r.status],
      statusClass: REQUEST_STATUS_CLASS[r.status],
      href: `/schedule/requests/${r.id}`,
    }));
  rows.push(
    ...db
      .select()
      .from(schema.overtimeRequests)
      .where(eq(schema.overtimeRequests.memberId, memberId))
      .orderBy(desc(schema.overtimeRequests.createdAt))
      .limit(limit)
      .all()
      .map((r) => ({
        kind: "overtime" as const,
        id: r.id,
        docNo: r.docNo,
        title: `${shortRange(r.startAt, r.endAt)} · ${formatHours(r.hours)}`,
        writtenAt: r.writtenAt,
        statusLabel: REQUEST_STATUS_LABEL[r.status],
        statusClass: REQUEST_STATUS_CLASS[r.status],
        href: `/forms/overtime/${r.id}`,
      })),
  );
  rows.push(
    ...db
      .select()
      .from(schema.generalRequests)
      .where(eq(schema.generalRequests.memberId, memberId))
      .orderBy(desc(schema.generalRequests.createdAt))
      .limit(limit)
      .all()
      .map((r) => ({
        kind: "general" as const,
        id: r.id,
        docNo: r.docNo,
        title: `${r.title}${r.amount != null ? ` · ${amountLine(r.amount, r.currency, r.vat)}` : ""}`,
        writtenAt: r.writtenAt,
        statusLabel: REQUEST_STATUS_LABEL[r.status],
        statusClass: REQUEST_STATUS_CLASS[r.status],
        href: `/forms/general/${r.id}`,
      })),
  );
  rows.push(
    ...db
      .select()
      .from(schema.taxiRequests)
      .where(eq(schema.taxiRequests.memberId, memberId))
      .orderBy(desc(schema.taxiRequests.createdAt))
      .limit(limit)
      .all()
      .map((r) => ({
        kind: "taxi" as const,
        id: r.id,
        docNo: r.docNo,
        title: `${r.useStart === r.useEnd ? r.useStart : `${r.useStart} ~ ${r.useEnd}`} · ${r.amount.toLocaleString("ko-KR")}원`,
        writtenAt: r.writtenAt,
        statusLabel: REQUEST_STATUS_LABEL[r.status],
        statusClass: REQUEST_STATUS_CLASS[r.status],
        href: `/forms/taxi/${r.id}`,
      })),
  );
  rows.push(
    ...db
      .select()
      .from(schema.dinnerRequests)
      .where(eq(schema.dinnerRequests.memberId, memberId))
      .orderBy(desc(schema.dinnerRequests.createdAt))
      .limit(limit)
      .all()
      .map((r) => ({
        kind: r.stage === "budget" ? ("dinner_system" as const) : ("dinner_claim" as const),
        id: r.id,
        docNo: r.docNo,
        title: `${r.headcount} · ${r.amount.toLocaleString("ko-KR")}원`,
        writtenAt: r.writtenAt,
        statusLabel: REQUEST_STATUS_LABEL[r.status],
        statusClass: REQUEST_STATUS_CLASS[r.status],
        href: `/forms/dinner/${r.id}`,
      })),
  );
  // New forms: append their rows here.
  return rows.sort((a, b) => b.writtenAt.localeCompare(a.writtenAt)).slice(0, limit);
}
