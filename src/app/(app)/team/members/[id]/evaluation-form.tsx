"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2Icon, ClipboardCheckIcon, Loader2Icon, LockIcon, PlusIcon, SaveIcon, SparklesIcon, StarHalfIcon, StarIcon, Undo2Icon } from "lucide-react";
import { toast } from "sonner";
import { generateEvaluationDraft, saveEvaluation } from "@/lib/evaluations/actions";
import { CRITERIA, MAX_SCORE, gradeOf, periodLabel, starsOf, totalScore, type CriterionKey, type EvaluationInput, type EvaluationStatus, type Scores } from "@/lib/evaluations/types";
import type { EvaluationReference } from "@/lib/evaluations/queries";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Props = {
  memberId: number;
  memberName: string;
  period: string;
  initial: EvaluationInput;
  status: EvaluationStatus | null;
  meta: { evaluatorName: string; updatedAt: number; finalizedAt: number | null; aiModel: string | null; aiGeneratedAt: number | null } | null;
  reference: EvaluationReference;
  aiReady: boolean;
  model: string;
};

const SCORES = Array.from({ length: MAX_SCORE }, (_, i) => i + 1);
const fmt = (ts: number | null) => (ts ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ts)) : "");
const same = (a: EvaluationInput, b: EvaluationInput) => JSON.stringify(a) === JSON.stringify(b);
const rate = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

export function EvaluationForm({ memberId, memberName, period, initial, status: initialStatus, meta, reference: r, aiReady, model }: Props) {
  const [value, setValue] = useState<EvaluationInput>(initial);
  const [saved, setSaved] = useState<EvaluationInput>(initial);
  const [status, setStatus] = useState<EvaluationStatus | null>(initialStatus);
  const [pending, start] = useTransition();
  const [generating, startGenerate] = useTransition();
  const [aiModel, setAiModel] = useState<string | null>(null);
  // Scores exactly as the AI suggested them (badge disappears once the leader changes a score).
  const [aiScores, setAiScores] = useState<Scores>({});
  const [instructions, setInstructions] = useState("");
  const [confirmAi, setConfirmAi] = useState(false);
  const [openReasons, setOpenReasons] = useState<Set<string>>(new Set());
  const busy = pending || generating;
  const dirty = !same(value, saved);
  const locked = status === "final" && !dirty;
  const total = totalScore(value.scores);
  const grade = gradeOf(total);
  const scored = CRITERIA.filter((c) => value.scores[c.key] != null).length;

  const setScore = (key: string, v: number) =>
    setValue((p) => {
      const scores = { ...p.scores } as Record<string, number>;
      if (scores[key] === v) delete scores[key];
      else scores[key] = v;
      return { ...p, scores };
    });

  const generate = () =>
    startGenerate(async () => {
      try {
        const res = await generateEvaluationDraft(memberId, period, instructions);
        if (!res.ok) return void toast.error(res.error);
        setValue(res.draft);
        setAiScores(res.draft.scores);
        setAiModel(res.model);
        toast.success("AI가 항목별 점수와 근거를 채웠습니다. 검토하고 조정한 뒤 저장하세요.");
      } catch {
        toast.error("AI 채점에 실패했습니다.");
      }
    });

  const setReason = (key: CriterionKey, text: string) => setValue((p) => ({ ...p, reasons: { ...p.reasons, [key]: text } }));

  const save = (next: EvaluationStatus) =>
    start(async () => {
      try {
        const res = await saveEvaluation(memberId, period, value, next, aiModel);
        if (!res.ok) return void toast.error(res.error);
        setSaved(value);
        setStatus(next);
        setAiModel(null);
        toast.success(res.message);
      } catch {
        toast.error("저장에 실패했습니다.");
      }
    });

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="flex items-center gap-2 text-lg font-bold">
            <ClipboardCheckIcon className="size-5 text-brand" />
            {periodLabel(period)} 인사평가
          </CardTitle>
          {status === "final" ? <Badge className="bg-emerald-100 text-emerald-800">확정</Badge> : status === "draft" ? <Badge variant="secondary">임시 저장</Badge> : <Badge variant="outline">미작성</Badge>}
          {dirty && (
            <Badge variant="outline" className="text-amber-700">
              저장되지 않음
            </Badge>
          )}
          <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
            <LockIcon className="size-3" />팀장·관리자만 볼 수 있습니다
          </span>
        </div>
        <CardDescription>
          {memberName}님의 {periodLabel(period)} 평가 · 각 항목 1~{MAX_SCORE}점, 총점은 평균입니다.
          {meta && ` · ${meta.evaluatorName} · 마지막 저장 ${fmt(meta.updatedAt)}`}
          {meta?.finalizedAt && status === "final" && ` · 확정 ${fmt(meta.finalizedAt)}`}
          {meta?.aiGeneratedAt && ` · AI 채점 참고 (${meta.aiModel ?? "AI"})`}
        </CardDescription>
      </CardHeader>

      <CardContent className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="grid content-start gap-5">
          {!locked && (
            <div className="grid gap-2 rounded-xl border border-brand/20 bg-gradient-to-br from-brand-soft to-card p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-accent-foreground">
                <SparklesIcon className="size-4" />
                AI 채점
                <span className="font-normal text-muted-foreground">· 일일·주간 보고와 리뷰를 읽고 항목별 점수와 근거를 제안합니다</span>
                <span className="ml-auto text-xs font-normal text-muted-foreground">{aiReady ? model : "키 미설정"}</span>
              </div>
              {!aiReady && <p className="text-xs text-amber-900">OPENAI_API_KEY가 설정되지 않았습니다. .env에 키를 넣고 서버를 재시작하면 사용할 수 있습니다.</p>}
              <div className="flex gap-2">
                <Input value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="추가 지시 (선택) 예: 3분기 결제 프로젝트 기여를 중점적으로" maxLength={300} disabled={!aiReady || busy} aria-label="AI 추가 지시" className="bg-card" />
                <Button onClick={() => (scored > 0 || value.summary.trim() ? setConfirmAi(true) : generate())} disabled={!aiReady || busy || r.tasksTotal + r.itemsTotal === 0} className="shrink-0">
                  {generating ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
                  {scored > 0 ? "다시 채점" : "AI 채점"}
                </Button>
              </div>
              {r.tasksTotal + r.itemsTotal === 0 && <p className="text-xs text-muted-foreground">이 기간에 일일·주간 기록이 없어 AI 채점을 할 수 없습니다.</p>}
              {generating && <p className="text-xs text-muted-foreground">분기 기록을 주 단위로 읽고 있어요. 10~30초 걸릴 수 있습니다.</p>}
            </div>
          )}

          <ul className={cn("grid gap-3", generating && "pointer-events-none opacity-60")}>
            {CRITERIA.map((c) => {
              const v = value.scores[c.key];
              return (
                <li key={c.key} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-semibold">
                      {c.label}
                      <span className={cn("tabular-nums text-sm", v ? "text-brand" : "text-muted-foreground")}>{v ?? "–"}/{MAX_SCORE}</span>
                      {v != null && aiScores[c.key] === v && <span className="rounded-full bg-brand-soft px-1.5 text-[10px] font-semibold text-accent-foreground ring-1 ring-brand/30">AI</span>}
                    </div>
                    {v != null && <Stars score={v} />}
                    <div className="text-xs text-muted-foreground">{c.hint}</div>
                  </div>
                  <div role="radiogroup" aria-label={`${c.label} 점수`} className="grid grid-cols-10 gap-1">
                    {SCORES.map((n) => {
                      const on = v === n;
                      const filled = v != null && n <= v;
                      return (
                        <button
                          key={n}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          aria-label={`${c.label} ${n}점`}
                          disabled={busy}
                          onClick={() => setScore(c.key, n)}
                          className={cn(
                            "h-8 rounded-md text-xs font-semibold tabular-nums transition-colors",
                            filled ? (v! <= 4 ? "bg-red-400 text-white" : v! <= 6 ? "bg-amber-400 text-white" : v! <= 8 ? "bg-sky-500 text-white" : "bg-brand text-white") : "bg-muted text-muted-foreground hover:bg-muted-foreground/15",
                            on && "ring-2 ring-offset-1 ring-foreground/30",
                          )}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                  {value.reasons[c.key] || openReasons.has(c.key) ? (
                    <div className="sm:col-span-2">
                      <Textarea
                        value={value.reasons[c.key] ?? ""}
                        onChange={(e) => setReason(c.key, e.target.value)}
                        rows={2}
                        maxLength={600}
                        placeholder="근거: 구체적인 주차·항목·수치"
                        aria-label={`${c.label} 근거`}
                        disabled={busy}
                        className="min-h-0 bg-muted/30 text-sm"
                      />
                    </div>
                  ) : (
                    <button type="button" onClick={() => setOpenReasons((s) => new Set(s).add(c.key))} className="flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground sm:col-span-2">
                      <PlusIcon className="size-3" />
                      근거 추가
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="grid gap-4">
            <Field id="ev-summary" label="종합 의견" required>
              <Textarea id="ev-summary" value={value.summary} onChange={(e) => setValue((p) => ({ ...p, summary: e.target.value }))} rows={3} maxLength={3000} placeholder="평가 기간 동안의 전반적인 성과와 태도" disabled={pending} />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field id="ev-strengths" label="강점">
                <Textarea id="ev-strengths" value={value.strengths} onChange={(e) => setValue((p) => ({ ...p, strengths: e.target.value }))} rows={3} maxLength={3000} placeholder="구체적인 사례와 함께" disabled={pending} />
              </Field>
              <Field id="ev-improvements" label="개선 필요 사항">
                <Textarea id="ev-improvements" value={value.improvements} onChange={(e) => setValue((p) => ({ ...p, improvements: e.target.value }))} rows={3} maxLength={3000} placeholder="다음 기간에 기대하는 변화" disabled={pending} />
              </Field>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
            <Button variant="ghost" size="sm" onClick={() => setValue(saved)} disabled={!dirty || pending}>
              <Undo2Icon />
              되돌리기
            </Button>
            <div className="flex flex-wrap gap-2">
              {status === "final" && !dirty ? (
                <Button variant="outline" onClick={() => save("draft")} disabled={pending}>
                  확정 해제
                </Button>
              ) : (
                <Button variant="outline" onClick={() => save("draft")} disabled={pending || (!dirty && status === "draft")}>
                  {pending ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
                  임시 저장
                </Button>
              )}
              <Button onClick={() => save("final")} disabled={pending || locked || scored < CRITERIA.length || !value.summary.trim()} title={scored < CRITERIA.length ? "모든 항목을 채점해야 확정할 수 있습니다" : undefined}>
                {pending ? <Loader2Icon className="animate-spin" /> : <CheckCircle2Icon />}
                평가 확정
              </Button>
            </div>
          </div>
        </div>

        <aside className="grid content-start gap-4">
          <div className="rounded-2xl border bg-gradient-to-br from-brand-soft to-card p-4 text-center">
            <div className="text-xs font-medium text-muted-foreground">총점</div>
            <div className="mt-1 flex items-baseline justify-center gap-1">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span key={total ?? "none"} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }} className="text-4xl font-bold tabular-nums">
                  {total != null ? total.toFixed(1) : "–"}
                </motion.span>
              </AnimatePresence>
              <span className="text-sm text-muted-foreground">/ {MAX_SCORE}</span>
            </div>
            {grade ? (
              <span className={cn("mt-2 inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold", grade.className)}>
                {grade.grade} · {grade.label}
              </span>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">항목을 채점하면 등급이 표시됩니다</p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              채점 {scored}/{CRITERIA.length} · S 9↑ · A 8↑ · B 6.5↑ · C 5↑ · D
            </p>
          </div>

          <div className="grid gap-3 rounded-2xl border p-4 text-sm">
            <div>
              <div className="text-xs font-semibold text-muted-foreground">참고 지표</div>
              <div className="text-[11px] text-muted-foreground">
                {r.from} ~ {r.to} · 구성원이 남긴 기록 기준
              </div>
            </div>
            <RefGroup title="근태">
              <RefRow k="목표 작성" v={`${r.plannedDays}/${r.workDays}일 (${rate(r.plannedDays, r.workDays)})`} />
              <RefRow k="퇴근 정리" v={`${r.wrapDays}/${r.workDays}일 (${rate(r.wrapDays, r.workDays)})`} />
              <RefRow k="연차 사용" v={`${r.annualUsed}일`} />
              <RefRow k="병가 · 조퇴" v={`${r.sickDays}일 · ${r.earlyLeaves}회`} warn={r.earlyLeaves >= 3} />
              {r.otherLeaveDays > 0 && <RefRow k="기타 휴가" v={`${r.otherLeaveDays}일`} />}
            </RefGroup>
            <RefGroup title="성과">
              <RefRow k="일일 목표 완료" v={`${rate(r.tasksDone, r.tasksTotal)} (${r.tasksDone}/${r.tasksTotal})`} />
              <RefRow k="주간 항목 완료" v={`${rate(r.itemsDone, r.itemsTotal)} (${r.itemsDone}/${r.itemsTotal})`} />
              <RefRow k="주간 리뷰 평균" v={r.reviewAvg != null ? `${r.reviewAvg}/5 (${r.reviewCount}회)` : "—"} />
            </RefGroup>
          </div>
        </aside>
      </CardContent>

      <AlertDialog open={confirmAi} onOpenChange={setConfirmAi}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>입력한 점수와 의견을 AI 채점으로 바꿀까요?</AlertDialogTitle>
            <AlertDialogDescription>지금 화면의 점수·근거·의견이 AI 제안으로 대체됩니다. 저장하기 전까지는 ‘되돌리기’로 마지막 저장본을 복원할 수 있습니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={generate}>AI로 다시 채점</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

/** 1–10 score as five stars with halves. */
function Stars({ score }: { score: number }) {
  const { full, half, empty } = starsOf(score);
  return (
    <span className="mt-0.5 flex items-center gap-px text-amber-400" aria-label={`별 ${score / 2}개`}>
      {Array.from({ length: full }, (_, i) => (
        <StarIcon key={`f${i}`} className="size-3.5 fill-current" />
      ))}
      {half && (
        <span className="relative size-3.5">
          <StarIcon className="absolute size-3.5 text-muted-foreground/30" />
          <StarHalfIcon className="absolute size-3.5 fill-current" />
        </span>
      )}
      {Array.from({ length: empty }, (_, i) => (
        <StarIcon key={`e${i}`} className="size-3.5 text-muted-foreground/30" />
      ))}
    </span>
  );
}

function Field({ id, label, required, children }: { id: string; label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-xs font-normal text-muted-foreground">· 확정 시 필수</span>}
      </Label>
      {children}
    </div>
  );
}

function RefGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <div className="text-xs font-semibold">{title}</div>
      {children}
    </div>
  );
}

function RefRow({ k, v, warn }: { k: string; v: string; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{k}</span>
      <span className={cn("font-medium tabular-nums", warn && "text-amber-700")}>{v}</span>
    </div>
  );
}
