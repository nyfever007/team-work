"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { isValidKey, todayKey } from "@/lib/dates";
import { db, schema } from "@/lib/db";
import { boardAccess, commentById, postById } from "./queries";
import { DECISION_STATUSES, POST_CATEGORIES, REACTION_KINDS, type DecisionStatus, type PostCategory, type ReactionKind } from "./types";

export type BoardResult = { ok: true; message: string } | { ok: false; error: string };
export type PostFormState = { ok: true; message: string; id: number } | { ok: false; error: string; values?: Record<string, string> } | undefined;

const fail = (e: unknown, fallback: string): { ok: false; error: string } => ({ ok: false, error: e instanceof Error && e.message ? e.message : fallback });

function revalidate() {
  revalidatePath("/lounge", "layout");
}

function loadPost(id: number) {
  const post = postById(Number(id));
  if (!post) throw new Error("글을 찾을 수 없습니다.");
  return post;
}

const text = (fd: FormData, k: string) => String(fd.get(k) ?? "").replace(/\r\n/g, "\n");

function isHttpUrl(s: string) {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Create (no `id`) or edit (author only) a post. */
export async function savePost(_prev: PostFormState, fd: FormData): Promise<PostFormState> {
  const raw = {
    id: text(fd, "id"),
    teamId: text(fd, "teamId"),
    category: text(fd, "category"),
    title: text(fd, "title").replace(/\s+/g, " ").trim(),
    body: text(fd, "body").trim(),
    link: text(fd, "link").trim(),
    prompt: text(fd, "prompt").trim(),
    promptUse: text(fd, "promptUse").trim(),
    promptModel: text(fd, "promptModel").trim(),
    decidedAt: text(fd, "decidedAt"),
    decisionStatus: text(fd, "decisionStatus"),
  };
  const bad = (error: string): PostFormState => ({ ok: false, error, values: raw });
  try {
    const user = await requireUser();
    const access = boardAccess(user);

    const category = raw.category as PostCategory;
    if (!POST_CATEGORIES.includes(category)) return bad("분류를 선택하세요.");
    if (!raw.title) return bad("제목을 입력하세요.");
    if (raw.title.length > 120) return bad("제목은 120자 이내로 입력하세요.");
    if (raw.body.length > 10000) return bad("본문은 10000자 이내로 입력하세요.");
    if (raw.link && (raw.link.length > 500 || !isHttpUrl(raw.link))) return bad("링크는 http:// 또는 https:// 주소로 입력하세요.");

    const isPrompt = category === "prompt";
    if (isPrompt && !raw.prompt) return bad("프롬프트를 입력하세요.");
    if (raw.prompt.length > 10000) return bad("프롬프트는 10000자 이내로 입력하세요.");
    if (raw.promptUse.length > 200 || raw.promptModel.length > 100) return bad("용도·모델은 짧게 입력하세요.");

    const isDecision = category === "decision";
    const decidedAt = isDecision ? raw.decidedAt || todayKey() : null;
    if (decidedAt && !isValidKey(decidedAt)) return bad("결정일이 올바르지 않습니다.");
    const decisionStatus: DecisionStatus | null = isDecision ? (DECISION_STATUSES.includes(raw.decisionStatus as DecisionStatus) ? (raw.decisionStatus as DecisionStatus) : "active") : null;
    if (!isPrompt && !isDecision && !raw.body) return bad("본문을 입력하세요.");

    const values = {
      category,
      title: raw.title,
      body: raw.body,
      link: raw.link,
      prompt: isPrompt ? raw.prompt : "",
      promptUse: isPrompt ? raw.promptUse : "",
      promptModel: isPrompt ? raw.promptModel : "",
      decidedAt,
      decisionStatus,
    };

    if (raw.id) {
      const post = loadPost(Number(raw.id));
      if (!access.canEdit(post)) return bad("작성자만 수정할 수 있습니다.");
      db.update(schema.posts)
        .set({ ...values, ...(category !== "question" ? { acceptedCommentId: null } : {}), updatedAt: new Date() })
        .where(eq(schema.posts.id, post.id))
        .run();
      revalidate();
      return { ok: true, message: "글을 수정했습니다.", id: post.id };
    }

    const teamId = Number(raw.teamId);
    if (!teamId || !access.canWrite(teamId)) return bad("이 팀 게시판에 글을 쓸 권한이 없습니다.");
    const me = access.me;
    const authorMemberId = me && me.teamId === teamId ? me.id : null;
    const r = db
      .insert(schema.posts)
      .values({ teamId, ...values, authorUserId: user.id, authorMemberId, authorName: authorMemberId != null && me ? me.name : user.name })
      .returning({ id: schema.posts.id })
      .get();
    revalidate();
    return { ok: true, message: "글을 올렸습니다.", id: r.id };
  } catch (e) {
    return fail(e, "저장에 실패했습니다.");
  }
}

/** Author, or the team's leader/admin. */
export async function deletePost(id: number): Promise<BoardResult> {
  try {
    const user = await requireUser();
    const post = loadPost(id);
    if (!boardAccess(user).canDelete(post)) return { ok: false, error: "삭제할 권한이 없습니다." };
    db.delete(schema.posts).where(eq(schema.posts.id, post.id)).run();
    revalidate();
    return { ok: true, message: "글을 삭제했습니다." };
  } catch (e) {
    return fail(e, "삭제에 실패했습니다.");
  }
}

export async function togglePin(id: number): Promise<BoardResult> {
  try {
    const user = await requireUser();
    const post = loadPost(id);
    if (!boardAccess(user).canPin(post)) return { ok: false, error: "팀장만 고정할 수 있습니다." };
    db.update(schema.posts).set({ pinned: !post.pinned }).where(eq(schema.posts.id, post.id)).run();
    revalidate();
    return { ok: true, message: post.pinned ? "고정을 해제했습니다." : "상단에 고정했습니다." };
  } catch (e) {
    return fail(e, "처리에 실패했습니다.");
  }
}

/** 도움됐어요 / 저장 / 써봤어요 (prompt posts only). Members only, not on their own post. */
export async function toggleReaction(postId: number, kind: ReactionKind): Promise<BoardResult> {
  try {
    const user = await requireUser();
    const access = boardAccess(user);
    const post = loadPost(postId);
    if (!REACTION_KINDS.includes(kind)) return { ok: false, error: "잘못된 요청입니다." };
    if (kind === "tried" && post.category !== "prompt") return { ok: false, error: "프롬프트 글에만 쓸 수 있습니다." };
    if (!access.me) return { ok: false, error: "구성원과 연결된 계정만 반응할 수 있습니다." };
    if (!access.canReact(post)) return { ok: false, error: access.isAuthor(post) ? "내 글에는 반응할 수 없습니다." : "권한이 없습니다." };
    const R = schema.postReactions;
    const where = and(eq(R.postId, post.id), eq(R.memberId, access.me.id), eq(R.kind, kind));
    const existing = db.select({ id: R.id }).from(R).where(where).get();
    if (existing) db.delete(R).where(eq(R.id, existing.id)).run();
    else db.insert(R).values({ postId: post.id, memberId: access.me.id, kind }).onConflictDoNothing().run();
    revalidate();
    return { ok: true, message: existing ? "취소했습니다." : kind === "saved" ? "저장했습니다." : "반영했습니다." };
  } catch (e) {
    return fail(e, "처리에 실패했습니다.");
  }
}

export async function addComment(postId: number, body: string): Promise<BoardResult> {
  try {
    const user = await requireUser();
    const access = boardAccess(user);
    const post = loadPost(postId);
    if (!access.canComment(post)) return { ok: false, error: "권한이 없습니다." };
    const v = String(body ?? "").replace(/\r\n/g, "\n").trim();
    if (!v) return { ok: false, error: "댓글을 입력하세요." };
    if (v.length > 2000) return { ok: false, error: "댓글은 2000자 이내로 입력하세요." };
    const me = access.me && access.me.teamId === post.teamId ? access.me : undefined;
    db.insert(schema.postComments)
      .values({ postId: post.id, body: v, authorUserId: user.id, authorMemberId: me?.id ?? null, authorName: me?.name ?? user.name })
      .run();
    revalidate();
    return { ok: true, message: "댓글을 남겼습니다." };
  } catch (e) {
    return fail(e, "저장에 실패했습니다.");
  }
}

/** Own comment, or the team's leader/admin. Clears the accepted answer if it was this one. */
export async function deleteComment(id: number): Promise<BoardResult> {
  try {
    const user = await requireUser();
    const c = commentById(Number(id));
    if (!c) return { ok: false, error: "댓글을 찾을 수 없습니다." };
    const post = loadPost(c.postId);
    if (!boardAccess(user).canDeleteComment(post, c)) return { ok: false, error: "삭제할 권한이 없습니다." };
    db.transaction((tx) => {
      if (post.acceptedCommentId === c.id) tx.update(schema.posts).set({ acceptedCommentId: null }).where(eq(schema.posts.id, post.id)).run();
      tx.delete(schema.postComments).where(eq(schema.postComments.id, c.id)).run();
    });
    revalidate();
    return { ok: true, message: "댓글을 삭제했습니다." };
  } catch (e) {
    return fail(e, "삭제에 실패했습니다.");
  }
}

/** 질문 채택: the post author or the team leader/admin; never the post author's own comment. `commentId` null clears it. */
export async function acceptComment(postId: number, commentId: number | null): Promise<BoardResult> {
  try {
    const user = await requireUser();
    const access = boardAccess(user);
    const post = loadPost(postId);
    if (post.category !== "question") return { ok: false, error: "질문 글에서만 채택할 수 있습니다." };
    if (!access.canAccept(post)) return { ok: false, error: "작성자나 팀장만 채택할 수 있습니다." };
    if (commentId != null) {
      const c = commentById(Number(commentId));
      if (!c || c.postId !== post.id) return { ok: false, error: "댓글을 찾을 수 없습니다." };
      const byAuthor = (post.authorUserId != null && c.authorUserId === post.authorUserId) || (post.authorMemberId != null && c.authorMemberId === post.authorMemberId);
      if (byAuthor) return { ok: false, error: "질문 작성자의 댓글은 채택할 수 없습니다." };
    }
    db.update(schema.posts)
      .set({ acceptedCommentId: commentId == null ? null : Number(commentId) })
      .where(eq(schema.posts.id, post.id))
      .run();
    revalidate();
    return { ok: true, message: commentId == null ? "채택을 취소했습니다." : "답변을 채택했습니다." };
  } catch (e) {
    return fail(e, "처리에 실패했습니다.");
  }
}

/** 결정 기록 상태 (유효/변경됨): author or the team leader/admin. */
export async function setDecisionStatus(postId: number, status: DecisionStatus): Promise<BoardResult> {
  try {
    const user = await requireUser();
    const post = loadPost(postId);
    if (!DECISION_STATUSES.includes(status)) return { ok: false, error: "잘못된 상태입니다." };
    if (!boardAccess(user).canSetStatus(post)) return { ok: false, error: "작성자나 팀장만 바꿀 수 있습니다." };
    db.update(schema.posts).set({ decisionStatus: status, updatedAt: new Date() }).where(eq(schema.posts.id, post.id)).run();
    revalidate();
    return { ok: true, message: "상태를 바꿨습니다." };
  } catch (e) {
    return fail(e, "처리에 실패했습니다.");
  }
}
