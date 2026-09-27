"use client";

import { useState, useTransition } from "react";
import { Loader2Icon, PencilIcon, PlusIcon, ThumbsUpIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { addRetroItem, deleteRetroItem, setTryOwner, toggleRetroVote, updateRetroItem } from "@/lib/retro/actions";
import type { RetroItemView } from "@/lib/retro/queries";
import { RETRO_KINDS, RETRO_KIND_CLASS, RETRO_KIND_LABEL, type RetroKind } from "@/lib/retro/types";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { TryDoneButton } from "./try-done-button";

type Result = { ok: true; message: string } | { ok: false; error: string };

type Props = {
  retroId: number;
  items: RetroItemView[];
  members: { id: number; name: string }[];
  myMemberId: number | null;
  canWrite: boolean;
  canLead: boolean;
  open: boolean;
};

const MAX = 500;

export function RetroBoard({ retroId, items, members, myMemberId, canWrite, canLead, open }: Props) {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<Result>, after?: () => void, quiet = false) =>
    start(async () => {
      try {
        const r = await fn();
        if (r.ok) {
          if (!quiet) toast.success(r.message);
          after?.();
        } else toast.error(r.error);
      } catch {
        toast.error("요청에 실패했습니다.");
      }
    });

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {RETRO_KINDS.map((kind) => {
        const list = items.filter((i) => i.kind === kind);
        return (
          <section key={kind} className={cn("grid content-start gap-2 rounded-xl border p-3", RETRO_KIND_CLASS[kind])}>
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              {RETRO_KIND_LABEL[kind]}
              <span className="text-xs font-normal text-muted-foreground tabular-nums">{list.length}</span>
            </h3>
            <ul className="grid gap-2">
              {list.map((item) => (
                <ItemCard key={item.id} item={item} members={members} myMemberId={myMemberId} canWrite={canWrite} canLead={canLead} open={open} pending={pending} run={run} />
              ))}
            </ul>
            {list.length === 0 && <p className="text-xs text-muted-foreground">아직 없습니다.</p>}
            {canWrite && <AddItem retroId={retroId} kind={kind} pending={pending} run={run} />}
          </section>
        );
      })}
    </div>
  );
}

function ItemCard({
  item,
  members,
  myMemberId,
  canWrite,
  canLead,
  open,
  pending,
  run,
}: {
  item: RetroItemView;
  members: { id: number; name: string }[];
  myMemberId: number | null;
  canWrite: boolean;
  canLead: boolean;
  open: boolean;
  pending: boolean;
  run: (fn: () => Promise<Result>, after?: () => void, quiet?: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(item.body);
  const canEdit = open && item.mine;
  const canDelete = canLead || (open && item.mine);
  const isTry = item.kind === "try";
  const canToggleDone = isTry && (canLead || (myMemberId != null && item.ownerMemberId === myMemberId));

  return (
    <li className="grid gap-2 rounded-lg bg-white p-2.5 shadow-sm ring-1 ring-foreground/5">
      {editing ? (
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => updateRetroItem(item.id, body), () => setEditing(false));
          }}
        >
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={MAX} rows={3} autoFocus />
          <div className="flex justify-end gap-1.5">
            <Button type="button" size="xs" variant="ghost" onClick={() => (setEditing(false), setBody(item.body))} disabled={pending}>
              취소
            </Button>
            <Button type="submit" size="xs" disabled={pending || !body.trim()}>
              저장
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex items-start gap-2">
          {isTry && <TryDoneButton itemId={item.id} done={item.done} disabled={!canToggleDone} label={item.body.slice(0, 20)} />}
          <p className={cn("min-w-0 flex-1 text-sm break-words whitespace-pre-wrap", item.done && "text-muted-foreground line-through decoration-muted-foreground/40")}>{item.body}</p>
        </div>
      )}
      {!editing && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <button
            type="button"
            aria-pressed={item.voted}
            aria-label={item.voted ? "투표 취소" : "투표"}
            disabled={!canWrite || pending}
            onClick={() => run(() => toggleRetroVote(item.id), undefined, true)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 tabular-nums transition-colors disabled:cursor-default",
              item.voted ? "border-brand/40 bg-brand-soft font-semibold text-brand" : "border-transparent bg-muted/60 enabled:hover:border-brand/30",
            )}
          >
            <ThumbsUpIcon className="size-3" />
            {item.votes}
          </button>
          {item.author && <span>{item.author}</span>}
          {item.mine && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">내 항목</span>}
          {isTry &&
            (canLead ? (
              <NativeSelect
                size="sm"
                aria-label="담당자"
                value={item.ownerMemberId ?? ""}
                disabled={pending}
                onChange={(e) => run(() => setTryOwner(item.id, e.target.value ? Number(e.target.value) : null))}
              >
                <NativeSelectOption value="">담당자 없음</NativeSelectOption>
                {members.map((m) => (
                  <NativeSelectOption key={m.id} value={m.id}>
                    {m.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            ) : (
              <span>담당 {item.ownerName ?? "미정"}</span>
            ))}
          {(canEdit || canDelete) && (
            <span className="ml-auto flex gap-0.5">
              {canEdit && (
                <Button size="icon-xs" variant="ghost" aria-label="수정" disabled={pending} onClick={() => setEditing(true)}>
                  <PencilIcon />
                </Button>
              )}
              {canDelete && (
                <Button size="icon-xs" variant="ghost" aria-label="삭제" disabled={pending} onClick={() => run(() => deleteRetroItem(item.id))}>
                  <Trash2Icon />
                </Button>
              )}
            </span>
          )}
        </div>
      )}
    </li>
  );
}

function AddItem({ retroId, kind, pending, run }: { retroId: number; kind: RetroKind; pending: boolean; run: (fn: () => Promise<Result>, after?: () => void) => void }) {
  const [body, setBody] = useState("");
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <Button size="sm" variant="ghost" className="w-fit bg-white/60" onClick={() => setOpen(true)}>
        <PlusIcon />
        추가
      </Button>
    );
  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => addRetroItem(retroId, kind, body), () => setBody(""));
      }}
    >
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={MAX}
        rows={2}
        autoFocus
        className="bg-white"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
        }}
      />
      <div className="flex items-center justify-end gap-1.5">
        <span className="mr-auto text-[11px] text-muted-foreground tabular-nums">
          {body.length}/{MAX}
        </span>
        <Button type="button" size="xs" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          닫기
        </Button>
        <Button type="submit" size="xs" disabled={pending || !body.trim()}>
          {pending && <Loader2Icon className="animate-spin" />}
          추가
        </Button>
      </div>
    </form>
  );
}
