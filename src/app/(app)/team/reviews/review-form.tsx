"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRightIcon, CheckCheckIcon, EyeIcon, Loader2Icon, MessageCircleReplyIcon, PencilIcon, SaveIcon, SendIcon, SparklesIcon, Undo2Icon } from "lucide-react";
import { toast } from "sonner";
import { generateMemberReview, saveMemberReview } from "@/lib/member-reviews/actions";
import { RATINGS, RATING_CLASS, RATING_LABEL, actionLines, type MemberReviewInput, type MemberReviewStatus } from "@/lib/member-reviews/types";
import { ReviewView } from "@/components/member-reviews/review-view";
import { EASE } from "@/components/motion";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Props = {
  memberId: number;
  memberName: string;
  weekStart: string;
  nextWeekLabel: string;
  initial: MemberReviewInput;
  status: MemberReviewStatus | null;
  meta: { reviewerName: string; updatedAt: number; sharedAt: number | null; ackAt: number | null; model: string | null } | null;
  reply: { text: string; at: number | null } | null;
  aiReady: boolean;
  model: string;
  hasRecords: boolean;
  sourceText: string;
  nextPending: { name: string; href: string } | null;
};

const fmt = (ts: number | null) => (ts ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ts)) : "");
const same = (a: MemberReviewInput, b: MemberReviewInput) => a.summary === b.summary && a.strengths === b.strengths && a.improvements === b.improvements && a.nextActions === b.nextActions && a.rating === b.rating;
const isEmpty = (v: MemberReviewInput) => !v.summary.trim() && !v.strengths.trim() && !v.improvements.trim() && !v.nextActions.trim();

export function ReviewForm(props: Props) {
  const { memberId, memberName, weekStart, nextWeekLabel, aiReady, model, hasRecords, sourceText, nextPending, reply, meta } = props;
  const [value, setValue] = useState<MemberReviewInput>(props.initial);
  const [saved, setSaved] = useState<MemberReviewInput>(props.initial);
  const [status, setStatus] = useState<MemberReviewStatus | null>(props.status);
  const [aiModel, setAiModel] = useState<string | null>(null);
  const [instructions, setInstructions] = useState("");
  const [assignNext, setAssignNext] = useState(props.status !== "shared");
  const [preview, setPreview] = useState(props.status === "shared");
  const [confirmAi, setConfirmAi] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [justShared, setJustShared] = useState(false);
  const [generating, startGenerate] = useTransition();
  const [saving, startSave] = useTransition();
  const busy = generating || saving;
  const dirty = !same(value, saved);
  const set = <K extends keyof MemberReviewInput>(k: K, v: MemberReviewInput[K]) => setValue((p) => ({ ...p, [k]: v }));
  const actions = actionLines(value.nextActions);

  const generate = () =>
    startGenerate(async () => {
      try {
        const r = await generateMemberReview(memberId, weekStart, instructions);
        if (!r.ok) return void toast.error(r.error);
        setValue(r.draft);
        setAiModel(r.model);
        setPreview(false);
        toast.success("AI 초안을 채웠습니다. 검토하고 다듬은 뒤 공유하세요.");
      } catch {
        toast.error("AI 초안 생성에 실패했습니다.");
      }
    });

  const save = (share: boolean) =>
    startSave(async () => {
      try {
        const r = await saveMemberReview(memberId, weekStart, value, { share, assignNext: share && assignNext, model: aiModel });
        if (!r.ok) return void toast.error(r.error);
        setSaved(value);
        setStatus(share ? "shared" : "draft");
        setAiModel(null);
        if (share) {
          setPreview(true);
          setAssignNext(false);
          setJustShared(true);
        }
        toast.success(r.message);
      } catch {
        toast.error("저장에 실패했습니다.");
      }
    });

  return (
    <div className="grid min-w-0 content-start gap-4">
      <Card className="min-w-0">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base font-bold">{memberName}님 주간 리뷰</CardTitle>
            {status === "shared" ? <Badge className="bg-brand-soft text-accent-foreground">공유됨</Badge> : status === "draft" ? <Badge variant="secondary">초안</Badge> : null}
            {dirty && (
              <Badge variant="outline" className="text-amber-700">
                저장되지 않음
              </Badge>
            )}
            {status === "shared" && (
              <div className="ml-auto flex gap-1">
                <Button variant={preview ? "ghost" : "secondary"} size="sm" onClick={() => setPreview(false)} aria-pressed={!preview}>
                  <PencilIcon />
                  편집
                </Button>
                <Button variant={preview ? "secondary" : "ghost"} size="sm" onClick={() => setPreview(true)} aria-pressed={preview}>
                  <EyeIcon />
                  구성원 화면
                </Button>
              </div>
            )}
          </div>
          <CardDescription>
            {meta ? `${meta.reviewerName} · 마지막 저장 ${fmt(meta.updatedAt)}` : "아직 작성하지 않았습니다."}
            {meta?.sharedAt && ` · 공유 ${fmt(meta.sharedAt)}`}
            {meta?.ackAt && status === "shared" && !dirty && (
              <span className="ml-1 inline-flex items-center gap-0.5 text-emerald-700">
                · <CheckCheckIcon className="size-3.5" /> {memberName}님 확인 {fmt(meta.ackAt)}
              </span>
            )}
          </CardDescription>
        </CardHeader>

        <CardContent className="grid gap-5">
          {!preview && (
            <div className="grid gap-2 rounded-xl border border-brand/20 bg-gradient-to-br from-brand-soft to-card p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-accent-foreground">
                <SparklesIcon className="size-4" />
                AI로 초안 만들기
                <span className="ml-auto text-xs font-normal text-muted-foreground">{aiReady ? model : "키 미설정"}</span>
              </div>
              {!aiReady && <p className="text-xs text-amber-900">OPENAI_API_KEY가 설정되지 않았습니다. 직접 작성하거나, .env에 키를 넣고 서버를 재시작하세요.</p>}
              <div className="flex gap-2">
                <Input value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="추가 지시 (선택) 예: 코드 리뷰 참여를 더 강조" maxLength={300} disabled={!aiReady || busy} aria-label="AI 추가 지시" className="bg-card" />
                <Button onClick={() => (isEmpty(value) ? generate() : setConfirmAi(true))} disabled={!aiReady || busy || !hasRecords} className="shrink-0">
                  {generating ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
                  {isEmpty(value) ? "초안 생성" : "다시 생성"}
                </Button>
              </div>
              {!hasRecords && <p className="text-xs text-muted-foreground">이 주에 구성원 기록이 없어 AI 초안을 만들 수 없습니다.</p>}
              {generating && <p className="text-xs text-muted-foreground">한 주 기록을 읽고 있어요. 보통 10~20초 걸립니다.</p>}
            </div>
          )}

          <AnimatePresence mode="wait" initial={false}>
            {preview ? (
              <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="grid gap-3">
                {value.rating && (
                  <span className={cn("w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold", RATING_CLASS[value.rating])}>성과 수준 · {RATING_LABEL[value.rating]}</span>
                )}
                {isEmpty(value) ? <p className="py-6 text-center text-sm text-muted-foreground">내용이 없습니다.</p> : <ReviewView review={value} />}
              </motion.div>
            ) : (
              <motion.div key="edit" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25, ease: EASE }} className={cn("grid gap-4", generating && "pointer-events-none opacity-60")}>
                <fieldset className="grid gap-1.5">
                  <legend className="mb-1.5 text-sm font-medium">성과 수준</legend>
                  <div role="radiogroup" aria-label="성과 수준" className="grid grid-cols-5 gap-1 rounded-xl bg-muted/60 p-1">
                    {RATINGS.map((r) => {
                      const on = value.rating === r;
                      return (
                        <button
                          key={r}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => set("rating", on ? null : r)}
                          className={cn("relative rounded-lg px-1 py-1.5 text-xs font-medium transition-colors", on ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
                        >
                          {on && <motion.span layoutId={`rating-${memberId}`} className={cn("absolute inset-0 rounded-lg shadow-sm", RATING_CLASS[r])} transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
                          <span className="relative block text-[13px] font-bold tabular-nums">{r}</span>
                          <span className="relative block truncate">{RATING_LABEL[r]}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">선택 사항입니다. 다시 누르면 해제됩니다.</p>
                </fieldset>

                <Field id="summary" label="종합 평가" hint="한 주를 2~3문장으로">
                  <Textarea id="summary" value={value.summary} onChange={(e) => set("summary", e.target.value)} rows={3} maxLength={3000} placeholder="이번 주 전반적인 성과와 태도를 정리해 주세요." />
                </Field>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field id="strengths" label="잘한 점" tone="good">
                    <Textarea id="strengths" value={value.strengths} onChange={(e) => set("strengths", e.target.value)} rows={4} maxLength={3000} placeholder="- 구체적인 항목과 날짜로" />
                  </Field>
                  <Field id="improvements" label="보완할 점" tone="warn">
                    <Textarea id="improvements" value={value.improvements} onChange={(e) => set("improvements", e.target.value)} rows={4} maxLength={3000} placeholder="- 모자랐던 부분, 기대하는 모습" />
                  </Field>
                </div>
                <Field id="nextActions" label="다음 주에 해 주세요" hint="한 줄에 하나씩">
                  <Textarea id="nextActions" value={value.nextActions} onChange={(e) => set("nextActions", e.target.value)} rows={3} maxLength={3000} placeholder={"결제 API 테스트 커버리지 80% 달성\n매일 퇴근 전 정리 작성"} />
                </Field>
                {actions.length > 0 && (
                  <label className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
                    <input type="checkbox" checked={assignNext} onChange={(e) => setAssignNext(e.target.checked)} className="mt-0.5 size-4 accent-[var(--brand)]" />
                    <span>
                      공유할 때 위 {actions.length}개 항목을 {memberName}님의 <b>다음 주({nextWeekLabel}~) 항목</b>으로 지정
                      <span className="block text-xs text-muted-foreground">이미 같은 제목의 항목이 있으면 건너뜁니다.</span>
                    </span>
                  </label>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
            <Button variant="ghost" size="sm" onClick={() => setValue(saved)} disabled={!dirty || busy}>
              <Undo2Icon />
              되돌리기
            </Button>
            <div className="flex flex-wrap gap-2">
              {status === "shared" ? (
                <Button variant="outline" size="sm" onClick={() => save(false)} disabled={busy}>
                  공유 취소
                </Button>
              ) : (
                <Button variant="outline" onClick={() => save(false)} disabled={busy || (!dirty && status === "draft")}>
                  {saving ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
                  초안 저장
                </Button>
              )}
              <Button onClick={() => save(true)} disabled={busy || isEmpty(value) || (status === "shared" && !dirty)}>
                {saving ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
                {status === "shared" ? "수정 내용 공유" : `${memberName}님에게 공유`}
              </Button>
            </div>
          </div>

          <AnimatePresence>
            {justShared && nextPending && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3, ease: EASE }}>
                <Link href={nextPending.href} className="group flex items-center justify-between rounded-xl bg-brand px-4 py-3 text-sm font-medium text-white shadow-sm shadow-brand/30">
                  다음 구성원 리뷰하기 · {nextPending.name}
                  <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {reply && (
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <MessageCircleReplyIcon className="size-4 text-violet-600" />
              {memberName}님의 답글
              <span className="ml-auto text-xs font-normal text-muted-foreground">{fmt(reply.at)}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{reply.text}</p>
          </CardContent>
        </Card>
      )}

      <div>
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setShowSource((v) => !v)} aria-expanded={showSource}>
          {showSource ? "AI 참고 자료 접기" : "AI에게 전달되는 원본 보기"}
        </Button>
        {showSource && <pre className="mt-2 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-xl bg-muted/50 p-3 text-xs leading-relaxed">{sourceText}</pre>}
      </div>

      <AlertDialog open={confirmAi} onOpenChange={setConfirmAi}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>작성 중인 내용을 AI 초안으로 바꿀까요?</AlertDialogTitle>
            <AlertDialogDescription>지금 입력된 평가 내용이 새 초안으로 대체됩니다. 저장하기 전까지는 ‘되돌리기’로 마지막 저장본을 복원할 수 있습니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={generate}>새 초안 생성</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({ id, label, hint, tone, children }: { id: string; label: string; hint?: string; tone?: "good" | "warn"; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="flex items-center gap-1.5">
        {tone && <span className={cn("size-2 rounded-full", tone === "good" ? "bg-emerald-500" : "bg-amber-500")} />}
        {label}
        {hint && <span className="text-xs font-normal text-muted-foreground">· {hint}</span>}
      </Label>
      {children}
    </div>
  );
}
