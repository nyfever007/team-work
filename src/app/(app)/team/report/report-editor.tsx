"use client";

import { useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import { CheckCircle2Icon, ClipboardCopyIcon, EyeIcon, Loader2Icon, PencilIcon, RefreshCwIcon, SparklesIcon, UndoIcon } from "lucide-react";
import { toast } from "sonner";
import type { ReportStatus } from "@/lib/db/schema";
import { generateTeamReport, saveTeamReport } from "@/lib/reports/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Meta = { model: string | null; generatedAt: number | null; updatedAt: number; updatedByName: string | null } | null;

type Props = {
  teamId: number;
  teamName: string;
  weekStart: string;
  period: string;
  initialContent: string;
  initialStatus: ReportStatus;
  meta: Meta;
  canEdit: boolean;
  aiReady: boolean;
  model: string;
  sourceText: string;
  recordCount: number;
};

function fmt(ts: number | null) {
  if (!ts) return null;
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ts));
}

export function ReportEditor(props: Props) {
  const { teamId, teamName, weekStart, period, canEdit, aiReady, model, sourceText, recordCount } = props;
  const [content, setContent] = useState(props.initialContent);
  const [saved, setSaved] = useState(props.initialContent);
  const [status, setStatus] = useState<ReportStatus>(props.initialStatus);
  const [meta, setMeta] = useState<Meta>(props.meta);
  const [instructions, setInstructions] = useState("");
  const [mode, setMode] = useState<"edit" | "preview">(canEdit ? (props.initialContent ? "preview" : "edit") : "preview");
  const [showSource, setShowSource] = useState(false);
  const [generating, startGenerate] = useTransition();
  const [saving, startSave] = useTransition();
  const dirty = content !== saved;

  const generate = () =>
    startGenerate(async () => {
      try {
        const r = await generateTeamReport(teamId, weekStart, instructions);
        if (!r.ok) {
          toast.error(r.error);
          return;
        }
        setContent(r.content);
        setSaved(r.content);
        setStatus("draft");
        setMeta((m) => ({ model: r.model ?? null, generatedAt: Date.now(), updatedAt: Date.now(), updatedByName: m?.updatedByName ?? null }));
        setMode("preview");
        toast.success(r.message);
      } catch {
        toast.error("보고서 생성에 실패했습니다.");
      }
    });

  const save = (next: ReportStatus) =>
    startSave(async () => {
      try {
        const r = await saveTeamReport(teamId, weekStart, content, next);
        if (!r.ok) {
          toast.error(r.error);
          return;
        }
        setSaved(r.content);
        setContent(r.content);
        setStatus(next);
        setMeta((m) => ({ model: m?.model ?? null, generatedAt: m?.generatedAt ?? null, updatedAt: Date.now(), updatedByName: m?.updatedByName ?? null }));
        toast.success(r.message);
      } catch {
        toast.error("저장에 실패했습니다.");
      }
    });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success("마크다운을 복사했습니다.");
    } catch {
      toast.error("복사에 실패했습니다.");
    }
  };

  const busy = generating || saving;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="min-w-0">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">{teamName} 주간 보고서</CardTitle>
            <Badge className={status === "final" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-800"}>{status === "final" ? "확정" : "초안"}</Badge>
            {dirty && <Badge variant="outline" className="text-amber-700">저장되지 않음</Badge>}
            <div className="ml-auto flex items-center gap-1">
              {canEdit && (
                <Button variant={mode === "edit" ? "secondary" : "ghost"} size="sm" onClick={() => setMode("edit")} aria-pressed={mode === "edit"}>
                  <PencilIcon className="size-3.5" />
                  편집
                </Button>
              )}
              <Button variant={mode === "preview" ? "secondary" : "ghost"} size="sm" onClick={() => setMode("preview")} aria-pressed={mode === "preview"}>
                <EyeIcon className="size-3.5" />
                미리보기
              </Button>
              <Button variant="ghost" size="sm" onClick={copy} disabled={!content.trim()}>
                <ClipboardCopyIcon className="size-3.5" />
                복사
              </Button>
            </div>
          </div>
          <CardDescription>
            {period}
            {meta?.generatedAt && ` · AI 초안 ${fmt(meta.generatedAt)}${meta.model ? ` (${meta.model})` : ""}`}
            {meta?.updatedAt && ` · 마지막 저장 ${fmt(meta.updatedAt)}${meta.updatedByName ? ` ${meta.updatedByName}` : ""}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {mode === "edit" && canEdit ? (
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={26} className="font-mono text-sm leading-relaxed" placeholder={"오른쪽에서 ‘AI 초안 생성’을 누르거나 직접 작성하세요.\n\n# 팀 주간 보고서\n## 요약\n- "} aria-label="보고서 본문" disabled={busy} />
          ) : content.trim() ? (
            <article className="prose prose-sm max-w-none prose-headings:mt-5 prose-headings:mb-2 prose-h1:text-xl prose-h2:text-base prose-li:my-0.5 prose-p:my-1">
              <ReactMarkdown>{content}</ReactMarkdown>
            </article>
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">아직 보고서가 없습니다.{canEdit && " 오른쪽에서 AI 초안을 만들거나 ‘편집’으로 직접 작성하세요."}</p>
          )}
          {canEdit && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setContent(saved)} disabled={!dirty || busy}>
                  <UndoIcon className="size-3.5" />
                  되돌리기
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => save("draft")} disabled={busy || (!dirty && status === "draft")}>
                  {saving && <Loader2Icon className="size-3.5 animate-spin" />}
                  초안 저장
                </Button>
                {status === "final" ? (
                  <Button size="sm" variant="secondary" onClick={() => save("draft")} disabled={busy}>확정 해제</Button>
                ) : (
                  <Button size="sm" onClick={() => save("final")} disabled={busy || !content.trim()}>
                    <CheckCircle2Icon className="size-3.5" />
                    확정
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 self-start">
        {canEdit && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><SparklesIcon className="size-4" />AI 초안</CardTitle>
              <CardDescription>
                구성원들이 기록한 이번 주 항목·한 일·성과 {recordCount}건과 마일스톤 현황을 바탕으로 초안을 만듭니다.{aiReady ? ` 모델: ${model}` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {!aiReady && <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">OPENAI_API_KEY가 설정되지 않았습니다. .env에 키를 넣고 서버를 재시작하면 사용할 수 있습니다.</p>}
              <Input value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="추가 지시 (선택) 예: 경영진 보고용으로 짧게" maxLength={300} disabled={!aiReady || busy} aria-label="AI 추가 지시" />
              {content.trim() ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button disabled={!aiReady || busy || recordCount === 0} className="w-full">
                      {generating ? <Loader2Icon className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
                      다시 생성
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>현재 내용을 새 초안으로 바꿀까요?</AlertDialogTitle>
                      <AlertDialogDescription>지금 작성된 보고서 내용은 사라지고 AI가 만든 새 초안으로 대체됩니다. 필요하면 먼저 ‘복사’로 보관하세요.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>취소</AlertDialogCancel>
                      <AlertDialogAction onClick={generate}>새 초안 생성</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <Button onClick={generate} disabled={!aiReady || busy || recordCount === 0} className="w-full">
                  {generating ? <Loader2Icon className="size-4 animate-spin" /> : <SparklesIcon className="size-4" />}
                  AI 초안 생성
                </Button>
              )}
              {recordCount === 0 && <p className="text-xs text-muted-foreground">이 주에 구성원 기록이 없어 초안을 만들 수 없습니다.</p>}
              {generating && <p className="text-xs text-muted-foreground">보통 10~30초 걸립니다. 이 페이지에 머물러 주세요.</p>}
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">참고 자료</CardTitle>
            <CardDescription>AI에게 전달되는 원본 기록입니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" onClick={() => setShowSource((v) => !v)} aria-expanded={showSource}>
              {showSource ? "접기" : `기록 ${recordCount}건 보기`}
            </Button>
            {showSource && <pre className={cn("mt-2 max-h-[480px] overflow-auto whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-xs leading-relaxed")}>{sourceText}</pre>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
