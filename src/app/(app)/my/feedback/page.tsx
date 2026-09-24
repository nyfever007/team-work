import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquareHeartIcon, MessageSquareIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { addDays, formatKoDate, formatTime, todayKey } from "@/lib/dates";
import { sharedReviewsFor } from "@/lib/member-reviews/queries";
import { reviewsFor } from "@/lib/reviews/queries";
import { FadeIn } from "@/components/motion";
import { MemberResponse } from "@/components/member-reviews/member-response";
import { RatingBadge, ReviewView } from "@/components/member-reviews/review-view";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "피드백" };

export default async function FeedbackPage() {
  const user = await requireUser();
  if (user.memberId == null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>구성원과 연결되지 않은 계정입니다</CardTitle>
          <CardDescription>
            <Link href="/admin/members" className="underline underline-offset-4">
              구성원 관리
            </Link>
            에서 이 계정을 구성원과 연결하면 팀장 피드백을 볼 수 있습니다.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const today = todayKey();
  const reviews = sharedReviewsFor(user.memberId, 12);
  const comments = reviewsFor([user.memberId], addDays(today, -30), today).reverse();
  const unread = reviews.filter((r) => !r.ackAt).length;

  return (
    <div className="grid gap-6">
      <div>
        <h2 className="text-lg font-bold">팀장 피드백</h2>
        <p className="text-sm text-muted-foreground">
          매주 팀장이 남기는 리뷰입니다. 읽고 ‘확인했어요’를 눌러 주세요. 궁금한 점은 답글로 남길 수 있어요.
          {unread > 0 && <span className="ml-1 font-medium text-accent-foreground">· 새 피드백 {unread}건</span>}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="grid content-start gap-4">
          {reviews.length === 0 && (
            <Card>
              <CardContent className="grid place-items-center gap-2 py-12 text-center">
                <span className="grid size-12 place-items-center rounded-full bg-brand-soft text-brand">
                  <MessageSquareHeartIcon className="size-6" />
                </span>
                <p className="font-medium">아직 받은 주간 리뷰가 없어요</p>
                <p className="text-sm text-muted-foreground">매일 목표와 한 일을 꾸준히 적으면 팀장이 주말에 리뷰를 남겨 줍니다.</p>
              </CardContent>
            </Card>
          )}
          {reviews.map((r, i) => (
            <FadeIn key={r.id} delay={Math.min(i, 5) * 0.05}>
              <Card id={`review-${r.id}`} className={cn(!r.ackAt && "ring-2 ring-brand/40")}>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base font-bold">
                    {formatKoDate(r.weekStart)} ~ {formatKoDate(addDays(r.weekStart, 6))}
                    <RatingBadge rating={r.rating} />
                    {!r.ackAt && <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold text-white">NEW</span>}
                  </CardTitle>
                  <CardDescription>
                    {r.reviewerName} · {formatTime(r.sharedAt ?? r.updatedAt)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <ReviewView review={r} />
                  <div className="border-t pt-3">
                    <MemberResponse reviewId={r.id} acked={!!r.ackAt} reply={r.reply} reviewerName={r.reviewerName} />
                  </div>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </div>

        <aside className="grid content-start gap-3">
          <h3 className="text-sm font-semibold">최근 30일 일일 코멘트</h3>
          {comments.length === 0 && <p className="text-sm text-muted-foreground">아직 없습니다.</p>}
          {comments.map((c) => (
            <Link key={c.id} href={`/my/history?week=${c.date}`} className="rounded-xl border bg-card p-3 text-sm shadow-xs transition-colors hover:border-brand/30">
              <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                <MessageSquareIcon className="size-3" />
                {formatKoDate(c.date)} · {c.reviewerName}
              </div>
              <p className="line-clamp-4 whitespace-pre-wrap">{c.comment}</p>
            </Link>
          ))}
        </aside>
      </div>
    </div>
  );
}
