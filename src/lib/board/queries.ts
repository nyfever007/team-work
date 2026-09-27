import "server-only";
import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import type { SafeUser } from "@/lib/auth/session";
import { addDays, todayKey, weekStartOf } from "@/lib/dates";
import { db, schema } from "@/lib/db";
import type { Post, PostComment } from "@/lib/db/schema";
import { teamScope } from "@/lib/teams/scope";
import { CONTRIBUTION_POINTS, CONTRIBUTION_WEEKLY_CAP, type DecisionStatus, type PostCategory, type ReactionKind } from "./types";

const P = schema.posts;
const C = schema.postComments;
const R = schema.postReactions;

/** Timestamp → Seoul date key. */
export const seoulKey = (d: Date) => todayKey(d);

/** [from 00:00 KST, to+1 00:00 KST) as epoch-ms Dates for timestamp columns. */
function kstBounds(from: string, to: string): [Date, Date] {
  return [new Date(`${from}T00:00:00+09:00`), new Date(`${addDays(to, 1)}T00:00:00+09:00`)];
}

// ── Permissions ─────────────────────────────────────────────

/** Board permissions for one viewer. Post team is always re-checked against `canRead`/`canLead`. */
export function boardAccess(user: SafeUser) {
  const scope = teamScope(user);
  const { me, canRead, canLead } = scope;
  const isAuthor = (p: Pick<Post, "authorUserId" | "authorMemberId">) => p.authorUserId === user.id || (me != null && p.authorMemberId === me.id);
  return {
    ...scope,
    isAuthor,
    /** Any member of that team (or admin). */
    canWrite: (teamId: number) => canRead(teamId),
    canEdit: (p: Post) => canRead(p.teamId) && isAuthor(p),
    canDelete: (p: Post) => canRead(p.teamId) && (isAuthor(p) || canLead(p.teamId)),
    canPin: (p: Post) => canLead(p.teamId),
    /** Members only, never on their own post. */
    canReact: (p: Post) => me != null && canRead(p.teamId) && !isAuthor(p),
    canComment: (p: Post) => canRead(p.teamId),
    canDeleteComment: (p: Post, c: Pick<PostComment, "authorUserId" | "authorMemberId">) => canRead(p.teamId) && (isAuthor(c) || canLead(p.teamId)),
    canAccept: (p: Post) => p.category === "question" && canRead(p.teamId) && (isAuthor(p) || canLead(p.teamId)),
    /** Decision status: author or leader/admin. */
    canSetStatus: (p: Post) => p.category === "decision" && canRead(p.teamId) && (isAuthor(p) || canLead(p.teamId)),
  };
}
export type BoardAccess = ReturnType<typeof boardAccess>;

// ── Reads ───────────────────────────────────────────────────

export function postById(id: number): Post | undefined {
  return db.select().from(P).where(eq(P.id, id)).get();
}

export function commentById(id: number): PostComment | undefined {
  return db.select().from(C).where(eq(C.id, id)).get();
}

export type ReactionCounts = Record<ReactionKind, number>;
const zeroCounts = (): ReactionCounts => ({ helpful: 0, saved: 0, tried: 0 });

function reactionCountsFor(postIds: number[]): Map<number, ReactionCounts> {
  const out = new Map<number, ReactionCounts>();
  if (postIds.length === 0) return out;
  const rows = db
    .select({ postId: R.postId, kind: R.kind, n: sql<number>`count(*)` })
    .from(R)
    .where(inArray(R.postId, postIds))
    .groupBy(R.postId, R.kind)
    .all();
  for (const r of rows) {
    const c = out.get(r.postId) ?? zeroCounts();
    c[r.kind] = r.n;
    out.set(r.postId, c);
  }
  return out;
}

function commentCountsFor(postIds: number[]): Map<number, number> {
  if (postIds.length === 0) return new Map();
  const rows = db.select({ postId: C.postId, n: sql<number>`count(*)` }).from(C).where(inArray(C.postId, postIds)).groupBy(C.postId).all();
  return new Map(rows.map((r) => [r.postId, r.n]));
}

export type PostListItem = Post & { counts: ReactionCounts; comments: number };

export type PostFilter = { category?: PostCategory; q?: string; sort?: "new" | "helpful"; savedBy?: number };

/** Team posts: pinned first, then newest (or most 도움됐어요). */
export function listPosts(teamId: number, f: PostFilter = {}): PostListItem[] {
  const where = [eq(P.teamId, teamId)];
  if (f.category) where.push(eq(P.category, f.category));
  const q = f.q?.trim().toLowerCase();
  if (q) where.push(sql`(instr(lower(${P.title}), ${q}) > 0 or instr(lower(${P.body}), ${q}) > 0 or instr(lower(${P.prompt}), ${q}) > 0)`);
  if (f.savedBy != null) where.push(sql`exists (select 1 from ${R} where ${R.postId} = ${P.id} and ${R.memberId} = ${f.savedBy} and ${R.kind} = 'saved')`);
  const rows = db.select().from(P).where(and(...where)).orderBy(desc(P.pinned), desc(P.createdAt)).all();
  const ids = rows.map((r) => r.id);
  const counts = reactionCountsFor(ids);
  const comments = commentCountsFor(ids);
  const items = rows.map((r) => ({ ...r, counts: counts.get(r.id) ?? zeroCounts(), comments: comments.get(r.id) ?? 0 }));
  if (f.sort === "helpful") {
    items.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.counts.helpful - a.counts.helpful || b.createdAt.getTime() - a.createdAt.getTime());
  }
  return items;
}

export function reactionCounts(postId: number): ReactionCounts {
  return reactionCountsFor([postId]).get(postId) ?? zeroCounts();
}

export function myReactions(postId: number, memberId: number | null | undefined): ReactionKind[] {
  if (memberId == null) return [];
  return db
    .select({ kind: R.kind })
    .from(R)
    .where(and(eq(R.postId, postId), eq(R.memberId, memberId)))
    .all()
    .map((r) => r.kind);
}

export function commentsOf(postId: number): PostComment[] {
  return db.select().from(C).where(eq(C.postId, postId)).orderBy(C.createdAt, C.id).all();
}

/** 결정 기록: the team's decision posts, newest 결정일 first. */
export function decisionPosts(teamId: number, status?: DecisionStatus): Post[] {
  const where = [eq(P.teamId, teamId), eq(P.category, "decision")];
  if (status) where.push(eq(P.decisionStatus, status));
  return db
    .select()
    .from(P)
    .where(and(...where))
    .orderBy(desc(sql`coalesce(${P.decidedAt}, '')`), desc(P.createdAt))
    .all();
}

// ── 공유 기여 ────────────────────────────────────────────────

export type Contribution = { posts: number; helpful: number; saved: number; tried: number; accepted: number; points: number };

/**
 * Shared-knowledge contribution per member in [from, to] (date keys, Seoul).
 * Points come only from other members' reactions and accepted answers, capped per week (Monday key).
 */
export function contributionFor(memberIds: number[], from: string, to: string): Map<number, Contribution> {
  const out = new Map<number, Contribution>();
  for (const id of memberIds) out.set(id, { posts: 0, helpful: 0, saved: 0, tried: 0, accepted: 0, points: 0 });
  if (memberIds.length === 0) return out;
  const [lo, hi] = kstBounds(from, to);
  // memberId → weekKey → raw points
  const weekly = new Map<number, Map<string, number>>();
  const addPoints = (memberId: number, key: string, pts: number) => {
    const wk = weekStartOf(key);
    const m = weekly.get(memberId) ?? new Map<string, number>();
    m.set(wk, (m.get(wk) ?? 0) + pts);
    weekly.set(memberId, m);
  };

  const posts = db
    .select({ author: P.authorMemberId })
    .from(P)
    .where(and(inArray(P.authorMemberId, memberIds), gte(P.createdAt, lo), lt(P.createdAt, hi)))
    .all();
  for (const p of posts) {
    const c = p.author != null ? out.get(p.author) : undefined;
    if (c) c.posts++;
  }

  const reactions = db
    .select({ author: P.authorMemberId, reactor: R.memberId, kind: R.kind, at: R.createdAt })
    .from(R)
    .innerJoin(P, eq(P.id, R.postId))
    .where(and(inArray(P.authorMemberId, memberIds), gte(R.createdAt, lo), lt(R.createdAt, hi)))
    .all();
  for (const r of reactions) {
    if (r.author == null || r.reactor === r.author) continue;
    const c = out.get(r.author);
    if (!c) continue;
    c[r.kind]++;
    addPoints(r.author, seoulKey(r.at), CONTRIBUTION_POINTS[r.kind]);
  }

  const accepted = db
    .select({ author: C.authorMemberId, postAuthor: P.authorMemberId, postAt: P.createdAt })
    .from(P)
    .innerJoin(C, eq(C.id, P.acceptedCommentId))
    .where(and(eq(P.category, "question"), inArray(C.authorMemberId, memberIds), gte(P.createdAt, lo), lt(P.createdAt, hi)))
    .all();
  for (const a of accepted) {
    if (a.author == null || a.author === a.postAuthor) continue;
    const c = out.get(a.author);
    if (!c) continue;
    c.accepted++;
    addPoints(a.author, seoulKey(a.postAt), CONTRIBUTION_POINTS.accepted);
  }

  for (const [memberId, weeks] of weekly) {
    const c = out.get(memberId);
    if (!c) continue;
    c.points = [...weeks.values()].reduce((n, v) => n + Math.min(v, CONTRIBUTION_WEEKLY_CAP), 0);
  }
  return out;
}

/** The team's most useful posts by reaction points received in [from, to] (other members' reactions only). */
export type TopPost = { id: number; title: string; category: PostCategory; authorName: string; authorMemberId: number | null; points: number };

export function topPostsFor(teamId: number, from: string, to: string, limit = 5): TopPost[] {
  const [lo, hi] = kstBounds(from, to);
  const rows = db
    .select({ id: P.id, title: P.title, category: P.category, authorName: P.authorName, author: P.authorMemberId, reactor: R.memberId, kind: R.kind })
    .from(R)
    .innerJoin(P, eq(P.id, R.postId))
    .where(and(eq(P.teamId, teamId), gte(R.createdAt, lo), lt(R.createdAt, hi)))
    .all();
  const byPost = new Map<number, TopPost>();
  for (const r of rows) {
    if (r.reactor === r.author) continue;
    const e = byPost.get(r.id) ?? { id: r.id, title: r.title, category: r.category, authorName: r.authorName, authorMemberId: r.author, points: 0 };
    e.points += CONTRIBUTION_POINTS[r.kind];
    byPost.set(r.id, e);
  }
  return [...byPost.values()].sort((a, b) => b.points - a.points || b.id - a.id).slice(0, limit);
}

/** Current quarter [start, today] as date keys. */
export function quarterSoFar(today = todayKey()): { from: string; to: string; label: string } {
  const y = Number(today.slice(0, 4));
  const q = Math.floor((Number(today.slice(5, 7)) - 1) / 3);
  return { from: `${y}-${String(q * 3 + 1).padStart(2, "0")}-01`, to: today, label: `${y}년 ${q + 1}분기` };
}

