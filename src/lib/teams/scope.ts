import "server-only";
import type { SafeUser } from "@/lib/auth/session";
import { allTeams, memberById } from "@/lib/members/queries";
import type { Member, Team } from "@/lib/members/types";

export type TeamScope = {
  isAdmin: boolean;
  /** The viewer's member record (undefined for admin without a member link). */
  me: Member | undefined;
  /** Teams this viewer may open: admin all, everyone else only their own team. */
  teams: Team[];
  /** Selected team (the `?team=` param if allowed, else own team, else the first allowed); null when none. */
  teamId: number | null;
  canRead: (teamId: number) => boolean;
  /** Leader of that team, or admin. */
  canLead: (teamId: number) => boolean;
};

/**
 * Team-only areas (라운지, 1:1, 업무량): every activity belongs to one team. Non-admins only ever get their own team;
 * admin picks one with `?team=`. Always re-check `canRead`/`canLead` in server actions.
 */
export function teamScope(user: SafeUser, requested?: string | string[]): TeamScope {
  const isAdmin = user.role === "admin";
  const me = user.memberId != null ? memberById(user.memberId) : undefined;
  const teams = allTeams().filter((t) => isAdmin || t.id === me?.teamId);
  const wanted = Number(Array.isArray(requested) ? requested[0] : requested);
  const teamId = teams.some((t) => t.id === wanted) ? wanted : (me?.teamId ?? teams[0]?.id ?? null);
  return {
    isAdmin,
    me,
    teams,
    teamId,
    canRead: (id) => isAdmin || me?.teamId === id,
    canLead: (id) => isAdmin || (!!me?.isLeader && me.teamId === id),
  };
}
