"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowDownIcon, ArrowUpIcon, FileTextIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { addOnboardingItem, deleteOnboardingItem, moveOnboardingItem, updateOnboardingItem, type OnboardingItemInput } from "@/lib/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

export type ChecklistItem = { id: number; title: string; description: string; postId: number | null; postTitle: string | null };
type Result = { ok: true; message: string } | { ok: false; error: string };

/** Leader/admin editor for the team checklist: add, edit, delete, reorder. */
export function ChecklistManager({ teamId, items, posts }: { teamId: number; items: ChecklistItem[]; posts: { id: number; title: string }[] }) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  const run = (fn: () => Promise<Result>, after?: () => void) =>
    start(async () => {
      try {
        const r = await fn();
        if (r.ok) {
          toast.success(r.message);
          after?.();
        } else toast.error(r.error);
      } catch {
        toast.error("요청에 실패했습니다.");
      }
    });

  return (
    <div className="grid gap-3">
      {items.length === 0 && !adding && <p className="text-sm text-muted-foreground">등록된 항목이 없습니다.</p>}
      <ol className="grid gap-2">
        {items.map((it, i) => (
          <li key={it.id} className="rounded-lg border px-3 py-2.5">
            {editing === it.id ? (
              <ItemEditor
                posts={posts}
                initial={it}
                pending={pending}
                submitLabel="저장"
                onCancel={() => setEditing(null)}
                onSubmit={(v) => run(() => updateOnboardingItem(it.id, v), () => setEditing(null))}
              />
            ) : (
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-accent-foreground tabular-nums">{i + 1}</span>
                <div className="grid min-w-0 flex-1 gap-1">
                  <span className="text-sm font-medium">{it.title}</span>
                  {it.description && <p className="text-xs whitespace-pre-wrap text-muted-foreground">{it.description}</p>}
                  {it.postId != null && (
                    <Link href={`/lounge/${it.postId}`} className="inline-flex w-fit items-center gap-1 text-xs text-accent-foreground hover:underline">
                      <FileTextIcon className="size-3" />
                      {it.postTitle}
                    </Link>
                  )}
                </div>
                <div className="flex shrink-0 gap-0.5">
                  <Button size="icon-xs" variant="ghost" aria-label="위로" disabled={pending || i === 0} onClick={() => run(() => moveOnboardingItem(it.id, -1))}>
                    <ArrowUpIcon />
                  </Button>
                  <Button size="icon-xs" variant="ghost" aria-label="아래로" disabled={pending || i === items.length - 1} onClick={() => run(() => moveOnboardingItem(it.id, 1))}>
                    <ArrowDownIcon />
                  </Button>
                  <Button size="icon-xs" variant="ghost" aria-label={`${it.title} 수정`} disabled={pending} onClick={() => setEditing(it.id)}>
                    <PencilIcon />
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label={`${it.title} 삭제`}
                    disabled={pending}
                    onClick={() => {
                      if (confirm(`"${it.title}" 항목을 삭제할까요? 체크 기록도 함께 삭제됩니다.`)) run(() => deleteOnboardingItem(it.id));
                    }}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ol>
      {adding ? (
        <div className="rounded-lg border border-dashed p-3">
          <ItemEditor posts={posts} pending={pending} submitLabel="추가" onCancel={() => setAdding(false)} onSubmit={(v) => run(() => addOnboardingItem(teamId, v), () => setAdding(false))} />
        </div>
      ) : (
        <Button variant="outline" size="sm" className="w-fit" onClick={() => setAdding(true)}>
          <PlusIcon />
          항목 추가
        </Button>
      )}
    </div>
  );
}

function ItemEditor({
  posts,
  initial,
  pending,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  posts: { id: number; title: string }[];
  initial?: ChecklistItem;
  pending: boolean;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (v: OnboardingItemInput) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [postId, setPostId] = useState(initial?.postId ? String(initial.postId) : "");
  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ title, description, postId: postId ? Number(postId) : null });
      }}
    >
      <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="항목 제목" aria-label="항목 제목" autoFocus />
      <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} placeholder="설명 (선택)" aria-label="설명" rows={2} />
      <NativeSelect value={postId} onChange={(e) => setPostId(e.target.value)} aria-label="참고 게시글">
        <NativeSelectOption value="">참고 게시글 없음</NativeSelectOption>
        {posts.map((p) => (
          <NativeSelectOption key={p.id} value={p.id}>
            {p.title}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <div className="flex justify-end gap-1.5">
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={pending}>
          취소
        </Button>
        <Button type="submit" size="sm" disabled={pending || !title.trim()}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
