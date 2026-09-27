import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { todayKey } from "@/lib/dates";
import { db, schema } from "@/lib/db";
import { allMembers, memberById } from "@/lib/members/queries";

/** Onboarding applies to members who joined within this many days. */
export const ONBOARDING_WINDOW_DAYS = 90;

export function isNewcomer(joinedAt: string, today = todayKey()): boolean {
  const days = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${joinedAt}T00:00:00Z`)) / 86_400_000;
  return days >= 0 && days <= ONBOARDING_WINDOW_DAYS;
}

/** Unchecked team checklist items for a newcomer (0 for everyone else). Drives the 온보딩 tab badge. */
export function onboardingOpenCount(memberId: number): number {
  const me = memberById(memberId);
  if (!me || !isNewcomer(me.joinedAt)) return 0;
  const items = db.select({ id: schema.onboardingItems.id }).from(schema.onboardingItems).where(eq(schema.onboardingItems.teamId, me.teamId)).all();
  if (items.length === 0) return 0;
  const done = db
    .select({ id: schema.onboardingChecks.id })
    .from(schema.onboardingChecks)
    .where(and(eq(schema.onboardingChecks.memberId, memberId), inArray(schema.onboardingChecks.itemId, items.map((i) => i.id))))
    .all().length;
  return items.length - done;
}

export type OnboardingItemView = {
  id: number;
  title: string;
  description: string;
  postId: number | null;
  postTitle: string | null;
  position: number;
};

/** Team checklist in display order, with the referenced post's title (only when it's still in the same team). */
export function onboardingItemsFor(teamId: number): OnboardingItemView[] {
  const rows = db
    .select({
      id: schema.onboardingItems.id,
      title: schema.onboardingItems.title,
      description: schema.onboardingItems.description,
      postId: schema.onboardingItems.postId,
      position: schema.onboardingItems.position,
      postTitle: schema.posts.title,
      postTeamId: schema.posts.teamId,
    })
    .from(schema.onboardingItems)
    .leftJoin(schema.posts, eq(schema.posts.id, schema.onboardingItems.postId))
    .where(eq(schema.onboardingItems.teamId, teamId))
    .orderBy(asc(schema.onboardingItems.position), asc(schema.onboardingItems.id))
    .all();
  return rows.map(({ postTeamId, ...r }) => (postTeamId === teamId ? r : { ...r, postId: null, postTitle: null }));
}

/** 게시판 posts of the team, newest first (reference picker). */
export function teamPostOptions(teamId: number): { id: number; title: string }[] {
  return db
    .select({ id: schema.posts.id, title: schema.posts.title })
    .from(schema.posts)
    .where(eq(schema.posts.teamId, teamId))
    .orderBy(desc(schema.posts.createdAt))
    .limit(200)
    .all();
}

/** itemId → check date key (YYYY-MM-DD, KST) for one member. */
export function onboardingChecksOf(memberId: number, itemIds: number[]): Record<number, string> {
  if (itemIds.length === 0) return {};
  const rows = db
    .select({ itemId: schema.onboardingChecks.itemId, createdAt: schema.onboardingChecks.createdAt })
    .from(schema.onboardingChecks)
    .where(and(eq(schema.onboardingChecks.memberId, memberId), inArray(schema.onboardingChecks.itemId, itemIds)))
    .all();
  return Object.fromEntries(rows.map((r) => [r.itemId, todayKey(r.createdAt)]));
}

export type NewcomerProgress = { id: number; name: string; joinedAt: string; done: number; total: number; lastChecked: string | null };

/** Progress of the team's newcomers (joined within ONBOARDING_WINDOW_DAYS), most recent joiner first. */
export function newcomerProgress(teamId: number, itemIds: number[]): NewcomerProgress[] {
  const today = todayKey();
  return allMembers()
    .filter((m) => m.teamId === teamId && isNewcomer(m.joinedAt, today))
    .sort((a, b) => b.joinedAt.localeCompare(a.joinedAt))
    .map((m) => {
      const checks = Object.values(onboardingChecksOf(m.id, itemIds)).sort();
      return { id: m.id, name: m.name, joinedAt: m.joinedAt, done: checks.length, total: itemIds.length, lastChecked: checks.at(-1) ?? null };
    });
}
