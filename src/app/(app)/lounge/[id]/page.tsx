import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ExternalLinkIcon, PencilIcon, PinIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { formatKoDate, formatTime } from "@/lib/dates";
import { boardAccess, commentsOf, myReactions, postById, reactionCounts, seoulKey } from "@/lib/board/queries";
import type { ReactionKind } from "@/lib/board/types";
import { teamById } from "@/lib/members/queries";
import { CategoryBadge, SolvedBadge } from "@/components/board/category-badge";
import { Comments } from "@/components/board/comments";
import { DecisionStatusBadge } from "@/components/board/decision-status";
import { CopyButton, DeletePostButton, PinButton, ReactionBar } from "@/components/board/post-controls";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "게시판" };

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const post = postById(Number(id));
  const access = boardAccess(user);
  if (!post || !access.canRead(post.teamId)) notFound();

  const listHref = access.isAdmin ? `/lounge?team=${post.teamId}` : "/lounge";
  const isPrompt = post.category === "prompt";
  const isQuestion = post.category === "question";
  const kinds: ReactionKind[] = isPrompt ? ["helpful", "tried", "saved"] : ["helpful", "saved"];
  const counts = reactionCounts(post.id);
  const mine = myReactions(post.id, access.me?.id);
  const disabledReason = !access.me ? "구성원 계정만 반응할 수 있습니다" : access.isAuthor(post) ? "내 글" : undefined;
  const byPostAuthor = (c: { authorUserId: number | null; authorMemberId: number | null }) =>
    (post.authorUserId != null && c.authorUserId === post.authorUserId) || (post.authorMemberId != null && c.authorMemberId === post.authorMemberId);
  const comments = commentsOf(post.id).map((c) => ({
    id: c.id,
    body: c.body,
    authorName: c.authorName,
    time: formatTime(c.createdAt) ?? "",
    canDelete: access.canDeleteComment(post, c),
    byPostAuthor: byPostAuthor(c),
  }));
  const edited = post.updatedAt.getTime() - post.createdAt.getTime() > 60_000;

  return (
    <div className="grid gap-4">
      <Link href={listHref} className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" />
        게시판{access.isAdmin && ` · ${teamById(post.teamId)?.name ?? ""}`}
      </Link>

      <Card>
        <CardContent className="grid gap-5 pt-6">
          <div className="grid gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {post.pinned && <PinIcon className="size-3.5 text-accent-foreground" aria-label="고정됨" />}
              <CategoryBadge category={post.category} />
              {isQuestion && <SolvedBadge solved={post.acceptedCommentId != null} />}
              {post.category === "decision" && post.decisionStatus && <DecisionStatusBadge postId={post.id} status={post.decisionStatus} editable={access.canSetStatus(post)} />}
            </div>
            <h2 className="text-xl font-bold break-words">{post.title}</h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{post.authorName}</span>
              <span className="tabular-nums">
                {seoulKey(post.createdAt)}
                {edited && " (수정됨)"}
              </span>
              {post.decidedAt && <span>결정일 {formatKoDate(post.decidedAt)}</span>}
            </div>
          </div>

          {isPrompt && (
            <div className="grid gap-2 rounded-xl border bg-muted/40 p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">프롬프트</span>
                {post.promptUse && <span>용도 · {post.promptUse}</span>}
                {post.promptModel && <span>모델 · {post.promptModel}</span>}
                <span className="ml-auto">
                  <CopyButton text={post.prompt} />
                </span>
              </div>
              <pre className="max-h-[480px] overflow-auto font-mono text-[13px] leading-relaxed whitespace-pre-wrap break-words">{post.prompt}</pre>
            </div>
          )}

          {post.body && <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">{post.body}</div>}

          {post.link && (
            <a href={post.link} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit max-w-full items-center gap-1 text-sm text-accent-foreground underline-offset-4 hover:underline">
              <ExternalLinkIcon className="size-3.5 shrink-0" />
              <span className="truncate">{post.link}</span>
            </a>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
            <ReactionBar postId={post.id} kinds={kinds} counts={counts} mine={mine} disabledReason={disabledReason} />
            <div className="flex flex-wrap items-center gap-1.5">
              {access.canPin(post) && <PinButton postId={post.id} pinned={post.pinned} />}
              {access.canEdit(post) && (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/lounge/${post.id}/edit`}>
                    <PencilIcon />
                    수정
                  </Link>
                </Button>
              )}
              {access.canDelete(post) && <DeletePostButton postId={post.id} title={post.title} redirectTo={post.category === "decision" ? listHref.replace("/lounge", "/lounge/decisions") : listHref} />}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Comments postId={post.id} comments={comments} isQuestion={isQuestion} acceptedId={post.acceptedCommentId} canAccept={access.canAccept(post)} canComment={access.canComment(post)} />
        </CardContent>
      </Card>
    </div>
  );
}
