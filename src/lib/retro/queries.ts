import "server-only";
import { and, asc, count, desc, eq, inArray, isNull } from "drizzle-orm";
import type { SafeUser } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import type { Retro } from "@/lib/db/schema";
import { allMembers } from "@/lib/members/queries";
import { teamScope } from "@/lib/teams/scope";
import type { RetroKind, RetroStatus } from "./types";

export type RetroListRow = {
  id: number;
  title: string;
  status: RetroStatus;
  anonymous: boolean;
  milestoneTitle: string | null;
  itemCount: number;
  createdByName: string;
  createdAt: Date;
};

/** Client-safe item: in anonymous retros `author` is always null; edit rights come as `mine`, computed here. */
export type RetroItemView = {
  id: number;
  kind: RetroKind;
  body: string;
  author: string | null;
  mine: boolean;
  votes: number;
  voted: boolean;
  ownerMemberId: number | null;
  ownerName: string | null;
  done: boolean;
};

export type OpenTryRow = {
  id: number;
  body: string;
  retroId: number;
  retroTitle: string;
  ownerMemberId: number | null;
  ownerName: string | null;
};

export type RetroAccess = {
  /** The viewer's member id when they belong to the retro's team (items, votes). */
  memberId: number | null;
  canLead: boolean;
  /** Add items / vote: team member while the retro is open. */
  canWrite: boolean;
};

export function retroById(id: number): Retro | undefined {
  return db.select().from(schema.retros).where(eq(schema.retros.id, id)).get();
}

/** Returns null when the viewer may not open this retro (other team). */
export function retroAccess(user: SafeUser, retro: Retro): RetroAccess | null {
  const scope = teamScope(user);
  if (!scope.canRead(retro.teamId)) return null;
  const memberId = scope.me && scope.me.teamId === retro.teamId ? scope.me.id : null;
  return { memberId, canLead: scope.canLead(retro.teamId), canWrite: memberId != null && retro.status === "open" };
}

export function retrosForTeam(teamId: number): RetroListRow[] {
  const rows = db
    .select({
      id: schema.retros.id,
      title: schema.retros.title,
      status: schema.retros.status,
      anonymous: schema.retros.anonymous,
      milestoneTitle: schema.milestones.title,
      createdByName: schema.retros.createdByName,
      createdAt: schema.retros.createdAt,
    })
    .from(schema.retros)
    .leftJoin(schema.milestones, eq(schema.milestones.id, schema.retros.milestoneId))
    .where(eq(schema.retros.teamId, teamId))
    .orderBy(desc(schema.retros.createdAt), desc(schema.retros.id))
    .all();
  if (rows.length === 0) return [];
  const counts = new Map(
    db
      .select({ retroId: schema.retroItems.retroId, n: count() })
      .from(schema.retroItems)
      .where(inArray(schema.retroItems.retroId, rows.map((r) => r.id)))
      .groupBy(schema.retroItems.retroId)
      .all()
      .map((r) => [r.retroId, r.n]),
  );
  return rows.map((r) => ({ ...r, itemCount: counts.get(r.id) ?? 0 }));
}

/** Approved milestones of the team (retro link options). */
export function retroMilestoneOptions(teamId: number): { id: number; title: string }[] {
  return db
    .select({ id: schema.milestones.id, title: schema.milestones.title })
    .from(schema.milestones)
    .where(and(eq(schema.milestones.teamId, teamId), eq(schema.milestones.approval, "approved")))
    .orderBy(desc(schema.milestones.startDate))
    .all();
}

export function milestoneTitle(id: number | null): string | null {
  if (id == null) return null;
  return db.select({ title: schema.milestones.title }).from(schema.milestones).where(eq(schema.milestones.id, id)).get()?.title ?? null;
}

export function teamMemberOptions(teamId: number): { id: number; name: string }[] {
  return allMembers()
    .filter((m) => m.teamId === teamId)
    .map((m) => ({ id: m.id, name: m.name }));
}

/** Items for the board, sorted by votes (then oldest first). Never leaks authors of anonymous retros. */
export function retroItemsView(retro: Retro, viewerMemberId: number | null): RetroItemView[] {
  const items = db.select().from(schema.retroItems).where(eq(schema.retroItems.retroId, retro.id)).orderBy(asc(schema.retroItems.createdAt), asc(schema.retroItems.id)).all();
  if (items.length === 0) return [];
  const votes = db
    .select({ itemId: schema.retroVotes.itemId, memberId: schema.retroVotes.memberId })
    .from(schema.retroVotes)
    .where(inArray(schema.retroVotes.itemId, items.map((i) => i.id)))
    .all();
  const names = new Map(allMembers().map((m) => [m.id, m.name]));
  const order = new Map(items.map((i, idx) => [i.id, idx]));
  return items
    .map((i) => {
      const mine = votes.filter((v) => v.itemId === i.id);
      return {
        id: i.id,
        kind: i.kind,
        body: i.body,
        author: retro.anonymous ? null : i.authorName,
        mine: viewerMemberId != null && i.authorMemberId === viewerMemberId,
        votes: mine.length,
        voted: viewerMemberId != null && mine.some((v) => v.memberId === viewerMemberId),
        ownerMemberId: i.kind === "try" ? i.ownerMemberId : null,
        ownerName: i.kind === "try" && i.ownerMemberId != null ? (names.get(i.ownerMemberId) ?? null) : null,
        done: i.doneAt != null,
      };
    })
    .sort((a, b) => b.votes - a.votes || order.get(a.id)! - order.get(b.id)!);
}

/** Open (not done) try items across the team's retros, newest retro first. */
export function openTryItems(teamId: number): OpenTryRow[] {
  const names = new Map(allMembers().map((m) => [m.id, m.name]));
  return db
    .select({
      id: schema.retroItems.id,
      body: schema.retroItems.body,
      retroId: schema.retros.id,
      retroTitle: schema.retros.title,
      ownerMemberId: schema.retroItems.ownerMemberId,
    })
    .from(schema.retroItems)
    .innerJoin(schema.retros, eq(schema.retros.id, schema.retroItems.retroId))
    .where(and(eq(schema.retros.teamId, teamId), eq(schema.retroItems.kind, "try"), isNull(schema.retroItems.doneAt)))
    .orderBy(desc(schema.retros.createdAt), asc(schema.retroItems.id))
    .all()
    .map((r) => ({ ...r, ownerName: r.ownerMemberId != null ? (names.get(r.ownerMemberId) ?? null) : null }));
}
