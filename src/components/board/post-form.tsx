"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { savePost, type PostFormState } from "@/lib/board/actions";
import { DECISION_STATUSES, DECISION_STATUS_LABEL, DECISION_TEMPLATE, POST_CATEGORIES, POST_CATEGORY_HINT, POST_CATEGORY_LABEL, type DecisionStatus, type PostCategory } from "@/lib/board/types";
import { DatePicker } from "@/components/date-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

export type PostFormValues = {
  category: PostCategory;
  title: string;
  body: string;
  link: string;
  prompt: string;
  promptUse: string;
  promptModel: string;
  decidedAt: string;
  decisionStatus: DecisionStatus;
};

type Props = { id?: number; teamId: number; initial: PostFormValues; cancelHref: string };

export function PostForm({ id, teamId, initial, cancelHref }: Props) {
  const router = useRouter();
  const [state, action, pending] = useActionState<PostFormState, FormData>(savePost, undefined);
  const v = state && !state.ok ? state.values : undefined;
  const [category, setCategory] = useState<PostCategory>((v?.category as PostCategory) || initial.category);
  const [body, setBody] = useState(v?.body ?? initial.body);
  const [decidedAt, setDecidedAt] = useState(v?.decidedAt || initial.decidedAt);

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message);
      router.push(`/lounge/${state.id}`);
    } else if (state && !state.ok) toast.error(state.error);
  }, [state, router]);

  const changeCategory = (c: PostCategory) => {
    setCategory(c);
    if (c === "decision" && !body.trim()) setBody(DECISION_TEMPLATE);
    if (c !== "decision" && body === DECISION_TEMPLATE) setBody("");
  };

  return (
    <form action={action} className="grid gap-5">
      {id != null && <input type="hidden" name="id" value={id} />}
      <input type="hidden" name="teamId" value={teamId} />

      <div className="grid gap-1.5">
        <Label htmlFor="category">분류</Label>
        <NativeSelect id="category" name="category" value={category} onChange={(e) => changeCategory(e.target.value as PostCategory)} className="w-full sm:w-64">
          {POST_CATEGORIES.map((c) => (
            <NativeSelectOption key={c} value={c}>
              {POST_CATEGORY_LABEL[c]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <p className="text-xs text-muted-foreground">{POST_CATEGORY_HINT[category]}</p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="title">제목</Label>
        <Input id="title" name="title" defaultValue={v?.title ?? initial.title} maxLength={120} required />
      </div>

      {category === "decision" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="decidedAt">결정일</Label>
            <DatePicker id="decidedAt" name="decidedAt" value={decidedAt} onChange={setDecidedAt} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="decisionStatus">상태</Label>
            <NativeSelect id="decisionStatus" name="decisionStatus" defaultValue={v?.decisionStatus || initial.decisionStatus} className="w-full">
              {DECISION_STATUSES.map((s) => (
                <NativeSelectOption key={s} value={s}>
                  {DECISION_STATUS_LABEL[s]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        </div>
      )}

      {category === "prompt" && (
        <>
          <div className="grid gap-1.5">
            <Label htmlFor="prompt">프롬프트</Label>
            <Textarea id="prompt" name="prompt" rows={8} defaultValue={v?.prompt ?? initial.prompt} maxLength={10000} required className="font-mono text-sm" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="promptUse">용도</Label>
              <Input id="promptUse" name="promptUse" defaultValue={v?.promptUse ?? initial.promptUse} maxLength={200} placeholder="예) 회의록 요약" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="promptModel">모델</Label>
              <Input id="promptModel" name="promptModel" defaultValue={v?.promptModel ?? initial.promptModel} maxLength={100} placeholder="예) GPT-4o" />
            </div>
          </div>
        </>
      )}

      <div className="grid gap-1.5">
        <Label htmlFor="body">{category === "prompt" ? "설명·결과 예시" : "본문"}</Label>
        <Textarea id="body" name="body" rows={category === "decision" ? 12 : 10} value={body} onChange={(e) => setBody(e.target.value)} maxLength={10000} />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="link">링크 (선택)</Label>
        <Input id="link" name="link" type="url" defaultValue={v?.link ?? initial.link} maxLength={500} placeholder="https://" />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.push(cancelHref)} disabled={pending}>
          취소
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2Icon className="animate-spin" />}
          {id != null ? "저장" : "올리기"}
        </Button>
      </div>
    </form>
  );
}
