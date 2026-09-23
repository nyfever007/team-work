/** Stable per-member colours for timeline bars and legends. */
export const MEMBER_PALETTE = [
  { bar: "bg-violet-500 text-white", dot: "bg-violet-500", soft: "bg-violet-100 text-violet-900" },
  { bar: "bg-red-500 text-white", dot: "bg-red-500", soft: "bg-red-100 text-red-900" },
  { bar: "bg-blue-500 text-white", dot: "bg-blue-500", soft: "bg-blue-100 text-blue-900" },
  { bar: "bg-emerald-500 text-white", dot: "bg-emerald-500", soft: "bg-emerald-100 text-emerald-900" },
  { bar: "bg-amber-500 text-white", dot: "bg-amber-500", soft: "bg-amber-100 text-amber-900" },
  { bar: "bg-pink-500 text-white", dot: "bg-pink-500", soft: "bg-pink-100 text-pink-900" },
  { bar: "bg-cyan-600 text-white", dot: "bg-cyan-600", soft: "bg-cyan-100 text-cyan-900" },
  { bar: "bg-orange-500 text-white", dot: "bg-orange-500", soft: "bg-orange-100 text-orange-900" },
  { bar: "bg-teal-600 text-white", dot: "bg-teal-600", soft: "bg-teal-100 text-teal-900" },
  { bar: "bg-indigo-500 text-white", dot: "bg-indigo-500", soft: "bg-indigo-100 text-indigo-900" },
  { bar: "bg-lime-600 text-white", dot: "bg-lime-600", soft: "bg-lime-100 text-lime-900" },
  { bar: "bg-fuchsia-500 text-white", dot: "bg-fuchsia-500", soft: "bg-fuchsia-100 text-fuchsia-900" },
] as const;

export type MemberColor = (typeof MEMBER_PALETTE)[number];

/**
 * Colour by rank of member id among all members: stable as members are added
 * (ids only grow) and collision-free while the team is smaller than the palette.
 */
export function memberColorMap(memberIds: number[]): Map<number, MemberColor> {
  const sorted = [...new Set(memberIds)].sort((a, b) => a - b);
  return new Map(sorted.map((id, i) => [id, MEMBER_PALETTE[i % MEMBER_PALETTE.length]]));
}
