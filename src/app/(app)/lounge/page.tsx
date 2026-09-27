import type { Metadata } from "next";
import Link from "next/link";
import { BookmarkIcon, FlaskConicalIcon, MessageSquareIcon, PenSquareIcon, PinIcon, SearchIcon, ThumbsUpIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { boardAccess, contributionFor, listPosts, quarterSoFar, seoulKey, type PostListItem } from "@/lib/board/queries";
import { POST_CATEGORIES, POST_CATEGORY_LABEL, type PostCategory } from "@/lib/board/types";
import { allMembers } from "@/lib/members/queries";
import { teamScope } from "@/lib/teams/scope";
import { CategoryBadge, SolvedBadge } from "@/components/board/category-badge";
import { TeamSwitcher } from "@/components/team-picker";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "게시판" };

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function BoardPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const scope = teamScope(user, sp.team);
  const { teamId } = scope;

  if (teamId == null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>팀에 속한 구성원만 게시판을 쓸 수 있습니다</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  const team = scope.teams.find((t) => t.id === teamId);
  const catParam = one(sp.cat);
  const category = POST_CATEGORIES.includes(catParam as PostCategory) ? (catParam as PostCategory) : undefined;
  const q = one(sp.q).trim().slice(0, 100);
  const sort = one(sp.sort) === "helpful" ? "helpful" : "new";
  const saved = one(sp.saved) === "1" && scope.me != null;
  const posts = listPosts(teamId, { category, q, sort, savedBy: saved ? scope.me?.id : undefined });

  const base = { team: scope.isAdmin ? String(teamId) : "", cat: category ?? "", q, sort: sort === "new" ? "" : sort, saved: saved ? "1" : "" };
  const href = (over: Partial<typeof base>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...base, ...over })) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/lounge?${s}` : "/lounge";
  };
  const newHref = `/lounge/new?${new URLSearchParams({ ...(category ? { cat: category } : {}), ...(scope.isAdmin ? { team: String(teamId) } : {}) })}`;

  const lead = boardAccess(user).canLead(teamId);
  const quarter = quarterSoFar();
  const teamMembers = lead ? allMembers().filter((m) => m.teamId === teamId) : [];
  const contribution = lead ? contributionFor(teamMembers.map((m) => m.id), quarter.from, quarter.to) : new Map();
  const ranking = teamMembers
    .map((m) => ({ id: m.id, name: m.name, c: contribution.get(m.id)! }))
    .filter((r) => r.c.points > 0 || r.c.posts > 0)
    .sort((a, b) => b.c.points - a.c.points || b.c.posts - a.c.posts)
    .slice(0, 8);

  const chip = (active: boolean) => cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", active ? "border-brand bg-brand text-white" : "bg-card text-muted-foreground hover:text-foreground");

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold">게시판</h2>
          <span className="text-sm text-muted-foreground">{team?.name}</span>
          {scope.isAdmin && <TeamSwitcher teams={scope.teams} value={teamId} keep={["cat", "sort"]} />}
        </div>
        <Button asChild>
          <Link href={newHref}>
            <PenSquareIcon />
            글쓰기
          </Link>
        </Button>
      </div>

      <div className={cn("grid gap-4", lead && "lg:grid-cols-[minmax(0,1fr)_280px]")}>
        <div className="grid content-start gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link href={href({ cat: "" })} className={chip(!category)}>
              전체
            </Link>
            {POST_CATEGORIES.map((c) => (
              <Link key={c} href={href({ cat: c })} className={chip(category === c)}>
                {POST_CATEGORY_LABEL[c]}
              </Link>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <form action="/lounge" className="relative min-w-48 flex-1">
              {Object.entries(base).map(([k, v]) => (k !== "q" && v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input name="q" defaultValue={q} placeholder="제목·본문·프롬프트 검색" className="pl-8" aria-label="검색" />
            </form>
            <div className="flex items-center rounded-lg border bg-card p-0.5 text-xs">
              <Link href={href({ sort: "" })} className={cn("rounded-md px-2.5 py-1", sort === "new" ? "bg-muted font-semibold" : "text-muted-foreground")}>
                최신순
              </Link>
              <Link href={href({ sort: "helpful" })} className={cn("rounded-md px-2.5 py-1", sort === "helpful" ? "bg-muted font-semibold" : "text-muted-foreground")}>
                도움순
              </Link>
            </div>
            {scope.me && (
              <Link href={href({ saved: saved ? "" : "1" })} className={cn(chip(saved), "inline-flex items-center gap-1")}>
                <BookmarkIcon className="size-3" />
                저장한 글
              </Link>
            )}
          </div>

          {posts.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-card px-4 py-10 text-center text-sm text-muted-foreground">{q || category || saved ? "조건에 맞는 글이 없습니다." : "아직 글이 없습니다."}</div>
          ) : (
            <ul className="grid gap-2">
              {posts.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </ul>
          )}
        </div>

        {lead && (
          <aside className="grid content-start gap-2 rounded-xl border bg-card p-4 shadow-xs">
            <div>
              <h3 className="text-sm font-semibold">공유 기여 (이번 분기)</h3>
              <p className="text-xs text-muted-foreground">{quarter.label} · 팀장만 보입니다</p>
            </div>
            {ranking.length === 0 ? (
              <p className="py-2 text-xs text-muted-foreground">아직 기여가 없습니다.</p>
            ) : (
              <ol className="grid gap-1.5">
                {ranking.map((r, i) => (
                  <li key={r.id} className="grid gap-0.5 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-4 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                      <span className="flex-1 font-medium">{r.name}</span>
                      <span className="font-semibold text-accent-foreground tabular-nums">{r.c.points}점</span>
                    </div>
                    <div className="pl-6 text-[11px] text-muted-foreground tabular-nums">
                      글 {r.c.posts} · 도움 {r.c.helpful} · 저장 {r.c.saved} · 써봄 {r.c.tried} · 채택 {r.c.accepted}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

function excerpt(p: PostListItem) {
  const src = p.body.trim() || p.promptUse || p.prompt;
  return src.replace(/\s+/g, " ").slice(0, 240);
}

function PostCard({ post: p }: { post: PostListItem }) {
  return (
    <li>
      <Link href={`/lounge/${p.id}`} className={cn("grid gap-1.5 rounded-xl border bg-card px-4 py-3 shadow-xs transition-colors hover:border-brand/40", p.pinned && "border-brand/30 bg-brand-soft/20")}>
        <div className="flex flex-wrap items-center gap-2">
          {p.pinned && <PinIcon className="size-3.5 text-accent-foreground" aria-label="고정됨" />}
          <CategoryBadge category={p.category} />
          {p.category === "question" && <SolvedBadge solved={p.acceptedCommentId != null} />}
          <span className="min-w-0 flex-1 truncate font-semibold">{p.title}</span>
        </div>
        {excerpt(p) && <p className="line-clamp-2 text-sm text-muted-foreground">{excerpt(p)}</p>}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{p.authorName}</span>
          <span className="tabular-nums">{seoulKey(p.createdAt)}</span>
          <span className="ml-auto flex items-center gap-3 tabular-nums">
            <span className="inline-flex items-center gap-1" title="도움됐어요">
              <ThumbsUpIcon className="size-3" />
              {p.counts.helpful}
            </span>
            {p.category === "prompt" && (
              <span className="inline-flex items-center gap-1" title="써봤어요">
                <FlaskConicalIcon className="size-3" />
                {p.counts.tried}
              </span>
            )}
            <span className="inline-flex items-center gap-1" title="댓글">
              <MessageSquareIcon className="size-3" />
              {p.comments}
            </span>
          </span>
        </div>
      </Link>
    </li>
  );
}
