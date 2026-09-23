import "server-only";
import { and, eq } from "drizzle-orm";
import type { SafeUser } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { memberById } from "@/lib/members/queries";

export function teamReportFor(teamId: number, weekStart: string) {
  return db.select().from(schema.teamReports).where(and(eq(schema.teamReports.teamId, teamId), eq(schema.teamReports.weekStart, weekStart))).get();
}

/** Admin: all teams. Leader: own team. Member: own team read-only (final reports). */
export function reportAccess(user: SafeUser) {
  const me = user.memberId != null ? memberById(user.memberId) : undefined;
  const isAdmin = user.role === "admin";
  return {
    myTeamId: me?.teamId ?? null,
    canEdit: (teamId: number) => isAdmin || (!!me?.isLeader && me.teamId === teamId),
    canRead: (teamId: number) => isAdmin || me?.teamId === teamId,
    isAdmin,
  };
}
