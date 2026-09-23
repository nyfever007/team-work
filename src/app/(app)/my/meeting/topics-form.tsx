"use client";

import { useState, useTransition } from "react";
import { Loader2Icon, ListTodoIcon } from "lucide-react";
import { toast } from "sonner";
import type { MeetingResult } from "@/lib/meetings/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export function TopicsForm({ initial, action }: { initial: string; action: (topics: string) => Promise<MeetingResult> }) {
  const [topics, setTopics] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [pending, start] = useTransition();
  const dirty = topics !== saved;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><ListTodoIcon className="size-4" />이번 회의 주제</CardTitle>
        <CardDescription>팀장이 다루고 싶은 주제를 한 줄에 하나씩 적어 두면 AI 노트의 첫 섹션과 질문에 반영됩니다.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        <Textarea value={topics} onChange={(e) => setTopics(e.target.value)} rows={3} placeholder={"예)\n- 결제 v2 스테이징 전환 일정 확정\n- 온콜 로테이션 조정\n- 4분기 목표 초안"} maxLength={2000} aria-label="회의 주제" />
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{dirty ? "저장되지 않은 변경이 있습니다." : saved ? "저장됨" : "아직 주제가 없습니다."}</span>
          <Button
            size="sm"
            variant={dirty ? "default" : "outline"}
            disabled={pending || !dirty}
            onClick={() =>
              start(async () => {
                const r = await action(topics);
                if (r.ok) {
                  setSaved(r.content);
                  toast.success(r.message);
                } else toast.error(r.error);
              })
            }
          >
            {pending && <Loader2Icon className="size-3.5 animate-spin" />}
            주제 저장
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
