import "server-only";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Member, Team } from "./types";

const memberSelect = {
  id: schema.members.id,
  teamId: schema.members.teamId,
  name: schema.members.name,
  position: schema.members.position,
  rank: schema.members.rank,
  phone: schema.members.phone,
  email: schema.members.email,
  joinedAt: schema.members.joinedAt,
  totalOffdays: schema.members.totalOffdays,
  annualOverride: schema.members.annualOverride,
  createdAt: schema.members.createdAt,
  updatedAt: schema.members.updatedAt,
  team: schema.teams.name,
  isLeader: sql<number>`case when ${schema.teams.leaderMemberId} = ${schema.members.id} then 1 else 0 end`,
};

function toMember(r: Omit<Member, "isLeader"> & { isLeader: number }): Member {
  return { ...r, isLeader: r.isLeader === 1 };
}

/** All members with team name, ordered team → leader first → name. */
export function allMembers(): Member[] {
  return db
    .select(memberSelect)
    .from(schema.members)
    .innerJoin(schema.teams, eq(schema.teams.id, schema.members.teamId))
    .orderBy(asc(schema.teams.name), desc(sql`case when ${schema.teams.leaderMemberId} = ${schema.members.id} then 1 else 0 end`), asc(schema.members.name))
    .all()
    .map(toMember);
}

export function memberById(id: number): Member | undefined {
  const r = db.select(memberSelect).from(schema.members).innerJoin(schema.teams, eq(schema.teams.id, schema.members.teamId)).where(eq(schema.members.id, id)).get();
  return r ? toMember(r) : undefined;
}

export function allTeams(): Team[] {
  return db.select().from(schema.teams).orderBy(asc(schema.teams.name)).all();
}

export function teamById(id: number): Team | undefined {
  return db.select().from(schema.teams).where(eq(schema.teams.id, id)).get();
}
