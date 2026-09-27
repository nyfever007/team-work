import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { todayKey } from "@/lib/dates";
import { DECISION_TEMPLATE, POST_CATEGORIES, type PostCategory } from "@/lib/board/types";
import { teamScope } from "@/lib/teams/scope";
import { PostForm } from "@/components/board/post-form";
import { TeamSwitcher } from "@/components/team-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "글쓰기" };

type SP = Record<string, string | string[] | undefined>;

export default async function NewPostPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const scope = teamScope(user, sp.team);
  const { teamId } = scope;
  if (teamId == null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>팀에 속한 구성원만 글을 쓸 수 있습니다</CardTitle>
        </CardHeader>
      </Card>
    );
  }
  const cat = String(Array.isArray(sp.cat) ? sp.cat[0] : (sp.cat ?? ""));
  const category: PostCategory = POST_CATEGORIES.includes(cat as PostCategory) ? (cat as PostCategory) : "tip";
  const team = scope.teams.find((t) => t.id === teamId);
  const back = category === "decision" ? "/lounge/decisions" : "/lounge";
  const backHref = scope.isAdmin ? `${back}?team=${teamId}` : back;

  return (
    <div className="grid gap-4">
      <Link href={backHref} className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" />
        {category === "decision" ? "결정 기록" : "게시판"}
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-bold">{category === "decision" ? "결정 기록 추가" : "글쓰기"}</h2>
        <span className="text-sm text-muted-foreground">{team?.name}</span>
        {scope.isAdmin && <TeamSwitcher teams={scope.teams} value={teamId} keep={["cat"]} />}
      </div>
      <Card>
        <CardContent className="pt-6">
          <PostForm
            key={`${teamId}-${category}`}
            teamId={teamId}
            cancelHref={backHref}
            initial={{
              category,
              title: "",
              body: category === "decision" ? DECISION_TEMPLATE : "",
              link: "",
              prompt: "",
              promptUse: "",
              promptModel: "",
              decidedAt: todayKey(),
              decisionStatus: "active",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
