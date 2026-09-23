import type { MemberRecord, Team } from "@/lib/db/schema";

/** Member joined with its team; what pages and components should use. */
export type Member = MemberRecord & {
  team: string;
  isLeader: boolean;
};

export type { Team };
