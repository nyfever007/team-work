import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { todayKey } from "@/lib/dates";
import { boardAccess, postById } from "@/lib/board/queries";
import { PostForm } from "@/components/board/post-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "글 수정" };

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const post = postById(Number(id));
  const access = boardAccess(user);
  if (!post || !access.canRead(post.teamId)) notFound();
  if (!access.canEdit(post)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>작성자만 수정할 수 있습니다</CardTitle>
        </CardHeader>
      </Card>
    );
  }
  return (
    <div className="grid gap-4">
      <Link href={`/lounge/${post.id}`} className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" />
        글로 돌아가기
      </Link>
      <h2 className="text-lg font-bold">글 수정</h2>
      <Card>
        <CardContent className="pt-6">
          <PostForm
            id={post.id}
            teamId={post.teamId}
            cancelHref={`/lounge/${post.id}`}
            initial={{
              category: post.category,
              title: post.title,
              body: post.body,
              link: post.link,
              prompt: post.prompt,
              promptUse: post.promptUse,
              promptModel: post.promptModel,
              decidedAt: post.decidedAt ?? todayKey(),
              decisionStatus: post.decisionStatus ?? "active",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
