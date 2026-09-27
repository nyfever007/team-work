"use client";

import { useState, useTransition } from "react";
import { Loader2Icon, PencilIcon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";
import { draftRetroSummary, saveRetroSummary } from "@/lib/retro/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Props = { retroId: number; summary: string; canLead: boolean; aiEnabled: boolean; hasItems: boolean };

/** Saved summary for everyone; the leader edits it, optionally from an AI draft (never auto-saved). */
export function RetroSummary({ retroId, summary, canLead, aiEnabled, hasItems }: Props) {
  const [editing, setEditing] = useState(false);
  if (!canLead && !summary) return null;
  return (
    <section className="grid gap-2 rounded-xl bg-card p-4 shadow-sm ring-1 ring-foreground/10">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">회고 요약</h3>
        {canLead && !editing && (
          <Button size="xs" variant="ghost" className="ml-auto" onClick={() => setEditing(true)}>
            <PencilIcon />
            {summary ? "수정" : "작성"}
          </Button>
        )}
      </div>
      {editing ? (
        <SummaryEditor retroId={retroId} initial={summary} aiEnabled={aiEnabled} hasItems={hasItems} onDone={() => setEditing(false)} />
      ) : summary ? (
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{summary}</p>
      ) : (
        <p className="text-xs text-muted-foreground">아직 요약이 없습니다.</p>
      )}
    </section>
  );
}

function SummaryEditor({ retroId, initial, aiEnabled, hasItems, onDone }: { retroId: number; initial: string; aiEnabled: boolean; hasItems: boolean; onDone: () => void }) {
  const [text, setText] = useState(initial);
  const [model, setModel] = useState<string | null>(null);
  const [drafting, startDraft] = useTransition();
  const [saving, startSave] = useTransition();
  const busy = drafting || saving;

  return (
    <div className="grid gap-2">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} maxLength={5000} placeholder="잘한 점, 문제점, 다음에 시도할 것" />
      <div className="flex flex-wrap items-center gap-1.5">
        {aiEnabled && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !hasItems}
            onClick={() =>
              startDraft(async () => {
                try {
                  const r = await draftRetroSummary(retroId);
                  if (r.ok) {
                    setText(r.summary);
                    setModel(r.model);
                    toast.success("AI 초안을 넣었습니다. 확인 후 저장하세요.");
                  } else toast.error(r.error);
                } catch {
                  toast.error("AI 요약에 실패했습니다.");
                }
              })
            }
          >
            {drafting ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
            AI 요약
          </Button>
        )}
        <Button size="sm" variant="ghost" className="ml-auto" onClick={onDone} disabled={busy}>
          취소
        </Button>
        <Button
          size="sm"
          disabled={busy}
          onClick={() =>
            startSave(async () => {
              try {
                const r = await saveRetroSummary(retroId, text, model);
                if (r.ok) {
                  toast.success(r.message);
                  onDone();
                } else toast.error(r.error);
              } catch {
                toast.error("저장에 실패했습니다.");
              }
            })
          }
        >
          {saving && <Loader2Icon className="animate-spin" />}
          저장
        </Button>
      </div>
    </div>
  );
}
